import { prisma } from "@/lib/prisma";
import { requireRole, scopeDoctorId } from "@/lib/rbac";
import { format, subDays, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { AnalyticsDashboard, type StatusRow, type TrendPoint } from "./AnalyticsDashboard";

function pct(a: number, b: number) {
  return b === 0 ? 0 : Math.round((a / b) * 100);
}

export default async function AnalyticsPage() {
  const user = await requireRole("DOCTOR", "HOSPITAL");

  const now          = new Date();
  const todayStart   = startOfDay(now);
  const todayEnd     = endOfDay(now);
  const monthStart   = startOfMonth(now);
  const monthEnd     = endOfMonth(now);
  const lastMonStart = startOfMonth(subDays(monthStart, 1));
  const lastMonEnd   = endOfMonth(subDays(monthStart, 1));
  const day90Start   = startOfDay(subDays(now, 89));   // 90-day trend window

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
    trend90Appts,
    statusCounts,
    visitTypeCounts,
  ] = await Promise.all([
    prisma.appointment.count({ where: { ...where, dateTime: { gte: todayStart, lte: todayEnd } } }),
    prisma.appointment.count({ where: { ...where, dateTime: { gte: monthStart, lte: monthEnd } } }),
    prisma.appointment.count({ where: { ...where, dateTime: { gte: lastMonStart, lte: lastMonEnd } } }),
    prisma.patient.count({
      where: user.role === "DOCTOR"
        ? { doctorId: scopeDoctorId(user) }
        : { registeredAtId: (user as any).hospitalId },
    }),
    prisma.patient.count({
      where: {
        ...(user.role === "DOCTOR"
          ? { doctorId: scopeDoctorId(user) }
          : { registeredAtId: (user as any).hospitalId }),
        createdAt: { gte: monthStart },
      },
    }),
    prisma.investigationOrder.count({ where: { visit: { ...where }, status: { not: "REVIEWED" } } }),
    prisma.investigationOrder.count({ where: { visit: { ...where }, status: "REVIEWED" } }),
    prisma.appointment.findMany({
      where: { ...where, dateTime: { gte: day90Start, lte: todayEnd } },
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

  /* ── 90-day trend ─────────────────────────────────────────────────────── */
  const trendMap: Record<string, { total: number; completed: number }> = {};
  for (const a of trend90Appts) {
    const dk = format(new Date(a.dateTime), "yyyy-MM-dd");
    if (!trendMap[dk]) trendMap[dk] = { total: 0, completed: 0 };
    trendMap[dk].total++;
    if (a.status === "DISPENSED") trendMap[dk].completed++;
  }

  const trendPoints: TrendPoint[] = Array.from({ length: 90 }, (_, i) => {
    const d  = subDays(now, 89 - i);
    const dk = format(d, "yyyy-MM-dd");
    return {
      date:      dk,
      label:     format(d, "EEE"),
      dateLabel: format(d, "d MMM"),
      ...(trendMap[dk] ?? { total: 0, completed: 0 }),
    };
  });

  /* ── Status distribution ──────────────────────────────────────────────── */
  const statusMap: Record<string, number> = {};
  for (const s of statusCounts) statusMap[s.status] = s._count.status;
  const statusTotal = Object.values(statusMap).reduce((a, b) => a + b, 0);

  const statusRows: StatusRow[] = [
    { label: "Dispensed",   count: statusMap["DISPENSED"]   ?? 0, hex: "#10B981" },
    { label: "Confirmed",   count: statusMap["CONFIRMED"]   ?? 0, hex: "#3B82F6" },
    { label: "Requested",   count: statusMap["REQUESTED"]   ?? 0, hex: "#F59E0B" },
    { label: "Rescheduled", count: statusMap["RESCHEDULED"] ?? 0, hex: "#8B5CF6" },
    { label: "Cancelled",   count: statusMap["CANCELLED"]   ?? 0, hex: "#EF4444" },
    { label: "No Show",     count: statusMap["NO_SHOW"]     ?? 0, hex: "#94A3B8" },
  ].filter((r) => r.count > 0);

  /* ── Visit type distribution ──────────────────────────────────────────── */
  const typeRows = visitTypeCounts
    .map((v) => ({ label: v.visitType ?? "General OPD", count: v._count.visitType }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  /* ── Derived rates ────────────────────────────────────────────────────── */
  const completionRate    = pct(statusMap["DISPENSED"] ?? 0, statusTotal);
  const cancellationRate  = pct((statusMap["CANCELLED"] ?? 0) + (statusMap["NO_SHOW"] ?? 0), statusTotal);
  const monthTrend        = lastMonthAppts > 0
    ? Math.round(((thisMonthAppts - lastMonthAppts) / lastMonthAppts) * 100)
    : 0;

  const nowStr = `${format(now, "EEEE, d MMMM yyyy")}`;
  const scope  = user.role === "DOCTOR" ? "your practice" : "this hospital";

  return (
    <AnalyticsDashboard
      nowStr={nowStr}
      scope={scope}
      trendPoints={trendPoints}
      thisMonthAppts={thisMonthAppts}
      lastMonthAppts={lastMonthAppts}
      todayAppts={todayAppts}
      totalPatients={totalPatients}
      newPatientsThisMonth={newPatientsThisMonth}
      pendingInvestigations={pendingInvestigations}
      completedInvestigations={completedInvestigations}
      statusRows={statusRows}
      statusTotal={statusTotal}
      typeRows={typeRows}
      completionRate={completionRate}
      cancellationRate={cancellationRate}
      monthTrend={monthTrend}
    />
  );
}
