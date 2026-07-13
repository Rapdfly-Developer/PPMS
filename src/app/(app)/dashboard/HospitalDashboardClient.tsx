"use client";

import { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown, Plus,
  Building2, Scissors,
  Sun, Sunset, Moon, ClipboardList,
} from "lucide-react";
import clsx from "clsx";

/* ── Types ─────────────────────────────────────────────────────────────── */
interface Appt {
  id: string;
  dateTime: string;
  status: string;
  visitType: string;
  patient: { name: string; udid: string; age: number; sex: string };
  doctor: { id: string; name: string } | null;
  visitId: string | null;
}

interface Surgery {
  id: string;
  surgeryType: string;
  surgeryDate: string;
  rightEye: boolean;
  leftEye: boolean;
  patient: { name: string; udid: string };
  doctor: { name: string } | null;
}

interface Admission {
  id: string;
  ward: string;
  reason: string;
  createdAt: string;
  patient: { name: string; udid: string };
  doctor: { name: string } | null;
}

interface Props {
  hospitalName: string;
  kpis: { totalToday: number; pendingOPD: number; consultedToday: number; surgeryCount: number; monthlyAppts: number };
  appointments: Appt[];
  surgeries: Surgery[];
  admissions: Admission[];
  doctors: { id: string; name: string }[];
  todayLabel: string;
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
] as const;

/* ── Single appointment row ─────────────────────────────────────────────── */
function ApptRow({ appt }: { appt: Appt }) {
  const cfg  = STATUS_CFG[appt.status] ?? STATUS_CFG["REQUESTED"];
  const time = format(new Date(appt.dateTime), "hh:mm a");

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--color-border)] bg-white hover:bg-[var(--color-primary-50)] hover:border-[var(--color-primary-200)] transition-colors group">
      {/* Time */}
      <div className="w-16 shrink-0 text-center">
        <p className="text-sm font-bold text-[var(--color-ink-900)]">{time}</p>
      </div>

      <div className="w-px self-stretch bg-[var(--color-border)]" />

      {/* Patient info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[var(--color-ink-900)] text-sm truncate">{appt.patient.name}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="font-mono text-[10px] text-[#115E59] bg-[#F0F8F6] px-1.5 py-0.5 rounded">
            {appt.patient.udid}
          </span>
          <span className="text-[11px] text-[var(--color-ink-400)]">
            {appt.patient.age}y / {appt.patient.sex === "MALE" ? "M" : appt.patient.sex === "FEMALE" ? "F" : "O"}
          </span>
          {appt.doctor && (
            <span className="text-[11px] text-[var(--color-ink-400)]">Dr. {appt.doctor.name}</span>
          )}
        </div>
      </div>

      {/* Visit type */}
      <span className="hidden md:block text-[11px] text-[var(--color-ink-400)] shrink-0 max-w-[120px] truncate">
        {appt.visitType}
      </span>

      {/* Status badge */}
      <span className={clsx("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0", cfg.color)}>
        <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", cfg.dot)} />
        {cfg.label}
      </span>

      {/* EMR link */}
      <Link
        href={appt.visitId ? `/emr/${appt.patient.udid}?visit=${appt.visitId}` : `/emr/${appt.patient.udid}`}
        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-primary-50)] text-[var(--color-primary-700)] text-xs font-semibold hover:bg-[var(--color-primary-100)] transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        <ClipboardList size={13} /> EMR
      </Link>
    </div>
  );
}

function wardLabel(w: string) {
  const m: Record<string, string> = { MALE_WARD: "General Ward", FEMALE_WARD: "General Ward" };
  return m[w] ?? w.replace(/_/g, " ");
}

/* ── Main component ─────────────────────────────────────────────────────── */
export function HospitalDashboardClient({ hospitalName, kpis, appointments, surgeries, admissions, doctors, todayLabel }: Props) {
  const router = useRouter();
  const [selectedDoctor, setSelectedDoctor] = useState<string>("all");
  const [statusFilter, setStatusFilter]     = useState<string>("ALL");

  // Greeting — computed client-side only to avoid SSR/client mismatch
  const [greetHour, setGreetHour] = useState<number | null>(null);
  useEffect(() => { setGreetHour(new Date().getHours()); }, []);

  /* Auto-refresh every 60s */
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(id);
  }, [router]);

  const filtered = useMemo(
    () => selectedDoctor === "all"
      ? appointments
      : appointments.filter((a) => a.doctor?.id === selectedDoctor),
    [appointments, selectedDoctor]
  );

  /* Queue: non-REQUESTED appointments */
  const queueAppts = useMemo(
    () => filtered.filter((a) => a.status !== "REQUESTED"),
    [filtered]
  );

  /* Visit time: only REQUESTED (booked, not yet in queue) */
  const bookedAppts = useMemo(
    () => filtered.filter((a) => a.status === "REQUESTED"),
    [filtered]
  );

  const statusFiltered = useMemo(
    () => statusFilter === "ALL" ? queueAppts : queueAppts.filter((a) => a.status === statusFilter),
    [queueAppts, statusFilter]
  );

  return (
    <div className="fade-in space-y-5">

      {/* ── Greeting Banner ──────────────────────────────────────────────── */}
      {(() => {
        const h = greetHour ?? 8;
        const isEvening   = h >= 18;
        const isAfternoon = h >= 12;
        const greeting    = isEvening ? "Good Evening" : isAfternoon ? "Good Afternoon" : "Good Morning";
        const GreetIcon   = isEvening ? Moon : isAfternoon ? Sunset : Sun;
        const iconColor   = isEvening ? "text-indigo-300" : isAfternoon ? "text-orange-300" : "text-amber-300";
        return (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--color-primary-900)] via-[var(--color-primary-700)] to-[var(--color-primary-500)] p-5 sm:p-6 text-white shadow-lg">
            {/* Decorative blobs */}
            <div className="pointer-events-none absolute -top-10 -right-10 h-48 w-48 rounded-full bg-white/5" />
            <div className="pointer-events-none absolute -bottom-12 -right-20 h-64 w-64 rounded-full bg-white/5" />
            <div className="pointer-events-none absolute top-4 right-32 h-16 w-16 rounded-full bg-white/5" />

            <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              {/* Left — greeting */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <GreetIcon size={17} className={iconColor} />
                  <span className="text-sm font-medium text-white/70 tracking-wide">{greeting}</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  {hospitalName}
                </h1>
                <p className="mt-1 text-sm text-white/60">{todayLabel}</p>
              </div>

              {/* Right — controls */}
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href="/appointments/book"
                  className="inline-flex items-center gap-2 bg-white text-[var(--color-primary-800)] text-sm font-semibold px-4 py-2 rounded-xl hover:bg-white/90 transition-colors shadow-sm"
                >
                  <Plus size={15} /> New Appointment
                </Link>
                {doctors.length > 0 && (
                  <div className="relative">
                    <select
                      value={selectedDoctor}
                      onChange={(e) => setSelectedDoctor(e.target.value)}
                      className="appearance-none pl-3 pr-8 py-2 rounded-xl border border-white/20 bg-white/10 text-sm font-medium text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/40 cursor-pointer backdrop-blur-sm"
                    >
                      <option value="all" className="text-[var(--color-ink-800)]">All Doctors</option>
                      {doctors.map((d) => (
                        <option key={d.id} value={d.id} className="text-[var(--color-ink-800)]">Dr. {d.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-white/70" />
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Today's Queue ────────────────────────────────────────────────── */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <h2 className="text-base font-semibold text-[var(--color-ink-900)]">
            Today's Queue
            <span className="ml-2 text-sm font-normal text-[var(--color-ink-400)]">
              {queueAppts.length} total
            </span>
          </h2>
          <div className="flex items-center gap-3">
            {/* Status filter tabs */}
            <div className="flex items-center gap-1 flex-wrap">
              {STATUS_FILTERS.map(({ key, label }) => {
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

        <div className="surface-card p-4 flex flex-col gap-3">
          {/* Hospital header row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="shrink-0 p-1.5 rounded-lg bg-[var(--color-primary-50)]">
                <Building2 size={15} className="text-[var(--color-primary-700)]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-[var(--color-ink-900)] truncate">{hospitalName}</p>
                <p className="text-[11px] text-[var(--color-ink-400)]">
                  {queueAppts.length} in queue · {queueAppts.filter((a) => a.status === "DISPENSED").length} Dispensed
                </p>
              </div>
            </div>
            <span className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
              {queueAppts.length}
            </span>
          </div>

          {/* Appointment rows or empty state */}
          {statusFiltered.length === 0 ? (
            <p className="text-center text-xs text-[var(--color-ink-400)] py-4">
              No patients in queue yet
            </p>
          ) : (
            <div className="space-y-2">
              {statusFiltered.map((a) => <ApptRow key={a.id} appt={a} />)}
            </div>
          )}
        </div>
      </div>

      {/* ── Surgeries + Visit time side by side ──────────────────────────── */}
      {(surgeries.length > 0 || bookedAppts.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Scheduled Surgeries */}
          {surgeries.length > 0 && (
            <div className="surface-card p-5">
              <h2 className="text-base font-semibold text-[var(--color-ink-900)] mb-4">
                Scheduled OT
                <span className="ml-2 text-xs font-normal text-[var(--color-ink-400)]">{surgeries.length} upcoming</span>
              </h2>
              <div className="space-y-2">
                {surgeries.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--color-border)] bg-white">
                    <div className="w-20 shrink-0 text-center">
                      <p className="text-xs font-bold text-[var(--color-ink-900)]">{format(new Date(s.surgeryDate), "d MMM")}</p>
                      <p className="text-[10px] text-[var(--color-ink-400)]">{format(new Date(s.surgeryDate), "hh:mm a")}</p>
                    </div>
                    <div className="w-px self-stretch bg-[var(--color-border)]" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-[var(--color-ink-900)] truncate">{s.patient.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="font-mono text-[10px] text-[#115E59] bg-[#F0F8F6] px-1.5 py-0.5 rounded">{s.patient.udid}</span>
                        {s.doctor && (
                          <span className="text-[11px] text-[var(--color-ink-400)]">Dr. {s.doctor.name}</span>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full truncate max-w-[140px]">
                      {s.surgeryType}
                    </span>
                    <span className="shrink-0 text-[10px] text-[var(--color-ink-400)]">
                      {s.rightEye && s.leftEye ? "OU" : s.rightEye ? "RE" : "LE"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Visit time (booked, not yet in queue) */}
          {bookedAppts.length > 0 && (
            <div className="surface-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-[var(--color-ink-900)]">
                  Visit time
                  <span className="ml-2 text-xs font-normal text-[var(--color-ink-400)]">{bookedAppts.length} booked</span>
                </h2>
                <Link href="/appointments" className="text-xs font-semibold text-[var(--color-primary-600)] hover:underline">View all →</Link>
              </div>
              <div className="space-y-1.5">
                {bookedAppts.map((a) => {
                  const cfg = STATUS_CFG[a.status] ?? STATUS_CFG["REQUESTED"];
                  return (
                    <div key={a.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[var(--color-border)] bg-white">
                      <span className="text-sm font-bold text-[var(--color-ink-900)] w-16 shrink-0">
                        {format(new Date(a.dateTime), "h:mm a")}
                      </span>
                      <div className="w-px self-stretch bg-[var(--color-border)]" />
                      <Link href={`/patients/${a.patient.udid}?returnTo=/dashboard`} className="flex-1 min-w-0 hover:opacity-80 transition-opacity">
                        <p className="text-sm font-semibold text-[var(--color-ink-900)] truncate">{a.patient.name}</p>
                        <span className="font-mono text-[10px] text-[#115E59] bg-[#F0F8F6] px-1.5 py-0.5 rounded">
                          {a.patient.udid}
                        </span>
                      </Link>
                      {a.doctor && (
                        <span className="text-[11px] text-[var(--color-ink-400)] shrink-0">Dr. {a.doctor.name}</span>
                      )}
                      <span className={clsx("text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0", cfg.color)}>
                        {cfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
