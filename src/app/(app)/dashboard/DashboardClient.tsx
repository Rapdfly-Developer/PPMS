"use client";

import { useState, useMemo, useEffect, useTransition, type ReactNode } from "react";
import { format } from "date-fns";
import Link from "next/link";
import {
  ChevronDown, Building2, Loader2, Clock, Undo2, Eye,
  Users, UserCheck, CheckCircle2, Stethoscope,
  Calendar, Zap, Activity, TrendingUp, TrendingDown, ArrowRight,
  UserX, UserPlus, Search, BarChart2, UserCog, LogIn, Cpu, MapPin,
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
    total: number; waiting: number; completed: number; noShow: number; newPats: number;
  };
}

/* ── Status config ────────────────────────────────────────────────────────── */
const STATUS_CFG: Record<string, { label: string; dot: string; bg: string; text: string; filled?: boolean }> = {
  REQUESTED:        { label: "Scheduled",      dot: "bg-violet-500",  bg: "bg-violet-50 border-violet-200",   text: "text-violet-700" },
  CONFIRMED:        { label: "Waiting",         dot: "bg-amber-500",   bg: "bg-amber-50 border-amber-200",     text: "text-amber-700" },
  DISPENSED:        { label: "Completed",       dot: "bg-emerald-500", bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700" },
  CANCELLED:        { label: "Cancelled",       dot: "bg-red-500",     bg: "bg-red-50 border-red-200",         text: "text-red-600" },
  NO_SHOW:          { label: "No Show",         dot: "bg-gray-400",    bg: "bg-gray-50 border-gray-200",       text: "text-gray-500" },
  RESCHEDULED:      { label: "Rescheduled",     dot: "bg-slate-500",   bg: "bg-slate-50 border-slate-200",     text: "text-slate-600" },
  PARTIAL_DISPENSE: { label: "Partial",         dot: "bg-orange-500",  bg: "bg-orange-50 border-orange-200",   text: "text-orange-700" },
  IN_CONSULTATION:  { label: "In Consultation", dot: "",               bg: "bg-blue-600 border-blue-700",      text: "text-white", filled: true },
};

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function apptEffectiveStatus(a: Appt): string {
  if (a.status === "CONFIRMED" && a.visitId && !a.visitFinalizedAt) return "IN_CONSULTATION";
  return a.status;
}

function trendPct(cur: number, prev: number): { pct: number; up: boolean } | null {
  if (prev === 0) return cur > 0 ? { pct: 100, up: true } : null;
  const d = Math.round(((cur - prev) / prev) * 100);
  return { pct: Math.abs(d), up: d >= 0 };
}

const AVATAR_COLORS = ["#3b82f6","#8b5cf6","#14b8a6","#10b981","#f59e0b","#ef4444","#6366f1","#0ea5e9"];
function avatarBg(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}

/* ── Sub-components ───────────────────────────────────────────────────────── */
function LiveTimer({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(id); }, []);
  const ms = now - new Date(since).getTime();
  if (ms <= 0) return null;
  const m = Math.floor(ms / 60_000), h = Math.floor(m / 60), mm = m % 60;
  const label = h > 0 ? `${h}h ${mm}m` : `${m}m`;
  const cls = m > 30 ? "text-red-500" : m > 15 ? "text-amber-500" : "text-emerald-600";
  return (
    <span suppressHydrationWarning className={clsx("inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums", cls)}>
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

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <div className="rounded-full flex items-center justify-center shrink-0 text-white font-bold"
      style={{ width: size, height: size, fontSize: size * 0.34, background: avatarBg(name) }}>
      {initials(name)}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_CFG[status] ?? STATUS_CFG["REQUESTED"];
  if (c.filled) return (
    <span className={clsx("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap border", c.bg, c.text)}>
      <span className="w-1.5 h-1.5 rounded-full bg-white/70 shrink-0" />{c.label}
    </span>
  );
  return (
    <span className={clsx("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap", c.bg, c.text)}>
      <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", c.dot)} />{c.label}
    </span>
  );
}

function TypeBadge({ label }: { label: string }) {
  if (label === "Follow-up") return (
    <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border border-blue-300 text-blue-700 bg-blue-50 whitespace-nowrap">Follow-up</span>
  );
  if (label === "Walk-in" || label === "New" || label === "New Patient") return (
    <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-300 text-emerald-700 bg-emerald-50 whitespace-nowrap">
      {label === "Walk-in" ? "Walk-in" : "New"}
    </span>
  );
  return (
    <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border border-slate-200 text-slate-600 bg-slate-50 whitespace-nowrap">{label}</span>
  );
}

function KpiCard({ icon, label, value, sub, trend }: {
  icon: ReactNode; label: string; value: number; sub?: string;
  trend?: { pct: number; up: boolean } | null;
}) {
  return (
    <div className="surface-card px-5 py-5 flex flex-col gap-1 min-w-0">
      <div className="mb-1">{icon}</div>
      <p className="text-[12px] font-semibold text-[var(--color-ink-500)]">{label}</p>
      <div className="flex items-end gap-2">
        <p className="text-[28px] font-bold text-[var(--color-ink-900)] tabular-nums leading-none">
          {value < 10 ? String(value).padStart(2, "0") : value}
        </p>
        {trend && (
          <span className={clsx("inline-flex items-center gap-0.5 text-[11px] font-bold mb-0.5", trend.up ? "text-emerald-500" : "text-red-500")}>
            {trend.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{trend.pct}%
          </span>
        )}
      </div>
      {sub && <p className="text-[11px] text-[var(--color-ink-400)] mt-0.5">{sub}</p>}
    </div>
  );
}

function HourlyBarChart({ appts }: { appts: Appt[] }) {
  const LABELS = ["8 AM","9 AM","10 AM","11 AM","12 PM","1 PM","2 PM","3 PM","4 PM","5 PM"];
  const sched = useMemo(() => {
    const a = new Array(10).fill(0);
    appts.forEach(ap => {
      if (["CANCELLED","RESCHEDULED"].includes(ap.status)) return;
      const h = new Date(ap.dateTime).getHours() - 8;
      if (h >= 0 && h < 10) a[h]++;
    });
    return a;
  }, [appts]);
  const done = useMemo(() => {
    const a = new Array(10).fill(0);
    appts.forEach(ap => {
      if (ap.status !== "DISPENSED") return;
      const h = new Date(ap.dateTime).getHours() - 8;
      if (h >= 0 && h < 10) a[h]++;
    });
    return a;
  }, [appts]);
  const maxY = Math.max(...sched, 1);
  const yMax = Math.ceil(maxY / 5) * 5 || 5;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => Math.round(t * yMax));
  const CH = 80, PL = 22, PB = 18, BW = 7, GAP = 3, GW = BW * 2 + GAP + 6;
  const W = PL + LABELS.length * GW + 4;
  return (
    <svg viewBox={`0 0 ${W} ${CH + PB}`} className="w-full overflow-visible">
      {yTicks.map(t => {
        const y = CH - (t / yMax) * CH;
        return (
          <g key={t}>
            <line x1={PL} y1={y} x2={W} y2={y} stroke="#f1f5f9" strokeWidth="1" />
            <text x={PL - 3} y={y + 3} textAnchor="end" fontSize="7" fill="#94a3b8">{t}</text>
          </g>
        );
      })}
      {LABELS.map((lbl, i) => {
        const x = PL + i * GW;
        const sh = (sched[i] / yMax) * CH;
        const dh = (done[i] / yMax) * CH;
        return (
          <g key={lbl}>
            <rect x={x}            y={CH - sh}       width={BW} height={Math.max(sh, 1.5)} rx="2" fill="#3b82f6" fillOpacity="0.85" />
            <rect x={x + BW + GAP} y={CH - dh}       width={BW} height={Math.max(dh, 1.5)} rx="2" fill="#10b981" fillOpacity="0.85" />
            <text x={x + BW}       y={CH + PB - 3}   textAnchor="middle" fontSize="6.5" fill="#94a3b8">{lbl}</text>
          </g>
        );
      })}
    </svg>
  );
}

function DonutChart({ segments }: { segments: { color: string; value: number }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const CX = 50, CY = 50, R = 36, SW = 15, circ = 2 * Math.PI * R;
  let off = 0;
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      {total === 0
        ? <circle cx={CX} cy={CY} r={R} fill="none" stroke="#e2e8f0" strokeWidth={SW} />
        : segments.map((s, i) => {
            const len = (s.value / total) * circ;
            const rot = -90 + (off / total) * 360;
            off += s.value;
            return <circle key={i} cx={CX} cy={CY} r={R} fill="none" stroke={s.color} strokeWidth={SW}
              strokeDasharray={`${len} ${circ - len}`} transform={`rotate(${rot} ${CX} ${CY})`} />;
          })
      }
      <text x={CX} y={CY - 5} textAnchor="middle" fontSize="16" fontWeight="700" fill="#0f172a">{total}</text>
      <text x={CX} y={CY + 9} textAnchor="middle" fontSize="7" fill="#64748b">Total Patients</text>
    </svg>
  );
}

function MedicalBg() {
  return (
    <svg viewBox="0 0 400 160" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="mbg2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c8ddf5" /><stop offset="100%" stopColor="#a8c4e8" />
        </linearGradient>
      </defs>
      <rect width="400" height="160" fill="url(#mbg2)" />
      <circle cx="360" cy="20"  r="70" fill="white" fillOpacity="0.10" />
      <circle cx="380" cy="130" r="80" fill="white" fillOpacity="0.07" />
      <circle cx="220" cy="150" r="50" fill="white" fillOpacity="0.09" />
      <g transform="translate(195,20)" fill="none" stroke="#2a5298" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.18">
        <path d="M50,0 C50,0 50,35 50,48 C50,68 34,82 14,82 C-6,82 -22,68 -22,48 C-22,36 -14,26 0,21" />
        <circle cx="50" cy="-5" r="9" /><path d="M0,21 L0,8" />
        <path d="M-22,60 C-22,76 -12,88 4,90 L4,102" /><circle cx="4" cy="107" r="7" />
      </g>
      <g stroke="#1e3a8a" strokeWidth="2.5" strokeLinecap="round" opacity="0.16">
        <line x1="300" y1="55" x2="300" y2="73" /><line x1="291" y1="64" x2="309" y2="64" />
        <line x1="335" y1="100" x2="335" y2="114" /><line x1="328" y1="107" x2="342" y2="107" />
        <line x1="255" y1="22" x2="255" y2="32" /><line x1="250" y1="27" x2="260" y2="27" />
      </g>
      {([[280,78],[315,55],[248,108],[355,78],[330,140],[230,70]] as [number,number][]).map(([cx,cy],i) => (
        <circle key={i} cx={cx} cy={cy} r="3" fill="#1d4ed8" fillOpacity="0.18" />
      ))}
    </svg>
  );
}

/* ── Main ─────────────────────────────────────────────────────────────────── */
export function DashboardClient({
  scope, permissions, bannerTitle, bannerSubtitle, todayLabel,
  appts, filterOptions, newEncounterHref, followUps = [],
  analytics, yesterdayCounts,
}: DashboardProps) {
  const [selFilter,   setSelFilter]   = useState("ALL");
  const [chartRange,  setChartRange]  = useState<"today"|"week"|"month">("today");
  const [lastUpdated, setLastUpdated] = useState("");

  useEffect(() => { setLastUpdated(format(new Date(), "h:mm a")); }, []);

  const canView  = permissions.includes("patients.view");
  const canQueue = permissions.includes("appointments.manage") || permissions.includes("appointments.queue");
  const isDoc    = scope === "DOCTOR";
  const hour     = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const vis = useMemo(() => {
    if (selFilter === "ALL") return appts;
    return isDoc ? appts.filter(a => a.hospital?.id === selFilter) : appts.filter(a => a.doctor?.id === selFilter);
  }, [appts, selFilter, isDoc]);

  const kpi = useMemo(() => {
    const ef = (a: Appt) => apptEffectiveStatus(a);
    return {
      total:    vis.filter(a => !["CANCELLED","RESCHEDULED"].includes(a.status)).length,
      waiting:  vis.filter(a => a.status === "CONFIRMED" && !(a.visitId && !a.visitFinalizedAt)).length,
      inConsult:vis.filter(a => ef(a) === "IN_CONSULTATION").length,
      completed:vis.filter(a => a.status === "DISPENSED").length,
      noShow:   vis.filter(a => a.status === "NO_SHOW").length,
      newPats:  vis.filter(a => a.isWalkIn).length,
    };
  }, [vis]);

  const flow = useMemo(() => ({
    registered: vis.filter(a => !["CANCELLED","RESCHEDULED","NO_SHOW"].includes(a.status)).length,
    waiting:    vis.filter(a => a.status === "CONFIRMED" && !(a.visitId && !a.visitFinalizedAt)).length,
    inConsult:  vis.filter(a => apptEffectiveStatus(a) === "IN_CONSULTATION").length,
    completed:  vis.filter(a => a.status === "DISPENSED").length,
  }), [vis]);

  const breakdown = useMemo(() => {
    const a = vis.filter(x => !["CANCELLED","RESCHEDULED","NO_SHOW"].includes(x.status));
    return {
      newPats:   a.filter(x => x.isWalkIn && x.visitType !== "Follow-up").length,
      returning: a.filter(x => !x.isWalkIn && x.visitType !== "Follow-up").length,
      followUps: a.filter(x => x.visitType === "Follow-up").length,
    };
  }, [vis]);

  const rows = useMemo(() =>
    vis.filter(a => !["CANCELLED","RESCHEDULED"].includes(a.status))
       .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()),
    [vis]);

  const selName = selFilter === "ALL"
    ? (filterOptions[0]?.name ?? "")
    : (filterOptions.find(f => f.id === selFilter)?.name ?? "");

  return (
    <div className="space-y-4 pb-10">

      {/* Banner */}
      <div className="rounded-2xl overflow-hidden border border-[var(--color-border)] shadow-sm flex" style={{ minHeight: 152 }}>
        <div className="flex-1 bg-white px-7 py-6 flex flex-col justify-center min-w-0">
          <p className="text-[13px] font-semibold text-[var(--color-primary-600)] mb-0.5">{greeting},</p>
          <h1 className="text-[22px] font-bold text-[var(--color-ink-900)] leading-tight">{bannerTitle}</h1>
          <p className="text-[12px] text-[var(--color-ink-400)] mt-1">
            {bannerSubtitle ?? "Here's your overview across all assigned hospitals today."}
          </p>
          <div className="flex items-center gap-1.5 mt-3">
            <Calendar size={13} className="text-[var(--color-ink-400)]" />
            <span className="text-[12px] font-medium text-[var(--color-ink-500)]">{todayLabel}</span>
          </div>
        </div>
        <div className="relative hidden sm:flex items-start justify-end gap-3 px-5 py-5 shrink-0" style={{ width: 380 }}>
          <MedicalBg />
          {filterOptions.length > 0 && (
            <div className="relative z-10 bg-white/90 backdrop-blur-sm rounded-xl border border-white/60 shadow-md px-4 py-3 min-w-[185px]">
              <p className="text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-wide mb-2">
                {isDoc ? "All Hospitals" : "All Doctors"}
              </p>
              <div className="flex items-center gap-2 mb-1">
                <Building2 size={13} className="text-[var(--color-ink-500)] shrink-0" />
                <div className="relative flex-1 min-w-0">
                  <select value={selFilter} onChange={e => setSelFilter(e.target.value)}
                    className="w-full appearance-none bg-transparent text-[12px] font-semibold text-[var(--color-ink-800)] pr-5 focus:outline-none cursor-pointer truncate">
                    <option value="ALL">{isDoc ? "All Hospitals" : "All Doctors"}</option>
                    {filterOptions.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                  <ChevronDown size={11} className="absolute right-0 top-0.5 text-[var(--color-ink-400)] pointer-events-none" />
                </div>
              </div>
              {selFilter !== "ALL" && (
                <div className="flex items-center gap-1">
                  <MapPin size={10} className="text-[var(--color-ink-400)] shrink-0" />
                  <span className="text-[10px] text-[var(--color-ink-400)] truncate">{selName}</span>
                </div>
              )}
            </div>
          )}
          <div className="relative z-10 bg-white/90 backdrop-blur-sm rounded-xl border border-white/60 shadow-md px-4 py-3 shrink-0 text-center">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-1">
              <Users size={15} className="text-blue-600" />
            </div>
            <p className="text-[16px] font-bold text-[var(--color-ink-900)] tabular-nums">{filterOptions.length}</p>
            <p className="text-[10px] text-[var(--color-ink-400)]">{isDoc ? "Hospitals" : "Doctors"}</p>
            <p className="text-[9px] text-[var(--color-ink-400)]">You have access to</p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard icon={<Calendar size={20} className="text-blue-500" />}
          label="Today's Appointments" value={kpi.total}
          sub={yesterdayCounts ? `${yesterdayCounts.total} scheduled yesterday` : `${filterOptions.length} hospitals`}
          trend={yesterdayCounts ? trendPct(kpi.total, yesterdayCounts.total) : null} />
        <KpiCard icon={<Users size={20} className="text-amber-500" />}
          label="Waiting Patients" value={kpi.waiting}
          sub={`${kpi.waiting} in queue`}
          trend={yesterdayCounts ? trendPct(kpi.waiting, yesterdayCounts.waiting) : null} />
        <KpiCard icon={<Stethoscope size={20} className="text-teal-500" />}
          label="In Consultation" value={kpi.inConsult}
          sub={`${kpi.inConsult} ongoing`} trend={null} />
        <KpiCard icon={<CheckCircle2 size={20} className="text-emerald-500" />}
          label="Completed" value={kpi.completed}
          sub={yesterdayCounts ? `${yesterdayCounts.completed} completed yesterday` : undefined}
          trend={yesterdayCounts ? trendPct(kpi.completed, yesterdayCounts.completed) : null} />
        <KpiCard icon={<UserX size={20} className="text-red-500" />}
          label="No Shows" value={kpi.noShow}
          sub={yesterdayCounts ? `${yesterdayCounts.noShow} yesterday` : undefined}
          trend={yesterdayCounts && (kpi.noShow > 0 || yesterdayCounts.noShow > 0) ? trendPct(kpi.noShow, yesterdayCounts.noShow) : null} />
        <KpiCard icon={<UserPlus size={20} className="text-violet-500" />}
          label="New Patients" value={kpi.newPats}
          sub={yesterdayCounts ? `${yesterdayCounts.newPats} yesterday` : "Walk-ins today"}
          trend={yesterdayCounts ? trendPct(kpi.newPats, yesterdayCounts.newPats) : null} />
      </div>

      {/* Main 2-col */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] 2xl:grid-cols-[1fr_340px] gap-4 items-start">

        {/* Queue */}
        <div className="surface-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2">
              <Calendar size={15} className="text-[var(--color-ink-500)]" />
              <h2 className="text-[13px] font-bold text-[var(--color-ink-900)]">Today&apos;s Appointment Queue</h2>
            </div>
            <div className="flex items-center gap-3">
              {filterOptions.length > 1 && (
                <div className="relative hidden sm:block">
                  <Building2 size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]" />
                  <select value={selFilter} onChange={e => setSelFilter(e.target.value)}
                    className="appearance-none pl-7 pr-7 py-1.5 text-[11px] font-medium text-[var(--color-ink-700)] border border-[var(--color-border)] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-300)] cursor-pointer">
                    <option value="ALL">All {isDoc ? "Hospitals" : "Doctors"}</option>
                    {filterOptions.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                  <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] pointer-events-none" />
                </div>
              )}
              <Link href="/appointments" className="flex items-center gap-1 text-[11px] font-semibold text-[var(--color-primary-600)] hover:text-[var(--color-primary-700)] whitespace-nowrap">
                View All <ArrowRight size={12} />
              </Link>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <Calendar size={36} className="text-[var(--color-ink-300)] mb-3" />
              <p className="text-[13px] font-semibold text-[var(--color-ink-500)]">No appointments today</p>
              <p className="text-[11px] text-[var(--color-ink-400)] mt-1">Your schedule is clear.</p>
              <Link href={newEncounterHref} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--color-primary-600)] text-white text-[12px] font-semibold hover:bg-[var(--color-primary-700)] transition-colors">
                <UserPlus size={13} /> New Encounter
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px]">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-sunken)]">
                    {["Time","Patient","MRN","Type",isDoc ? "Hospital" : "Doctor","Status","Action"].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(a => <QueueRow key={a.id} appt={a} canView={canView} canQueue={canQueue} isDoc={isDoc} />)}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface-sunken)]">
            <div className="flex items-center gap-1.5">
              <UserCheck size={12} className="text-[var(--color-ink-400)]" />
              <span className="text-[11px] text-[var(--color-ink-500)]">
                You have <span className="font-bold text-[var(--color-ink-800)]">{kpi.waiting}</span> patient{kpi.waiting !== 1 ? "s" : ""} waiting in the queue
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {lastUpdated && <span className="text-[10px] text-[var(--color-ink-400)] hidden sm:block">Last updated at {lastUpdated}</span>}
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
              </span>
            </div>
          </div>
        </div>

        {/* Right (doctor only) */}
        {isDoc && (
          <div className="flex flex-col gap-4">
            {/* Patient Flow */}
            <div className="surface-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity size={14} className="text-[var(--color-ink-500)]" />
                  <h3 className="text-[13px] font-bold text-[var(--color-ink-900)]">Patient Flow</h3>
                </div>
                <span className="text-[10px] text-[var(--color-ink-400)] bg-[var(--color-surface-sunken)] px-2 py-0.5 rounded-full">Today</span>
              </div>
              <div className="flex items-center justify-between gap-1">
                {[
                  { lbl: "Registered",   n: flow.registered, color: "#3b82f6", icon: <Users size={14} className="text-white" /> },
                  { lbl: "Waiting",      n: flow.waiting,    color: "#f59e0b", icon: <Clock size={14} className="text-white" /> },
                  { lbl: "Consultation", n: flow.inConsult,  color: "#14b8a6", icon: <Stethoscope size={14} className="text-white" /> },
                  { lbl: "Completed",    n: flow.completed,  color: "#22c55e", icon: <CheckCircle2 size={14} className="text-white" /> },
                ].map((s, i, arr) => (
                  <div key={s.lbl} className="flex items-center gap-0.5">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-sm" style={{ background: s.color }}>{s.icon}</div>
                      <span className="text-[9px] font-medium text-[var(--color-ink-400)] text-center whitespace-nowrap">{s.lbl}</span>
                      <span className="text-[17px] font-bold tabular-nums leading-none" style={{ color: s.color }}>{s.n}</span>
                    </div>
                    {i < arr.length - 1 && <ArrowRight size={11} className="text-[var(--color-ink-300)] shrink-0 mb-5" />}
                  </div>
                ))}
              </div>
            </div>

            {/* Appointments Overview */}
            <div className="surface-card p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BarChart2 size={14} className="text-[var(--color-ink-500)]" />
                  <h3 className="text-[13px] font-bold text-[var(--color-ink-900)]">Appointments Overview</h3>
                </div>
                <div className="flex gap-0.5">
                  {(["today","week","month"] as const).map(r => (
                    <button key={r} onClick={() => setChartRange(r)}
                      className={clsx("text-[9px] font-semibold px-2 py-1 rounded-md transition-colors",
                        chartRange === r ? "bg-[var(--color-primary-600)] text-white" : "text-[var(--color-ink-400)] hover:text-[var(--color-ink-600)]")}>
                      {r === "today" ? "Today" : r === "week" ? "This Week" : "This Month"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-4 mb-2">
                <span className="flex items-center gap-1 text-[10px] text-[var(--color-ink-500)]">
                  <span className="w-2.5 h-2 rounded-sm inline-block bg-blue-500" /> Scheduled
                </span>
                <span className="flex items-center gap-1 text-[10px] text-[var(--color-ink-500)]">
                  <span className="w-2.5 h-2 rounded-sm inline-block bg-emerald-500" /> Completed
                </span>
              </div>
              <HourlyBarChart appts={vis} />
            </div>

            {/* Patient Overview */}
            <div className="surface-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <UserCheck size={14} className="text-[var(--color-ink-500)]" />
                <h3 className="text-[13px] font-bold text-[var(--color-ink-900)]">Patient Overview</h3>
              </div>
              <div className="flex items-center gap-4">
                <div style={{ width: 96, height: 96 }} className="shrink-0">
                  <DonutChart segments={[
                    { color: "#14b8a6", value: breakdown.newPats },
                    { color: "#3b82f6", value: breakdown.returning },
                    { color: "#f59e0b", value: breakdown.followUps },
                  ]} />
                </div>
                <div className="flex flex-col gap-2.5 flex-1 min-w-0">
                  {[
                    { lbl: "New Patients",      val: breakdown.newPats,   color: "#14b8a6" },
                    { lbl: "Returning Patients", val: breakdown.returning, color: "#3b82f6" },
                    { lbl: "Follow-ups",         val: breakdown.followUps, color: "#f59e0b" },
                  ].map(item => {
                    const tot = breakdown.newPats + breakdown.returning + breakdown.followUps;
                    const pct = tot > 0 ? Math.round((item.val / tot) * 100) : 0;
                    return (
                      <div key={item.lbl} className="flex items-center justify-between gap-1">
                        <span className="flex items-center gap-1.5 text-[11px] text-[var(--color-ink-600)] min-w-0">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
                          <span className="truncate">{item.lbl}</span>
                        </span>
                        <span className="text-[11px] font-bold text-[var(--color-ink-800)] tabular-nums shrink-0">
                          {item.val} <span className="font-normal text-[var(--color-ink-400)]">({pct}%)</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom row */}
      <div className={clsx("grid gap-4", isDoc ? "grid-cols-1 lg:grid-cols-[2fr_1fr_1fr]" : "grid-cols-1 md:grid-cols-2")}>
        {/* Quick Actions */}
        <div className="surface-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={14} className="text-[var(--color-ink-500)]" />
            <h3 className="text-[13px] font-bold text-[var(--color-ink-900)]">Quick Actions</h3>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {[
              { lbl: "Register Patient",    href: "/patients/new",              icon: <UserPlus size={22} className="text-blue-600" />,   bg: "#eff6ff" },
              { lbl: "Book Appointment",    href: "/appointments/book",         icon: <Calendar size={22} className="text-violet-600" />, bg: "#f5f3ff" },
              { lbl: "Walk-in",             href: newEncounterHref,             icon: <LogIn size={22} className="text-teal-600" />,      bg: "#f0fdfa" },
              { lbl: "Patient Search",      href: "/patients",                  icon: <Search size={22} className="text-emerald-600" />,  bg: "#f0fdf4" },
              { lbl: "Doctor Availability", href: "/settings?section=schedule", icon: <UserCog size={22} className="text-amber-600" />,   bg: "#fffbeb" },
              { lbl: "Reports",             href: "/reports",                   icon: <BarChart2 size={22} className="text-rose-600" />,  bg: "#fff1f2" },
            ].map(a => (
              <Link key={a.lbl} href={a.href}
                className="flex flex-col items-center gap-2 py-3 px-2 rounded-xl border border-[var(--color-border)] hover:shadow-sm hover:border-[var(--color-primary-200)] transition-all group">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform" style={{ background: a.bg }}>{a.icon}</div>
                <span className="text-[10px] font-semibold text-[var(--color-ink-500)] text-center leading-tight group-hover:text-[var(--color-ink-800)]">{a.lbl}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Upcoming Follow Ups */}
        <div className="surface-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[13px] font-bold text-[var(--color-ink-900)]">Upcoming Follow Ups</h3>
            {followUps.length > 0 && (
              <Link href="/appointments" className="text-[11px] font-semibold text-[var(--color-primary-600)] hover:text-[var(--color-primary-700)]">View all</Link>
            )}
          </div>
          {followUps.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <CheckCircle2 size={28} className="text-[var(--color-ink-300)] mb-2" />
              <p className="text-[12px] font-medium text-[var(--color-ink-500)]">No upcoming follow-ups</p>
              <p className="text-[11px] text-[var(--color-ink-400)] mt-0.5">All clear for the next 7 days.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {followUps.slice(0, 4).map(fu => {
                const dt = new Date(fu.dateTime);
                return (
                  <PatientLink key={fu.id} udid={fu.patient.udid} canView={canView}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-primary-200)] hover:bg-[var(--color-primary-50)] transition-all group cursor-pointer">
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-[var(--color-ink-800)] truncate group-hover:text-[var(--color-primary-700)]">{fu.patient.name}</p>
                      <p className="text-[10px] text-[var(--color-ink-400)] mt-0.5 truncate">
                        {format(dt, "d MMM yyyy")} · {format(dt, "h:mm a")} · {fu.hospital.name}
                      </p>
                    </div>
                    <ArrowRight size={13} className="shrink-0 text-[var(--color-ink-300)] group-hover:text-[var(--color-primary-500)]" />
                  </PatientLink>
                );
              })}
            </div>
          )}
        </div>

        {/* AI Copilot */}
        <div className="surface-card p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-[13px] font-bold text-[var(--color-ink-900)]">AI Clinical Copilot</h3>
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-100 text-blue-700 border border-blue-200">New</span>
          </div>
          <div className="flex items-start gap-3 flex-1">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg,#ede9fe,#dbeafe)" }}>
              <Cpu size={26} className="text-violet-500" />
            </div>
            <div className="flex flex-col gap-2 min-w-0">
              <p className="text-[11px] text-[var(--color-ink-500)] leading-relaxed">
                Get AI powered insights, patient summaries and clinical support.
              </p>
              <p className="text-[10px] text-[var(--color-ink-400)]">
                Open any active consultation to access AI Copilot from within the EMR.
              </p>
            </div>
          </div>
          <Link href="/patients"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[var(--color-primary-700)] text-white text-[12px] font-semibold hover:bg-[var(--color-primary-800)] transition-colors mt-auto">
            Open Copilot <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ── Queue Row ────────────────────────────────────────────────────────────── */
function QueueRow({ appt, canView, canQueue, isDoc }: {
  appt: Appt; canView: boolean; canQueue: boolean; isDoc: boolean;
}) {
  const [undoing, startUndo] = useTransition();
  const eff      = apptEffectiveStatus(appt);
  const time     = format(new Date(appt.dateTime), "h:mm a");
  const since    = appt.arrivedAt ?? appt.dateTime;
  const emrHref  = appt.visitId
    ? `/emr/${appt.patient.udid}?visit=${appt.visitId}&returnTo=/dashboard`
    : `/emr/${appt.patient.udid}?returnTo=/dashboard`;
  const isOpen   = appt.status === "CONFIRMED" || eff === "IN_CONSULTATION";
  const actHref  = isOpen && canView ? emrHref : `/patients/${appt.patient.udid}?returnTo=/dashboard`;
  const typeLbl  = appt.visitType === "Follow-up" ? "Follow-up"
    : appt.isWalkIn ? "Walk-in"
    : (appt.visitType ?? "OPD");

  return (
    <tr className="group border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-sunken)] transition-colors">
      <td className="px-4 py-3">
        <p className="text-[12px] font-bold text-[var(--color-ink-800)] tabular-nums whitespace-nowrap">{time}</p>
      </td>
      <td className="px-4 py-3">
        <PatientLink udid={appt.patient.udid} canView={canView} className="flex items-center gap-2.5">
          <Avatar name={appt.patient.name} size={30} />
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-[var(--color-ink-900)] truncate max-w-[140px] group-hover:text-[var(--color-primary-700)]">{appt.patient.name}</p>
            <p className="text-[10px] text-[var(--color-ink-400)]">MRN: {appt.patient.uhid || appt.patient.udid}</p>
          </div>
        </PatientLink>
      </td>
      <td className="px-4 py-3">
        <span className="font-mono text-[10px] text-[var(--color-ink-400)]">{appt.patient.uhid || "—"}</span>
      </td>
      <td className="px-4 py-3"><TypeBadge label={typeLbl} /></td>
      <td className="px-4 py-3">
        {isDoc
          ? appt.hospital && <span className="text-[11px] text-[var(--color-ink-600)] truncate max-w-[120px] block">{appt.hospital.name}</span>
          : appt.doctor   && <span className="text-[11px] text-[var(--color-ink-600)] truncate max-w-[120px] block">{appt.doctor.name}</span>
        }
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1 items-start">
          <StatusBadge status={eff} />
          {appt.status === "CONFIRMED" && <LiveTimer since={since} />}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          {isOpen && canView ? (
            <Link href={actHref}
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-3 py-1.5 rounded-lg bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] transition-colors whitespace-nowrap">
              {eff === "IN_CONSULTATION" ? "Continue" : "Open"}
            </Link>
          ) : (
            <Link href={`/patients/${appt.patient.udid}?returnTo=/dashboard`}
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] transition-colors">
              <Eye size={10} /> View
            </Link>
          )}
          {appt.status === "CONFIRMED" && canQueue && (
            <button disabled={undoing} title="Move back"
              onClick={() => startUndo(async () => { await undoQueueEntry(appt.id); })}
              className="p-1.5 rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-ink-400)] hover:text-amber-600 hover:border-amber-300 hover:bg-amber-50 disabled:opacity-50 transition-all">
              {undoing ? <Loader2 size={11} className="animate-spin" /> : <Undo2 size={11} />}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
