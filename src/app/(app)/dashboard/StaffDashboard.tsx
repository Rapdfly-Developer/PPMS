import { prisma } from "@/lib/prisma";
import { userCan } from "@/lib/rbac";
import type { SessionUser } from "@/lib/rbac";
import { istTodayRange } from "@/lib/ist";
import Link from "next/link";
import { Calendar, Users, ClipboardList } from "lucide-react";

export async function StaffDashboard({
  user,
  hospitalId,
}: {
  user: SessionUser;
  hospitalId: string;
}) {
  const { dayStart: todayStart, dayEnd: todayEnd } = istTodayRange();

  const [todayAppts, totalPatients] = await Promise.all([
    userCan(user, "appointments.view")
      ? prisma.appointment.count({
          where: { hospitalId, dateTime: { gte: todayStart, lte: todayEnd } },
        })
      : Promise.resolve(null),
    userCan(user, "patients.view")
      ? prisma.patient.count({ where: { registeredAtId: hospitalId } })
      : Promise.resolve(null),
  ]);

  const hospital = await prisma.hospital.findUnique({
    where: { id: hospitalId },
    select: { name: true },
  });

  const QUICK_LINKS = [
    { href: "/appointments", label: "Appointments", icon: Calendar, perm: "appointments.view" },
    { href: "/patients", label: "Patients", icon: Users, perm: "patients.view" },
    { href: "/queue", label: "OPD Queue", icon: ClipboardList, perm: "dashboard.view" },
  ].filter((l) => userCan(user, l.perm));

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--color-ink-900)]">
          Welcome, {user.name}
        </h1>
        <p className="text-sm text-[var(--color-ink-500)] mt-0.5">
          {user.role.charAt(0) + user.role.slice(1).toLowerCase().replace(/_/g, " ")}
          {hospital?.name ? ` · ${hospital.name}` : ""}
        </p>
      </div>

      {/* Stats */}
      {(todayAppts !== null || totalPatients !== null) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          {todayAppts !== null && (
            <div className="rounded-xl border border-[var(--color-border)] bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">Today's Appointments</p>
              <p className="text-3xl font-bold text-[var(--color-primary-700)] mt-1">{todayAppts}</p>
            </div>
          )}
          {totalPatients !== null && (
            <div className="rounded-xl border border-[var(--color-border)] bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">Total Patients</p>
              <p className="text-3xl font-bold text-[var(--color-primary-700)] mt-1">{totalPatients}</p>
            </div>
          )}
        </div>
      )}

      {/* Quick links */}
      {QUICK_LINKS.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-ink-400)] mb-3">Quick Access</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {QUICK_LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center gap-2 rounded-xl border border-[var(--color-border)] bg-white p-5 hover:border-[var(--color-primary-400)] hover:bg-[var(--color-primary-50)] transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-50)] flex items-center justify-center">
                  <Icon size={20} className="text-[var(--color-primary-600)]" />
                </div>
                <span className="text-sm font-semibold text-[var(--color-ink-800)]">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {QUICK_LINKS.length === 0 && (
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-10 text-center">
          <p className="text-sm text-[var(--color-ink-400)]">No permissions assigned yet.</p>
          <p className="text-xs text-[var(--color-ink-300)] mt-1">Ask your doctor to assign permissions to your role in Settings → Roles.</p>
        </div>
      )}
    </div>
  );
}
