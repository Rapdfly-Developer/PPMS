"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { redirect } from "next/navigation";

export async function createWalkInEncounter(formData: FormData) {
  const user = await requireRole("DOCTOR");

  const patientId = formData.get("patientId") as string;
  const visitType = formData.get("visitType") as string;
  const hospitalId = formData.get("hospitalId") as string;

  if (!patientId || !visitType || !hospitalId) {
    return { error: "Patient, visit type and hospital are required." };
  }

  // Verify doctor is linked to this hospital
  const link = await prisma.doctorHospitalLink.findFirst({
    where: { doctorId: user.profileId!, hospitalId, active: true },
  });
  if (!link) return { error: "You are not linked to the selected hospital." };

  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) return { error: "Patient not found." };

  // Create a confirmed appointment for right now
  const now = new Date();
  const appointment = await prisma.appointment.create({
    data: {
      patientId,
      doctorId: user.profileId!,
      hospitalId,
      dateTime: now,
      status: "CONFIRMED",
    },
  });

  // Create the visit immediately
  const visit = await prisma.visit.create({
    data: {
      patientId,
      doctorId: user.profileId!,
      hospitalId,
      appointmentId: appointment.id,
      visitType,
    },
  });

  // Seed chief complaint from the patient's recorded complaint
  if (patient.complaint) {
    await prisma.generalExamination.create({
      data: { visitId: visit.id, chiefComplaint: patient.complaint },
    });
  }

  redirect(`/emr/${patient.udid}?visit=${visit.id}`);
}
