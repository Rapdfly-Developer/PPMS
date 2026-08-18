"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";

export async function dischargePatient(admissionId: string): Promise<{ error?: string }> {
  const user = await requireRole("DOCTOR");

  const admission = await prisma.admission.findUnique({
    where: { id: admissionId },
    include: { visit: { select: { doctorId: true } } },
  });
  if (!admission) return { error: "Admission not found." };
  if (admission.visit.doctorId !== user.profileId) return { error: "Forbidden." };
  if (admission.discharged) return { error: "Patient is already discharged." };

  await prisma.admission.update({
    where: { id: admissionId },
    data: { discharged: true, dischargedAt: new Date() },
  });
  await writeAudit(user.id, "Admission", admissionId, "DISCHARGE");

  revalidatePath("/ipd");
  revalidatePath("/dashboard");
  return {};
}

export type DischargeSummaryInput = {
  admissionId: string;
  // Surgery recap
  surgeryPerformed?: string;
  operatingEye?: string;
  anesthesiaUsed?: string;
  iolDetails?: string;
  // Clinical
  postOpDiagnosis?: string;
  intraopComplications?: string;
  postOpCourse?: string;
  conditionAtDischarge: string;
  // Instructions
  dischargeMedications?: string; // JSON string
  dischargeInstructions?: string;
  activityRestrictions?: string;
  dietAdvice?: string;
  woundCareInstructions?: string;
  // Follow-up
  followUpDate?: string;
  followUpInstructions?: string;
};

export async function saveDischargeSummary(
  input: DischargeSummaryInput
): Promise<{ error?: string; id?: string }> {
  const user = await requireRole("DOCTOR");

  const admission = await prisma.admission.findUnique({
    where: { id: input.admissionId },
    include: { visit: { select: { doctorId: true, date: true } }, dischargeSummary: true },
  });
  if (!admission) return { error: "Admission not found." };
  if (admission.visit.doctorId !== user.profileId) return { error: "Forbidden." };

  const data = {
    doctorId: user.profileId,
    surgeryPerformed: input.surgeryPerformed ?? null,
    operatingEye: input.operatingEye ?? null,
    anesthesiaUsed: input.anesthesiaUsed ?? null,
    iolDetails: input.iolDetails ?? null,
    postOpDiagnosis: input.postOpDiagnosis ?? null,
    intraopComplications: input.intraopComplications ?? null,
    postOpCourse: input.postOpCourse ?? null,
    conditionAtDischarge: input.conditionAtDischarge,
    dischargeMedications: input.dischargeMedications ?? null,
    dischargeInstructions: input.dischargeInstructions ?? null,
    activityRestrictions: input.activityRestrictions ?? null,
    dietAdvice: input.dietAdvice ?? null,
    woundCareInstructions: input.woundCareInstructions ?? null,
    followUpDate: input.followUpDate ? new Date(input.followUpDate) : null,
    followUpInstructions: input.followUpInstructions ?? null,
    admissionDate: admission.visit.date,
    dischargeDate: admission.dischargedAt ?? new Date(),
  };

  let summary;
  if (admission.dischargeSummary) {
    summary = await prisma.dischargeSummary.update({
      where: { admissionId: input.admissionId },
      data,
    });
  } else {
    summary = await prisma.dischargeSummary.create({
      data: { admissionId: input.admissionId, ...data },
    });
  }

  await writeAudit(user.id, "DischargeSummary", summary.id, "SAVE");
  revalidatePath("/ipd");
  revalidatePath(`/ipd/${input.admissionId}/discharge-summary`);
  return { id: summary.id };
}

export async function closeSurgeryCase(
  scheduleId: string
): Promise<{ error?: string }> {
  const user = await requireRole("DOCTOR");

  const schedule = await prisma.surgerySchedule.findUnique({
    where: { id: scheduleId },
    include: {
      otRecord: { select: { status: true } },
      patient: { select: { id: true } },
    },
  });
  if (!schedule) return { error: "Surgery schedule not found." };
  if (schedule.operatingSurgeonId !== user.profileId) return { error: "Forbidden." };
  if (schedule.caseStatus === "CLOSED") return { error: "Case is already closed." };

  if (schedule.otRecord?.status !== "RECOVERY" && schedule.status !== "OT_COMPLETED") {
    return { error: "Surgery must be completed before closing the case." };
  }

  await prisma.surgerySchedule.update({
    where: { id: scheduleId },
    data: { caseStatus: "CLOSED", caseClosedAt: new Date() },
  });

  await writeAudit(user.id, "SurgerySchedule", scheduleId, "CASE_CLOSED");
  revalidatePath("/scheduled-ot");
  revalidatePath("/ipd");
  return {};
}
