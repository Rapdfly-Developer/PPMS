"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

async function getDoctorId(userId: string) {
  const d = await prisma.doctor.findUnique({ where: { userId }, select: { id: true } });
  return d?.id ?? null;
}

export async function upsertAvailability(
  hospitalId: string,
  weekday: number,
  startTime: string,
  endTime: string,
  slotMins: number
): Promise<{ error?: string }> {
  const user = await requireRole("DOCTOR");
  const doctorId = await getDoctorId(user.id);
  if (!doctorId) return { error: "Doctor profile not found." };

  const link = await prisma.doctorHospitalLink.findUnique({
    where: { doctorId_hospitalId: { doctorId, hospitalId } },
  });
  if (!link) return { error: "You are not linked to this hospital." };

  if (startTime >= endTime) return { error: "End time must be after start time." };

  await prisma.doctorAvailability.upsert({
    where: { doctorId_hospitalId_weekday: { doctorId, hospitalId, weekday } },
    create: { doctorId, hospitalId, weekday, startTime, endTime, slotMins },
    update: { startTime, endTime, slotMins },
  });

  revalidatePath("/availability");
  revalidatePath("/appointments/book");
  return {};
}

export async function deleteAvailability(id: string): Promise<{ error?: string }> {
  const user = await requireRole("DOCTOR");
  const doctorId = await getDoctorId(user.id);
  if (!doctorId) return { error: "Doctor profile not found." };

  const slot = await prisma.doctorAvailability.findUnique({ where: { id } });
  if (!slot || slot.doctorId !== doctorId) return { error: "Not found or forbidden." };

  await prisma.doctorAvailability.delete({ where: { id } });
  revalidatePath("/availability");
  revalidatePath("/appointments/book");
  return {};
}
