"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { differenceInCalendarDays, format, startOfDay } from "date-fns";
import {
  ClipboardCheck, Search, Filter, X, Clock, CheckCircle2, ShieldCheck,
  ChevronRight, CalendarDays, Scissors, UserX, Wallet, Landmark, Building2, HeartHandshake, MoreHorizontal,
} from "lucide-react";
import { TealSelect } from "@/components/ui/TealSelect";
import { fileHref } from "@/lib/file-href";
import { PAYMENT_TYPES, paymentTypeOf, type CounsellingStatus } from "@/lib/counselling";

export interface CounsellingRow {
  visitId: string;
  visitDate: string;
  surgery: string;
  laterality: string | null;
  anaesthesia: string | null;
  patient: { id: string; name: string; udid: string; uhid: string | null; age: number; sex: string; mobile: string | null; photoUrl: string | null };
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
  /** "CASH" (Out of Pocket) or "CASHLESS" (Covered); null when not chosen. */
  paymentMode: string | null;
  paymentType: string | null;
}

type CardFilter = "PENDING" | "PARTIAL" | "COMPLETED" | "NOSHOW" | "ALL";

export const STATUS_META: Record<CounsellingStatus, { label: string; pill: string; dot: string }> = {
  PENDING:   { label: "Pending",                    pill: "bg-slate-100 text-slate-600 border border-slate-200",       dot: "bg-slate-400" },
  PARTIAL:   { label: "Fit for Surgery",            pill: "bg-amber-50 text-amber-700 border border-amber-300",        dot: "bg-amber-500" },
  COMPLETED: { label: "Completed",                  pill: "bg-emerald-100 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500" },
  POSTPONED: { label: "Date Not Confirmed",         pill: "bg-orange-50 text-orange-700 border border-orange-200",     dot: "bg-orange-500" },
};

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

export function isExpired(r: { status: CounsellingStatus; reportsValidUntil: string | null; eligible?: boolean }): boolean {
  // Fit (with or without the advance) but not finalized, and the reports' month has passed
  const open = r.status === "PARTIAL" || (r.status === "COMPLETED" && r.eligible === false);
  return open && !!r.reportsValidUntil && new Date(r.reportsValidUntil) < new Date();
}

/** Status used by the cards and Status filter: expired reports must be redone, so they count as Pending. */
function listStatus(r: CounsellingRow): CounsellingStatus {
  return isExpired(r) ? "PENDING" : r.status;
}

/** No Show: the tentative date has passed and counselling is not complete (Pending or Partial). */
export function isNoShow(r: CounsellingRow): boolean {
  if (!r.tentativeDate || new Date(r.tentativeDate) >= startOfDay(new Date())) return false;
  const s = listStatus(r);
  return s === "PENDING" || s === "PARTIAL";
}

/** Top card a patient is listed under. A new tentative date takes a No Show patient back to their card. */
function cardOf(r: CounsellingRow): Exclude<CardFilter, "ALL"> {
  if (isNoShow(r)) return "NOSHOW";
  const s = listStatus(r);
  return s === "COMPLETED" ? "COMPLETED" : s === "PARTIAL" ? "PARTIAL" : "PENDING";
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

/* ── Payment groups (tabs inside each top card) ────────────────────────── */
const GROUP_ORDER = PAYMENT_TYPES.map((t) => t.label as string).concat("Payment not set");
type PayGroup = string;

const TEAL = { border: "border-[var(--color-primary-200)]", head: "", icon: "bg-[var(--color-primary-100)] text-[var(--color-primary-700)]", count: "bg-[var(--color-primary-100)] text-[var(--color-primary-700)]" };
const GROUP_META: Record<string, { glyph: React.ReactNode; hint?: string; icon: string; count: string }> = {
  "Self":               { glyph: <Wallet size={13} />,         hint: "The patient pays (Out of Pocket)", icon: "bg-emerald-100 text-emerald-700", count: "bg-emerald-100 text-emerald-700" },
  "Health Insurance":   { glyph: <ShieldCheck size={13} />,    hint: "Health insurance",   icon: TEAL.icon, count: TEAL.count },
  "Government Scheme":  { glyph: <Landmark size={13} />,       hint: "Government scheme", icon: "bg-sky-100 text-sky-700", count: "bg-sky-100 text-sky-700" },
  "Corporate":          { glyph: <Building2 size={13} />,      hint: "Employer",       icon: "bg-violet-100 text-violet-700", count: "bg-violet-100 text-violet-700" },
  "Community Based":    { glyph: <HeartHandshake size={13} />, hint: "Community body or camp",   icon: "bg-rose-100 text-rose-700", count: "bg-rose-100 text-rose-700" },
  "Other":              { glyph: <MoreHorizontal size={13} />, hint: "Another payer",      icon: "bg-amber-100 text-amber-700", count: "bg-amber-100 text-amber-700" },
  "Payment not set":    { glyph: <Wallet size={13} />,         hint: "Payment option not chosen yet", icon: "bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)]", count: "bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]" },
};

/** Same column widths in the header and every group, so they line up. */
function ListCols() {
  return (
    <colgroup>
      <col className="w-[40%]" /><col className="w-[37%]" /><col className="w-[20%]" /><col className="w-[3%]" />
    </colgroup>
  );
}

/** Tab by payment type; records saved before types came first count as Self when Out of Pocket. */
function payGroup(r: CounsellingRow): PayGroup {
  const t = paymentTypeOf(r.paymentMode, r.paymentType);
  return PAYMENT_TYPES.find((x) => x.value === t)?.label ?? (r.paymentMode ? "Other" : "Payment not set");
}

/** Browser-style tabs, one per payment group; the active tab joins the card below. */
function GroupTabs({ groups, active, onSelect }: {
  groups: (readonly [PayGroup, CounsellingRow[]])[];
  active: PayGroup;
  onSelect: (g: PayGroup) => void;
}) {
  return (
    <div role="tablist" aria-label="Payment" className="flex items-end gap-1 overflow-x-auto px-1 -mb-px relative z-[1] [scrollbar-width:none]">
      {groups.map(([g, list]) => {
        const m = GROUP_META[g];
        const on = g === active;
        return (
          <button key={g} type="button" role="tab" aria-selected={on} onClick={() => onSelect(g)}
            title={m.hint} style={on ? undefined : { borderColor: "transparent" }}
            className={`group shrink-0 inline-flex items-center gap-2 h-10 pl-3 pr-3.5 rounded-t-xl border border-b-0 text-xs font-semibold whitespace-nowrap transition-colors ${
              on
                ? "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-ink-900)] shadow-[0_-1px_4px_rgba(15,23,42,0.05)]"
                : "bg-transparent text-[var(--color-ink-500)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink-700)]"
            }`}>
            <span className={`w-5 h-5 rounded-md flex items-center justify-center ${on ? m.icon : "text-[var(--color-ink-400)]"}`}>{m.glyph}</span>
            {g}
            <span className={`rounded-full px-1.5 py-px text-micro font-bold tabular-nums ${on ? m.count : "bg-white/70 text-[var(--color-ink-500)]"}`}>{list.length}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── List pieces (fields per the requirements: DP, name, age, sex, ID, C/c,
   diagnosis, surgery, status, tentative date) ───────────────────────────── */
/* Patient details styled like the Patient Library card */
const AVATAR_COLORS = [
  { bg: "#DCEFEC", text: "#115E59" },
  { bg: "#DBEAFE", text: "#1D4ED8" },
  { bg: "#DCFCE7", text: "#15803D" },
  { bg: "#FEE2E2", text: "#B91C1C" },
  { bg: "#EDE9FE", text: "#7C3AED" },
  { bg: "#FCE7F3", text: "#DB2777" },
  { bg: "#FEF3C7", text: "#B45309" },
  { bg: "#E0F2FE", text: "#0369A1" },
];
const avatarColor = (name: string) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function PatientInfo({ r }: { r: CounsellingRow }) {
  const av = avatarColor(r.patient.name);
  const sexLabel = r.patient.sex.charAt(0).toUpperCase();
  return (
    <div className="flex items-center gap-3 min-w-0">
      {r.patient.photoUrl ? (
        <img src={fileHref(r.patient.photoUrl)!} alt={r.patient.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
      ) : (
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-caption sm:text-xs font-bold shrink-0 select-none" style={{ background: av.bg, color: av.text }}>
          {initials(r.patient.name)}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-900)] truncate">{r.patient.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5 overflow-hidden">
          <span className="font-mono text-micro sm:text-caption bg-[#F0F8F6] text-[#115E59] px-1.5 py-0.5 rounded shrink-0">{r.patient.udid}</span>
          <span className="text-micro sm:text-caption text-[var(--color-ink-400)] truncate">
            {r.patient.age}y · {sexLabel}{r.patient.mobile ? ` · ${r.patient.mobile}` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Surgery as a chip, with the laterality in bold (same style as the complaint and diagnosis chips). */
function SurgeryChip({ r }: { r: CounsellingRow }) {
  return (
    <span className="flex min-w-0 flex-col items-start gap-1">
      <span className="inline-flex max-w-full flex-wrap items-center gap-x-1 px-2.5 py-0.5 rounded-full border border-[var(--color-primary-200)] bg-[var(--color-primary-50)] text-[var(--color-primary-800)] font-medium text-caption break-words">
        {r.laterality && <span className="clinical-laterality shrink-0">{r.laterality}</span>}
        {r.surgery}
      </span>
      {r.anaesthesia && <span className="pl-1 text-caption text-[var(--color-ink-500)]">{r.anaesthesia}</span>}
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
      <td className="px-4 py-3"><PatientInfo r={r} /></td>
      <td className="px-4 py-3"><SurgeryChip r={r} /></td>
      <td className="px-4 py-3 whitespace-nowrap"><TentativeDate r={r} /></td>
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
      <PatientInfo r={r} />
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-caption sm:text-xs">
        <span className="text-[var(--color-ink-400)]">Surgery</span>
        <SurgeryChip r={r} />
        <span className="text-[var(--color-ink-400)]">Tentative</span>
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

  // Card counts follow the date range in Filters.
  const inDateRange = (r: CounsellingRow) => {
    if (!dateFrom && !dateTo) return true;
    const d = format(new Date(r.tentativeDate ?? r.visitDate), "yyyy-MM-dd");
    return (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
  };

  const dated = useMemo(() => rows.filter(inDateRange), [rows, dateFrom, dateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => ({
    PENDING:   dated.filter((r) => cardOf(r) === "PENDING").length,
    PARTIAL:   dated.filter((r) => cardOf(r) === "PARTIAL").length,
    COMPLETED: dated.filter((r) => cardOf(r) === "COMPLETED").length,
    NOSHOW:    dated.filter((r) => cardOf(r) === "NOSHOW").length,
  }), [dated]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dated.filter((r) => {
      const s = listStatus(r);
      if (card !== "ALL" && cardOf(r) !== card) return false;
      if (statusFilter !== "ALL" && s !== statusFilter) return false;
      if (q) {
        const hay = [r.patient.name, r.patient.udid, r.patient.uhid ?? "", r.surgery, r.doctor.name].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => {
      // First to last by tentative date (same date: earlier visit first);
      // patients without a date after, also first to last by visit date.
      if (a.tentativeDate && b.tentativeDate) return a.tentativeDate.localeCompare(b.tentativeDate) || a.visitDate.localeCompare(b.visitDate);
      if (a.tentativeDate) return -1;
      if (b.tentativeDate) return 1;
      return a.visitDate.localeCompare(b.visitDate);
    });
  }, [dated, card, search, statusFilter]);

  const groups = useMemo(() => GROUP_ORDER
    .map((g) => [g, filtered.filter((r) => payGroup(r) === g)] as const)
    .filter(([, list]) => list.length > 0), [filtered]);
  // Selected date tab; falls back to the first tab that has patients
  const [tab, setTab] = useState<PayGroup | null>(null);
  const activeGroup = groups.find(([g]) => g === tab) ?? groups[0];

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
          label="Completed · Advance paid" count={counts.COMPLETED}
          icon={<CheckCircle2 size={17} className="text-emerald-600" />}
          accent="text-emerald-700" iconBg="bg-emerald-50"
          onClick={() => toggleCard("COMPLETED")} active={card === "COMPLETED"}
        />
        <StatCard
          label="No Show · Date passed" count={counts.NOSHOW}
          icon={<UserX size={17} className="text-red-600" />}
          accent="text-red-600" iconBg="bg-red-50"
          onClick={() => toggleCard("NOSHOW")} active={card === "NOSHOW"}
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
              { value: "COMPLETED", label: "Completed (advance paid)" },
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
          <GroupTabs groups={groups} active={activeGroup[0]} onSelect={setTab} />

          {/* Desktop — the selected date tab's patients */}
          <div className={`hidden lg:block rounded-xl rounded-tl-none border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden`}>
            {GROUP_META[activeGroup[0]].hint && (
              <p className="px-4 pt-2.5 text-micro font-medium text-[var(--color-ink-400)]">{GROUP_META[activeGroup[0]].hint}</p>
            )}
            <table className="w-full table-fixed">
              <ListCols />
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  {["Patient", "Surgery", "Tentative", ""].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-micro sm:text-caption font-bold uppercase tracking-widest text-[var(--color-ink-400)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeGroup[1].map((r) => <PatientRow key={r.visitId} r={r} onOpen={() => router.push(`/counselling/${r.visitId}`)} />)}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden rounded-xl rounded-tl-none border border-[var(--color-border)] bg-[var(--color-surface)] p-2 space-y-2">
            {GROUP_META[activeGroup[0]].hint && (
              <p className="px-1.5 pt-0.5 text-micro font-medium text-[var(--color-ink-400)]">{GROUP_META[activeGroup[0]].hint}</p>
            )}
            {activeGroup[1].map((r) => <PatientCard key={r.visitId} r={r} />)}
          </div>
        </>
      )}
    </div>
  );
}
