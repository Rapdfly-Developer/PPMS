import { prisma } from "@/lib/prisma";
import { istTodayStr, istHHMM, istDateTime, istDayRange } from "@/lib/ist";
import { getDoctorSessions, sessionAt, dateOnlyWindow, SESSION_CLOSED_TYPE, type DoctorSession } from "@/lib/doctorSessions";

/**
 * End-of-session close (replaces the old midnight auto-close).
 *
 * When a doctor's session at a hospital ends, every patient of that session who is
 * still in the queue (CONFIRMED) or in Partial Dispense and whose consultation was not
 * finalized becomes an INCOMPLETE visit: the appointment is marked INCOMPLETE (never
 * DISPENSED), the visit is closed read-only, and it shows in the No Show Registry.
 */

export const INCOMPLETE_FINALIZED_BY = "SYSTEM (incomplete at end of session)";
export const SESSION_INCOMPLETE_NOTIFICATION = "SESSION_INCOMPLETE";

const OPEN_STATUSES = ["CONFIRMED", "PARTIAL_DISPENSE"];

type OpenAppt = { id: string; doctorId: string | null; hospitalId: string; dateTime: Date };
export type SessionCache = Map<string, DoctorSession[]>;

const toMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

/** Minutes between a time and a session window (0 when inside it). */
function distance(s: DoctorSession, mins: number) {
  const a = toMins(s.startTime), b = toMins(s.endTime);
  return mins < a ? a - mins : mins >= b ? mins - b + 1 : 0;
}

const NEXT_SESSION_LOOKAHEAD_DAYS = 60;

/** "YYYY-MM-DD" n days after an IST date string. */
function addDays(dateStr: string, n: number) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * The session an appointment belongs to:
 *  1. the session covering its time;
 *  2. otherwise (schedule changed after booking) the doctor's nearest session that day —
 *     same hospital first, else any hospital;
 *  3. otherwise (no session at all that day, e.g. leave added later) the doctor's next
 *     session — same hospital first on that day — so it is decided in that session's pop-up.
 * Never closed at midnight. Null only when the doctor has no upcoming session at all.
 */
/**
 * True when the doctor answered the end-of-session pop-up with "Mark as incomplete" for the
 * session this appointment belongs to (the session is closed to anything new, including
 * returning a dispensed patient to the queue).
 */
export async function isAppointmentSessionClosed(appt: OpenAppt, cache: SessionCache = new Map()): Promise<boolean> {
  const r = await sessionForAppointment(appt, cache);
  if (!r) return false;
  const closed = await prisma.scheduleException.findFirst({
    where: {
      doctorId: appt.doctorId!, hospitalId: r.session.hospitalId, type: SESSION_CLOSED_TYPE, status: "ACTIVE",
      date: dateOnlyWindow(r.dateStr), startTime: r.session.startTime,
    },
    select: { id: true },
  });
  return !!closed;
}

export async function sessionForAppointment(appt: OpenAppt, cache: SessionCache = new Map()): Promise<{ dateStr: string; session: DoctorSession } | null> {
  if (!appt.doctorId) return null;
  const dateStr = istTodayStr(appt.dateTime);
  const key = `${appt.doctorId}_${dateStr}`;
  if (!cache.has(key)) cache.set(key, await getDoctorSessions(appt.doctorId, dateStr));
  const all  = cache.get(key)!;
  const mins = toMins(istHHMM(appt.dateTime));
  const here = all.filter((s) => s.hospitalId === appt.hospitalId);
  const covering = sessionAt(here, istHHMM(appt.dateTime));
  if (covering) return { dateStr, session: covering };
  const pool = here.length > 0 ? here : all;
  if (pool.length > 0) {
    const nearest = [...pool].sort((x, y) => distance(x, mins) - distance(y, mins))[0];
    return { dateStr, session: nearest };
  }
  for (let i = 1; i <= NEXT_SESSION_LOOKAHEAD_DAYS; i++) {
    const next = addDays(dateStr, i);
    const k = `${appt.doctorId}_${next}`;
    if (!cache.has(k)) cache.set(k, await getDoctorSessions(appt.doctorId, next));
    const day = cache.get(k)!;
    if (day.length === 0) continue;
    const sameHosp = day.filter((x) => x.hospitalId === appt.hospitalId);
    return { dateStr: next, session: (sameHosp.length > 0 ? sameHosp : day)[0] };
  }
  return null;
}

/** Same session on the same date (sessions are unique by hospital + start + end on a date). */
export function sameSession(a: DoctorSession, b: DoctorSession) {
  return a.hospitalId === b.hospitalId && a.startTime === b.startTime && a.endTime === b.endTime;
}

/** Mark the given open appointments INCOMPLETE and lock their visits. Returns how many changed. */
export async function markAppointmentsIncomplete(appointmentIds: string[]): Promise<number> {
  if (appointmentIds.length === 0) return 0;
  const open = await prisma.appointment.findMany({
    where: {
      id: { in: appointmentIds },
      status: { in: OPEN_STATUSES },
      OR: [{ consultationStatus: null }, { consultationStatus: { not: "FINALIZED" } }],
    },
    select: { id: true },
  });
  const ids = open.map((a) => a.id);
  if (ids.length === 0) return 0;
  await prisma.$transaction([
    prisma.appointment.updateMany({ where: { id: { in: ids } }, data: { status: "INCOMPLETE" } }),
    prisma.visit.updateMany({
      where: { appointmentId: { in: ids }, status: "IN_PROGRESS" },
      data:  { status: "CLOSED", finalizedBy: INCOMPLETE_FINALIZED_BY },
    }),
  ]);
  return ids.length;
}

/**
 * Open appointments that belong to one of the doctor's sessions on a date — those inside
 * the session window plus orphaned ones attached to it (same day, or an earlier day that
 * had no session at all).
 */
export async function openAppointmentsForSession(doctorId: string, dateStr: string, session: DoctorSession) {
  const { dayEnd } = istDayRange(dateStr);
  const open = await prisma.appointment.findMany({
    where: {
      doctorId,
      status: { in: OPEN_STATUSES },
      OR: [{ consultationStatus: null }, { consultationStatus: { not: "FINALIZED" } }],
      dateTime: { lte: dayEnd },
    },
    select: { id: true, doctorId: true, hospitalId: true, dateTime: true, patient: { select: { name: true } } },
    orderBy: { dateTime: "asc" },
  });
  const cache: SessionCache = new Map();
  const mine: typeof open = [];
  for (const a of open) {
    const r = await sessionForAppointment(a, cache);
    if (r && r.dateStr === dateStr && sameSession(r.session, session)) mine.push(a);
  }
  return mine;
}

let lastRun = 0;

/**
 * Close every session that has ended. Runs lazily on page loads, from the doctor's
 * once-a-minute check and from the nightly cron. Throttled to once a minute per server.
 * Doctors whose patients were pushed automatically get a notification, shown to them as
 * a pop-up the next time they open the app.
 */
export async function closeEndedSessions(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastRun < 60_000) return;
  lastRun = now;

  const candidates = await prisma.appointment.findMany({
    where: {
      status: { in: OPEN_STATUSES },
      OR: [{ consultationStatus: null }, { consultationStatus: { not: "FINALIZED" } }],
      dateTime: { lt: new Date(now) },
    },
    select: { id: true, doctorId: true, hospitalId: true, dateTime: true },
  });
  if (candidates.length === 0) return;

  const cache: SessionCache = new Map();
  const ended: OpenAppt[] = [];
  for (const a of candidates) {
    const r = await sessionForAppointment(a, cache);
    // No session at all that day (e.g. leave added after booking): never closed at midnight —
    // left open for the doctor to decide.
    if (r && istDateTime(r.dateStr, r.session.endTime).getTime() <= now) ended.push(a);
  }
  if (ended.length === 0) return;

  await markAppointmentsIncomplete(ended.map((a) => a.id));

  // One pop-up notification per doctor
  const perDoctor = new Map<string, number>();
  for (const a of ended) if (a.doctorId) perDoctor.set(a.doctorId, (perDoctor.get(a.doctorId) ?? 0) + 1);
  if (perDoctor.size === 0) return;
  const doctors = await prisma.doctor.findMany({ where: { id: { in: [...perDoctor.keys()] } }, select: { id: true, userId: true } });
  await prisma.notification.createMany({
    data: doctors.filter((d) => d.userId).map((d) => {
      const n = perDoctor.get(d.id)!;
      return {
        userId:  d.userId!,
        type:    SESSION_INCOMPLETE_NOTIFICATION,
        message: `${n} patient${n === 1 ? " was" : "s were"} pushed as incomplete visit${n === 1 ? "" : "s"}.`,
      };
    }),
  });
}
