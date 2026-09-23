"use client";

import { useState, useMemo, useEffect, useTransition, type ReactNode } from "react";
import { format, isToday, isTomorrow } from "date-fns";
import Link from "next/link";
import {
  ChevronDown, Plus, Building2, Phone, LogIn, Loader2,
  Sun, Sunset, Moon, CalendarX2, Calendar, Clock, Undo2,
  Users, UserCheck, Activity, CheckCircle2, Bell, BrainCircuit,
  TrendingUp, UserPlus, Search, BarChart2, ArrowRight, Eye,
  Stethoscope, Timer, ClipboardList, AlertCircle,
} from "lucide-react";
import clsx from "clsx";
import { undoQueueEntry, undoPartialDispense } from "@/app/(app)/appointments/actions";
import { formatComplaintDisplay } from "@/lib/appointment-cc";

/* ── Types ─────────────────────────────────────────────────────────────── */
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
}

/* ── Status config ──────────────────────────────────────────────────────── */
const STATUS_CFG: Record<string, { label: string; color: string; dot: string; bg: string }> = {
  REQUESTED:        { label: "Scheduled",        color: "text-blue-700",    dot: "bg-blue-500",    bg: "bg-blue-50 border-blue-200"   },
  CONFIRMED:        { label: "Waiting",           color: "text-amber-700",   dot: "bg-amber-500",   bg: "bg-amber-50 border-amber-200"  },
  DISPENSED:        { label: "Completed",         color: "text-emerald-700", dot: "bg-emerald-500", bg: "bg-emerald-50 border-emerald-200" },
  CANCELLED:        { label: "Cancelled",         color: "text-red-600",     dot: "bg-red-500",     bg: "bg-red-50 border-red-200"      },
  NO_SHOW:          { label: "No Show",           color: "text-gray-500",    dot: "bg-gray-400",    bg: "bg-gray-50 border-gray-200"    },
  RESCHEDULED:      { label: "Rescheduled",       color: "text-purple-700",  dot: "bg-purple-500",  bg: "bg-purple-50 border-purple-200" },
  PARTIAL_DISPENSE: { label: "Partial Dispense",  color: "text-orange-700",  dot: "bg-orange-500",  bg: "bg-orange-50 border-orange-200" },
  IN_CONSULTATION:  { label: "In Consultation",   color: "text-teal-700",    dot: "bg-teal-500",    bg: "bg-teal-50 border-teal-200"    },
};

const VISIT_TYPE_FILTERS = [
  { key: "WALK_IN",     label: "Walk-in"     },
  { key: "General OPD", label: "General OPD" },
  { key: "Follow-up",   label: "Follow-up"   },
  { key: "Emergency",   label: "Emergency"   },
] as const;

type VisitTypeFilterKey = typeof VISIT_TYPE_FILTERS[number]["key"] | "ALL";

/* ── Helpers ────────────────────────────────────────────────────────────── */
function apptEffectiveStatus(a: Appt): string {
  if (a.status === "CONFIRMED" && a.visitId && !a.visitFinalizedAt) return "IN_CONSULTATION";
  return a.status;
}

function sexShort(s: string) {
  return s === "MALE" ? "M" : s === "FEMALE" ? "F" : "O";
}

/* ── Live waiting timer ─────────────────────────────────────────────────── */
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
  const cls = className ?? "";
  if (!canView) return <div className={cls}>{children}</div>;
  return <Link href={`/patients/${udid}?returnTo=/dashboard`} className={cls}>{children}</Link>;
}

/* ── KPI Card ───────────────────────────────────────────────────────────── */
function KpiCard({ icon, value, label, sub, accent, trend }: {
  icon: ReactNode; value: number | string; label: string; sub?: string; accent: string; trend?: string;
}) {
  return (
    <div className="surface-card px-4 py-4 flex items-start gap-3 min-w-0">
      <div className={clsx("shrink-0 w-10 h-10 rounded-xl flex items-center justify-center", accent)}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-2xl font-bold text-[var(--color-ink-900)] tabular-nums leading-tight">{value}</p>
        <p className="text-[11px] font-semibold text-[var(--color-ink-500)] mt-0.5 leading-tight">{label}</p>
        {sub && <p className="text-[10px] text-[var(--color-ink-400)] mt-1 leading-snug">{sub}</p>}
        {trend && <p className="text-[10px] text-emerald-600 font-medium mt-1">{trend}</p>}
      </div>
    </div>
  );
}

/* ── Status badge ───────────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG["REQUESTED"];
  return (
    <span className={clsx("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border", cfg.bg, cfg.color)}>
      <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

/* ── Appointment table row ──────────────────────────────────────────────── */
function ApptTableRow({ appt, serial, canManageQueue, canViewPatient }: {
  appt: Appt; serial: number; canManageQueue: boolean; canViewPatient: boolean;
}) {
  const [undoing, startUndo] = useTransition();
  const effStatus   = apptEffectiveStatus(appt);
  const apptTime    = format(new Date(appt.dateTime), "h:mm a");
  const timerSince  = appt.arrivedAt ?? appt.dateTime;

  const actionLabel = effStatus === "IN_CONSULTATION" ? "Continue"
    : appt.status === "CONFIRMED" ? "Start"
    : appt.status === "DISPENSED" ? "View"
    : "View";

  const emrHref = appt.visitId
    ? `/emr/${appt.patient.udid}?visit=${appt.visitId}&returnTo=/dashboard`
    : `/emr/${appt.patient.udid}?returnTo=/dashboard`;

  const actionHref = (appt.status === "CONFIRMED" || effStatus === "IN_CONSULTATION") && canViewPatient
    ? emrHref
    : `/patients/${appt.patient.udid}?returnTo=/dashboard`;

  return (
    <tr className="group border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-primary-50)] transition-colors">
      <td className="px-3 py-3 text-center">
        <span className="text-[11px] font-bold text-[var(--color-ink-400)] tabular-nums">{serial}</span>
      </td>
      <td className="px-3 py-3">
        <p className="text-[12px] font-bold text-[var(--color-ink-900)] tabular-nums">{apptTime}</p>
        <p className="text-[10px] text-[var(--color-ink-400)] mt-0.5">
          {format(new Date(appt.createdAt), "h:mm a")}
        </p>
      </td>
      <td className="px-3 py-3">
        <PatientLink udid={appt.patient.udid} canView={canViewPatient}>
          <p className="text-[12px] font-semibold text-[var(--color-ink-900)] truncate max-w-[140px] group-hover:text-[var(--color-primary-700)]">
            {appt.patient.name}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="font-mono text-[9px] text-[#115E59] bg-[#F0F8F6] px-1.5 py-0.5 rounded">
              {appt.patient.udid}
            </span>
            <span className="text-[10px] text-[var(--color-ink-400)]">
              {appt.patient.age}y / {sexShort(appt.patient.sex)}
            </span>
          </div>
        </PatientLink>
      </td>
      <td className="px-3 py-3 hidden md:table-cell">
        <span className="font-mono text-[10px] text-[var(--color-ink-500)]">{appt.patient.uhid || "—"}</span>
      </td>
      <td className="px-3 py-3 hidden lg:table-cell">
        {appt.hospital && (
          <div className="flex items-center gap-1.5 min-w-0">
            <Building2 size={11} className="shrink-0 text-[var(--color-ink-400)]" />
            <span className="text-[11px] text-[var(--color-ink-600)] truncate max-w-[120px]">{appt.hospital.name}</span>
          </div>
        )}
      </td>
      <td className="px-3 py-3 hidden md:table-cell">
        <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)] whitespace-nowrap">
          {appt.isWalkIn ? "Walk-in" : (appt.visitType ?? "OPD")}
        </span>
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-col items-start gap-1">
          <StatusBadge status={effStatus} />
          {(appt.status === "CONFIRMED") && (
            <LiveTimer since={timerSince} />
          )}
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1.5">
          {canViewPatient && (appt.status === "CONFIRMED" || effStatus === "IN_CONSULTATION") ? (
            <Link
              href={actionHref}
              className={clsx(
                "inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap",
                effStatus === "IN_CONSULTATION"
                  ? "bg-teal-600 text-white hover:bg-teal-700"
                  : "bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)]"
              )}
            >
              <Stethoscope size={10} />
              {actionLabel}
            </Link>
          ) : (
            <Link
              href={`/patients/${appt.patient.udid}?returnTo=/dashboard`}
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-[var(--color-surface-sunken)] text-[var(--color-ink-600)] hover:bg-[var(--color-primary-50)] hover:text-[var(--color-primary-700)] transition-colors"
            >
              <Eye size={10} /> View
            </Link>
          )}
          {appt.status === "CONFIRMED" && canManageQueue && (
            <button
              disabled={undoing}
              title="Move back"
              onClick={() => startUndo(async () => { await undoQueueEntry(appt.id); })}
              className="p-1 rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-ink-400)] hover:text-amber-600 hover:border-amber-300 hover:bg-amber-50 disabled:opacity-50 transition-all"
            >
              {undoing ? <Loader2 size={11} className="animate-spin" /> : <Undo2 size={11} />}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

/* ── Waiting queue card ─────────────────────────────────────────────────── */
function WaitingCard({ appt, serial, canViewPatient }: {
  appt: Appt; serial: number; canViewPatient: boolean;
}) {
  const timerSince  = appt.arrivedAt ?? appt.dateTime;
  const emrHref     = appt.visitId
    ? `/emr/${appt.patient.udid}?visit=${appt.visitId}&returnTo=/dashboard`
    : `/emr/${appt.patient.udid}?returnTo=/dashboard`;
  const effStatus = apptEffectiveStatus(appt);

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--color-border)] bg-white hover:bg-[var(--color-primary-50)] hover:border-[var(--color-primary-200)] transition-colors">
      <span className="w-5 text-[10px] font-bold text-[var(--color-ink-400)] tabular-nums shrink-0 text-center">{serial}</span>
      <div className="flex-1 min-w-0">
        <PatientLink udid={appt.patient.udid} canView={canViewPatient}>
          <p className="text-[12px] font-semibold text-[var(--color-ink-900)] truncate">{appt.patient.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="font-mono text-[9px] text-[#115E59] bg-[#F0F8F6] px-1.5 py-0.5 rounded">{appt.patient.udid}</span>
            {appt.hospital && (
              <span className="text-[10px] text-[var(--color-ink-400)] truncate">{appt.hospital.name}</span>
            )}
          </div>
        </PatientLink>
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1">
        <LiveTimer since={timerSince} />
        {canViewPatient && appt.status === "CONFIRMED" && (
          <Link
            href={emrHref}
            className={clsx(
              "text-[10px] font-semibold px-2 py-0.5 rounded-lg transition-colors",
              effStatus === "IN_CONSULTATION"
                ? "bg-teal-50 text-teal-700 hover:bg-teal-100"
                : "bg-[var(--color-primary-50)] text-[var(--color-primary-700)] hover:bg-[var(--color-primary-100)]"
            )}
          >
            {effStatus === "IN_CONSULTATION" ? "Continue" : "Start"}
          </Link>
        )}
      </div>
    </div>
  );
}

/* ── Mini bar chart ─────────────────────────────────────────────────────── */
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
        <div className={clsx("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-semibold text-[var(--color-ink-600)] w-5 text-right tabular-nums">{value}</span>
    </div>
  );
}

/* ── Workflow stage ─────────────────────────────────────────────────────── */
function WorkflowStage({ label, count, active, icon, onClick }: {
  label: string; count: number; active: boolean; icon: ReactNode; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex-1 flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-center transition-all cursor-pointer",
        active
          ? "bg-[var(--color-primary-600)] border-[var(--color-primary-600)] text-white"
          : "bg-white border-[var(--color-border)] text-[var(--color-ink-600)] hover:border-[var(--color-primary-300)] hover:bg-[var(--color-primary-50)]"
      )}
    >
      <span className={clsx("opacity-70", active ? "text-white" : "text-[var(--color-primary-600)]")}>{icon}</span>
      <span className="text-xl font-bold tabular-nums">{count}</span>
      <span className="text-[10px] font-semibold leading-tight">{label}</span>
    </button>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */
export function DashboardClient({
  scope, permissions, displayName, bannerTitle, bannerSubtitle, todayLabel,
  appts, filterOptions, newEncounterHref, newEncounterLabel, hospitalLogoUrl,
  followUps = [], analytics,
}: DashboardProps) {
  const can = (p: string) => permissions.includes("*") || permissions.includes(p);

  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [visitTypeFilter, setVisitTypeFilter] = useState<VisitTypeFilterKey>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [greetHour, setGreetHour] = useState<number | null>(null);
  const [workflowStage, setWorkflowStage] = useState<string | null>(null);
  const [analyticsRange, setAnalyticsRange] = useState<"today" | "week" | "month">("today");

  useEffect(() => { setGreetHour(new Date().getHours()); }, []);

  /* Filter by hospital */
  const filteredAppts = useMemo(() => {
    if (selectedFilter === "all") return appts;
    return scope === "DOCTOR"
      ? appts.filter((a) => a.hospital?.id === selectedFilter)
      : appts.filter((a) => a.doctor?.id === selectedFilter);
  }, [appts, selectedFilter, scope]);

  const filteredFollowUps = useMemo(() => {
    if (selectedFilter === "all") return followUps;
    return followUps.filter((f) => f.hospital.id === selectedFilter);
  }, [followUps, selectedFilter]);

  /* KPI counts */
  const kpi = useMemo(() => {
    const active     = filteredAppts.filter(a => !["CANCELLED","NO_SHOW","RESCHEDULED"].includes(a.status));
    const waiting    = filteredAppts.filter(a => a.status === "CONFIRMED" && !a.visitId);
    const inConsult  = filteredAppts.filter(a => a.status === "CONFIRMED" && a.visitId && !a.visitFinalizedAt);
    const completed  = filteredAppts.filter(a => a.status === "DISPENSED");
    const fuToday    = filteredAppts.filter(a => a.visitType === "Follow-up" && !["CANCELLED","NO_SHOW","RESCHEDULED"].includes(a.status));
    const newPats    = filteredAppts.filter(a => a.isWalkIn && !["CANCELLED","NO_SHOW","RESCHEDULED"].includes(a.status));
    return { total: active.length, waiting: waiting.length, inConsult: inConsult.length, completed: completed.length, followUps: fuToday.length, newPats: newPats.length };
  }, [filteredAppts]);

  /* All appts for table (include ALL statuses, not just queue) */
  const tableAppts = useMemo(() => {
    let list = filteredAppts;
    if (visitTypeFilter !== "ALL") {
      list = visitTypeFilter === "WALK_IN"
        ? list.filter(a => a.isWalkIn)
        : list.filter(a => a.visitType === visitTypeFilter);
    }
    if (statusFilter !== "ALL") {
      list = statusFilter === "IN_CONSULTATION"
        ? list.filter(a => apptEffectiveStatus(a) === "IN_CONSULTATION")
        : statusFilter === "CONFIRMED"
          ? list.filter(a => a.status === "CONFIRMED" && !a.visitId)
          : list.filter(a => a.status === statusFilter);
    }
    // Workflow stage filter overrides
    if (workflowStage) {
      switch (workflowStage) {
        case "SCHEDULED":    list = filteredAppts.filter(a => a.status === "REQUESTED"); break;
        case "WAITING":      list = filteredAppts.filter(a => a.status === "CONFIRMED" && !a.visitId); break;
        case "CONSULTATION": list = filteredAppts.filter(a => a.status === "CONFIRMED" && a.visitId && !a.visitFinalizedAt); break;
        case "COMPLETED":    list = filteredAppts.filter(a => a.status === "DISPENSED"); break;
      }
    }
    return list;
  }, [filteredAppts, visitTypeFilter, statusFilter, workflowStage]);

  /* Waiting queue */
  const waitingQueue = useMemo(
    () => filteredAppts.filter(a => a.status === "CONFIRMED").sort((a, b) => (a.arrivedAt ?? a.dateTime).localeCompare(b.arrivedAt ?? b.dateTime)),
    [filteredAppts]
  );

  /* Partial dispense */
  const partialAppts = useMemo(() => filteredAppts.filter(a => a.status === "PARTIAL_DISPENSE"), [filteredAppts]);

  /* Multi-hospital workload */
  const hospitalWorkload = useMemo(() => {
    if (scope !== "DOCTOR") return [];
    return filterOptions.map(h => {
      const hAppts = appts.filter(a => a.hospital?.id === h.id && !["CANCELLED","NO_SHOW","RESCHEDULED"].includes(a.status));
      return {
        id:        h.id,
        name:      h.name,
        total:     hAppts.length,
        completed: hAppts.filter(a => a.status === "DISPENSED").length,
        waiting:   hAppts.filter(a => a.status === "CONFIRMED" && !a.visitId).length,
        inConsult: hAppts.filter(a => a.status === "CONFIRMED" && a.visitId && !a.visitFinalizedAt).length,
      };
    });
  }, [appts, filterOptions, scope]);

  /* Workflow counts */
  const workflow = useMemo(() => ({
    scheduled:    filteredAppts.filter(a => a.status === "REQUESTED").length,
    waiting:      filteredAppts.filter(a => a.status === "CONFIRMED" && !a.visitId).length,
    consultation: filteredAppts.filter(a => a.status === "CONFIRMED" && a.visitId && !a.visitFinalizedAt).length,
    completed:    filteredAppts.filter(a => a.status === "DISPENSED").length,
  }), [filteredAppts]);

  /* Visible visit-type filters */
  const visibleVTFilters = useMemo(
    () => VISIT_TYPE_FILTERS.map(({ key, label }) => ({
      key, label,
      count: key === "WALK_IN"
        ? filteredAppts.filter(a => a.isWalkIn && !["CANCELLED","NO_SHOW","RESCHEDULED"].includes(a.status)).length
        : filteredAppts.filter(a => a.visitType === key && !["CANCELLED","NO_SHOW","RESCHEDULED"].includes(a.status)).length,
    })).filter(f => f.count > 0),
    [filteredAppts]
  );

  /* Greeting */
  const h           = greetHour ?? 8;
  const isEvening   = h >= 18;
  const isAfternoon = h >= 12;
  const greeting    = isEvening ? "Good Evening" : isAfternoon ? "Good Afternoon" : "Good Morning";
  const GreetIcon   = isEvening ? Moon : isAfternoon ? Sunset : Sun;
  const iconColor   = isEvening ? "text-indigo-300" : isAfternoon ? "text-orange-300" : "text-amber-300";
  const filterLabel = scope === "DOCTOR" ? "All Hospitals" : "All Doctors";

  /* Analytics data */
  const anaData = analytics?.[analyticsRange] ?? { scheduled: 0, completed: 0, noShow: 0 };
  const anaMax  = Math.max(anaData.scheduled, 1);

  return (
    <div className="fade-in space-y-5">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--color-primary-900)] via-[var(--color-primary-700)] to-[var(--color-primary-500)] px-6 py-5 text-white shadow-lg">
        {/* Decorative circles */}
        <div className="pointer-events-none absolute -top-10 -right-10 h-48 w-48 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-12 -right-20 h-64 w-64 rounded-full bg-white/5" />

        <div className="relative z-10">
          {/* Top row: greeting + actions */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <GreetIcon size={15} className={iconColor} />
                <span className="text-[12px] font-medium text-white/70 tracking-wide">{greeting}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-tight">{bannerTitle}</h1>
              {bannerSubtitle && <p className="mt-0.5 text-[12px] text-white/70">{bannerSubtitle}</p>}
              <p className="mt-1 text-[12px] text-white/60 flex items-center gap-1.5">
                <Calendar size={11} /> {todayLabel}
              </p>
            </div>

            {/* Right: controls */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Hospital filter */}
              {can("appointments.view") && filterOptions.length > 0 && (
                <div className="relative">
                  <select
                    value={selectedFilter}
                    onChange={(e) => setSelectedFilter(e.target.value)}
                    className="appearance-none pl-3 pr-7 py-2 rounded-xl border border-white/20 bg-white/10 text-[12px] font-medium text-white focus:outline-none cursor-pointer backdrop-blur-sm"
                  >
                    <option value="all" className="text-[var(--color-ink-800)]">{filterLabel}</option>
                    {filterOptions.map((opt) => (
                      <option key={opt.id} value={opt.id} className="text-[var(--color-ink-800)]">
                        {scope === "HOSPITAL" ? `Dr. ${opt.name}` : opt.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-white/70" />
                </div>
              )}

              {/* Quick actions */}
              <div className="flex items-center gap-1.5">
                {can("opd.walkin.create") && (
                  <Link
                    href={newEncounterHref}
                    className="inline-flex items-center gap-1.5 bg-white text-[var(--color-primary-800)] text-[11px] font-bold px-3 py-2 rounded-xl hover:bg-white/90 transition-colors shadow-sm"
                  >
                    <Plus size={12} /> {newEncounterLabel}
                  </Link>
                )}
                {can("appointments.create") && (
                  <Link
                    href="/appointments/book"
                    className="inline-flex items-center gap-1.5 bg-white/10 text-white border border-white/20 text-[11px] font-semibold px-3 py-2 rounded-xl hover:bg-white/20 transition-colors"
                  >
                    <Calendar size={12} /> Book Appt
                  </Link>
                )}
                {can("patients.create") && (
                  <Link
                    href="/patients/new"
                    className="inline-flex items-center gap-1.5 bg-white/10 text-white border border-white/20 text-[11px] font-semibold px-3 py-2 rounded-xl hover:bg-white/20 transition-colors"
                  >
                    <UserPlus size={12} /> Register
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard
          icon={<ClipboardList size={18} className="text-blue-600" />}
          value={kpi.total}
          label="Today's Appointments"
          sub={`${scope === "DOCTOR" ? filterOptions.length : 1} hospital${filterOptions.length !== 1 ? "s" : ""}`}
          accent="bg-blue-50"
        />
        <KpiCard
          icon={<Timer size={18} className="text-amber-600" />}
          value={kpi.waiting}
          label="Waiting"
          sub="In queue"
          accent="bg-amber-50"
        />
        <KpiCard
          icon={<Stethoscope size={18} className="text-teal-600" />}
          value={kpi.inConsult}
          label="In Consultation"
          sub="Currently open"
          accent="bg-teal-50"
        />
        <KpiCard
          icon={<CheckCircle2 size={18} className="text-emerald-600" />}
          value={kpi.completed}
          label="Completed"
          sub="Today"
          accent="bg-emerald-50"
        />
        <KpiCard
          icon={<Bell size={18} className="text-purple-600" />}
          value={filteredFollowUps.length}
          label="Follow-ups Due"
          sub="Next 7 days"
          accent="bg-purple-50"
        />
        <KpiCard
          icon={<UserPlus size={18} className="text-rose-600" />}
          value={kpi.newPats}
          label="New Patients"
          sub="Walk-ins today"
          accent="bg-rose-50"
        />
      </div>

      {/* ── Workflow visualization ────────────────────────────────────────── */}
      <div className="surface-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[13px] font-bold text-[var(--color-ink-900)]">
            Today's Consultation Flow
          </h2>
          {workflowStage && (
            <button onClick={() => setWorkflowStage(null)} className="text-[11px] text-[var(--color-primary-600)] hover:underline">
              Clear filter
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <WorkflowStage label="Scheduled" count={workflow.scheduled} active={workflowStage === "SCHEDULED"} icon={<Calendar size={14} />} onClick={() => setWorkflowStage(workflowStage === "SCHEDULED" ? null : "SCHEDULED")} />
          <ArrowRight size={12} className="shrink-0 text-[var(--color-ink-300)]" />
          <WorkflowStage label="Waiting" count={workflow.waiting} active={workflowStage === "WAITING"} icon={<Timer size={14} />} onClick={() => setWorkflowStage(workflowStage === "WAITING" ? null : "WAITING")} />
          <ArrowRight size={12} className="shrink-0 text-[var(--color-ink-300)]" />
          <WorkflowStage label="Consulting" count={workflow.consultation} active={workflowStage === "CONSULTATION"} icon={<Stethoscope size={14} />} onClick={() => setWorkflowStage(workflowStage === "CONSULTATION" ? null : "CONSULTATION")} />
          <ArrowRight size={12} className="shrink-0 text-[var(--color-ink-300)]" />
          <WorkflowStage label="Completed" count={workflow.completed} active={workflowStage === "COMPLETED"} icon={<CheckCircle2 size={14} />} onClick={() => setWorkflowStage(workflowStage === "COMPLETED" ? null : "COMPLETED")} />
        </div>
      </div>

      {/* ── Main grid: Appointment table + Right panel ───────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] 2xl:grid-cols-[1fr_340px] gap-5">

        {/* Left: Appointment queue table */}
        {can("opd.view") && (
          <div className="surface-card overflow-hidden">
            {/* Table header */}
            <div className="px-4 py-3 border-b border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-[13px] font-bold text-[var(--color-ink-900)]">
                  Today's Appointments
                </h2>
                <span className="text-[11px] font-medium text-[var(--color-ink-400)] bg-[var(--color-surface-sunken)] px-2 py-0.5 rounded-full">
                  {tableAppts.length}
                </span>
                {workflowStage && (
                  <span className="text-[10px] font-semibold text-[var(--color-primary-600)] bg-[var(--color-primary-50)] px-2 py-0.5 rounded-full">
                    {workflowStage.charAt(0) + workflowStage.slice(1).toLowerCase()}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Status filter */}
                <select
                  value={statusFilter}
                  onChange={e => { setStatusFilter(e.target.value); setWorkflowStage(null); }}
                  className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-ink-700)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-300)] cursor-pointer"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="REQUESTED">Scheduled</option>
                  <option value="CONFIRMED">Waiting</option>
                  <option value="IN_CONSULTATION">In Consultation</option>
                  <option value="DISPENSED">Completed</option>
                  <option value="NO_SHOW">No Show</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
                {/* Visit type filters */}
                {visibleVTFilters.map(({ key, label, count }) => (
                  <button
                    key={key}
                    onClick={() => { setVisitTypeFilter(visitTypeFilter === key ? "ALL" : key); setWorkflowStage(null); }}
                    className={clsx(
                      "text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-colors",
                      visitTypeFilter === key
                        ? "bg-[var(--color-primary-600)] text-white"
                        : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)] hover:bg-[var(--color-primary-50)] hover:text-[var(--color-primary-700)]"
                    )}
                  >
                    {label} <span className="font-bold">{count}</span>
                  </button>
                ))}
                {can("appointments.view") && (
                  <Link href="/appointments" className="text-[11px] font-semibold text-[var(--color-primary-600)] hover:underline whitespace-nowrap">
                    View all →
                  </Link>
                )}
              </div>
            </div>

            {/* Table */}
            {tableAppts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-[var(--color-surface-sunken)]">
                  <CalendarX2 size={24} className="text-[var(--color-ink-300)]" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-[var(--color-ink-700)]">No appointments</p>
                  <p className="text-[11px] text-[var(--color-ink-400)] mt-0.5">
                    {workflowStage || statusFilter !== "ALL" || visitTypeFilter !== "ALL"
                      ? "No matches for the current filter"
                      : "Confirmed appointments appear here once patients arrive"}
                  </p>
                </div>
                {can("opd.walkin.create") && !workflowStage && statusFilter === "ALL" && (
                  <Link href={newEncounterHref} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--color-primary-600)] hover:underline">
                    <Plus size={13} /> {newEncounterLabel}
                  </Link>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-sunken)]">
                      <th className="px-3 py-2 text-center w-8"><span className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-ink-400)]">#</span></th>
                      <th className="px-3 py-2 text-left"><span className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-ink-400)]">Time</span></th>
                      <th className="px-3 py-2 text-left"><span className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-ink-400)]">Patient</span></th>
                      <th className="px-3 py-2 text-left hidden md:table-cell"><span className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-ink-400)]">MRN</span></th>
                      <th className="px-3 py-2 text-left hidden lg:table-cell"><span className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-ink-400)]">Hospital</span></th>
                      <th className="px-3 py-2 text-left hidden md:table-cell"><span className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-ink-400)]">Type</span></th>
                      <th className="px-3 py-2 text-left"><span className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-ink-400)]">Status</span></th>
                      <th className="px-3 py-2 text-left"><span className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-ink-400)]">Action</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableAppts.map((a, idx) => (
                      <ApptTableRow
                        key={a.id}
                        appt={a}
                        serial={idx + 1}
                        canManageQueue={can("opd.queue.manage")}
                        canViewPatient={can("patients.view")}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Right panel */}
        <div className="flex flex-col gap-4">

          {/* Waiting Queue */}
          {can("opd.view") && (
            <div className="surface-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[13px] font-bold text-[var(--color-ink-900)] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                  Waiting Queue
                  <span className="text-[11px] font-normal text-[var(--color-ink-400)]">({waitingQueue.length})</span>
                </h2>
              </div>
              {waitingQueue.length === 0 ? (
                <p className="text-center text-[11px] text-[var(--color-ink-400)] py-6">No patients waiting</p>
              ) : (
                <div className="space-y-2">
                  {waitingQueue.slice(0, 6).map((a, idx) => (
                    <WaitingCard key={a.id} appt={a} serial={idx + 1} canViewPatient={can("patients.view")} />
                  ))}
                  {waitingQueue.length > 6 && (
                    <p className="text-center text-[11px] text-[var(--color-ink-400)] pt-1">+{waitingQueue.length - 6} more</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Partial Dispense (compact) */}
          {can("opd.view") && partialAppts.length > 0 && (
            <div className="surface-card p-4">
              <h2 className="text-[13px] font-bold text-[var(--color-ink-900)] mb-3 flex items-center gap-1.5">
                <AlertCircle size={13} className="text-orange-500" />
                Partial Dispense
                <span className="text-[11px] font-normal text-[var(--color-ink-400)]">({partialAppts.length})</span>
              </h2>
              <div className="space-y-2">
                {partialAppts.map((a) => (
                  <div key={a.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-orange-200 bg-orange-50">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-[var(--color-ink-900)] truncate">{a.patient.name}</p>
                      {a.partialDispenseReason && (
                        <p className="text-[10px] text-orange-700 truncate">{a.partialDispenseReason}</p>
                      )}
                    </div>
                    <LiveTimer since={a.arrivedAt ?? a.dateTime} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Copilot card */}
          <div className="surface-card p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--color-primary-50)] flex items-center justify-center shrink-0">
                <BrainCircuit size={16} className="text-[var(--color-primary-600)]" />
              </div>
              <div>
                <h3 className="text-[13px] font-bold text-[var(--color-ink-900)]">AI Clinical Copilot</h3>
                <p className="text-[10px] text-[var(--color-ink-400)] mt-0.5 leading-relaxed">
                  Review patient history, identify trends and get AI assistance during consultation.
                </p>
              </div>
            </div>
            <p className="text-[10px] text-[var(--color-ink-400)] mb-3">
              Open any active consultation to access AI Copilot from within the EMR.
            </p>
            {waitingQueue.length > 0 && can("patients.view") && (
              <Link
                href={waitingQueue[0].visitId
                  ? `/emr/${waitingQueue[0].patient.udid}?visit=${waitingQueue[0].visitId}&returnTo=/dashboard`
                  : `/emr/${waitingQueue[0].patient.udid}?returnTo=/dashboard`}
                className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-[var(--color-primary-600)] text-white text-[11px] font-semibold hover:bg-[var(--color-primary-700)] transition-colors"
              >
                <Stethoscope size={12} /> Start Next Consultation
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom grid: Follow-ups + Multi-hospital + Analytics ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Follow-ups */}
        <div className="surface-card p-4 lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-bold text-[var(--color-ink-900)]">Upcoming Follow-ups</h2>
            <Link href="/follow-ups" className="text-[11px] font-semibold text-[var(--color-primary-600)] hover:underline">
              View all →
            </Link>
          </div>
          {filteredFollowUps.length === 0 ? (
            <p className="text-center text-[11px] text-[var(--color-ink-400)] py-6">No follow-ups scheduled</p>
          ) : (
            <div className="space-y-2">
              {filteredFollowUps.slice(0, 5).map((f) => {
                const d   = new Date(f.dateTime);
                const lbl = isToday(d) ? "Today" : isTomorrow(d) ? "Tomorrow" : format(d, "d MMM");
                return (
                  <Link
                    key={f.id}
                    href={`/patients/${f.patient.udid}?returnTo=/dashboard`}
                    className="flex items-start gap-3 px-3 py-2.5 rounded-xl border border-[var(--color-border)] bg-white hover:bg-[var(--color-primary-50)] hover:border-[var(--color-primary-200)] transition-colors"
                  >
                    <div className="shrink-0 w-8 text-center">
                      <p className="text-[10px] font-bold text-[var(--color-primary-700)]">{lbl}</p>
                      <p className="text-[9px] text-[var(--color-ink-400)]">{format(d, "h:mm a")}</p>
                    </div>
                    <div className="w-px self-stretch bg-[var(--color-border)]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-[var(--color-ink-900)] truncate">{f.patient.name}</p>
                      <p className="text-[10px] text-[var(--color-ink-400)] truncate">{f.hospital.name}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Multi-hospital overview */}
        {scope === "DOCTOR" && hospitalWorkload.length > 0 && (
          <div className="surface-card p-4 lg:col-span-1">
            <h2 className="text-[13px] font-bold text-[var(--color-ink-900)] mb-3">Hospital Workload</h2>
            <div className="space-y-3">
              {hospitalWorkload.map((h) => (
                <div key={h.id} className="p-3 rounded-xl bg-[var(--color-surface-sunken)] border border-[var(--color-border)]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 size={12} className="shrink-0 text-[var(--color-primary-600)]" />
                      <span className="text-[11px] font-bold text-[var(--color-ink-800)] truncate">{h.name}</span>
                    </div>
                    <span className="text-[10px] font-bold text-[var(--color-ink-500)] tabular-nums shrink-0">{h.total} appts</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-[var(--color-ink-400)] w-16 shrink-0">Completed</span>
                      <MiniBar value={h.completed} max={h.total} color="bg-emerald-500" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-[var(--color-ink-400)] w-16 shrink-0">Waiting</span>
                      <MiniBar value={h.waiting} max={h.total} color="bg-amber-500" />
                    </div>
                    {h.inConsult > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-[var(--color-ink-400)] w-16 shrink-0">Consulting</span>
                        <MiniBar value={h.inConsult} max={h.total} color="bg-teal-500" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Analytics */}
        <div className="surface-card p-4 lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-bold text-[var(--color-ink-900)]">Appointment Analytics</h2>
            <div className="flex items-center gap-1 bg-[var(--color-surface-sunken)] p-0.5 rounded-lg">
              {(["today","week","month"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setAnalyticsRange(r)}
                  className={clsx(
                    "text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors",
                    analyticsRange === r ? "bg-white text-[var(--color-ink-900)] shadow-sm" : "text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)]"
                  )}
                >
                  {r === "today" ? "Today" : r === "week" ? "Week" : "Month"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 border border-blue-100">
              <BarChart2 size={14} className="shrink-0 text-blue-600" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-semibold text-blue-700">Scheduled</span>
                  <span className="text-[12px] font-bold text-blue-800 tabular-nums">{anaData.scheduled}</span>
                </div>
                <MiniBar value={anaData.scheduled} max={anaMax} color="bg-blue-500" />
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
              <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-semibold text-emerald-700">Completed</span>
                  <span className="text-[12px] font-bold text-emerald-800 tabular-nums">{anaData.completed}</span>
                </div>
                <MiniBar value={anaData.completed} max={anaMax} color="bg-emerald-500" />
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-100">
              <CalendarX2 size={14} className="shrink-0 text-red-500" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-semibold text-red-600">No Show</span>
                  <span className="text-[12px] font-bold text-red-700 tabular-nums">{anaData.noShow}</span>
                </div>
                <MiniBar value={anaData.noShow} max={anaMax} color="bg-red-500" />
              </div>
            </div>

            {anaData.scheduled > 0 && (
              <p className="text-[10px] text-[var(--color-ink-400)] text-center pt-1">
                {Math.round((anaData.completed / anaData.scheduled) * 100)}% completion rate
              </p>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
