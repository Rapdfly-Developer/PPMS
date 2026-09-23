"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BarChart2, TrendingUp, TrendingDown, Users, CalendarCheck,
  FlaskConical, CheckCircle2, XCircle, Clock, Download,
  ArrowRight, Activity, Lightbulb, AlertCircle,
} from "lucide-react";

/* ═══ Types ═══════════════════════════════════════════════════════════════ */
export interface TrendPoint {
  date: string;
  label: string;
  dateLabel: string;
  total: number;
  completed: number;
}

export interface StatusRow {
  label: string;
  count: number;
  hex: string;
}

export interface TypeRow {
  label: string;
  count: number;
}

export interface AnalyticsProps {
  nowStr: string;
  scope: string;
  trendPoints: TrendPoint[];  // 90 days, newest last
  thisMonthAppts: number;
  lastMonthAppts: number;
  todayAppts: number;
  totalPatients: number;
  newPatientsThisMonth: number;
  pendingInvestigations: number;
  completedInvestigations: number;
  statusRows: StatusRow[];
  statusTotal: number;
  typeRows: TypeRow[];
  completionRate: number;
  cancellationRate: number;
  monthTrend: number;
}

/* ═══ SVG helpers ═════════════════════════════════════════════════════════ */
function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutSlice(cx: number, cy: number, ro: number, ri: number, a1: number, a2: number) {
  if (Math.abs(a2 - a1) < 0.01) return "";
  const full = Math.abs(a2 - a1) >= 359.99;
  if (full) { a2 = a1 + 359.99; }
  const large = a2 - a1 > 180 ? 1 : 0;
  const o1 = polar(cx, cy, ro, a1);
  const o2 = polar(cx, cy, ro, a2);
  const i1 = polar(cx, cy, ri, a1);
  const i2 = polar(cx, cy, ri, a2);
  return [
    `M ${o1.x} ${o1.y}`,
    `A ${ro} ${ro} 0 ${large} 1 ${o2.x} ${o2.y}`,
    `L ${i2.x} ${i2.y}`,
    `A ${ri} ${ri} 0 ${large} 0 ${i1.x} ${i1.y}`,
    "Z",
  ].join(" ");
}

function smoothPath(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return pts.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 5;
    const cp1y = p1.y + (p2.y - p0.y) / 5;
    const cp2x = p2.x - (p3.x - p1.x) / 5;
    const cp2y = p2.y - (p3.y - p1.y) / 5;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${p2.x} ${p2.y}`;
  }
  return d;
}

/* ═══ KPI Card ════════════════════════════════════════════════════════════ */
function KpiCard({
  label, value, context, trend, accentClass, iconBg,
}: {
  label: string; value: string | number; context: string;
  trend?: number; accentClass: string; iconBg: string;
}) {
  return (
    <div className="bg-white border border-[var(--color-border)] rounded-xl p-4 flex flex-col gap-1 min-w-0">
      <div className={`self-start text-[9.5px] font-black uppercase tracking-[0.16em] px-2 py-0.5 rounded-md ${iconBg} mb-1`}>
        {label}
      </div>
      <p className={`text-[28px] sm:text-[32px] font-bold leading-none tracking-tight ${accentClass}`}>{value}</p>
      <p className="text-[11px] text-[var(--color-ink-400)] leading-snug">{context}</p>
      {trend !== undefined && (
        <p className={`text-[11px] font-semibold flex items-center gap-1 mt-0.5 ${trend > 0 ? "text-emerald-600" : trend < 0 ? "text-red-500" : "text-[var(--color-ink-400)]"}`}>
          {trend > 0 ? <TrendingUp size={11} /> : trend < 0 ? <TrendingDown size={11} /> : null}
          {trend > 0 ? "+" : ""}{trend}% vs last month
        </p>
      )}
    </div>
  );
}

/* ═══ Trend Chart ═════════════════════════════════════════════════════════ */
type TooltipState = { x: number; y: number; point: TrendPoint } | null;

function TrendChart({ points }: { points: TrendPoint[] }) {
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  if (points.length === 0) {
    return <div className="flex items-center justify-center h-[180px] text-sm text-[var(--color-ink-400)]">No data for this period.</div>;
  }

  // Chart geometry
  const W = 700, H = 160;
  const pad = { top: 16, right: 16, bottom: 36, left: 36 };
  const cw = W - pad.left - pad.right;
  const ch = H - pad.top - pad.bottom;
  const maxVal = Math.max(...points.map((p) => p.total), 1);
  const yMax = Math.ceil(maxVal / 2) * 2 + 2;  // round up to nearest even, add buffer

  // Grid ticks
  const yTicks = 4;
  const step = Math.ceil(yMax / yTicks);
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => i * step);

  function xOf(i: number) { return pad.left + (i / (points.length - 1)) * cw; }
  function yOf(v: number) { return pad.top + ch - (v / (ticks[ticks.length - 1])) * ch; }

  const totalPts = points.map((p, i) => ({ x: xOf(i), y: yOf(p.total) }));
  const donePts  = points.map((p, i) => ({ x: xOf(i), y: yOf(p.completed) }));

  const totalLine = smoothPath(totalPts);
  const doneLine  = smoothPath(donePts);

  // Area fills
  const areaBase = `L ${xOf(points.length - 1)} ${pad.top + ch} L ${pad.left} ${pad.top + ch} Z`;
  const totalArea = totalLine + " " + areaBase;
  const doneArea  = doneLine  + " " + areaBase;

  // X-axis labels — skip some if crowded
  const step_x = points.length <= 14 ? 1 : points.length <= 31 ? 3 : 7;
  const xLabels = points
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => i % step_x === 0 || i === points.length - 1);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    const dataX = svgX - pad.left;
    if (dataX < 0 || dataX > cw || points.length < 2) { setTooltip(null); return; }
    const idx = Math.round((dataX / cw) * (points.length - 1));
    const pt  = points[Math.max(0, Math.min(idx, points.length - 1))];
    setTooltip({ x: xOf(Math.max(0, Math.min(idx, points.length - 1))), y: yOf(pt.total), point: pt });
  };

  return (
    <div className="relative w-full select-none">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: "auto", maxHeight: 200 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        <defs>
          <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#14B8A6" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#14B8A6" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gradDone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10B981" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={pad.left} y1={yOf(t)} x2={W - pad.right} y2={yOf(t)}
              stroke="#E5E9EF" strokeWidth="1"
            />
            <text x={pad.left - 6} y={yOf(t)} textAnchor="end" dominantBaseline="middle"
              fontSize="9" fill="#9CA3AF" fontFamily="system-ui, sans-serif">
              {t}
            </text>
          </g>
        ))}

        {/* Area fills */}
        <path d={totalArea} fill="url(#gradTotal)" />
        <path d={doneArea}  fill="url(#gradDone)"  />

        {/* Lines */}
        <path d={totalLine} fill="none" stroke="#14B8A6" strokeWidth="2" strokeLinejoin="round" />
        <path d={doneLine}  fill="none" stroke="#10B981" strokeWidth="2" strokeLinejoin="round" />

        {/* X-axis labels */}
        {xLabels.map(({ p, i }) => (
          <text key={i} x={xOf(i)} y={H - 6} textAnchor="middle"
            fontSize="9" fill="#9CA3AF" fontFamily="system-ui, sans-serif">
            {p.dateLabel}
          </text>
        ))}

        {/* Tooltip crosshair */}
        {tooltip && (
          <>
            <line
              x1={tooltip.x} y1={pad.top} x2={tooltip.x} y2={pad.top + ch}
              stroke="#CBD5E1" strokeWidth="1" strokeDasharray="3 3"
            />
            <circle cx={tooltip.x} cy={yOf(tooltip.point.total)} r="4"
              fill="#14B8A6" stroke="white" strokeWidth="2" />
            <circle cx={tooltip.x} cy={yOf(tooltip.point.completed)} r="4"
              fill="#10B981" stroke="white" strokeWidth="2" />
          </>
        )}
      </svg>

      {/* HTML Tooltip */}
      {tooltip && (
        <div
          className="absolute z-10 pointer-events-none bg-white border border-[var(--color-border)] rounded-lg shadow-lg px-3 py-2 text-[11px] min-w-[120px]"
          style={{
            left: `${(tooltip.x / 700) * 100}%`,
            top: "0",
            transform: tooltip.x > 500 ? "translateX(-105%)" : "translateX(5%)",
          }}
        >
          <p className="font-bold text-[var(--color-ink-700)] mb-1">{tooltip.point.dateLabel} · {tooltip.point.label}</p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-500 shrink-0" />
            <span className="text-[var(--color-ink-500)]">Total</span>
            <span className="font-bold text-[var(--color-ink-800)] ml-auto">{tooltip.point.total}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-[var(--color-ink-500)]">Completed</span>
            <span className="font-bold text-[var(--color-ink-800)] ml-auto">{tooltip.point.completed}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ Donut Chart ═════════════════════════════════════════════════════════ */
function DonutChart({ rows, total }: { rows: StatusRow[]; total: number }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const cx = 64, cy = 64, ro = 56, ri = 36;
  let cumAngle = 0;

  const slices = rows.map((r) => {
    const angle = total > 0 ? (r.count / total) * 360 : 0;
    const start = cumAngle;
    cumAngle += angle;
    return { ...r, start, end: cumAngle, angle };
  });

  const activeRow = hovered ? slices.find((s) => s.label === hovered) : null;

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: 128, height: 128 }}>
        <svg viewBox="0 0 128 128" width="128" height="128">
          {total === 0 ? (
            <circle cx={cx} cy={cy} r={ro} fill="none" stroke="#E5E9EF" strokeWidth={ro - ri} />
          ) : (
            slices.map((s) => (
              <path
                key={s.label}
                d={donutSlice(cx, cy, ro, ri, s.start, s.end)}
                fill={s.hex}
                opacity={hovered && hovered !== s.label ? 0.35 : 1}
                onMouseEnter={() => setHovered(s.label)}
                onMouseLeave={() => setHovered(null)}
                className="cursor-pointer transition-opacity duration-150"
              />
            ))
          )}
          <text x={cx} y={cy - 6} textAnchor="middle" fontSize="20" fontWeight="700"
            fill="#1E2A35" fontFamily="system-ui, sans-serif">
            {activeRow ? activeRow.count : total}
          </text>
          <text x={cx} y={cy + 10} textAnchor="middle" fontSize="8.5" fill="#9CA3AF"
            fontFamily="system-ui, sans-serif">
            {activeRow ? activeRow.label : "total"}
          </text>
        </svg>
      </div>

      <div className="flex-1 flex flex-col gap-2 min-w-0">
        {slices.map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-2.5 cursor-default"
            onMouseEnter={() => setHovered(s.label)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.hex }} />
            <span className="text-[11px] sm:text-[12px] text-[var(--color-ink-600)] flex-1 min-w-0 truncate">{s.label}</span>
            <span className="text-[11px] sm:text-[12px] font-semibold text-[var(--color-ink-800)] tabular-nums">{s.count}</span>
            <span className="text-[9.5px] text-[var(--color-ink-400)] tabular-nums w-8 text-right shrink-0">
              {total > 0 ? Math.round((s.count / total) * 100) : 0}%
            </span>
          </div>
        ))}
        {total === 0 && (
          <p className="text-[11px] text-[var(--color-ink-400)]">No appointments this month.</p>
        )}
      </div>
    </div>
  );
}

/* ═══ Horizontal Bar ══════════════════════════════════════════════════════ */
function HBar({ label, count, max, pct, color }: { label: string; count: number; max: number; pct: number; color: string }) {
  const w = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] sm:text-[12px] text-[var(--color-ink-600)] w-28 sm:w-36 shrink-0 truncate capitalize">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-[var(--color-surface-sunken)]">
        <div className="h-2 rounded-full transition-all" style={{ width: `${w}%`, background: color }} />
      </div>
      <span className="text-[11px] sm:text-[12px] font-semibold text-[var(--color-ink-700)] tabular-nums w-5 text-right shrink-0">{count}</span>
      <span className="text-[9.5px] text-[var(--color-ink-400)] tabular-nums w-7 text-right shrink-0">{pct}%</span>
    </div>
  );
}

/* ═══ Insight pill ════════════════════════════════════════════════════════ */
function Insight({ text, type }: { text: string; type: "good" | "warn" | "info" }) {
  const style = {
    good: "bg-emerald-50 border-emerald-200 text-emerald-800",
    warn: "bg-amber-50 border-amber-200 text-amber-800",
    info: "bg-[var(--color-primary-50)] border-[var(--color-primary-100)] text-[var(--color-primary-700)]",
  }[type];
  const Icon = type === "good" ? CheckCircle2 : type === "warn" ? AlertCircle : Lightbulb;
  return (
    <div className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 ${style}`}>
      <Icon size={13} className="shrink-0 mt-0.5" />
      <p className="text-[12px] leading-snug">{text}</p>
    </div>
  );
}

/* ═══ Main Dashboard ══════════════════════════════════════════════════════ */
type Range = "7d" | "30d" | "90d";

const RANGE_DAYS: Record<Range, number> = { "7d": 7, "30d": 30, "90d": 90 };
const RANGE_LABELS: Record<Range, string> = { "7d": "7 Days", "30d": "30 Days", "90d": "90 Days" };

const TYPE_COLORS = ["#0D9488", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444", "#3B82F6"];

export function AnalyticsDashboard(props: AnalyticsProps) {
  const [range, setRange] = useState<Range>("7d");

  const {
    nowStr, scope,
    trendPoints, thisMonthAppts, lastMonthAppts, todayAppts,
    totalPatients, newPatientsThisMonth,
    pendingInvestigations, completedInvestigations,
    statusRows, statusTotal, typeRows,
    completionRate, cancellationRate, monthTrend,
  } = props;

  /* Slice trend data to selected range */
  const days = RANGE_DAYS[range];
  const trendSlice = trendPoints.slice(-days);

  const trendTotal   = trendSlice.reduce((s, p) => s + p.total, 0);
  const trendPeak    = Math.max(...trendSlice.map((p) => p.total), 0);
  const trendAvg     = trendSlice.length > 0 ? (trendTotal / trendSlice.length).toFixed(1) : "0";

  const invTotal = pendingInvestigations + completedInvestigations;
  const invPct   = invTotal > 0 ? Math.round((completedInvestigations / invTotal) * 100) : 0;

  /* Practice insights */
  const insights: { text: string; type: "good" | "warn" | "info" }[] = [];
  if (completionRate >= 90) insights.push({ text: `Strong completion rate at ${completionRate}% — appointments are being seen and closed efficiently.`, type: "good" });
  if (cancellationRate > 15) insights.push({ text: `Cancellation + no-show rate is ${cancellationRate}%. Consider reminder workflows or shorter lead times.`, type: "warn" });
  if (monthTrend > 20) insights.push({ text: `Appointment volume is up ${monthTrend}% vs last month — capacity planning may be needed.`, type: "info" });
  if (monthTrend < -20 && lastMonthAppts > 0) insights.push({ text: `Appointment volume dropped ${Math.abs(monthTrend)}% vs last month. Review scheduling or availability.`, type: "warn" });
  if (newPatientsThisMonth > 0) insights.push({ text: `${newPatientsThisMonth} new patient${newPatientsThisMonth > 1 ? "s" : ""} registered this month out of ${totalPatients} total.`, type: "info" });
  if (pendingInvestigations > 20) insights.push({ text: `${pendingInvestigations} investigation orders are awaiting review. Consider assigning follow-up responsibility.`, type: "warn" });

  return (
    <div className="fade-in space-y-5 pb-10">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[var(--color-ink-400)] text-[11px] mb-1.5">
            <Link href="/dashboard" className="hover:text-[var(--color-primary-600)] transition-colors">Dashboard</Link>
            <span>/</span>
            <span className="text-[var(--color-ink-600)] font-medium">Analytics</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-ink-900)] flex items-center gap-2.5">
            <BarChart2 size={20} className="text-[var(--color-primary-600)]" />
            Analytics &amp; Reports
          </h1>
          <p className="text-[12px] sm:text-[13px] text-[var(--color-ink-400)] mt-0.5">
            {nowStr} · {scope}
          </p>
        </div>
        <a
          href="#"
          className="inline-flex items-center gap-2 text-[12px] font-semibold px-4 py-2 rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] transition-colors"
        >
          <Download size={13} />
          Export Report
        </a>
      </div>

      {/* ── KPI Strip ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        <KpiCard
          label="This Month"
          value={thisMonthAppts}
          context={`${todayAppts} scheduled today`}
          trend={monthTrend !== 0 ? monthTrend : undefined}
          accentClass="text-[var(--color-primary-700)]"
          iconBg="bg-[var(--color-primary-50)] text-[var(--color-primary-700)]"
        />
        <KpiCard
          label="Completion Rate"
          value={`${completionRate}%`}
          context={`${statusRows.find(r => r.label === "Dispensed")?.count ?? 0} of ${statusTotal} appointments`}
          accentClass="text-emerald-700"
          iconBg="bg-emerald-50 text-emerald-700"
        />
        <KpiCard
          label="Cancellation Rate"
          value={`${cancellationRate}%`}
          context={`${(statusRows.find(r => r.label === "Cancelled")?.count ?? 0) + (statusRows.find(r => r.label === "No Show")?.count ?? 0)} cancelled or no-show`}
          accentClass={cancellationRate > 15 ? "text-red-600" : "text-[var(--color-ink-700)]"}
          iconBg={cancellationRate > 15 ? "bg-red-50 text-red-700" : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]"}
        />
        <KpiCard
          label="Total Patients"
          value={totalPatients}
          context={`${newPatientsThisMonth} new this month`}
          accentClass="text-[var(--color-ink-800)]"
          iconBg="bg-blue-50 text-blue-700"
        />
        <KpiCard
          label="Pending Tests"
          value={pendingInvestigations}
          context={`${completedInvestigations} reviewed · ${invPct}% complete`}
          accentClass={pendingInvestigations > 20 ? "text-amber-700" : "text-[var(--color-ink-800)]"}
          iconBg={pendingInvestigations > 20 ? "bg-amber-50 text-amber-700" : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]"}
        />
      </div>

      {/* ── Appointment Activity ─────────────────────────────────────────── */}
      <div className="bg-white border border-[var(--color-border)] rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-[14px] sm:text-[15px] font-semibold text-[var(--color-ink-900)] flex items-center gap-2">
              <Activity size={14} className="text-[var(--color-primary-600)]" />
              Appointment Activity
            </h2>
            <p className="text-[11px] text-[var(--color-ink-400)] mt-0.5">
              Peak: {trendPeak} · Avg: {trendAvg}/day · {trendTotal} total in period
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-3 text-[11px] text-[var(--color-ink-500)] mr-2">
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded-full bg-teal-500 inline-block" /> Total</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded-full bg-emerald-500 inline-block" /> Completed</span>
            </div>
            <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden text-[11px]">
              {(["7d", "30d", "90d"] as Range[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-1.5 font-semibold transition-colors ${
                    range === r
                      ? "bg-[var(--color-primary-700)] text-white"
                      : "text-[var(--color-ink-500)] hover:bg-[var(--color-surface-sunken)]"
                  }`}
                >
                  {RANGE_LABELS[r]}
                </button>
              ))}
            </div>
          </div>
        </div>
        <TrendChart points={trendSlice} />
      </div>

      {/* ── Status Distribution + Visit Types ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Appointment Status — donut */}
        <div className="bg-white border border-[var(--color-border)] rounded-xl p-5">
          <h2 className="text-[14px] sm:text-[15px] font-semibold text-[var(--color-ink-900)] mb-0.5">Appointment Status</h2>
          <p className="text-[11px] text-[var(--color-ink-400)] mb-4">This month · {statusTotal} appointments</p>
          <DonutChart rows={statusRows} total={statusTotal} />
        </div>

        {/* Visit Types — horizontal bars */}
        <div className="bg-white border border-[var(--color-border)] rounded-xl p-5">
          <h2 className="text-[14px] sm:text-[15px] font-semibold text-[var(--color-ink-900)] mb-0.5">Visit Types</h2>
          <p className="text-[11px] text-[var(--color-ink-400)] mb-4">This month · top {typeRows.length}</p>
          {typeRows.length === 0 ? (
            <p className="text-[13px] text-[var(--color-ink-400)] py-6 text-center">No data yet.</p>
          ) : (
            <div className="space-y-3">
              {typeRows.map((r, idx) => (
                <HBar
                  key={r.label}
                  label={r.label}
                  count={r.count}
                  max={typeRows[0].count}
                  pct={statusTotal > 0 ? Math.round((r.count / statusTotal) * 100) : 0}
                  color={TYPE_COLORS[idx % TYPE_COLORS.length]}
                />
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── Monthly Summary + Investigations ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px] gap-4">

        {/* Monthly summary table */}
        <div className="bg-white border border-[var(--color-border)] rounded-xl p-5">
          <h2 className="text-[14px] sm:text-[15px] font-semibold text-[var(--color-ink-900)] mb-0.5">Monthly Summary</h2>
          <p className="text-[11px] text-[var(--color-ink-400)] mb-4">Current month vs previous</p>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] sm:text-[13px] min-w-[300px]">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  {["Metric", "This Month", "Last Month", "Change"].map((h) => (
                    <th key={h} className="pb-2 pr-3 text-left text-[9px] font-black uppercase tracking-[0.14em] text-[var(--color-ink-400)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {[
                  { metric: "Total Appointments", cur: thisMonthAppts, prev: lastMonthAppts },
                  { metric: "Completed",          cur: statusRows.find(r => r.label === "Dispensed")?.count ?? 0, prev: null },
                  { metric: "Cancellations",      cur: (statusRows.find(r => r.label === "Cancelled")?.count ?? 0) + (statusRows.find(r => r.label === "No Show")?.count ?? 0), prev: null },
                  { metric: "New Patients",        cur: newPatientsThisMonth, prev: null },
                  { metric: "Pending Tests",       cur: pendingInvestigations, prev: null },
                ].map((row) => {
                  const diff = row.prev !== null ? row.cur - row.prev : null;
                  const pctChange = row.prev !== null && row.prev > 0 ? Math.round(((row.cur - row.prev) / row.prev) * 100) : null;
                  return (
                    <tr key={row.metric} className="hover:bg-[var(--color-surface-sunken)] transition-colors">
                      <td className="py-2.5 pr-3 font-medium text-[var(--color-ink-700)]">{row.metric}</td>
                      <td className="py-2.5 pr-3 font-bold text-[var(--color-ink-900)] tabular-nums">{row.cur}</td>
                      <td className="py-2.5 pr-3 text-[var(--color-ink-500)] tabular-nums">{row.prev ?? "—"}</td>
                      <td className="py-2.5">
                        {diff !== null ? (
                          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${diff > 0 ? "text-emerald-600" : diff < 0 ? "text-red-500" : "text-[var(--color-ink-400)]"}`}>
                            {diff > 0 ? "+" : ""}{diff}
                            {pctChange !== null && pctChange !== 0 && (
                              <span className="text-[9.5px] font-normal">({pctChange > 0 ? "+" : ""}{pctChange}%)</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-[var(--color-ink-300)] text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Investigations */}
        <div className="bg-white border border-[var(--color-border)] rounded-xl p-5 flex flex-col gap-4">
          <div>
            <h2 className="text-[14px] sm:text-[15px] font-semibold text-[var(--color-ink-900)] mb-0.5">Pending Investigations</h2>
            <p className="text-[11px] text-[var(--color-ink-400)]">All time · test orders</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-3 text-center">
              <p className="text-[28px] font-bold text-amber-700 leading-none">{pendingInvestigations}</p>
              <p className="text-[10px] font-semibold text-amber-600 mt-1">Awaiting Review</p>
            </div>
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-3 text-center">
              <p className="text-[28px] font-bold text-emerald-700 leading-none">{completedInvestigations}</p>
              <p className="text-[10px] font-semibold text-emerald-600 mt-1">Reviewed</p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-[11px] text-[var(--color-ink-500)] mb-1.5">
              <span>Completion rate</span>
              <span className="font-bold text-[var(--color-ink-700)]">{invPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-[var(--color-surface-sunken)]">
              <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${invPct}%` }} />
            </div>
          </div>

          <Link
            href="/patients"
            className="mt-auto inline-flex items-center justify-center gap-2 text-[12px] font-semibold px-4 py-2.5 rounded-lg bg-[var(--color-primary-700)] text-white hover:bg-[var(--color-primary-800)] transition-colors"
          >
            <FlaskConical size={13} />
            View Pending Tests
            <ArrowRight size={12} />
          </Link>
        </div>

      </div>

      {/* ── Practice Insights ────────────────────────────────────────────── */}
      {insights.length > 0 && (
        <div className="bg-white border border-[var(--color-border)] rounded-xl p-5">
          <h2 className="text-[14px] sm:text-[15px] font-semibold text-[var(--color-ink-900)] mb-0.5 flex items-center gap-2">
            <Lightbulb size={14} className="text-amber-500" />
            Practice Insights
          </h2>
          <p className="text-[11px] text-[var(--color-ink-400)] mb-4">Derived from your current data</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {insights.map((ins, i) => (
              <Insight key={i} text={ins.text} type={ins.type} />
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
