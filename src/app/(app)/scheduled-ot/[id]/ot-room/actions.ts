"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";

async function logTimeline(
  otRecordId: string,
  step: string,
  action: string,
  performedBy: string,
) {
  await prisma.otTimeline.create({
    data: { otRecordId, step, action, performedBy },
  });
}

/* ── Ensure an OtRecord exists (idempotent) ─────────────────────────────── */
export async function initOtRecord(
  scheduleId: string,
): Promise<{ id: string; error?: string }> {
  const user = await requireRole("DOCTOR");

  const schedule = await prisma.surgerySchedule.findUnique({
    where: { id: scheduleId },
    include: { patient: true },
  });
  if (!schedule) return { id: "", error: "Surgery schedule not found." };

  const existing = await prisma.otRecord.findUnique({
    where: { surgeryScheduleId: scheduleId },
  });
  if (existing) return { id: existing.id };

  const rec = await prisma.otRecord.create({
    data: {
      surgeryScheduleId: scheduleId,
      status: "CHECKIN",
    },
  });

  await logTimeline(rec.id, "CHECKIN", "OT Record created — patient check-in started.", user.name ?? user.id);
  await writeAudit(user.id, "OtRecord", rec.id, "CREATE", { scheduleId });

  revalidatePath(`/scheduled-ot/${scheduleId}/ot-room`);
  return { id: rec.id };
}

/* ── Step 1: Save check-in verifications ─────────────────────────────────── */
export async function saveCheckIn(
  otRecordId: string,
  data: {
    identityVerified: boolean;
    correctEyeVerified: boolean;
    surgeryTypeVerified: boolean;
    consentFormsVerified: boolean;
    implantAvailabilityVerified: boolean;
  },
): Promise<{ error?: string }> {
  const user = await requireRole("DOCTOR");

  const now = new Date();
  await prisma.otRecord.update({
    where: { id: otRecordId },
    data: {
      ...data,
      checkInTime: now,
      status: "PREP",
    },
  });

  await logTimeline(otRecordId, "CHECKIN", "Patient check-in verified.", user.name ?? user.id);
  revalidatePath(`/scheduled-ot`);
  return {};
}

/* ── Step 2: Save OT preparation ─────────────────────────────────────────── */
export async function saveOtPrep(
  otRecordId: string,
  data: {
    assistantSurgeon: string;
    anesthetist: string;
    scrubNurse: string;
    circulatingNurse: string;
    anesthesiaTypeRecorded: string;
    whoSignIn: string; // JSON
  },
): Promise<{ error?: string }> {
  const user = await requireRole("DOCTOR");

  await prisma.otRecord.update({
    where: { id: otRecordId },
    data: { ...data },
  });

  await logTimeline(otRecordId, "PREP", "OT preparation and WHO Sign-In checklist completed.", user.name ?? user.id);
  return {};
}

/* ── Step 3: Start surgery ───────────────────────────────────────────────── */
export async function startSurgery(
  otRecordId: string,
  scheduleId: string,
): Promise<{ error?: string }> {
  const user = await requireRole("DOCTOR");

  const now = new Date();
  await prisma.otRecord.update({
    where: { id: otRecordId },
    data: { surgeryStartTime: now, status: "IN_PROGRESS" },
  });

  await prisma.surgerySchedule.update({
    where: { id: scheduleId },
    data: { status: "OT_IN_PROGRESS" },
  });

  await logTimeline(otRecordId, "SURGERY_START", `Surgery started at ${now.toLocaleTimeString("en-IN")}.`, user.name ?? user.id);
  revalidatePath("/scheduled-ot");
  return {};
}

/* ── Step 4: Save intra-operative data ──────────────────────────────────── */
export async function saveIntraOp(
  otRecordId: string,
  data: {
    procedurePerformed: string;
    iolModel: string;
    iolPower: string;
    iolBatch: string;
    iolSerial: string;
    medicinesConsumed: string;
    intraopFindings: string;
    complications: string;
    intraopRemarks: string;
  },
): Promise<{ error?: string }> {
  const user = await requireRole("DOCTOR");

  await prisma.otRecord.update({
    where: { id: otRecordId },
    data: { ...data },
  });

  await logTimeline(otRecordId, "INTRAOP", "Intra-operative data saved.", user.name ?? user.id);
  return {};
}

/* ── Step 5: Complete surgery ────────────────────────────────────────────── */
export async function completeSurgery(
  otRecordId: string,
  scheduleId: string,
  operativeNotes: string,
): Promise<{ error?: string }> {
  const user = await requireRole("DOCTOR");

  const now = new Date();
  await prisma.otRecord.update({
    where: { id: otRecordId },
    data: { surgeryEndTime: now, operativeNotes: operativeNotes.trim() || null, status: "COMPLETED" },
  });

  await prisma.surgerySchedule.update({
    where: { id: scheduleId },
    data: { status: "OT_COMPLETED" },
  });

  await logTimeline(otRecordId, "COMPLETED", `Surgery completed at ${now.toLocaleTimeString("en-IN")}.`, user.name ?? user.id);
  await writeAudit(user.id, "OtRecord", otRecordId, "UPDATE", { status: "COMPLETED" });
  revalidatePath("/scheduled-ot");
  return {};
}

/* ── Step 6: Transfer to recovery ───────────────────────────────────────── */
export async function transferToRecovery(
  otRecordId: string,
  patientConditionOnTransfer: string,
): Promise<{ error?: string }> {
  const user = await requireRole("DOCTOR");

  const now = new Date();
  await prisma.otRecord.update({
    where: { id: otRecordId },
    data: {
      patientConditionOnTransfer: patientConditionOnTransfer.trim() || null,
      transferTime: now,
      status: "RECOVERY",
    },
  });

  await logTimeline(otRecordId, "RECOVERY", `Patient transferred to recovery at ${now.toLocaleTimeString("en-IN")}.`, user.name ?? user.id);
  revalidatePath("/scheduled-ot");
  return {};
}
