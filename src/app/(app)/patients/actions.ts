"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeAudit } from "@/lib/audit";

// ── Patient History Timeline ─────────────────────────────────────────────────

export type TimelineEventType =
  | "CONSULTATION"
  | "INVESTIGATION"
  | "SURGERY"
  | "ADMISSION"
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
    // INVESTIGATION
    orders?: { id: string; testName: string; category: string; status: string; laterality?: string | null; priority: string; resultRef?: string | null }[];
    // SURGERY
    surgeryType?: string;
    surgeryDate?: string;
    rightEye?: boolean;
    leftEye?: boolean;
    anaesthesiaType?: string;
    // ADMISSION
    admissionReason?: string;
    ward?: string;
    numberOfDays?: number;
    discharged?: boolean;
    dischargedAt?: string | null;
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
        investigationOrders:{ select: { id: true, testName: true, category: true, status: true, laterality: true, priority: true, resultRef: true, createdAt: true } },
        surgicalCounselling:{ select: { surgeryType: true, surgeryDate: true, rightEye: true, leftEye: true, anaesthesiaType: true } },
        admission:          { select: { reason: true, ward: true, numberOfDays: true, discharged: true, dischargedAt: true } },
        dispense:           { select: { shortSummary: true } },
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
      title:       complaint ? complaint.slice(0, 80) : (v.visitType ?? "Consultation"),
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
        detail: { orders: v.investigationOrders.map((o) => ({ ...o, createdAt: undefined })) },
      });
    }

    // Surgery counselling
    if (v.surgicalCounselling) {
      const sc = v.surgicalCounselling;
      events.push({
        id:          `surg-${v.id}`,
        type:        "SURGERY",
        date:        sc.surgeryDate.toISOString(),
        title:       `Surgery: ${sc.surgeryType}`,
        hospitalName: hospital,
        doctorName:   doctor,
        searchText:  [sc.surgeryType, hospital, doctor].filter(Boolean).join(" ").toLowerCase(),
        detail: {
          surgeryType:     sc.surgeryType,
          surgeryDate:     sc.surgeryDate.toISOString(),
          rightEye:        sc.rightEye,
          leftEye:         sc.leftEye,
          anaesthesiaType: sc.anaesthesiaType,
        },
      });
    }

    // IPD Admission
    if (v.admission) {
      const a = v.admission;
      events.push({
        id:          `adm-${v.id}`,
        type:        "ADMISSION",
        date:        v.date.toISOString(),
        title:       `IPD Admission · ${a.ward}`,
        hospitalName: hospital,
        doctorName:   doctor,
        searchText:  [a.reason, a.ward, hospital, doctor].filter(Boolean).join(" ").toLowerCase(),
        detail: {
          admissionReason: a.reason,
          ward:            a.ward,
          numberOfDays:    a.numberOfDays,
          discharged:      a.discharged,
          dischargedAt:    a.dischargedAt?.toISOString() ?? null,
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

export async function deletePatient(patientId: string) {
  const user = await requireRole("DOCTOR", "HOSPITAL");
  const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { name: true, udid: true } });
  await prisma.patient.delete({ where: { id: patientId } });
  writeAudit(user.id, "Patient", patientId, "DELETE", { name: patient?.name, udid: patient?.udid }, {
    moduleName: "Patient", actionType: "DELETE", userName: patient?.name,
  });
  revalidatePath("/patients");
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
