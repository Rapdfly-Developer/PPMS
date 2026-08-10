"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/lib/notify";
import { writeAudit } from "@/lib/audit";

export type CounsellingFormData = {
  insuranceType: string;
  counselingDone: boolean;
  investigationDone: boolean;
  fitForSurgery: boolean;
};

export async function saveCounsellingAndSchedule(
  counsellingId: string,
  udid: string,
  data: CounsellingFormData
): Promise<{ error?: string; scheduled?: boolean }> {
  const user = await requireRole("HOSPITAL");

  const counselling = await prisma.surgicalCounselling.findUnique({
    where: { id: counsellingId },
    include: {
      visit: {
        select: {
          doctorId: true,
          hospitalId: true,
          patientId: true,
        },
      },
    },
  });
  if (!counselling) return { error: "Counselling record not found." };

  // Update counselling with new fields
  await prisma.surgicalCounselling.update({
    where: { id: counsellingId },
    data: {
      insuranceType: data.insuranceType.trim() || null,
      counselingDone: data.counselingDone,
      investigationDone: data.investigationDone,
      fitForSurgery: data.fitForSurgery,
    },
  });

  await writeAudit(user.id, "SurgicalCounselling", counsellingId, "UPDATE_DETAILS", data);

  let scheduled = false;

  if (data.fitForSurgery && counselling.visit.hospitalId) {
    // Avoid duplicate schedules
    const existing = await prisma.surgerySchedule.findFirst({
      where: { surgicalCounsellingId: counsellingId },
    });

    if (!existing) {
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

      const schedule = await prisma.surgerySchedule.create({
        data: {
          surgicalCounsellingId: counsellingId,
          patientId:             counselling.visit.patientId,
          hospitalId:            counselling.visit.hospitalId,
          operatingSurgeonId:    counselling.visit.doctorId,
          surgeryName:           counselling.surgeryName ?? counselling.surgeryType,
          surgeryCategory:       "MAJOR",
          urgencyType:           "ELECTIVE",
          priority:              "ROUTINE",
          plannedDateTime:       counselling.surgeryDate,
          consentReceived:       false,
          reportsUploaded:       data.investigationDone,
          otAvailable:           false,
          bloodArranged:         false,
          patientInformed:       data.counselingDone,
          status:                "PLANNED",
          createdBy:             user.id,
        },
      });

      await writeAudit(user.id, "SurgerySchedule", schedule.id, "CREATE_FROM_COUNSELLING", {
        counsellingId,
        patientId: counselling.visit.patientId,
      });

      // Notify the doctor
      if (doctor?.userId && patient) {
        const dt = counselling.surgeryDate.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
        await createNotification(
          doctor.userId,
          "SURGERY_SCHEDULED",
          `Operation has been scheduled for ${patient.name} on ${dt}. Please review and confirm.`,
          schedule.id
        );
      }

      scheduled = true;
    }
  }

  revalidatePath(`/patients/${udid}`);
  revalidatePath("/scheduled-ot");
  return { scheduled };
}
