"use server";

import { prisma } from "@/lib/prisma";
import { requireRole, requirePermission } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/lib/notify";
import { writeAudit } from "@/lib/audit";

export type SurgeryScheduleInput = {
  patientId:              string;
  hospitalId:             string;
  operatingSurgeonId:     string;
  department?:            string;
  surgeryName:            string;
  diagnosis?:             string;
  procedure?:             string;
  surgeryCategory:        string;
  urgencyType:            string;
  priority:               string;
  plannedDateTime:        string;   // ISO string
  otRoom?:                string;
  estimatedDuration?:     number;   // minutes
  anesthetistName?:       string;
  nursingStaff?:          string;
  admissionDate?:         string;   // ISO date
  paymentStatus?:         string;
  consentReceived:        boolean;
  reportsUploaded:        boolean;
  otAvailable:            boolean;
  bloodArranged:          boolean;
  patientInformed:        boolean;
  status:                 string;
  remarks?:               string;
};

export async function saveSurgerySchedule(
  input: SurgeryScheduleInput
): Promise<{ error?: string; id?: string }> {
  const user = await requireRole("HOSPITAL");

  if (!input.surgeryName.trim())  return { error: "Surgery name is required." };
  if (!input.plannedDateTime)     return { error: "Planned date & time is required." };
  if (!input.surgeryCategory)     return { error: "Surgery category is required." };
  if (!input.urgencyType)         return { error: "Elective/Emergency is required." };
  if (!input.priority)            return { error: "Priority is required." };

  const record = await prisma.surgerySchedule.create({
    data: {
      patientId:             input.patientId,
      hospitalId:            input.hospitalId,
      operatingSurgeonId:    input.operatingSurgeonId,
      department:            input.department?.trim() || null,
      surgeryName:           input.surgeryName.trim(),
      diagnosis:             input.diagnosis?.trim() || null,
      procedure:             input.procedure?.trim() || null,
      surgeryCategory:       input.surgeryCategory,
      urgencyType:           input.urgencyType,
      priority:              input.priority,
      plannedDateTime:       new Date(input.plannedDateTime),
      otRoom:                input.otRoom?.trim() || null,
      estimatedDuration:     input.estimatedDuration ?? null,
      anesthetistName:       input.anesthetistName?.trim() || null,
      nursingStaff:          input.nursingStaff?.trim() || null,
      admissionDate:         input.admissionDate ? new Date(input.admissionDate) : null,
      paymentStatus:         input.paymentStatus || null,
      consentReceived:       input.consentReceived,
      reportsUploaded:       input.reportsUploaded,
      otAvailable:           input.otAvailable,
      bloodArranged:         input.bloodArranged,
      patientInformed:       input.patientInformed,
      status:                input.status,
      remarks:               input.remarks?.trim() || null,
      createdBy:             user.id,
    },
  });

  await writeAudit(user.id, "SurgerySchedule", record.id, "CREATE", {
    patientId:   input.patientId,
    surgeryName: input.surgeryName,
    status:      input.status,
  });

  // Notify the operating surgeon
  try {
    const [doctor, patient] = await Promise.all([
      prisma.doctor.findUnique({
        where:  { id: input.operatingSurgeonId },
        select: { userId: true, name: true },
      }),
      prisma.patient.findUnique({
        where:  { id: input.patientId },
        select: { name: true },
      }),
    ]);
    if (doctor?.userId && patient) {
      const dt = new Date(input.plannedDateTime).toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
      });
      await createNotification(
        doctor.userId,
        "SURGERY_SCHEDULED",
        `Surgery scheduled: ${input.surgeryName} for ${patient.name} on ${dt}${input.otRoom ? ` — ${input.otRoom}` : ""}.`,
        record.id
      );
    }
  } catch {
    // notification failure must never break the save
  }

  revalidatePath("/scheduled-ot");
  return { id: record.id };
}

/* ── Doctor: approve surgery ───────────────────────────────────────────── */
export async function approveSurgery(id: string): Promise<{ error?: string }> {
  const user = await requireRole("DOCTOR");

  const rec = await prisma.surgerySchedule.findUnique({
    where:  { id },
    include: { patient: true, hospital: true },
  });
  if (!rec) return { error: "Record not found." };

  await prisma.surgerySchedule.update({
    where: { id },
    data:  { status: "SURGERY_CONFIRMED" },
  });

  await writeAudit(user.id, "SurgerySchedule", id, "UPDATE", { status: "SURGERY_CONFIRMED" });

  // Notify hospital admin users
  try {
    const staff = await prisma.hospitalStaff.findMany({
      where: { hospitalId: rec.hospitalId },
      select: { userId: true },
    });
    const dt = rec.plannedDateTime.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    await Promise.all(staff.map((s) =>
      createNotification(s.userId, "SURGERY_SCHEDULED", `Surgery confirmed: ${rec.surgeryName} for ${rec.patient.name} on ${dt}.`, id)
    ));
  } catch { /* notification failure must not break the action */ }

  revalidatePath("/scheduled-ot");
  return {};
}

/* ── Doctor: request changes ───────────────────────────────────────────── */
export async function requestSurgeryChanges(id: string, notes: string): Promise<{ error?: string }> {
  const user = await requireRole("DOCTOR");

  const rec = await prisma.surgerySchedule.findUnique({
    where:  { id },
    include: { patient: true },
  });
  if (!rec) return { error: "Record not found." };

  await prisma.surgerySchedule.update({
    where: { id },
    data:  { status: "CHANGES_REQUESTED", remarks: notes.trim() || null },
  });

  await writeAudit(user.id, "SurgerySchedule", id, "UPDATE", { status: "CHANGES_REQUESTED", notes });

  // Notify hospital admin users
  try {
    const staff = await prisma.hospitalStaff.findMany({
      where: { hospitalId: rec.hospitalId },
      select: { userId: true },
    });
    await Promise.all(staff.map((s) =>
      createNotification(s.userId, "SURGERY_SCHEDULED", `Changes requested for ${rec.surgeryName} (${rec.patient.name})${notes ? ": " + notes : ""}.`, id)
    ));
  } catch { /* ignore */ }

  revalidatePath("/scheduled-ot");
  return {};
}

/* ── Hospital: update planned date (in response to doctor change request) */
export async function updateSurgeryDate(
  id: string,
  plannedDateTime: string,
  remarks?: string,
): Promise<{ error?: string }> {
  const user = await requirePermission("appointments.view");

  const rec = await prisma.surgerySchedule.findUnique({
    where:  { id },
    include: { patient: true, hospital: { select: { id: true } } },
  });
  if (!rec) return { error: "Record not found." };

  const isDoctor = user.role === "DOCTOR";

  // Doctor updating date → status becomes SURGERY_CONFIRMED (doctor has approved the new date)
  // Hospital updating date → status becomes WAITING_DOCTOR_CONFIRMATION (needs doctor to re-confirm)
  const newStatus = isDoctor ? "SURGERY_CONFIRMED" : "WAITING_DOCTOR_CONFIRMATION";

  await prisma.surgerySchedule.update({
    where: { id },
    data: {
      plannedDateTime: new Date(plannedDateTime),
      status:          newStatus,
      remarks:         remarks?.trim() || null,
    },
  });

  await writeAudit(user.id, "SurgerySchedule", id, "UPDATE", { plannedDateTime, status: newStatus });

  const dt = new Date(plannedDateTime).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });

  try {
    if (isDoctor) {
      // Notify hospital admin staff
      const staff = await prisma.hospitalStaff.findMany({
        where:  { hospitalId: rec.hospital.id },
        select: { userId: true },
      });
      await Promise.all(staff.map((s) =>
        createNotification(
          s.userId,
          "SURGERY_SCHEDULED",
          `Surgery rescheduled by doctor: ${rec.surgeryName} for ${rec.patient.name} — new date ${dt}.`,
          id,
        )
      ));
    } else {
      // Notify the surgeon
      const doctor = await prisma.doctor.findUnique({
        where:  { id: rec.operatingSurgeonId },
        select: { userId: true },
      });
      if (doctor?.userId) {
        await createNotification(
          doctor.userId,
          "SURGERY_SCHEDULED",
          `Surgery rescheduled: ${rec.surgeryName} for ${rec.patient.name} — new date ${dt}. Please review and confirm.`,
          id,
        );
      }
    }
  } catch { /* ignore */ }

  revalidatePath("/scheduled-ot");
  return {};
}

/* ── Cancel surgery (DOCTOR or HOSPITAL) ──────────────────────────────── */
export async function cancelScheduledSurgery(id: string, reason?: string): Promise<{ error?: string }> {
  const user = await requirePermission("appointments.view");

  const rec = await prisma.surgerySchedule.findUnique({ where: { id }, select: { hospitalId: true, surgeryName: true } });
  if (!rec) return { error: "Record not found." };

  await prisma.surgerySchedule.update({
    where: { id },
    data:  { status: "CANCELLED", remarks: reason?.trim() || null },
  });

  await writeAudit(user.id, "SurgerySchedule", id, "UPDATE", { status: "CANCELLED", reason });

  revalidatePath("/scheduled-ot");
  return {};
}
