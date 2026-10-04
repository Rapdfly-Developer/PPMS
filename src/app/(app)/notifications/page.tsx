import { requireUser, scopeDoctorId } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { istTodayStr } from "@/lib/ist";
import { formatDistanceToNow, format } from "date-fns";
import { Bell, Calendar, BedDouble, Cake, CheckCheck } from "lucide-react";
import { MarkAllReadButton } from "./MarkAllReadButton";
import Link from "next/link";

// ── Birthday helpers ──────────────────────────────────────────────────────────

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Returns the birthday date for a given year, adjusted for Feb 29 in non-leap years. */
function birthdayInYear(dob: Date, year: number): Date {
  const m = dob.getUTCMonth(); // 0-based
  const d = dob.getUTCDate();
  if (m === 1 && d === 29 && !isLeapYear(year)) {
    return new Date(Date.UTC(year, 1, 28));
  }
  return new Date(Date.UTC(year, m, d));
}

/** "YYYY-MM-DD" from a UTC Date */
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Age (in years) as of a given birthday this year */
function ageOn(dob: Date, birthdayDate: Date): number {
  return birthdayDate.getUTCFullYear() - dob.getUTCFullYear();
}

// ── Ensure birthday reminders exist for the current window ───────────────────

async function ensureBirthdayReminders(userId: string, user: any): Promise<void> {
  const todayStr = istTodayStr();
  const todayDate = new Date(todayStr + "T00:00:00Z");

  // Scope patients exactly as the patient list does
  const scopeWhere: any = {};
  if (user.role === "DOCTOR") {
    const doctorId = scopeDoctorId(user);
    const links = await prisma.doctorHospitalLink.findMany({
      where: { doctorId, active: true },
      select: { hospitalId: true },
    });
    const hospitalIds = links.map((l: any) => l.hospitalId);
    scopeWhere.OR = [
      { doctorId },
      ...(hospitalIds.length > 0 ? [{ registeredAtId: { in: hospitalIds } }] : []),
    ];
  } else if (user.hospitalId) {
    scopeWhere.registeredAtId = user.hospitalId;
  } else {
    return; // no scope — skip
  }

  const patients = await prisma.patient.findMany({
    where: { ...scopeWhere, dateOfBirth: { not: null } },
    select: { id: true, udid: true, name: true, dateOfBirth: true },
  });

  if (patients.length === 0) return;

  const year = todayDate.getUTCFullYear();

  // Collect candidates whose birthday falls in [today, today+7]
  const candidates: { patient: typeof patients[0]; bdayDate: Date; entityId: string }[] = [];
  for (const p of patients) {
    if (!p.dateOfBirth || !p.udid) continue;
    let bdayDate = birthdayInYear(p.dateOfBirth, year);
    // If birthday already passed this year, check next year too (for the 7-day window spanning new year)
    if (isoDate(bdayDate) < todayStr) {
      bdayDate = birthdayInYear(p.dateOfBirth, year + 1);
    }
    const bdayStr = isoDate(bdayDate);
    const daysDiff = Math.round(
      (bdayDate.getTime() - todayDate.getTime()) / 86_400_000
    );
    if (daysDiff < 0 || daysDiff > 7) continue;

    candidates.push({
      patient: p,
      bdayDate,
      entityId: `BIRTHDAY:${p.udid}:${bdayStr}`,
    });
  }

  if (candidates.length === 0) return;

  // Check which ones already have a notification this year
  const entityIds = candidates.map((c) => c.entityId);
  const existing = await prisma.notification.findMany({
    where: { userId, type: "BIRTHDAY", entityId: { in: entityIds } },
    select: { entityId: true },
  });
  const existingSet = new Set(existing.map((n: any) => n.entityId));

  for (const { patient, bdayDate, entityId } of candidates) {
    if (existingSet.has(entityId)) continue;

    const age = ageOn(patient.dateOfBirth!, bdayDate);
    const dateLabel = format(bdayDate, "d MMMM");
    const message = `${patient.name} turns ${age} on ${dateLabel}`;

    await prisma.notification.create({
      data: { userId, type: "BIRTHDAY", message, entityId },
    });
  }
}

// ── Icon per notification type ────────────────────────────────────────────────

function NotificationIcon({ type }: { type: string }) {
  const base = "inline-flex items-center justify-center w-9 h-9 rounded-full shrink-0";
  if (type === "BIRTHDAY") {
    return (
      <span className={`${base} bg-[var(--color-warning-100,#fef3c7)] text-[var(--color-warning-600,#d97706)]`}>
        <Cake size={16} />
      </span>
    );
  }
  if (type.startsWith("APPOINTMENT")) {
    return (
      <span className={`${base} bg-[var(--color-primary-100)] text-[var(--color-primary-600)]`}>
        <Calendar size={16} />
      </span>
    );
  }
  if (type === "PATIENT_ADMITTED") {
    return (
      <span className={`${base} bg-[var(--color-success-100,#dcfce7)] text-[var(--color-success-600,#16a34a)]`}>
        <BedDouble size={16} />
      </span>
    );
  }
  return (
    <span className={`${base} bg-[var(--color-primary-100)] text-[var(--color-primary-600)]`}>
      <Bell size={16} />
    </span>
  );
}

// ── Single notification row ───────────────────────────────────────────────────

type NotifRow = {
  id: string;
  type: string;
  message: string;
  entityId: string | null;
  read: boolean;
  createdAt: Date;
};

function NotificationRow({ n }: { n: NotifRow }) {
  // For birthday notifications, extract patient udid from entityId: "BIRTHDAY:{udid}:{date}"
  const isBirthday = n.type === "BIRTHDAY";
  const birthdayUdid = isBirthday && n.entityId ? n.entityId.split(":")[1] : null;
  const profileHref = birthdayUdid ? `/patients/${birthdayUdid}` : null;

  return (
    <div
      className={`flex items-start gap-3 px-5 py-4 transition-colors ${
        !n.read
          ? "border-l-4 border-l-[var(--color-primary-500)] bg-[var(--color-primary-50)]/40"
          : "border-l-4 border-l-transparent"
      }`}
    >
      <NotificationIcon type={n.type} />
      <div className="flex-1 min-w-0">
        <p
          className={`text-label sm:text-sm leading-snug ${
            !n.read
              ? "font-medium text-[var(--color-ink-900)]"
              : "text-[var(--color-ink-700)]"
          }`}
        >
          {n.message}
        </p>
        <div className="flex items-center gap-3 mt-1">
          <p className="text-caption sm:text-xs text-[var(--color-ink-400)]">
            {isBirthday && n.entityId
              ? (() => {
                  const parts = n.entityId.split(":");
                  const bdayStr = parts[2];
                  return bdayStr
                    ? format(new Date(bdayStr + "T00:00:00Z"), "d MMMM yyyy")
                    : formatDistanceToNow(new Date(n.createdAt), { addSuffix: true });
                })()
              : formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
          </p>
          {profileHref && (
            <Link
              href={profileHref}
              className="text-caption sm:text-xs text-[var(--color-primary-600)] hover:underline font-medium"
            >
              View profile
            </Link>
          )}
        </div>
      </div>
      {!n.read && (
        <span className="mt-1.5 w-2 h-2 rounded-full bg-[var(--color-primary-500)] shrink-0" />
      )}
    </div>
  );
}

// ── Section heading ───────────────────────────────────────────────────────────

function SectionHeading({ label, count }: { label: string; count: number }) {
  return (
    <div className="px-5 py-2.5 bg-[var(--color-surface-sunken)] border-b border-[var(--color-border)]">
      <span className="text-caption font-bold tracking-widest text-[var(--color-ink-400)] uppercase">
        {label}
      </span>
      <span className="ml-2 text-caption text-[var(--color-ink-300)]">{count}</span>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function NotificationsPage() {
  const user = await requireUser();
  await ensureBirthdayReminders(user.id, user);

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  const todayStr = istTodayStr();

  // Group into Today / Upcoming / Earlier
  const todayNotifs: NotifRow[]    = [];
  const upcomingNotifs: NotifRow[] = [];
  const earlierNotifs: NotifRow[]  = [];

  for (const n of notifications) {
    if (n.type === "BIRTHDAY" && n.entityId) {
      const parts = n.entityId.split(":");
      const bdayStr = parts[2] ?? "";
      if (bdayStr === todayStr) {
        todayNotifs.push(n);
      } else if (bdayStr > todayStr) {
        upcomingNotifs.push(n);
      } else {
        earlierNotifs.push(n);
      }
    } else {
      const notifDateStr = isoDate(new Date(n.createdAt));
      if (notifDateStr === todayStr) {
        todayNotifs.push(n);
      } else {
        earlierNotifs.push(n);
      }
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length;
  const isEmpty = notifications.length === 0;

  return (
    <div className="fade-in max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-[var(--color-ink-900)] tracking-tight">
            Notifications
          </h1>
          {unreadCount > 0 && (
            <p className="text-label sm:text-sm text-[var(--color-ink-500)] mt-1">
              {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        {unreadCount > 0 && <MarkAllReadButton />}
      </div>

      <div className="surface-card divide-y divide-[var(--color-border)] overflow-hidden">
        {isEmpty ? (
          <div className="py-16 text-center text-[var(--color-ink-400)] text-label sm:text-sm">
            No notifications yet.
          </div>
        ) : (
          <>
            {todayNotifs.length > 0 && (
              <>
                <SectionHeading label="Today" count={todayNotifs.length} />
                {todayNotifs.map((n) => (
                  <NotificationRow key={n.id} n={n} />
                ))}
              </>
            )}

            {upcomingNotifs.length > 0 && (
              <>
                <SectionHeading label="Upcoming" count={upcomingNotifs.length} />
                {upcomingNotifs.map((n) => (
                  <NotificationRow key={n.id} n={n} />
                ))}
              </>
            )}

            {earlierNotifs.length > 0 && (
              <>
                <SectionHeading label="Earlier" count={earlierNotifs.length} />
                {earlierNotifs.map((n) => (
                  <NotificationRow key={n.id} n={n} />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
