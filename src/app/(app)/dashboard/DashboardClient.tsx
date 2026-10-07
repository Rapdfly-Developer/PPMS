"use client";

import { useState, useMemo, useEffect, useTransition, type ReactNode } from "react";
import { format } from "date-fns";
import Link from "next/link";
import {
  ChevronDown, Plus, Building2, Phone, LogIn, Loader2,
  Sun, Sunset, Moon, CalendarX2, Calendar, CalendarDays, PersonStanding, Clock, Undo2, Trash2, Timer, CheckCircle2, CheckCheck,
} from "lucide-react";
import clsx from "clsx";
import { deleteWalkInVisit, undoQueueEntry, undoPartialDispense } from "@/app/(app)/appointments/actions";
import { ComplaintChips } from "@/components/ui/ComplaintChips";
import { TealSelect } from "@/components/ui/TealSelect";

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
  refractionDone?:  boolean;
}

export interface DashboardProps {
  scope:              "DOCTOR" | "HOSPITAL";
  /** Session permission keys. Mirrors userCan() on the server — "*" grants all. */
  permissions:       string[];
  displayName:       string;   // doctor's name or hospital name; also names the queue group
  /** Banner heading. The wrapper decides: "Dr. X", the hospital name, or a
   *  named staff member's own name — the client no longer infers it. */
  bannerTitle:       string;
  /** Optional line under the heading. Named staff get "Role · Hospital" so a
   *  personal greeting still says which hospital they are working. */
  bannerSubtitle?:   string;
  todayLabel:        string;
  appts:             Appt[];
  filterOptions:     { id: string; name: string; logoUrl?: string | null }[];  // hospitals for DOCTOR, doctors for HOSPITAL
  hospitalLogoUrl?:  string | null;
  newEncounterHref:  string;
  newEncounterLabel: string;
  /** Where the Back button on the patient profile should navigate to. Defaults to "/dashboard". */
  returnTo?:         string;
}

/* ── Status config ──────────────────────────────────────────────────────── */
const STATUS_CFG: Record<string, { label: string; color: string; dot: string }> = {
  REQUESTED:        { label: "Scheduled",       color: "bg-teal-50 text-teal-700",    dot: "bg-teal-500"   },
  CONFIRMED:        { label: "Waiting",         color: "bg-amber-100 text-amber-700",  dot: "bg-amber-500"  },
  DISPENSED:        { label: "Dispensed",       color: "bg-green-100 text-green-700",  dot: "bg-green-500"  },
  CANCELLED:        { label: "Cancelled",       color: "bg-red-100 text-red-600",      dot: "bg-red-500"    },
  NO_SHOW:          { label: "No Show",         color: "bg-gray-100 text-gray-500",    dot: "bg-gray-400"   },
  RESCHEDULED:      { label: "Rescheduled",     color: "bg-teal-50 text-teal-700",dot: "bg-teal-500" },
  PARTIAL_DISPENSE: { label: "Partial Dispense",color: "bg-orange-100 text-orange-700",dot: "bg-orange-500" },
};

/* Visit-type filters. "All" is not one of them — the "N total" count beside the
   heading already states it. It survives only as the unfiltered state value,
   reached by deselecting whichever filter is active. */
const VISIT_TYPE_FILTERS = [
  { key: "WALK_IN",     label: "Walk-in"     },
  { key: "General OPD", label: "General OPD" },
  { key: "Follow-up",   label: "Follow-up"   },
  { key: "Emergency",   label: "Emergency"   },
] as const;

type VisitTypeFilterKey = typeof VISIT_TYPE_FILTERS[number]["key"] | "ALL";

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
    <span suppressHydrationWarning className={clsx("inline-flex items-center justify-center gap-0.5 text-micro sm:text-caption font-semibold", color)}>
      <Clock size={9} /> {label}
    </span>
  );
}

/* Patient block — links into the record only when the viewer holds
   patients.view. Without it the same details still render as plain text: the
   queue has to stay readable for a role that may work it but not open records.
   /patients/[udid] enforces the permission server-side either way. */
function PatientBlock({ udid, canView, source, returnTo, className, children }: {
  udid: string; canView: boolean; source: string; returnTo: string; className: string; children: ReactNode;
}) {
  if (!canView) return <div className={className}>{children}</div>;
  return (
    <Link href={`/patients/${udid}?returnTo=${returnTo}&source=${source}`} className={className}>
      {children}
    </Link>
  );
}

/* ── Partial Dispense row ───────────────────────────────────────────────── */
function PartialDispenseRow({ appt: a, scope, serial, canDispense, canViewPatient, returnTo }: { appt: Appt; scope: "DOCTOR" | "HOSPITAL"; serial: number; canDispense: boolean; canViewPatient: boolean; returnTo: string }) {
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
        <span className="text-caption sm:text-xs font-bold text-orange-400">{serial}</span>
      </div>
      <div className="w-px self-stretch bg-orange-200 hidden sm:block" />

      {/* Patient info — grows to fill */}
      <PatientBlock udid={a.patient.udid} canView={canViewPatient} source="partial-dispense" returnTo={returnTo} className="flex-1 min-w-0 hover:opacity-80 transition-opacity">
        <p className="font-semibold text-label sm:text-sm text-[var(--color-ink-900)] truncate">{a.patient.name}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="font-mono text-micro sm:text-caption text-[#115E59] bg-[#F0F8F6] px-1.5 py-0.5 rounded">
            {a.patient.udid}
          </span>
          <span className="text-caption sm:text-caption text-[var(--color-ink-400)]">
            {a.patient.age}y / {a.patient.sex === "MALE" ? "M" : a.patient.sex === "FEMALE" ? "F" : "O"}
          </span>
          {canViewPatient && a.patient.mobile && (
            <span className="inline-flex items-center gap-0.5 text-caption sm:text-caption text-[var(--color-ink-400)]">
              <Phone size={9} /> {a.patient.mobile}
            </span>
          )}
          {a.partialDispenseAt && (
            <span className="inline-flex items-center gap-1 text-micro sm:text-caption text-orange-500">
              <Clock size={10} /> Added at {format(new Date(a.partialDispenseAt), "h:mm a")}
            </span>
          )}
          {scope === "HOSPITAL" && a.doctor && (
            <span className="text-caption sm:text-caption text-[var(--color-ink-400)]">Dr. {a.doctor.name}</span>
          )}
        </div>
        {a.partialDispenseReason && (
          <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-orange-100 border border-orange-300 text-orange-700 text-caption sm:text-caption font-semibold leading-relaxed">
            {a.partialDispenseReason}
          </span>
        )}
        {a.complaint && <ComplaintChips value={a.complaint} className="mt-1" />}
      </PatientBlock>

      {/* Right side: wait time + undo */}
      <div className="shrink-0 flex flex-col items-end gap-1.5">
        <span
          title={timerLabel}
          className="cursor-default"
        >
          <LiveTimer since={timerSince} />
        </span>
        {canDispense && (
          <button
            disabled={undoing}
            title="Move back to Today's Queue"
            onClick={() => startUndo(async () => { await undoPartialDispense(a.id); })}
            className="flex items-center gap-1 text-caption sm:text-caption font-semibold px-2 py-1 rounded-lg bg-white border border-orange-300 text-orange-700 hover:bg-orange-100 disabled:opacity-50 transition-all"
          >
            {undoing ? <Loader2 size={11} className="animate-spin" /> : <LogIn size={11} />}
            {!undoing && "To Queue"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Appointment row ────────────────────────────────────────────────────── */
function ApptRow({ appt, scope, serial, canManageQueue, canViewPatient, returnTo }: { appt: Appt; scope: "DOCTOR" | "HOSPITAL"; serial: number; canManageQueue: boolean; canViewPatient: boolean; returnTo: string }) {
  const cfg      = STATUS_CFG[appt.status] ?? STATUS_CFG["REQUESTED"];
  const apptTime = format(new Date(appt.dateTime), "h:mm a");
  const arrivedAt      = appt.arrivedAt      ? new Date(appt.arrivedAt)      : null;
  const visitStartedAt = appt.visitStartedAt ? new Date(appt.visitStartedAt) : null;
  // Timer runs from arrival; fall back to appt time if not yet arrived
  const timerSince  = appt.arrivedAt ?? appt.dateTime;
  // Wait time = from arrival to when doctor opened the case
  const waitMins = arrivedAt && visitStartedAt
    ? Math.max(0, Math.round((visitStartedAt.getTime() - arrivedAt.getTime()) / 60000))
    : null;

  const [updating, startUpdate] = useTransition();
  const isOpdWalkIn = returnTo === "/opd" && appt.isWalkIn;

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--color-border)] bg-white hover:bg-[var(--color-primary-50)] hover:border-[var(--color-primary-200)] transition-colors">
      {/* Serial number */}
      <div className="w-6 shrink-0 flex items-center justify-center">
        <span className="text-caption sm:text-xs font-bold text-[var(--color-ink-400)] tabular-nums">{serial}</span>
      </div>
      <div className="w-px self-stretch bg-[var(--color-border)] hidden sm:block" />
      {/* Booked time on top; appointments show the arrival time in blue beneath. */}
      <div className="w-24 shrink-0 hidden sm:flex items-center justify-center">
        <span className="flex flex-col items-center leading-tight">
          <span
            className="whitespace-nowrap text-caption font-bold text-[var(--color-ink-900)] tabular-nums"
            title={appt.isWalkIn ? "Walk-in time" : "Booked appointment time"}
          >
            {appt.isWalkIn ? format(new Date(appt.createdAt), "hh:mm a") : apptTime}
          </span>
          {appt.isWalkIn ? (
            <span className="inline-flex items-center gap-1 mt-0.5 whitespace-nowrap text-caption text-gray-400">
              Walk-in
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 mt-0.5 whitespace-nowrap text-caption text-blue-600">
              <CalendarDays size={10} className="shrink-0" />
              {arrivedAt ? `Appt - ${format(arrivedAt, "h:mm a")}` : "Appointment"}
            </span>
          )}
        </span>
      </div>
      <div className="w-px self-stretch bg-[var(--color-border)] hidden sm:block" />
      <PatientBlock udid={appt.patient.udid} canView={canViewPatient} source="opd-queue" returnTo={returnTo} className="flex-1 min-w-0 hover:opacity-80 transition-opacity">
        <p className="font-semibold text-[var(--color-ink-900)] text-label sm:text-sm truncate">{appt.patient.name}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span title="UDID (Doctor ID)" className="font-mono text-micro sm:text-caption text-[#115E59] bg-[#F0F8F6] px-1.5 py-0.5 rounded">
            {appt.patient.udid}
          </span>
          <span className="text-caption sm:text-caption text-[var(--color-ink-400)]">
            {appt.patient.age}y / {appt.patient.sex === "MALE" ? "M" : appt.patient.sex === "FEMALE" ? "F" : "O"}
          </span>
          {scope === "DOCTOR" && canViewPatient && appt.patient.mobile && (
            <span className="inline-flex items-center gap-0.5 text-caption sm:text-caption text-[var(--color-ink-400)]">
              <Phone size={9} /> {appt.patient.mobile}
            </span>
          )}
          {scope === "HOSPITAL" && appt.doctor && (
            <span className="text-caption sm:text-caption text-[var(--color-ink-400)]">
              Dr. {appt.doctor.name}
            </span>
          )}
          {appt.complaint && <ComplaintChips value={appt.complaint} />}
        </div>
      </PatientBlock>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <div className="flex items-center gap-1.5">
          {appt.visitType && (
            <span className="hidden sm:inline text-caption font-medium px-2 py-0.5 rounded-full bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)] whitespace-nowrap">
              {appt.visitType}
            </span>
          )}
          {appt.refractionDone && (
            <span title="Refraction done — passed over to doctor" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-caption font-semibold whitespace-nowrap">
              <CheckCheck size={11} /> Refraction done
            </span>
          )}
          {appt.status !== "CONFIRMED" && (
            <span className={clsx("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-caption sm:text-caption font-semibold", cfg.color)}>
              <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", cfg.dot)} />
              {cfg.label}
            </span>
          )}
          {appt.status === "CONFIRMED" && canManageQueue && (
            <button
              disabled={updating}
              title={isOpdWalkIn ? "Delete walk-in visit" : `Move back to appointment time (${apptTime})`}
              aria-label={isOpdWalkIn ? `Delete walk-in visit for ${appt.patient.name}` : `Move ${appt.patient.name} back to appointment time`}
              onClick={e => {
                e.preventDefault();
                if (isOpdWalkIn && !window.confirm(`Delete the walk-in visit for ${appt.patient.name}? This action cannot be undone.`)) return;
                startUpdate(async () => {
                  if (isOpdWalkIn) await deleteWalkInVisit(appt.id);
                  else await undoQueueEntry(appt.id);
                });
              }}
              className={clsx(
                "p-1.5 rounded-lg border bg-white disabled:opacity-50 transition-all",
                isOpdWalkIn
                  ? "border-red-200 text-red-500 hover:text-red-700 hover:border-red-300 hover:bg-red-50"
                  : "border-[var(--color-border)] text-[var(--color-ink-400)] hover:text-amber-600 hover:border-amber-300 hover:bg-amber-50",
              )}
            >
              {updating
                ? <Loader2 size={12} className="animate-spin" />
                : isOpdWalkIn ? <Trash2 size={12} /> : <Undo2 size={12} />}
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
  scope, permissions, displayName, bannerTitle, bannerSubtitle, todayLabel, appts, filterOptions,
  newEncounterHref, newEncounterLabel, hospitalLogoUrl, returnTo = "/dashboard",
}: DashboardProps) {
  // Same rule as userCan() in lib/rbac, so the UI hides exactly what the server
  // would refuse. The server actions enforce it independently.
  const can = (p: string) => permissions.includes("*") || permissions.includes(p);
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter]     = useState<VisitTypeFilterKey>("ALL");
  const [greetHour, setGreetHour]           = useState<number | null>(null);

  useEffect(() => { setGreetHour(new Date().getHours()); }, []);

  /* Filter appts by selected hospital (DOCTOR) or doctor (HOSPITAL) */
  const filteredAppts = useMemo(() => {
    if (selectedFilter === "all") return appts;
    return scope === "DOCTOR"
      ? appts.filter((a) => a.hospital?.id === selectedFilter)
      : appts.filter((a) => a.doctor?.id === selectedFilter);
  }, [appts, selectedFilter, scope]);

  /* Partial dispense patients */
  const partialDispenseAppts = useMemo(
    () => filteredAppts.filter((a) => a.status === "PARTIAL_DISPENSE"),
    [filteredAppts],
  );

  /* Today's Queue: active only — exclude terminal/inactive statuses. */
  const queueAppts = useMemo(
    () => filteredAppts.filter((a) =>
      !["REQUESTED", "DISPENSED", "PARTIAL_DISPENSE", "CANCELLED", "NO_SHOW", "RESCHEDULED"].includes(a.status) &&
      (a.isWalkIn || a.arrivedAt !== null)
    ),
    [filteredAppts],
  );

  const queueGroups = useMemo(() => {
    const queue     = queueAppts;
    const dispensed = filteredAppts.filter((a) => a.status === "DISPENSED");
    if (scope === "DOCTOR") {
      const hospitalsToShow = selectedFilter === "all"
        ? filterOptions
        : filterOptions.filter((h) => h.id === selectedFilter);
      const map = new Map<string, { name: string; logoUrl?: string | null; appts: Appt[]; dispensed: number }>();
      for (const h of hospitalsToShow) map.set(h.id, { name: h.name, logoUrl: h.logoUrl ?? null, appts: [], dispensed: 0 });
      for (const a of queue) {
        const key = a.hospital?.id ?? "unknown";
        if (!map.has(key)) map.set(key, { name: a.hospital?.name ?? "Unknown", logoUrl: a.hospital?.logoUrl, appts: [], dispensed: 0 });
        else if (!map.get(key)!.logoUrl && a.hospital?.logoUrl) map.get(key)!.logoUrl = a.hospital.logoUrl;
        map.get(key)!.appts.push(a);
      }
      for (const a of dispensed) {
        const key = a.hospital?.id ?? "unknown";
        if (map.has(key)) map.get(key)!.dispensed++;
      }
      return Array.from(map.entries())
        .map(([id, { name, logoUrl, appts: gAppts, dispensed: d }]) => ({ id, name, logoUrl, appts: gAppts, dispensed: d }))
        .filter((g) => g.appts.length > 0)
        .sort((a, b) => a.name.localeCompare(b.name));
    } else {
      return [{ id: "self", name: displayName, logoUrl: hospitalLogoUrl ?? null, appts: queue, dispensed: dispensed.length }];
    }
  }, [queueAppts, filteredAppts, scope, displayName, filterOptions, selectedFilter]);

  const totalQueue = queueGroups.reduce((s, g) => s + g.appts.length, 0);

  /* Only visit types actually present in today's queue get a button. */
  const visibleVisitTypeFilters = useMemo(
    () =>
      VISIT_TYPE_FILTERS.map(({ key, label }) => ({
        key,
        label,
        count: key === "WALK_IN"
          ? queueAppts.filter((a) => a.isWalkIn).length
          : queueAppts.filter((a) => a.visitType === key).length,
      })).filter((f) => f.count > 0),
    [queueAppts],
  );

  /* A filter whose button has just disappeared (its last patient was dispensed)
     must not leave the queue filtered to nothing with no way back. */
  const activeVisitType: VisitTypeFilterKey =
    visibleVisitTypeFilters.some((f) => f.key === statusFilter) ? statusFilter : "ALL";

  /* Greeting */
  const h           = greetHour ?? 8;
  const isEvening   = h >= 18;
  const isAfternoon = h >= 12;
  const greeting    = isEvening ? "Good Evening" : isAfternoon ? "Good Afternoon" : "Good Morning";
  const GreetIcon   = isEvening ? Moon : isAfternoon ? Sunset : Sun;
  const iconColor   = isEvening ? "text-teal-300" : isAfternoon ? "text-orange-300" : "text-amber-300";
  const filterLabel = scope === "DOCTOR" ? "All Hospitals" : "All Doctors";

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
              <span className="text-label sm:text-sm font-medium text-white/70 tracking-wide">{greeting}</span>
            </div>
            <h1 className="text-lg sm:text-3xl font-bold tracking-tight text-white">{bannerTitle}</h1>
            {bannerSubtitle && <p className="mt-0.5 text-label sm:text-sm text-white/70">{bannerSubtitle}</p>}
            <p className="mt-1 text-label sm:text-sm text-white/60">{todayLabel}</p>
          </div>
          <div className="flex items-center gap-2 flex-nowrap">
            {can("opd.walkin.create") && (
              <Link
                href={newEncounterHref}
                className="inline-flex shrink-0 whitespace-nowrap items-center gap-2 bg-white text-[var(--color-primary-800)] text-label sm:text-sm font-semibold px-4 py-2 rounded-xl hover:bg-white/90 transition-colors shadow-sm"
              >
                <Plus size={15} /> {newEncounterLabel}
              </Link>
            )}
            {can("appointments.view") && scope === "DOCTOR" && filterOptions.length > 0 && (
              <TealSelect
                variant="banner"
                className="min-w-0 max-w-[10rem] sm:max-w-[14rem]"
                value={selectedFilter}
                onChange={setSelectedFilter}
                options={[
                  { value: "all", label: filterLabel },
                  ...filterOptions.map((opt) => ({
                    value: opt.id,
                    label: opt.name,
                  })),
                ]}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Today's Queue ──────────────────────────────────────────────────
          Whole section is omitted without opd.view — an empty queue heading
          would read as "no patients today" rather than "not yours to see". */}
      {can("opd.view") && (
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <h2 className="text-heading-sm sm:text-base font-semibold text-[var(--color-ink-900)]">
            Today's Queue
            <span className="ml-2 text-label sm:text-sm font-normal text-[var(--color-ink-400)]">{totalQueue} total</span>
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 flex-wrap">
              {visibleVisitTypeFilters.map(({ key, label, count }) => {
                const active = activeVisitType === key;
                return (
                  <button
                    key={key}
                    onClick={() => setStatusFilter(active ? "ALL" : key)}
                    aria-pressed={active}
                    title={active ? `Show all ${totalQueue}` : `Show only ${label}`}
                    className={clsx(
                      "px-3 py-1.5 rounded-lg text-caption sm:text-xs font-semibold transition-colors",
                      active
                        ? "bg-[var(--color-primary-600)] text-white"
                        : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)] hover:bg-[var(--color-primary-50)] hover:text-[var(--color-primary-700)]"
                    )}
                  >
                    {label}
                    <span className={clsx("ml-1.5 font-bold", active ? "text-white/80" : "text-[var(--color-ink-400)]")}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            {can("appointments.view") && (
              <Link href="/appointments" className="text-caption sm:text-xs font-semibold text-[var(--color-primary-600)] hover:underline whitespace-nowrap">
                View all →
              </Link>
            )}
          </div>
        </div>

        {queueGroups.length === 0 ? (
          <div className="surface-card flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-[var(--color-surface-sunken)]">
              <CalendarX2 size={28} className="text-[var(--color-ink-300)]" />
            </div>
            <div>
              <p className="text-heading-sm sm:text-base font-semibold text-[var(--color-ink-700)]">No appointments today</p>
              <p className="text-label sm:text-sm text-[var(--color-ink-400)] mt-1 max-w-xs mx-auto">
                Confirmed appointments will appear here once patients are moved into the queue.
              </p>
            </div>
            {can("opd.walkin.create") && (
              <Link
                href={newEncounterHref}
                className="inline-flex items-center gap-2 text-label sm:text-sm font-semibold text-[var(--color-primary-600)] hover:underline"
              >
                <Plus size={14} /> {newEncounterLabel}
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {queueGroups.map(({ id, name, logoUrl, appts: gAppts, dispensed }) => {
              const displayed = activeVisitType === "ALL"
                ? gAppts
                : activeVisitType === "WALK_IN"
                  ? gAppts.filter((a) => a.isWalkIn)
                  : gAppts.filter((a) => a.visitType === activeVisitType);
              return (
                <div key={id} className="surface-card p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="shrink-0 w-8 h-8 rounded-lg bg-[var(--color-primary-50)] flex items-center justify-center overflow-hidden">
                        {logoUrl
                          ? <img src={logoUrl} alt={name} className="w-full h-full object-cover" />
                          : <Building2 size={15} className="text-[var(--color-primary-700)]" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-label sm:text-sm font-bold text-[var(--color-ink-900)] truncate">{name}</p>
                        <p className="text-caption sm:text-caption text-[var(--color-ink-400)]">
                          {gAppts.length} in queue{dispensed > 0 ? ` · ${dispensed} Dispensed` : ""}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-caption sm:text-caption font-bold px-2.5 py-1 rounded-full bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
                      {gAppts.length}
                    </span>
                  </div>
                  {displayed.length > 0 && (
                    <div className="space-y-2">
                      {displayed.map((a, idx) => <ApptRow key={a.id} appt={a} scope={scope} serial={idx + 1} canManageQueue={can("opd.queue.manage")} canViewPatient={can("patients.view")} returnTo={returnTo} />)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* ── Partial Dispense ─────────────────────────────────────────────── */}
      {can("opd.view") && (
      <div className="surface-card p-5">
        <h2 className="text-heading-sm sm:text-base font-semibold text-[var(--color-ink-900)] mb-4">
          Partial Dispense
          {partialDispenseAppts.length > 0 && (
            <span className="ml-2 text-caption sm:text-xs font-normal text-[var(--color-ink-400)]">{partialDispenseAppts.length} pending</span>
          )}
        </h2>
        {partialDispenseAppts.length === 0 ? (
          <p className="text-center text-caption sm:text-xs text-[var(--color-ink-400)] py-6">No partial dispense patients</p>
        ) : (
          <div className="space-y-2">
            {partialDispenseAppts.map((a, idx) => (
              <PartialDispenseRow key={a.id} appt={a} scope={scope} serial={idx + 1} canDispense={can("opd.dispense")} canViewPatient={can("patients.view")} returnTo={returnTo} />
            ))}
          </div>
        )}
      </div>
      )}

    </div>
  );
}
