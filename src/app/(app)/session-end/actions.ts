"use server";

import { prisma } from "@/lib/prisma";
import { requireRole, scopeDoctorId } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { istTodayStr, istHHMM } from "@/lib/ist";
import { getDoctorSessions, dateOnlyWindow, type DoctorSession } from "@/lib/doctorSessions";
import {
  closeEndedSessions, openAppointmentsForSession, markAppointmentsIncomplete,
  SESSION_INCOMPLETE_NOTIFICATION,
} from "@/lib/sessionClose";

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
};

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
    prompt = {
      dateStr: today, hospitalId: s.hospitalId, hospitalName: hospital?.name ?? "",
      startTime: s.startTime, endTime: s.endTime,
      patients: open.map((a) => a.patient.name),
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

/** "Mark as incomplete": the session's open patients become incomplete visits now. */
export async function markSessionIncomplete(p: Pick<SessionPrompt, "dateStr" | "hospitalId" | "startTime" | "endTime">): Promise<{ marked: number }> {
  const user = await requireRole("DOCTOR");
  const doctorId = scopeDoctorId(user);
  const session = await findSession(doctorId, p);
  if (!session) return { marked: 0 };
  const open = await openAppointmentsForSession(doctorId, p.dateStr, session);
  const marked = await markAppointmentsIncomplete(open.map((a) => a.id));
  revalidateAll();
  return { marked };
}

/**
 * "Extend by 30 minutes": moves that date's session end in Hospital Manager — the calendar
 * entry when the month is generated, otherwise an extra OP slot right after the session
 * (shown in the calendar and merged into the same session).
 */
export async function extendSession(p: Pick<SessionPrompt, "dateStr" | "hospitalId" | "startTime" | "endTime">): Promise<{ endTime: string } | { error: string }> {
  const user = await requireRole("DOCTOR");
  const doctorId = scopeDoctorId(user);
  const session = await findSession(doctorId, p);
  if (!session) return { error: "This session has changed. Please check your schedule in Hospital Manager." };

  const newEnd = Math.min(toMins(session.endTime) + EXTEND_MINUTES, 23 * 60 + 59);
  if (newEnd <= toMins(session.endTime)) return { error: "The session cannot be extended past midnight." };
  const newEndStr = toHHMM(newEnd);
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

  revalidateAll();
  return { endTime: newEndStr };
}

/** "OK" on the pushed-as-incomplete pop-up. */
export async function acknowledgeSessionNotices(ids: string[]): Promise<void> {
  const user = await requireRole("DOCTOR");
  if (ids.length === 0) return;
  await prisma.notification.updateMany({ where: { id: { in: ids }, userId: user.id }, data: { read: true } });
}
