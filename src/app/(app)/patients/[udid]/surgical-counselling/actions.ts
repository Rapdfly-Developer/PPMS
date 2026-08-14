"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/lib/notify";
import { writeAudit } from "@/lib/audit";

/* ── Types ─────────────────────────────────────────────────────────────── */
export type SurgicalCounsellingInput = {
  paymentMode: string;
  paymentNotes: string;
  surgeryName: string;
  surgeryType: string;
  surgeryCategory: string;
  urgencyType: string;
  priority: string;
  rightEye: boolean;
  leftEye: boolean;
  procedure: string;
  diagnosis: string;
  anaesthesiaType: string;
  anesthetistName: string;
  counselingDone: boolean;
  investigationDone: boolean;
  consentReceived: boolean;
  reportsUploaded: boolean;
  bloodArranged: boolean;
  counsellingNotes: string;
  advanceAmount: number | null;
  advanceReceipt: string;
  advanceMode: string;
  surgeryDate: string;
  surgeryTime: string;
  otRoom: string;
  estimatedDuration: number | null;
};

export type ConfirmFitInput = {
  surgeryName: string;
  surgeryType: string;
  surgeryCategory: string;
  urgencyType: string;
  priority: string;
  rightEye: boolean;
  leftEye: boolean;
  procedure: string;
  diagnosis: string;
  anaesthesiaType: string;
  anesthetistName: string;
  counselingDone: boolean;
  investigationDone: boolean;
  consentReceived: boolean;
  reportsUploaded: boolean;
  bloodArranged: boolean;
  paymentMode: string;
  advanceAmount: number | null;
  advanceReceipt: string;
  surgeryDate: string;
  surgeryTime: string;
  otRoom: string;
  estimatedDuration: number | null;
  doctorNote: string;
};

/* ── Helpers ────────────────────────────────────────────────────────────── */
async function getDoctorUserId(doctorId: string): Promise<string | null> {
  const doc = await prisma.doctor.findUnique({ where: { id: doctorId }, select: { userId: true } });
  return doc?.userId ?? null;
}

async function getHospitalStaffUserIds(hospitalId: string): Promise<string[]> {
  const staff = await prisma.hospitalStaff.findMany({
    where: { hospitalId },
    select: { userId: true },
  });
  return staff.map((s) => s.userId);
}

/* ── Action 1: Hospital submits counselling form ──────────────────────── */
export async function completeSurgicalCounselling(
  counsellingId: string,
  udid: string,
  data: SurgicalCounsellingInput,
): Promise<{ error?: string }> {
  const user = await requireRole("HOSPITAL");

  const counselling = await prisma.surgicalCounselling.findUnique({
    where: { id: counsellingId },
    include: { visit: { select: { doctorId: true, hospitalId: true, patientId: true } } },
  });
  if (!counselling) return { error: "Counselling record not found." };

  const plannedDateTime = new Date(`${data.surgeryDate}T${data.surgeryTime || "09:00"}`);
  const advanceNotes = [data.advanceMode, data.advanceReceipt].filter(Boolean).join(" · ") || null;

  await prisma.surgicalCounselling.update({
    where: { id: counsellingId },
    data: {
      surgeryName:       data.surgeryName.trim() || counselling.surgeryName,
      surgeryType:       data.surgeryType || counselling.surgeryType,
      rightEye:          data.rightEye,
      leftEye:           data.leftEye,
      anaesthesiaType:   data.anaesthesiaType || counselling.anaesthesiaType,
      surgeryDate:       plannedDateTime,
      insuranceType:     data.paymentMode.trim() || null,
      paymentNotes:      data.paymentNotes.trim() || null,
      counselingDone:    data.counselingDone,
      investigationDone: data.investigationDone,
      fitForSurgery:     null, // doctor decides
      advanceAmount:     data.advanceAmount ?? null,
      advanceReceipt:    advanceNotes,
      counsellingNotes:  data.counsellingNotes.trim() || null,
      reviewStatus:      "PENDING_REVIEW",
    },
  });

  // Upsert SurgerySchedule with WAITING_DOCTOR_CONFIRMATION
  const existing = await prisma.surgerySchedule.findFirst({
    where: { surgicalCounsellingId: counsellingId },
  });

  const scheduleData = {
    surgeryName:       data.surgeryName.trim() || (counselling.surgeryName ?? counselling.surgeryType),
    surgeryCategory:   data.surgeryCategory || "MAJOR",
    urgencyType:       data.urgencyType || "ELECTIVE",
    priority:          data.priority || "ROUTINE",
    plannedDateTime,
    otRoom:            data.otRoom.trim() || null,
    estimatedDuration: data.estimatedDuration ?? null,
    anesthetistName:   data.anesthetistName.trim() || null,
    procedure:         data.procedure.trim() || null,
    diagnosis:         data.diagnosis.trim() || null,
    consentReceived:   data.consentReceived,
    reportsUploaded:   data.reportsUploaded,
    bloodArranged:     data.bloodArranged,
    patientInformed:   data.counselingDone,
    paymentStatus:     data.paymentMode || null,
    status:            "WAITING_DOCTOR_CONFIRMATION",
  };

  let scheduleId: string;
  if (existing) {
    await prisma.surgerySchedule.update({ where: { id: existing.id }, data: scheduleData });
    scheduleId = existing.id;
  } else {
    const schedule = await prisma.surgerySchedule.create({
      data: {
        ...scheduleData,
        surgicalCounsellingId: counsellingId,
        patientId:          counselling.visit.patientId,
        hospitalId:         counselling.visit.hospitalId,
        operatingSurgeonId: counselling.visit.doctorId,
        createdBy:          user.id,
      },
    });
    scheduleId = schedule.id;
  }

  await writeAudit(user.id, "SurgicalCounselling", counsellingId, "SUBMIT_FOR_REVIEW", {});

  // Notify doctor to review
  const [patient, doctorUserId] = await Promise.all([
    prisma.patient.findUnique({ where: { id: counselling.visit.patientId }, select: { name: true, udid: true } }),
    getDoctorUserId(counselling.visit.doctorId),
  ]);
  if (doctorUserId && patient) {
    const dt = plannedDateTime.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    await createNotification(
      doctorUserId,
      "SURGICAL_COUNSELLING",
      `Surgical counselling for ${patient.name} is ready for your review. Planned: ${dt}.`,
      counsellingId,
    );
  }

  revalidatePath(`/patients/${udid}`);
  revalidatePath("/scheduled-ot");
  return {};
}

/* ── Action 2: Doctor sets review status (non-confirmed outcomes) ────── */
export async function setDoctorReviewStatus(
  counsellingId: string,
  udid: string,
  status: "FIT_FOR_SURGERY" | "NOT_FIT" | "DEFERRED" | "ADDITIONAL_INVESTIGATIONS",
  note: string,
): Promise<{ error?: string }> {
  const user = await requireRole("DOCTOR");

  const counselling = await prisma.surgicalCounselling.findUnique({
    where: { id: counsellingId },
    include: { visit: { select: { hospitalId: true, patientId: true } } },
  });
  if (!counselling) return { error: "Counselling record not found." };

  await prisma.surgicalCounselling.update({
    where: { id: counsellingId },
    data: {
      reviewStatus:     status,
      doctorReviewNote: note.trim() || null,
      doctorReviewedAt: new Date(),
    },
  });

  // For non-confirmed statuses, update schedule accordingly
  if (status !== "FIT_FOR_SURGERY") {
    const schedule = await prisma.surgerySchedule.findFirst({
      where: { surgicalCounsellingId: counsellingId },
    });
    if (schedule) {
      const scheduleStatus =
        status === "NOT_FIT"                    ? "CANCELLED" :
        status === "DEFERRED"                   ? "RESCHEDULED" :
        /* ADDITIONAL_INVESTIGATIONS */           "CHANGES_REQUESTED";
      await prisma.surgerySchedule.update({
        where: { id: schedule.id },
        data: { status: scheduleStatus, remarks: note.trim() || null },
      });
    }
  }

  await writeAudit(user.id, "SurgicalCounselling", counsellingId, "DOCTOR_REVIEW", { status, note });

  // Notify hospital staff of decision
  if (status !== "FIT_FOR_SURGERY") {
    const patient = await prisma.patient.findUnique({
      where: { id: counselling.visit.patientId },
      select: { name: true },
    });
    const statusLabel: Record<string, string> = {
      NOT_FIT:                  "Not Fit for Surgery",
      DEFERRED:                 "Surgery Deferred",
      ADDITIONAL_INVESTIGATIONS:"Additional Investigations Required",
    };
    const staffIds = await getHospitalStaffUserIds(counselling.visit.hospitalId);
    await Promise.all(
      staffIds.map((uid) =>
        createNotification(
          uid,
          "SURGICAL_COUNSELLING",
          `Doctor reviewed counselling for ${patient?.name ?? "patient"}: ${statusLabel[status]}${note ? ` — ${note}` : ""}.`,
          counsellingId,
        ),
      ),
    );
  }

  revalidatePath(`/patients/${udid}`);
  revalidatePath("/scheduled-ot");
  return {};
}

/* ── Action 3: Doctor confirms all sections → Confirmed Fit for Surgery ─ */
export async function confirmFitForSurgery(
  counsellingId: string,
  udid: string,
  data: ConfirmFitInput,
): Promise<{ error?: string }> {
  const user = await requireRole("DOCTOR");

  const counselling = await prisma.surgicalCounselling.findUnique({
    where: { id: counsellingId },
    include: { visit: { select: { hospitalId: true, patientId: true } } },
  });
  if (!counselling) return { error: "Counselling record not found." };

  const plannedDateTime = new Date(`${data.surgeryDate}T${data.surgeryTime || "09:00"}`);

  // Update counselling — confirmed fit
  await prisma.surgicalCounselling.update({
    where: { id: counsellingId },
    data: {
      surgeryName:       data.surgeryName.trim() || counselling.surgeryName,
      surgeryType:       data.surgeryType || counselling.surgeryType,
      rightEye:          data.rightEye,
      leftEye:           data.leftEye,
      anaesthesiaType:   data.anaesthesiaType,
      surgeryDate:       plannedDateTime,
      insuranceType:     data.paymentMode || counselling.insuranceType,
      advanceAmount:     data.advanceAmount ?? counselling.advanceAmount,
      advanceReceipt:    data.advanceReceipt || counselling.advanceReceipt,
      counselingDone:    data.counselingDone,
      investigationDone: data.investigationDone,
      fitForSurgery:     true,
      reviewStatus:      "CONFIRMED",
      doctorReviewNote:  data.doctorNote.trim() || counselling.doctorReviewNote,
      doctorReviewedAt:  counselling.doctorReviewedAt ?? new Date(),
      confirmedFitAt:    new Date(),
    },
  });

  // Update SurgerySchedule → SURGERY_CONFIRMED
  const schedule = await prisma.surgerySchedule.findFirst({
    where: { surgicalCounsellingId: counsellingId },
  });
  if (schedule) {
    await prisma.surgerySchedule.update({
      where: { id: schedule.id },
      data: {
        surgeryName:       data.surgeryName.trim() || schedule.surgeryName,
        surgeryCategory:   data.surgeryCategory || schedule.surgeryCategory,
        urgencyType:       data.urgencyType || schedule.urgencyType,
        priority:          data.priority || schedule.priority,
        plannedDateTime,
        otRoom:            data.otRoom.trim() || schedule.otRoom,
        estimatedDuration: data.estimatedDuration ?? schedule.estimatedDuration,
        anesthetistName:   data.anesthetistName.trim() || schedule.anesthetistName,
        procedure:         data.procedure.trim() || schedule.procedure,
        diagnosis:         data.diagnosis.trim() || schedule.diagnosis,
        consentReceived:   data.consentReceived,
        reportsUploaded:   data.reportsUploaded,
        bloodArranged:     data.bloodArranged,
        status:            "SURGERY_CONFIRMED",
        remarks:           data.doctorNote.trim() || null,
      },
    });
  }

  await writeAudit(user.id, "SurgicalCounselling", counsellingId, "CONFIRMED_FIT", {});

  // Notify hospital staff — patient is confirmed fit
  const patient = await prisma.patient.findUnique({
    where: { id: counselling.visit.patientId },
    select: { name: true },
  });
  const dt = plannedDateTime.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const staffIds = await getHospitalStaffUserIds(counselling.visit.hospitalId);
  await Promise.all(
    staffIds.map((uid) =>
      createNotification(
        uid,
        "SURGICAL_COUNSELLING",
        `${patient?.name ?? "Patient"} is Confirmed Fit for Surgery on ${dt}. Schedule is now active.`,
        counsellingId,
      ),
    ),
  );

  revalidatePath(`/patients/${udid}`);
  revalidatePath("/scheduled-ot");
  return {};
}
