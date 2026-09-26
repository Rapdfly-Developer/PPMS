"use client";

import { useState, useMemo, useEffect, useTransition, type ReactNode } from "react";
import { format } from "date-fns";
import Link from "next/link";
import {
  ChevronDown, Plus, Building2, LogIn, Loader2,
  Calendar, Clock, Undo2, CalendarX2,
  Users, UserCheck, UserMinus, Activity, TrendingUp, TrendingDown,
  ChevronRight, Stethoscope, ArrowRight, Bot,
  Search, CalendarPlus, PersonStanding, BarChart2,
} from "lucide-react";
import clsx from "clsx";
import { undoQueueEntry, undoPartialDispense } from "@/app/(app)/appointments/actions";

/* ── Types ──────────────────────────────────────────────────────────────── */
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
  partialDispenseAt: string | null;
  patient: { name: string; udid: string; uhid?: string; age: number; sex: string; mobile?: string };
  hospital?: { id: string; name: string; logoUrl?: string | null };
  doctor?: { id: string; name: string } | null;
  visitId: string | null;
  visitStartedAt: string | null;
  visitFinalizedAt: string | null;
}

interface UpcomingFollowUp {
  id: string;
  dateTime: string;
  patient: { name: string; udid: string };
  hospitalName: string;
}

export interface HomeDashboardProps {
  scope: "DOCTOR" | "HOSPITAL";
  permissions: string[];
  bannerTitle: string;
  bannerSubtitle?: string;
  todayLabel: string;
  appts: Appt[];
  filterOptions: { id: string; name: string; logoUrl?: string | null }[];
  newEncounterHref: string;
  newEncounterLabel: string;
  yesterdayCount?: number;
  upcomingFollowUps?: UpcomingFollowUp[];
}

/* ── Status config ──────────────────────────────────────────────────────── */
const STATUS_CFG: Record<string, { label: string; color: string; dot: string }> = {
  REQUESTED:        { label: "Scheduled",       color: "bg-blue-100 text-blue-700",      dot: "bg-blue-500"    },
  CONFIRMED:        { label: "Waiting",          color: "bg-amber-100 text-amber-700",    dot: "bg-amber-500"   },
  IN_CONSULTATION:  { label: "In Consultation",  color: "bg-[#1e3a5f] text-white",        dot: "bg-blue-300"    },
  DISPENSED:        { label: "Completed",        color: "bg-emerald-100 text-emerald-700",dot: "bg-emerald-500" },
  CANCELLED:        { label: "Cancelled",        color: "bg-red-100 text-red-600",        dot: "bg-red-500"     },
  NO_SHOW:          { label: "No Show",          color: "bg-gray-100 text-gray-500",      dot: "bg-gray-400"    },
  RESCHEDULED:      { label: "Rescheduled",      color: "bg-purple-100 text-purple-700",  dot: "bg-purple-500"  },
  PARTIAL_DISPENSE: { label: "Partial Dispense", color: "bg-orange-100 text-orange-700",  dot: "bg-orange-500"  },
};

/* ── Avatar initials ────────────────────────────────────────────────────── */
const AVATAR_COLORS = [
  "bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-teal-500",
];

function PatientAvatar({ name }: { name: string }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const color = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
  return (
    <div className={clsx("shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-[11px]", color)}>
      {initials}
    </div>
  );
}

/* ── Live waiting timer ─────────────────────────────────────────────────── */
function LiveTimer({ since }: { since: string }) {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const elapsed = now - new Date(since).getTime();
  if (elapsed <= 0) return null;
  const totalMins = Math.floor(elapsed / 60_000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  const label = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  const color = totalMins > 30 ? "text-red-500" : totalMins > 15 ? "text-amber-500" : "text-emerald-600";
  return (
    <span suppressHydrationWarning className={clsx("inline-flex items-center gap-0.5 text-[9px] font-semibold", color)}>
      <Clock size={9} /> {label}
    </span>
  );
}

/* ── PatientBlock ───────────────────────────────────────────────────────── */
function PatientBlock({ udid, canView, className, children }: {
  udid: string; canView: boolean; className: string; children: ReactNode;
}) {
  if (!canView) return <div className={className}>{children}</div>;
  return <Link href={`/patients/${udid}?returnTo=/dashboard`} className={className}>{children}</Link>;
}

/* ── KPI card ───────────────────────────────────────────────────────────── */
function KpiCard({ icon, iconBg, label, value, sub, pct, pctUp }: {
  icon: ReactNode; iconBg: string; label: string; value: number; sub: string; pct?: number; pctUp?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[var(--color-border)] p-3 flex flex-col gap-2 min-w-0">
      <div className="flex items-center justify-between">
        <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center", iconBg)}>
          {icon}
        </div>
        {pct !== undefined && (
          <span className={clsx("inline-flex items-center gap-0.5 text-[11px] font-semibold", pctUp ? "text-emerald-600" : "text-red-500")}>
            {pctUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {pct}%
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-[var(--color-ink-900)] tabular-nums leading-none">
          {String(value).padStart(2, "0")}
        </p>
        <p className="text-[12px] font-semibold text-[var(--color-ink-700)] mt-1">{label}</p>
        <p className="text-[10px] text-[var(--color-ink-400)] mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

/* ── Appointments bar chart ─────────────────────────────────────────────── */
function AppointmentsBarChart({ appts }: { appts: Appt[] }) {
  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
  const data = hours.map((h) => ({
    h,
    scheduled: appts.filter((a) => new Date(a.dateTime).getHours() === h && a.status !== "DISPENSED").length,
    completed: appts.filter((a) => new Date(a.dateTime).getHours() === h && a.status === "DISPENSED").length,
  }));
  const maxVal = Math.max(...data.map((d) => d.scheduled + d.completed), 5);
  const chartH = 56;
  const barW = 14;
  const gap = 16;
  const totalW = hours.length * (barW + gap);

  return (
    <svg viewBox={`0 0 ${totalW} ${chartH + 18}`} className="w-full" preserveAspectRatio="none">
      {data.map(({ h, scheduled, completed }, i) => {
        const x = i * (barW + gap) + 1;
        const totalH = ((scheduled + completed) / maxVal) * chartH;
        const complH = (completed / maxVal) * chartH;
        const schedH = totalH - complH;
        const label = h > 12 ? `${h - 12}PM` : h === 12 ? "12P" : `${h}AM`;
        return (
          <g key={h}>
            {schedH > 0 && <rect x={x} y={chartH - totalH} width={barW} height={schedH} fill="#93c5fd" rx={2} />}
            {complH > 0 && <rect x={x} y={chartH - complH} width={barW} height={complH} fill="#10b981" rx={2} />}
            {totalH === 0 && <rect x={x} y={chartH - 3} width={barW} height={3} fill="#e5e7eb" rx={1} />}
            <text x={x + barW / 2} y={chartH + 12} textAnchor="middle" fontSize={7} fill="#9ca3af">{label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── Patient donut chart ────────────────────────────────────────────────── */
function PatientDonut({ segments, total }: {
  total: number; segments: { value: number; color: string; label: string }[];
}) {
  const r = 32;
  const cx = 42;
  const cy = 42;
  const circumference = 2 * Math.PI * r;
  let cumulativeAngle = -90;

  return (
    <svg width={84} height={84} viewBox="0 0 84 84" className="shrink-0">
      {total === 0 ? (
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth={12} />
      ) : (
        segments.map((seg, i) => {
          if (seg.value === 0) return null;
          const fraction = seg.value / total;
          const dash = fraction * circumference;
          const gap = circumference - dash;
          const rotAngle = cumulativeAngle;
          cumulativeAngle += fraction * 360;
          return (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none"
              stroke={seg.color} strokeWidth={12}
              strokeDasharray={`${dash} ${gap}`} strokeLinecap="butt"
              transform={`rotate(${rotAngle} ${cx} ${cy})`}
            />
          );
        })
      )}
      <text x={cx} y={cy - 5} textAnchor="middle" fontSize={13} fontWeight="700" fill="#111827">{total}</text>
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize={6} fill="#9ca3af">Total Patients</text>
    </svg>
  );
}

/* ── Table appointment row ──────────────────────────────────────────────── */
function TableApptRow({ appt, scope, canManageQueue, canViewPatient }: {
  appt: Appt; scope: "DOCTOR" | "HOSPITAL"; canManageQueue: boolean; canViewPatient: boolean;
}) {
  const [undoing, startUndo] = useTransition();
  const isInConsultation = !!(appt.visitId && !appt.visitFinalizedAt);
  const statusKey = isInConsultation ? "IN_CONSULTATION" : appt.status;
  const cfg = STATUS_CFG[statusKey] ?? STATUS_CFG["REQUESTED"];
  const time = format(new Date(appt.dateTime), "hh:mm a");
  const visitTypeLabel = appt.isWalkIn ? "Walk-in" : (appt.visitType ?? "General OPD");
  const isActive = appt.status === "CONFIRMED" || isInConsultation;

  return (
    <tr className="border-b border-gray-50 hover:bg-blue-50/40 transition-colors">
      <td className="px-4 py-3 text-[12px] font-medium text-[var(--color-ink-600)] whitespace-nowrap">{time}</td>
      <td className="px-4 py-3">
        <PatientBlock udid={appt.patient.udid} canView={canViewPatient} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <PatientAvatar name={appt.patient.name} />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[var(--color-ink-900)] truncate">{appt.patient.name}</p>
            <p className="text-[10px] text-[var(--color-ink-400)]">
              {appt.patient.age}y / {appt.patient.sex === "MALE" ? "M" : appt.patient.sex === "FEMALE" ? "F" : "O"}
            </p>
            <p className="text-[10px] font-mono text-[#115E59] mt-0.5">
              MRN: {appt.patient.uhid || appt.patient.udid}
            </p>
          </div>
        </PatientBlock>
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        <span className={clsx(
          "inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap",
          visitTypeLabel === "Follow-up" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
        )}>
          {visitTypeLabel}
        </span>
      </td>
      <td className="px-4 py-3 hidden xl:table-cell">
        <div className="flex items-center gap-1.5">
          {scope === "DOCTOR" ? (
            <><Building2 size={12} className="shrink-0 text-[var(--color-ink-400)]" />
            <span className="text-[12px] text-[var(--color-ink-600)] truncate max-w-[140px]">{appt.hospital?.name ?? "—"}</span></>
          ) : (
            <><Stethoscope size={12} className="shrink-0 text-[var(--color-ink-400)]" />
            <span className="text-[12px] text-[var(--color-ink-600)] truncate max-w-[140px]">{appt.doctor ? `Dr. ${appt.doctor.name}` : "—"}</span></>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1 items-start">
          <span className={clsx("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap", cfg.color)}>
            <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", cfg.dot)} />
            {cfg.label}
          </span>
          {appt.status === "CONFIRMED" && <LiveTimer since={appt.arrivedAt ?? appt.dateTime} />}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          {isActive ? (
            <Link href={`/patients/${appt.patient.udid}?returnTo=/dashboard`}
              className="px-3 py-1.5 rounded-lg bg-[var(--color-primary-700)] text-white text-[11px] font-semibold hover:opacity-90 transition-opacity whitespace-nowrap">
              Open
            </Link>
          ) : (
            <Link href={`/patients/${appt.patient.udid}?returnTo=/dashboard`}
              className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-ink-700)] text-[11px] font-semibold hover:bg-[var(--color-surface-sunken)] transition-colors whitespace-nowrap">
              View
            </Link>
          )}
          {appt.status === "CONFIRMED" && canManageQueue && (
            <button disabled={undoing} title="Move back to appointment time"
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

/* ── Partial dispense table row ─────────────────────────────────────────── */
function PartialDispenseRow({ appt: a, scope, canDispense, canViewPatient }: {
  appt: Appt; scope: "DOCTOR" | "HOSPITAL"; canDispense: boolean; canViewPatient: boolean;
}) {
  const [undoing, startUndo] = useTransition();
  return (
    <tr className="border-b border-orange-100 bg-orange-50/50 hover:bg-orange-50 transition-colors">
      <td className="px-4 py-3 text-[12px] font-medium text-orange-600 whitespace-nowrap">
        {format(new Date(a.dateTime), "hh:mm a")}
      </td>
      <td className="px-4 py-3">
        <PatientBlock udid={a.patient.udid} canView={canViewPatient} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <PatientAvatar name={a.patient.name} />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[var(--color-ink-900)] truncate">{a.patient.name}</p>
            <p className="text-[10px] text-[var(--color-ink-400)]">{a.patient.age}y / {a.patient.sex === "MALE" ? "M" : "F"}</p>
            <p className="text-[10px] font-mono text-[#115E59] mt-0.5">MRN: {a.patient.uhid || a.patient.udid}</p>
          </div>
        </PatientBlock>
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700 whitespace-nowrap">Partial</span>
      </td>
      <td className="px-4 py-3 hidden xl:table-cell">
        {scope === "DOCTOR" && a.hospital && <span className="text-[12px] text-[var(--color-ink-600)]">{a.hospital.name}</span>}
        {scope === "HOSPITAL" && a.doctor && <span className="text-[12px] text-[var(--color-ink-600)]">Dr. {a.doctor.name}</span>}
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />Partial Dispense
        </span>
      </td>
      <td className="px-4 py-3">
        {canDispense && (
          <button disabled={undoing}
            onClick={() => startUndo(async () => { await undoPartialDispense(a.id); })}
            className="px-3 py-1.5 rounded-lg border border-orange-300 bg-white text-orange-700 text-[11px] font-semibold hover:bg-orange-50 disabled:opacity-50 transition-all">
            {undoing ? <Loader2 size={11} className="animate-spin" /> : "To Queue"}
          </button>
        )}
      </td>
    </tr>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */
export function HomeDashboardClient({
  scope, permissions, bannerTitle, bannerSubtitle, todayLabel,
  appts, filterOptions, newEncounterHref, newEncounterLabel,
  yesterdayCount = 0, upcomingFollowUps = [],
}: HomeDashboardProps) {
  const can = (p: string) => permissions.includes("*") || permissions.includes(p);
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [greetHour, setGreetHour] = useState<number | null>(null);

  useEffect(() => { setGreetHour(new Date().getHours()); }, []);

  const filteredAppts = useMemo(() => {
    if (selectedFilter === "all") return appts;
    return scope === "DOCTOR"
      ? appts.filter((a) => a.hospital?.id === selectedFilter)
      : appts.filter((a) => a.doctor?.id === selectedFilter);
  }, [appts, selectedFilter, scope]);

  const kpi = useMemo(() => {
    const waiting   = filteredAppts.filter((a) => a.status === "CONFIRMED").length;
    const inConsult = filteredAppts.filter((a) => a.visitId && !a.visitFinalizedAt).length;
    const completed = filteredAppts.filter((a) => a.status === "DISPENSED").length;
    const noShow    = filteredAppts.filter((a) => a.status === "NO_SHOW").length;
    const newPts    = filteredAppts.filter((a) => !a.visitType || a.visitType === "General OPD" || a.isWalkIn).length;
    const total     = filteredAppts.length;
    const totalPct  = yesterdayCount > 0 ? Math.round(((total - yesterdayCount) / yesterdayCount) * 100) : null;
    return { total, waiting, inConsult, completed, noShow, newPts, totalPct };
  }, [filteredAppts, yesterdayCount]);

  const patientFlow = useMemo(() => ({
    registered:   filteredAppts.length,
    waiting:      filteredAppts.filter((a) => a.status === "CONFIRMED").length,
    consultation: filteredAppts.filter((a) => a.visitId && !a.visitFinalizedAt).length,
    completed:    filteredAppts.filter((a) => a.status === "DISPENSED").length,
  }), [filteredAppts]);

  const patientOverview = useMemo(() => {
    const followUp  = filteredAppts.filter((a) => a.visitType === "Follow-up").length;
    const newPts    = filteredAppts.filter((a) => a.isWalkIn || !a.visitType || a.visitType === "General OPD").length;
    const returning = Math.max(0, filteredAppts.length - followUp - newPts);
    return { followUp, newPts, returning };
  }, [filteredAppts]);

  const tableRows = useMemo(() => ({
    active:  filteredAppts.filter((a) => a.status !== "PARTIAL_DISPENSE"),
    partial: filteredAppts.filter((a) => a.status === "PARTIAL_DISPENSE"),
  }), [filteredAppts]);

  const h = greetHour ?? 8;
  const greeting = h >= 18 ? "Good Evening" : h >= 12 ? "Good Afternoon" : "Good Morning";

  return (
    <div className="fade-in flex flex-col gap-4">

      {/* ── Greeting banner ──────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-[var(--color-border)] shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-primary-50)] via-white to-white pointer-events-none" />
        {/* Healthcare background image — right side, fades into the white left area */}
        <div className="absolute right-0 top-0 h-full w-64 sm:w-80 pointer-events-none overflow-hidden hidden sm:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/landing/v3/hero-clinician-tablet-dashboard.jpg" alt="" className="w-full h-full object-cover object-left" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/60 to-transparent" />
        </div>
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 sm:p-5">
          <div>
            <p className="text-[13px] text-[var(--color-ink-400)] font-medium mb-0.5">{greeting}</p>
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-ink-900)]">{bannerTitle}</h1>
            {bannerSubtitle && <p className="text-[13px] text-[var(--color-ink-500)] mt-0.5">{bannerSubtitle}</p>}
            <p className="text-[12px] text-[var(--color-ink-400)] mt-1">
              Here&apos;s your overview across all assigned hospitals today.
            </p>
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-ink-500)]">
              <Calendar size={12} /> {todayLabel}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {can("appointments.view") && filterOptions.length > 0 && (
              <div className="bg-white rounded-xl border border-[var(--color-border)] p-3 min-w-[160px] shadow-sm">
                <p className="text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-wide mb-1">
                  {scope === "DOCTOR" ? "All Hospitals" : "All Doctors"}
                </p>
                <div className="relative">
                  <select value={selectedFilter} onChange={(e) => setSelectedFilter(e.target.value)}
                    className="w-full appearance-none pr-6 text-[13px] font-semibold text-[var(--color-ink-800)] bg-transparent focus:outline-none cursor-pointer">
                    <option value="all">All</option>
                    {filterOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>{scope === "HOSPITAL" ? `Dr. ${opt.name}` : opt.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-ink-400)]" />
                </div>
              </div>
            )}
            <div className="bg-white rounded-xl border border-[var(--color-border)] p-3 shadow-sm text-center min-w-[120px]">
              <p className="text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-wide">
                {filterOptions.length} Hospital{filterOptions.length !== 1 ? "s" : ""}
              </p>
              <p className="text-[12px] text-[var(--color-ink-500)] mt-0.5">You have access to</p>
            </div>
            {can("opd.walkin.create") && (
              <Link href={newEncounterHref}
                className="inline-flex items-center gap-2 bg-[var(--color-primary-700)] text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity shadow-sm whitespace-nowrap">
                <Plus size={15} /> {newEncounterLabel}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── KPI cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard icon={<Calendar size={18} className="text-blue-600" />} iconBg="bg-blue-100"
          label="Today's Appointments" value={kpi.total}
          sub={yesterdayCount > 0 ? `${yesterdayCount} scheduled yesterday` : "All visits today"}
          pct={kpi.totalPct !== null ? Math.abs(kpi.totalPct) : undefined}
          pctUp={kpi.totalPct !== null ? kpi.totalPct >= 0 : undefined} />
        <KpiCard icon={<Users size={18} className="text-amber-600" />} iconBg="bg-amber-100"
          label="Waiting Patients" value={kpi.waiting} sub={`${kpi.waiting} in queue`} />
        <KpiCard icon={<Stethoscope size={18} className="text-[var(--color-primary-600)]" />} iconBg="bg-[var(--color-primary-50)]"
          label="In Consultation" value={kpi.inConsult} sub={`${kpi.inConsult} ongoing`} />
        <KpiCard icon={<UserCheck size={18} className="text-emerald-600" />} iconBg="bg-emerald-100"
          label="Completed" value={kpi.completed} sub={`${kpi.completed} completed`} />
        <KpiCard icon={<UserMinus size={18} className="text-red-500" />} iconBg="bg-red-100"
          label="No Shows" value={kpi.noShow} sub="Did not arrive" />
        <KpiCard icon={<Activity size={18} className="text-violet-600" />} iconBg="bg-violet-100"
          label="New Patients" value={kpi.newPts} sub="New registrations" />
      </div>

      {/* ── Two-column ────────────────────────────────────────────────── */}
      <div className="flex flex-col xl:flex-row gap-4">

        {/* LEFT: Appointment queue table */}
        {can("opd.view") && (
          <div className="flex-1 min-w-0 bg-white rounded-2xl border border-[var(--color-border)] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] shrink-0">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-[var(--color-primary-600)]" />
                <h2 className="text-[15px] font-bold text-[var(--color-ink-900)]">Today&apos;s Appointment Queue</h2>
                <span className="ml-1 px-2 py-0.5 rounded-full bg-[var(--color-primary-50)] text-[var(--color-primary-700)] text-[10px] font-bold">
                  {tableRows.active.length + tableRows.partial.length}
                </span>
              </div>
              {can("appointments.view") && (
                <Link href="/appointments" className="text-[12px] font-semibold text-[var(--color-primary-600)] hover:underline flex items-center gap-1">
                  View All <ArrowRight size={12} />
                </Link>
              )}
            </div>

            {tableRows.active.length + tableRows.partial.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3 text-center px-6">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-[var(--color-surface-sunken)]">
                  <CalendarX2 size={28} className="text-[var(--color-ink-300)]" />
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-[var(--color-ink-700)]">No appointments today</p>
                  <p className="text-[13px] text-[var(--color-ink-400)] mt-1 max-w-xs mx-auto">
                    Confirmed appointments will appear here once patients arrive.
                  </p>
                </div>
                {can("opd.walkin.create") && (
                  <Link href={newEncounterHref} className="inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--color-primary-600)] hover:underline">
                    <Plus size={14} /> {newEncounterLabel}
                  </Link>
                )}
              </div>
            ) : (
              <div className="overflow-auto max-h-[280px]">
                <table className="w-full text-left min-w-[480px]">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-sunken)]">
                      {["Time", "Patient", "Type", scope === "DOCTOR" ? "Hospital" : "Doctor", "Status", "Action"].map((h, i) => (
                        <th key={h} className={clsx(
                          "px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)]",
                          i === 2 && "hidden lg:table-cell",
                          i === 3 && "hidden xl:table-cell",
                        )}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.partial.map((a) => (
                      <PartialDispenseRow key={a.id} appt={a} scope={scope}
                        canDispense={can("opd.dispense")} canViewPatient={can("patients.view")} />
                    ))}
                    {tableRows.active.map((a) => (
                      <TableApptRow key={a.id} appt={a} scope={scope}
                        canManageQueue={can("opd.queue.manage")} canViewPatient={can("patients.view")} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </div>
        )}

        {/* RIGHT: Stats panels */}
        <div className="xl:w-72 2xl:w-80 shrink-0 flex flex-col gap-3">

          {/* Patient Flow */}
          <div className="bg-white rounded-2xl border border-[var(--color-border)] p-3">
            <div className="flex items-center gap-2 mb-3">
              <Activity size={14} className="text-[var(--color-primary-600)]" />
              <h3 className="text-[13px] font-bold text-[var(--color-ink-900)]">Patient Flow</h3>
              <span className="ml-auto text-[10px] text-[var(--color-ink-400)]">Today</span>
            </div>
            <div className="flex items-center gap-1">
              {[
                { label: "Registered",   value: patientFlow.registered,   color: "bg-blue-500",                    Icon: Users },
                { label: "Waiting",      value: patientFlow.waiting,      color: "bg-amber-500",                   Icon: Clock },
                { label: "Consult",      value: patientFlow.consultation, color: "bg-[var(--color-primary-600)]",  Icon: Stethoscope },
                { label: "Completed",    value: patientFlow.completed,    color: "bg-emerald-500",                 Icon: UserCheck },
              ].map((step, i, arr) => (
                <div key={step.label} className="flex items-center gap-1 flex-1 min-w-0">
                  <div className="flex-1 min-w-0 text-center">
                    <div className={clsx("w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-1", step.color)}>
                      <step.Icon size={14} className="text-white" />
                    </div>
                    <p className="text-[9px] font-semibold text-[var(--color-ink-500)] leading-tight">{step.label}</p>
                    <p className="text-base font-bold text-[var(--color-ink-900)] tabular-nums">{step.value}</p>
                  </div>
                  {i < arr.length - 1 && <ArrowRight size={10} className="text-[var(--color-ink-300)] shrink-0" />}
                </div>
              ))}
            </div>
          </div>

          {/* Appointments Overview */}
          <div className="bg-white rounded-2xl border border-[var(--color-border)] p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <BarChart2 size={14} className="text-[var(--color-primary-600)]" />
                <h3 className="text-[13px] font-bold text-[var(--color-ink-900)]">Appointments Overview</h3>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-[var(--color-primary-700)] text-white">Today</span>
            </div>
            <div className="flex items-center gap-3 mb-1 mt-1">
              <span className="inline-flex items-center gap-1 text-[10px] text-[var(--color-ink-400)]">
                <span className="w-2 h-2 rounded-sm bg-blue-300 inline-block" /> Scheduled
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] text-[var(--color-ink-400)]">
                <span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" /> Completed
              </span>
            </div>
            <AppointmentsBarChart appts={filteredAppts} />
          </div>

          {/* Patient Overview */}
          <div className="bg-white rounded-2xl border border-[var(--color-border)] p-3">
            <div className="flex items-center gap-2 mb-2">
              <Users size={14} className="text-[var(--color-primary-600)]" />
              <h3 className="text-[13px] font-bold text-[var(--color-ink-900)]">Patient Overview</h3>
            </div>
            <div className="flex items-center gap-4">
              <PatientDonut
                total={filteredAppts.length}
                segments={[
                  { value: patientOverview.newPts,    color: "#3b82f6", label: "New" },
                  { value: patientOverview.returning, color: "#10b981", label: "Returning" },
                  { value: patientOverview.followUp,  color: "#f59e0b", label: "Follow-ups" },
                ]}
              />
              <div className="flex flex-col gap-2 flex-1 min-w-0">
                {[
                  { label: "New Patients", value: patientOverview.newPts,    color: "bg-blue-500" },
                  { label: "Returning",    value: patientOverview.returning, color: "bg-emerald-500" },
                  { label: "Follow-ups",   value: patientOverview.followUp,  color: "bg-amber-500" },
                ].map(({ label, value, color }) => {
                  const pct = filteredAppts.length > 0 ? Math.round((value / filteredAppts.length) * 100) : 0;
                  return (
                    <div key={label} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={clsx("w-2 h-2 rounded-full shrink-0", color)} />
                        <span className="text-[11px] text-[var(--color-ink-600)] truncate">{label}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[12px] font-bold text-[var(--color-ink-900)] tabular-nums">{value}</span>
                        <span className="text-[10px] text-[var(--color-ink-400)]">({pct}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Bottom row: Quick Actions + Upcoming Follow Ups + AI Copilot ── */}
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)] gap-4">

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl border border-[var(--color-border)] p-4">
          <div className="flex items-center gap-2 mb-3">
            <ChevronRight size={15} className="text-[var(--color-primary-600)]" />
            <p className="text-[14px] font-bold text-[var(--color-ink-900)]">Quick Actions</p>
          </div>
          <div className="flex gap-2">
            {can("patients.create") && (
              <Link href="/patients/new" className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] hover:bg-[var(--color-primary-50)] hover:border-[var(--color-primary-200)] transition-colors text-center min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[var(--color-primary-50)] flex items-center justify-center">
                  <PersonStanding size={17} className="text-[var(--color-primary-600)]" />
                </div>
                <span className="text-[10px] font-semibold text-[var(--color-ink-600)] leading-tight w-full px-1 truncate">Register Patient</span>
              </Link>
            )}
            {can("appointments.create") && (
              <Link href="/appointments/new" className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] hover:bg-[var(--color-primary-50)] hover:border-[var(--color-primary-200)] transition-colors text-center min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[var(--color-primary-50)] flex items-center justify-center">
                  <CalendarPlus size={17} className="text-[var(--color-primary-600)]" />
                </div>
                <span className="text-[10px] font-semibold text-[var(--color-ink-600)] leading-tight w-full px-1 truncate">Book Appointment</span>
              </Link>
            )}
            {can("opd.walkin.create") && (
              <Link href="/appointments/new?type=walkin" className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] hover:bg-[var(--color-primary-50)] hover:border-[var(--color-primary-200)] transition-colors text-center min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[var(--color-primary-50)] flex items-center justify-center">
                  <LogIn size={17} className="text-[var(--color-primary-600)]" />
                </div>
                <span className="text-[10px] font-semibold text-[var(--color-ink-600)] leading-tight w-full px-1 truncate">Walk-in</span>
              </Link>
            )}
            {can("patients.view") && (
              <Link href="/patients" className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] hover:bg-[var(--color-primary-50)] hover:border-[var(--color-primary-200)] transition-colors text-center min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[var(--color-primary-50)] flex items-center justify-center">
                  <Search size={17} className="text-[var(--color-primary-600)]" />
                </div>
                <span className="text-[10px] font-semibold text-[var(--color-ink-600)] leading-tight w-full px-1 truncate">Patient Search</span>
              </Link>
            )}
            {can("reports.view") && (
              <Link href="/analytics" className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] hover:bg-[var(--color-primary-50)] hover:border-[var(--color-primary-200)] transition-colors text-center min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[var(--color-primary-50)] flex items-center justify-center">
                  <BarChart2 size={17} className="text-[var(--color-primary-600)]" />
                </div>
                <span className="text-[10px] font-semibold text-[var(--color-ink-600)] leading-tight w-full px-1 truncate">Reports</span>
              </Link>
            )}
          </div>
        </div>

        {/* Upcoming Follow Ups */}
        <div className="bg-white rounded-2xl border border-[var(--color-border)] p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Calendar size={15} className="text-[var(--color-primary-600)]" />
              <h3 className="text-[14px] font-bold text-[var(--color-ink-900)]">Upcoming Follow Ups</h3>
            </div>
            {can("appointments.view") && (
              <Link href="/appointments" className="text-[11px] font-semibold text-[var(--color-primary-600)] hover:underline">View all</Link>
            )}
          </div>
          {upcomingFollowUps.length === 0 ? (
            <p className="text-[12px] text-[var(--color-ink-400)] text-center py-6">No upcoming follow-ups this week</p>
          ) : (
            <div className="flex flex-col divide-y divide-[var(--color-border)]">
              {upcomingFollowUps.map((f) => (
                <div key={f.id} className="flex items-center justify-between py-2.5 gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[var(--color-ink-900)] truncate">{f.patient.name}</p>
                    <p className="text-[10px] text-[var(--color-ink-400)] mt-0.5">
                      {format(new Date(f.dateTime), "dd MMM · hh:mm a")} · {f.hospitalName}
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-[var(--color-ink-300)] shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Clinical Copilot */}
        <div className="bg-[var(--color-primary-50)] border border-[var(--color-primary-100)] rounded-2xl p-3 flex flex-col">
          <div className="flex items-start gap-2.5 flex-1">
            <div className="w-10 h-10 rounded-xl bg-white border border-[var(--color-primary-100)] flex items-center justify-center shrink-0 shadow-sm">
              <Bot size={20} className="text-[var(--color-primary-600)]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[13px] font-bold text-[var(--color-ink-900)]">AI Clinical Copilot</p>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--color-primary-700)] text-white">New</span>
              </div>
              <p className="text-[11px] text-[var(--color-ink-500)] leading-relaxed">
                AI powered insights and clinical support.
              </p>
            </div>
          </div>
          <Link href="/ai-copilot"
            className="mt-3 flex items-center justify-center gap-2 w-full py-1.5 rounded-xl bg-[var(--color-primary-700)] text-white text-[12px] font-bold hover:opacity-90 transition-opacity">
            Open Copilot <ArrowRight size={13} />
          </Link>
        </div>

      </div>

    </div>
  );
}
