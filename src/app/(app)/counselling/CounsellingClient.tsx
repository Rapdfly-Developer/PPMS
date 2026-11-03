"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  ClipboardCheck, Search, Filter, X, User, Clock, CheckCircle2, ShieldCheck,
  Layers, ChevronRight, FlaskConical, CalendarDays, Scissors,
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
  postponedUntil: string | null;
  postponedIndefinitely: boolean;
  updatedAt: string;
}

type CardFilter = "PENDING" | "PARTIAL" | "COMPLETED" | "ALL";

export const STATUS_META: Record<CounsellingStatus, { label: string; pill: string; dot: string }> = {
  PENDING:   { label: "Pending",                    pill: "bg-slate-100 text-slate-600 border border-slate-200",       dot: "bg-slate-400" },
  PARTIAL:   { label: "Fit for Surgery",            pill: "bg-amber-50 text-amber-700 border border-amber-300",        dot: "bg-amber-500" },
  COMPLETED: { label: "Eligible for Surgery",       pill: "bg-emerald-100 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500" },
  POSTPONED: { label: "Postponed",                  pill: "bg-orange-50 text-orange-700 border border-orange-200",     dot: "bg-orange-500" },
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

function PatientCard({ r, showDoctor }: { r: CounsellingRow; showDoctor: boolean }) {
  const expired = isExpired(r);
  return (
    <Link
      href={`/counselling/${r.visitId}`}
      className="group block rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3 hover:border-[var(--color-primary-300)] hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-full bg-[var(--color-primary-100)] flex items-center justify-center shrink-0 overflow-hidden">
            {r.patient.photoUrl
              ? <img src={fileHref(r.patient.photoUrl)!} alt={r.patient.name} className="w-full h-full object-cover" />
              : <User size={15} className="text-[var(--color-primary-700)]" />}
          </div>
          <div className="min-w-0">
            <p className="text-label sm:text-sm font-bold text-[var(--color-ink-900)] truncate">{r.patient.name}</p>
            <p className="text-caption text-[var(--color-ink-400)] mt-0.5">
              {r.patient.uhid ?? r.patient.udid} · {r.patient.age}y/{SEX_SHORT[r.patient.sex] ?? r.patient.sex}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <StatusBadge status={r.status} expired={expired} />
          <ChevronRight size={15} className="text-[var(--color-ink-300)] group-hover:text-[var(--color-primary-500)] transition-colors" />
        </div>
      </div>

      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-caption sm:text-xs">
        {showDoctor && (
          <>
            <span className="text-[var(--color-ink-400)]">Doctor</span>
            <span className="font-medium text-[var(--color-ink-700)]">Dr. {r.doctor.name}</span>
          </>
        )}
        <span className="text-[var(--color-ink-400)]">C/c</span>
        {r.chiefComplaint
          ? <ComplaintChips value={r.chiefComplaint} wrap />
          : <span className="italic text-[var(--color-ink-300)]">—</span>}
        <span className="text-[var(--color-ink-400)]">Diagnosis</span>
        {r.diagnoses.length > 0 ? (
          <span className="flex flex-wrap gap-1 min-w-0">
            {r.diagnoses.map((d, i) => (
              <span key={i} className="clinical-diagnosis-chip inline-flex flex-wrap items-center gap-x-1 max-w-full px-2.5 py-0.5 rounded-lg border text-caption break-words">
                {d.laterality && <span className="clinical-laterality shrink-0">{d.laterality}</span>}
                {d.description}
              </span>
            ))}
          </span>
        ) : <span className="italic text-[var(--color-ink-300)]">—</span>}
        <span className="text-[var(--color-ink-400)]">Surgery</span>
        <span className="font-semibold text-[var(--color-ink-800)] break-words">
          {r.laterality && <span className="clinical-laterality mr-1">{r.laterality}</span>}
          {r.surgery}
          {r.anaesthesia && <span className="font-normal text-[var(--color-ink-500)]"> · {r.anaesthesia}</span>}
        </span>
        <span className="text-[var(--color-ink-400)]">Tentative Date</span>
        <span className="font-medium text-[var(--color-ink-700)]">
          {r.tentativeDate ? format(new Date(r.tentativeDate), "d MMM yyyy") : <span className="italic text-[var(--color-ink-300)]">Not set</span>}
          {r.status === "POSTPONED" && (
            <span className="ml-1.5 text-orange-700">
              · Postponed {r.postponedIndefinitely ? "indefinitely" : r.postponedUntil ? `to ${format(new Date(r.postponedUntil), "d MMM yyyy")}` : ""}
            </span>
          )}
        </span>
        <span className="text-[var(--color-ink-400)]">Investigations</span>
        <span className={`inline-flex items-center gap-1 font-medium ${r.invTotal > 0 && r.invDone === r.invTotal ? "text-emerald-700" : "text-[var(--color-ink-700)]"}`}>
          <FlaskConical size={11} className="shrink-0" />
          {r.invTotal === 0 ? "None ordered" : `${r.invDone}/${r.invTotal} complete`}
        </span>
      </div>
    </Link>
  );
}

export function CounsellingClient({
  rows, showDoctor,
}: {
  rows: CounsellingRow[];
  showDoctor: boolean;
}) {
  const [card, setCard]                 = useState<CardFilter>("ALL");
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
    PENDING:   dated.filter((r) => r.status === "PENDING" || r.status === "POSTPONED").length,
    PARTIAL:   dated.filter((r) => r.status === "PARTIAL").length,
    COMPLETED: dated.filter((r) => r.status === "COMPLETED").length,
    ALL:       dated.length,
  }), [dated]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dated.filter((r) => {
      if (card === "PENDING" && r.status !== "PENDING" && r.status !== "POSTPONED") return false;
      if (card === "PARTIAL" && r.status !== "PARTIAL") return false;
      if (card === "COMPLETED" && r.status !== "COMPLETED") return false;
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
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

  const filtersActive = !!(search || statusFilter !== "ALL" || dateFrom || dateTo);
  const toggleCard = (c: CardFilter) => setCard(card === c ? "ALL" : c);
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
          onClick={() => { setCard("ALL"); setShowFilters(true); }} active={card === "ALL"}
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
              { value: "POSTPONED", label: "Postponed" },
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
              ? "Fill a procedure in the EMR Plan tab's Minor Procedure card to see the patient here."
              : "Try another card or adjust the filters."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map((r) => <PatientCard key={r.visitId} r={r} showDoctor={showDoctor} />)}
        </div>
      )}
    </div>
  );
}
