"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

async function getDoctorId() {
  const user = await requireRole("DOCTOR");
  if (!user.profileId) throw new Error("Doctor profile not found");
  return user.profileId;
}

function toMins(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function timesOverlap(s1: string, e1: string, s2: string, e2: string) {
  return toMins(s1) < toMins(e2) && toMins(e1) > toMins(s2);
}
function revalidate() {
  revalidatePath("/appointments/availability");
}

/* ── Hospitals ─────────────────────────────────────────────────────────────── */
export async function getHospitalsForDoctor() {
  const doctorId = await getDoctorId();
  const links = await prisma.doctorHospitalLink.findMany({
    where: { doctorId, active: true },
    include: { hospital: { select: { id: true, name: true } } },
    orderBy: { hospital: { name: "asc" } },
  });
  return links.map((l) => ({ id: l.hospital.id, name: l.hospital.name }));
}

/* ── Weekly availability ───────────────────────────────────────────────────── */
export async function getWeeklyAvailability() {
  const doctorId = await getDoctorId();
  return prisma.doctorAvailability.findMany({
    where: { doctorId },
    include: { hospital: { select: { id: true, name: true } } },
    orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
  });
}

export async function upsertWeekly(data: {
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
  if (data.startTime >= data.endTime) throw new Error("End time must be after start time");

  const existing = await prisma.doctorAvailability.findMany({
    where: { doctorId, weekday: data.weekday, id: data.id ? { not: data.id } : undefined },
    include: { hospital: { select: { name: true } } },
  });
  for (const e of existing) {
    if (timesOverlap(data.startTime, data.endTime, e.startTime, e.endTime)) {
      throw new Error(`Overlaps with ${e.startTime}–${e.endTime} at ${(e as any).hospital.name}`);
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
  revalidate();
}

export async function deleteWeekly(id: string) {
  const doctorId = await getDoctorId();
  await prisma.doctorAvailability.delete({ where: { id, doctorId } });
  revalidate();
}

export async function toggleWeeklyStatus(id: string, status: string) {
  const doctorId = await getDoctorId();
  await prisma.doctorAvailability.update({ where: { id, doctorId }, data: { status } });
  revalidate();
}

// Keep legacy names for backward compat with existing booking flow
export const getAvailability = getWeeklyAvailability;
export const upsertAvailability = upsertWeekly;
export const deleteAvailability = deleteWeekly;
export const toggleAvailabilityStatus = toggleWeeklyStatus;

/* ── Monthly availability ──────────────────────────────────────────────────── */
export async function getMonthlyAvailability() {
  const doctorId = await getDoctorId();
  return prisma.monthlyAvailability.findMany({
    where: { doctorId },
    include: { hospital: { select: { id: true, name: true } } },
    orderBy: [{ validFrom: "asc" }, { startTime: "asc" }],
  });
}

export async function upsertMonthly(data: {
  id?: string;
  hospitalId: string;
  validFrom: string; // ISO date string
  validTo: string;
  weekdays: string;  // "1,2,3,4,5"
  startTime: string;
  endTime: string;
  slotMins: number;
  maxPatients: number;
  label?: string;
  status: string;
}) {
  const doctorId = await getDoctorId();
  if (data.startTime >= data.endTime) throw new Error("End time must be after start time");
  if (!data.weekdays) throw new Error("Select at least one day");

  const from = new Date(data.validFrom);
  const to   = new Date(data.validTo);
  if (from > to) throw new Error("Valid To must be after Valid From");

  const payload = {
    doctorId,
    hospitalId: data.hospitalId,
    validFrom: from,
    validTo: to,
    weekdays: data.weekdays,
    startTime: data.startTime,
    endTime: data.endTime,
    slotMins: data.slotMins,
    maxPatients: data.maxPatients,
    label: data.label || null,
    status: data.status,
  };

  if (data.id) {
    await prisma.monthlyAvailability.update({ where: { id: data.id, doctorId }, data: payload });
  } else {
    await prisma.monthlyAvailability.create({ data: payload });
  }
  revalidate();
}

export async function deleteMonthly(id: string) {
  const doctorId = await getDoctorId();
  await prisma.monthlyAvailability.delete({ where: { id, doctorId } });
  revalidate();
}

export async function toggleMonthlyStatus(id: string, status: string) {
  const doctorId = await getDoctorId();
  await prisma.monthlyAvailability.update({ where: { id, doctorId }, data: { status } });
  revalidate();
}

/* ── Individual day availability ───────────────────────────────────────────── */
export async function getIndividualDayAvailability() {
  const doctorId = await getDoctorId();
  return prisma.individualDayAvailability.findMany({
    where: { doctorId },
    include: { hospital: { select: { id: true, name: true } } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
}

export async function upsertIndividualDay(data: {
  id?: string;
  hospitalId: string;
  date: string; // ISO date string
  startTime: string;
  endTime: string;
  slotMins: number;
  maxPatients: number;
  reason?: string;
  status: string;
}) {
  const doctorId = await getDoctorId();
  if (data.startTime >= data.endTime) throw new Error("End time must be after start time");

  const payload = {
    doctorId,
    hospitalId: data.hospitalId,
    date: new Date(data.date),
    startTime: data.startTime,
    endTime: data.endTime,
    slotMins: data.slotMins,
    maxPatients: data.maxPatients,
    reason: data.reason || null,
    status: data.status,
  };

  if (data.id) {
    await prisma.individualDayAvailability.update({ where: { id: data.id, doctorId }, data: payload });
  } else {
    await prisma.individualDayAvailability.create({ data: payload });
  }
  revalidate();
}

export async function deleteIndividualDay(id: string) {
  const doctorId = await getDoctorId();
  await prisma.individualDayAvailability.delete({ where: { id, doctorId } });
  revalidate();
}

/* ── Leave management ──────────────────────────────────────────────────────── */
export async function getLeaves() {
  const doctorId = await getDoctorId();
  return prisma.doctorLeave.findMany({
    where: { doctorId, status: { not: "CANCELLED" } },
    include: { hospital: { select: { id: true, name: true } } },
    orderBy: { date: "asc" },
  });
}

export async function applyLeave(data: {
  hospitalId?: string; // undefined = all hospitals
  date: string;
  leaveType: string;
  halfPeriod?: string;
  reason?: string;
}) {
  const doctorId = await getDoctorId();
  await prisma.doctorLeave.create({
    data: {
      doctorId,
      hospitalId: data.hospitalId || null,
      date: new Date(data.date),
      leaveType: data.leaveType,
      halfPeriod: data.halfPeriod || null,
      reason: data.reason || null,
      status: "APPROVED",
    },
  });
  revalidate();
}

export async function cancelLeave(id: string) {
  const doctorId = await getDoctorId();
  await prisma.doctorLeave.update({ where: { id, doctorId }, data: { status: "CANCELLED" } });
  revalidate();
}

/* ── Priority resolution (used by booking flow) ───────────────────────────── */
export async function resolveAvailabilityForDate(
  doctorId: string,
  hospitalId: string,
  dateStr: string, // "YYYY-MM-DD" in IST
): Promise<{ startTime: string; endTime: string; slotMins: number; maxPatients: number } | null> {
  const date      = new Date(dateStr + "T00:00:00.000Z");
  const dayOfWeek = date.getUTCDay(); // 0=Sun…6=Sat

  // 1. Leave (highest priority)
  const leave = await prisma.doctorLeave.findFirst({
    where: {
      doctorId,
      status: "APPROVED",
      date: { gte: new Date(dateStr + "T00:00:00.000Z"), lt: new Date(dateStr + "T23:59:59.999Z") },
      OR: [{ hospitalId }, { hospitalId: null }],
    },
  });
  if (leave) return null;

  // 2. Individual day override
  const indiv = await prisma.individualDayAvailability.findFirst({
    where: {
      doctorId, hospitalId, status: "ACTIVE",
      date: { gte: new Date(dateStr + "T00:00:00.000Z"), lt: new Date(dateStr + "T23:59:59.999Z") },
    },
  });
  if (indiv) return { startTime: indiv.startTime, endTime: indiv.endTime, slotMins: indiv.slotMins, maxPatients: indiv.maxPatients };

  // 3. Monthly plan
  const monthly = await prisma.monthlyAvailability.findFirst({
    where: {
      doctorId, hospitalId, status: "ACTIVE",
      validFrom: { lte: date },
      validTo:   { gte: date },
    },
  });
  if (monthly) {
    const days = monthly.weekdays.split(",").map(Number);
    if (days.includes(dayOfWeek)) {
      return { startTime: monthly.startTime, endTime: monthly.endTime, slotMins: monthly.slotMins, maxPatients: monthly.maxPatients };
    }
  }

  // 4. Weekly base schedule
  const weekly = await prisma.doctorAvailability.findFirst({
    where: { doctorId, hospitalId, weekday: dayOfWeek, status: "ACTIVE" },
  });
  if (weekly) return { startTime: weekly.startTime, endTime: weekly.endTime, slotMins: weekly.slotMins, maxPatients: weekly.maxPatients };

  // 5. Not available
  return null;
}
