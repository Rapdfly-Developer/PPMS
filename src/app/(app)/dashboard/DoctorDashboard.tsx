import { prisma } from "@/lib/prisma";
import { LiveClock } from "@/components/ui/LiveClock";
import {
  Scissors, BedDouble, ArrowRight, AlertTriangle,
  Activity, Stethoscope, Eye, FileText, Calendar, Users, BarChart2,
  Clock, CheckCircle2, RefreshCw, Zap, Bell, FlaskConical,
  HeartPulse, ChevronRight, Plus, ClipboardList,
} from "lucide-react";
import Link from "next/link";
import {
  format, differenceInDays,
  subDays, startOfDay, endOfDay,
} from "date-fns";
import type { SessionUser } from "@/lib/rbac";

// ── Avatar helpers ──────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  { bg: "#DCEFEC", text: "#115E59" }, { bg: "#DBEAFE", text: "#1D4ED8" },
  { bg: "#DCFCE7", text: "#15803D" }, { bg: "#FEE2E2", text: "#B91C1C" },
  { bg: "#EDE9FE", text: "#7C3AED" }, { bg: "#FCE7F3", text: "#DB2777" },
  { bg: "#FEF3C7", text: "#B45309" }, { bg: "#E0F2FE", text: "#0369A1" },
];
function avatarColor(name: string) { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]; }
function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

// ── KPI card ────────────────────────────────────────────────────────────────

function KpiCard({
  href, icon, label, value, sub, iconBg, cardBg, accent,
}: {
  href: string; icon: React.ReactNode; label: string; value: number | string;
  sub: string; iconBg: string; cardBg: string; accent: string;
}) {
  return (
    <Link href={href}
      className={`group relative overflow-hidden rounded-2xl border p-4 flex flex-col gap-2 hover:shadow-md transition-all duration-200 ${cardBg}`}
    >
      <div className="flex items-start justify-between">
        <div className={`rounded-xl p-2.5 ${iconBg}`}>{icon}</div>
        <ArrowRight size={13} className={`mt-1 opacity-30 group-hover:opacity-70 group-hover:translate-x-0.5 transition-all ${accent}`} />
      </div>
      <div>
        <div className={`text-2xl font-bold leading-none mb-1 ${accent}`}>{value}</div>
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-ink-400)]">{label}</p>
        <p className={`text-xs mt-0.5 ${accent} opacity-70`}>{sub}</p>
      </div>
    </Link>
  );
}

// ── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, action, actionHref, right, children }: {
  title: string; action?: string; actionHref?: string;
  right?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="surface-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2.5">
        <h2 className="text-sm font-semibold text-[var(--color-ink-900)]">{title}</h2>
        {right}
        {action && actionHref && (
          <Link href={actionHref}
            className="flex items-center gap-1 text-xs font-medium text-[var(--color-primary-600)] hover:underline"
          >
            {action} <ArrowRight size={11} />
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-[var(--color-ink-400)]">
      <ClipboardList size={24} className="mb-2 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );
}


// ── Ward label ───────────────────────────────────────────────────────────────

function wardLabel(w: string) {
  const m: Record<string, string> = {
    MALE_WARD: "General Ward", FEMALE_WARD: "General Ward",
    PRE_OP: "Pre-Op", POST_OP: "Post-Op", GENERAL: "General", PRIVATE: "Private",
  };
  return m[w] ?? w.replace(/_/g, " ");
}


// ── 7-day trend bar ──────────────────────────────────────────────────────────

function TrendBar({ days }: { days: { label: string; count: number }[] }) {
  const max = Math.max(...days.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-1.5 h-20">
      {days.map((d, i) => {
        const pct = (d.count / max) * 100;
        const isToday = i === days.length - 1;
        return (
          <div key={i} className="flex flex-col items-center gap-1 flex-1">
            <span className={`text-[9px] font-bold ${isToday ? "text-[var(--color-primary-600)]" : "text-[var(--color-ink-400)]"}`}>
              {d.count > 0 ? d.count : ""}
            </span>
            <div
              className={`w-full rounded-t-md ${isToday ? "bg-[var(--color-primary-500)]" : "bg-[var(--color-primary-200)]"}`}
              style={{ height: `${Math.max(pct, 8)}%` }}
              title={`${d.count} patients`}
            />
            <span className={`text-[9px] font-medium ${isToday ? "text-[var(--color-primary-600)]" : "text-[var(--color-ink-400)]"}`}>
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Queue status badge ───────────────────────────────────────────────────────

function QueueBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    CONFIRMED: { label: "Waiting",   cls: "bg-amber-100 text-amber-700" },
    COMPLETED: { label: "Done",      cls: "bg-emerald-100 text-emerald-700" },
    CANCELLED: { label: "Cancelled", cls: "bg-red-100 text-red-700" },
    NO_SHOW:   { label: "No-show",   cls: "bg-slate-100 text-slate-500" },
    REQUESTED: { label: "Pending",   cls: "bg-blue-100 text-blue-700" },
  };
  const s = map[status] ?? { label: status, cls: "bg-slate-100 text-slate-600" };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${s.cls}`}>
      {s.label}
    </span>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export async function DoctorDashboard({
  user, doctorId, tab,
}: {
  user: SessionUser; doctorId: string; tab?: string;
}) {
  const now          = new Date();
  const startOfToday = startOfDay(now);
  const endOfToday   = endOfDay(now);
  const sevenDaysOut = new Date(now); sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const [
    todayAppts,
    completedToday,
    followUpsToday,
    emergencyToday,
    activeAdmissions,
    todaySurgeries,
    thisMonthVisits,
    lastMonthVisits,
    pendingInvestigations,
    upcomingSurgeriesCount,
    trendDays,
  ] = await Promise.all([
    prisma.appointment.findMany({
      where: { doctorId, dateTime: { gte: startOfToday, lte: endOfToday } },
      include: { patient: true, hospital: { select: { name: true } } },
      orderBy: { dateTime: "asc" },
    }),
    prisma.appointment.count({
      where: { doctorId, dateTime: { gte: startOfToday, lte: endOfToday }, status: "COMPLETED" },
    }),
    prisma.appointment.count({
      where: {
        doctorId, dateTime: { gte: startOfToday, lte: endOfToday },
        visitType: { contains: "follow", mode: "insensitive" },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
      },
    }),
    prisma.appointment.count({
      where: {
        doctorId, dateTime: { gte: startOfToday, lte: endOfToday },
        visitType: { contains: "emerg", mode: "insensitive" },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
      },
    }),
    prisma.admission.findMany({
      where: { visit: { doctorId } },
      include: { visit: { include: { patient: true, surgicalCounselling: true } } },
      orderBy: { createdAt: "asc" },
      take: 5,
    }),
    prisma.surgicalCounselling.findMany({
      where: { visit: { doctorId }, surgeryDate: { gte: startOfToday, lte: endOfToday } },
      include: { visit: { include: { patient: true } } },
      orderBy: { surgeryDate: "asc" },
    }),
    prisma.visit.count({ where: { doctorId, date: { gte: startOfMonth } } }),
    prisma.visit.count({ where: { doctorId, date: { gte: startOfLastMonth, lte: endOfLastMonth } } }),
    prisma.investigationOrder.count({ where: { visit: { doctorId }, status: { not: "REVIEWED" } } }),
    prisma.surgicalCounselling.count({
      where: { visit: { doctorId }, surgeryDate: { gte: startOfToday, lte: sevenDaysOut } },
    }),
    Promise.all(
      Array.from({ length: 7 }, (_, i) => {
        const d = subDays(now, 6 - i);
        return prisma.appointment.count({
          where: { doctorId, dateTime: { gte: startOfDay(d), lte: endOfDay(d) }, status: "COMPLETED" },
        }).then((count) => ({
          label: i === 6 ? "Today" : DAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1],
          count,
        }));
      })
    ),
  ]);

  const waitingPatients = todayAppts.filter((a) => a.status === "CONFIRMED");
  const totalToday      = todayAppts.filter((a) => a.status !== "CANCELLED" && a.status !== "NO_SHOW").length;
  const monthTrend      = lastMonthVisits > 0
    ? Math.round(((thisMonthVisits - lastMonthVisits) / lastMonthVisits) * 100)
    : 0;

  return (
    <div className="space-y-4">

      {/* ── Hero header ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden relative"
        style={{ background: "linear-gradient(135deg, #0F4C75 0%, #1B6CA8 50%, #118A7E 100%)" }}
      >
        <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle at 70% 50%, #fff 0%, transparent 60%)" }}
        />
        <div className="relative px-5 py-4 sm:px-7 sm:py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <HeartPulse size={14} className="text-emerald-300" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">Doctor Dashboard</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">
              Good {now.getHours() < 12 ? "morning" : now.getHours() < 17 ? "afternoon" : "evening"}, Dr. {user.name.split(" ")[0]}
            </h1>
            <p className="text-sm text-blue-200 mt-0.5">
              {format(now, "EEEE, MMMM d, yyyy")} · {totalToday} patient{totalToday !== 1 ? "s" : ""} scheduled today
            </p>
          </div>
          <div className="flex items-center gap-3">
            <LiveClock />
            <Link href="/emr"
              className="flex items-center gap-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
            >
              <Plus size={14} /> New Visit
            </Link>
          </div>
        </div>
      </div>

      {/* ── KPI cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <KpiCard
          href="/appointments"
          icon={<Calendar size={18} className="text-blue-600" />}
          label="Today's Appointments"
          value={totalToday}
          sub={`${waitingPatients.length} still waiting`}
          iconBg="bg-blue-100"
          cardBg="bg-blue-50 border-blue-100"
          accent="text-blue-700"
        />
        <KpiCard
          href="/appointments"
          icon={<Clock size={18} className="text-amber-600" />}
          label="Waiting Patients"
          value={waitingPatients.length}
          sub="confirmed, not seen yet"
          iconBg="bg-amber-100"
          cardBg="bg-amber-50 border-amber-100"
          accent="text-amber-700"
        />
        <KpiCard
          href="/emr"
          icon={<CheckCircle2 size={18} className="text-emerald-600" />}
          label="Completed"
          value={completedToday}
          sub="consultations today"
          iconBg="bg-emerald-100"
          cardBg="bg-emerald-50 border-emerald-100"
          accent="text-emerald-700"
        />
        <KpiCard
          href="/appointments"
          icon={<RefreshCw size={18} className="text-[var(--color-primary-600)]" />}
          label="Follow-ups"
          value={followUpsToday}
          sub="follow-up visits today"
          iconBg="bg-[var(--color-primary-100)]"
          cardBg="bg-[var(--color-primary-50)] border-[var(--color-primary-100)]"
          accent="text-[var(--color-primary-700)]"
        />
        <KpiCard
          href="/appointments"
          icon={<Zap size={18} className="text-rose-600" />}
          label="Emergency Cases"
          value={emergencyToday}
          sub="emergency today"
          iconBg="bg-rose-100"
          cardBg="bg-rose-50 border-rose-100"
          accent="text-rose-700"
        />
      </div>

      <div className="space-y-4">

          {/* Main 2-col layout */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">

            {/* Left — 3 cols */}
            <div className="lg:col-span-3 space-y-4">

              {/* Patient Queue Tracker */}
              <Section
                title="Patient Queue"
                action="All appointments"
                actionHref="/appointments"
                right={
                  <span className="flex items-center gap-1.5 text-[10px] text-amber-600 font-semibold mr-3">
                    <span className="inline-block size-1.5 rounded-full bg-amber-500 animate-pulse" />
                    {waitingPatients.length} waiting
                  </span>
                }
              >
                {waitingPatients.length === 0 ? (
                  <Empty message="No patients waiting in queue." />
                ) : (
                  <ul className="divide-y divide-[var(--color-border)]">
                    {waitingPatients.slice(0, 8).map((appt, idx) => {
                      const av = avatarColor(appt.patient.name);
                      const isNext = idx === 0;
                      return (
                        <li key={appt.id}
                          className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                            isNext ? "bg-[var(--color-primary-50)]" : "hover:bg-[var(--color-surface-sunken)]"
                          }`}
                        >
                          <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                            isNext
                              ? "border-[var(--color-primary-500)] bg-[var(--color-primary-500)] text-white"
                              : "border-[var(--color-border)] text-[var(--color-ink-400)]"
                          }`}>
                            {idx + 1}
                          </div>
                          <div className="size-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                            style={{ background: av.bg, color: av.text }}
                          >
                            {initials(appt.patient.name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm text-[var(--color-ink-900)] truncate">{appt.patient.name}</p>
                              {isNext && (
                                <span className="text-[9px] font-bold uppercase tracking-wider bg-[var(--color-primary-100)] text-[var(--color-primary-700)] px-2 py-0.5 rounded-full shrink-0">
                                  Next
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[var(--color-ink-400)]">
                              {appt.patient.udid} · {appt.patient.age}y {appt.patient.sex} · {appt.visitType ?? "General"}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-xs font-mono font-semibold text-[var(--color-ink-700)]">
                              {format(appt.dateTime, "hh:mm aa")}
                            </p>
                            <Link href="/emr"
                              className="text-[10px] font-medium text-[var(--color-primary-600)] hover:underline"
                            >
                              Start visit →
                            </Link>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Section>


            </div>

            {/* Right — 2 cols */}
            <div className="lg:col-span-2 space-y-4">

              {/* Today's Surgeries */}
              <Section title="Today's Surgeries" action="IPD →" actionHref="/ipd">
                {todaySurgeries.length === 0 ? (
                  <Empty message="No surgeries scheduled for today." />
                ) : (
                  <ul className="divide-y divide-[var(--color-border)]">
                    {todaySurgeries.map((s) => {
                      const av = avatarColor(s.visit.patient.name);
                      return (
                        <li key={s.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--color-surface-sunken)] transition-colors">
                          <div className="size-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                            style={{ background: av.bg, color: av.text }}
                          >
                            {initials(s.visit.patient.name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-[var(--color-ink-900)]">{s.visit.patient.name}</p>
                            <p className="text-xs text-[var(--color-ink-400)] mt-0.5">
                              {(s as any).surgeryType ?? "Surgery"}{s.surgeryDate ? ` · ${format(new Date(s.surgeryDate), "hh:mm a")}` : ""}
                            </p>
                          </div>
                          <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">Today</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Section>

            </div>
          </div>

          {/* ── IPD Patients + This Week — 50/50 ─────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

            <Section title="My IPD Patients" action="IPD →" actionHref="/ipd"
              right={<span className="text-xs text-[var(--color-ink-400)] mr-3">Dr. {user.name}</span>}
            >
              {activeAdmissions.length === 0 ? (
                <Empty message="No admitted patients." />
              ) : (
                <ul className="divide-y divide-[var(--color-border)]">
                  {activeAdmissions.map((a) => {
                    const dayIn   = differenceInDays(now, new Date(a.createdAt)) + 1;
                    const surgery = a.visit.surgicalCounselling;
                    const statusLabel = dayIn <= 1 ? "Admitted" : dayIn <= 3 ? "Stable" : "Post-Op";
                    const statusCls   = dayIn <= 1
                      ? "bg-blue-100 text-blue-700"
                      : dayIn <= 3
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-purple-100 text-purple-700";
                    const av = avatarColor(a.visit.patient.name);
                    return (
                      <li key={a.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--color-surface-sunken)] transition-colors">
                        <div className="size-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                          style={{ background: av.bg, color: av.text }}
                        >
                          {initials(a.visit.patient.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-[var(--color-ink-900)]">{a.visit.patient.name}</p>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusCls}`}>{statusLabel}</span>
                          </div>
                          <p className="text-xs text-[var(--color-ink-400)] mt-0.5">
                            {surgery?.surgeryType ?? a.reason}
                          </p>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <p className="text-xs font-semibold text-[var(--color-ink-700)]">{wardLabel(a.ward)}</p>
                          <p className="text-[11px] text-[var(--color-ink-400)]">Day {dayIn}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>

            <Section title="This Week" action="Full analytics →" actionHref="/analytics">
              <div className="px-4 py-4">
                <TrendBar days={trendDays} />
                <p className="text-[11px] text-[var(--color-ink-400)] mt-2">
                  Completed consultations — last 7 days
                </p>
              </div>
            </Section>

          </div>

        </div>

    </div>
  );
}
