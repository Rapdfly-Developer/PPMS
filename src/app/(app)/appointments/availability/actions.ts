"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

async function getDoctorId() {
  const user = await requireRole("DOCTOR");
  if (!user.profileId) throw new Error("Doctor profile not found");
  return user.profileId;
}

export async function getAvailability() {
  const doctorId = await getDoctorId();
  return prisma.doctorAvailability.findMany({
    where: { doctorId },
    include: { hospital: { select: { id: true, name: true } } },
    orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
  });
}

export async function getHospitalsForDoctor() {
  const doctorId = await getDoctorId();
  const links = await prisma.doctorHospitalLink.findMany({
    where: { doctorId, active: true },
    include: { hospital: { select: { id: true, name: true } } },
    orderBy: { hospital: { name: "asc" } },
  });
  return links.map((l) => ({ id: l.hospital.id, name: l.hospital.name }));
}

export async function upsertAvailability(data: {
  id?: string;
  hospitalId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  slotMins: number;
  maxPatients: number;
  status: string;
}) {
  const doctorId = await getDoctorId();

  // Validate no overlap with same doctor + hospital + weekday (excluding self)
  const existing = await prisma.doctorAvailability.findMany({
    where: { doctorId, weekday: data.weekday, id: data.id ? { not: data.id } : undefined },
    include: { hospital: { select: { name: true } } },
  });
  for (const e of existing) {
    if (timesOverlap(data.startTime, data.endTime, e.startTime, e.endTime)) {
      throw new Error(`Time overlaps with ${e.startTime}–${e.endTime} already scheduled at ${(e as any).hospital.name}`);
    }
  }

  if (data.id) {
    await prisma.doctorAvailability.update({
      where: { id: data.id, doctorId },
      data: { hospitalId: data.hospitalId, weekday: data.weekday, startTime: data.startTime, endTime: data.endTime, slotMins: data.slotMins, maxPatients: data.maxPatients, status: data.status },
    });
  } else {
    await prisma.doctorAvailability.create({
      data: { doctorId, hospitalId: data.hospitalId, weekday: data.weekday, startTime: data.startTime, endTime: data.endTime, slotMins: data.slotMins, maxPatients: data.maxPatients, status: data.status },
    });
  }
  revalidatePath("/appointments/availability");
}

export async function deleteAvailability(id: string) {
  const doctorId = await getDoctorId();
  await prisma.doctorAvailability.delete({ where: { id, doctorId } });
  revalidatePath("/appointments/availability");
}

export async function toggleAvailabilityStatus(id: string, status: string) {
  const doctorId = await getDoctorId();
  await prisma.doctorAvailability.update({ where: { id, doctorId }, data: { status } });
  revalidatePath("/appointments/availability");
}

function timesOverlap(s1: string, e1: string, s2: string, e2: string) {
  const toMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  return toMins(s1) < toMins(e2) && toMins(e1) > toMins(s2);
}
