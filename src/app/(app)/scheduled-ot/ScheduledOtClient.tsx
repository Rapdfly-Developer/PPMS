"use client";

import { useState, useMemo } from "react";
import { format, isToday, isTomorrow, isPast, startOfDay } from "date-fns";
import Link from "next/link";
import {
  Scissors, User, Building2, Eye, AlertTriangle,
  ClipboardList, CheckCircle2, Clock, CalendarClock,
} from "lucide-react";

/* ── Planned record (SurgicalCounselling) ──────────────────────────────── */
interface PlannedRecord {
  id:              string;
  surgeryName:     string | null;
  surgeryType:     string;
  surgeryDate:     string;
  anaesthesiaType: string;
  rightEye:        boolean;
  leftEye:         boolean;
  conflictFlag:    boolean;
  patient:  { id: string; name: string; udid: string; age: number; sex: string };
  hospital: { name: string; id: string };
  doctor:   { name: string; id: string };
}

/* ── Confirmed record (SurgerySchedule) ───────────────────────────────── */
interface ConfirmedRecord {
  id:                string;
  surgeryName:       string;
  surgeryCategory:   string;
  urgencyType:       string;
  priority:          string;
  plannedDateTime:   string;
  otRoom:            string | null;
  estimatedDuration: number | null;
  status:            string;
  department:        string | null;
  patient:  { id: string; name: string; udid: string; age: number; sex: string };
  hospital: { name: string };
  doctor:   { name: string };
}

/* ── helpers ───────────────────────────────────────────────────────────── */
function dateLabel(iso: string) {
  const d = new Date(iso);
  if (isToday(d))    return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "EEE, d MMM yyyy");
}

function lateralityLabel(re: boolean, le: boolean) {
  if (re && le) return "BE";
  if (re)       return "RE";
  if (le)       return "LE";
  return "";
}

const SEX_SHORT: Record<string, string> = { MALE: "M", FEMALE: "F", OTHER: "O" };

const STATUS_CHIP: Record<string, string> = {
  PLANNED:     "bg-[var(--color-ink-100)] text-[var(--color-ink-700)]",
  SCHEDULED:   "bg-[var(--color-primary-100)] text-[var(--color-primary-700)]",
  RESCHEDULED: "bg-amber-100 text-amber-700",
  CANCELLED:   "bg-red-100 text-red-700",
};

const URGENCY_CHIP: Record<string, string> = {
  ELECTIVE:  "bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]",
  EMERGENCY: "bg-red-50 text-red-600 border border-red-200",
};

/* ── stat card ─────────────────────────────────────────────────────────── */
function StatCard({
  icon, label, value, active, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-[140px] flex items-center gap-3 px-5 py-4 rounded-xl border transition-all text-left ${
        active
          ? "bg-[var(--color-primary-50)] border-[var(--color-primary-300)] shadow-sm"
          : "bg-white border-[var(--color-border)] hover:border-[var(--color-primary-200)] hover:bg-[var(--color-surface-sunken)]"
      }`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
        active ? "bg-[var(--color-primary-100)]" : "bg-[var(--color-surface-sunken)]"
      }`}>
        <span className={active ? "text-[var(--color-primary-700)]" : "text-[var(--color-ink-400)]"}>{icon}</span>
      </div>
      <div>
        <p className={`text-2xl font-bold leading-none mb-0.5 ${active ? "text-[var(--color-primary-700)]" : "text-[var(--color-ink-900)]"}`}>{value}</p>
        <p className="text-xs text-[var(--color-ink-500)] font-medium">{label}</p>
      </div>
    </button>
  );
}

/* ── main ──────────────────────────────────────────────────────────────── */
export function ScheduledOtClient({
  planned,
  confirmed,
  role,
}: {
  planned:   PlannedRecord[];
  confirmed: ConfirmedRecord[];
  role: "DOCTOR" | "HOSPITAL";
}) {
  const [tab,    setTab]    = useState<"planned" | "confirmed">("planned");
  const [filter, setFilter] = useState<"upcoming" | "past" | "all">("upcoming");
  const [search, setSearch] = useState("");

  /* ── planned tab filtering ── */
  const filteredPlanned = useMemo(() => {
    return planned.filter((r) => {
      const d = new Date(r.surgeryDate);
      if (filter === "upcoming" && isPast(d) && !isToday(d)) return false;
      if (filter === "past"     && !isPast(startOfDay(d)))   return false;
      if (search) {
        const q = search.toLowerCase();
        return r.patient.name.toLowerCase().includes(q) || r.patient.udid.toLowerCase().includes(q) || r.surgeryType.toLowerCase().includes(q);
      }
      return true;
    });
  }, [planned, filter, search]);

  /* ── confirmed tab filtering ── */
  const filteredConfirmed = useMemo(() => {
    return confirmed.filter((r) => {
      const d = new Date(r.plannedDateTime);
      if (filter === "upcoming" && isPast(d) && !isToday(d)) return false;
      if (filter === "past"     && !isPast(startOfDay(d)))   return false;
      if (search) {
        const q = search.toLowerCase();
        return r.patient.name.toLowerCase().includes(q) || r.patient.udid.toLowerCase().includes(q) || r.surgeryName.toLowerCase().includes(q);
      }
      return true;
    });
  }, [confirmed, filter, search]);

  /* ── group by date ── */
  const plannedGroups = useMemo(() => {
    const map = new Map<string, PlannedRecord[]>();
    for (const r of filteredPlanned) {
      const key = format(new Date(r.surgeryDate), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries()).map(([key, items]) => ({ key, items }));
  }, [filteredPlanned]);

  const confirmedGroups = useMemo(() => {
    const map = new Map<string, ConfirmedRecord[]>();
    for (const r of filteredConfirmed) {
      const key = format(new Date(r.plannedDateTime), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries()).map(([key, items]) => ({ key, items }));
  }, [filteredConfirmed]);

  const todayPlanned   = planned.filter((r)   => isToday(new Date(r.surgeryDate))).length;
  const todayConfirmed = confirmed.filter((r) => isToday(new Date(r.plannedDateTime))).length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-[var(--color-primary-100)] flex items-center justify-center shrink-0">
          <Scissors size={18} className="text-[var(--color-primary-700)]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--color-ink-900)] leading-tight">Scheduled OT</h1>
          <p className="text-xs text-[var(--color-ink-400)]">
            {todayPlanned} surgical plan{todayPlanned !== 1 ? "s" : ""} today · {todayConfirmed} confirmed today
          </p>
        </div>
      </div>

      {/* Stat cards — also act as tab selectors */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <StatCard
          icon={<CalendarClock size={18} />}
          label="Surgical Plans"
          value={planned.length}
          active={tab === "planned"}
          onClick={() => setTab("planned")}
        />
        <StatCard
          icon={<CheckCircle2 size={18} />}
          label="Confirmed OT"
          value={confirmed.length}
          active={tab === "confirmed"}
          onClick={() => setTab("confirmed")}
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex rounded-xl border border-[var(--color-border)] overflow-hidden bg-white text-sm">
          {(["upcoming", "all", "past"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 font-medium capitalize transition-colors ${
                filter === f
                  ? "bg-[var(--color-primary-600)] text-white"
                  : "text-[var(--color-ink-500)] hover:bg-[var(--color-surface-sunken)]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search patient or surgery…"
          className="flex-1 min-w-[180px] rounded-xl border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)]"
        />
      </div>

      {/* ── PLANNED TAB ── */}
      {tab === "planned" && (
        <>
          {plannedGroups.length === 0 ? (
            <EmptyState label="No surgical plans found." />
          ) : (
            <div className="flex flex-col gap-6">
              {plannedGroups.map(({ key, items }) => {
                const label = dateLabel(items[0].surgeryDate);
                const isNow = isToday(new Date(items[0].surgeryDate));
                return (
                  <div key={key}>
                    <DateHeader label={label} date={items[0].surgeryDate} isNow={isNow} count={items.length} />
                    <div className="flex flex-col gap-2">
                      {items.map((r, idx) => {
                        const lat = lateralityLabel(r.rightEye, r.leftEye);
                        return (
                          <div key={r.id} className="flex items-start gap-4 px-4 py-4 rounded-xl border border-[var(--color-border)] bg-white">
                            <div className="w-7 h-7 rounded-lg bg-[var(--color-primary-50)] flex items-center justify-center shrink-0 mt-0.5">
                              <span className="text-xs font-bold text-[var(--color-primary-700)]">{idx + 1}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 flex-wrap mb-1.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Link href={`/patients/${r.patient.udid}`} className="text-sm font-semibold text-[var(--color-ink-900)] hover:text-[var(--color-primary-700)] hover:underline transition-colors">
                                    {r.patient.name}
                                  </Link>
                                  <span className="text-xs text-[var(--color-ink-400)]">{r.patient.age}y / {SEX_SHORT[r.patient.sex] ?? r.patient.sex}</span>
                                  <span className="font-mono text-[10px] bg-[var(--color-primary-50)] text-[var(--color-primary-700)] px-1.5 py-0.5 rounded">{r.patient.udid}</span>
                                  {r.conflictFlag && (
                                    <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                                      <AlertTriangle size={9} /> Conflict
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs font-medium text-[var(--color-ink-500)] whitespace-nowrap">{format(new Date(r.surgeryDate), "h:mm a")}</span>
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-ink-600)] mb-3">
                                <span className="flex items-center gap-1 font-medium text-[var(--color-ink-800)]">
                                  <Scissors size={11} className="text-[var(--color-primary-500)]" />
                                  {r.surgeryName ?? r.surgeryType}
                                  {r.surgeryName && <span className="ml-1 text-[var(--color-ink-400)] font-normal">({r.surgeryType})</span>}
                                  {lat && <span className="ml-1 px-1.5 py-0.5 rounded bg-[var(--color-primary-50)] text-[var(--color-primary-700)] font-semibold text-[10px]">{lat}</span>}
                                </span>
                                {r.anaesthesiaType && <span className="flex items-center gap-1 text-[var(--color-ink-400)]"><Eye size={11} /> {r.anaesthesiaType}</span>}
                                {role === "HOSPITAL" && <span className="flex items-center gap-1 text-[var(--color-ink-400)]"><User size={11} /> Dr. {r.doctor.name}</span>}
                                {role === "DOCTOR"   && <span className="flex items-center gap-1 text-[var(--color-ink-400)]"><Building2 size={11} /> {r.hospital.name}</span>}
                              </div>
                              {role === "HOSPITAL" && (
                                <Link href={`/scheduled-ot/${r.id}`} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--color-primary-300)] text-[var(--color-primary-700)] bg-[var(--color-primary-50)] hover:bg-[var(--color-primary-100)] hover:border-[var(--color-primary-400)] transition-colors">
                                  <ClipboardList size={12} /> Fill the Form
                                </Link>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── CONFIRMED OT TAB ── */}
      {tab === "confirmed" && (
        <>
          {confirmedGroups.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-sunken)] flex items-center justify-center">
                <CheckCircle2 size={28} className="text-[var(--color-ink-300)]" />
              </div>
              <p className="text-sm font-medium text-[var(--color-ink-500)]">No confirmed OT entries yet.</p>
              <p className="text-xs text-[var(--color-ink-400)] max-w-xs">
                Once a hospital admin fills the Surgery Scheduling Form for a surgical plan, the patient will appear here.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {confirmedGroups.map(({ key, items }) => {
                const label = dateLabel(items[0].plannedDateTime);
                const isNow = isToday(new Date(items[0].plannedDateTime));
                return (
                  <div key={key}>
                    <DateHeader label={label} date={items[0].plannedDateTime} isNow={isNow} count={items.length} />
                    <div className="flex flex-col gap-2">
                      {items.map((r, idx) => (
                        <div key={r.id} className="flex items-start gap-4 px-4 py-4 rounded-xl border border-[var(--color-border)] bg-white">
                          <div className="w-7 h-7 rounded-lg bg-[var(--color-primary-50)] flex items-center justify-center shrink-0 mt-0.5">
                            <span className="text-xs font-bold text-[var(--color-primary-700)]">{idx + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            {/* Top row */}
                            <div className="flex items-start justify-between gap-2 flex-wrap mb-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Link href={`/patients/${r.patient.udid}`} className="text-sm font-semibold text-[var(--color-ink-900)] hover:text-[var(--color-primary-700)] hover:underline transition-colors">
                                  {r.patient.name}
                                </Link>
                                <span className="text-xs text-[var(--color-ink-400)]">{r.patient.age}y / {SEX_SHORT[r.patient.sex] ?? r.patient.sex}</span>
                                <span className="font-mono text-[10px] bg-[var(--color-primary-50)] text-[var(--color-primary-700)] px-1.5 py-0.5 rounded">{r.patient.udid}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_CHIP[r.status] ?? STATUS_CHIP.PLANNED}`}>{r.status}</span>
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${URGENCY_CHIP[r.urgencyType] ?? ""}`}>{r.urgencyType}</span>
                              </div>
                            </div>

                            {/* Surgery details */}
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-ink-600)] mb-2">
                              <span className="flex items-center gap-1 font-medium text-[var(--color-ink-800)]">
                                <Scissors size={11} className="text-[var(--color-primary-500)]" />
                                {r.surgeryName}
                                <span className="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]">{r.surgeryCategory}</span>
                              </span>
                              {r.department && <span className="text-[var(--color-ink-400)]">{r.department}</span>}
                              <span className="flex items-center gap-1 text-[var(--color-ink-400)]">
                                <Clock size={11} /> {format(new Date(r.plannedDateTime), "h:mm a")}
                                {r.estimatedDuration ? ` · ${r.estimatedDuration} min` : ""}
                              </span>
                              {r.otRoom && <span className="text-[var(--color-ink-500)] font-medium">OT: {r.otRoom}</span>}
                            </div>

                            {/* Doctor / hospital */}
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-ink-400)]">
                              {role === "HOSPITAL" && <span className="flex items-center gap-1"><User size={11} /> Dr. {r.doctor.name}</span>}
                              {role === "DOCTOR"   && <span className="flex items-center gap-1"><Building2 size={11} /> {r.hospital.name}</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── shared sub-components ─────────────────────────────────────────────── */
function DateHeader({ label, date, isNow, count }: { label: string; date: string; isNow: boolean; count: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${isNow ? "bg-[var(--color-primary-100)] text-[var(--color-primary-700)]" : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]"}`}>
        {label}
      </span>
      <span className="text-xs text-[var(--color-ink-400)]">
        {format(new Date(date), "d MMM yyyy")}
        {!isNow && ` · ${count} procedure${count !== 1 ? "s" : ""}`}
      </span>
      <div className="flex-1 h-px bg-[var(--color-border)]" />
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[var(--color-surface-sunken)] flex items-center justify-center">
        <Scissors size={26} className="text-[var(--color-ink-300)]" />
      </div>
      <p className="text-sm text-[var(--color-ink-400)]">{label}</p>
    </div>
  );
}
