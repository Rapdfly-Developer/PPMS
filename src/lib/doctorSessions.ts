import { prisma } from "@/lib/prisma";
import { istDayRange, istTodayStr, istHHMM } from "@/lib/ist";

/**
 * A doctor's working session at one hospital on one date (IST wall-clock times).
 * Sessions come from the schedule the doctor manages in Hospital Manager:
 *   leave / holiday           → no sessions that day
 *   generated calendar month  → that day's calendar entries (incl. edits / extensions)
 *   otherwise                 → single-day override, else monthly plan, else weekly template
 *   extra OP exceptions are always added.
 */
export type DoctorSession = {
  hospitalId: string;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  source: "generated" | "extra_op" | "individual" | "monthly" | "weekly";
  slotMins: number;
  maxPatients: number;
  /** GeneratedSchedule row id, when the session is a calendar entry. */
  generatedId?: string;
};

const toMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

/**
 * Date-only schedule fields are stored either at UTC midnight (`new Date("YYYY-MM-DD")`)
 * or at server-local midnight (Generate Month). For an IST date both fall between
 * IST midnight and UTC midnight of that date.
 */
export function dateOnlyWindow(dateStr: string) {
  return { gte: istDayRange(dateStr).dayStart, lte: new Date(`${dateStr}T00:00:00.000Z`) };
}

export async function getDoctorSessions(doctorId: string, dateStr: string, hospitalId?: string): Promise<DoctorSession[]> {
  const day      = dateOnlyWindow(dateStr);
  const weekday  = new Date(`${dateStr}T00:00:00.000Z`).getUTCDay();
  const [y, m]   = dateStr.split("-").map(Number);
  const monthStart = istDayRange(`${y}-${String(m).padStart(2, "0")}-01`).dayStart;
  const nextMonth  = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const monthEnd   = new Date(`${nextMonth}T00:00:00.000Z`);
  const hosp = hospitalId ? { hospitalId } : {};

  const [excLeave, docLeave, monthGenerated, generated, extraOps, indiv, monthly, weekly] = await Promise.all([
    prisma.scheduleException.findFirst({
      where: { doctorId, status: "ACTIVE", type: { in: ["LEAVE", "HOLIDAY"] }, date: day, ...(hospitalId ? { OR: [{ hospitalId }, { hospitalId: null }] } : {}) },
      select: { id: true },
    }),
    prisma.doctorLeave.findFirst({
      where: { doctorId, status: "APPROVED", date: day, ...(hospitalId ? { OR: [{ hospitalId }, { hospitalId: null }] } : {}) },
      select: { id: true },
    }),
    prisma.generatedSchedule.count({ where: { doctorId, date: { gte: monthStart, lt: monthEnd } } }),
    prisma.generatedSchedule.findMany({ where: { doctorId, ...hosp, date: day } }),
    prisma.scheduleException.findMany({ where: { doctorId, ...hosp, status: "ACTIVE", type: "EXTRA_OP", date: day } }),
    prisma.individualDayAvailability.findMany({ where: { doctorId, ...hosp, status: "ACTIVE", date: day } }),
    prisma.monthlyAvailability.findMany({ where: { doctorId, ...hosp, status: "ACTIVE", validFrom: { lte: monthEnd }, validTo: { gte: day.gte } } }),
    prisma.doctorAvailability.findMany({ where: { doctorId, ...hosp, weekday, status: "ACTIVE" } }),
  ]);

  if (excLeave || docLeave) return [];

  const extras: DoctorSession[] = extraOps
    .filter((e) => e.hospitalId && e.startTime && e.endTime)
    .map((e) => ({ hospitalId: e.hospitalId!, startTime: e.startTime!, endTime: e.endTime!, source: "extra_op", slotMins: e.slotMins ?? 15, maxPatients: e.maxPatients ?? 5 }));

  let base: DoctorSession[];
  if (monthGenerated > 0) {
    // A generated month is authoritative: it is exactly what Hospital Manager's calendar shows.
    base = generated.map((g) => ({ hospitalId: g.hospitalId, startTime: g.startTime, endTime: g.endTime, source: "generated", generatedId: g.id, slotMins: g.slotMins, maxPatients: g.maxPatients }));
  } else if (indiv.length > 0) {
    base = indiv.map((i) => ({ hospitalId: i.hospitalId, startTime: i.startTime, endTime: i.endTime, source: "individual", slotMins: i.slotMins, maxPatients: i.maxPatients }));
  } else {
    const dayDate = new Date(`${dateStr}T00:00:00.000Z`);
    const monthlyToday = monthly.filter((p) =>
      p.validFrom <= dayDate && p.validTo >= day.gte && p.weekdays.split(",").map(Number).includes(weekday));
    base = monthlyToday.length > 0
      ? monthlyToday.map((p) => ({ hospitalId: p.hospitalId, startTime: p.startTime, endTime: p.endTime, source: "monthly", slotMins: p.slotMins, maxPatients: p.maxPatients }))
      : weekly.map((w) => ({ hospitalId: w.hospitalId, startTime: w.startTime, endTime: w.endTime, source: "weekly", slotMins: w.slotMins, maxPatients: w.maxPatients }));
  }

  const sorted = [...base, ...extras].sort((a, b) => toMins(a.startTime) - toMins(b.startTime));
  // Back-to-back or overlapping sessions at the same hospital are one session — e.g. a
  // 30-minute extension saved right after the session ends.
  const merged: DoctorSession[] = [];
  for (const s of sorted) {
    const prev = [...merged].reverse().find((m) => m.hospitalId === s.hospitalId);
    if (prev && toMins(s.startTime) <= toMins(prev.endTime)) {
      if (toMins(s.endTime) > toMins(prev.endTime)) prev.endTime = s.endTime;
    } else {
      merged.push({ ...s });
    }
  }
  return merged;
}

/** The session covering an IST "HH:MM" time (start inclusive, end exclusive). */
export function sessionAt(sessions: DoctorSession[], hhmm: string): DoctorSession | null {
  const t = toMins(hhmm);
  return sessions.find((s) => t >= toMins(s.startTime) && t < toMins(s.endTime)) ?? null;
}

/**
 * Marker (a ScheduleException of this type) recorded when the doctor answers the end-of-session
 * pop-up with "Mark as incomplete": the session keeps its planned end time, but no more
 * patients can be added to it. Only booking reads it; schedule screens ignore this type.
 */
export const SESSION_CLOSED_TYPE = "SESSION_CLOSED";

/**
 * Appointments and walk-ins may only be created inside one of the doctor's sessions at
 * that hospital, and not in a session the doctor has closed. Returns an error message,
 * or null when the time is allowed.
 */
export async function checkWithinSession(doctorId: string, hospitalId: string, at: Date): Promise<string | null> {
  const dateStr  = istTodayStr(at);
  const sessions = await getDoctorSessions(doctorId, dateStr, hospitalId);
  if (sessions.length === 0) return "The doctor has no schedule at this hospital on this day.";
  const session = sessionAt(sessions, istHHMM(at));
  if (session) {
    const closed = await prisma.scheduleException.findFirst({
      where: { doctorId, hospitalId, type: SESSION_CLOSED_TYPE, status: "ACTIVE", date: dateOnlyWindow(dateStr), startTime: session.startTime },
      select: { id: true },
    });
    return closed ? "No more patients can be added to this session." : null;
  }
  const windows = sessions.map((s) => `${s.startTime}–${s.endTime}`).join(", ");
  return `This time is outside the doctor's schedule at this hospital (${windows}).`;
}
