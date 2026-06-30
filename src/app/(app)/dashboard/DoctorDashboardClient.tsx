"use client";

import { useState, useMemo, useEffect } from "react";
import { format, differenceInDays } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays, Clock, Scissors, BarChart2,
  ChevronDown,
  ClipboardList,
  Building2, BedDouble, Phone, RefreshCw,
} from "lucide-react";
import clsx from "clsx";

/* ── Types ─────────────────────────────────────────────────────────────── */
interface Appt {
  id: string;
  dateTime: string;
  status: string;
  visitType: string;
  patient: { name: string; udid: string; age: number; sex: string; mobile: string };
  hospital: { id: string; name: string };
  visitId: string | null;
}

interface Surgery {
  id: string;
  surgeryType: string;
  surgeryDate: string;
  rightEye: boolean;
  leftEye: boolean;
  patient: { name: string; udid: string };
  hospital: { name: string } | null;
}

interface Admission {
  id: string;
  ward: string;
  reason: string;
  createdAt: string;
  patient: { name: string; udid: string };
  hospital: { name: string } | null;
  surgeryType: string | null;
}

interface TodaySession {
  id: string; hospitalId: string; hospitalName: string;
  startTime: string; endTime: string; slotMins: number; maxPatients: number; apptCount: number;
}

interface UpcomingSession {
  weekday: number; hospitalName: string; startTime: string; endTime: string; daysAway: number;
}

interface Props {
  doctorName: string;
  appts: Appt[];
  surgeries: Surgery[];
  hospitals: { id: string; name: string }[];
  admissions: Admission[];
  monthlyCount: number;
  todayLabel: string;
  todaySchedule: TodaySession[];
  upcomingSchedule: UpcomingSession[];
}

/* ── Status config ──────────────────────────────────────────────────────── */
const STATUS_CFG: Record<string, { label: string; color: string; dot: string }> = {
  REQUESTED:   { label: "Scheduled",   color: "bg-blue-100 text-blue-700",    dot: "bg-blue-500"   },
  CONFIRMED:   { label: "Waiting",     color: "bg-amber-100 text-amber-700",  dot: "bg-amber-500"  },
  COMPLETED:   { label: "Consulted",   color: "bg-green-100 text-green-700",  dot: "bg-green-500"  },
  CANCELLED:   { label: "Cancelled",   color: "bg-red-100 text-red-600",      dot: "bg-red-500"    },
  NO_SHOW:     { label: "No Show",     color: "bg-gray-100 text-gray-500",    dot: "bg-gray-400"   },
  RESCHEDULED: { label: "Rescheduled", color: "bg-purple-100 text-purple-700",dot: "bg-purple-500" },
};

const STATUS_FILTERS = [
  { key: "ALL",       label: "All"       },
  { key: "CONFIRMED", label: "Waiting"   },
  { key: "COMPLETED", label: "Consulted" },
  { key: "CANCELLED", label: "Cancelled" },
  { key: "NO_SHOW",   label: "No Show"   },
] as const;

/* ── Ward label ─────────────────────────────────────────────────────────── */
function wardLabel(w: string) {
  const m: Record<string, string> = { MALE_WARD: "General Ward", FEMALE_WARD: "General Ward" };
  return m[w] ?? w.replace(/_/g, " ");
}

/* ── Single appointment row ─────────────────────────────────────────────── */
function ApptRow({ appt }: { appt: Appt }) {
  const cfg  = STATUS_CFG[appt.status] ?? STATUS_CFG["REQUESTED"];
  const time = format(new Date(appt.dateTime), "hh:mm a");
  const href = appt.visitId
    ? `/emr/${appt.patient.udid}?visit=${appt.visitId}`
    : `/emr/${appt.patient.udid}`;

  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--color-border)] bg-white hover:bg-[var(--color-primary-50)] hover:border-[var(--color-primary-200)] transition-colors group"
    >
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
          {appt.patient.mobile && (
            <span className="inline-flex items-center gap-0.5 text-[11px] text-[var(--color-ink-400)]">
              <Phone size={9} /> {appt.patient.mobile}
            </span>
          )}
          <span className="inline-flex items-center gap-0.5 text-[11px] text-[var(--color-ink-400)]">
            <Building2 size={9} /> {appt.hospital.name}
          </span>
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

      {/* EMR button */}
      <span className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-primary-50)] text-[var(--color-primary-700)] text-xs font-semibold group-hover:bg-[var(--color-primary-100)] transition-colors">
        <ClipboardList size={13} /> EMR
      </span>
    </Link>
  );
}


/* ── Main component ─────────────────────────────────────────────────────── */
const WEEKDAYS_FULL = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const DAY_COLORS = ["bg-rose-100 text-rose-700","bg-blue-100 text-blue-700","bg-emerald-100 text-emerald-700","bg-amber-100 text-amber-700","bg-purple-100 text-purple-700","bg-cyan-100 text-cyan-700","bg-orange-100 text-orange-700"];

function fmt12(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function slotsCount(start: string, end: string, mins: number) {
  const toM = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  return Math.max(0, Math.floor((toM(end) - toM(start)) / mins));
}

export function DoctorDashboardClient({
  doctorName, appts, surgeries, hospitals, admissions, monthlyCount, todayLabel,
  todaySchedule, upcomingSchedule,
}: Props) {
  const router = useRouter();
  const [selectedHospital, setSelectedHospital] = useState<string>("all");
  const [statusFilter, setStatusFilter]         = useState<string>("ALL");

  /* Auto-refresh every 60 s */
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(id);
  }, [router]);

  /* Filtered by hospital dropdown */
  const hospitalFiltered = useMemo(
    () => selectedHospital === "all" ? appts : appts.filter((a) => a.hospital.id === selectedHospital),
    [appts, selectedHospital]
  );

  const filteredSurgeries = useMemo(
    () => selectedHospital === "all"
      ? surgeries
      : surgeries.filter((s) => s.hospital?.name === hospitals.find((h) => h.id === selectedHospital)?.name),
    [surgeries, selectedHospital, hospitals]
  );

  /* KPIs */
  const totalToday     = hospitalFiltered.length;
  const pendingOPD     = hospitalFiltered.filter((a) => ["REQUESTED", "CONFIRMED"].includes(a.status)).length;
  const consultedToday = hospitalFiltered.filter((a) => a.status === "COMPLETED").length;
  const surgeryCount   = filteredSurgeries.length;

  /* Group by hospital for accordion (when All Hospitals) */
  const byHospital = useMemo(() => {
    const map = new Map<string, { hospital: { id: string; name: string }; appts: Appt[] }>();
    for (const a of hospitalFiltered) {
      const key = a.hospital.id;
      if (!map.has(key)) map.set(key, { hospital: a.hospital, appts: [] });
      map.get(key)!.appts.push(a);
    }
    return Array.from(map.values()).sort((a, b) => a.hospital.name.localeCompare(b.hospital.name));
  }, [hospitalFiltered]);

  const kpiCards = [
    { label: "Today's OPD", value: totalToday,     sub: selectedHospital === "all" ? "All hospitals" : (hospitals.find(h => h.id === selectedHospital)?.name ?? ""), icon: <CalendarDays size={20} />, bg: "bg-blue-50 text-blue-700",   val: "text-blue-700",   href: "/appointments" },
    { label: "Pending",      value: pendingOPD,     sub: "Scheduled / Waiting",   icon: <Clock size={20} />,        bg: "bg-amber-50 text-amber-700",   val: "text-amber-700",  href: "/appointments" },
    { label: "Surgeries",    value: surgeryCount,   sub: "Today & upcoming",      icon: <Scissors size={20} />,     bg: "bg-purple-50 text-purple-700", val: "text-purple-700", href: "/ipd"          },
    { label: "Consulted",    value: consultedToday, sub: `${monthlyCount} this month`, icon: <BarChart2 size={20} />, bg: "bg-green-50 text-green-700", val: "text-green-700",  href: "/analytics"    },
  ];

  return (
    <div className="fade-in space-y-5">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-ink-900)]">Dr. {doctorName}</h1>
          <p className="text-sm text-[var(--color-ink-400)] mt-0.5">{todayLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Hospital filter dropdown */}
          <div className="relative">
            <select
              value={selectedHospital}
              onChange={(e) => setSelectedHospital(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 rounded-xl border border-[var(--color-border)] bg-white text-sm font-medium text-[var(--color-ink-800)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] cursor-pointer"
            >
              <option value="all">All Hospitals</option>
              {hospitals.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-ink-400)]" />
          </div>
          {/* Manual refresh */}
          <button
            onClick={() => router.refresh()}
            title="Refresh"
            className="p-2 rounded-xl border border-[var(--color-border)] bg-white text-[var(--color-ink-400)] hover:text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)] transition-colors"
          >
            <RefreshCw size={15} />
          </button>
        </div>
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
                  <p className="text-[11px] text-[var(--color-ink-400)] mt-1 leading-snug truncate">{k.sub}</p>
                </div>
                <div className={clsx("shrink-0 p-2.5 rounded-xl", k.bg)}>{k.icon}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Today's Hospital Schedule ────────────────────────────────────── */}
      {(todaySchedule.length > 0 || upcomingSchedule.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Today's sessions */}
          <div className="surface-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-[var(--color-ink-900)]">
                Today's Hospital Schedule
              </h2>
              <Link href="/appointments/availability" className="text-xs font-semibold text-[var(--color-primary-600)] hover:underline">
                Manage →
              </Link>
            </div>
            {todaySchedule.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <CalendarDays size={28} className="text-[var(--color-ink-200)]" />
                <p className="text-sm text-[var(--color-ink-400)]">No sessions configured for today</p>
                <Link href="/appointments/availability" className="text-xs text-[var(--color-primary-600)] hover:underline">
                  Set up availability →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {todaySchedule.map((s) => {
                  const total = slotsCount(s.startTime, s.endTime, s.slotMins) * s.maxPatients;
                  const pct   = total > 0 ? Math.min(100, Math.round((s.apptCount / total) * 100)) : 0;
                  return (
                    <div key={s.id} className="rounded-xl border border-[var(--color-border)] px-4 py-3 bg-white">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm text-[var(--color-ink-900)] truncate">{s.hospitalName}</p>
                          <p className="text-xs text-[var(--color-ink-400)] mt-0.5">
                            {fmt12(s.startTime)} – {fmt12(s.endTime)} · {s.slotMins}min slots
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-lg font-bold text-[var(--color-primary-700)]">{s.apptCount}</p>
                          <p className="text-[10px] text-[var(--color-ink-400)]">/ {total} cap</p>
                        </div>
                      </div>
                      {total > 0 && (
                        <div className="mt-2">
                          <div className="h-1.5 rounded-full bg-[var(--color-surface-sunken)] overflow-hidden">
                            <div
                              className={clsx("h-full rounded-full transition-all", pct >= 80 ? "bg-red-500" : pct >= 50 ? "bg-amber-500" : "bg-emerald-500")}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-[var(--color-ink-400)] mt-0.5">{pct}% booked</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upcoming schedules */}
          <div className="surface-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-[var(--color-ink-900)]">
                Upcoming Schedule
              </h2>
              <Link href="/appointments/availability" className="text-xs font-semibold text-[var(--color-primary-600)] hover:underline">
                Edit →
              </Link>
            </div>
            {upcomingSchedule.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <CalendarDays size={28} className="text-[var(--color-ink-200)]" />
                <p className="text-sm text-[var(--color-ink-400)]">No upcoming sessions in next 7 days</p>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingSchedule.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[var(--color-border)] bg-white">
                    <span className={clsx("text-[11px] font-bold px-2 py-1 rounded-lg shrink-0", DAY_COLORS[s.weekday])}>
                      {WEEKDAYS_FULL[s.weekday].slice(0, 3)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-ink-800)] truncate">{s.hospitalName}</p>
                      <p className="text-xs text-[var(--color-ink-400)]">{fmt12(s.startTime)} – {fmt12(s.endTime)}</p>
                    </div>
                    <span className={clsx(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0",
                      s.daysAway === 1 ? "bg-[var(--color-primary-100)] text-[var(--color-primary-700)]" : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]"
                    )}>
                      {s.daysAway === 1 ? "Tomorrow" : `In ${s.daysAway}d`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ── Today's Appointments ─────────────────────────────────────────── */}
      <div className="surface-card p-5">
        {/* Section header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-semibold text-[var(--color-ink-900)]">
            Today's Appointments
            <span className="ml-2 text-sm font-normal text-[var(--color-ink-400)]">{totalToday} total</span>
          </h2>
          <Link href="/appointments" className="text-xs font-semibold text-[var(--color-primary-600)] hover:underline self-start sm:self-auto">
            View all →
          </Link>
        </div>

        {/* Status filter tabs */}
        <div className="flex items-center gap-1 flex-wrap mb-4">
          {STATUS_FILTERS.map(({ key, label }) => {
            const count = key === "ALL"
              ? hospitalFiltered.length
              : hospitalFiltered.filter((a) => a.status === key).length;
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

        {/* Content — flat list always */}
        {totalToday === 0 ? (
          <div className="text-center py-12 text-[var(--color-ink-400)]">
            <CalendarDays size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No appointments scheduled for today</p>
          </div>
        ) : (() => {
          const list = statusFilter === "ALL"
            ? hospitalFiltered
            : hospitalFiltered.filter((a) => a.status === statusFilter);
          return list.length === 0
            ? <p className="text-center text-sm text-[var(--color-ink-400)] py-8">No appointments match this filter.</p>
            : <div className="space-y-2">{list.map((a) => <ApptRow key={a.id} appt={a} />)}</div>;
        })()}
      </div>

      {/* ── Surgeries + IPD side by side ─────────────────────────────────── */}
      {(filteredSurgeries.length > 0 || admissions.length > 0) && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

      {/* Upcoming Surgeries */}
      {filteredSurgeries.length > 0 && (
        <div className="surface-card p-5">
          <h2 className="text-base font-semibold text-[var(--color-ink-900)] mb-4">
            Scheduled Surgeries
            <span className="ml-2 text-xs font-normal text-[var(--color-ink-400)]">{filteredSurgeries.length} upcoming</span>
          </h2>
          <div className="space-y-2">
            {filteredSurgeries.map((s) => (
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
                    {s.hospital && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-[var(--color-ink-400)]">
                        <Building2 size={10} /> {s.hospital.name}
                      </span>
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
            ))}
          </div>
        </div>
      )}

      {/* ── IPD / Active Admissions ──────────────────────────────────────── */}
      {admissions.length > 0 && (
        <div className="surface-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-[var(--color-ink-900)]">
              My IPD Patients
              <span className="ml-2 text-xs font-normal text-[var(--color-ink-400)]">{admissions.length} admitted</span>
            </h2>
            <Link href="/ipd" className="text-xs font-semibold text-[var(--color-primary-600)] hover:underline">View all →</Link>
          </div>
          <div className="space-y-2">
            {admissions.map((a) => {
              const dayIn = differenceInDays(new Date(), new Date(a.createdAt)) + 1;
              const statusLabel = dayIn <= 1 ? "Admitted" : dayIn <= 3 ? "Stable" : "Post-Op";
              const statusCls   = dayIn <= 1 ? "bg-blue-100 text-blue-700" : dayIn <= 3 ? "bg-green-100 text-green-700" : "bg-purple-100 text-purple-700";
              return (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--color-border)] bg-white">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-[var(--color-ink-900)]">{a.patient.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="font-mono text-[10px] text-[#115E59] bg-[#F0F8F6] px-1.5 py-0.5 rounded">{a.patient.udid}</span>
                      {a.hospital && <span className="text-[11px] text-[var(--color-ink-400)]">{a.hospital.name}</span>}
                      <span className="text-[11px] text-[var(--color-ink-400)]">{wardLabel(a.ward)}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={clsx("text-[10px] font-bold px-2 py-0.5 rounded-full", statusCls)}>{statusLabel}</span>
                    <p className="text-[11px] text-[var(--color-ink-400)] mt-1">Day {dayIn}</p>
                  </div>
                  <BedDouble size={16} className="text-[var(--color-ink-300)] shrink-0" />
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
