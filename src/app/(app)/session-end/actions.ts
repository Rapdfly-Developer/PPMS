"use server";

import { prisma } from "@/lib/prisma";
import { requireRole, scopeDoctorId } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { istTodayStr, istHHMM } from "@/lib/ist";
import { getDoctorSessions, dateOnlyWindow, SESSION_CLOSED_TYPE, type DoctorSession } from "@/lib/doctorSessions";
import {
  closeEndedSessions, openAppointmentsForSession, markAppointmentsIncomplete,
  SESSION_INCOMPLETE_NOTIFICATION,
} from "@/lib/sessionClose";
import { generateMonthlySchedule } from "@/app/(app)/appointments/availability/actions";

/** The pop-up appears this many minutes before a session ends. */
const WARN_MINUTES = 5;
const EXTEND_MINUTES = 30;

const toMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const toHHMM = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

export type SessionPrompt = {
  dateStr: string;
  hospitalId: string;
  hospitalName: string;
  startTime: string;
  endTime: string;
  patients: string[];
  /** Set when extending by 30 min would run into the doctor's next session that day. */
  overlap: { hospitalName: string; startTime: string; newStartTime: string } | null;
};

/** The doctor's next session that day after `current` (any hospital), or null. */
function nextSessionAfter(sessions: DoctorSession[], current: DoctorSession): DoctorSession | null {
  const end = toMins(current.endTime);
  return sessions
    .filter((s) => !(s.hospitalId === current.hospitalId && s.startTime === current.startTime) && toMins(s.startTime) >= end)
    .sort((a, b) => toMins(a.startTime) - toMins(b.startTime))[0] ?? null;
}

/** New end after extending, and the next session it would run into (gap under 30 min). */
function extensionPlan(sessions: DoctorSession[], current: DoctorSession) {
  const newEnd = Math.min(toMins(current.endTime) + EXTEND_MINUTES, 23 * 60 + 59);
  const next = nextSessionAfter(sessions, current);
  const overlaps = !!next && toMins(next.startTime) < newEnd;
  return { newEnd, next: overlaps ? next : null };
}

export type SessionNotice = { id: string; message: string };

/**
 * Doctor's once-a-minute check: closes ended sessions, then returns the session that ends
 * within the next 5 minutes and still has open patients (if any), plus any
 * "pushed as incomplete" notices waiting to be acknowledged.
 */
export async function getSessionPrompt(): Promise<{ prompt: SessionPrompt | null; notices: SessionNotice[] }> {
  const user = await requireRole("DOCTOR");
  const doctorId = scopeDoctorId(user);

  await closeEndedSessions();

  const today = istTodayStr();
  const nowMins = toMins(istHHMM(new Date()));
  const sessions = await getDoctorSessions(doctorId, today);

  let prompt: SessionPrompt | null = null;
  for (const s of sessions) {
    const end = toMins(s.endTime);
    if (nowMins < end - WARN_MINUTES || nowMins >= end) continue;
    const open = await openAppointmentsForSession(doctorId, today, s);
    if (open.length === 0) continue;
    const hospital = await prisma.hospital.findUnique({ where: { id: s.hospitalId }, select: { name: true } });
    const plan = extensionPlan(sessions, s);
    const nextHospital = plan.next
      ? await prisma.hospital.findUnique({ where: { id: plan.next.hospitalId }, select: { name: true } })
      : null;
    prompt = {
      dateStr: today, hospitalId: s.hospitalId, hospitalName: hospital?.name ?? "",
      startTime: s.startTime, endTime: s.endTime,
      patients: open.map((a) => a.patient.name),
      overlap: plan.next
        ? { hospitalName: nextHospital?.name ?? "", startTime: plan.next.startTime, newStartTime: toHHMM(plan.newEnd) }
        : null,
    };
    break;
  }

  const notices = await prisma.notification.findMany({
    where: { userId: user.id, type: SESSION_INCOMPLETE_NOTIFICATION, read: false },
    select: { id: true, message: true },
    orderBy: { createdAt: "asc" },
  });

  return { prompt, notices };
}

/** Find today's live session the prompt refers to (guards against stale prompts). */
async function findSession(doctorId: string, p: Pick<SessionPrompt, "dateStr" | "hospitalId" | "startTime" | "endTime">): Promise<DoctorSession | null> {
  const sessions = await getDoctorSessions(doctorId, p.dateStr, p.hospitalId);
  return sessions.find((s) => s.startTime === p.startTime && s.endTime === p.endTime) ?? null;
}

function revalidateAll() {
  revalidatePath("/opd");
  revalidatePath("/appointments");
  revalidatePath("/patients");
  revalidatePath("/hospital-manager");
  revalidatePath("/appointments/availability");
}

/**
 * "Mark as incomplete": the session's open patients become incomplete visits now, and the
 * session is closed to new patients (walk-ins / appointments) for the rest of its planned time.
 */
export async function markSessionIncomplete(p: Pick<SessionPrompt, "dateStr" | "hospitalId" | "startTime" | "endTime">): Promise<{ marked: number }> {
  const user = await requireRole("DOCTOR");
  const doctorId = scopeDoctorId(user);
  const session = await findSession(doctorId, p);
  if (!session) return { marked: 0 };
  const open = await openAppointmentsForSession(doctorId, p.dateStr, session);
  const marked = await markAppointmentsIncomplete(open.map((a) => a.id));

  // No more patients for the rest of this session (it still ends at its planned time)
  const alreadyClosed = await prisma.scheduleException.findFirst({
    where: { doctorId, hospitalId: p.hospitalId, type: SESSION_CLOSED_TYPE, status: "ACTIVE", date: dateOnlyWindow(p.dateStr), startTime: session.startTime },
    select: { id: true },
  });
  if (!alreadyClosed) {
    await prisma.scheduleException.create({
      data: {
        doctorId, date: new Date(p.dateStr), type: SESSION_CLOSED_TYPE, hospitalId: p.hospitalId,
        startTime: session.startTime, endTime: session.endTime,
        reason: "Closed by doctor: remaining patients marked incomplete", isRecurring: false, status: "ACTIVE",
      },
    });
  }

  revalidateAll();
  return { marked };
}

/** Start of one session part (calendar entry or extra OP) at a hospital on a date, moved to `newStart`. */
async function moveSessionStart(doctorId: string, hospitalId: string, dateStr: string, startTime: string, newStart: string) {
  const day = dateOnlyWindow(dateStr);
  const gen = await prisma.generatedSchedule.findFirst({ where: { doctorId, hospitalId, date: day, startTime } });
  if (gen) { await prisma.generatedSchedule.update({ where: { id: gen.id }, data: { startTime: newStart, isModified: true } }); return; }
  const extra = await prisma.scheduleException.findFirst({ where: { doctorId, hospitalId, type: "EXTRA_OP", status: "ACTIVE", date: day, startTime } });
  if (extra) await prisma.scheduleException.update({ where: { id: extra.id }, data: { startTime: newStart } });
}

/**
 * "Extend by 30 minutes". Every change is saved as that date's entries in Hospital Manager:
 *  - the month is generated first if it is not yet (same as "Generate Month"), so the day
 *    has calendar entries to edit;
 *  - the session's end moves 30 minutes later;
 *  - if the doctor's next session that day starts within those 30 minutes, its start moves
 *    to the new end time (that day only).
 */
export async function extendSession(p: Pick<SessionPrompt, "dateStr" | "hospitalId" | "startTime" | "endTime">): Promise<{ endTime: string } | { error: string }> {
  const user = await requireRole("DOCTOR");
  const doctorId = scopeDoctorId(user);
  let session = await findSession(doctorId, p);
  if (!session) return { error: "This session has changed. Please check your schedule in Hospital Manager." };

  const [y, m] = p.dateStr.split("-").map(Number);
  const monthStr  = `${y}-${String(m).padStart(2, "0")}-01`;
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const monthGenerated = await prisma.generatedSchedule.count({
    where: { doctorId, date: { gte: dateOnlyWindow(monthStr).gte, lt: new Date(`${nextMonth}T00:00:00.000Z`) } },
  });

  let sessions = await getDoctorSessions(doctorId, p.dateStr);
  if (monthGenerated === 0) {
    // Generate Month fills the calendar from the weekly template. Only do it when today's
    // schedule IS the weekly template, otherwise generating would change the doctor's day.
    const onlyWeekly = sessions.every((s) => s.source === "weekly" || s.source === "extra_op");
    if (onlyWeekly) {
      await generateMonthlySchedule(y, m);
      sessions = await getDoctorSessions(doctorId, p.dateStr);
      session = sessions.find((s) => s.hospitalId === p.hospitalId && s.startTime === p.startTime) ?? null;
      if (!session) return { error: "This session has changed. Please check your schedule in Hospital Manager." };
    }
  }

  const { newEnd, next } = extensionPlan(sessions, session);
  if (newEnd <= toMins(session.endTime)) return { error: "The session cannot be extended past midnight." };
  const newEndStr = toHHMM(newEnd);
  if (next && newEnd >= toMins(next.endTime)) {
    return { error: "Extending would cover your whole next session. Please adjust your schedule in Hospital Manager." };
  }
  if (next && next.source !== "generated" && next.source !== "extra_op") {
    return { error: "Your next session today comes from a monthly plan or day override. Please adjust it in Hospital Manager." };
  }

  const day = dateOnlyWindow(p.dateStr);
  // The part of the session that ends last: a calendar entry or an earlier extension
  const [gen, extra] = await Promise.all([
    prisma.generatedSchedule.findFirst({ where: { doctorId, hospitalId: p.hospitalId, date: day, endTime: session.endTime } }),
    prisma.scheduleException.findFirst({ where: { doctorId, hospitalId: p.hospitalId, type: "EXTRA_OP", status: "ACTIVE", date: day, endTime: session.endTime } }),
  ]);

  if (gen) {
    await prisma.generatedSchedule.update({ where: { id: gen.id }, data: { endTime: newEndStr, isModified: true } });
  } else if (extra) {
    await prisma.scheduleException.update({ where: { id: extra.id }, data: { endTime: newEndStr } });
  } else {
    await prisma.scheduleException.create({
      data: {
        doctorId, date: new Date(p.dateStr), type: "EXTRA_OP", hospitalId: p.hospitalId,
        startTime: session.endTime, endTime: newEndStr, slotMins: 15, maxPatients: 5,
        reason: "Session extended by 30 min", isRecurring: false, status: "ACTIVE",
      },
    });
  }

  // Next session starts within the extension: push its start to the new end (that day only)
  if (next) await moveSessionStart(doctorId, next.hospitalId, p.dateStr, next.startTime, newEndStr);

  revalidateAll();
  return { endTime: newEndStr };
}

/** "OK" on the pushed-as-incomplete pop-up. */
export async function acknowledgeSessionNotices(ids: string[]): Promise<void> {
  const user = await requireRole("DOCTOR");
  if (ids.length === 0) return;
  await prisma.notification.updateMany({ where: { id: { in: ids }, userId: user.id }, data: { read: true } });
}
