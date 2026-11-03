"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addWeeks, differenceInCalendarDays, endOfWeek, format, startOfDay } from "date-fns";
import {
  ClipboardCheck, Search, Filter, X, User, Clock, CheckCircle2, ShieldCheck,
  Layers, ChevronRight, CalendarDays, Scissors, AlertTriangle,
} from "lucide-react";
import { ComplaintChips } from "@/components/ui/ComplaintChips";
import { TealSelect } from "@/components/ui/TealSelect";
import { fileHref } from "@/lib/file-href";
import type { CounsellingStatus } from "@/lib/counselling";

export interface CounsellingRow {
  visitId: string;
  visitDate: string;
  surgery: string;
  laterality: string | null;
  anaesthesia: string | null;
  patient: { id: string; name: string; udid: string; uhid: string | null; age: number; sex: string; photoUrl: string | null };
  doctor: { id: string; name: string };
  chiefComplaint: string | null;
  diagnoses: { description: string; laterality: string | null; status: string | null }[];
  invDone: number;
  invTotal: number;
  status: CounsellingStatus;
  tentativeDate: string | null;
  implant: string | null;
  reportsValidUntil: string | null;
  /** When the reports expire: frozen at Fit for surgery, else 1 month after the oldest upload. */
  reportsDue: string | null;
  fit: boolean;
  advanceDone: boolean;
  eligible: boolean;
  postponedUntil: string | null;
  postponedIndefinitely: boolean;
  updatedAt: string;
}

type CardFilter = "PENDING" | "PARTIAL" | "COMPLETED" | "ALL";

export const STATUS_META: Record<CounsellingStatus, { label: string; pill: string; dot: string }> = {
  PENDING:   { label: "Pending",                    pill: "bg-slate-100 text-slate-600 border border-slate-200",       dot: "bg-slate-400" },
  PARTIAL:   { label: "Fit for Surgery",            pill: "bg-amber-50 text-amber-700 border border-amber-300",        dot: "bg-amber-500" },
  COMPLETED: { label: "Eligible for Surgery",       pill: "bg-emerald-100 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500" },
  POSTPONED: { label: "Date Not Confirmed",         pill: "bg-orange-50 text-orange-700 border border-orange-200",     dot: "bg-orange-500" },
};

const SEX_SHORT: Record<string, string> = { MALE: "M", FEMALE: "F", OTHER: "O" };

export function StatusBadge({ status, expired }: { status: CounsellingStatus; expired?: boolean }) {
  if (expired) {
    return (
      <span className="inline-flex items-center gap-1.5 text-micro sm:text-caption font-bold px-2 py-0.5 rounded-full whitespace-nowrap bg-red-50 text-red-700 border border-red-200">
        <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-red-500" />
        Reports Expired
      </span>
    );
  }
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-micro sm:text-caption font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${m.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${m.dot}`} />
      {m.label}
    </span>
  );
}

export function isExpired(r: { status: CounsellingStatus; reportsValidUntil: string | null }): boolean {
  return r.status === "PARTIAL" && !!r.reportsValidUntil && new Date(r.reportsValidUntil) < new Date();
}

/** Status used by the cards and Status filter: expired reports must be redone, so they count as Pending. */
function listStatus(r: CounsellingRow): CounsellingStatus {
  return isExpired(r) ? "PENDING" : r.status;
}

function StatCard({
  label, count, icon, accent, iconBg, onClick, active,
}: {
  label: string; count: number; icon: React.ReactNode;
  accent: string; iconBg: string; onClick: () => void; active: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border bg-[var(--color-surface)] transition-all text-center w-full
        sm:flex-row sm:items-center sm:gap-3 sm:px-4 sm:py-4 sm:text-left
        ${active ? "border-[var(--color-primary-400)] shadow-md ring-1 ring-[var(--color-primary-300)]" : "border-[var(--color-border)] hover:border-[var(--color-primary-300)] hover:shadow-sm hover:-translate-y-0.5"}`}
    >
      <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div>
        <p className={`text-lg sm:text-2xl font-bold leading-none tabular-nums ${count > 0 ? accent : "text-[var(--color-ink-300)]"}`}>
          {count}
        </p>
        <p className="text-micro sm:text-xs text-[var(--color-ink-500)] mt-0.5 leading-tight">{label}</p>
      </div>
    </button>
  );
}


/* ── At-a-glance tags (derived from data already on the row) ───────────── */
const daysFromToday = (iso: string) => differenceInCalendarDays(new Date(iso), new Date());

function DaysTag({ r }: { r: CounsellingRow }) {
  if (!r.tentativeDate) return null;
  const d = daysFromToday(r.tentativeDate);
  const done = r.status === "COMPLETED";
  const text = d === 0 ? "Today" : d === 1 ? "Tomorrow" : d > 0 ? `In ${d} days` : done ? `${-d} day${d === -1 ? "" : "s"} ago` : `Overdue by ${-d} day${d === -1 ? "" : "s"}`;
  const cls = d < 0 && !done
    ? "bg-red-50 text-red-700 border-red-200"
    : d <= 7 && d >= 0
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-slate-50 text-slate-500 border-slate-200";
  return <span className={`inline-flex items-center rounded-md border px-1.5 py-px text-micro font-semibold whitespace-nowrap ${cls}`}>{text}</span>;
}

function ExpiryTag({ r }: { r: CounsellingRow }) {
  if (!r.reportsDue || r.status === "COMPLETED" || isExpired(r)) return null;
  const d = daysFromToday(r.reportsDue);
  if (d < 0 || d > 7) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-px text-micro font-semibold text-amber-700 whitespace-nowrap">
      <AlertTriangle size={10} /> Reports expire {d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`}
    </span>
  );
}

const STAGES = ["Counselling", "Fit for Surgery", "Advance", "Eligible"];

function ProgressDots({ r }: { r: CounsellingRow }) {
  const done = [true, r.fit, r.advanceDone, r.eligible];
  const count = done.filter(Boolean).length;
  const next = STAGES[done.findIndex((d) => !d)];
  return (
    <span className="inline-flex items-center gap-2" title={STAGES.map((s, i) => `${done[i] ? "✓" : "○"} ${s}`).join("\n")}>
      <span className="flex w-20 gap-0.5">
        {done.map((d, i) => (
          <span key={i} className={`h-1.5 flex-1 first:rounded-l-full last:rounded-r-full ${
            d ? "bg-gradient-to-r from-[var(--color-primary-500)] to-[var(--color-primary-400)]" : "bg-[var(--color-border)]"
          }`} />
        ))}
      </span>
      <span className="text-micro font-semibold text-[var(--color-ink-500)] whitespace-nowrap">
        {next ? <>Next: <span className="text-[var(--color-ink-700)]">{next}</span></> : <span className="text-emerald-700">All done</span>}
      </span>
    </span>
  );
}

/* ── Date groups ───────────────────────────────────────────────────────── */
const GROUP_ORDER = ["Past date", "This week", "Next week", "Later", "Date not set"] as const;
type DateGroup = (typeof GROUP_ORDER)[number];

function dateGroup(r: CounsellingRow): DateGroup {
  if (!r.tentativeDate) return "Date not set";
  const d = new Date(r.tentativeDate);
  const today = startOfDay(new Date());
  if (d < today) return "Past date";
  const thisWeekEnd = endOfWeek(today, { weekStartsOn: 1 });
  if (d <= thisWeekEnd) return "This week";
  if (d <= addWeeks(thisWeekEnd, 1)) return "Next week";
  return "Later";
}

/* ── List pieces (fields per the requirements: DP, name, age, sex, ID, C/c,
   diagnosis, surgery, status, tentative date) ───────────────────────────── */
function Avatar({ r, size }: { r: CounsellingRow; size: "sm" | "md" }) {
  const box = size === "sm" ? "w-7 h-7" : "w-8 h-8";
  return (
    <div className={`${box} rounded-full bg-[var(--color-primary-100)] flex items-center justify-center shrink-0 overflow-hidden`}>
      {r.patient.photoUrl
        ? <img src={fileHref(r.patient.photoUrl)!} alt={r.patient.name} className="w-full h-full object-cover" />
        : <User size={size === "sm" ? 13 : 14} className="text-[var(--color-primary-700)]" />}
    </div>
  );
}

function Diagnoses({ r }: { r: CounsellingRow }) {
  if (r.diagnoses.length === 0) return <span className="italic text-caption text-[var(--color-ink-300)]">—</span>;
  return (
    <span className="flex flex-wrap gap-1 min-w-0">
      {r.diagnoses.map((d, i) => (
        <span key={i} className="clinical-diagnosis-chip inline-flex flex-wrap items-center gap-x-1 max-w-full px-2.5 py-0.5 rounded-full border text-caption break-words">
          {d.laterality && <span className="clinical-laterality shrink-0">{d.laterality}</span>}
          {d.description}
        </span>
      ))}
    </span>
  );
}

function SurgeryText({ r }: { r: CounsellingRow }) {
  return (
    <span className="text-label sm:text-sm font-semibold text-[var(--color-ink-800)] break-words">
      {r.laterality && <span className="clinical-laterality mr-1">{r.laterality}</span>}
      {r.surgery}
      {r.anaesthesia && <span className="block text-caption font-normal text-[var(--color-ink-500)]">{r.anaesthesia}</span>}
    </span>
  );
}

function TentativeDate({ r }: { r: CounsellingRow }) {
  return (
    <span className="text-label sm:text-sm font-semibold text-[var(--color-ink-800)]">
      {r.tentativeDate ? format(new Date(r.tentativeDate), "d MMM yyyy") : <span className="italic font-normal text-[var(--color-ink-300)]">Not set</span>}
      {r.tentativeDate && <span className="block mt-1"><DaysTag r={r} /></span>}
      {r.status === "POSTPONED" && !r.postponedIndefinitely && r.postponedUntil && (
        <span className="block text-caption font-medium text-orange-700">Expected {format(new Date(r.postponedUntil), "d MMM yyyy")}</span>
      )}
    </span>
  );
}

/* ── Desktop row ────────────────────────────────────────────────────────── */
function PatientRow({ r, onOpen }: { r: CounsellingRow; onOpen: () => void }) {
  return (
    <tr onClick={onOpen} className="border-b border-[var(--color-border)] last:border-0 cursor-pointer transition-colors hover:bg-[var(--color-surface-sunken)]">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Avatar r={r} size="sm" />
          <div className="min-w-0">
            <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-900)] truncate">{r.patient.name}</p>
            <p className="text-caption text-[var(--color-ink-400)] mt-0.5">
              {r.patient.uhid ?? r.patient.udid} · {r.patient.age}y/{SEX_SHORT[r.patient.sex] ?? r.patient.sex}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        {r.chiefComplaint
          ? <ComplaintChips value={r.chiefComplaint} className="max-w-[240px]" />
          : <p className="text-caption text-[var(--color-ink-300)] italic">No complaint recorded</p>}
        {r.diagnoses.length > 0 && <div className="mt-1"><Diagnoses r={r} /></div>}
      </td>
      <td className="px-4 py-3 max-w-[260px]"><SurgeryText r={r} /></td>
      <td className="px-4 py-3 whitespace-nowrap"><TentativeDate r={r} /></td>
      <td className="px-4 py-3">
        <div className="flex flex-col items-start gap-1.5">
          <StatusBadge status={r.status} expired={isExpired(r)} />
          <ProgressDots r={r} />
          <ExpiryTag r={r} />
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <ChevronRight size={16} className="inline text-[var(--color-ink-300)]" />
      </td>
    </tr>
  );
}

/* ── Mobile card ────────────────────────────────────────────────────────── */
function PatientCard({ r }: { r: CounsellingRow }) {
  return (
    <Link
      href={`/counselling/${r.visitId}`}
      className="block rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3 hover:border-[var(--color-primary-300)] transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar r={r} size="md" />
          <div className="min-w-0">
            <p className="text-label sm:text-sm font-bold text-[var(--color-ink-900)] truncate">{r.patient.name}</p>
            <p className="text-caption text-[var(--color-ink-400)] mt-0.5">
              {r.patient.uhid ?? r.patient.udid} · {r.patient.age}y/{SEX_SHORT[r.patient.sex] ?? r.patient.sex}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <StatusBadge status={r.status} expired={isExpired(r)} />
          <ProgressDots r={r} />
        </div>
      </div>
      <ExpiryTag r={r} />

      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-caption sm:text-xs">
        <span className="text-[var(--color-ink-400)]">Complaint</span>
        {r.chiefComplaint
          ? <ComplaintChips value={r.chiefComplaint} wrap />
          : <span className="italic text-[var(--color-ink-300)]">—</span>}
        <span className="text-[var(--color-ink-400)]">Diagnosis</span>
        <Diagnoses r={r} />
        <span className="text-[var(--color-ink-400)]">Surgery</span>
        <SurgeryText r={r} />
        <span className="text-[var(--color-ink-400)]">Tentative Date</span>
        <TentativeDate r={r} />
      </div>
    </Link>
  );
}

export function CounsellingClient({ rows }: { rows: CounsellingRow[] }) {
  const router = useRouter();
  const [card, setCard]                 = useState<CardFilter>("PENDING");
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState<CounsellingStatus | "ALL">("ALL");
  const [dateFrom, setDateFrom]         = useState("");
  const [dateTo, setDateTo]             = useState("");
  const [showFilters, setShowFilters]   = useState(false);

  // Overall counts follow the date range, as the "Overall — according to date" card.
  const inDateRange = (r: CounsellingRow) => {
    if (!dateFrom && !dateTo) return true;
    const d = format(new Date(r.tentativeDate ?? r.visitDate), "yyyy-MM-dd");
    return (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
  };

  const dated = useMemo(() => rows.filter(inDateRange), [rows, dateFrom, dateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => ({
    PENDING:   dated.filter((r) => listStatus(r) === "PENDING" || listStatus(r) === "POSTPONED").length,
    PARTIAL:   dated.filter((r) => listStatus(r) === "PARTIAL").length,
    COMPLETED: dated.filter((r) => listStatus(r) === "COMPLETED").length,
    ALL:       dated.length,
  }), [dated]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dated.filter((r) => {
      const s = listStatus(r);
      if (card === "PENDING" && s !== "PENDING" && s !== "POSTPONED") return false;
      if (card === "PARTIAL" && s !== "PARTIAL") return false;
      if (card === "COMPLETED" && s !== "COMPLETED") return false;
      if (statusFilter !== "ALL" && s !== statusFilter) return false;
      if (q) {
        const hay = [r.patient.name, r.patient.udid, r.patient.uhid ?? "", r.surgery, r.doctor.name].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => {
      // Nearest tentative date first; patients without a date after, newest visit first.
      if (a.tentativeDate && b.tentativeDate) return a.tentativeDate.localeCompare(b.tentativeDate);
      if (a.tentativeDate) return -1;
      if (b.tentativeDate) return 1;
      return b.visitDate.localeCompare(a.visitDate);
    });
  }, [dated, card, search, statusFilter]);

  const groups = useMemo(() => GROUP_ORDER
    .map((g) => [g, filtered.filter((r) => dateGroup(r) === g)] as const)
    .filter(([, list]) => list.length > 0), [filtered]);

  const filtersActive = !!(search || statusFilter !== "ALL" || dateFrom || dateTo);
  const toggleCard = (c: CardFilter) => { setCard(card === c ? "ALL" : c); setStatusFilter("ALL"); };
  const dateInputCls = "px-3 py-2 text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-transparent";

  return (
    <div className="fade-in pb-24">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-100)] flex items-center justify-center shrink-0">
            <ClipboardCheck size={20} className="text-[var(--color-primary-700)]" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-[var(--color-ink-900)]">Counselling</h1>
            <p className="text-caption sm:text-xs text-[var(--color-ink-400)] mt-0.5">
              {rows.length} scheduled for surgery · {format(new Date(), "EEEE, d MMMM yyyy")}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`relative inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-label sm:text-sm font-medium transition-colors shrink-0
            ${showFilters
              ? "border-[var(--color-primary-400)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)]"
              : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)]"}`}
        >
          <Filter size={14} />
          Filters
          {filtersActive && <span className="w-2 h-2 rounded-full bg-[var(--color-primary-500)] absolute -top-0.5 -right-0.5" />}
        </button>
      </div>

      {/* Top cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Pending" count={counts.PENDING}
          icon={<Clock size={17} className="text-slate-500" />}
          accent="text-slate-600" iconBg="bg-slate-100"
          onClick={() => toggleCard("PENDING")} active={card === "PENDING"}
        />
        <StatCard
          label="Partial · Fit for Surgery" count={counts.PARTIAL}
          icon={<ShieldCheck size={17} className="text-amber-600" />}
          accent="text-amber-600" iconBg="bg-amber-50"
          onClick={() => toggleCard("PARTIAL")} active={card === "PARTIAL"}
        />
        <StatCard
          label="Completed · Eligible" count={counts.COMPLETED}
          icon={<CheckCircle2 size={17} className="text-emerald-600" />}
          accent="text-emerald-700" iconBg="bg-emerald-50"
          onClick={() => toggleCard("COMPLETED")} active={card === "COMPLETED"}
        />
        <StatCard
          label={dateFrom || dateTo ? "Overall · selected dates" : "Overall"} count={counts.ALL}
          icon={<Layers size={17} className="text-[var(--color-primary-600)]" />}
          accent="text-[var(--color-primary-700)]" iconBg="bg-[var(--color-primary-50)]"
          onClick={() => { setCard("ALL"); setStatusFilter("ALL"); setShowFilters(true); }} active={card === "ALL"}
        />
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 items-center mb-2 p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)]">
          <div className="relative flex-1 min-w-40">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by patient name, ID, surgery…"
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-transparent"
            />
          </div>
          <TealSelect
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as CounsellingStatus | "ALL")}
            options={[
              { value: "ALL", label: "All Statuses" },
              { value: "PENDING", label: "Pending" },
              { value: "POSTPONED", label: "Date Not Confirmed" },
              { value: "PARTIAL", label: "Fit for Surgery" },
              { value: "COMPLETED", label: "Eligible for Surgery" },
            ]}
          />
          <div className="flex items-center gap-1.5">
            <CalendarDays size={14} className="text-[var(--color-ink-400)]" />
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={dateInputCls} aria-label="From date" />
            <span className="text-caption text-[var(--color-ink-400)]">to</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={dateInputCls} aria-label="To date" />
          </div>
          {filtersActive && (
            <button
              onClick={() => { setSearch(""); setStatusFilter("ALL"); setDateFrom(""); setDateTo(""); }}
              className="inline-flex items-center gap-1 text-caption sm:text-xs font-medium px-2.5 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-500)] hover:bg-white transition-colors"
            >
              <X size={12} /> Reset
            </button>
          )}
        </div>
      )}

      <p className="text-caption sm:text-xs text-[var(--color-ink-400)] mb-3 mt-2">
        Showing {filtered.length} of {rows.length} patients
        {(dateFrom || dateTo) && " · by tentative date"}
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col items-center gap-3 py-16 text-center">
          <Scissors size={36} className="text-[var(--color-ink-200)]" />
          <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-500)]">
            {rows.length === 0 ? "No patients scheduled for surgery" : "No results match your filters"}
          </p>
          <p className="text-caption sm:text-xs text-[var(--color-ink-400)]">
            {rows.length === 0
              ? "Save Surgical Counselling in the EMR Patient Disposition card, then Finalize & Sign the visit."
              : "Try another card or adjust the filters."}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden lg:block rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[var(--color-surface-sunken)] border-b border-[var(--color-border)]">
                    <th className="px-4 py-3 text-left text-micro sm:text-caption font-bold uppercase tracking-widest text-[var(--color-ink-400)]">Patient</th>
                    <th className="px-4 py-3 text-left text-micro sm:text-caption font-bold uppercase tracking-widest text-[var(--color-ink-400)]">Complaint / Diagnosis</th>
                    <th className="px-4 py-3 text-left text-micro sm:text-caption font-bold uppercase tracking-widest text-[var(--color-ink-400)]">Surgery</th>
                    <th className="px-4 py-3 text-left text-micro sm:text-caption font-bold uppercase tracking-widest text-[var(--color-ink-400)]">Tentative Date</th>
                    <th className="px-4 py-3 text-left text-micro sm:text-caption font-bold uppercase tracking-widest text-[var(--color-ink-400)]">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                {groups.map(([g, list]) => (
                  <tbody key={g}>
                    <tr className="bg-[var(--color-surface-sunken)]/60 border-b border-[var(--color-border)]">
                      <td colSpan={6} className="px-4 py-1.5 text-micro font-bold uppercase tracking-widest text-[var(--color-ink-500)]">
                        {g} <span className="text-[var(--color-ink-300)] font-semibold">· {list.length}</span>
                      </td>
                    </tr>
                    {list.map((r) => <PatientRow key={r.visitId} r={r} onOpen={() => router.push(`/counselling/${r.visitId}`)} />)}
                  </tbody>
                ))}
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden space-y-4">
            {groups.map(([g, list]) => (
              <section key={g} className="space-y-2">
                <p className="text-micro font-bold uppercase tracking-widest text-[var(--color-ink-500)] px-1">
                  {g} <span className="text-[var(--color-ink-300)] font-semibold">· {list.length}</span>
                </p>
                {list.map((r) => <PatientCard key={r.visitId} r={r} />)}
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
