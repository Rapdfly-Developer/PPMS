"use client";

import { useState, useMemo, useEffect, useTransition, type ReactNode } from "react";
import { format } from "date-fns";
import Link from "next/link";
import {
  ChevronDown, Building2, Loader2, Clock, Undo2, Eye,
  Users, UserCheck, CheckCircle2, BrainCircuit, Stethoscope,
  Calendar, Zap, Activity, TrendingUp, TrendingDown, ArrowRight,
  UserX, UserPlus, Search, BarChart2, FileText, UserCog,
  ClipboardList, Cpu, LogIn,
} from "lucide-react";
import clsx from "clsx";
import { undoQueueEntry } from "@/app/(app)/appointments/actions";

/* ── Types ────────────────────────────────────────────────────────────────── */
interface Appt {
  id: string;
  dateTime: string;
  createdAt: string;
  arrivedAt: string | null;
  status: string;
  isWalkIn: boolean;
  visitType: string | null;
  complaint: string | null;
  partialDispenseReason: string | null;
  partialDispenseAt:     string | null;
  patient: { name: string; udid: string; uhid?: string; age: number; sex: string; mobile?: string };
  hospital?: { id: string; name: string; logoUrl?: string | null };
  doctor?:   { id: string; name: string } | null;
  visitId:          string | null;
  visitStartedAt:   string | null;
  visitFinalizedAt: string | null;
}

interface FollowUp {
  id: string;
  dateTime: string;
  visitType: string;
  patient: { name: string; udid: string; age: number; sex: string };
  hospital: { id: string; name: string };
}

interface AnalyticsBucket { scheduled: number; completed: number; noShow: number; }

export interface DashboardProps {
  scope:              "DOCTOR" | "HOSPITAL";
  permissions:        string[];
  displayName:        string;
  bannerTitle:        string;
  bannerSubtitle?:    string;
  todayLabel:         string;
  appts:              Appt[];
  filterOptions:      { id: string; name: string; logoUrl?: string | null }[];
  hospitalLogoUrl?:   string | null;
  newEncounterHref:   string;
  newEncounterLabel:  string;
  followUps?:         FollowUp[];
  analytics?: {
    today: AnalyticsBucket;
    week:  AnalyticsBucket;
    month: AnalyticsBucket;
  };
  yesterdayCounts?: {
    total: number;
    waiting: number;
    completed: number;
    noShow: number;
    newPats: number;
  };
}

/* ── Status config ────────────────────────────────────────────────────────── */
const STATUS_CFG: Record<string, { label: string; color: string; dot: string; bg: string }> = {
  REQUESTED:        { label: "Scheduled",       color: "text-violet-700",  dot: "bg-violet-500",  bg: "bg-violet-50 border-violet-200"  },
  CONFIRMED:        { label: "Waiting",          color: "text-amber-700",   dot: "bg-amber-500",   bg: "bg-amber-50 border-amber-200"    },
  DISPENSED:        { label: "Completed",        color: "text-emerald-700", dot: "bg-emerald-500", bg: "bg-emerald-50 border-emerald-200" },
  CANCELLED:        { label: "Cancelled",        color: "text-red-600",     dot: "bg-red-500",     bg: "bg-red-50 border-red-200"        },
  NO_SHOW:          { label: "No Show",          color: "text-gray-500",    dot: "bg-gray-400",    bg: "bg-gray-50 border-gray-200"      },
  RESCHEDULED:      { label: "Rescheduled",      color: "text-slate-600",   dot: "bg-slate-500",   bg: "bg-slate-50 border-slate-200"    },
  PARTIAL_DISPENSE: { label: "Partial",          color: "text-orange-700",  dot: "bg-orange-500",  bg: "bg-orange-50 border-orange-200"  },
  IN_CONSULTATION:  { label: "In Consultation",  color: "text-blue-700",    dot: "bg-blue-500",    bg: "bg-blue-50 border-blue-200"      },
};

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function apptEffectiveStatus(a: Appt): string {
  if (a.status === "CONFIRMED" && a.visitId && !a.visitFinalizedAt) return "IN_CONSULTATION";
  return a.status;
}

function sexShort(s: string) {
  return s === "MALE" ? "M" : s === "FEMALE" ? "F" : "O";
}

function trendPct(current: number, previous: number): { pct: number; up: boolean } | null {
  if (previous === 0) return current > 0 ? { pct: 100, up: true } : null;
  const pct = Math.round(((current - previous) / previous) * 100);
  return { pct: Math.abs(pct), up: pct >= 0 };
}

const AVATAR_COLORS = [
  "bg-blue-500", "bg-violet-500", "bg-teal-500", "bg-emerald-500",
  "bg-amber-500", "bg-rose-500", "bg-indigo-500", "bg-cyan-500",
];

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/* ── Live waiting timer ───────────────────────────────────────────────────── */
function LiveTimer({ since }: { since: string }) {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const elapsed   = now - new Date(since).getTime();
  if (elapsed <= 0) return null;
  const totalMins = Math.floor(elapsed / 60_000);
  const hours     = Math.floor(totalMins / 60);
  const mins      = totalMins % 60;
  const label     = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  const color     = totalMins > 30 ? "text-red-500" : totalMins > 15 ? "text-amber-500" : "text-emerald-600";
  return (
    <span suppressHydrationWarning className={clsx("inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums", color)}>
      <Clock size={9} /> {label}
    </span>
  );
}

function PatientLink({ udid, canView, className, children }: {
  udid: string; canView: boolean; className?: string; children: ReactNode;
}) {
  if (!canView) return <div className={className}>{children}</div>;
  return <Link href={`/patients/${udid}?returnTo=/dashboard`} className={className}>{children}</Link>;
}

/* ── Patient Avatar ───────────────────────────────────────────────────────── */
function PatientAvatar({ name, size = 32 }: { name: string; size?: number }) {
  const color = avatarColor(name);
  const ini   = initials(name);
  return (
    <div
      className={clsx("rounded-full flex items-center justify-center shrink-0 text-white font-bold", color)}
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {ini}
    </div>
  );
}

/* ── Status Badge ─────────────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG["REQUESTED"];
  return (
    <span className={clsx("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap", cfg.bg, cfg.color)}>
      <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

/* ── Type Badge ───────────────────────────────────────────────────────────── */
function TypeBadge({ label }: { label: string }) {
  const isFollowUp = label === "Follow-up";
  const isWalkIn   = label === "Walk-in";
  const isNew      = label === "New" || label === "New Patient";
  if (isFollowUp) return (
    <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border border-teal-400 text-teal-700 bg-teal-50 whitespace-nowrap">
      Follow-up
    </span>
  );
  if (isWalkIn) return (
    <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border border-sky-400 text-sky-700 bg-sky-50 whitespace-nowrap">
      Walk-in
    </span>
  );
  if (isNew) return (
    <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-400 text-emerald-700 bg-emerald-50 whitespace-nowrap">
      New
    </span>
  );
  return (
    <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border border-slate-300 text-slate-600 bg-slate-50 whitespace-nowrap">
      {label}
    </span>
  );
}

function apptTypeLabel(a: Appt): string {
  if (a.visitType === "Follow-up") return "Follow-up";
  if (a.isWalkIn) return "Walk-in";
  return a.visitType ?? "OPD";
}

/* ── KPI Card ─────────────────────────────────────────────────────────────── */
function KpiCard({ icon, value, label, sub, iconBg, trend }: {
  icon: ReactNode; value: number | string; label: string; sub?: string;
  iconBg: string; trend?: { pct: number; up: boolean } | null;
}) {
  return (
    <div className="surface-card px-4 py-4 flex flex-col gap-2 min-w-0">
      <div className="flex items-center justify-between">
        <div className={clsx("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", iconBg)}>
          {icon}
        </div>
        {trend && (
          <span className={clsx("inline-flex items-center gap-0.5 text-[11px] font-bold", trend.up ? "text-emerald-600" : "text-red-500")}>
            {trend.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {trend.pct}%
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-[var(--color-ink-900)] tabular-nums leading-tight">{value}</p>
        <p className="text-[11px] font-semibold text-[var(--color-ink-500)] mt-0.5 leading-tight">{label}</p>
        {sub && <p className="text-[10px] text-[var(--color-ink-400)] mt-1 leading-snug">{sub}</p>}
      </div>
    </div>
  );
}

/* ── Appointments Bar Chart ───────────────────────────────────────────────── */
function AppointmentsBarChart({ appts, range, analytics }: {
  appts: Appt[];
  range: "today" | "week" | "month";
  analytics?: { today: AnalyticsBucket; week: AnalyticsBucket; month: AnalyticsBucket };
}) {
  const HOURS = ["8AM","9AM","10AM","11AM","12PM","1PM","2PM","3PM","4PM","5PM"];
  const scheduled = useMemo(() => {
    const arr = new Array(10).fill(0);
    appts.forEach(a => {
      if (["CANCELLED","RESCHEDULED"].includes(a.status)) return;
      const h = new Date(a.dateTime).getHours() - 8;
      if (h >= 0 && h < 10) arr[h]++;
    });
    return arr;
  }, [appts]);
  const completed = useMemo(() => {
    const arr = new Array(10).fill(0);
    appts.forEach(a => {
      if (a.status !== "DISPENSED") return;
      const h = new Date(a.dateTime).getHours() - 8;
      if (h >= 0 && h < 10) arr[h]++;
    });
    return arr;
  }, [appts]);

  const maxVal = Math.max(...scheduled, 1);
  const CH = 72; // chart height px
  const BW = 8;  // bar width
  const GW = 26; // group width (2 bars + gap + space)
  const PL = 24; // left padding for y-axis labels

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${PL + HOURS.length * GW + 4} ${CH + 22}`} className="w-full overflow-visible">
        {/* Y-axis guides */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => {
          const y = CH - t * CH;
          const val = Math.round(t * maxVal);
          return (
            <g key={t}>
              <line x1={PL} y1={y} x2={PL + HOURS.length * GW} y2={y} stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="2,2" />
              <text x={PL - 3} y={y + 3} textAnchor="end" fontSize="7" fill="#9ca3af">{val}</text>
            </g>
          );
        })}
        {/* Bars */}
        {HOURS.map((h, i) => {
          const x = PL + i * GW;
          const sH = maxVal > 0 ? (scheduled[i] / maxVal) * CH : 0;
          const cH = maxVal > 0 ? (completed[i] / maxVal) * CH : 0;
          return (
            <g key={h}>
              <rect x={x} y={CH - sH} width={BW} height={Math.max(sH, 1)} rx="2" fill="#3b82f6" opacity="0.85" />
              <rect x={x + BW + 2} y={CH - cH} width={BW} height={Math.max(cH, 1)} rx="2" fill="#10b981" opacity="0.85" />
              <text x={x + BW} y={CH + 11} textAnchor="middle" fontSize="6.5" fill="#9ca3af">{h}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ── Patient Donut Chart ──────────────────────────────────────────────────── */
function PatientDonut({ newPats, returning, followUps }: {
  newPats: number; returning: number; followUps: number;
}) {
  const total = newPats + returning + followUps;
  const CX = 52, CY = 52, R = 36, SW = 16;
  const circ = 2 * Math.PI * R;

  const segments: { value: number; color: string }[] = [
    { value: newPats,   color: "#14b8a6" },
    { value: returning, color: "#3b82f6" },
    { value: followUps, color: "#f59e0b" },
  ];

  let offset = 0;
  const arcs = segments.map(s => {
    const len  = total > 0 ? (s.value / total) * circ : 0;
    const dash = `${len} ${circ - len}`;
    const rotation = -90 + (offset / (total || 1)) * 360;
    offset += s.value;
    return { dash, rotation, color: s.color };
  });

  return (
    <svg viewBox="0 0 104 104" width="90" height="90" className="shrink-0">
      {total === 0
        ? <circle cx={CX} cy={CY} r={R} fill="none" stroke="#e5e7eb" strokeWidth={SW} />
        : arcs.map((arc, i) => (
            <circle key={i} cx={CX} cy={CY} r={R} fill="none"
              stroke={arc.color} strokeWidth={SW}
              strokeDasharray={arc.dash}
              transform={`rotate(${arc.rotation} ${CX} ${CY})`}
            />
          ))
      }
      <text x={CX} y={CY - 5} textAnchor="middle" fontSize="15" fontWeight="700" fill="#111827">{total}</text>
      <text x={CX} y={CY + 9} textAnchor="middle" fontSize="7" fill="#6b7280">Total</text>
    </svg>
  );
}

/* ── Banner decorative medical SVG ───────────────────────────────────────── */
function BannerDecor() {
  return (
    <svg viewBox="0 0 320 160" className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#d1e8ff" />
          <stop offset="100%" stopColor="#b8d4f0" />
        </linearGradient>
      </defs>
      <rect width="320" height="160" fill="url(#bgGrad)" />
      {/* Decorative circles */}
      <circle cx="280" cy="20"  r="48" fill="white" fillOpacity="0.12" />
      <circle cx="300" cy="110" r="65" fill="white" fillOpacity="0.08" />
      <circle cx="180" cy="140" r="35" fill="white" fillOpacity="0.10" />
      {/* Stethoscope outline path */}
      <g transform="translate(150,28)" opacity="0.22" stroke="#1e3a5f" strokeWidth="3" fill="none">
        <path d="M40,0 C40,0 40,30 40,40 C40,56 28,68 12,68 C-4,68 -16,56 -16,40 C-16,30 -10,22 0,18" strokeLinecap="round" />
        <circle cx="40" cy="-4" r="8" />
        <path d="M0,18 L0,8" strokeLinecap="round" />
        <path d="-16,40 L-16,60 C-16,72 -8,80 4,82 L4,90" strokeLinecap="round" />
        <circle cx="4" cy="94" r="6" />
      </g>
      {/* Plus symbols */}
      <g opacity="0.18" stroke="#1e3a5f" strokeWidth="2.5" strokeLinecap="round">
        <line x1="240" y1="50" x2="240" y2="66" /><line x1="232" y1="58" x2="248" y2="58" />
        <line x1="270" y1="90" x2="270" y2="102" /><line x1="264" y1="96" x2="276" y2="96" />
        <line x1="200" y1="22" x2="200" y2="30" /><line x1="196" y1="26" x2="204" y2="26" />
      </g>
      {/* Small dots */}
      {[[220,70],[255,48],[195,100],[285,65],[260,130],[178,60]].map(([x,y], i) => (
        <circle key={i} cx={x} cy={y} r="2.5" fill="#2563eb" fillOpacity="0.2" />
      ))}
    </svg>
  );
}

/* ── Main Dashboard Component ─────────────────────────────────────────────── */
export function DashboardClient({
  scope, permissions, displayName, bannerTitle, bannerSubtitle,
  todayLabel, appts, filterOptions, hospitalLogoUrl,
  newEncounterHref, newEncounterLabel, followUps = [],
  analytics, yesterdayCounts,
}: DashboardProps) {
  const [selectedFilter, setSelectedFilter] = useState<string>("ALL");
  const [chartRange, setChartRange]         = useState<"today" | "week" | "month">("today");
  const [lastUpdated, setLastUpdated]       = useState<string>("");

  useEffect(() => {
    setLastUpdated(format(new Date(), "h:mm a"));
  }, []);

  const canViewPatient   = permissions.includes("patients.view");
  const canManageQueue   = permissions.includes("appointments.manage") || permissions.includes("appointments.queue");
  const isDoctor         = scope === "DOCTOR";

  /* Greeting */
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  /* Filter appts by selected hospital/doctor */
  const visibleAppts = useMemo(() => {
    if (selectedFilter === "ALL") return appts;
    if (isDoctor) return appts.filter(a => a.hospital?.id === selectedFilter);
    return appts.filter(a => a.doctor?.id === selectedFilter);
  }, [appts, selectedFilter, isDoctor]);

  /* KPI Derived values */
  const kpi = useMemo(() => {
    const active    = visibleAppts.filter(a => !["CANCELLED","RESCHEDULED"].includes(a.status));
    const waiting   = visibleAppts.filter(a => a.status === "CONFIRMED" && !(a.visitId && !a.visitFinalizedAt));
    const inConsult = visibleAppts.filter(a => apptEffectiveStatus(a) === "IN_CONSULTATION");
    const completed = visibleAppts.filter(a => a.status === "DISPENSED");
    const noShow    = visibleAppts.filter(a => a.status === "NO_SHOW");
    const newPats   = visibleAppts.filter(a => a.isWalkIn || a.visitType === "New Patient");
    return {
      total:    active.length,
      waiting:  waiting.length,
      inConsult: inConsult.length,
      completed: completed.length,
      noShow:   noShow.length,
      newPats:  newPats.length,
    };
  }, [visibleAppts]);

  /* Patient flow counts */
  const flow = useMemo(() => ({
    registered: visibleAppts.filter(a => !["CANCELLED","RESCHEDULED","NO_SHOW"].includes(a.status)).length,
    waiting:    visibleAppts.filter(a => a.status === "CONFIRMED" && !(a.visitId && !a.visitFinalizedAt)).length,
    inConsult:  visibleAppts.filter(a => apptEffectiveStatus(a) === "IN_CONSULTATION").length,
    completed:  visibleAppts.filter(a => a.status === "DISPENSED").length,
  }), [visibleAppts]);

  /* Patient overview donut */
  const patientBreakdown = useMemo(() => {
    const followUpCount  = visibleAppts.filter(a => a.visitType === "Follow-up" && !["CANCELLED","RESCHEDULED","NO_SHOW"].includes(a.status)).length;
    const walkInCount    = visibleAppts.filter(a => a.isWalkIn && a.visitType !== "Follow-up" && !["CANCELLED","RESCHEDULED","NO_SHOW"].includes(a.status)).length;
    const returningCount = visibleAppts.filter(a => !a.isWalkIn && a.visitType !== "Follow-up" && !["CANCELLED","RESCHEDULED","NO_SHOW"].includes(a.status)).length;
    return { newPats: walkInCount, returning: returningCount, followUps: followUpCount };
  }, [visibleAppts]);

  /* Table: all active appts sorted by time */
  const tableAppts = useMemo(() =>
    visibleAppts
      .filter(a => !["CANCELLED","RESCHEDULED"].includes(a.status))
      .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()),
    [visibleAppts]
  );

  /* Selected filter name */
  const selectedFilterName = selectedFilter === "ALL"
    ? "All " + (isDoctor ? "Hospitals" : "Doctors")
    : filterOptions.find(f => f.id === selectedFilter)?.name ?? "";

  return (
    <div className="space-y-4 pb-10">

      {/* ── Banner ─────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden border border-[var(--color-border)] shadow-sm" style={{ minHeight: 148 }}>
        <div className="flex h-full">
          {/* Left: Greeting */}
          <div className="flex-1 bg-white px-7 py-6 flex flex-col justify-center min-w-0">
            <p className="text-[13px] font-semibold text-[var(--color-primary-600)] mb-1">{greeting},</p>
            <h1 className="text-[22px] font-bold text-[var(--color-ink-900)] leading-tight truncate">
              {bannerTitle}
            </h1>
            {bannerSubtitle
              ? <p className="text-[12px] text-[var(--color-ink-400)] mt-1">{bannerSubtitle}</p>
              : <p className="text-[12px] text-[var(--color-ink-400)] mt-1">
                  Here&apos;s your overview across {filterOptions.length > 1 ? "all assigned locations" : "your practice"} today.
                </p>
            }
            <div className="flex items-center gap-1.5 mt-3">
              <Calendar size={13} className="text-[var(--color-ink-400)]" />
              <span className="text-[12px] font-medium text-[var(--color-ink-500)]">{todayLabel}</span>
            </div>
          </div>

          {/* Right: decorative + filter cards */}
          <div className="relative hidden sm:flex items-start justify-end gap-3 px-5 py-5 shrink-0" style={{ width: 360 }}>
            <BannerDecor />
            {/* Hospital/Doctor selector */}
            <div className="relative z-10 bg-white/90 backdrop-blur-sm rounded-xl border border-white/60 shadow-md px-4 py-3 min-w-[180px]">
              <p className="text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-wide mb-1.5">
                {isDoctor ? "Hospital Filter" : "Doctor Filter"}
              </p>
              <div className="relative">
                <select
                  value={selectedFilter}
                  onChange={e => setSelectedFilter(e.target.value)}
                  className="w-full appearance-none bg-transparent text-[12px] font-semibold text-[var(--color-ink-800)] pr-5 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All {isDoctor ? "Hospitals" : "Doctors"}</option>
                  {filterOptions.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-0 top-1 text-[var(--color-ink-400)] pointer-events-none" />
              </div>
            </div>
            {/* Access card */}
            <div className="relative z-10 bg-white/90 backdrop-blur-sm rounded-xl border border-white/60 shadow-md px-4 py-3 shrink-0">
              <p className="text-[18px] font-bold text-[var(--color-ink-900)] tabular-nums">{filterOptions.length}</p>
              <p className="text-[10px] font-medium text-[var(--color-ink-400)] whitespace-nowrap">
                {isDoctor ? "Hospitals" : "Doctors"} linked
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard
          icon={<Calendar size={17} className="text-blue-600" />}
          iconBg="bg-blue-50"
          value={kpi.total}
          label="Today's Appointments"
          sub={yesterdayCounts ? `${yesterdayCounts.total} scheduled yesterday` : undefined}
          trend={yesterdayCounts ? trendPct(kpi.total, yesterdayCounts.total) : null}
        />
        <KpiCard
          icon={<Clock size={17} className="text-amber-600" />}
          iconBg="bg-amber-50"
          value={kpi.waiting}
          label="Waiting Patients"
          sub={`${kpi.waiting} in queue`}
          trend={yesterdayCounts ? trendPct(kpi.waiting, yesterdayCounts.waiting) : null}
        />
        <KpiCard
          icon={<Stethoscope size={17} className="text-teal-600" />}
          iconBg="bg-teal-50"
          value={kpi.inConsult}
          label="In Consultation"
          sub={`${kpi.inConsult} ongoing`}
          trend={null}
        />
        <KpiCard
          icon={<CheckCircle2 size={17} className="text-emerald-600" />}
          iconBg="bg-emerald-50"
          value={kpi.completed}
          label="Completed"
          sub={yesterdayCounts ? `${yesterdayCounts.completed} completed yesterday` : undefined}
          trend={yesterdayCounts ? trendPct(kpi.completed, yesterdayCounts.completed) : null}
        />
        <KpiCard
          icon={<UserX size={17} className="text-red-500" />}
          iconBg="bg-red-50"
          value={kpi.noShow}
          label="No Shows"
          sub={yesterdayCounts ? `${yesterdayCounts.noShow} yesterday` : undefined}
          trend={yesterdayCounts && (kpi.noShow > 0 || yesterdayCounts.noShow > 0)
            ? trendPct(kpi.noShow, yesterdayCounts.noShow) : null}
        />
        <KpiCard
          icon={<UserPlus size={17} className="text-violet-600" />}
          iconBg="bg-violet-50"
          value={kpi.newPats}
          label="New Patients"
          sub={yesterdayCounts ? `${yesterdayCounts.newPats} yesterday` : undefined}
          trend={yesterdayCounts ? trendPct(kpi.newPats, yesterdayCounts.newPats) : null}
        />
      </div>

      {/* ── Main grid: Table + Right Panels ─────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] 2xl:grid-cols-[1fr_360px] gap-4 items-start">

        {/* ── Appointment Queue Table ─────────────────────────────────────── */}
        <div className="surface-card overflow-hidden">
          {/* Table header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                <ClipboardList size={14} className="text-blue-600" />
              </div>
              <h2 className="text-[13px] font-bold text-[var(--color-ink-900)]">Today&apos;s Appointment Queue</h2>
            </div>
            <div className="flex items-center gap-3">
              {filterOptions.length > 1 && (
                <div className="relative hidden sm:block">
                  <select
                    value={selectedFilter}
                    onChange={e => setSelectedFilter(e.target.value)}
                    className="appearance-none text-[11px] font-medium text-[var(--color-ink-600)] border border-[var(--color-border)] rounded-lg pl-3 pr-7 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-400)] cursor-pointer"
                  >
                    <option value="ALL">All {isDoctor ? "Hospitals" : "Doctors"}</option>
                    {filterOptions.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] pointer-events-none" />
                </div>
              )}
              <Link href="/appointments" className="flex items-center gap-1 text-[11px] font-semibold text-[var(--color-primary-600)] hover:text-[var(--color-primary-700)]">
                View All <ArrowRight size={12} />
              </Link>
            </div>
          </div>

          {/* Table */}
          {tableAppts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <Calendar size={36} className="text-[var(--color-ink-300)] mb-3" />
              <p className="text-[13px] font-semibold text-[var(--color-ink-500)]">No appointments today</p>
              <p className="text-[11px] text-[var(--color-ink-400)] mt-1">Your schedule is clear for today.</p>
              <Link href={newEncounterHref} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--color-primary-600)] text-white text-[12px] font-semibold hover:bg-[var(--color-primary-700)] transition-colors">
                <UserPlus size={13} /> {newEncounterLabel}
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-sunken)]">
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-wide w-20">Time</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-wide">Patient</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-wide hidden md:table-cell w-24">UHID</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-wide hidden lg:table-cell w-24">Type</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-wide hidden lg:table-cell">{isDoctor ? "Hospital" : "Doctor"}</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-wide w-32">Status</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-wide w-24">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tableAppts.map((appt) => (
                    <ApptRow
                      key={appt.id}
                      appt={appt}
                      canManageQueue={canManageQueue}
                      canViewPatient={canViewPatient}
                      isDoctor={isDoctor}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Table footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface-sunken)]">
            <div className="flex items-center gap-1.5">
              <Users size={12} className="text-[var(--color-ink-400)]" />
              <span className="text-[11px] text-[var(--color-ink-500)]">
                You have <span className="font-bold text-[var(--color-ink-700)]">{kpi.waiting}</span> patient{kpi.waiting !== 1 ? "s" : ""} waiting in the queue
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {lastUpdated && (
                <span className="text-[10px] text-[var(--color-ink-400)] hidden sm:inline">
                  Last updated at {lastUpdated}
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>
          </div>
        </div>

        {/* ── Right panels ──────────────────────────────────────────────────── */}
        {isDoctor && (
          <div className="flex flex-col gap-4">

            {/* Patient Flow */}
            <div className="surface-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center">
                  <Activity size={14} className="text-teal-600" />
                </div>
                <h3 className="text-[13px] font-bold text-[var(--color-ink-900)]">Patient Flow</h3>
                <span className="text-[10px] text-[var(--color-ink-400)] ml-auto">Today</span>
              </div>
              <div className="flex items-center justify-between gap-1">
                {[
                  { label: "Registered",    count: flow.registered, color: "bg-blue-100",    icon: <Users size={14} className="text-blue-600" /> },
                  { label: "Waiting",       count: flow.waiting,    color: "bg-amber-100",   icon: <Clock size={14} className="text-amber-600" /> },
                  { label: "Consultation",  count: flow.inConsult,  color: "bg-teal-100",    icon: <Stethoscope size={14} className="text-teal-600" /> },
                  { label: "Completed",     count: flow.completed,  color: "bg-emerald-100", icon: <CheckCircle2 size={14} className="text-emerald-600" /> },
                ].map((stage, i, arr) => (
                  <div key={stage.label} className="flex items-center gap-1 min-w-0">
                    <div className="flex flex-col items-center gap-1 min-w-0">
                      <div className={clsx("w-10 h-10 rounded-full flex items-center justify-center shrink-0", stage.color)}>
                        {stage.icon}
                      </div>
                      <span className="text-[14px] font-bold text-[var(--color-ink-900)] tabular-nums leading-none">{stage.count}</span>
                      <span className="text-[9px] text-[var(--color-ink-400)] text-center leading-tight whitespace-nowrap">{stage.label}</span>
                    </div>
                    {i < arr.length - 1 && (
                      <ArrowRight size={12} className="text-[var(--color-ink-300)] shrink-0 mb-4" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Appointments Overview Chart */}
            <div className="surface-card p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                    <BarChart2 size={14} className="text-blue-600" />
                  </div>
                  <h3 className="text-[13px] font-bold text-[var(--color-ink-900)]">Appointments Overview</h3>
                </div>
              </div>
              {/* Range tabs */}
              <div className="flex gap-1 mb-3 bg-[var(--color-surface-sunken)] rounded-lg p-1">
                {(["today","week","month"] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => setChartRange(r)}
                    className={clsx(
                      "flex-1 text-[10px] font-semibold py-1 rounded-md transition-colors capitalize",
                      chartRange === r
                        ? "bg-white shadow-sm text-[var(--color-ink-800)]"
                        : "text-[var(--color-ink-400)] hover:text-[var(--color-ink-600)]"
                    )}
                  >
                    {r === "today" ? "Today" : r === "week" ? "This Week" : "This Month"}
                  </button>
                ))}
              </div>
              {/* Legend */}
              <div className="flex items-center gap-4 mb-2">
                <span className="flex items-center gap-1 text-[10px] text-[var(--color-ink-500)]">
                  <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> Scheduled
                </span>
                <span className="flex items-center gap-1 text-[10px] text-[var(--color-ink-500)]">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Completed
                </span>
              </div>
              <AppointmentsBarChart appts={visibleAppts} range={chartRange} analytics={analytics} />
            </div>

            {/* Patient Overview Donut */}
            <div className="surface-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
                  <UserCheck size={14} className="text-violet-600" />
                </div>
                <h3 className="text-[13px] font-bold text-[var(--color-ink-900)]">Patient Overview</h3>
              </div>
              <div className="flex items-center gap-4">
                <PatientDonut
                  newPats={patientBreakdown.newPats}
                  returning={patientBreakdown.returning}
                  followUps={patientBreakdown.followUps}
                />
                <div className="flex flex-col gap-2.5 flex-1 min-w-0">
                  {[
                    { label: "New Patients",      count: patientBreakdown.newPats,   total: patientBreakdown.newPats + patientBreakdown.returning + patientBreakdown.followUps, color: "bg-teal-500" },
                    { label: "Returning",         count: patientBreakdown.returning, total: patientBreakdown.newPats + patientBreakdown.returning + patientBreakdown.followUps, color: "bg-blue-500" },
                    { label: "Follow-ups",        count: patientBreakdown.followUps, total: patientBreakdown.newPats + patientBreakdown.returning + patientBreakdown.followUps, color: "bg-amber-500" },
                  ].map(item => {
                    const pct = item.total > 0 ? Math.round((item.count / item.total) * 100) : 0;
                    return (
                      <div key={item.label}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="flex items-center gap-1.5 text-[11px] text-[var(--color-ink-600)]">
                            <span className={clsx("w-2 h-2 rounded-full shrink-0", item.color)} />
                            {item.label}
                          </span>
                          <span className="text-[11px] font-bold text-[var(--color-ink-800)] tabular-nums">{item.count} <span className="font-normal text-[var(--color-ink-400)]">({pct}%)</span></span>
                        </div>
                        <div className="h-1 bg-[var(--color-border)] rounded-full overflow-hidden">
                          <div className={clsx("h-full rounded-full", item.color)} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom Row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Quick Actions */}
        <div className="surface-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
              <Zap size={14} className="text-amber-600" />
            </div>
            <h3 className="text-[13px] font-bold text-[var(--color-ink-900)]">Quick Actions</h3>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { label: "Register Patient",    href: "/patients/new",              icon: <UserPlus size={18} className="text-blue-600" />,   bg: "bg-blue-50"   },
              { label: "Book Appointment",    href: "/appointments/book",         icon: <Calendar size={18} className="text-violet-600" />, bg: "bg-violet-50" },
              { label: "Walk-in",             href: newEncounterHref,             icon: <LogIn size={18} className="text-teal-600" />,      bg: "bg-teal-50"   },
              { label: "Patient Search",      href: "/patients",                  icon: <Search size={18} className="text-emerald-600" />,  bg: "bg-emerald-50"},
              { label: "Availability",        href: "/settings?section=schedule", icon: <UserCog size={18} className="text-amber-600" />,   bg: "bg-amber-50"  },
              { label: "Reports",             href: "/reports",                   icon: <BarChart2 size={18} className="text-rose-600" />,  bg: "bg-rose-50"   },
            ].map(action => (
              <Link
                key={action.label}
                href={action.href}
                className="flex flex-col items-center gap-2 p-3 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-primary-200)] hover:shadow-sm transition-all group text-center"
              >
                <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform", action.bg)}>
                  {action.icon}
                </div>
                <span className="text-[10px] font-semibold text-[var(--color-ink-600)] group-hover:text-[var(--color-ink-800)] leading-tight">{action.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Upcoming Follow-Ups */}
        <div className="surface-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                <FileText size={14} className="text-emerald-600" />
              </div>
              <h3 className="text-[13px] font-bold text-[var(--color-ink-900)]">Upcoming Follow Ups</h3>
            </div>
            {followUps.length > 0 && (
              <Link href="/appointments" className="text-[11px] font-semibold text-[var(--color-primary-600)] hover:text-[var(--color-primary-700)]">
                View all
              </Link>
            )}
          </div>
          {followUps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle2 size={28} className="text-[var(--color-ink-300)] mb-2" />
              <p className="text-[12px] font-medium text-[var(--color-ink-500)]">No upcoming follow-ups</p>
              <p className="text-[11px] text-[var(--color-ink-400)] mt-0.5">All caught up for the next 7 days.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {followUps.slice(0, 4).map(fu => {
                const dt = new Date(fu.dateTime);
                return (
                  <Link
                    key={fu.id}
                    href={`/patients/${fu.patient.udid}?returnTo=/dashboard`}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-primary-200)] hover:bg-[var(--color-primary-50)] transition-all group"
                  >
                    <PatientAvatar name={fu.patient.name} size={34} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-[var(--color-ink-800)] truncate group-hover:text-[var(--color-primary-700)]">
                        {fu.patient.name}
                      </p>
                      <p className="text-[10px] text-[var(--color-ink-400)] mt-0.5">
                        {format(dt, "d MMM yyyy")} · {format(dt, "h:mm a")} · {fu.hospital.name}
                      </p>
                    </div>
                    <ArrowRight size={13} className="shrink-0 text-[var(--color-ink-300)] group-hover:text-[var(--color-primary-500)]" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* AI Clinical Copilot */}
        <div className="surface-card p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
              <BrainCircuit size={14} className="text-violet-600" />
            </div>
            <h3 className="text-[13px] font-bold text-[var(--color-ink-900)]">AI Clinical Copilot</h3>
            <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-violet-100 text-violet-700 border border-violet-200">
              New
            </span>
          </div>
          <div className="flex-1 flex flex-col">
            {/* Decorative icon */}
            <div className="flex items-center justify-center mb-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-blue-100 flex items-center justify-center shadow-sm">
                  <Cpu size={28} className="text-violet-500" />
                </div>
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center shadow">
                  <span className="text-white text-[8px] font-bold">AI</span>
                </div>
              </div>
            </div>
            <p className="text-[12px] text-[var(--color-ink-500)] text-center leading-relaxed mb-4">
              Get AI-powered insights, patient summaries and clinical decision support — instantly.
            </p>
            {/* Stats row */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { label: "Summaries",    value: "1-click" },
                { label: "Clinical Q&A", value: "Instant" },
              ].map(s => (
                <div key={s.label} className="bg-[var(--color-surface-sunken)] rounded-xl px-3 py-2.5 text-center">
                  <p className="text-[12px] font-bold text-[var(--color-ink-800)]">{s.value}</p>
                  <p className="text-[10px] text-[var(--color-ink-400)]">{s.label}</p>
                </div>
              ))}
            </div>
            <Link
              href="/patients"
              className="mt-auto flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[var(--color-primary-700)] text-white text-[12px] font-semibold hover:bg-[var(--color-primary-800)] transition-colors"
            >
              Open Copilot <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Appointment Row ──────────────────────────────────────────────────────── */
function ApptRow({ appt, canManageQueue, canViewPatient, isDoctor }: {
  appt: Appt; canManageQueue: boolean; canViewPatient: boolean; isDoctor: boolean;
}) {
  const [undoing, startUndo] = useTransition();
  const effStatus  = apptEffectiveStatus(appt);
  const apptTime   = format(new Date(appt.dateTime), "h:mm a");
  const timerSince = appt.arrivedAt ?? appt.dateTime;

  const emrHref = appt.visitId
    ? `/emr/${appt.patient.udid}?visit=${appt.visitId}&returnTo=/dashboard`
    : `/emr/${appt.patient.udid}?returnTo=/dashboard`;

  const isActionable = appt.status === "CONFIRMED" || effStatus === "IN_CONSULTATION";
  const actionHref = isActionable && canViewPatient
    ? emrHref
    : `/patients/${appt.patient.udid}?returnTo=/dashboard`;

  const typeLabel = apptTypeLabel(appt);

  return (
    <tr className="group border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-primary-50)]/40 transition-colors">
      {/* Time */}
      <td className="px-4 py-3">
        <p className="text-[12px] font-bold text-[var(--color-ink-800)] tabular-nums">{apptTime}</p>
      </td>
      {/* Patient */}
      <td className="px-4 py-3">
        <PatientLink udid={appt.patient.udid} canView={canViewPatient} className="flex items-center gap-2.5">
          <PatientAvatar name={appt.patient.name} size={30} />
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-[var(--color-ink-900)] truncate max-w-[150px] group-hover:text-[var(--color-primary-700)]">
              {appt.patient.name}
            </p>
            <p className="text-[10px] text-[var(--color-ink-400)]">
              {appt.patient.age}y / {sexShort(appt.patient.sex)}
            </p>
          </div>
        </PatientLink>
      </td>
      {/* UHID */}
      <td className="px-4 py-3 hidden md:table-cell">
        <span className="font-mono text-[10px] text-[var(--color-ink-400)]">{appt.patient.uhid || "—"}</span>
      </td>
      {/* Type */}
      <td className="px-4 py-3 hidden lg:table-cell">
        <TypeBadge label={typeLabel} />
      </td>
      {/* Hospital or Doctor */}
      <td className="px-4 py-3 hidden lg:table-cell">
        {isDoctor ? (
          appt.hospital && (
            <div className="flex items-center gap-1.5 min-w-0">
              <Building2 size={11} className="shrink-0 text-[var(--color-ink-400)]" />
              <span className="text-[11px] text-[var(--color-ink-500)] truncate max-w-[130px]">{appt.hospital.name}</span>
            </div>
          )
        ) : (
          appt.doctor && (
            <span className="text-[11px] text-[var(--color-ink-500)] truncate max-w-[130px]">{appt.doctor.name}</span>
          )
        )}
      </td>
      {/* Status */}
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1 items-start">
          <StatusBadge status={effStatus} />
          {appt.status === "CONFIRMED" && <LiveTimer since={timerSince} />}
        </div>
      </td>
      {/* Action */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          {isActionable && canViewPatient ? (
            <Link
              href={actionHref}
              className={clsx(
                "inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap",
                effStatus === "IN_CONSULTATION"
                  ? "bg-teal-600 text-white hover:bg-teal-700"
                  : "bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)]"
              )}
            >
              <Stethoscope size={10} />
              {effStatus === "IN_CONSULTATION" ? "Continue" : "Open"}
            </Link>
          ) : (
            <Link
              href={`/patients/${appt.patient.udid}?returnTo=/dashboard`}
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-ink-600)] hover:bg-[var(--color-primary-50)] hover:text-[var(--color-primary-700)] hover:border-[var(--color-primary-200)] transition-colors"
            >
              <Eye size={10} /> View
            </Link>
          )}
          {appt.status === "CONFIRMED" && canManageQueue && (
            <button
              disabled={undoing}
              title="Move back to scheduled"
              onClick={() => startUndo(async () => { await undoQueueEntry(appt.id); })}
              className="p-1.5 rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-ink-400)] hover:text-amber-600 hover:border-amber-300 hover:bg-amber-50 disabled:opacity-50 transition-all"
            >
              {undoing ? <Loader2 size={11} className="animate-spin" /> : <Undo2 size={11} />}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
