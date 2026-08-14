"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/lib/notify";
import { writeAudit } from "@/lib/audit";

export type SurgicalCounsellingInput = {
  // Step 1 – Payment
  paymentMode: string;
  paymentNotes: string;
  // Step 2 – Surgery type
  surgeryName: string;
  surgeryType: string;
  surgeryCategory: string;
  urgencyType: string;
  priority: string;
  // Step 3 – Procedure & Laterality
  rightEye: boolean;
  leftEye: boolean;
  procedure: string;
  diagnosis: string;
  // Step 4 – Anesthesia
  anaesthesiaType: string;
  anesthetistName: string;
  // Step 5 – Fit for Surgery
  counselingDone: boolean;
  investigationDone: boolean;
  consentReceived: boolean;
  reportsUploaded: boolean;
  bloodArranged: boolean;
  counsellingNotes: string;
  // Step 6 – Advance Payment
  advanceAmount: number | null;
  advanceReceipt: string;
  advanceMode: string;
  // Step 7 – Surgery Date & Time
  surgeryDate: string;
  surgeryTime: string;
  otRoom: string;
  estimatedDuration: number | null;
};

export async function completeSurgicalCounselling(
  counsellingId: string,
  udid: string,
  data: SurgicalCounsellingInput,
): Promise<{ error?: string; scheduled?: boolean }> {
  const user = await requireRole("HOSPITAL");

  const counselling = await prisma.surgicalCounselling.findUnique({
    where: { id: counsellingId },
    include: {
      visit: {
        select: { doctorId: true, hospitalId: true, patientId: true },
      },
    },
  });
  if (!counselling) return { error: "Counselling record not found." };

  const fitForSurgery = data.counselingDone && data.investigationDone && data.consentReceived;

  // Combine date + time into a single DateTime
  const plannedDateTime = new Date(`${data.surgeryDate}T${data.surgeryTime || "09:00"}`);

  // Serialize payment notes as JSON for conditional fields
  const paymentNotes = data.paymentNotes?.trim() || null;
  const advanceNotes = data.advanceMode ? `${data.advanceMode}${data.advanceReceipt ? " · " + data.advanceReceipt : ""}` : data.advanceReceipt || null;

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
      paymentNotes:      paymentNotes,
      counselingDone:    data.counselingDone,
      investigationDone: data.investigationDone,
      fitForSurgery:     fitForSurgery,
      advanceAmount:     data.advanceAmount ?? null,
      advanceReceipt:    advanceNotes,
      counsellingNotes:  data.counsellingNotes.trim() || null,
    },
  });

  await writeAudit(user.id, "SurgicalCounselling", counsellingId, "COMPLETE_COUNSELLING", {
    fitForSurgery, paymentMode: data.paymentMode,
  });

  // Upsert SurgerySchedule
  const existing = await prisma.surgerySchedule.findFirst({
    where: { surgicalCounsellingId: counsellingId },
  });

  let scheduleId: string;

  if (existing) {
    await prisma.surgerySchedule.update({
      where: { id: existing.id },
      data: {
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
        status:            "PLANNED",
      },
    });
    scheduleId = existing.id;
  } else {
    const schedule = await prisma.surgerySchedule.create({
      data: {
        surgicalCounsellingId: counsellingId,
        patientId:             counselling.visit.patientId,
        hospitalId:            counselling.visit.hospitalId,
        operatingSurgeonId:    counselling.visit.doctorId,
        surgeryName:           data.surgeryName.trim() || (counselling.surgeryName ?? counselling.surgeryType),
        surgeryCategory:       data.surgeryCategory || "MAJOR",
        urgencyType:           data.urgencyType || "ELECTIVE",
        priority:              data.priority || "ROUTINE",
        plannedDateTime,
        otRoom:                data.otRoom.trim() || null,
        estimatedDuration:     data.estimatedDuration ?? null,
        anesthetistName:       data.anesthetistName.trim() || null,
        procedure:             data.procedure.trim() || null,
        diagnosis:             data.diagnosis.trim() || null,
        consentReceived:       data.consentReceived,
        reportsUploaded:       data.reportsUploaded,
        bloodArranged:         data.bloodArranged,
        patientInformed:       data.counselingDone,
        paymentStatus:         data.paymentMode || null,
        status:                "PLANNED",
        createdBy:             user.id,
      },
    });
    scheduleId = schedule.id;
  }

  await writeAudit(user.id, "SurgerySchedule", scheduleId, existing ? "UPDATE" : "CREATE", {
    counsellingId, fitForSurgery,
  });

  // Notify doctor when patient is fit for surgery
  if (fitForSurgery) {
    try {
      const [patient, doctor] = await Promise.all([
        prisma.patient.findUnique({
          where: { id: counselling.visit.patientId },
          select: { name: true },
        }),
        prisma.doctor.findUnique({
          where: { id: counselling.visit.doctorId },
          select: { userId: true },
        }),
      ]);
      if (doctor?.userId && patient) {
        const dt = plannedDateTime.toLocaleDateString("en-IN", {
          day: "2-digit", month: "short", year: "numeric",
        });
        await createNotification(
          doctor.userId,
          "SURGERY_SCHEDULED",
          `${patient.name} is fit for surgery. Operation scheduled for ${dt}. Please review and confirm.`,
          scheduleId,
        );
      }
    } catch { /* ignore notification errors */ }
  }

  revalidatePath(`/patients/${udid}`);
  revalidatePath("/scheduled-ot");
  return { scheduled: fitForSurgery };
}
