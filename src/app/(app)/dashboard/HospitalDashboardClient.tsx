"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import Link from "next/link";
import {
  CalendarDays, Clock, Scissors, BarChart2,
  ChevronDown, Sun, Sunset, Moon, CheckCircle2,
  AlertCircle, XCircle, ClipboardList, BedDouble,
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
const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  REQUESTED:   { label: "Scheduled", color: "bg-blue-100 text-blue-700",    icon: <CalendarDays size={11} /> },
  CONFIRMED:   { label: "Waiting",   color: "bg-amber-100 text-amber-700",  icon: <Clock size={11} /> },
  COMPLETED:   { label: "Consulted", color: "bg-green-100 text-green-700",  icon: <CheckCircle2 size={11} /> },
  CANCELLED:   { label: "Cancelled", color: "bg-red-100 text-red-600",      icon: <XCircle size={11} /> },
  NO_SHOW:     { label: "No Show",   color: "bg-gray-100 text-gray-500",    icon: <AlertCircle size={11} /> },
  RESCHEDULED: { label: "Rescheduled",color:"bg-purple-100 text-purple-700",icon: <CalendarDays size={11} /> },
};

/* ── Time slot helper ───────────────────────────────────────────────────── */
function getSlot(dateTime: string): "morning" | "afternoon" | "evening" | "other" {
  const h = new Date(dateTime).getHours();
  if (h >= 8  && h < 12) return "morning";
  if (h >= 12 && h < 16) return "afternoon";
  if (h >= 16 && h < 22) return "evening";
  return "other";
}

const SLOTS = [
  { key: "morning",   label: "Morning",   range: "08:00 AM – 12:00 PM", Icon: Sun    },
  { key: "afternoon", label: "Afternoon", range: "12:00 PM – 04:00 PM", Icon: Sunset },
  { key: "evening",   label: "Evening",   range: "04:00 PM – 10:00 PM", Icon: Moon   },
  { key: "other",     label: "Other",     range: "Before 8 AM / Late",  Icon: Clock  },
] as const;

/* ── Appointment card ───────────────────────────────────────────────────── */
function ApptCard({ appt }: { appt: Appt }) {
  const cfg = STATUS_CFG[appt.status] ?? STATUS_CFG["REQUESTED"];
  const time = format(new Date(appt.dateTime), "hh:mm a");

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--color-border)] bg-white hover:shadow-sm transition-shadow">
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
          {appt.doctor && (
            <span className="text-[11px] text-[var(--color-ink-400)]">Dr. {appt.doctor.name}</span>
          )}
        </div>
      </div>

      {/* Status */}
      <span className={clsx("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0", cfg.color)}>
        {cfg.icon} {cfg.label}
      </span>

      {/* Open EMR */}
      <Link
        href={appt.visitId ? `/emr/${appt.patient.udid}?visit=${appt.visitId}` : `/emr/${appt.patient.udid}`}
        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-primary-50)] text-[var(--color-primary-700)] text-xs font-semibold hover:bg-[var(--color-primary-100)] transition-colors"
      >
        <ClipboardList size={13} /> EMR
      </Link>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */
function wardLabel(w: string) {
  const m: Record<string, string> = { MALE_WARD: "General Ward", FEMALE_WARD: "General Ward" };
  return m[w] ?? w.replace(/_/g, " ");
}

export function HospitalDashboardClient({ hospitalName, kpis, appointments, surgeries, admissions, doctors, todayLabel }: Props) {
  const [selectedDoctor, setSelectedDoctor] = useState<string>("all");

  const filtered = useMemo(
    () => selectedDoctor === "all"
      ? appointments
      : appointments.filter((a) => a.doctor?.id === selectedDoctor),
    [appointments, selectedDoctor]
  );

  // Recompute KPIs from filtered list
  const filteredPending    = filtered.filter((a) => ["REQUESTED", "CONFIRMED"].includes(a.status)).length;
  const filteredConsulted  = filtered.filter((a) => a.status === "COMPLETED").length;
  const filteredTotal      = filtered.length;

  // Group by time slot
  const grouped = useMemo(() => {
    const map: Record<string, Appt[]> = { morning: [], afternoon: [], evening: [], other: [] };
    for (const a of filtered) map[getSlot(a.dateTime)].push(a);
    return map;
  }, [filtered]);

  const kpiCards = [
    {
      label: "Today's OPD",
      value: filteredTotal,
      sub:   "Total scheduled today",
      icon:  <CalendarDays size={20} />,
      bg:    "bg-blue-50 text-blue-700",
      val:   "text-blue-700",
      href:  "/appointments",
    },
    {
      label: "Pending OPD",
      value: filteredPending,
      sub:   "Scheduled / Waiting",
      icon:  <Clock size={20} />,
      bg:    "bg-amber-50 text-amber-700",
      val:   "text-amber-700",
      href:  "/appointments?status=CONFIRMED",
    },
    {
      label: "Scheduled Surgeries",
      value: kpis.surgeryCount,
      sub:   "Today & upcoming",
      icon:  <Scissors size={20} />,
      bg:    "bg-purple-50 text-purple-700",
      val:   "text-purple-700",
      href:  "/appointments",
    },
    {
      label: "Analytics",
      value: filteredConsulted,
      sub:   `${filteredPending} pending · ${kpis.monthlyAppts} this month`,
      icon:  <BarChart2 size={20} />,
      bg:    "bg-green-50 text-green-700",
      val:   "text-green-700",
      href:  "/analytics",
    },
  ];

  return (
    <div className="fade-in space-y-5">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-ink-900)]">{hospitalName}</h1>
          <p className="text-sm text-[var(--color-ink-400)] mt-0.5">{todayLabel}</p>
        </div>

        {/* Doctor filter */}
        {doctors.length > 1 && (
          <div className="relative">
            <select
              value={selectedDoctor}
              onChange={(e) => setSelectedDoctor(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 rounded-xl border border-[var(--color-border)] bg-white text-sm font-medium text-[var(--color-ink-800)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] cursor-pointer"
            >
              <option value="all">All Doctors</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>Dr. {d.name}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-ink-400)]" />
          </div>
        )}
      </div>

      {/* ── 4 KPI cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpiCards.map((k) => (
          <Link key={k.label} href={k.href} className="block group">
            <div className="surface-card p-4 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[var(--shadow-lifted)]">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)] leading-tight">{k.label}</p>
                  <p className={clsx("text-3xl font-bold mt-2 tracking-tight", k.val)}>{k.value}</p>
                  <p className="text-[11px] text-[var(--color-ink-400)] mt-1 leading-snug">{k.sub}</p>
                </div>
                <div className={clsx("shrink-0 p-2.5 rounded-xl", k.bg)}>{k.icon}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Time-grouped appointments ────────────────────────────────────── */}
      <div className="surface-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-[var(--color-ink-900)]">Today's Appointments</h2>
          <Link href="/appointments" className="text-xs font-semibold text-[var(--color-primary-600)] hover:underline">
            View all →
          </Link>
        </div>

        {filteredTotal === 0 ? (
          <div className="text-center py-12 text-[var(--color-ink-400)]">
            <CalendarDays size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No appointments scheduled for today</p>
          </div>
        ) : (
          <div className="space-y-6">
            {SLOTS.map(({ key, label, range, Icon }) => {
              const list = grouped[key];
              if (!list.length) return null;
              return (
                <div key={key}>
                  {/* Slot header */}
                  <div className="flex items-center gap-2 mb-2.5">
                    <Icon size={14} className="text-[var(--color-ink-400)]" />
                    <span className="text-xs font-semibold text-[var(--color-ink-600)] uppercase tracking-wider">{label}</span>
                    <span className="text-xs text-[var(--color-ink-400)]">· {range}</span>
                    <span className="ml-auto text-xs font-semibold text-[var(--color-ink-500)]">{list.length} patient{list.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="space-y-2">
                    {list.map((a) => <ApptCard key={a.id} appt={a} />)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Surgeries + IPD 50/50 ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Scheduled Surgeries */}
        <div className="surface-card p-5">
          <h2 className="text-base font-semibold text-[var(--color-ink-900)] mb-4">
            Scheduled Surgeries
            {surgeries.length > 0 && (
              <span className="ml-2 text-xs font-normal text-[var(--color-ink-400)]">{surgeries.length} upcoming</span>
            )}
          </h2>
          {surgeries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-[var(--color-ink-400)]">
              <Scissors size={28} className="mb-2 opacity-25" />
              <p className="text-sm">No upcoming surgeries</p>
            </div>
          ) : (
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
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-[10px] text-[#115E59] bg-[#F0F8F6] px-1.5 py-0.5 rounded">{s.patient.udid}</span>
                      {s.doctor && <span className="text-[11px] text-[var(--color-ink-400)]">Dr. {s.doctor.name}</span>}
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
          )}
        </div>

        {/* Active IPD Patients */}
        <div className="surface-card p-5">
          <h2 className="text-base font-semibold text-[var(--color-ink-900)] mb-4">
            IPD Patients
            {admissions.length > 0 && (
              <span className="ml-2 text-xs font-normal text-[var(--color-ink-400)]">{admissions.length} admitted</span>
            )}
          </h2>
          {admissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-[var(--color-ink-400)]">
              <BedDouble size={28} className="mb-2 opacity-25" />
              <p className="text-sm">No active IPD admissions</p>
            </div>
          ) : (
            <div className="space-y-2">
              {admissions.map((a) => (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--color-border)] bg-white">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-[var(--color-ink-900)] truncate">{a.patient.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="font-mono text-[10px] text-[#115E59] bg-[#F0F8F6] px-1.5 py-0.5 rounded">{a.patient.udid}</span>
                      {a.doctor && <span className="text-[11px] text-[var(--color-ink-400)]">Dr. {a.doctor.name}</span>}
                      <span className="text-[11px] text-[var(--color-ink-400)]">{wardLabel(a.ward)}</span>
                    </div>
                  </div>
                  <BedDouble size={15} className="text-[var(--color-ink-300)] shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
