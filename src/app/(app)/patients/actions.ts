"use server";

import { prisma } from "@/lib/prisma";
import { requireRole, requirePermission, requireUser, scopeDoctorId } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeAudit } from "@/lib/audit";
import Anthropic from "@anthropic-ai/sdk";
import { formatComplaintDisplay } from "@/lib/appointment-cc";

// ── Undo Dispense ────────────────────────────────────────────────────────────

export type UndoDispenseResult =
  | { ok: true; visitId: string; udid: string }
  | { ok: false; error: string };

export async function undoDispense(appointmentId: string): Promise<UndoDispenseResult> {
  const user = await requireRole("DOCTOR");
  const doctorId = scopeDoctorId(user);

  const appt = await prisma.appointment.findFirst({
    where: {
      id: appointmentId,
      doctorId,
      status: "DISPENSED",
      consultationStatus: "FINALIZED",
    },
    select: {
      id: true,
      visit: {
        select: {
          id: true,
          status: true,
          finalizedBy: true,
          patient: { select: { udid: true } },
        },
      },
    },
  });

  if (!appt) return { ok: false, error: "Appointment not found or not a finalized dispense." };
  const visit = appt.visit;
  if (!visit) return { ok: false, error: "No linked visit found for this appointment." };
  if (visit.status !== "CLOSED") return { ok: false, error: "Visit is not closed." };
  if (visit.finalizedBy?.startsWith("SYSTEM")) {
    return { ok: false, error: "Auto-closed visits cannot be reopened via Undo." };
  }
  const udid = visit.patient?.udid;
  if (!udid) return { ok: false, error: "Patient record not found." };

  await prisma.$transaction([
    prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: "CONFIRMED",
        consultationStatus: null,
        completedAt: null,
        completedBy: null,
        partialDispenseReason: null,
        partialDispenseAt: null,
      },
    }),
    prisma.visit.update({
      where: { id: visit.id },
      data: {
        status: "IN_PROGRESS",
        finalizedAt: null,
        finalizedBy: null,
      },
    }),
  ]);

  await writeAudit(
    user.id,
    "appointment",
    appointmentId,
    "UNDO_DISPENSE",
    { appointmentStatus: "CONFIRMED", visitStatus: "IN_PROGRESS", visitId: visit.id, timing: "preserved" },
    {
      oldValue: { appointmentStatus: "DISPENSED", visitStatus: visit.status },
      userName: user.name,
      moduleName: "patients",
      actionType: "UPDATE",
    },
  );

  revalidatePath("/patients");
  revalidatePath("/opd");
  revalidatePath("/dashboard");
  revalidatePath("/appointments");
  revalidatePath(`/patients/${udid}`);
  revalidatePath(`/emr/${udid}`);

  return { ok: true, visitId: visit.id, udid };
}

// ── Patient History Timeline ─────────────────────────────────────────────────

export type TimelineEventType =
  | "CONSULTATION"
  | "INVESTIGATION"
  | "SURGERY"
  | "BILLING"
  | "TRANSFER"
  | "EXTERNAL";

export type TimelineEvent = {
  id: string;
  type: TimelineEventType;
  date: string; // ISO
  title: string;
  hospitalName?: string | null;
  doctorName?: string | null;
  searchText: string; // flat lowercased string for search
  detail: {
    // CONSULTATION
    visitStatus?: string;
    visitType?: string;
    complaint?: string | null;
    bp?: string | null;
    pulse?: string | null;
    diagnoses?: { description: string; icd10Code: string; laterality?: string | null; provisional: boolean; status: string }[];
    medications?: { drugName: string; dosage?: string | null; frequency?: string | null; duration?: string | null }[];
    // CONSULTATION — timestamp trail
    bookedAt?: string | null;           // Appointment.createdAt
    scheduledAt?: string | null;        // Appointment.dateTime
    arrivedAt?: string | null;          // Appointment.arrivedAt
    seenAt?: string | null;             // Visit.date (consultation started)
    partialDispenseAt?: string | null;  // Appointment.partialDispenseAt
    finalizedAt?: string | null;        // Visit.finalizedAt (dispensed)
    // INVESTIGATION
    orders?: { id: string; testName: string; category: string; status: string; laterality?: string | null; priority: string; resultRef?: string | null; orderedAt?: string | null; reportUpdatedAt?: string | null }[];
    // SURGERY
    surgeryType?: string;
    surgeryDate?: string;
    rightEye?: boolean;
    leftEye?: boolean;
    anaesthesiaType?: string;
    // BILLING
    billSummary?: string;
    // TRANSFER
    fromHospital?: string | null;
    toHospital?: string | null;
    transferReason?: string | null;
    // EXTERNAL
    externalDiagnosis?: string | null;
    externalTreatment?: string | null;
    externalHospital?: string | null;
    scanRef?: string | null;
    verificationStatus?: string;
  };
};

export async function getPatientTimeline(patientId: string): Promise<TimelineEvent[]> {
  await requireRole("DOCTOR", "HOSPITAL", "REFRACTIONIST");

  const [visits, pastExternal, transferLogs] = await Promise.all([
    prisma.visit.findMany({
      where: { patientId },
      orderBy: { date: "desc" },
      include: {
        hospital:           { select: { name: true } },
        doctor:             { select: { name: true } },
        generalExam:        { select: { chiefComplaint: true, bp: true, pulse: true } },
        diagnoses:          { select: { description: true, icd10Code: true, laterality: true, provisional: true, status: true } },
        medications:        { select: { drugName: true, dosage: true, frequency: true, duration: true } },
        investigationOrders:{ select: { id: true, testName: true, category: true, status: true, laterality: true, priority: true, resultRef: true, createdAt: true, updatedAt: true } },
        dispense:           { select: { shortSummary: true } },
        appointment:        { select: { createdAt: true, dateTime: true, arrivedAt: true, partialDispenseAt: true } },
      },
    }),
    prisma.pastExternalVisit.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.auditLog.findMany({
      where: { entityType: "Patient", entityId: patientId, action: "TRANSFER" },
      orderBy: { timestamp: "desc" },
    }),
  ]);

  const events: TimelineEvent[] = [];

  for (const v of visits) {
    const hospital = v.hospital?.name ?? null;
    const doctor   = v.doctor?.name   ?? null;

    // Consultation event
    const diagText  = v.diagnoses.map((d) => d.description).join(" ");
    const medText   = v.medications.map((m) => m.drugName).join(" ");
    const complaint = v.generalExam?.chiefComplaint ?? null;
    events.push({
      id:          `consult-${v.id}`,
      type:        "CONSULTATION",
      date:        v.date.toISOString(),
      title:       complaint ? formatComplaintDisplay(complaint).slice(0, 80) : (v.visitType ?? "Consultation"),
      hospitalName: hospital,
      doctorName:   doctor,
      searchText:  [complaint, diagText, medText, hospital, doctor, v.visitType].filter(Boolean).join(" ").toLowerCase(),
      detail: {
        visitStatus: v.status,
        visitType:   v.visitType ?? undefined,
        complaint,
        bp:          v.generalExam?.bp    ?? null,
        pulse:       v.generalExam?.pulse ?? null,
        diagnoses:   v.diagnoses,
        medications: v.medications,
        // Timestamp trail
        bookedAt:          v.appointment?.createdAt?.toISOString()          ?? null,
        scheduledAt:       v.appointment?.dateTime?.toISOString()           ?? null,
        arrivedAt:         v.appointment?.arrivedAt?.toISOString()          ?? null,
        seenAt:            v.status === "CLOSED" ? v.date.toISOString() : null,
        partialDispenseAt: v.appointment?.partialDispenseAt?.toISOString() ?? null,
        finalizedAt:       v.finalizedAt?.toISOString()                     ?? null,
      },
    });

    // Investigation event — one card per visit that has orders
    if (v.investigationOrders.length > 0) {
      const testNames = v.investigationOrders.map((o) => o.testName).join(" ");
      events.push({
        id:          `inv-${v.id}`,
        type:        "INVESTIGATION",
        date:        v.investigationOrders[0].createdAt.toISOString(),
        title:       `${v.investigationOrders.length} Investigation${v.investigationOrders.length > 1 ? "s" : ""} Ordered`,
        hospitalName: hospital,
        doctorName:   doctor,
        searchText:  [testNames, hospital, doctor].filter(Boolean).join(" ").toLowerCase(),
        detail: {
          orders: v.investigationOrders.map((o) => ({
            ...o,
            orderedAt: o.createdAt.toISOString(),
            reportUpdatedAt: o.resultRef ? o.updatedAt.toISOString() : null,
            createdAt: undefined,
            updatedAt: undefined,
          })),
        },
      });
    }

    // Prescription dispensed
    if (v.dispense) {
      events.push({
        id:          `disp-${v.id}`,
        type:        "BILLING",
        date:        v.date.toISOString(),
        title:       "Prescription Dispensed",
        hospitalName: hospital,
        doctorName:   doctor,
        searchText:  [v.dispense.shortSummary, hospital].filter(Boolean).join(" ").toLowerCase(),
        detail: { billSummary: v.dispense.shortSummary },
      });
    }
  }

  // Past external visits
  for (const p of pastExternal) {
    events.push({
      id:          `ext-${p.id}`,
      type:        "EXTERNAL",
      date:        (p.sourceDate ?? p.createdAt).toISOString(),
      title:       `Past Visit · ${p.sourceHospital ?? "External Hospital"}`,
      hospitalName: p.sourceHospital ?? null,
      searchText:  [p.extractedDiagnosis, p.extractedTreatment, p.sourceHospital].filter(Boolean).join(" ").toLowerCase(),
      detail: {
        externalDiagnosis:  p.extractedDiagnosis,
        externalTreatment:  p.extractedTreatment,
        externalHospital:   p.sourceHospital,
        scanRef:            p.scanFileRef,
        verificationStatus: p.verificationStatus,
      },
    });
  }

  // Transfer audit logs
  for (const log of transferLogs) {
    let parsed: Record<string, string> = {};
    try { parsed = JSON.parse(log.newValue ?? "{}"); } catch {}
    events.push({
      id:          `trf-${log.id}`,
      type:        "TRANSFER",
      date:        log.timestamp.toISOString(),
      title:       `Transferred → ${parsed.toHospital ?? "Another Hospital"}`,
      hospitalName: parsed.toHospital ?? null,
      searchText:  [parsed.fromHospital, parsed.toHospital, parsed.reason].filter(Boolean).join(" ").toLowerCase(),
      detail: {
        fromHospital:   parsed.fromHospital ?? null,
        toHospital:     parsed.toHospital   ?? null,
        transferReason: parsed.reason       ?? null,
      },
    });
  }

  // Sort newest first
  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return events;
}

/**
 * Permanently deletes a patient and every record that belongs to them:
 * appointments, visits and all EMR sections, prescriptions, investigations,
 * diagnoses, surgery, insurance, consents and data-rights requests. Runs in
 * one transaction so a failure leaves nothing half-deleted. The audit log
 * entry is kept as the record of the deletion.
 */
export async function deletePatient(patientId: string): Promise<{ error?: string }> {
  // Deleting a patient is reserved for the doctor (super user); it is not a grantable role permission.
  const user = await requireUser();
  if (user.role !== "DOCTOR") return { error: "Only the doctor can delete patients." };

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { id: true, name: true, udid: true, doctorId: true, registeredAtId: true },
  });
  if (!patient) return { error: "Patient not found." };

  if (patient.doctorId !== user.profileId) return { error: "You can only delete your own patients." };

  try {
    await prisma.$transaction(async (tx) => {
      const visitIds = (await tx.visit.findMany({ where: { patientId }, select: { id: true } })).map((v) => v.id);
      const insuranceIds = (await tx.patientInsurance.findMany({ where: { patientId }, select: { id: true } })).map((i) => i.id);
      const surgeryIds = (await tx.surgerySchedule.findMany({ where: { patientId }, select: { id: true } })).map((s) => s.id);
      const claimIds = (await tx.insuranceClaim.findMany({ where: { patientInsuranceId: { in: insuranceIds } }, select: { id: true } })).map((c) => c.id);
      const otIds = (await tx.otRecord.findMany({ where: { surgeryScheduleId: { in: surgeryIds } }, select: { id: true } })).map((o) => o.id);
      const byVisit = { where: { visitId: { in: visitIds } } };

      // Surgery
      await tx.otTimeline.deleteMany({ where: { otRecordId: { in: otIds } } });
      await tx.otRecord.deleteMany({ where: { id: { in: otIds } } });
      await tx.surgeryConsent.deleteMany({ where: { surgeryScheduleId: { in: surgeryIds } } });
      await tx.preOpAssessment.deleteMany({ where: { surgeryScheduleId: { in: surgeryIds } } });
      await tx.postOpReview.deleteMany({ where: { surgeryScheduleId: { in: surgeryIds } } });
      await tx.surgerySchedule.deleteMany({ where: { id: { in: surgeryIds } } });

      // Insurance
      await tx.insuranceClaimDocument.deleteMany({ where: { claimId: { in: claimIds } } });
      await tx.insuranceSettlement.deleteMany({ where: { claimId: { in: claimIds } } });
      await tx.insurancePayment.deleteMany({ where: { claimId: { in: claimIds } } });
      await tx.insuranceQuery.deleteMany({ where: { claimId: { in: claimIds } } });
      await tx.insuranceClaim.deleteMany({ where: { id: { in: claimIds } } });
      await tx.insurancePreAuthorization.deleteMany({ where: { patientInsuranceId: { in: insuranceIds } } });
      await tx.patientInsurance.deleteMany({ where: { id: { in: insuranceIds } } });

      // EMR
      await tx.generalExamination.deleteMany(byVisit);
      await tx.medication.deleteMany(byVisit);
      await tx.visualAcuity.deleteMany(byVisit);
      await tx.refractiveCorrection.deleteMany(byVisit);
      await tx.colourVisionContrastSensitivity.deleteMany(byVisit);
      await tx.iOPReading.deleteMany(byVisit);
      await tx.anteriorSegment.deleteMany(byVisit);
      await tx.posteriorSegment.deleteMany(byVisit);
      await tx.diplopiaChart.deleteMany(byVisit);
      await tx.hessChart.deleteMany(byVisit);
      await tx.retinoscopy.deleteMany(byVisit);
      await tx.tearFilm.deleteMany(byVisit);
      await tx.lacrimalSacSyringing.deleteMany(byVisit);
      await tx.investigationOrder.deleteMany(byVisit);
      await tx.diagnosis.deleteMany(byVisit);
      await tx.dispense.deleteMany(byVisit);
      await tx.counsellingRecord.deleteMany(byVisit);
      await tx.visit.deleteMany({ where: { id: { in: visitIds } } });

      // Everything else tied to the patient
      await tx.appointment.deleteMany({ where: { patientId } });
      await tx.pastExternalVisit.deleteMany({ where: { patientId } });
      await tx.patientConsent.deleteMany({ where: { patientId } });
      await tx.dataRightsRequest.deleteMany({ where: { patientId } });
      await tx.patient.updateMany({ where: { referralPatientId: patientId }, data: { referralPatientId: null } });
      await tx.patient.delete({ where: { id: patientId } });
    }, { timeout: 30_000 });
  } catch (e) {
    console.error("[deletePatient] failed", e);
    return { error: "Could not delete this patient. Nothing was removed." };
  }

  writeAudit(user.id, "Patient", patientId, "DELETE", { name: patient.name, udid: patient.udid }, {
    moduleName: "Patient", actionType: "DELETE", userName: patient.name,
  });
  revalidatePath("/patients");
  return {};
}

export async function transferPatient(patientId: string, toHospitalId: string, reason?: string) {
  const user = await requireRole("DOCTOR");

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { name: true, udid: true, registeredAtId: true, registeredAt: { select: { name: true } } },
  });
  if (!patient) return { error: "Patient not found." };
  if (patient.registeredAtId === toHospitalId) {
    return { error: "Patient is already registered at this hospital." };
  }

  const toHospital = await prisma.hospital.findUnique({
    where: { id: toHospitalId },
    select: { name: true },
  });
  if (!toHospital) return { error: "Destination hospital not found." };

  await prisma.patient.update({
    where: { id: patientId },
    data: { registeredAtId: toHospitalId },
  });

  writeAudit(user.id, "Patient", patientId, "TRANSFER", {
    udid: patient.udid,
    fromHospital: patient.registeredAt?.name ?? null,
    toHospital: toHospital.name,
    reason: reason || null,
  }, {
    moduleName: "Patient", actionType: "UPDATE",
    oldValue: { registeredAt: patient.registeredAt?.name ?? null },
    userName: patient.name,
  });

  revalidatePath("/patients");
  revalidatePath(`/patients/${patient.udid}`);
  return { success: true, toHospital: toHospital.name };
}

// ── Patient History Drawers ──────────────────────────────────────────────────

export async function getPatientInvestigations(patientId: string) {
  await requireRole("DOCTOR", "HOSPITAL");
  const visits = await prisma.visit.findMany({
    where: { patientId },
    orderBy: { date: "desc" },
    select: {
      id: true,
      date: true,
      hospital: { select: { name: true } },
      investigationOrders: {
        select: { id: true, category: true, testName: true, laterality: true, priority: true, status: true, notes: true, resultRef: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  return visits
    .filter((v) => v.investigationOrders.length > 0)
    .map((v) => ({
      visitId: v.id,
      date: v.date.toISOString(),
      hospitalName: v.hospital?.name ?? null,
      orders: v.investigationOrders.map((o) => ({ ...o, createdAt: o.createdAt.toISOString() })),
    }));
}

export async function getPatientTreatmentHistory(patientId: string) {
  await requireRole("DOCTOR", "HOSPITAL");
  const visits = await prisma.visit.findMany({
    where: { patientId },
    orderBy: { date: "desc" },
    select: {
      id: true,
      date: true,
      hospital: { select: { name: true } },
      medications: {
        select: { id: true, drugName: true, dosage: true, frequency: true, duration: true, instructions: true, laterality: true },
        orderBy: { createdAt: "asc" },
      },
      diagnoses: {
        select: { description: true, icd10Code: true, laterality: true, status: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  return visits
    .filter((v) => v.medications.length > 0 || v.diagnoses.length > 0)
    .map((v) => ({
      visitId: v.id,
      date: v.date.toISOString(),
      hospitalName: v.hospital?.name ?? null,
      medications: v.medications,
      diagnoses: v.diagnoses,
    }));
}

export async function getPatientSpectacleHistory(patientId: string) {
  await requireRole("DOCTOR", "HOSPITAL");
  const visits = await prisma.visit.findMany({
    where: { patientId },
    orderBy: { date: "desc" },
    select: {
      id: true,
      date: true,
      hospital: { select: { name: true } },
      refraction: {
        select: { re: true, le: true, sentToOpticals: true },
      },
    },
  });
  return visits
    .filter((v) => v.refraction && (v.refraction.re || v.refraction.le))
    .map((v) => ({
      visitId: v.id,
      date: v.date.toISOString(),
      hospitalName: v.hospital?.name ?? null,
      re: v.refraction!.re,
      le: v.refraction!.le,
      sentToOpticals: v.refraction!.sentToOpticals,
    }));
}

export async function updatePatientDetails(patientId: string, data: Record<string, unknown>) {
  const user = await requireRole("DOCTOR", "HOSPITAL");
  const before = await prisma.patient.findUnique({ where: { id: patientId }, select: { name: true, age: true, mobile: true, complaint: true } });
  await prisma.patient.update({ where: { id: patientId }, data });
  writeAudit(user.id, "Patient", patientId, "UPDATE", data, {
    moduleName: "Patient", actionType: "UPDATE",
    oldValue: before, userName: before?.name,
  });
  revalidatePath("/patients");
}

// ── Visit Summary generation ─────────────────────────────────────────────────
//
// Two engines behind one action. Without ANTHROPIC_API_KEY the summary is built
// locally from the stored fields — no cost, and no patient data leaves the
// server. With a key set, Claude writes the prose instead. A failed API call
// falls back to the local narrative rather than showing the user an error.

const LATERALITY_WORDS: Record<string, string> = {
  RE: "right eye",
  LE: "left eye",
  OU: "both eyes",
};

/** "[RE] [3 days] Redness | [LE] Watering" → ["right eye redness for 3 days", "left eye watering"] */
function humanizeComplaints(raw: string): string[] {
  return raw
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((segment) => {
      let rest = segment;
      let lat = "";
      const latM = rest.match(/^\[(RE|LE|OU)\]\s*/);
      if (latM) {
        lat = LATERALITY_WORDS[latM[1]] ?? "";
        rest = rest.slice(latM[0].length);
      }
      let since = "";
      const sinceM = rest.match(/^\[(\d+)\s+(days|weeks|months|years)\]\s*/);
      if (sinceM) {
        const n = Number(sinceM[1]);
        const unit = n === 1 ? sinceM[2].replace(/s$/, "") : sinceM[2];
        since = `for ${n} ${unit}`;
        rest = rest.slice(sinceM[0].length);
      }
      return [lat, rest.trim().toLowerCase(), since].filter(Boolean).join(" ");
    })
    .filter(Boolean);
}

/** ["a", "b", "c"] → "a, b and c" */
function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function sexWord(sex?: string | null): string {
  const s = (sex ?? "").toLowerCase();
  if (s.startsWith("m")) return "male";
  if (s.startsWith("f")) return "female";
  return "patient";
}

type SummaryVisit = {
  date: Date;
  visitType: string | null;
  hospital: { name: string } | null;
  doctor: { name: string } | null;
  patient: { age: number | null; sex: string | null } | null;
  generalExam: { chiefComplaint: string | null; bp: string | null; pulse: string | null; weight: string | null; temperature: string | null; hpi: string | null } | null;
  diagnoses: { description: string; icd10Code: string; laterality: string | null; provisional: boolean; status: string }[];
  medications: { drugName: string; dosage: string | null; frequency: string | null; duration: string | null; instructions: string | null }[];
  investigationOrders: { testName: string; category: string; status: string }[];
};

/** Deterministic narrative assembled from stored fields. No model, no network. */
function buildLocalSummary(visit: SummaryVisit): string {
  const g = visit.generalExam;
  const sentences: string[] = [];
  const dateStr = visit.date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  // Who, where, when
  const age = visit.patient?.age;
  const who = age ? `${age}-year-old ${sexWord(visit.patient?.sex)}` : sexWord(visit.patient?.sex);
  let opening = `${capitalize(who)} seen on ${dateStr}`;
  if (visit.hospital?.name) opening += ` at ${visit.hospital.name}`;
  if (visit.doctor?.name) opening += ` under Dr. ${visit.doctor.name}`;
  if (visit.visitType) opening += ` (${visit.visitType})`;
  sentences.push(`${opening}.`);

  // Presenting complaints
  const complaints = g?.chiefComplaint ? humanizeComplaints(g.chiefComplaint) : [];
  if (complaints.length) {
    sentences.push(`Presented with ${joinList(complaints)}.`);
  }

  // Vitals
  const vitals = [
    g?.bp && `BP ${g.bp}`,
    g?.pulse && `pulse ${g.pulse}`,
    g?.temperature && `temperature ${g.temperature}`,
    g?.weight && `weight ${g.weight}`,
  ].filter(Boolean) as string[];
  if (vitals.length) sentences.push(`Vitals recorded: ${joinList(vitals)}.`);

  // Assessment
  if (visit.diagnoses.length) {
    const dx = visit.diagnoses.map((d) => {
      const qualifiers = [
        d.laterality ? (LATERALITY_WORDS[d.laterality] ?? d.laterality) : null,
        d.provisional ? "provisional" : null,
        d.status ? d.status.toLowerCase() : null,
      ].filter(Boolean);
      return qualifiers.length ? `${d.description} (${qualifiers.join(", ")})` : d.description;
    });
    sentences.push(`Assessment: ${joinList(dx)}.`);
  }

  // Plan — medications
  if (visit.medications.length) {
    const meds = visit.medications.map((m) =>
      [m.drugName, m.dosage, m.frequency, m.duration && `for ${m.duration}`].filter(Boolean).join(" ")
    );
    sentences.push(
      `Prescribed ${visit.medications.length} medication${visit.medications.length > 1 ? "s" : ""}: ${joinList(meds)}.`
    );
  }

  // Plan — investigations
  if (visit.investigationOrders.length) {
    const pending = visit.investigationOrders.filter((o) => o.status !== "COMPLETED" && o.status !== "CANCELLED");
    let line = `${visit.investigationOrders.length} investigation${visit.investigationOrders.length > 1 ? "s" : ""} ordered (${joinList(visit.investigationOrders.map((o) => o.testName))})`;
    if (pending.length) line += `, ${pending.length} awaiting results`;
    sentences.push(`${line}.`);
  }

  if (g?.hpi?.trim()) sentences.push(`History noted: ${g.hpi.trim()}`);

  if (sentences.length === 1) {
    sentences.push("No clinical findings, diagnoses or prescriptions were recorded for this visit.");
  }
  return sentences.join(" ");
}

export async function generateAiSummary(
  visitId: string
): Promise<{ text?: string; source?: "claude" | "local"; notice?: string; error?: string }> {
  await requireRole("DOCTOR", "HOSPITAL", "REFRACTIONIST");

  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: {
      hospital:            { select: { name: true } },
      doctor:              { select: { name: true } },
      patient:             { select: { age: true, sex: true } },
      generalExam:         { select: { chiefComplaint: true, bp: true, pulse: true, weight: true, temperature: true, hpi: true } },
      diagnoses:           { select: { description: true, icd10Code: true, laterality: true, provisional: true, status: true } },
      medications:         { select: { drugName: true, dosage: true, frequency: true, duration: true, instructions: true } },
      investigationOrders: { select: { testName: true, category: true, status: true } },
    },
  });

  if (!visit) return { error: "Visit not found." };

  const localText = buildLocalSummary(visit as SummaryVisit);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { text: localText, source: "local" };

  const g = visit.generalExam;
  const lines: string[] = [
    "You are a clinical documentation assistant. Write a concise, professional clinical summary of this patient visit in 2–4 sentences. Use clear flowing prose, no bullet points, no markdown, no headings. Be medically precise and clinically relevant.",
    "",
    `Date: ${visit.date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`,
    visit.visitType    ? `Visit Type: ${visit.visitType}`          : "",
    visit.hospital?.name ? `Hospital: ${visit.hospital.name}`     : "",
    visit.doctor?.name   ? `Doctor: Dr. ${visit.doctor.name}`     : "",
    g?.chiefComplaint  ? `Chief Complaint: ${g.chiefComplaint}`   : "",
    g?.bp              ? `Blood Pressure: ${g.bp}`                : "",
    g?.pulse           ? `Pulse: ${g.pulse}`                      : "",
    g?.weight          ? `Weight: ${g.weight}`                    : "",
    g?.temperature     ? `Temperature: ${g.temperature}`          : "",
    g?.hpi             ? `History of present illness: ${g.hpi}`  : "",
  ];

  if (visit.diagnoses.length) {
    lines.push(`Diagnoses: ${visit.diagnoses.map((d) =>
      [d.description, d.laterality && `(${d.laterality})`, d.provisional && "[provisional]", d.icd10Code && `[${d.icd10Code}]`]
        .filter(Boolean).join(" ")
    ).join("; ")}`);
  }
  if (visit.medications.length) {
    lines.push(`Medications: ${visit.medications.map((m) =>
      [m.drugName, m.dosage, m.frequency, m.duration && `for ${m.duration}`, m.instructions].filter(Boolean).join(" ")
    ).join("; ")}`);
  }
  if (visit.investigationOrders.length) {
    lines.push(`Investigations ordered: ${visit.investigationOrders.map((o) => o.testName).join(", ")}`);
  }

  const prompt = lines.filter(Boolean).join("\n");

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });
    const textBlock = response.content.find((b) => b.type === "text") as { type: "text"; text: string } | undefined;
    const text = textBlock?.text?.trim();
    if (!text) return { text: localText, source: "local", notice: "Claude returned an empty response." };
    return { text, source: "claude" };
  } catch (err: any) {
    // Never fail the tab — show the locally built summary and say why.
    return {
      text: localText,
      source: "local",
      notice: `Claude unavailable (${err?.message ?? "unknown error"}), showing an auto-generated summary.`,
    };
  }
}

export async function generateLongitudinalSummary(
  udid: string
): Promise<{ text?: string; source?: "claude" | "local"; notice?: string; error?: string }> {
  const user = await requirePermission("patients.view");

  const patient = await prisma.patient.findFirst({
    where: { udid, doctorId: scopeDoctorId(user) },
    select: { id: true, age: true, sex: true },
  });
  if (!patient) return { error: "Patient not found." };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const visits = await prisma.visit.findMany({
    where: { patientId: patient.id, date: { lt: todayStart } },
    orderBy: { date: "desc" },
    include: {
      hospital:            { select: { name: true } },
      generalExam:         { select: { chiefComplaint: true } },
      diagnoses:           { select: { description: true, status: true, laterality: true } },
      medications:         { select: { drugName: true, dosage: true, frequency: true, duration: true } },
      investigationOrders: { select: { testName: true, status: true } },
    },
  });

  if (visits.length === 0) return { error: "No past visits found." };

  // oldest-first for chronological narrative
  const sorted = [...visits].reverse();

  const fmtDate = (d: Date) =>
    d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  // Deterministic local text
  const localParts = sorted.map((v) => {
    let part = `Visit (${fmtDate(v.date)}${v.visitType ? `, ${v.visitType}` : ""}${v.hospital?.name ? ` at ${v.hospital.name}` : ""})`;
    if (v.generalExam?.chiefComplaint) part += `: ${v.generalExam.chiefComplaint}`;
    if (v.diagnoses.length)
      part += `. Dx: ${v.diagnoses.map((d) => `${d.description}${d.laterality ? ` (${d.laterality})` : ""}${d.status === "RESOLVED" ? " [resolved]" : ""}`).join(", ")}`;
    if (v.medications.length)
      part += `. Rx: ${v.medications.map((m) => [m.drugName, m.dosage, m.frequency].filter(Boolean).join(" ")).join(", ")}`;
    if (v.investigationOrders.length)
      part += `. Inv: ${v.investigationOrders.map((i) => i.testName).join(", ")}`;
    if (v.followUpDate)
      part += `. F/U: ${fmtDate(v.followUpDate)}`;
    return part;
  });
  const localText =
    `Longitudinal summary across ${sorted.length} visit${sorted.length > 1 ? "s" : ""}: ` +
    localParts.join(". ");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { text: localText, source: "local" };

  const visitLines = sorted.map((v, idx) => {
    const lines = [
      `Visit ${idx + 1} — ${fmtDate(v.date)}${v.visitType ? ` (${v.visitType})` : ""}${v.hospital?.name ? ` at ${v.hospital.name}` : ""}:`,
    ];
    if (v.generalExam?.chiefComplaint) lines.push(`  Chief complaint: ${v.generalExam.chiefComplaint}`);
    if (v.diagnoses.length)
      lines.push(`  Diagnoses: ${v.diagnoses.map((d) => `${d.description}${d.laterality ? ` (${d.laterality})` : ""}${d.status === "RESOLVED" ? " [resolved]" : d.status === "CONTROLLED" ? " [controlled]" : ""}`).join("; ")}`);
    if (v.medications.length)
      lines.push(`  Medications: ${v.medications.map((m) => [m.drugName, m.dosage, m.frequency, m.duration && `for ${m.duration}`].filter(Boolean).join(" ")).join("; ")}`);
    if (v.investigationOrders.length)
      lines.push(`  Investigations: ${v.investigationOrders.map((i) => `${i.testName} (${i.status})`).join(", ")}`);
    if (v.followUpDate)
      lines.push(`  Follow-up: ${fmtDate(v.followUpDate)}`);
    return lines.join("\n");
  });

  const patientDesc = [patient.age ? `${patient.age}-year-old` : "", patient.sex ?? ""].filter(Boolean).join(" ");
  const prompt = [
    "You are a clinical documentation assistant. Write a concise longitudinal clinical summary across the following patient visits in 4–6 sentences. Use clear flowing prose, no bullet points, no markdown. Cover only documented facts: complaint progression, diagnosis changes, medication continuity or changes, investigation history, and documented follow-up dates. Do not infer diagnoses, adherence, compliance, causation, or any clinical conclusions beyond what is explicitly recorded. Be medically precise.",
    "",
    ...(patientDesc ? [`Patient: ${patientDesc}`, ""] : []),
    ...visitLines,
  ].join("\n");

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });
    const textBlock = response.content.find((b) => b.type === "text") as { type: "text"; text: string } | undefined;
    const text = textBlock?.text?.trim();
    if (!text) return { text: localText, source: "local", notice: "Claude returned an empty response." };
    return { text, source: "claude" };
  } catch (err: any) {
    return {
      text: localText,
      source: "local",
      notice: `Claude unavailable (${err?.message ?? "unknown error"}), showing an auto-generated summary.`,
    };
  }
}

// ── Universal Search Autocomplete ────────────────────────────────────────────

export type PatientSearchResult = {
  udid: string;
  name: string;
  mobile: string;
  matchType: "name" | "udid" | "mobile" | "complaint" | "diagnosis";
  matchText?: string;
  visitId?: string;
};

export async function searchPatientsAutocomplete(query: string): Promise<PatientSearchResult[]> {
  const user = await requirePermission("patients.view");
  const doctorId = scopeDoctorId(user);
  const q = query.trim();
  if (q.length < 2) return [];

  const mode = "insensitive" as const;
  const patients = await prisma.patient.findMany({
    where: {
      doctorId,
      OR: [
        { name: { contains: q, mode } },
        { udid: { contains: q, mode } },
        { mobile: { contains: q } },
        { complaint: { contains: q, mode } },
        { visits: { some: { generalExam: { chiefComplaint: { contains: q, mode } } } } },
        { visits: { some: { diagnoses: { some: { OR: [
          { description: { contains: q, mode } },
          { icd10Code: { contains: q, mode } },
        ] } } } } },
      ],
    },
    select: {
      udid: true,
      name: true,
      mobile: true,
      complaint: true,
      visits: {
        select: {
          id: true,
          generalExam: { select: { chiefComplaint: true } },
          diagnoses: { select: { description: true, icd10Code: true } },
        },
        orderBy: { date: "desc" },
      },
    },
    take: 8,
    orderBy: { name: "asc" },
  });

  const ql = q.toLowerCase();
  return patients
    .filter((p) => p.udid)
    .map((p) => {
      let matchType: PatientSearchResult["matchType"] = "name";
      let matchText: string | undefined;
      let visitId: string | undefined;

      if (p.name.toLowerCase().includes(ql)) {
        matchType = "name";
      } else if (p.udid!.toLowerCase().includes(ql)) {
        matchType = "udid";
      } else if (p.mobile.includes(q)) {
        matchType = "mobile";
      } else if (p.complaint?.toLowerCase().includes(ql)) {
        matchType = "complaint";
        matchText = p.complaint ?? undefined;
      } else {
        outer: for (const v of p.visits) {
          if (v.generalExam?.chiefComplaint?.toLowerCase().includes(ql)) {
            matchType = "complaint";
            matchText = v.generalExam.chiefComplaint ?? undefined;
            visitId = v.id;
            break;
          }
          for (const d of v.diagnoses) {
            if (d.description.toLowerCase().includes(ql) || d.icd10Code.toLowerCase().includes(ql)) {
              matchType = "diagnosis";
              matchText = `${d.icd10Code} ${d.description}`;
              visitId = v.id;
              break outer;
            }
          }
        }
      }

      return { udid: p.udid!, name: p.name, mobile: p.mobile, matchType, matchText, visitId };
    });
}
