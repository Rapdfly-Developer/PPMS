"use server";

import { prisma } from "@/lib/prisma";
import { requireRole, requireUser } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { notifyAdmission } from "@/lib/mailer";
import { writeAudit } from "@/lib/audit";
import { syncVisit } from "@/lib/integration/engine";

async function assertVisitAccess(visitId: string) {
  const user = await requireUser();
  const visit = await prisma.visit.findUnique({ where: { id: visitId } });
  if (!visit) throw new Error("Visit not found");
  if (visit.status === "CLOSED") throw new Error("This consultation has been finalized and is read-only.");
  if (user.role === "DOCTOR" && visit.doctorId !== user.profileId) throw new Error("Forbidden");
  return visit;
}

function revalidate(udid: string) {
  revalidatePath(`/emr/${udid}`);
}

// ── Start Visit ─────────────────────────────────────────────────────────

export async function startVisit(patientId: string, appointmentId: string, udid: string) {
  const user = await requireRole("DOCTOR");

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { id: true, doctorId: true, hospitalId: true, visitType: true, patientId: true, notes: true },
  });
  if (!appointment) throw new Error("Appointment not found");
  if (appointment.doctorId !== user.profileId) throw new Error("Forbidden");

  // Prevent duplicate visit for same appointment
  const existing = await prisma.visit.findUnique({ where: { appointmentId } });
  if (existing) {
    revalidate(udid);
    return { visitId: existing.id };
  }

  const patient = await prisma.patient.findUnique({ where: { id: patientId } });

  const visit = await prisma.visit.create({
    data: {
      patientId,
      doctorId: user.profileId!,
      hospitalId: appointment.hospitalId,
      appointmentId,
      visitType: appointment.visitType ?? "General OPD",
    },
  });

  // Seed chief complaint from the booking form (appointment notes),
  // falling back to the complaint recorded at registration.
  const seedComplaint = appointment.notes || patient?.complaint;
  if (seedComplaint) {
    await prisma.generalExamination.create({
      data: { visitId: visit.id, chiefComplaint: seedComplaint },
    });
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "CONFIRMED" },
  });

  revalidate(udid);
  return { visitId: visit.id };
}

// ── General Examination ──────────────────────────────────────────────────

export async function saveGeneralExam(visitId: string, udid: string, data: Record<string, any>) {
  const user = await requireRole("DOCTOR");
  await assertVisitAccess(visitId);
  await prisma.generalExamination.upsert({
    where: { visitId },
    create: { visitId, ...data },
    update: data,
  });
  await writeAudit(user.id, "GeneralExamination", visitId, "SAVE", data);
  revalidate(udid);
}

// ── Past External Visits (OCR) ───────────────────────────────────────────

export async function addPastExternalVisit(
  patientId: string,
  udid: string,
  data: {
    originalFileName: string;
    scanFileUrl?: string;
    sourceDate?: string | null;
    sourceHospital?: string | null;
    extractedDiagnosis?: string | null;
    extractedTreatment?: string | null;
    rawText?: string;
  }
) {
  const user = await requireRole("DOCTOR", "HOSPITAL");

  await prisma.pastExternalVisit.create({
    data: {
      patientId,
      sourceDate: data.sourceDate ? new Date(data.sourceDate) : null,
      sourceHospital: data.sourceHospital ?? null,
      extractedDiagnosis: data.extractedDiagnosis ?? null,
      extractedTreatment: data.extractedTreatment ?? null,
      scanFileRef: data.scanFileUrl ?? data.originalFileName,
      verificationStatus: "PENDING_REVIEW",
    },
  });
  await writeAudit(user.id, "PastExternalVisit", patientId, "ADD", { sourceHospital: data.sourceHospital });
  revalidate(udid);
}

export async function verifyPastExternalVisit(id: string, udid: string, status: "VERIFIED" | "REJECTED", corrected?: Record<string, string>) {
  const user = await requireRole("DOCTOR");
  await prisma.pastExternalVisit.update({
    where: { id },
    data: { verificationStatus: status, ...(corrected ?? {}) },
  });
  await writeAudit(user.id, "PastExternalVisit", id, status);
  revalidate(udid);
}

// ── Ophthalmic Examination sub-modules ───────────────────────────────────

export async function saveVisualAcuity(visitId: string, udid: string, data: { testMethod: string; re: string; le: string }) {
  const user = await requireRole("DOCTOR");
  await assertVisitAccess(visitId);
  const reviewedByDoctor = user.role === "DOCTOR";
  await prisma.visualAcuity.upsert({
    where: { visitId },
    create: { visitId, ...data, reviewedByDoctor },
    update: { ...data, reviewedByDoctor },
  });
  await writeAudit(user.id, "VisualAcuity", visitId, "SAVE", data);
  revalidate(udid);
}

export async function saveRefraction(visitId: string, udid: string, data: { re: string; le: string }) {
  const user = await requireRole("DOCTOR");
  await assertVisitAccess(visitId);
  const reviewedByDoctor = user.role === "DOCTOR";
  await prisma.refractiveCorrection.upsert({
    where: { visitId },
    create: { visitId, ...data, reviewedByDoctor },
    update: { ...data, reviewedByDoctor },
  });
  await writeAudit(user.id, "RefractiveCorrection", visitId, "SAVE", data);

  // Auto-populate VisualAcuity bestCorrected fields from refraction VA values
  try {
    const va = await prisma.visualAcuity.findUnique({ where: { visitId } });
    if (va) {
      const updateEye = (vaJson: string | null, rxJson: string | null) => {
        if (!vaJson || !rxJson) return vaJson;
        try {
          const vaData = JSON.parse(vaJson);
          const rxData = JSON.parse(rxJson);
          if (rxData?.distance?.va) vaData.distanceBestCorrected = rxData.distance.va;
          if (rxData?.near?.va) vaData.nearBestCorrected = rxData.near.va;
          return JSON.stringify(vaData);
        } catch { return vaJson; }
      };
      await prisma.visualAcuity.update({
        where: { visitId },
        data: {
          re: updateEye(va.re, data.re),
          le: updateEye(va.le, data.le),
        },
      });
    }
  } catch { /* best-effort, don't break refraction save */ }

  revalidate(udid);
}

export async function sendToOpticals(visitId: string, udid: string) {
  await requireRole("DOCTOR");
  await prisma.refractiveCorrection.update({ where: { visitId }, data: { sentToOpticals: true } });
  revalidate(udid);
}

export async function saveColourVision(visitId: string, udid: string, data: { re: string; le: string }) {
  const user = await requireRole("DOCTOR");
  await assertVisitAccess(visitId);
  const reviewedByDoctor = user.role === "DOCTOR";
  await prisma.colourVisionContrastSensitivity.upsert({
    where: { visitId },
    create: { visitId, ...data, reviewedByDoctor },
    update: { ...data, reviewedByDoctor },
  });
  await writeAudit(user.id, "ColourVisionCS", visitId, "SAVE", data);
  revalidate(udid);
}

export async function addIOPReading(visitId: string, udid: string, data: { re?: number; le?: number; method: string }) {
  const user = await requireRole("DOCTOR");
  await assertVisitAccess(visitId);
  await prisma.iOPReading.create({
    data: { visitId, re: data.re, le: data.le, method: data.method, source: user.role, reviewedByDoctor: user.role === "DOCTOR" },
  });
  await writeAudit(user.id, "IOPReading", visitId, "ADD", data);
  revalidate(udid);
}

export async function removeIOPReading(id: string, udid: string) {
  const user = await requireRole("DOCTOR");
  await prisma.iOPReading.delete({ where: { id } });
  await writeAudit(user.id, "IOPReading", id, "DELETE", {});
  revalidate(udid);
}

export async function markOphthalmicReviewed(visitId: string) {
  await requireRole("DOCTOR");
  await Promise.all([
    prisma.visualAcuity.update({ where: { visitId }, data: { reviewedByDoctor: true } }).catch(() => {}),
    prisma.refractiveCorrection.update({ where: { visitId }, data: { reviewedByDoctor: true } }).catch(() => {}),
    prisma.colourVisionContrastSensitivity.update({ where: { visitId }, data: { reviewedByDoctor: true } }).catch(() => {}),
    prisma.iOPReading.updateMany({ where: { visitId }, data: { reviewedByDoctor: true } }),
  ]);
}

export async function saveAnteriorSegment(visitId: string, udid: string, data: { re: string; le: string }) {
  const user = await requireRole("DOCTOR");
  await assertVisitAccess(visitId);
  await prisma.anteriorSegment.upsert({ where: { visitId }, create: { visitId, ...data }, update: data });
  await writeAudit(user.id, "AnteriorSegment", visitId, "SAVE", data);
  revalidate(udid);
}

export async function savePosteriorSegment(visitId: string, udid: string, data: { re: string; le: string; notes?: string }) {
  const user = await requireRole("DOCTOR");
  await assertVisitAccess(visitId);
  await prisma.posteriorSegment.upsert({ where: { visitId }, create: { visitId, ...data }, update: data });
  await writeAudit(user.id, "PosteriorSegment", visitId, "SAVE", data);
  revalidate(udid);
}

export async function saveDiplopia(visitId: string, udid: string, grid: string) {
  const user = await requireRole("DOCTOR");
  await assertVisitAccess(visitId);
  await prisma.diplopiaChart.upsert({ where: { visitId }, create: { visitId, grid }, update: { grid } });
  await writeAudit(user.id, "DiplopiaChart", visitId, "SAVE", { grid });
  revalidate(udid);
}

export async function saveHess(visitId: string, udid: string, grid: string, interpretation?: string) {
  const user = await requireRole("DOCTOR");
  await assertVisitAccess(visitId);
  await prisma.hessChart.upsert({
    where: { visitId },
    create: { visitId, grid, interpretation },
    update: { grid, interpretation },
  });
  await writeAudit(user.id, "HessChart", visitId, "SAVE", { grid, interpretation });
  revalidate(udid);
}

export async function saveRetinoscopy(visitId: string, udid: string, data: { re: string; le: string }) {
  const user = await requireRole("DOCTOR");
  await assertVisitAccess(visitId);
  await prisma.retinoscopy.upsert({ where: { visitId }, create: { visitId, ...data }, update: data });
  await writeAudit(user.id, "Retinoscopy", visitId, "SAVE", data);
  revalidate(udid);
}

export async function getRefractionForVisit(visitId: string) {
  await requireUser();
  const rx = await prisma.refractiveCorrection.findFirst({ where: { visitId } });
  return rx ? { re: rx.re ?? "", le: rx.le ?? "" } : null;
}

export async function saveTearFilm(visitId: string, udid: string, data: Record<string, number | undefined>) {
  const user = await requireRole("DOCTOR");
  await assertVisitAccess(visitId);
  await prisma.tearFilm.upsert({ where: { visitId }, create: { visitId, ...data }, update: data });
  await writeAudit(user.id, "TearFilm", visitId, "SAVE", data);
  revalidate(udid);
}

export async function saveLacrimalSac(visitId: string, udid: string, data: { re: string; le: string }) {
  const user = await requireRole("DOCTOR");
  await assertVisitAccess(visitId);
  await prisma.lacrimalSacSyringing.upsert({ where: { visitId }, create: { visitId, ...data }, update: data });
  await writeAudit(user.id, "LacrimalSac", visitId, "SAVE", data);
  revalidate(udid);
}

// ── Investigations ───────────────────────────────────────────────────────

export async function addInvestigationOrder(
  visitId: string,
  udid: string,
  data: { category: string; testName: string; priority: string; laterality?: string; notes?: string }
) {
  const user = await requireRole("DOCTOR");
  await assertVisitAccess(visitId);
  await prisma.investigationOrder.create({ data: { visitId, ...data } });
  await writeAudit(user.id, "InvestigationOrder", visitId, "ADD", data);
  revalidate(udid);
}

export async function updateInvestigationStatus(id: string, udid: string, status: string) {
  const user = await requireRole("DOCTOR");
  await prisma.investigationOrder.update({ where: { id }, data: { status } });
  await writeAudit(user.id, "InvestigationOrder", id, "STATUS", { status });
  revalidate(udid);
}

export async function attachResult(id: string, udid: string, resultRef: string): Promise<{ error?: string }> {
  const user = await requireRole("DOCTOR", "HOSPITAL");
  const order = await prisma.investigationOrder.findUnique({ where: { id }, include: { visit: { select: { doctorId: true } } } });
  if (!order) return { error: "Order not found." };
  await prisma.investigationOrder.update({
    where: { id },
    data: { resultRef, status: "RESULT_AVAILABLE" },
  });
  await writeAudit(user.id, "InvestigationOrder", id, "RESULT_ATTACHED", { resultRef });
  revalidate(udid);
  return {};
}

// ── Assessment ────────────────────────────────────────────────────────────

export async function saveProvisionalDiagnosis(visitId: string, udid: string, text: string) {
  const user = await requireRole("DOCTOR");
  await assertVisitAccess(visitId);
  await prisma.generalExamination.upsert({
    where: { visitId },
    create: { visitId, provisionalDx: text },
    update: { provisionalDx: text },
  });
  await writeAudit(user.id, "ProvisionalDx", visitId, "SAVE", { text });
  revalidate(udid);
}

export async function addDiagnosis(
  visitId: string,
  udid: string,
  data: { icd10Code: string; description: string; laterality?: string; provisional?: boolean }
) {
  const user = await requireRole("DOCTOR");
  await assertVisitAccess(visitId);
  await prisma.diagnosis.create({ data: { visitId, status: "ACTIVE", ...data } });
  await writeAudit(user.id, "Diagnosis", visitId, "ADD", data);
  revalidate(udid);
}

export async function updateDiagnosisStatus(id: string, udid: string, status: string) {
  const user = await requireRole("DOCTOR");
  await prisma.diagnosis.update({ where: { id }, data: { status } });
  await writeAudit(user.id, "Diagnosis", id, "STATUS", { status });
  revalidate(udid);
}

export async function removeDiagnosis(id: string, udid: string) {
  const user = await requireRole("DOCTOR");
  const existing = await prisma.diagnosis.findUnique({ where: { id } });
  if (!existing) { revalidate(udid); return; }
  await prisma.diagnosis.delete({ where: { id } });
  await writeAudit(user.id, "Diagnosis", id, "REMOVE");
  revalidate(udid);
}

// ── Plan: Prescription / Medications ─────────────────────────────────────

export async function addMedication(
  visitId: string,
  udid: string,
  data: { drugName: string; dosage?: string; frequency?: string; duration?: string; instructions?: string }
) {
  const user = await requireRole("DOCTOR");
  await assertVisitAccess(visitId);
  await prisma.medication.create({ data: { visitId, ...data } });
  await writeAudit(user.id, "Medication", visitId, "ADD", data);
  revalidate(udid);
}

export async function removeMedication(id: string, udid: string) {
  const user = await requireRole("DOCTOR");
  await prisma.medication.delete({ where: { id } });
  await writeAudit(user.id, "Medication", id, "REMOVE");
  revalidate(udid);
}

export async function sendToPharmacy(visitId: string, udid: string) {
  const user = await requireRole("DOCTOR");
  await assertVisitAccess(visitId);
  await prisma.visit.update({ where: { id: visitId }, data: { sentToPharmacy: true } });
  await writeAudit(user.id, "Visit", visitId, "PHARMACY_SENT");
  revalidate(udid);
}

// Used by the "Save Draft" action in the EMR footer. Individual fields
// already auto-save on their own debounce; this just confirms the visit is
// still reachable/writable so the button gives real, visible confirmation
// rather than a no-op.
export async function touchVisit(visitId: string, udid: string) {
  await requireUser();
  await assertVisitAccess(visitId);
  revalidate(udid);
}

// ── Disposition ───────────────────────────────────────────────────────────

export async function saveDispense(visitId: string, udid: string, shortSummary: string) {
  const user = await requireRole("DOCTOR");
  await assertVisitAccess(visitId);
  await prisma.dispense.upsert({
    where: { visitId },
    create: { visitId, shortSummary },
    update: { shortSummary },
  });
  await writeAudit(user.id, "Dispense", visitId, "SAVE", { shortSummary });
  revalidate(udid);
}

export async function saveAdmission(
  visitId: string,
  udid: string,
  data: { reason: string; ward: string; numberOfDays: number }
) {
  const user = await requireRole("DOCTOR");
  const visit = await assertVisitAccess(visitId);
  await prisma.admission.upsert({ where: { visitId }, create: { visitId, ...data }, update: data });
  await writeAudit(user.id, "Admission", visitId, "SAVE", data);

  const [patient, hospitalStaff] = await Promise.all([
    prisma.patient.findUnique({ where: { id: visit.patientId } }),
    prisma.hospitalStaff.findMany({ where: { hospitalId: visit.hospitalId }, include: { user: true } }),
  ]);
  for (const staff of hospitalStaff) {
    await notifyAdmission(staff.user.email, { patientName: patient?.name ?? "", ward: data.ward, numberOfDays: data.numberOfDays });
  }

  revalidate(udid);
}

export async function saveSurgicalCounselling(
  visitId: string,
  udid: string,
  data: { surgeryType: string; rightEye: boolean; leftEye: boolean; anaesthesiaType: string; surgeryDate: string }
) {
  const user = await requireRole("DOCTOR");
  const visit = await assertVisitAccess(visitId);

  const surgeryDate = new Date(data.surgeryDate);
  const conflict = await prisma.appointment.findFirst({
    where: {
      doctorId: visit.doctorId,
      dateTime: { gte: new Date(surgeryDate.setHours(0, 0, 0, 0)), lte: new Date(surgeryDate.setHours(23, 59, 59, 999)) },
      status: { in: ["CONFIRMED", "REQUESTED"] },
    },
  });

  await prisma.surgicalCounselling.upsert({
    where: { visitId },
    create: {
      visitId,
      surgeryType: data.surgeryType,
      rightEye: data.rightEye,
      leftEye: data.leftEye,
      anaesthesiaType: data.anaesthesiaType,
      surgeryDate: new Date(data.surgeryDate),
      conflictFlag: !!conflict,
    },
    update: {
      surgeryType: data.surgeryType,
      rightEye: data.rightEye,
      leftEye: data.leftEye,
      anaesthesiaType: data.anaesthesiaType,
      surgeryDate: new Date(data.surgeryDate),
      conflictFlag: !!conflict,
    },
  });
  await writeAudit(user.id, "SurgicalCounselling", visitId, "SAVE", data);
  revalidate(udid);
}

export async function saveFollowUp(visitId: string, udid: string, data: { followUpDate?: string | null; referralEnabled: boolean; referralNote?: string }) {
  await requireRole("DOCTOR");
  await assertVisitAccess(visitId);
  await prisma.visit.update({
    where: { id: visitId },
    data: {
      followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
      referralEnabled: data.referralEnabled,
      referralNote: data.referralNote ?? null,
    },
  });
  revalidate(udid);
}

export async function closeVisit(visitId: string, udid: string) {
  const user = await requireRole("DOCTOR");

  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: { doctor: { select: { name: true } } },
  });
  if (!visit) throw new Error("Visit not found");

  const now = new Date();

  await prisma.visit.update({
    where: { id: visitId },
    data: { status: "CLOSED" },
  });

  // Resolve appointmentId — visits created via old flow may not have it linked
  let appointmentId = visit.appointmentId;
  if (!appointmentId) {
    const fallback = await prisma.appointment.findFirst({
      where: {
        patientId: visit.patientId,
        doctorId: visit.doctorId,
        status: { in: ["REQUESTED", "CONFIRMED", "SCHEDULED"] },
      },
      orderBy: { dateTime: "desc" },
      select: { id: true },
    });
    appointmentId = fallback?.id ?? null;
    // Also link the appointment to this visit going forward
    if (appointmentId) {
      await prisma.visit.update({ where: { id: visitId }, data: { appointmentId } });
    }
  }

  if (appointmentId) {
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: "DISPENSED" },
    });
    const completedBy = visit.doctor?.name ?? user.name;
    await prisma.$executeRaw`
      UPDATE "Appointment"
      SET "consultationStatus" = 'FINALIZED',
          "completedAt"        = ${now},
          "completedBy"        = ${completedBy}
      WHERE id = ${appointmentId}
    `;
  }

  // Sweep any remaining CONFIRMED/REQUESTED appointments for this patient+doctor today
  {
    const { startOfDay, endOfDay } = await import("date-fns");
    const todayStart = startOfDay(now);
    const todayEnd   = endOfDay(now);
    await prisma.appointment.updateMany({
      where: {
        patientId: visit.patientId,
        ...(visit.doctorId ? { doctorId: visit.doctorId } : {}),
        status:   { in: ["CONFIRMED", "REQUESTED"] },
        dateTime: { gte: todayStart, lte: todayEnd },
        ...(appointmentId ? { id: { not: appointmentId } } : {}),
      },
      data: { status: "DISPENSED" },
    });
  }

  await writeAudit(user.id, "Appointment", appointmentId ?? visitId, "FINALIZE_CONSULTATION", {
    completedAt: now.toISOString(),
    completedBy: visit.doctor?.name ?? user.name,
    visitId,
  });

  // Push the finalized visit to the hospital's system after the response is
  // sent; failures land in IntegrationLog, never block the consultation.
  after(async () => {
    try {
      await syncVisit(visitId, "AUTO");
    } catch {
      // logged inside the engine
    }
  });

  revalidate(udid);
  revalidatePath("/appointments");
  revalidatePath("/dashboard");
}
