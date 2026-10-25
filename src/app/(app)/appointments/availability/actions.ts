"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import {
  scheduleDate, scheduleDateKey, istWeekdayOf, daysInMonth, ymd, istMonthWindow, istDayWindow, istTodayStr,
} from "@/lib/ist";

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

/* ── Weekly Template (DoctorAvailability) ──────────────────────────────────── */
export async function getWeeklyAvailability() {
  const doctorId = await getDoctorId();
  return prisma.doctorAvailability.findMany({
    where: { doctorId },
    include: { hospital: { select: { id: true, name: true } } },
    orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
  });
}

export type UpsertWeeklyResult =
  | { ok: true }
  | { ok: false; message: string };

export async function upsertWeekly(data: {
  id?: string;
  hospitalId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  slotMins: number;
  maxPatients: number;
  status: string;
}): Promise<UpsertWeeklyResult> {
  const doctorId = await getDoctorId();
  if (data.startTime >= data.endTime) return { ok: false, message: "End time must be after start time" };

  const existing = await prisma.doctorAvailability.findMany({
    where: { doctorId, weekday: data.weekday, id: data.id ? { not: data.id } : undefined },
    include: { hospital: { select: { name: true } } },
  });
  for (const e of existing) {
    if (timesOverlap(data.startTime, data.endTime, e.startTime, e.endTime)) {
      return { ok: false, message: `Overlaps with ${e.startTime}–${e.endTime} at ${(e as any).hospital.name}` };
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
  return { ok: true };
}

export type UpsertWeeklyBatchResult =
  | { ok: true; saved: number[] }
  | { ok: false; message: string };

const BATCH_DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

export async function upsertWeeklyBatch(data: {
  hospitalId: string;
  weekdays: number[];
  startTime: string;
  endTime: string;
  slotMins: number;
  maxPatients: number;
}): Promise<UpsertWeeklyBatchResult> {
  const doctorId = await getDoctorId();
  if (data.startTime >= data.endTime) return { ok: false, message: "End time must be after start time" };
  if (data.weekdays.length === 0) return { ok: false, message: "No days selected" };

  const allExisting = await prisma.doctorAvailability.findMany({
    where: { doctorId, weekday: { in: data.weekdays } },
    include: { hospital: { select: { name: true } } },
  });

  const conflicts: string[] = [];
  for (const wd of data.weekdays) {
    for (const e of allExisting.filter((x) => x.weekday === wd)) {
      if (timesOverlap(data.startTime, data.endTime, e.startTime, e.endTime)) {
        conflicts.push(`${BATCH_DAYS[wd]} ${e.startTime}–${e.endTime} at ${(e as any).hospital.name}`);
        break;
      }
    }
  }
  if (conflicts.length > 0) return { ok: false, message: `Conflicts: ${conflicts.join("; ")}` };

  await prisma.$transaction(
    data.weekdays.map((wd) =>
      prisma.doctorAvailability.create({
        data: { doctorId, hospitalId: data.hospitalId, weekday: wd, startTime: data.startTime, endTime: data.endTime, slotMins: data.slotMins, maxPatients: data.maxPatients, status: "ACTIVE" },
      })
    )
  );
  revalidate();
  return { ok: true, saved: data.weekdays };
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

// Legacy aliases — keep booking flow working
export const getAvailability        = getWeeklyAvailability;
export const upsertAvailability     = upsertWeekly;
export const deleteAvailability     = deleteWeekly;
export const toggleAvailabilityStatus = toggleWeeklyStatus;

/* ── Calendar types ─────────────────────────────────────────────────────────── */
export type DaySlot = {
  id: string;
  source: "generated" | "extra_op";
  hospitalId: string;
  hospitalName: string;
  startTime: string;
  endTime: string;
  slotMins: number;
  maxPatients: number;
  isModified: boolean;
};

export type DayLeave = {
  id: string;
  type: "FULL_DAY" | "HALF_DAY";
  halfPeriod?: string;
  reason?: string;
};

export type CalendarDay = {
  date: string;
  slots: DaySlot[];
  leave: DayLeave | null;
};

export type CalendarData = {
  days: Record<string, CalendarDay>;
  isGenerated: boolean;
};

/* ── getCalendarData ─────────────────────────────────────────────────────────── */
export async function getCalendarData(year: number, month: number): Promise<CalendarData> {
  const doctorId = await getDoctorId();
  const month_   = istMonthWindow(year, month);

  const [generated, exceptions] = await Promise.all([
    prisma.generatedSchedule.findMany({
      where: { doctorId, date: month_ },
      include: { hospital: { select: { id: true, name: true } } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    prisma.scheduleException.findMany({
      where: { doctorId, status: "ACTIVE", date: month_ },
      include: { hospital: { select: { id: true, name: true } } },
      orderBy: { date: "asc" },
    }),
  ]);

  const days: Record<string, CalendarDay> = {};

  for (const row of generated) {
    const key = scheduleDateKey(row.date);
    days[key] ??= { date: key, slots: [], leave: null };
    days[key].slots.push({
      id: row.id,
      source: "generated",
      hospitalId: row.hospitalId,
      hospitalName: (row as any).hospital.name,
      startTime: row.startTime,
      endTime: row.endTime,
      slotMins: row.slotMins,
      maxPatients: row.maxPatients,
      isModified: row.isModified,
    });
  }

  for (const exc of exceptions) {
    const key = scheduleDateKey(exc.date);
    days[key] ??= { date: key, slots: [], leave: null };
    const day = days[key];
    if (exc.type === "LEAVE" || exc.type === "HOLIDAY") {
      day.leave = {
        id: exc.id,
        type: exc.halfPeriod ? "HALF_DAY" : "FULL_DAY",
        halfPeriod: exc.halfPeriod ?? undefined,
        reason: exc.reason ?? undefined,
      };
    } else if (exc.type === "EXTRA_OP" && exc.hospitalId) {
      day.slots.push({
        id: exc.id,
        source: "extra_op",
        hospitalId: exc.hospitalId,
        hospitalName: (exc as any).hospital?.name ?? "",
        startTime: exc.startTime ?? "",
        endTime: exc.endTime ?? "",
        slotMins: exc.slotMins ?? 15,
        maxPatients: exc.maxPatients ?? 5,
        isModified: false,
      });
    }
  }

  return { days, isGenerated: generated.length > 0 };
}

/* ── generateMonthlySchedule ─────────────────────────────────────────────────── */
export async function generateMonthlySchedule(year: number, month: number) {
  const doctorId = await getDoctorId();
  const template = await prisma.doctorAvailability.findMany({
    where: { doctorId, status: "ACTIVE" },
  });
  if (template.length === 0)
    throw new Error("No weekly template found. Set up your template first.");

  await prisma.generatedSchedule.deleteMany({ where: { doctorId, date: istMonthWindow(year, month) } });

  const rows: {
    doctorId: string; date: Date; hospitalId: string;
    startTime: string; endTime: string; slotMins: number; maxPatients: number; isModified: boolean;
  }[] = [];

  for (let d = 1; d <= daysInMonth(year, month); d++) {
    const dateStr = ymd(year, month, d);
    const date    = scheduleDate(dateStr);
    const weekday = istWeekdayOf(dateStr);
    for (const slot of template.filter((t) => t.weekday === weekday)) {
      rows.push({ doctorId, date, hospitalId: slot.hospitalId, startTime: slot.startTime, endTime: slot.endTime, slotMins: slot.slotMins, maxPatients: slot.maxPatients, isModified: false });
    }
  }

  await prisma.generatedSchedule.createMany({ data: rows });
  revalidate();
}

/* ── copyPreviousMonth ──────────────────────────────────────────────────────── */
export async function copyPreviousMonth(year: number, month: number) {
  const doctorId  = await getDoctorId();
  const prevYear  = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;

  const prevRows = await prisma.generatedSchedule.findMany({
    where: { doctorId, date: istMonthWindow(prevYear, prevMonth) },
  });
  if (prevRows.length === 0) throw new Error("Previous month has no generated schedule to copy.");

  await prisma.generatedSchedule.deleteMany({ where: { doctorId, date: istMonthWindow(year, month) } });

  const rows: {
    doctorId: string; date: Date; hospitalId: string;
    startTime: string; endTime: string; slotMins: number; maxPatients: number; isModified: boolean;
  }[] = [];

  for (const row of prevRows) {
    const day     = Number(scheduleDateKey(row.date).slice(8, 10));
    if (day > daysInMonth(year, month)) continue;
    const newDate = scheduleDate(ymd(year, month, day));
    rows.push({ doctorId, date: newDate, hospitalId: row.hospitalId, startTime: row.startTime, endTime: row.endTime, slotMins: row.slotMins, maxPatients: row.maxPatients, isModified: false });
  }

  await prisma.generatedSchedule.createMany({ data: rows });
  revalidate();
}

/* ── updateGeneratedDay ─────────────────────────────────────────────────────── */
export async function updateGeneratedDay(
  id: string,
  data: { hospitalId: string; startTime: string; endTime: string; slotMins: number; maxPatients: number },
) {
  const doctorId = await getDoctorId();
  await prisma.generatedSchedule.update({ where: { id, doctorId }, data: { ...data, isModified: true } });
  revalidate();
}

/* ── deleteGeneratedDay ─────────────────────────────────────────────────────── */
export async function deleteGeneratedDay(id: string) {
  const doctorId = await getDoctorId();
  await prisma.generatedSchedule.delete({ where: { id, doctorId } });
  revalidate();
}

/* ── bulkAssignDays ──────────────────────────────────────────────────────────── */
export async function bulkAssignDays(data: {
  dates: string[];
  hospitalId: string;
  startTime: string;
  endTime: string;
  slotMins: number;
  maxPatients: number;
}) {
  const doctorId = await getDoctorId();
  for (const dateStr of data.dates) {
    await prisma.generatedSchedule.deleteMany({ where: { doctorId, date: istDayWindow(dateStr) } });
    await prisma.generatedSchedule.create({
      data: { doctorId, date: scheduleDate(dateStr), hospitalId: data.hospitalId, startTime: data.startTime, endTime: data.endTime, slotMins: data.slotMins, maxPatients: data.maxPatients, isModified: true },
    });
  }
  revalidate();
}

/* ── addLeave ────────────────────────────────────────────────────────────────── */
export async function addLeave(data: {
  dates: string[];
  hospitalId?: string;
  reason?: string;
  halfPeriod?: string;
}) {
  const doctorId = await getDoctorId();
  await prisma.scheduleException.createMany({
    data: data.dates.map((dateStr) => ({
      doctorId,
      date: scheduleDate(dateStr),
      type: "LEAVE",
      hospitalId: data.hospitalId ?? null,
      reason: data.reason ?? null,
      halfPeriod: data.halfPeriod ?? null,
      isRecurring: false,
      status: "ACTIVE",
    })),
  });
  revalidate();
}

/* ── addExtraOP ──────────────────────────────────────────────────────────────── */
export async function addExtraOP(data: {
  date: string;
  hospitalId: string;
  startTime: string;
  endTime: string;
  slotMins: number;
  maxPatients: number;
}) {
  const doctorId = await getDoctorId();
  await prisma.scheduleException.create({
    data: { doctorId, date: scheduleDate(data.date), type: "EXTRA_OP", hospitalId: data.hospitalId, startTime: data.startTime, endTime: data.endTime, slotMins: data.slotMins, maxPatients: data.maxPatients, isRecurring: false, status: "ACTIVE" },
  });
  revalidate();
}

/* ── cancelScheduleException ─────────────────────────────────────────────────── */
export async function cancelScheduleException(id: string) {
  const doctorId = await getDoctorId();
  await prisma.scheduleException.update({ where: { id, doctorId }, data: { status: "CANCELLED" } });
  revalidate();
}

/* ── addRecurringLeave ───────────────────────────────────────────────────────── */
export async function addRecurringLeave(data: {
  weekday: number;
  halfPeriod?: string;
  untilDate: string;
  hospitalId?: string;
  reason?: string;
}) {
  const doctorId = await getDoctorId();
  const until = scheduleDate(data.untilDate);
  const cur   = scheduleDate(istTodayStr());
  while (cur.getUTCDay() !== data.weekday) cur.setUTCDate(cur.getUTCDate() + 1);

  const groupId = `recurring-${Date.now()}`;
  const rows: {
    doctorId: string; date: Date; type: string; hospitalId: string | null;
    halfPeriod: string | null; reason: string; isRecurring: boolean;
    recurringGroupId: string; status: string;
  }[] = [];
  while (cur <= until) {
    rows.push({ doctorId, date: new Date(cur), type: "LEAVE", hospitalId: data.hospitalId ?? null, halfPeriod: data.halfPeriod ?? null, reason: data.reason ?? "Recurring leave", isRecurring: true, recurringGroupId: groupId, status: "ACTIVE" });
    cur.setUTCDate(cur.getUTCDate() + 7);
  }
  await prisma.scheduleException.createMany({ data: rows });
  revalidate();
}

/* ── resolveAvailabilityForDate (booking flow) ────────────────────────────────── */
export async function resolveAvailabilityForDate(
  doctorId: string,
  hospitalId: string,
  dateStr: string,
): Promise<{ startTime: string; endTime: string; slotMins: number; maxPatients: number } | null> {
  const date      = scheduleDate(dateStr);
  const dayOfWeek = istWeekdayOf(dateStr);
  const { gte: dayStart, lte: dayEnd } = istDayWindow(dateStr);

  // Fire all 6 queries in parallel; apply priority logic on results
  const [excLeave, gen, leave, indiv, monthly, weekly] = await Promise.all([
    prisma.scheduleException.findFirst({
      where: { doctorId, status: "ACTIVE", type: "LEAVE", date: { gte: dayStart, lt: dayEnd }, OR: [{ hospitalId }, { hospitalId: null }] },
    }),
    prisma.generatedSchedule.findFirst({
      where: { doctorId, hospitalId, date: { gte: dayStart, lt: dayEnd } },
      orderBy: { startTime: "asc" },
    }),
    prisma.doctorLeave.findFirst({
      where: { doctorId, status: "APPROVED", date: { gte: dayStart, lt: dayEnd }, OR: [{ hospitalId }, { hospitalId: null }] },
    }),
    prisma.individualDayAvailability.findFirst({
      where: { doctorId, hospitalId, status: "ACTIVE", date: { gte: dayStart, lt: dayEnd } },
    }),
    prisma.monthlyAvailability.findFirst({
      where: { doctorId, hospitalId, status: "ACTIVE", validFrom: { lte: date }, validTo: { gte: date } },
    }),
    prisma.doctorAvailability.findFirst({
      where: { doctorId, hospitalId, weekday: dayOfWeek, status: "ACTIVE" },
    }),
  ]);

  // Priority: excLeave > gen > leave > indiv > monthly > weekly
  if (excLeave) return null;
  if (gen) return { startTime: gen.startTime, endTime: gen.endTime, slotMins: gen.slotMins, maxPatients: gen.maxPatients };
  if (leave) return null;
  if (indiv) return { startTime: indiv.startTime, endTime: indiv.endTime, slotMins: indiv.slotMins, maxPatients: indiv.maxPatients };
  if (monthly) {
    const days = monthly.weekdays.split(",").map(Number);
    if (days.includes(dayOfWeek)) return { startTime: monthly.startTime, endTime: monthly.endTime, slotMins: monthly.slotMins, maxPatients: monthly.maxPatients };
  }
  if (weekly) return { startTime: weekly.startTime, endTime: weekly.endTime, slotMins: weekly.slotMins, maxPatients: weekly.maxPatients };

  return null;
}
