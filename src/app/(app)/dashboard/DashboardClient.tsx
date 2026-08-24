"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import { format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown, Plus, Building2, Phone, LogIn, Loader2,
  Sun, Sunset, Moon, CalendarX2, Calendar, PersonStanding, Clock, Undo2, Timer, Stethoscope, CheckCircle2,
} from "lucide-react";
import clsx from "clsx";
import { doctorConfirmAppointment, hospitalUpdateAppointmentStatus, undoQueueEntry, undoPartialDispense } from "@/app/(app)/appointments/actions";
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
  hospital?: { id: string; name: string };
  doctor?:   { id: string; name: string } | null;
  visitId:          string | null;
  visitStartedAt:   string | null;
  visitFinalizedAt: string | null;
}

interface Surgery {
  id: string;
  surgeryType: string;
  surgeryDate: string;
  rightEye: boolean;
  leftEye: boolean;
  patient:  { name: string; udid: string };
  hospital?: { name: string } | null;
  doctor?:   { name: string } | null;
}

export interface DashboardProps {
  role:              "DOCTOR" | "HOSPITAL";
  displayName:       string;   // doctor's name or hospital name
  todayLabel:        string;
  appts:             Appt[];
  surgeries:         Surgery[];
  filterOptions:     { id: string; name: string }[];  // hospitals for DOCTOR, doctors for HOSPITAL
  newEncounterHref:  string;
  newEncounterLabel: string;
}

/* ── Status config ──────────────────────────────────────────────────────── */
const STATUS_CFG: Record<string, { label: string; color: string; dot: string }> = {
  REQUESTED:        { label: "Scheduled",       color: "bg-blue-100 text-blue-700",    dot: "bg-blue-500"   },
  CONFIRMED:        { label: "Waiting",         color: "bg-amber-100 text-amber-700",  dot: "bg-amber-500"  },
  DISPENSED:        { label: "Dispensed",       color: "bg-green-100 text-green-700",  dot: "bg-green-500"  },
  CANCELLED:        { label: "Cancelled",       color: "bg-red-100 text-red-600",      dot: "bg-red-500"    },
  NO_SHOW:          { label: "No Show",         color: "bg-gray-100 text-gray-500",    dot: "bg-gray-400"   },
  RESCHEDULED:      { label: "Rescheduled",     color: "bg-purple-100 text-purple-700",dot: "bg-purple-500" },
  PARTIAL_DISPENSE: { label: "Partial Dispense",color: "bg-orange-100 text-orange-700",dot: "bg-orange-500" },
};

const STATUS_FILTERS = [
  { key: "ALL",       label: "All"       },
  { key: "CONFIRMED", label: "Waiting"   },
  { key: "CANCELLED", label: "Cancelled" },
] as const;

/* ── Live waiting timer ─────────────────────────────────────────────────── */
function LiveTimer({ since }: { since: string }) {
  // Initialize immediately so the timer shows the correct elapsed time from
  // the very first render — even for patients already waiting — without a
  // flash-to-empty on each page load or auto-refresh.
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const elapsed = now - new Date(since).getTime();
  if (elapsed <= 0) return null;

  const totalMins = Math.floor(elapsed / 60_000);
  const hours     = Math.floor(totalMins / 60);
  const mins      = totalMins % 60;
  const label     = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  const color     = totalMins > 30 ? "text-red-500" : totalMins > 15 ? "text-amber-500" : "text-emerald-600";

  return (
    <span suppressHydrationWarning className={clsx("inline-flex items-center justify-center gap-0.5 text-[10px] font-semibold", color)}>
      <Clock size={9} /> {label}
    </span>
  );
}

/* ── Surgery row ───────────────────────────────────────────────────────── */
function SurgeryRow({ s, role }: { s: Surgery; role: "DOCTOR" | "HOSPITAL" }) {
  const subLabel = role === "DOCTOR"
    ? (s.hospital?.name ?? null)
    : (s.doctor ? `Dr. ${s.doctor.name}` : null);
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--color-border)] bg-white">
      <div className="w-20 shrink-0 text-center">
        <p className="text-xs font-bold text-[var(--color-ink-900)]">{format(new Date(s.surgeryDate), "d MMM")}</p>
        <p className="text-[10px] text-[var(--color-ink-400)]">{format(new Date(s.surgeryDate), "hh:mm a")}</p>
      </div>
      <div className="w-px self-stretch bg-[var(--color-border)]" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-[var(--color-ink-900)] truncate">{s.patient.name}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="font-mono text-[10px] text-[#115E59] bg-[#F0F8F6] px-1.5 py-0.5 rounded">
            {s.patient.udid}
          </span>
          {subLabel && role === "DOCTOR" && (
            <span className="inline-flex items-center gap-1 text-[11px] text-[var(--color-ink-400)]">
              <Building2 size={10} /> {subLabel}
            </span>
          )}
          {subLabel && role === "HOSPITAL" && (
            <span className="text-[11px] text-[var(--color-ink-400)]">{subLabel}</span>
          )}
        </div>
      </div>
      <span className="shrink-0 text-xs font-medium text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full truncate max-w-[160px]">
        {s.surgeryType}
      </span>
      <span className="shrink-0 text-[10px] text-[var(--color-ink-400)]">
        {s.rightEye && s.leftEye ? "OU" : s.rightEye ? "RE" : "LE"}
      </span>
    </div>
  );
}

/* ── Partial Dispense row ───────────────────────────────────────────────── */
function PartialDispenseRow({ appt: a, role, serial }: { appt: Appt; role: "DOCTOR" | "HOSPITAL"; serial: number }) {
  const [undoing, startUndo] = useTransition();
  const arrivedAt = a.arrivedAt ? new Date(a.arrivedAt) : null;
  const apptTime  = format(new Date(a.dateTime), "h:mm a");
  const timerSince = a.arrivedAt ?? a.dateTime;
  const timerLabel = arrivedAt
    ? `Waiting since ${format(arrivedAt, "h:mm a")} (arrived)`
    : `Waiting since ${apptTime} (scheduled)`;

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-orange-200 bg-white hover:bg-orange-50/60 transition-colors">
      {/* Serial */}
      <div className="w-6 shrink-0 text-center">
        <span className="text-xs font-bold text-orange-400">{serial}</span>
      </div>
      <div className="w-px self-stretch bg-orange-200" />

      {/* Patient info — grows to fill */}
      <Link href={`/patients/${a.patient.udid}?returnTo=/dashboard`} className="flex-1 min-w-0 hover:opacity-80 transition-opacity">
        <p className="font-semibold text-sm text-[var(--color-ink-900)] truncate">{a.patient.name}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="font-mono text-[10px] text-[#115E59] bg-[#F0F8F6] px-1.5 py-0.5 rounded">
            {a.patient.udid}
          </span>
          <span className="text-[11px] text-[var(--color-ink-400)]">
            {a.patient.age}y / {a.patient.sex === "MALE" ? "M" : a.patient.sex === "FEMALE" ? "F" : "O"}
          </span>
          {a.partialDispenseAt && (
            <span className="inline-flex items-center gap-1 text-[10px] text-orange-500">
              <Clock size={10} /> Added at {format(new Date(a.partialDispenseAt), "h:mm a")}
            </span>
          )}
          {role === "HOSPITAL" && a.doctor && (
            <span className="text-[11px] text-[var(--color-ink-400)]">Dr. {a.doctor.name}</span>
          )}
        </div>
        {a.partialDispenseReason && (
          <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-orange-100 border border-orange-300 text-orange-700 text-[11px] font-semibold leading-relaxed">
            {a.partialDispenseReason}
          </span>
        )}
        {a.complaint && (
          <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-100 text-amber-800 text-[11px] font-medium leading-relaxed">
            {formatComplaintDisplay(a.complaint)}
          </span>
        )}
      </Link>

      {/* Right side: wait time + undo */}
      <div className="shrink-0 flex flex-col items-end gap-1.5">
        <span
          title={timerLabel}
          className="cursor-default"
        >
          <LiveTimer since={timerSince} />
        </span>
        <button
          disabled={undoing}
          title="Move back to Today's Queue"
          onClick={() => startUndo(async () => { await undoPartialDispense(a.id); })}
          className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg bg-white border border-orange-300 text-orange-700 hover:bg-orange-100 disabled:opacity-50 transition-all"
        >
          {undoing ? <Loader2 size={11} className="animate-spin" /> : <LogIn size={11} />}
          {!undoing && "To Queue"}
        </button>
      </div>
    </div>
  );
}

/* ── Appointment row ────────────────────────────────────────────────────── */
function ApptRow({ appt, role, serial }: { appt: Appt; role: "DOCTOR" | "HOSPITAL"; serial: number }) {
  const cfg      = STATUS_CFG[appt.status] ?? STATUS_CFG["REQUESTED"];
  const apptTime = format(new Date(appt.dateTime), "h:mm a");
  const arrivedAt      = appt.arrivedAt      ? new Date(appt.arrivedAt)      : null;
  const visitStartedAt = appt.visitStartedAt ? new Date(appt.visitStartedAt) : null;
  // Walk-ins: show registration (createdAt) time. Booked appts: show arrived time or scheduled time.
  const primaryTime = appt.isWalkIn
    ? format(new Date(appt.createdAt), "h:mm a")
    : (arrivedAt ? format(arrivedAt, "h:mm a") : apptTime);
  // Timer runs from arrival; fall back to appt time if not yet arrived
  const timerSince  = appt.arrivedAt ?? appt.dateTime;
  // Wait time = from arrival to when doctor opened the case
  const waitMins = arrivedAt && visitStartedAt
    ? Math.max(0, Math.round((visitStartedAt.getTime() - arrivedAt.getTime()) / 60000))
    : null;

  const [undoing, startUndo] = useTransition();

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--color-border)] bg-white hover:bg-[var(--color-primary-50)] hover:border-[var(--color-primary-200)] transition-colors">
      {/* Serial number */}
      <div className="w-6 shrink-0 flex items-center justify-center">
        <span className="text-xs font-bold text-[var(--color-ink-400)] tabular-nums">{serial}</span>
      </div>
      <div className="w-px self-stretch bg-[var(--color-border)]" />
      {/* Time + visit-type column */}
      <div className="w-20 shrink-0 flex flex-col items-center gap-0.5">
        {/* Primary time: arrived or scheduled */}
        <p className="text-sm font-bold text-[var(--color-ink-900)]"
           title={arrivedAt ? `Arrived at ${format(arrivedAt, "h:mm a")}` : "Appointment time"}>
          {primaryTime}
        </p>
        {appt.isWalkIn ? (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-600">
            <PersonStanding size={9} /> Walk-in
          </span>
        ) : (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">
            <Calendar size={9} /> Appt
          </span>
        )}
        {/* Scheduled time — only show when different from primary time */}
        {apptTime !== primaryTime && (
          <span className="text-[9px] text-[var(--color-ink-300)]" title="Scheduled appointment time">
            {apptTime}
          </span>
        )}
      </div>
      <div className="w-px self-stretch bg-[var(--color-border)]" />
      <Link href={`/patients/${appt.patient.udid}?returnTo=/dashboard`} className="flex-1 min-w-0 hover:opacity-80 transition-opacity">
        <p className="font-semibold text-[var(--color-ink-900)] text-sm truncate">{appt.patient.name}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span title="UDID (Doctor ID)" className="font-mono text-[10px] text-[#115E59] bg-[#F0F8F6] px-1.5 py-0.5 rounded">
            {appt.patient.udid}
          </span>
          <span className="text-[11px] text-[var(--color-ink-400)]">
            {appt.patient.age}y / {appt.patient.sex === "MALE" ? "M" : appt.patient.sex === "FEMALE" ? "F" : "O"}
          </span>
          {role === "DOCTOR" && appt.patient.mobile && (
            <span className="inline-flex items-center gap-0.5 text-[11px] text-[var(--color-ink-400)]">
              <Phone size={9} /> {appt.patient.mobile}
            </span>
          )}
          {role === "HOSPITAL" && appt.doctor && (
            <span className="text-[11px] text-[var(--color-ink-400)]">
              Dr. {appt.doctor.name}
            </span>
          )}
        </div>
        {appt.complaint && (
          <span className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-100 text-amber-800 text-[11px] font-medium leading-relaxed">
            {formatComplaintDisplay(appt.complaint)}
          </span>
        )}
      </Link>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <div className="flex items-center gap-1.5">
          {appt.visitType && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)] whitespace-nowrap">
              {appt.visitType}
            </span>
          )}
          {appt.status !== "CONFIRMED" && (
            <span className={clsx("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold", cfg.color)}>
              <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", cfg.dot)} />
              {cfg.label}
            </span>
          )}
          {appt.status === "CONFIRMED" && (
            <button
              disabled={undoing}
              title={`Move back to appointment time (${apptTime})`}
              onClick={e => { e.preventDefault(); startUndo(async () => { await undoQueueEntry(appt.id); }); }}
              className="p-1.5 rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-ink-400)] hover:text-amber-600 hover:border-amber-300 hover:bg-amber-50 disabled:opacity-50 transition-all"
            >
              {undoing ? <Loader2 size={12} className="animate-spin" /> : <Undo2 size={12} />}
            </button>
          )}
        </div>
        <LiveTimer since={timerSince} />
      </div>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */
export function DashboardClient({
  role, displayName, todayLabel, appts, surgeries, filterOptions,
  newEncounterHref, newEncounterLabel,
}: DashboardProps) {
  const router = useRouter();
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter]     = useState<string>("ALL");
  const [movingId, setMovingId]             = useState<string | null>(null);
  const [greetHour, setGreetHour]           = useState<number | null>(null);
  const [, startMove]                       = useTransition();

  useEffect(() => { setGreetHour(new Date().getHours()); }, []);

  /* Filter appts by selected hospital (DOCTOR) or doctor (HOSPITAL) */
  const filteredAppts = useMemo(() => {
    if (selectedFilter === "all") return appts;
    return role === "DOCTOR"
      ? appts.filter((a) => a.hospital?.id === selectedFilter)
      : appts.filter((a) => a.doctor?.id === selectedFilter);
  }, [appts, selectedFilter, role]);

  /* Partial dispense patients */
  const partialDispenseAppts = useMemo(
    () => filteredAppts.filter((a) => a.status === "PARTIAL_DISPENSE"),
    [filteredAppts],
  );

  /* Today's Queue: active only — exclude terminal/inactive statuses. */
  const queueGroups = useMemo(() => {
    const queue     = filteredAppts.filter((a) => !["REQUESTED", "DISPENSED", "PARTIAL_DISPENSE", "CANCELLED", "NO_SHOW", "RESCHEDULED"].includes(a.status));
    const dispensed = filteredAppts.filter((a) => a.status === "DISPENSED");
    if (role === "DOCTOR") {
      const hospitalsToShow = selectedFilter === "all"
        ? filterOptions
        : filterOptions.filter((h) => h.id === selectedFilter);
      const map = new Map<string, { name: string; appts: Appt[]; dispensed: number }>();
      for (const h of hospitalsToShow) map.set(h.id, { name: h.name, appts: [], dispensed: 0 });
      for (const a of queue) {
        const key = a.hospital?.id ?? "unknown";
        if (!map.has(key)) map.set(key, { name: a.hospital?.name ?? "Unknown", appts: [], dispensed: 0 });
        map.get(key)!.appts.push(a);
      }
      for (const a of dispensed) {
        const key = a.hospital?.id ?? "unknown";
        if (map.has(key)) map.get(key)!.dispensed++;
      }
      return Array.from(map.entries())
        .map(([id, { name, appts: gAppts, dispensed: d }]) => ({ id, name, appts: gAppts, dispensed: d }))
        .filter((g) => g.appts.length > 0)
        .sort((a, b) => a.name.localeCompare(b.name));
    } else {
      return [{ id: "self", name: displayName, appts: queue, dispensed: dispensed.length }];
    }
  }, [filteredAppts, role, displayName, filterOptions, selectedFilter]);

  const totalQueue = queueGroups.reduce((s, g) => s + g.appts.length, 0);

  /* Visit time — all today's appointments (REQUESTED + CONFIRMED + IN_PROGRESS), grouped by hospital for DOCTOR */
  const bookedGroups = useMemo(() => {
    // Only REQUESTED — once moved to today's queue (CONFIRMED+) the patient leaves Visit time
    const booked = filteredAppts.filter((a) => a.status === "REQUESTED");
    if (role === "DOCTOR") {
      const map = new Map<string, { name: string; appts: Appt[] }>();
      for (const a of booked) {
        const key = a.hospital?.id ?? "unknown";
        if (!map.has(key)) map.set(key, { name: a.hospital?.name ?? "Unknown", appts: [] });
        map.get(key)!.appts.push(a);
      }
      return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    } else {
      return booked.length > 0 ? [{ name: displayName, appts: booked }] : [];
    }
  }, [filteredAppts, role, displayName]);

  /* Surgeries — optionally filtered by selected hospital when DOCTOR */
  const filteredSurgeries = useMemo(() => {
    if (role === "DOCTOR" && selectedFilter !== "all") {
      const hName = filterOptions.find((h) => h.id === selectedFilter)?.name;
      return surgeries.filter((s) => s.hospital?.name === hName);
    }
    return surgeries;
  }, [surgeries, role, selectedFilter, filterOptions]);

  /* Greeting */
  const h           = greetHour ?? 8;
  const isEvening   = h >= 18;
  const isAfternoon = h >= 12;
  const greeting    = isEvening ? "Good Evening" : isAfternoon ? "Good Afternoon" : "Good Morning";
  const GreetIcon   = isEvening ? Moon : isAfternoon ? Sunset : Sun;
  const iconColor   = isEvening ? "text-indigo-300" : isAfternoon ? "text-orange-300" : "text-amber-300";
  const bannerTitle = role === "DOCTOR" ? `Dr. ${displayName}` : displayName;
  const filterLabel = role === "DOCTOR" ? "All Hospitals" : "All Doctors";

  return (
    <div className="fade-in space-y-5">

      {/* ── Greeting Banner ──────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--color-primary-900)] via-[var(--color-primary-700)] to-[var(--color-primary-500)] p-5 sm:p-6 text-white shadow-lg">
        <div className="pointer-events-none absolute -top-10 -right-10 h-48 w-48 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-12 -right-20 h-64 w-64 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute top-4 right-32 h-16 w-16 rounded-full bg-white/5" />

        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <GreetIcon size={17} className={iconColor} />
              <span className="text-sm font-medium text-white/70 tracking-wide">{greeting}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">{bannerTitle}</h1>
            <p className="mt-1 text-sm text-white/60">{todayLabel}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={newEncounterHref}
              className="inline-flex items-center gap-2 bg-white text-[var(--color-primary-800)] text-sm font-semibold px-4 py-2 rounded-xl hover:bg-white/90 transition-colors shadow-sm"
            >
              <Plus size={15} /> {newEncounterLabel}
            </Link>
            {filterOptions.length > 0 && (
              <div className="relative">
                <select
                  value={selectedFilter}
                  onChange={(e) => setSelectedFilter(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-2 rounded-xl border border-white/20 bg-white/10 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-white/40 cursor-pointer backdrop-blur-sm"
                >
                  <option value="all" className="text-[var(--color-ink-800)]">{filterLabel}</option>
                  {filterOptions.map((opt) => (
                    <option key={opt.id} value={opt.id} className="text-[var(--color-ink-800)]">
                      {role === "HOSPITAL" ? `Dr. ${opt.name}` : opt.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-white/70" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Today's Queue ────────────────────────────────────────────────── */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <h2 className="text-base font-semibold text-[var(--color-ink-900)]">
            Today's Queue
            <span className="ml-2 text-sm font-normal text-[var(--color-ink-400)]">{totalQueue} total</span>
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 flex-wrap">
              {STATUS_FILTERS.map(({ key, label }) => {
                const queueAppts = filteredAppts.filter((a) => !["REQUESTED", "DISPENSED", "PARTIAL_DISPENSE", "CANCELLED", "NO_SHOW", "RESCHEDULED"].includes(a.status));
                const count = key === "ALL"
                  ? queueAppts.length
                  : queueAppts.filter((a) => a.status === key).length;
                return (
                  <button
                    key={key}
                    onClick={() => setStatusFilter(key)}
                    className={clsx(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                      statusFilter === key
                        ? "bg-[var(--color-primary-600)] text-white"
                        : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)] hover:bg-[var(--color-primary-50)] hover:text-[var(--color-primary-700)]"
                    )}
                  >
                    {label}
                    <span className={clsx("ml-1.5 font-bold", statusFilter === key ? "text-white/80" : "text-[var(--color-ink-400)]")}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            <Link href="/appointments" className="text-xs font-semibold text-[var(--color-primary-600)] hover:underline whitespace-nowrap">
              View all →
            </Link>
          </div>
        </div>

        {queueGroups.length === 0 ? (
          <div className="surface-card flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-[var(--color-surface-sunken)]">
              <CalendarX2 size={28} className="text-[var(--color-ink-300)]" />
            </div>
            <div>
              <p className="text-base font-semibold text-[var(--color-ink-700)]">No appointments today</p>
              <p className="text-sm text-[var(--color-ink-400)] mt-1 max-w-xs mx-auto">
                Confirmed appointments will appear here once patients are moved into the queue.
              </p>
            </div>
            <Link
              href={newEncounterHref}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-primary-600)] hover:underline"
            >
              <Plus size={14} /> {newEncounterLabel}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {queueGroups.map(({ id, name, appts: gAppts, dispensed }) => {
              const displayed = statusFilter === "ALL" ? gAppts : gAppts.filter((a) => a.status === statusFilter);
              return (
                <div key={id} className="surface-card p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="shrink-0 p-1.5 rounded-lg bg-[var(--color-primary-50)]">
                        <Building2 size={15} className="text-[var(--color-primary-700)]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[var(--color-ink-900)] truncate">{name}</p>
                        <p className="text-[11px] text-[var(--color-ink-400)]">
                          {gAppts.length} in queue{dispensed > 0 ? ` · ${dispensed} Dispensed` : ""}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
                      {gAppts.length}
                    </span>
                  </div>
                  {displayed.length > 0 && (
                    <div className="space-y-2">
                      {displayed.map((a, idx) => <ApptRow key={a.id} appt={a} role={role} serial={idx + 1} />)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Surgeries + Visit time ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Partial Dispense */}
          <div className="surface-card p-5">
            <h2 className="text-base font-semibold text-[var(--color-ink-900)] mb-4">
              Partial Dispense
              {partialDispenseAppts.length > 0 && (
                <span className="ml-2 text-xs font-normal text-[var(--color-ink-400)]">{partialDispenseAppts.length} pending</span>
              )}
            </h2>
            {partialDispenseAppts.length === 0 ? (
              <p className="text-center text-xs text-[var(--color-ink-400)] py-6">No partial dispense patients</p>
            ) : (
              <div className="space-y-2">
                {partialDispenseAppts.map((a, idx) => (
                  <PartialDispenseRow key={a.id} appt={a} role={role} serial={idx + 1} />
                ))}
              </div>
            )}
          </div>

          {/* Visit time */}
          <div className="surface-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-[var(--color-ink-900)]">
                Appointment time
                {bookedGroups.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-[var(--color-ink-400)]">
                    {bookedGroups.reduce((s, g) => s + g.appts.length, 0)} booked
                  </span>
                )}
              </h2>
              <Link href="/appointments" className="text-xs font-semibold text-[var(--color-primary-600)] hover:underline">View all →</Link>
            </div>
            {bookedGroups.length === 0 && (
              <p className="text-center text-xs text-[var(--color-ink-400)] py-6">No patients booked for visit</p>
            )}
            {bookedGroups.length > 0 && (
              <div className="space-y-4">
                {bookedGroups.map(({ name, appts: gAppts }) => (
                  <div key={name}>
                    {role === "DOCTOR" && (
                      <div className="flex items-center gap-1.5 mb-2">
                        <div className="shrink-0 p-1 rounded-md bg-[var(--color-primary-50)]">
                          <Building2 size={11} className="text-[var(--color-primary-700)]" />
                        </div>
                        <p className="text-xs font-bold text-[var(--color-ink-700)] uppercase tracking-wide">{name}</p>
                        <span className="text-[10px] text-[var(--color-ink-400)]">· {gAppts.length}</span>
                      </div>
                    )}
                    <div className={clsx("space-y-1.5", role === "DOCTOR" && "pl-1")}>
                      {gAppts.map((a, idx) => {
                        const cfg      = STATUS_CFG[a.status] ?? STATUS_CFG["REQUESTED"];
                        const isMoving = movingId === a.id;
                        return (
                          <div key={a.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[var(--color-border)] bg-white">
                            <div className="w-6 shrink-0 flex items-center justify-center">
                              <span className="text-xs font-bold text-[var(--color-ink-400)]">{idx + 1}</span>
                            </div>
                            <div className="w-px self-stretch bg-[var(--color-border)]" />
                            <div className="w-16 shrink-0 flex flex-col items-center gap-0.5">
                              <span className="text-sm font-bold text-[var(--color-ink-900)]" title="Scheduled appointment time">
                                {format(new Date(a.dateTime), "h:mm a")}
                              </span>
                              <span className="text-[9px] text-[var(--color-ink-400)]" title="Booked at">
                                Booked {format(new Date(a.createdAt), "h:mm a")}
                              </span>
                            </div>
                            <div className="w-px self-stretch bg-[var(--color-border)]" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-[var(--color-ink-900)] truncate">{a.patient.name}</p>
                              <div className="flex items-center gap-1 flex-wrap mt-0.5">
                                <span title="UDID (Doctor ID)" className="font-mono text-[10px] text-[#115E59] bg-[#F0F8F6] px-1.5 py-0.5 rounded">
                                  {a.patient.udid}
                                </span>
                              </div>
                              {a.complaint && (
                                <span className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-100 text-amber-800 text-[11px] font-medium leading-relaxed">
                                  {formatComplaintDisplay(a.complaint)}
                                </span>
                              )}
                            </div>
                            <span className={clsx("text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0", cfg.color)}>
                              {cfg.label}
                            </span>
                            {a.status === "REQUESTED" && (
                              <button
                                disabled={isMoving}
                                title="Move to Today's Queue"
                                onClick={() => {
                                  setMovingId(a.id);
                                  startMove(async () => {
                                    if (role === "DOCTOR") {
                                      await doctorConfirmAppointment(a.id);
                                    } else {
                                      await hospitalUpdateAppointmentStatus(a.id, "CONFIRMED");
                                    }
                                    setMovingId(null);
                                    router.refresh();
                                  });
                                }}
                                className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                              >
                                {isMoving ? <Loader2 size={13} className="animate-spin" /> : <LogIn size={13} />}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  ))}

              </div>
            )}
          </div>

        </div>

    </div>
  );
}
