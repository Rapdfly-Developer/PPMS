"use server";

/**
 * Surgical Counselling Workflow — server actions.
 *
 * Every action here is additive: it writes to CounsellingWorkflow /
 * CounsellingVersion / OtSlotRequest, and only ever *advances* the existing
 * SurgerySchedule using the same status vocabulary the legacy screens already
 * understand ("WAITING_DOCTOR_CONFIRMATION", "SURGERY_CONFIRMED", ...). No
 * existing action is modified or replaced.
 */

import { prisma } from "@/lib/prisma";
import { requireUser, userCan, type SessionUser } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/lib/notify";
import { writeAudit } from "@/lib/audit";
import {
  COUNSELLING_PERMISSIONS as P,
  DECISION_STAGE,
  DECISION_LABEL,
  DECISION_REQUIRES_REASON,
  CONFIRMATION_SECTIONS,
  type ClinicalDecision,
} from "@/lib/counselling-workflow";

/* ── Types ─────────────────────────────────────────────────────────────── */

export type CounsellingFormInput = {
  eyeLaterality: string;
  diagnosisText: string;
  procedureExplanation: string;
  benefits: string;
  risks: string;
  recoveryInfo: string;
  patientQuestions: string;
  estimatedCost: number | null;
  paymentMode: string;
  insuranceApproval: string;
  packageStatus: string;
  requiredInvestigations: string;
  investigationStatus: string;
  consentStatus: string;
  counsellingNotes: string;
};

export type ConfirmationFormInput = CounsellingFormInput & {
  confirmedSections: string[];
  confirmationNotes: string;
  patientReady: boolean;
  consentConfirmed: boolean;
};

export type OtSlotRequestInput = {
  hospitalId: string;
  otRoom: string;
  requestedDate: string;   // yyyy-mm-dd
  timeSlot: string;        // HH:mm
  doctorId: string;
  surgeryName: string;
  equipment: string;
  staff: string;
  notes: string;
};

type ActionResult = { error?: string; ok?: true };

/* ── Guards ────────────────────────────────────────────────────────────── */

async function requireCounsellingPermission(permission: string): Promise<SessionUser | null> {
  const user = await requireUser();
  return userCan(user, permission) ? user : null;
}

/* ── Internal helpers ──────────────────────────────────────────────────── */

/** Loads a workflow with everything the actions need to notify and audit. */
async function loadWorkflowContext(workflowId: string) {
  return prisma.counsellingWorkflow.findUnique({
    where: { id: workflowId },
    include: {
      surgicalCounselling: {
        include: {
          visit: { select: { doctorId: true, hospitalId: true, patientId: true } },
        },
      },
    },
  });
}

async function getDoctorUserId(doctorId: string): Promise<string | null> {
  const doc = await prisma.doctor.findUnique({
    where: { id: doctorId },
    select: { userId: true },
  });
  return doc?.userId ?? null;
}

async function getHospitalStaffUserIds(hospitalId: string): Promise<string[]> {
  const staff = await prisma.hospitalStaff.findMany({
    where: { hospitalId },
    select: { userId: true },
  });
  return staff.map((s) => s.userId);
}

async function getPatientName(patientId: string): Promise<string> {
  const p = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { name: true },
  });
  return p?.name ?? "Patient";
}

/** Writes a version snapshot. Never throws — history must not block the flow. */
async function writeVersion(
  workflowId: string,
  stage: string,
  changeType: string,
  user: SessionUser,
  snapshot: unknown,
  note?: string,
) {
  try {
    await prisma.counsellingVersion.create({
      data: {
        workflowId,
        stage,
        changeType,
        changedBy: user.id,
        changedByName: user.name,
        snapshot: JSON.stringify(snapshot),
        note: note?.trim() || null,
      },
    });
  } catch {
    // version history failures must never break the clinical workflow
  }
}

function revalidateAll(udid?: string) {
  revalidatePath("/counseling");
  revalidatePath("/scheduled-ot");
  if (udid) revalidatePath(`/patients/${udid}`);
}

/* ── Action 0: ensure a workflow row exists for a counselling record ───── */

/**
 * Opens the workflow layer for an existing SurgicalCounselling record, creating
 * the row if this is the first time anyone has acted on the case. Legacy records
 * are therefore adopted into the new flow on demand rather than by a bulk
 * migration — a record nobody touches keeps behaving exactly as it did before.
 *
 * Callers have already checked their own permission; this helper does not gate.
 */
async function ensureWorkflowRow(
  surgicalCounsellingId: string,
  user: SessionUser,
): Promise<{ error?: string; workflowId?: string }> {
  const existing = await prisma.counsellingWorkflow.findUnique({
    where: { surgicalCounsellingId },
    select: { id: true },
  });
  if (existing) return { workflowId: existing.id };

  const sc = await prisma.surgicalCounselling.findUnique({
    where: { id: surgicalCounsellingId },
    select: {
      id: true,
      rightEye: true,
      leftEye: true,
      insuranceType: true,
      investigationDone: true,
    },
  });
  if (!sc) return { error: "Counselling record not found." };

  const laterality = sc.rightEye && sc.leftEye ? "OU" : sc.rightEye ? "RE" : sc.leftEye ? "LE" : null;

  const created = await prisma.counsellingWorkflow.create({
    data: {
      surgicalCounsellingId,
      stage: "PENDING_COUNSELING",
      eyeLaterality: laterality,
      // Carry across what the legacy record already knows so the counselor is
      // not asked to retype it.
      paymentMode: sc.insuranceType ? "INSURANCE" : null,
      investigationStatus: sc.investigationDone ? "COMPLETED" : "PENDING",
    },
    select: { id: true },
  });

  await writeVersion(created.id, "PENDING_COUNSELING", "COUNSELING", user, {
    event: "workflow_opened",
    surgicalCounsellingId,
  });

  return { workflowId: created.id };
}

/** Public wrapper so a case page can adopt a legacy record explicitly. */
export async function ensureWorkflow(
  surgicalCounsellingId: string,
): Promise<{ error?: string; workflowId?: string }> {
  const user = await requireCounsellingPermission(P.view);
  if (!user) return { error: "You do not have access to the counseling workflow." };
  const result = await ensureWorkflowRow(surgicalCounsellingId, user);
  if (result.workflowId) revalidateAll();
  return result;
}

/* ── Action 1: Manager/Counselor completes initial counselling ─────────── */

/**
 * Keyed on the SurgicalCounselling id rather than the workflow id, so the very
 * first save on a legacy record creates its workflow row transparently.
 */
export async function submitCounselling(
  surgicalCounsellingId: string,
  udid: string,
  data: CounsellingFormInput,
): Promise<ActionResult> {
  const user = await requireCounsellingPermission(P.counsel);
  if (!user) return { error: "You do not have permission to complete counseling." };

  if (!data.procedureExplanation.trim()) return { error: "Procedure explanation is required." };
  if (!data.risks.trim())                return { error: "Risks and complications are required." };
  if (!data.consentStatus)               return { error: "Consent status is required." };

  const ensured = await ensureWorkflowRow(surgicalCounsellingId, user);
  if (ensured.error || !ensured.workflowId) return { error: ensured.error ?? "Could not open this case." };
  const workflowId = ensured.workflowId;

  const wf = await loadWorkflowContext(workflowId);
  if (!wf) return { error: "Counseling record not found." };

  await prisma.counsellingWorkflow.update({
    where: { id: workflowId },
    data: {
      stage:                  "AWAITING_DOCTOR_REVIEW",
      eyeLaterality:          data.eyeLaterality || null,
      diagnosisText:          data.diagnosisText.trim() || null,
      procedureExplanation:   data.procedureExplanation.trim(),
      benefits:               data.benefits.trim() || null,
      risks:                  data.risks.trim(),
      recoveryInfo:           data.recoveryInfo.trim() || null,
      patientQuestions:       data.patientQuestions.trim() || null,
      estimatedCost:          data.estimatedCost ?? null,
      paymentMode:            data.paymentMode || null,
      insuranceApproval:      data.insuranceApproval || null,
      packageStatus:          data.packageStatus || null,
      requiredInvestigations: data.requiredInvestigations.trim() || null,
      investigationStatus:    data.investigationStatus || null,
      consentStatus:          data.consentStatus || null,
      counsellingNotes:       data.counsellingNotes.trim() || null,
      counselledBy:           user.id,
      counselledByName:       user.name,
      counselledAt:           new Date(),
    },
  });

  await writeVersion(workflowId, "AWAITING_DOCTOR_REVIEW", "COUNSELING", user, data);
  await writeAudit(user.id, "CounsellingWorkflow", workflowId, "COUNSELING_COMPLETED", {
    stage: "AWAITING_DOCTOR_REVIEW",
  });

  // Notify the doctor that counselling is ready for review
  const [patientName, doctorUserId] = await Promise.all([
    getPatientName(wf.surgicalCounselling.visit.patientId),
    getDoctorUserId(wf.surgicalCounselling.visit.doctorId),
  ]);
  if (doctorUserId) {
    await createNotification(
      doctorUserId,
      "COUNSELLING_WORKFLOW",
      `Counseling completed for ${patientName}. Awaiting your clinical decision.`,
      workflowId,
    );
  }

  revalidateAll(udid);
  return { ok: true };
}

/* ── Action 2: Doctor records the clinical decision ────────────────────── */

export async function submitClinicalDecision(
  workflowId: string,
  udid: string,
  decision: ClinicalDecision,
  reason: string,
  requiredInvestigations: string,
): Promise<ActionResult> {
  const user = await requireCounsellingPermission(P.decide);
  if (!user) return { error: "Only a doctor can make the clinical decision." };

  const wf = await loadWorkflowContext(workflowId);
  if (!wf) return { error: "Counseling record not found." };

  if (DECISION_REQUIRES_REASON.includes(decision) && !reason.trim()) {
    return { error: `A reason is required for "${DECISION_LABEL[decision]}".` };
  }
  if (decision === "ADDITIONAL_INVESTIGATIONS" && !requiredInvestigations.trim()) {
    return { error: "Please specify which investigations are required." };
  }

  const nextStage = DECISION_STAGE[decision];

  await prisma.counsellingWorkflow.update({
    where: { id: workflowId },
    data: {
      stage:                  nextStage,
      decision,
      decisionReason:         reason.trim() || null,
      decisionInvestigations: requiredInvestigations.trim() || null,
      decidedBy:              user.id,
      decidedByName:          user.name,
      decidedAt:              new Date(),
      // A doctor asking for more investigations sends the case back to the
      // counselor, so the investigation status reopens.
      ...(decision === "ADDITIONAL_INVESTIGATIONS" ? { investigationStatus: "PENDING" } : {}),
    },
  });

  // Mirror the outcome onto the legacy SurgicalCounselling fields so the
  // existing screens stay in sync. Values used here are the ones those screens
  // already understand.
  await prisma.surgicalCounselling.update({
    where: { id: wf.surgicalCounsellingId },
    data: {
      reviewStatus:     decision === "FIT" ? "FIT_FOR_SURGERY" : decision,
      doctorReviewNote: reason.trim() || null,
      doctorReviewedAt: new Date(),
      ...(decision === "NOT_FIT" ? { fitForSurgery: false } : {}),
    },
  });

  await writeVersion(workflowId, nextStage, "DECISION", user, {
    decision,
    reason,
    requiredInvestigations,
  });
  await writeAudit(user.id, "CounsellingWorkflow", workflowId, "CLINICAL_DECISION", {
    decision,
    stage: nextStage,
  });

  // Notify the counselling / hospital side of the outcome
  const patientName = await getPatientName(wf.surgicalCounselling.visit.patientId);
  const staffIds = await getHospitalStaffUserIds(wf.surgicalCounselling.visit.hospitalId);
  const message =
    decision === "FIT"
      ? `${patientName} is Fit for Surgery. Please complete confirmation counseling.`
      : `Clinical decision for ${patientName}: ${DECISION_LABEL[decision]}${reason.trim() ? ` — ${reason.trim()}` : ""}.`;

  await Promise.all(
    staffIds.map((uid) => createNotification(uid, "COUNSELLING_WORKFLOW", message, workflowId)),
  );

  revalidateAll(udid);
  return { ok: true };
}

/* ── Action 3: Manager/Counselor completes confirmation counselling ────── */

export async function submitConfirmationCounselling(
  workflowId: string,
  udid: string,
  data: ConfirmationFormInput,
): Promise<ActionResult> {
  const user = await requireCounsellingPermission(P.counsel);
  if (!user) return { error: "You do not have permission to complete confirmation counseling." };

  const wf = await loadWorkflowContext(workflowId);
  if (!wf) return { error: "Counseling record not found." };

  if (wf.decision !== "FIT") {
    return { error: "Confirmation counseling is only available once the doctor marks the patient fit." };
  }

  const allKeys = CONFIRMATION_SECTIONS.map((s) => s.key);
  const missing = allKeys.filter((k) => !data.confirmedSections.includes(k));
  if (missing.length > 0) {
    return { error: `Please verify every section before confirming (${missing.length} remaining).` };
  }
  if (!data.consentConfirmed) return { error: "Patient consent must be confirmed." };
  if (!data.patientReady)     return { error: "Patient readiness must be confirmed." };

  await prisma.counsellingWorkflow.update({
    where: { id: workflowId },
    data: {
      stage:                  "READY_FOR_OT",
      eyeLaterality:          data.eyeLaterality || null,
      diagnosisText:          data.diagnosisText.trim() || null,
      procedureExplanation:   data.procedureExplanation.trim() || null,
      benefits:               data.benefits.trim() || null,
      risks:                  data.risks.trim() || null,
      recoveryInfo:           data.recoveryInfo.trim() || null,
      patientQuestions:       data.patientQuestions.trim() || null,
      estimatedCost:          data.estimatedCost ?? null,
      paymentMode:            data.paymentMode || null,
      insuranceApproval:      data.insuranceApproval || null,
      packageStatus:          data.packageStatus || null,
      requiredInvestigations: data.requiredInvestigations.trim() || null,
      investigationStatus:    data.investigationStatus || null,
      consentStatus:          data.consentStatus || null,
      confirmedSections:      JSON.stringify(data.confirmedSections),
      confirmationNotes:      data.confirmationNotes.trim() || null,
      patientReady:           data.patientReady,
      consentConfirmed:       data.consentConfirmed,
      confirmedBy:            user.id,
      confirmedByName:        user.name,
      confirmedAt:            new Date(),
    },
  });

  await writeVersion(workflowId, "READY_FOR_OT", "CONFIRMATION", user, data);
  await writeAudit(user.id, "CounsellingWorkflow", workflowId, "CONFIRMATION_COMPLETED", {
    stage: "READY_FOR_OT",
  });

  const patientName = await getPatientName(wf.surgicalCounselling.visit.patientId);
  const staffIds = await getHospitalStaffUserIds(wf.surgicalCounselling.visit.hospitalId);
  await Promise.all(
    staffIds.map((uid) =>
      createNotification(
        uid,
        "COUNSELLING_WORKFLOW",
        `${patientName} is ready for OT scheduling. Please request an OT slot.`,
        workflowId,
      ),
    ),
  );

  revalidateAll(udid);
  return { ok: true };
}

/* ── Action 4: Manager/Hospital Admin requests an OT slot ──────────────── */

export async function requestOtSlot(
  workflowId: string,
  udid: string,
  data: OtSlotRequestInput,
): Promise<ActionResult> {
  const user = await requireCounsellingPermission(P.schedule);
  if (!user) return { error: "You do not have permission to request an OT slot." };

  const wf = await loadWorkflowContext(workflowId);
  if (!wf) return { error: "Counseling record not found." };

  if (wf.stage !== "READY_FOR_OT" && wf.stage !== "RESCHEDULING_REQUIRED") {
    return { error: "This case is not ready for OT scheduling yet." };
  }
  if (!data.requestedDate) return { error: "Please choose a date." };
  if (!data.timeSlot)      return { error: "Please choose a time slot." };
  if (!data.surgeryName.trim()) return { error: "Surgery name is required." };

  const requestedDateTime = new Date(`${data.requestedDate}T${data.timeSlot || "09:00"}`);
  if (Number.isNaN(requestedDateTime.getTime())) return { error: "That date and time is not valid." };

  // Supersede any still-open request for this case
  await prisma.otSlotRequest.updateMany({
    where: { workflowId, status: { in: ["REQUESTED", "RESCHEDULE_SUGGESTED"] } },
    data: { status: "CANCELLED" },
  });

  const request = await prisma.otSlotRequest.create({
    data: {
      workflowId,
      hospitalId:      data.hospitalId || wf.surgicalCounselling.visit.hospitalId,
      otRoom:          data.otRoom.trim() || null,
      requestedDate:   requestedDateTime,
      timeSlot:        data.timeSlot || null,
      doctorId:        data.doctorId || wf.surgicalCounselling.visit.doctorId,
      surgeryName:     data.surgeryName.trim(),
      equipment:       data.equipment.trim() || null,
      staff:           data.staff.trim() || null,
      notes:           data.notes.trim() || null,
      status:          "REQUESTED",
      requestedBy:     user.id,
      requestedByName: user.name,
    },
  });

  await prisma.counsellingWorkflow.update({
    where: { id: workflowId },
    data: { stage: "OT_SLOT_REQUESTED" },
  });

  await writeVersion(workflowId, "OT_SLOT_REQUESTED", "OT_REQUEST", user, data);
  await writeAudit(user.id, "OtSlotRequest", request.id, "CREATE", { workflowId, status: "REQUESTED" });

  // Notify the operating surgeon, and hospital staff for visibility
  const patientName = await getPatientName(wf.surgicalCounselling.visit.patientId);
  const dt = requestedDateTime.toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
  const doctorUserId = await getDoctorUserId(data.doctorId || wf.surgicalCounselling.visit.doctorId);
  if (doctorUserId) {
    await createNotification(
      doctorUserId,
      "COUNSELLING_WORKFLOW",
      `OT slot requested for ${patientName}: ${data.surgeryName.trim()} on ${dt} at ${data.timeSlot}. Please approve.`,
      workflowId,
    );
  }
  const staffIds = await getHospitalStaffUserIds(wf.surgicalCounselling.visit.hospitalId);
  await Promise.all(
    staffIds
      .filter((uid) => uid !== user.id)
      .map((uid) =>
        createNotification(
          uid,
          "COUNSELLING_WORKFLOW",
          `OT slot requested for ${patientName} on ${dt} at ${data.timeSlot}. Awaiting doctor approval.`,
          workflowId,
        ),
      ),
  );

  revalidateAll(udid);
  return { ok: true };
}

/* ── Action 5: Doctor responds to the OT slot request ──────────────────── */

export async function respondToOtRequest(
  requestId: string,
  udid: string,
  response: "APPROVE" | "SUGGEST" | "REJECT",
  note: string,
  suggestedDate: string,
  suggestedTime: string,
): Promise<ActionResult> {
  const user = await requireCounsellingPermission(P.approveOt);
  if (!user) return { error: "Only a doctor can respond to an OT slot request." };

  const request = await prisma.otSlotRequest.findUnique({
    where: { id: requestId },
    include: {
      workflow: {
        include: {
          surgicalCounselling: {
            include: {
              visit: { select: { doctorId: true, hospitalId: true, patientId: true } },
            },
          },
        },
      },
    },
  });
  if (!request) return { error: "OT slot request not found." };
  if (request.status !== "REQUESTED") return { error: "This request has already been answered." };

  if (response === "REJECT" && !note.trim()) {
    return { error: "Please give a reason when rejecting an OT slot." };
  }

  let suggestedDateTime: Date | null = null;
  if (response === "SUGGEST") {
    if (!suggestedDate) return { error: "Please choose the date you are suggesting." };
    suggestedDateTime = new Date(`${suggestedDate}T${suggestedTime || "09:00"}`);
    if (Number.isNaN(suggestedDateTime.getTime())) return { error: "That suggested date and time is not valid." };
  }

  const requestStatus =
    response === "APPROVE" ? "APPROVED" :
    response === "SUGGEST" ? "RESCHEDULE_SUGGESTED" :
    "REJECTED";

  const nextStage =
    response === "APPROVE" ? "SCHEDULED_OT" : "RESCHEDULING_REQUIRED";

  const wf = request.workflow;
  const visit = wf.surgicalCounselling.visit;

  await prisma.otSlotRequest.update({
    where: { id: requestId },
    data: {
      status:            requestStatus,
      doctorNote:        note.trim() || null,
      suggestedDateTime: suggestedDateTime,
      respondedBy:       user.id,
      respondedAt:       new Date(),
    },
  });

  await prisma.counsellingWorkflow.update({
    where: { id: wf.id },
    data: { stage: nextStage },
  });

  /* ── Hand off to the existing SurgerySchedule flow on approval ───────── */
  if (response === "APPROVE") {
    const existing = await prisma.surgerySchedule.findFirst({
      where: { surgicalCounsellingId: wf.surgicalCounsellingId },
      select: { id: true },
    });

    const scheduleFields = {
      surgeryName:     request.surgeryName,
      plannedDateTime: request.requestedDate,
      otRoom:          request.otRoom,
      status:          "SURGERY_CONFIRMED",
      remarks:         note.trim() || null,
    };

    let scheduleId: string;
    if (existing) {
      await prisma.surgerySchedule.update({ where: { id: existing.id }, data: scheduleFields });
      scheduleId = existing.id;
    } else {
      const created = await prisma.surgerySchedule.create({
        data: {
          ...scheduleFields,
          surgicalCounsellingId: wf.surgicalCounsellingId,
          patientId:             visit.patientId,
          hospitalId:            request.hospitalId,
          operatingSurgeonId:    request.doctorId,
          surgeryCategory:       "MAJOR",
          urgencyType:           "ELECTIVE",
          priority:              "ROUTINE",
          consentReceived:       wf.consentConfirmed,
          reportsUploaded:       wf.investigationStatus === "COMPLETED",
          patientInformed:       true,
          createdBy:             user.id,
        },
        select: { id: true },
      });
      scheduleId = created.id;
    }

    await prisma.otSlotRequest.update({
      where: { id: requestId },
      data: { surgeryScheduleId: scheduleId },
    });

    // Keep the legacy counselling record in step
    await prisma.surgicalCounselling.update({
      where: { id: wf.surgicalCounsellingId },
      data: {
        fitForSurgery:  true,
        reviewStatus:   "CONFIRMED",
        confirmedFitAt: new Date(),
        surgeryDate:    request.requestedDate,
      },
    });
  }

  await writeVersion(wf.id, nextStage, "OT_DECISION", user, {
    response,
    note,
    suggestedDate,
    suggestedTime,
  });
  await writeAudit(user.id, "OtSlotRequest", requestId, "DOCTOR_RESPONSE", {
    response,
    status: requestStatus,
  });

  /* ── Notify ─────────────────────────────────────────────────────────── */
  const patientName = await getPatientName(visit.patientId);
  const staffIds = await getHospitalStaffUserIds(request.hospitalId);
  const dt = request.requestedDate.toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });

  const staffMessage =
    response === "APPROVE"
      ? `OT confirmed for ${patientName}: ${request.surgeryName} on ${dt}${request.otRoom ? ` — ${request.otRoom}` : ""}.`
      : response === "SUGGEST"
      ? `Doctor suggested another OT slot for ${patientName}: ${suggestedDateTime?.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}${note.trim() ? ` — ${note.trim()}` : ""}.`
      : `OT slot request for ${patientName} was rejected${note.trim() ? ` — ${note.trim()}` : ""}. Please request another slot.`;

  await Promise.all(
    staffIds.map((uid) => createNotification(uid, "COUNSELLING_WORKFLOW", staffMessage, wf.id)),
  );

  // On approval the surgeon gets the same confirmation the legacy flow sends
  if (response === "APPROVE") {
    const doctorUserId = await getDoctorUserId(request.doctorId);
    if (doctorUserId && doctorUserId !== user.id) {
      await createNotification(
        doctorUserId,
        "SURGERY_SCHEDULED",
        `Surgery confirmed: ${request.surgeryName} for ${patientName} on ${dt}.`,
        wf.id,
      );
    }
  }

  revalidateAll(udid);
  return { ok: true };
}

/* ── Action 6: cancel a case out of the workflow ───────────────────────── */

export async function cancelWorkflowCase(
  workflowId: string,
  udid: string,
  reason: string,
): Promise<ActionResult> {
  const user = await requireCounsellingPermission(P.counsel);
  if (!user) return { error: "You do not have permission to cancel this case." };

  const wf = await loadWorkflowContext(workflowId);
  if (!wf) return { error: "Counseling record not found." };
  if (!reason.trim()) return { error: "Please give a reason for cancelling." };

  await prisma.counsellingWorkflow.update({
    where: { id: workflowId },
    data: { stage: "CANCELLED", confirmationNotes: reason.trim() },
  });

  await prisma.otSlotRequest.updateMany({
    where: { workflowId, status: { in: ["REQUESTED", "RESCHEDULE_SUGGESTED"] } },
    data: { status: "CANCELLED" },
  });

  await writeVersion(workflowId, "CANCELLED", "OT_DECISION", user, { reason });
  await writeAudit(user.id, "CounsellingWorkflow", workflowId, "CANCELLED", { reason });

  const patientName = await getPatientName(wf.surgicalCounselling.visit.patientId);
  const doctorUserId = await getDoctorUserId(wf.surgicalCounselling.visit.doctorId);
  if (doctorUserId) {
    await createNotification(
      doctorUserId,
      "COUNSELLING_WORKFLOW",
      `Counseling case for ${patientName} was cancelled — ${reason.trim()}.`,
      workflowId,
    );
  }

  revalidateAll(udid);
  return { ok: true };
}
