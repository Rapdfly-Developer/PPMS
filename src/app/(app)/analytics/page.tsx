import { prisma } from "@/lib/prisma";
import { requireRole, scopeDoctorId } from "@/lib/rbac";
import { format, subDays, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import Link from "next/link";
import { BarChart2, TrendingUp, TrendingDown, Users, CalendarCheck, FlaskConical, Scissors, BedDouble, Clock, CheckCircle2, XCircle, RefreshCw } from "lucide-react";

/* ── helpers ──────────────────────────────────────────────────────────────── */
function pct(a: number, b: number) {
  return b === 0 ? 0 : Math.round((a / b) * 100);
}

function Bar({ value, max, color = "bg-[var(--color-primary-500)]" }: { value: number; max: number; color?: string }) {
  const w = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 flex-1">
      <div className="flex-1 h-2 rounded-full bg-[var(--color-surface-sunken)]">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${w}%` }} />
      </div>
      <span className="text-xs font-bold text-[var(--color-ink-700)] w-6 text-right tabular-nums">{value}</span>
    </div>
  );
}

function KPI({
  label, value, sub, icon, color, trend, trendLabel,
}: {
  label: string; value: string | number; sub: string;
  icon: React.ReactNode; color: string;
  trend?: number; trendLabel?: string;
}) {
  return (
    <div className="surface-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)]">{label}</p>
          <p className={`text-3xl font-bold mt-1.5 tracking-tight ${color}`}>{value}</p>
          <p className="text-xs text-[var(--color-ink-400)] mt-1">{sub}</p>
          {trend !== undefined && (
            <p className={`text-xs mt-2 font-semibold flex items-center gap-1 ${trend >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(trend)}% vs last month
            </p>
          )}
          {trendLabel && !trend && (
            <p className="text-xs mt-2 text-[var(--color-ink-400)]">{trendLabel}</p>
          )}
        </div>
        <div className={`shrink-0 p-2.5 rounded-xl ${color.replace("text-", "bg-").replace("-700", "-100").replace("-600", "-100")}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   SERVER COMPONENT
══════════════════════════════════════════════════════════════════════════════ */
export default async function AnalyticsPage() {
  const user = await requireRole("DOCTOR", "HOSPITAL");

  const now          = new Date();
  const todayStart   = startOfDay(now);
  const todayEnd     = endOfDay(now);
  const monthStart   = startOfMonth(now);
  const monthEnd     = endOfMonth(now);
  const lastMonStart = startOfMonth(subDays(monthStart, 1));
  const lastMonEnd   = endOfMonth(subDays(monthStart, 1));
  const week7Start   = startOfDay(subDays(now, 6));

  /* ── Scope filter ─────────────────────────────────────────────────────── */
  const where: Record<string, unknown> =
    user.role === "DOCTOR"
      ? { doctorId: scopeDoctorId(user) }
      : { hospitalId: (user as any).hospitalId };

  /* ── Parallel queries ─────────────────────────────────────────────────── */
  const [
    todayAppts,
    thisMonthAppts,
    lastMonthAppts,
    totalPatients,
    newPatientsThisMonth,
    pendingInvestigations,
    completedInvestigations,
    upcomingSurgeries,
    totalSurgeriesThisMonth,
    activeAdmissions,
    week7Appts,
    statusCounts,
    visitTypeCounts,
  ] = await Promise.all([
    prisma.appointment.count({ where: { ...where, dateTime: { gte: todayStart, lte: todayEnd } } }),
    prisma.appointment.count({ where: { ...where, dateTime: { gte: monthStart, lte: monthEnd } } }),
    prisma.appointment.count({ where: { ...where, dateTime: { gte: lastMonStart, lte: lastMonEnd } } }),
    prisma.patient.count({ where: user.role === "DOCTOR" ? { doctorId: scopeDoctorId(user) } : { registeredAtId: (user as any).hospitalId } }),
    prisma.patient.count({ where: { ...(user.role === "DOCTOR" ? { doctorId: scopeDoctorId(user) } : { registeredAtId: (user as any).hospitalId }), createdAt: { gte: monthStart } } }),
    prisma.investigationOrder.count({ where: { visit: { ...where }, status: { not: "REVIEWED" } } }),
    prisma.investigationOrder.count({ where: { visit: { ...where }, status: "REVIEWED" } }),
    prisma.surgicalCounselling.count({ where: { visit: { ...where }, surgeryDate: { gte: now } } }),
    prisma.surgicalCounselling.count({ where: { visit: { ...where }, surgeryDate: { gte: monthStart, lte: monthEnd } } }),
    prisma.admission.count({ where: { visit: { ...where } } }),
    prisma.appointment.findMany({
      where: { ...where, dateTime: { gte: week7Start, lte: todayEnd } },
      select: { dateTime: true, status: true },
    }),
    prisma.appointment.groupBy({
      by: ["status"],
      where: { ...where, dateTime: { gte: monthStart, lte: monthEnd } },
      _count: { status: true },
    }),
    prisma.appointment.groupBy({
      by: ["visitType"],
      where: { ...where, dateTime: { gte: monthStart, lte: monthEnd } },
      _count: { visitType: true },
    }),
  ]);

  /* ── 7-day trend ──────────────────────────────────────────────────────── */
  const trendMap: Record<string, { total: number; completed: number }> = {};
  for (const a of week7Appts) {
    const dk = format(new Date(a.dateTime), "yyyy-MM-dd");
    if (!trendMap[dk]) trendMap[dk] = { total: 0, completed: 0 };
    trendMap[dk].total++;
    if (a.status === "COMPLETED") trendMap[dk].completed++;
  }
  const trendDays = Array.from({ length: 7 }, (_, i) => {
    const d  = subDays(now, 6 - i);
    const dk = format(d, "yyyy-MM-dd");
    return { label: format(d, "EEE"), date: format(d, "d MMM"), ...( trendMap[dk] ?? { total: 0, completed: 0 }) };
  });
  const trendMax = Math.max(...trendDays.map((d) => d.total), 1);

  /* ── Status distribution ──────────────────────────────────────────────── */
  const statusMap: Record<string, number> = {};
  for (const s of statusCounts) statusMap[s.status] = s._count.status;
  const statusTotal = Object.values(statusMap).reduce((a, b) => a + b, 0);
  const statusRows = [
    { label: "Completed",  count: statusMap["COMPLETED"]  ?? 0, color: "bg-emerald-500" },
    { label: "Confirmed",  count: statusMap["CONFIRMED"]  ?? 0, color: "bg-blue-500"    },
    { label: "Requested",  count: statusMap["REQUESTED"]  ?? 0, color: "bg-amber-500"   },
    { label: "Cancelled",  count: statusMap["CANCELLED"]  ?? 0, color: "bg-red-500"     },
    { label: "No Show",    count: statusMap["NO_SHOW"]    ?? 0, color: "bg-slate-400"   },
    { label: "Rescheduled",count: statusMap["RESCHEDULED"]?? 0, color: "bg-purple-500"  },
  ].filter((r) => r.count > 0);

  /* ── Visit type distribution ──────────────────────────────────────────── */
  const typeRows = visitTypeCounts
    .map((v) => ({ label: v.visitType ?? "General OPD", count: v._count.visitType }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  const typeMax = Math.max(...typeRows.map((r) => r.count), 1);
  const TYPE_COLORS = ["bg-[var(--color-primary-500)]", "bg-emerald-500", "bg-amber-500", "bg-purple-500", "bg-rose-500", "bg-blue-500"];

  /* ── Month trend ──────────────────────────────────────────────────────── */
  const monthTrend = lastMonthAppts > 0
    ? Math.round(((thisMonthAppts - lastMonthAppts) / lastMonthAppts) * 100)
    : 0;

  /* ── Completion rate ──────────────────────────────────────────────────── */
  const completionRate = pct(statusMap["COMPLETED"] ?? 0, statusTotal);
  const cancellationRate = pct((statusMap["CANCELLED"] ?? 0) + (statusMap["NO_SHOW"] ?? 0), statusTotal);

  return (
    <div className="fade-in space-y-6 max-w-6xl">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-[var(--color-ink-400)] text-xs mb-1">
            <Link href="/dashboard" className="hover:text-[var(--color-primary-600)]">Dashboard</Link>
            <span>/</span>
            <span className="text-[var(--color-ink-700)] font-medium">Analytics</span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-ink-900)] flex items-center gap-2.5">
            <BarChart2 size={22} className="text-[var(--color-primary-600)]" />
            Analytics & Reports
          </h1>
          <p className="text-sm text-[var(--color-ink-400)] mt-1">
            {format(now, "EEEE, d MMMM yyyy")} · Data for {user.role === "DOCTOR" ? "your practice" : "this hospital"}
          </p>
        </div>
      </div>

      {/* ── KPI row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI
          label="This Month"
          value={thisMonthAppts}
          sub="total appointments"
          icon={<CalendarCheck size={18} />}
          color="text-[var(--color-primary-700)]"
          trend={monthTrend}
        />
        <KPI
          label="Today"
          value={todayAppts}
          sub="appointments scheduled"
          icon={<Clock size={18} />}
          color="text-blue-700"
          trendLabel={`${format(now, "EEE, d MMM")}`}
        />
        <KPI
          label="Total Patients"
          value={totalPatients}
          sub={`${newPatientsThisMonth} new this month`}
          icon={<Users size={18} />}
          color="text-emerald-700"
        />
        <KPI
          label="Pending Tests"
          value={pendingInvestigations}
          sub={`${completedInvestigations} completed`}
          icon={<FlaskConical size={18} />}
          color="text-amber-700"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI
          label="Completion Rate"
          value={`${completionRate}%`}
          sub="appointments completed"
          icon={<CheckCircle2 size={18} />}
          color="text-emerald-700"
        />
        <KPI
          label="Cancellation Rate"
          value={`${cancellationRate}%`}
          sub="cancelled or no-show"
          icon={<XCircle size={18} />}
          color="text-red-600"
        />
        <KPI
          label="Upcoming Surgeries"
          value={upcomingSurgeries}
          sub={`${totalSurgeriesThisMonth} this month`}
          icon={<Scissors size={18} />}
          color="text-purple-700"
        />
        <KPI
          label="IPD Admissions"
          value={activeAdmissions}
          sub="total recorded"
          icon={<BedDouble size={18} />}
          color="text-[var(--color-primary-700)]"
        />
      </div>

      {/* ── 7-Day Trend ────────────────────────────────────────────────── */}
      <div className="surface-card p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-ink-900)]">7-Day Appointment Trend</h2>
            <p className="text-xs text-[var(--color-ink-400)] mt-0.5">
              Total vs completed · Peak: {Math.max(...trendDays.map((d) => d.total))} ·
              Avg: {Math.round(trendDays.reduce((s, d) => s + d.total, 0) / 7)}/day
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[var(--color-primary-500)]" /> Total</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500" /> Completed</span>
          </div>
        </div>
        <div className="flex items-end gap-2 h-40">
          {trendDays.map((d) => {
            const totalH = trendMax > 0 ? Math.round((d.total / trendMax) * 100) : 0;
            const doneH  = trendMax > 0 ? Math.round((d.completed / trendMax) * 100) : 0;
            return (
              <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] font-semibold text-[var(--color-ink-600)]">{d.total > 0 ? d.total : ""}</span>
                <div className="w-full flex items-end gap-0.5" style={{ height: 100 }}>
                  <div
                    className="flex-1 rounded-t-md bg-[var(--color-primary-200)] transition-all"
                    style={{ height: `${totalH}%`, minHeight: d.total > 0 ? 4 : 0 }}
                  />
                  <div
                    className="flex-1 rounded-t-md bg-emerald-500 transition-all"
                    style={{ height: `${doneH}%`, minHeight: d.completed > 0 ? 4 : 0 }}
                  />
                </div>
                <span className="text-[10px] font-medium text-[var(--color-ink-400)]">{d.label}</span>
                <span className="text-[9px] text-[var(--color-ink-300)]">{d.date}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Status + Visit Types ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Status distribution */}
        <div className="surface-card p-6">
          <h2 className="text-base font-semibold text-[var(--color-ink-900)] mb-1">Appointment Status</h2>
          <p className="text-xs text-[var(--color-ink-400)] mb-5">This month · {statusTotal} total</p>
          {statusRows.length === 0 ? (
            <p className="text-sm text-[var(--color-ink-400)] py-6 text-center">No data yet.</p>
          ) : (
            <div className="space-y-3">
              {statusRows.map((r) => (
                <div key={r.label} className="flex items-center gap-3">
                  <span className="text-xs text-[var(--color-ink-600)] w-24 shrink-0">{r.label}</span>
                  <Bar value={r.count} max={statusTotal} color={r.color} />
                  <span className="text-[10px] text-[var(--color-ink-400)] w-8 text-right shrink-0">{pct(r.count, statusTotal)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Visit type distribution */}
        <div className="surface-card p-6">
          <h2 className="text-base font-semibold text-[var(--color-ink-900)] mb-1">Visit Types</h2>
          <p className="text-xs text-[var(--color-ink-400)] mb-5">This month · top 6</p>
          {typeRows.length === 0 ? (
            <p className="text-sm text-[var(--color-ink-400)] py-6 text-center">No data yet.</p>
          ) : (
            <div className="space-y-3">
              {typeRows.map((r, idx) => (
                <div key={r.label} className="flex items-center gap-3">
                  <span className="text-xs text-[var(--color-ink-600)] w-28 shrink-0 truncate capitalize">{r.label}</span>
                  <Bar value={r.count} max={typeMax} color={TYPE_COLORS[idx % TYPE_COLORS.length]} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Monthly summary table ───────────────────────────────────────── */}
      <div className="surface-card p-6">
        <h2 className="text-base font-semibold text-[var(--color-ink-900)] mb-1">Monthly Summary</h2>
        <p className="text-xs text-[var(--color-ink-400)] mb-5">{format(monthStart, "MMMM yyyy")} · key metrics at a glance</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                {["Metric", "This Month", "Last Month", "Change"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {[
                { metric: "Total Appointments", cur: thisMonthAppts, prev: lastMonthAppts },
                { metric: "Completed",          cur: statusMap["COMPLETED"] ?? 0, prev: null },
                { metric: "Cancellations",      cur: (statusMap["CANCELLED"] ?? 0) + (statusMap["NO_SHOW"] ?? 0), prev: null },
                { metric: "New Patients",        cur: newPatientsThisMonth, prev: null },
                { metric: "Surgeries",           cur: totalSurgeriesThisMonth, prev: null },
                { metric: "Pending Tests",       cur: pendingInvestigations, prev: null },
              ].map((row) => {
                const diff = row.prev !== null ? row.cur - row.prev : null;
                return (
                  <tr key={row.metric} className="hover:bg-[var(--color-surface-sunken)] transition-colors">
                    <td className="px-4 py-3 font-medium text-[var(--color-ink-800)]">{row.metric}</td>
                    <td className="px-4 py-3 font-bold text-[var(--color-ink-900)]">{row.cur}</td>
                    <td className="px-4 py-3 text-[var(--color-ink-500)]">{row.prev ?? "—"}</td>
                    <td className="px-4 py-3">
                      {diff !== null ? (
                        <span className={`text-xs font-semibold ${diff > 0 ? "text-emerald-600" : diff < 0 ? "text-red-500" : "text-[var(--color-ink-400)]"}`}>
                          {diff > 0 ? "+" : ""}{diff}
                        </span>
                      ) : (
                        <span className="text-[var(--color-ink-300)] text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Investigations breakdown ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="surface-card p-6">
          <h2 className="text-base font-semibold text-[var(--color-ink-900)] mb-1">Investigation Summary</h2>
          <p className="text-xs text-[var(--color-ink-400)] mb-5">All time · ordered tests</p>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Pending Review", value: pendingInvestigations, color: "text-amber-700", bg: "bg-amber-50 border border-amber-200" },
              { label: "Completed",      value: completedInvestigations, color: "text-emerald-700", bg: "bg-emerald-50 border border-emerald-200" },
            ].map((s) => (
              <div key={s.label} className={`rounded-xl p-4 ${s.bg}`}>
                <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs font-medium text-[var(--color-ink-500)] mt-1">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-[var(--color-ink-500)] mb-1.5">
              <span>Completion rate</span>
              <span className="font-semibold">{pct(completedInvestigations, pendingInvestigations + completedInvestigations)}%</span>
            </div>
            <div className="h-2 rounded-full bg-[var(--color-surface-sunken)]">
              <div
                className="h-2 rounded-full bg-emerald-500"
                style={{ width: `${pct(completedInvestigations, pendingInvestigations + completedInvestigations)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="surface-card p-6">
          <h2 className="text-base font-semibold text-[var(--color-ink-900)] mb-1">Surgical Activity</h2>
          <p className="text-xs text-[var(--color-ink-400)] mb-5">Surgeries counselled &amp; scheduled</p>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "This Month",  value: totalSurgeriesThisMonth, color: "text-purple-700", bg: "bg-purple-50 border border-purple-200" },
              { label: "Upcoming",    value: upcomingSurgeries,        color: "text-[var(--color-primary-700)]", bg: "bg-[var(--color-primary-50)] border border-[var(--color-primary-200)]" },
            ].map((s) => (
              <div key={s.label} className={`rounded-xl p-4 ${s.bg}`}>
                <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs font-medium text-[var(--color-ink-500)] mt-1">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-[var(--color-ink-500)]">
            <RefreshCw size={12} />
            <span>IPD admissions recorded: <strong className="text-[var(--color-ink-800)]">{activeAdmissions}</strong></span>
          </div>
        </div>
      </div>

    </div>
  );
}
