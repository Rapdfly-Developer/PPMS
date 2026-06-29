import { prisma } from "@/lib/prisma";
import { format, subDays } from "date-fns";
import Link from "next/link";
import {
  CalendarDays, Clock, CheckCircle2, UserCheck, TrendingUp, Wallet,
} from "lucide-react";
import type { SessionUser } from "@/lib/rbac";
import { LiveClock } from "@/components/ui/LiveClock";
import {
  DashboardSchedule, DashboardCharts,
  type ScheduleAppt, type TrendPoint, type StatusPoint,
} from "./DashboardClient";

/* ── helpers ──────────────────────────────────────────────────────────── */
function greet(name: string) {
  const h = new Date().getHours();
  const prefix = h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening";
  return `${prefix}, ${name.split(" ")[0]}`;
}

/* ══════════════════════════════════════════════════════════════════════════
   Server component
══════════════════════════════════════════════════════════════════════════ */
export async function HospitalDashboard({
  user,
  hospitalId,
}: {
  user: SessionUser;
  hospitalId: string;
}) {
  /* ── Date boundaries ────────────────────────────────────────────────── */
  const now      = new Date();
  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
  const dayEnd   = new Date(now); dayEnd.setHours(23, 59, 59, 999);
  const weekStart = new Date(subDays(now, 6)); weekStart.setHours(0, 0, 0, 0);

  /* ── Parallel DB fetches ────────────────────────────────────────────── */
  const [
    todayAppts,
    pendingAppts,
    hospital,
    newPatientsToday,
    totalPatients,
    todayVisits,
    weekAppts,
  ] = await Promise.all([
    /* All today's appointments */
    prisma.appointment.findMany({
      where: { hospitalId, dateTime: { gte: dayStart, lte: dayEnd } },
      include: {
        patient: { select: { name: true, udid: true, age: true, sex: true, mobile: true } },
        doctor:  { select: { name: true, specialty: true } },
      },
      orderBy: { dateTime: "asc" },
    }),

    /* Pending (any date) for notifications */
    prisma.appointment.findMany({
      where: { hospitalId, status: "REQUESTED" },
      include: { patient: { select: { name: true, udid: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),

    /* Hospital info */
    prisma.hospital.findUnique({ where: { id: hospitalId } }),

    /* New patients registered today */
    prisma.patient.count({ where: { registeredAtId: hospitalId, createdAt: { gte: dayStart } } }),

    /* Total registered */
    prisma.patient.count({ where: { registeredAtId: hospitalId } }),

    /* Today's visits for flow tracker */
    prisma.visit.findMany({
      where: { hospitalId, date: { gte: dayStart, lte: dayEnd } },
      select: { status: true, sentToPharmacy: true },
    }),

    /* Last 7 days for trend chart */
    prisma.appointment.findMany({
      where: { hospitalId, dateTime: { gte: weekStart, lte: dayEnd } },
      select: { dateTime: true, status: true },
    }),
  ]);

  /* ── Derived KPIs ───────────────────────────────────────────────────── */
  const totalToday     = todayAppts.length;
  const waitingCount   = todayAppts.filter((a) => a.status === "CONFIRMED" && !a.isWalkIn).length;
  const checkedInCount = todayAppts.filter((a) => a.status === "CONFIRMED" && (a as any).isWalkIn).length;
  const completedToday = todayAppts.filter((a) => a.status === "COMPLETED").length;
  const cancelledToday = todayAppts.filter((a) => a.status === "CANCELLED").length;
  const pendingCount   = pendingAppts.length;

  /* ── 7-day trend ────────────────────────────────────────────────────── */
  const trendMap: Record<string, number> = {};
  for (const a of weekAppts) {
    const dk = format(new Date(a.dateTime), "yyyy-MM-dd");
    trendMap[dk] = (trendMap[dk] ?? 0) + 1;
  }
  const trend: TrendPoint[] = Array.from({ length: 7 }, (_, i) => {
    const d   = subDays(now, 6 - i);
    const dk  = format(d, "yyyy-MM-dd");
    return { date: dk, label: format(d, "EEE"), count: trendMap[dk] ?? 0 };
  });

  /* ── Status distribution ────────────────────────────────────────────── */
  const statusDist: StatusPoint[] = [
    { label: "Confirmed",   count: waitingCount,   bar: "bg-emerald-500", dot: "bg-emerald-500" },
    { label: "Requested",   count: pendingCount,   bar: "bg-amber-400",   dot: "bg-amber-400"   },
    { label: "Completed",   count: completedToday, bar: "bg-[var(--color-primary-600)]", dot: "bg-[var(--color-primary-600)]" },
    { label: "Walk-ins",    count: checkedInCount, bar: "bg-blue-500",    dot: "bg-blue-500"    },
    { label: "Cancelled",   count: cancelledToday, bar: "bg-red-400",     dot: "bg-red-400"     },
  ];

  /* ── Serialisable schedule rows ─────────────────────────────────────── */
  const scheduleRows: ScheduleAppt[] = todayAppts.map((a) => ({
    id:        a.id,
    dateTime:  a.dateTime.toISOString(),
    status:    a.status,
    isWalkIn:  (a as any).isWalkIn ?? false,
    visitType: (a as any).visitType ?? "General OPD",
    patient:   { name: a.patient.name, udid: a.patient.udid, age: a.patient.age, sex: a.patient.sex, mobile: a.patient.mobile },
    doctor:    a.doctor ? { name: a.doctor.name, specialty: a.doctor.specialty } : null,
  }));

  /* ── KPI card definition ────────────────────────────────────────────── */
  const kpis = [
    {
      label: "Today's Appointments", value: totalToday,
      sub: `${completedToday} completed`,
      icon: <CalendarDays size={20} />,
      iconBg: "bg-[var(--color-primary-100)] text-[var(--color-primary-700)]",
      valueCls: "text-[var(--color-primary-700)]",
      href: "/appointments",
    },
    {
      label: "Waiting Patients", value: waitingCount,
      sub: "Confirmed, not yet seen",
      icon: <Clock size={20} />,
      iconBg: "bg-amber-100 text-amber-700",
      valueCls: "text-amber-700",
      href: "/appointments?status=CONFIRMED",
    },
    {
      label: "Checked-In (Walk-in)", value: checkedInCount,
      sub: "Walk-in patients at desk",
      icon: <UserCheck size={20} />,
      iconBg: "bg-blue-100 text-blue-700",
      valueCls: "text-blue-700",
      href: "/appointments",
    },
    {
      label: "Pending Requests", value: pendingCount,
      sub: "Awaiting your confirmation",
      icon: <TrendingUp size={20} />,
      iconBg: "bg-[var(--color-danger-100)] text-[var(--color-danger-600)]",
      valueCls: "text-[var(--color-danger-600)]",
      href: "/appointments?status=REQUESTED",
    },
    {
      label: "Completed Consultations", value: completedToday,
      sub: "Today's finished visits",
      icon: <CheckCircle2 size={20} />,
      iconBg: "bg-[var(--color-success-100)] text-[var(--color-success-600)]",
      valueCls: "text-[var(--color-success-600)]",
      href: "/appointments?status=COMPLETED",
    },
  ];

  /* ══════════════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════════════ */
  return (
    <div className="fade-in space-y-5">

      {/* ── Hero greeting card ─────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-6 md:p-8 overflow-hidden relative"
        style={{ background: "linear-gradient(135deg, var(--color-primary-700) 0%, var(--color-primary-500) 60%, #2BA89C 100%)" }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-10 -right-10 w-52 h-52 rounded-full opacity-10 bg-white" />
        <div className="absolute -bottom-8 right-24 w-36 h-36 rounded-full opacity-10 bg-white" />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Left */}
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white/20 text-white/90 px-3 py-1 rounded-full mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
              {hospital?.name ?? "Hospital"}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              {greet(user.name)}
            </h1>
            <p className="text-sm text-white/70 mt-1">
              {format(now, "EEEE, d MMMM yyyy")} · Today you have{" "}
              <span className="text-white font-semibold">{totalToday} appointment{totalToday !== 1 ? "s" : ""}</span>
            </p>
          </div>

          {/* Right: live clock */}
          <LiveClock />
        </div>

      </div>

      {/* ── KPI cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((kpi) => (
          <Link key={kpi.label} href={kpi.href} className="block group">
            <div className="surface-card p-5 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[var(--shadow-lifted)]">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">{kpi.label}</p>
                  <p className={`text-3xl font-bold mt-1.5 tracking-tight ${kpi.valueCls}`}>{kpi.value}</p>
                  <p className="text-xs text-[var(--color-ink-400)] mt-1">{kpi.sub}</p>
                </div>
                <div className={`shrink-0 p-3 rounded-2xl ${kpi.iconBg}`}>
                  {kpi.icon}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Schedule ───────────────────────────────────────────────────── */}
      <div className="surface-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-ink-900)]">Today's Schedule</h2>
            <p className="text-xs text-[var(--color-ink-400)] mt-0.5">{totalToday} appointments · {format(now, "d MMM yyyy")}</p>
          </div>
          <Link
            href="/appointments"
            className="text-xs font-semibold text-[var(--color-primary-600)] hover:text-[var(--color-primary-800)] hover:underline"
          >
            View all →
          </Link>
        </div>
        <DashboardSchedule appointments={scheduleRows} />
      </div>

      {/* ── Charts row ─────────────────────────────────────────────────── */}
      <DashboardCharts trend={trend} statusDist={statusDist} />
    </div>
  );
}
