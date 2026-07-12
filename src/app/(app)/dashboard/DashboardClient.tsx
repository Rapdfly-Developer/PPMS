"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import { format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown, Plus, Building2, Phone, LogIn, Loader2,
  Sun, Sunset, Moon,
} from "lucide-react";
import clsx from "clsx";
import { doctorConfirmAppointment, hospitalUpdateAppointmentStatus } from "@/app/(app)/appointments/actions";

/* ── Types ─────────────────────────────────────────────────────────────── */
interface Appt {
  id: string;
  dateTime: string;
  status: string;
  complaint: string | null;
  patient: { name: string; udid: string; uhid?: string; age: number; sex: string; mobile?: string };
  hospital?: { id: string; name: string };
  doctor?:   { id: string; name: string } | null;
  visitId:   string | null;
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
  REQUESTED:   { label: "Scheduled",   color: "bg-blue-100 text-blue-700",    dot: "bg-blue-500"   },
  CONFIRMED:   { label: "Waiting",     color: "bg-amber-100 text-amber-700",  dot: "bg-amber-500"  },
  DISPENSED:   { label: "Dispensed",   color: "bg-green-100 text-green-700",  dot: "bg-green-500"  },
  CANCELLED:   { label: "Cancelled",   color: "bg-red-100 text-red-600",      dot: "bg-red-500"    },
  NO_SHOW:     { label: "No Show",     color: "bg-gray-100 text-gray-500",    dot: "bg-gray-400"   },
  RESCHEDULED: { label: "Rescheduled", color: "bg-purple-100 text-purple-700",dot: "bg-purple-500" },
};

const STATUS_FILTERS = [
  { key: "ALL",       label: "All"       },
  { key: "CONFIRMED", label: "Waiting"   },
  { key: "DISPENSED", label: "Dispensed" },
  { key: "CANCELLED", label: "Cancelled" },
  { key: "NO_SHOW",   label: "No Show"   },
] as const;

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

/* ── Appointment row ────────────────────────────────────────────────────── */
function ApptRow({ appt, role }: { appt: Appt; role: "DOCTOR" | "HOSPITAL" }) {
  const cfg  = STATUS_CFG[appt.status] ?? STATUS_CFG["REQUESTED"];
  const time = format(new Date(appt.dateTime), "hh:mm a");

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--color-border)] bg-white hover:bg-[var(--color-primary-50)] hover:border-[var(--color-primary-200)] transition-colors">
      <div className="w-16 shrink-0 text-center">
        <p className="text-sm font-bold text-[var(--color-ink-900)]">{time}</p>
      </div>
      <div className="w-px self-stretch bg-[var(--color-border)]" />
      <Link href={`/patients/${appt.patient.udid}?returnTo=/dashboard`} className="flex-1 min-w-0 hover:opacity-80 transition-opacity">
        <p className="font-semibold text-[var(--color-ink-900)] text-sm truncate">{appt.patient.name}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span title="UDID (Doctor ID)" className="font-mono text-[10px] text-[#115E59] bg-[#F0F8F6] px-1.5 py-0.5 rounded">
            {appt.patient.udid}
          </span>
          {appt.patient.uhid && (
            <span title="UHID (Hospital ID)" className="font-mono text-[10px] text-[#1E4B8F] bg-[#F0F4FA] px-1.5 py-0.5 rounded">
              {appt.patient.uhid}
            </span>
          )}
          <span className="text-[11px] text-[var(--color-ink-400)]">
            {appt.patient.age}y / {appt.patient.sex === "MALE" ? "M" : appt.patient.sex === "FEMALE" ? "F" : "O"}
          </span>
          {role === "DOCTOR" && appt.patient.mobile && (
            <span className="inline-flex items-center gap-0.5 text-[11px] text-[var(--color-ink-400)]">
              <Phone size={9} /> {appt.patient.mobile}
            </span>
          )}
          {role === "DOCTOR" && appt.hospital && (
            <span className="inline-flex items-center gap-0.5 text-[11px] text-[var(--color-ink-400)]">
              <Building2 size={9} /> {appt.hospital.name}
            </span>
          )}
          {role === "HOSPITAL" && appt.doctor && (
            <span className="text-[11px] text-[var(--color-ink-400)]">
              Dr. {appt.doctor.name}
            </span>
          )}
        </div>
      </Link>
      {appt.complaint && (
        <span className="hidden md:block text-[11px] text-[var(--color-ink-400)] italic shrink-0 max-w-[140px] truncate">
          {appt.complaint}
        </span>
      )}
      <span className={clsx("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0", cfg.color)}>
        <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", cfg.dot)} />
        {cfg.label}
      </span>
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
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(id);
  }, [router]);

  /* Filter appts by selected hospital (DOCTOR) or doctor (HOSPITAL) */
  const filteredAppts = useMemo(() => {
    if (selectedFilter === "all") return appts;
    return role === "DOCTOR"
      ? appts.filter((a) => a.hospital?.id === selectedFilter)
      : appts.filter((a) => a.doctor?.id === selectedFilter);
  }, [appts, selectedFilter, role]);

  /* Today's Queue: non-REQUESTED, grouped by hospital (DOCTOR) or single card (HOSPITAL) */
  const queueGroups = useMemo(() => {
    const queue = filteredAppts.filter((a) => a.status !== "REQUESTED");
    if (role === "DOCTOR") {
      const hospitalsToShow = selectedFilter === "all"
        ? filterOptions
        : filterOptions.filter((h) => h.id === selectedFilter);
      const map = new Map<string, { name: string; appts: Appt[] }>();
      for (const h of hospitalsToShow) map.set(h.id, { name: h.name, appts: [] });
      for (const a of queue) {
        const key = a.hospital?.id ?? "unknown";
        if (!map.has(key)) map.set(key, { name: a.hospital?.name ?? "Unknown", appts: [] });
        map.get(key)!.appts.push(a);
      }
      return Array.from(map.entries())
        .map(([id, { name, appts: gAppts }]) => ({ id, name, appts: gAppts }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } else {
      return [{ id: "self", name: displayName, appts: queue }];
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
                const queueAppts = filteredAppts.filter((a) => a.status !== "REQUESTED");
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

        <div className="grid grid-cols-1 gap-4">
          {queueGroups.map(({ id, name, appts: gAppts }) => {
            const displayed = statusFilter === "ALL" ? gAppts : gAppts.filter((a) => a.status === statusFilter);
            const dispensed = gAppts.filter((a) => a.status === "DISPENSED").length;
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
                        {gAppts.length} in queue · {dispensed} Dispensed
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
                    {gAppts.length}
                  </span>
                </div>
                {displayed.length === 0 ? (
                  <p className="text-center text-xs text-[var(--color-ink-400)] py-4">No patients in queue yet</p>
                ) : (
                  <div className="space-y-2">
                    {displayed.map((a) => <ApptRow key={a.id} appt={a} role={role} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Surgeries + Visit time ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Scheduled OT */}
          <div className="surface-card p-5">
            <h2 className="text-base font-semibold text-[var(--color-ink-900)] mb-4">
              Scheduled OT
              {filteredSurgeries.length > 0 && (
                <span className="ml-2 text-xs font-normal text-[var(--color-ink-400)]">{filteredSurgeries.length} upcoming</span>
              )}
            </h2>
            {filteredSurgeries.length === 0 && (
              <p className="text-center text-xs text-[var(--color-ink-400)] py-6">No patients scheduled for OT</p>
            )}
            {filteredSurgeries.length > 0 && (
              <div className="space-y-2">
                {filteredSurgeries.map((s) => <SurgeryRow key={s.id} s={s} role={role} />)}
              </div>
            )}
          </div>

          {/* Visit time */}
          <div className="surface-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-[var(--color-ink-900)]">
                Visit time
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
                      {gAppts.map((a) => {
                        const cfg      = STATUS_CFG[a.status] ?? STATUS_CFG["REQUESTED"];
                        const isMoving = movingId === a.id;
                        return (
                          <div key={a.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[var(--color-border)] bg-white">
                            <span className="text-sm font-bold text-[var(--color-ink-900)] w-16 shrink-0">
                              {format(new Date(a.dateTime), "h:mm a")}
                            </span>
                            <div className="w-px self-stretch bg-[var(--color-border)]" />
                            <Link href={`/patients/${a.patient.udid}?returnTo=/dashboard`} className="flex-1 min-w-0 hover:opacity-80 transition-opacity">
                              <p className="text-sm font-semibold text-[var(--color-ink-900)] truncate">{a.patient.name}</p>
                              <span className="inline-flex items-center gap-1 flex-wrap">
                                <span title="UDID (Doctor ID)" className="font-mono text-[10px] text-[#115E59] bg-[#F0F8F6] px-1.5 py-0.5 rounded">
                                  {a.patient.udid}
                                </span>
                                {a.patient.uhid && (
                                  <span title="UHID (Hospital ID)" className="font-mono text-[10px] text-[#1E4B8F] bg-[#F0F4FA] px-1.5 py-0.5 rounded">
                                    {a.patient.uhid}
                                  </span>
                                )}
                              </span>
                            </Link>
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
