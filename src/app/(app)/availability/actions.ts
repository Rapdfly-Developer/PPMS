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

  const existing = await prisma.doctorAvailability.findFirst({ where: { doctorId, hospitalId, weekday } });
  if (existing) {
    await prisma.doctorAvailability.update({ where: { id: existing.id }, data: { startTime, endTime, slotMins } });
  } else {
    await prisma.doctorAvailability.create({ data: { doctorId, hospitalId, weekday, startTime, endTime, slotMins } });
  }

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
