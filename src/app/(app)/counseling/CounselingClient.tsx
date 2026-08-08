"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { format, isToday, isTomorrow, isPast, startOfDay } from "date-fns";
import {
  HeartHandshake, Search, User, Building2, Stethoscope, Eye,
  CalendarClock, CheckCircle2, ClipboardList, AlertTriangle, Scissors,
} from "lucide-react";

/* ── Types ─────────────────────────────────────────────────────────────── */
interface CounselingItem {
  id: string;
  surgeryName: string | null;
  surgeryType: string;
  surgeryDate: string;
  anaesthesiaType: string;
  rightEye: boolean;
  leftEye: boolean;
  conflictFlag: boolean;
  counselledOn: string;
  scheduled: boolean;
  visitId: string;
  patient: { id: string; name: string; udid: string; uhid: string | null; age: number; sex: string };
  hospital: { id: string; name: string };
  doctor: { id: string; name: string };
}

type Filter = "all" | "awaiting" | "scheduled" | "upcoming";

/* ── Helpers ───────────────────────────────────────────────────────────── */
const SEX_SHORT: Record<string, string> = { MALE: "M", FEMALE: "F", OTHER: "O" };

function lateralityLabel(re: boolean, le: boolean) {
  if (re && le) return "OU";
  if (re) return "RE";
  if (le) return "LE";
  return "";
}

function dateLabel(iso: string) {
  const d = new Date(iso);
  if (isToday(d))    return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "EEE, d MMM yyyy");
}

function isUpcoming(iso: string) {
  return !isPast(startOfDay(new Date(iso))) || isToday(new Date(iso));
}

/* ── Stat tile ─────────────────────────────────────────────────────────── */
function StatTile({ icon, label, value, color, active, onClick }: {
  icon: React.ReactNode; label: string; value: number;
  color: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex-1 min-w-[130px] flex items-center gap-3 px-4 py-4 rounded-xl border transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-400)] ${
        active
          ? `${color} shadow-sm`
          : "bg-white border-[var(--color-border)] hover:border-[var(--color-primary-200)] hover:bg-[var(--color-surface-sunken)]"
      }`}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${active ? "bg-white/50" : "bg-[var(--color-surface-sunken)]"}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold leading-none tabular-nums text-[var(--color-ink-900)]">{value}</p>
        <p className="text-xs text-[var(--color-ink-500)] mt-1 truncate">{label}</p>
      </div>
    </button>
  );
}

/* ── Row ───────────────────────────────────────────────────────────────── */
function CounselingRow({ item, role }: { item: CounselingItem; role: "DOCTOR" | "HOSPITAL" }) {
  const lat = lateralityLabel(item.rightEye, item.leftEye);

  return (
    <li className="rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 hover:border-[var(--color-primary-200)] transition-colors">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        {/* Patient + surgery */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/patients/${item.patient.udid}`}
              className="text-sm font-semibold text-[var(--color-ink-900)] hover:text-[var(--color-primary-700)] hover:underline"
            >
              {item.patient.name}
            </Link>
            <span className="text-xs text-[var(--color-ink-400)] tabular-nums">
              {item.patient.age}{SEX_SHORT[item.patient.sex] ?? item.patient.sex}
            </span>
            {item.patient.uhid && (
              <span className="text-[10px] font-mono text-[var(--color-ink-400)]">{item.patient.uhid}</span>
            )}
            {item.conflictFlag && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
                <AlertTriangle size={10} /> Conflict
              </span>
            )}
          </div>

          <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-[var(--color-ink-600)]">
            <span className="inline-flex items-center gap-1.5 font-medium text-[var(--color-ink-800)]">
              <Scissors size={12} className="text-[var(--color-ink-400)]" />
              {item.surgeryName || item.surgeryType}
            </span>
            {lat && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-lg bg-[var(--color-primary-100)] text-[var(--color-primary-700)]">
                <Eye size={10} /> {lat}
              </span>
            )}
            <span className="text-[var(--color-ink-300)]">·</span>
            <span>{item.anaesthesiaType}</span>
          </div>

          <div className="mt-1 flex items-center gap-3 flex-wrap text-[11px] text-[var(--color-ink-400)]">
            <span className="inline-flex items-center gap-1">
              <Stethoscope size={11} /> {item.doctor.name}
            </span>
            {role === "DOCTOR" ? (
              <span className="inline-flex items-center gap-1">
                <Building2 size={11} /> {item.hospital.name}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1">
              <User size={11} /> Counselled {format(new Date(item.counselledOn), "d MMM yyyy")}
            </span>
          </div>
        </div>

        {/* Date + status */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="text-xs font-semibold text-[var(--color-ink-800)]">{dateLabel(item.surgeryDate)}</p>
            <p className="text-[11px] text-[var(--color-ink-400)] tabular-nums">
              {format(new Date(item.surgeryDate), "d MMM yyyy")}
            </p>
          </div>
          {item.scheduled ? (
            <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1 whitespace-nowrap">
              <CheckCircle2 size={11} /> Scheduled
            </span>
          ) : (
            <Link
              href="/scheduled-ot"
              className="text-[10px] font-semibold px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 inline-flex items-center gap-1 whitespace-nowrap transition-colors"
            >
              <CalendarClock size={11} /> Awaiting scheduling
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────── */
export function CounselingClient({ items, role }: { items: CounselingItem[]; role: "DOCTOR" | "HOSPITAL" }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery]   = useState("");

  const counts = useMemo(() => ({
    all:       items.length,
    awaiting:  items.filter((i) => !i.scheduled).length,
    scheduled: items.filter((i) => i.scheduled).length,
    upcoming:  items.filter((i) => isUpcoming(i.surgeryDate)).length,
  }), [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (filter === "awaiting"  && i.scheduled)  return false;
      if (filter === "scheduled" && !i.scheduled) return false;
      if (filter === "upcoming"  && !isUpcoming(i.surgeryDate)) return false;
      if (!q) return true;
      return (
        i.patient.name.toLowerCase().includes(q) ||
        (i.patient.uhid ?? "").toLowerCase().includes(q) ||
        (i.surgeryName ?? "").toLowerCase().includes(q) ||
        i.surgeryType.toLowerCase().includes(q) ||
        i.doctor.name.toLowerCase().includes(q)
      );
    });
  }, [items, filter, query]);

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-50)] flex items-center justify-center shrink-0">
          <HeartHandshake size={19} className="text-[var(--color-primary-600)]" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-[var(--color-ink-900)] leading-tight">Counseling</h1>
          <p className="text-xs text-[var(--color-ink-500)]">
            Surgical counselling recorded from the EMR Plan tab
          </p>
        </div>
      </div>

      {/* Stat tiles double as filters */}
      <div className="flex gap-3 flex-wrap">
        <StatTile
          icon={<ClipboardList size={17} className="text-[var(--color-primary-600)]" />}
          label="All counselled" value={counts.all}
          color="bg-[var(--color-primary-50)] border-[var(--color-primary-300)]"
          active={filter === "all"} onClick={() => setFilter("all")}
        />
        <StatTile
          icon={<CalendarClock size={17} className="text-amber-600" />}
          label="Awaiting scheduling" value={counts.awaiting}
          color="bg-amber-50 border-amber-300"
          active={filter === "awaiting"} onClick={() => setFilter("awaiting")}
        />
        <StatTile
          icon={<CheckCircle2 size={17} className="text-emerald-600" />}
          label="Scheduled" value={counts.scheduled}
          color="bg-emerald-50 border-emerald-300"
          active={filter === "scheduled"} onClick={() => setFilter("scheduled")}
        />
        <StatTile
          icon={<Scissors size={17} className="text-sky-600" />}
          label="Upcoming surgery" value={counts.upcoming}
          color="bg-sky-50 border-sky-300"
          active={filter === "upcoming"} onClick={() => setFilter("upcoming")}
        />
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-300)] pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search patient, UHID, surgery or doctor…"
          aria-label="Search counselling records"
          className="w-full rounded-xl border border-[var(--color-border)] bg-white pl-9 pr-3 py-2.5 text-sm text-[var(--color-ink-800)] placeholder:text-[var(--color-ink-300)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-transparent"
        />
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] py-12 px-6 text-center">
          <div className="w-11 h-11 rounded-xl bg-[var(--color-surface-sunken)] flex items-center justify-center mx-auto mb-3">
            <HeartHandshake size={19} className="text-[var(--color-ink-300)]" />
          </div>
          <p className="text-sm font-medium text-[var(--color-ink-700)]">
            {items.length === 0 ? "No counselling records yet" : "No records match this view"}
          </p>
          <p className="text-xs text-[var(--color-ink-400)] mt-1 max-w-sm mx-auto">
            {items.length === 0
              ? "Surgical counselling recorded in a patient's EMR Plan tab will appear here."
              : "Try a different filter or clear the search."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((item) => (
            <CounselingRow key={item.id} item={item} role={role} />
          ))}
        </ul>
      )}
    </div>
  );
}
