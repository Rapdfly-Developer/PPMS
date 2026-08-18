"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";

// ── Consent ───────────────────────────────────────────────────────────────────

export type ConsentInput = {
  surgeryScheduleId: string;
  patientName: string;
  attendantName?: string;
  relationship?: string;
  surgeryExplained: boolean;
  risksExplained: boolean;
  alternativesExplained: boolean;
  questionsAnswered: boolean;
  consentGiven: boolean;
  notes?: string;
};

export async function saveConsent(input: ConsentInput): Promise<{ error?: string }> {
  const user = await requireRole("DOCTOR");

  const schedule = await prisma.surgerySchedule.findUnique({
    where: { id: input.surgeryScheduleId },
    include: { surgeryConsent: true },
  });
  if (!schedule) return { error: "Surgery schedule not found." };
  if (schedule.operatingSurgeonId !== user.profileId) return { error: "Forbidden." };

  const data = {
    patientName: input.patientName,
    attendantName: input.attendantName ?? null,
    relationship: input.relationship ?? null,
    surgeryExplained: input.surgeryExplained,
    risksExplained: input.risksExplained,
    alternativesExplained: input.alternativesExplained,
    questionsAnswered: input.questionsAnswered,
    consentGiven: input.consentGiven,
    notes: input.notes ?? null,
    consentDate: new Date(),
  };

  if (schedule.surgeryConsent) {
    await prisma.surgeryConsent.update({ where: { surgeryScheduleId: input.surgeryScheduleId }, data });
  } else {
    await prisma.surgeryConsent.create({ data: { surgeryScheduleId: input.surgeryScheduleId, ...data } });
  }

  // Sync the boolean flag on SurgerySchedule
  await prisma.surgerySchedule.update({
    where: { id: input.surgeryScheduleId },
    data: { consentReceived: input.consentGiven },
  });

  await writeAudit(user.id, "SurgeryConsent", input.surgeryScheduleId, "SAVE");
  revalidatePath(`/scheduled-ot/${input.surgeryScheduleId}/consent`);
  revalidatePath("/scheduled-ot");
  return {};
}

// ── Pre-Op Assessment ─────────────────────────────────────────────────────────

export type PreOpInput = {
  surgeryScheduleId: string;
  hasDiabetes: boolean;
  hasHypertension: boolean;
  hasCardiacDisease: boolean;
  hasAsthma: boolean;
  hasKidneyDisease: boolean;
  otherConditions?: string;
  currentMedications?: string;
  allergies?: string;
  nkda: boolean;
  bloodSugarLevel?: string;
  bpReading?: string;
  ecgNormal?: boolean;
  investigationNotes?: string;
  asaGrade?: string;
  anesthesiaFitness: string;
  fitnessNotes?: string;
  assessedBy?: string;
};

export async function savePreOpAssessment(input: PreOpInput): Promise<{ error?: string }> {
  const user = await requireRole("DOCTOR");

  const schedule = await prisma.surgerySchedule.findUnique({
    where: { id: input.surgeryScheduleId },
    include: { preOpAssessment: true },
  });
  if (!schedule) return { error: "Surgery schedule not found." };
  if (schedule.operatingSurgeonId !== user.profileId) return { error: "Forbidden." };

  const data = {
    hasDiabetes: input.hasDiabetes,
    hasHypertension: input.hasHypertension,
    hasCardiacDisease: input.hasCardiacDisease,
    hasAsthma: input.hasAsthma,
    hasKidneyDisease: input.hasKidneyDisease,
    otherConditions: input.otherConditions ?? null,
    currentMedications: input.currentMedications ?? null,
    allergies: input.allergies ?? null,
    nkda: input.nkda,
    bloodSugarLevel: input.bloodSugarLevel ?? null,
    bpReading: input.bpReading ?? null,
    ecgNormal: input.ecgNormal ?? null,
    investigationNotes: input.investigationNotes ?? null,
    asaGrade: input.asaGrade ?? null,
    anesthesiaFitness: input.anesthesiaFitness,
    fitnessNotes: input.fitnessNotes ?? null,
    assessedBy: input.assessedBy ?? null,
    assessedAt: new Date(),
  };

  if (schedule.preOpAssessment) {
    await prisma.preOpAssessment.update({ where: { surgeryScheduleId: input.surgeryScheduleId }, data });
  } else {
    await prisma.preOpAssessment.create({ data: { surgeryScheduleId: input.surgeryScheduleId, ...data } });
  }

  await writeAudit(user.id, "PreOpAssessment", input.surgeryScheduleId, "SAVE");
  revalidatePath(`/scheduled-ot/${input.surgeryScheduleId}/pre-op-assessment`);
  revalidatePath("/scheduled-ot");
  return {};
}

// ── Post-Op Review ────────────────────────────────────────────────────────────

export type PostOpInput = {
  surgeryScheduleId: string;
  reVaUnaided?: string;
  leVaUnaided?: string;
  reBcva?: string;
  leBcva?: string;
  iopRe?: string;
  iopLe?: string;
  woundStatus?: string;
  iolPosition?: string;
  anteriorChamber?: string;
  fundusNotes?: string;
  complications?: string;
  postOpMedications?: string;
  instructions?: string;
  followUpDate?: string;
  reviewNotes?: string;
};

export async function savePostOpReview(input: PostOpInput): Promise<{ error?: string }> {
  const user = await requireRole("DOCTOR");

  const schedule = await prisma.surgerySchedule.findUnique({
    where: { id: input.surgeryScheduleId },
    include: { postOpReview: true },
  });
  if (!schedule) return { error: "Surgery schedule not found." };
  if (schedule.operatingSurgeonId !== user.profileId) return { error: "Forbidden." };

  const data = {
    doctorId: user.profileId,
    reVaUnaided: input.reVaUnaided ?? null,
    leVaUnaided: input.leVaUnaided ?? null,
    reBcva: input.reBcva ?? null,
    leBcva: input.leBcva ?? null,
    iopRe: input.iopRe ?? null,
    iopLe: input.iopLe ?? null,
    woundStatus: input.woundStatus ?? null,
    iolPosition: input.iolPosition ?? null,
    anteriorChamber: input.anteriorChamber ?? null,
    fundusNotes: input.fundusNotes ?? null,
    complications: input.complications ?? null,
    postOpMedications: input.postOpMedications ?? null,
    instructions: input.instructions ?? null,
    followUpDate: input.followUpDate ? new Date(input.followUpDate) : null,
    reviewNotes: input.reviewNotes ?? null,
    reviewedAt: new Date(),
  };

  if (schedule.postOpReview) {
    await prisma.postOpReview.update({ where: { surgeryScheduleId: input.surgeryScheduleId }, data });
  } else {
    await prisma.postOpReview.create({ data: { surgeryScheduleId: input.surgeryScheduleId, ...data } });
  }

  await writeAudit(user.id, "PostOpReview", input.surgeryScheduleId, "SAVE");
  revalidatePath(`/scheduled-ot/${input.surgeryScheduleId}/post-op-review`);
  revalidatePath("/scheduled-ot");
  return {};
}
