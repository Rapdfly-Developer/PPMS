"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BarChart3, ChevronDown, Download, FileSpreadsheet, FileText, Printer, RefreshCw, RotateCcw, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { TABS, type TabId } from "@/lib/analytics/definitions";
import { COMPARE_OPTIONS, FILTER_KEYS, PRESETS, buildQuery, type AnalyticsFilters } from "@/lib/analytics/filters";
import { download, sheetsFromData, toCsv, toExcel, type ExportMeta } from "./export";

interface Option { id: string; name: string }

export interface ShellProps {
  filters: AnalyticsFilters;
  params: Record<string, string | undefined>;
  scopeLabel: string;
  generatedAt: string;
  tabs: TabId[];
  hospitals: Option[];
  doctors: Option[];
  showDoctorFilter: boolean;
  visitTypes: string[];
  statuses: { value: string; label: string }[];
  canExport: boolean;
  exportData: unknown;
  children: ReactNode;
}

const STORAGE_KEY = "rf_analytics_filters";
const control = "h-10 w-full rounded-[10px] border border-[var(--color-border)] bg-white px-3 text-label text-[var(--color-ink-800)] transition-colors duration-150 hover:border-[#CBD4D8] focus:outline-none focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-500)]/20";
const btnSecondary = "inline-flex h-10 items-center gap-2 rounded-[10px] border border-[var(--color-border)] bg-white px-3.5 text-label font-medium text-[var(--color-ink-700)] shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors duration-150 hover:border-[#CBD4D8] hover:bg-[#F7F9FA] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)]";
const btnPrimary = "inline-flex h-10 items-center gap-2 rounded-[10px] bg-[var(--color-primary-700)] px-4 text-label font-semibold text-white shadow-[0_1px_2px_rgba(16,24,40,0.08)] transition-colors duration-150 hover:bg-[var(--color-primary-800)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)] focus-visible:ring-offset-2 disabled:opacity-60";

function SelectBox({ children, className = "", ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative block">
      <select {...props} className={`${control} appearance-none pr-9 ${className}`}>{children}</select>
      <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]" aria-hidden="true" />
    </span>
  );
}

function useRelativeTime(iso: string) {
  // First render must match the server's HTML, so it starts from the
  // generation time itself ("Updated just now") rather than the browser clock:
  // a late hydration or a skewed PC clock otherwise rendered "Updated 2
  // minutes ago" against the server's "just now" — a hydration mismatch that
  // makes React throw away the server markup. The real clock takes over on mount.
  const [now, setNow] = useState(() => new Date(iso).getTime());
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, []);
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  return mins < 1 ? "Updated just now" : mins === 1 ? "Updated 1 minute ago" : mins < 60 ? `Updated ${mins} minutes ago` : `Updated ${Math.round(mins / 60)} h ago`;
}

export function AnalyticsShell(props: ShellProps) {
  const { filters: f, params, tabs } = props;
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState(params);
  const [showFilters, setShowFilters] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const updated = useRelativeTime(props.generatedAt);
  const exportRef = useRef<HTMLDivElement>(null);

  // Reset the draft whenever the applied filters change (e.g. back/forward).
  const paramsKey = buildQuery(params);
  const [draftFor, setDraftFor] = useState(paramsKey);
  if (draftFor !== paramsKey) {
    setDraftFor(paramsKey);
    setDraft(params);
  }

  // Restore the last-used filters when arriving without any.
  useEffect(() => {
    const hasFilters = FILTER_KEYS.some((k) => search.has(k));
    if (hasFilters) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && saved !== "?") router.replace(`${pathname}${saved}${saved.includes("?") ? "&" : "?"}tab=${f.tab}`);
    } catch { /* storage unavailable */ }
    // Only on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!exportOpen) return;
    const close = (e: MouseEvent) => { if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setExportOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [exportOpen]);

  function navigate(next: Record<string, string | undefined>) {
    const filterOnly = Object.fromEntries(FILTER_KEYS.map((k) => [k, next[k]]));
    try { localStorage.setItem(STORAGE_KEY, buildQuery(filterOnly)); } catch { /* ignore */ }
    start(() => router.push(`${pathname}${buildQuery(next, { tab: f.tab === "overview" ? undefined : f.tab })}`, { scroll: false }));
  }

  function apply() {
    const next = { ...draft };
    if (next.range !== "custom") { next.from = undefined; next.to = undefined; }
    setShowFilters(false);
    navigate(next);
  }

  function reset() {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setDraft({});
    navigate({});
  }

  const set = (k: string, v: string) => setDraft((d) => ({ ...d, [k]: v || undefined }));
  const hospitalName = props.hospitals.find((h) => h.id === f.hospitalId)?.name ?? "All hospitals";
  const doctorName = props.doctors.find((d) => d.id === f.doctorId)?.name ?? (props.showDoctorFilter ? "All doctors" : props.doctors[0]?.name ?? "—");

  const meta = (title: string): ExportMeta => ({
    title,
    period: f.periodLabel,
    comparison: f.compareLabel,
    hospital: hospitalName,
    doctor: doctorName,
    generatedAt: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
  });
  const tabLabel = TABS.find((t) => t.id === f.tab)?.label ?? "Analytics";
  const fileBase = `rf-health-analytics-${f.tab}-${f.start}-to-${f.end}`;

  function exportAs(kind: "csv" | "xls") {
    const sheets = sheetsFromData(tabLabel, props.exportData);
    const m = meta(`RF Health analytics: ${tabLabel}`);
    if (kind === "csv") download(`${fileBase}.csv`, toCsv(m, sheets), "text/csv;charset=utf-8");
    else download(`${fileBase}.xls`, toExcel(m, sheets), "application/vnd.ms-excel");
    setExportOpen(false);
  }

  const reportHref = (sections: string[], extra: Record<string, string | undefined> = {}) =>
    `/analytics/report${buildQuery({ ...params, ...extra }, { sections: sections.join(",") })}`;

  return (
    <div className="flex flex-col gap-4 pb-12">
      {/* Progress bar during filter / tab navigation */}
      <div aria-hidden="true" className={`fixed left-0 right-0 top-0 z-50 h-0.5 origin-left bg-[var(--color-primary-600)] transition-transform duration-700 ${pending ? "scale-x-75" : "scale-x-0"}`} />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1.5 text-caption text-[var(--color-ink-400)]">
            <Link href="/dashboard" className="transition-colors hover:text-[var(--color-primary-700)]">Dashboard</Link>
            <span aria-hidden="true" className="text-[var(--color-ink-300)]">/</span>
            <span className="font-medium text-[var(--color-ink-700)]">Analytics</span>
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-700)] text-white shadow-[0_6px_16px_-6px_rgba(17,94,89,0.55)]" aria-hidden="true">
              <BarChart3 size={20} strokeWidth={1.9} />
            </span>
            <div className="min-w-0">
              <h1 className="text-heading-lg sm:text-[28px] font-bold leading-[1.15] tracking-[-0.02em] text-[var(--color-ink-900)]">Analytics &amp; Intelligence</h1>
              <p className="mt-1 max-w-2xl text-label leading-snug text-[var(--color-ink-500)]">
                Monitor clinical activity, patient care, appointments and operations across {props.scopeLabel}.
              </p>
            </div>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <span className="inline-flex w-full items-center gap-1.5 text-caption text-[var(--color-ink-400)] sm:mr-1 sm:w-auto" aria-live="polite">
            <span className="h-1.5 w-1.5 rounded-full bg-[#12B76A]" aria-hidden="true" />{updated}
          </span>
          <button
            type="button"
            onClick={() => start(() => router.refresh())}
            className={btnSecondary}
          >
            <RefreshCw size={14} className={pending ? "animate-spin" : ""} /> <span className="sr-only sm:not-sr-only">Refresh</span>
          </button>
          {props.canExport && (
            <>
              <div ref={exportRef} className="relative">
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={exportOpen}
                  onClick={() => setExportOpen((o) => !o)}
                  className={btnSecondary}
                >
                  <Download size={14} /> Export <ChevronDown size={13} className={`text-[var(--color-ink-400)] transition-transform duration-200 ${exportOpen ? "rotate-180" : ""}`} />
                </button>
                {exportOpen && (
                  <div role="menu" className="absolute right-0 top-full z-40 mt-2 w-64 rounded-xl border border-[var(--color-border)] bg-white p-1.5 shadow-[0_16px_40px_-12px_rgba(16,24,40,0.22)] animate-[fadeIn_150ms_ease-out]">
                    <p className="px-2.5 pb-1.5 pt-1.5 text-caption font-semibold text-[var(--color-ink-400)]">Current view: {tabLabel}</p>
                    <button role="menuitem" type="button" onClick={() => exportAs("csv")} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-label text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]"><FileText size={14} /> CSV</button>
                    <button role="menuitem" type="button" onClick={() => exportAs("xls")} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-label text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]"><FileSpreadsheet size={14} /> Excel workbook</button>
                    <a role="menuitem" href={reportHref([f.tab])} target="_blank" rel="noopener" onClick={() => setExportOpen(false)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-label text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]"><Printer size={14} /> PDF (print)</a>
                    <div className="my-1 h-px bg-[var(--color-border)]" />
                    <a role="menuitem" href={reportHref(tabs)} target="_blank" rel="noopener" onClick={() => setExportOpen(false)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-label text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]"><FileText size={14} /> Complete analytics report</a>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setBuilderOpen(true)}
                className={btnPrimary}
              >
                <Sparkles size={14} /> Generate report
              </button>
            </>
          )}
        </div>
      </header>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <section aria-label="Analytics filters" className="rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="flex items-center justify-between gap-2 md:hidden">
          <p className="min-w-0 truncate text-label text-[var(--color-ink-700)]"><span className="font-semibold text-[var(--color-ink-900)]">{PRESETS.find((p) => p.id === f.preset)?.label}</span> · {hospitalName}</p>
          <button type="button" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters} className={`${btnSecondary} h-9 shrink-0`}>
            <SlidersHorizontal size={13} /> Filters
          </button>
        </div>
        <div className={`${showFilters ? "flex" : "hidden"} md:flex mt-4 md:mt-0 flex-col md:flex-row md:flex-wrap md:items-end gap-3`}>
          <Field label="Date range">
            <SelectBox value={draft.range ?? "30d"} onChange={(e) => set("range", e.target.value)}>
              {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </SelectBox>
          </Field>
          {(draft.range ?? "30d") === "custom" && (
            <>
              <Field label="From"><input type="date" className={control} value={draft.from ?? f.start} max={draft.to ?? f.end} onChange={(e) => set("from", e.target.value)} /></Field>
              <Field label="To"><input type="date" className={control} value={draft.to ?? f.end} min={draft.from ?? f.start} onChange={(e) => set("to", e.target.value)} /></Field>
            </>
          )}
          {props.hospitals.length > 1 && (
            <Field label="Hospital">
              <SelectBox value={draft.hospital ?? ""} onChange={(e) => set("hospital", e.target.value)}>
                <option value="">All hospitals</option>
                {props.hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </SelectBox>
            </Field>
          )}
          {props.showDoctorFilter && (
            <Field label="Doctor">
              <SelectBox value={draft.doctor ?? ""} onChange={(e) => set("doctor", e.target.value)}>
                <option value="">All doctors</option>
                {props.doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </SelectBox>
            </Field>
          )}
          {props.visitTypes.length > 0 && (
            <Field label="Visit type">
              <SelectBox value={draft.visitType ?? ""} onChange={(e) => set("visitType", e.target.value)}>
                <option value="">All visit types</option>
                {props.visitTypes.map((v) => <option key={v} value={v}>{v}</option>)}
              </SelectBox>
            </Field>
          )}
          <Field label="Patients">
            <SelectBox value={draft.patientType ?? ""} onChange={(e) => set("patientType", e.target.value)}>
              <option value="">New and returning</option>
              <option value="new">New only</option>
              <option value="returning">Returning only</option>
            </SelectBox>
          </Field>
          {f.tab === "appointments" && (
            <Field label="Status">
              <SelectBox value={draft.status ?? ""} onChange={(e) => set("status", e.target.value)}>
                <option value="">All statuses</option>
                {props.statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </SelectBox>
            </Field>
          )}
          <Field label="Compare with">
            <SelectBox value={draft.compare ?? "prev"} onChange={(e) => set("compare", e.target.value === "prev" ? "" : e.target.value)}>
              {COMPARE_OPTIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </SelectBox>
          </Field>
          <div className="flex gap-2 md:ml-auto">
            <button type="button" onClick={reset} className={btnSecondary}>
              <RotateCcw size={14} /> Reset
            </button>
            <button type="button" onClick={apply} disabled={pending} className={`${btnPrimary} px-5`}>
              Apply filters
            </button>
          </div>
        </div>
      </section>

      <p className="-mt-1 px-1 text-label text-[var(--color-ink-500)]">
        Showing <span className="font-semibold text-[var(--color-ink-800)]">{f.periodLabel}</span>
        <span className="text-[var(--color-ink-300)]"> · </span>{hospitalName}
        {props.showDoctorFilter ? <><span className="text-[var(--color-ink-300)]"> · </span>{(doctorName === "All doctors" || doctorName === "—") ? doctorName : `Dr. ${doctorName}`}</> : null}
        <span className="text-[var(--color-ink-300)]"> · </span>compared with {f.compareLabel}
      </p>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <nav aria-label="Analytics sections" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 scrollbar-thin">
        <ul className="inline-flex min-w-max gap-0.5 rounded-xl border border-[var(--color-border)] bg-white p-1 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          {TABS.filter((t) => tabs.includes(t.id)).map((t) => {
            const active = t.id === f.tab;
            return (
              <li key={t.id}>
                <Link
                  href={`${pathname}${buildQuery(params, { tab: t.id === "overview" ? undefined : t.id })}`}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  onClick={(e) => { if (!active) { e.preventDefault(); start(() => router.push(`${pathname}${buildQuery(params, { tab: t.id === "overview" ? undefined : t.id })}`, { scroll: false })); } }}
                  className={`inline-flex h-9 items-center rounded-lg px-3.5 text-label whitespace-nowrap transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)] ${
                    active
                      ? "bg-[var(--color-primary-50)] font-semibold text-[var(--color-primary-800)] shadow-[inset_0_0_0_1px_rgba(21,122,115,0.18)]"
                      : "font-medium text-[var(--color-ink-500)] hover:bg-[#F2F5F6] hover:text-[var(--color-ink-900)]"
                  }`}
                >
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={`transition-opacity duration-200 ${pending ? "opacity-50 pointer-events-none" : ""}`} aria-busy={pending}>
        {props.children}
      </div>

      {builderOpen && (
        <ReportBuilder
          onClose={() => setBuilderOpen(false)}
          tabs={tabs}
          hospitals={props.hospitals}
          params={params}
          reportHref={reportHref}
        />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 md:min-w-[156px]">
      <span className="text-caption font-semibold text-[var(--color-ink-500)]">{label}</span>
      {children}
    </label>
  );
}

/* ═══ Report builder ═══════════════════════════════════════════════════════ */

const REPORT_TYPES: { id: string; label: string; sections: TabId[] | "all" }[] = [
  { id: "complete",       label: "Complete healthcare analytics", sections: "all" },
  { id: "executive",      label: "Executive summary",             sections: ["overview", "hospitals"] },
  { id: "patients",       label: "Patient analytics",             sections: ["patients"] },
  { id: "appointments",   label: "Appointment report",            sections: ["appointments", "operations"] },
  { id: "clinical",       label: "Clinical activity",             sections: ["clinical"] },
  { id: "investigations", label: "Investigation report",          sections: ["investigations"] },
  { id: "surgery",        label: "Surgery report",                sections: ["surgery"] },
  { id: "followups",      label: "Follow-up report",              sections: ["followups"] },
  { id: "hospitals",      label: "Hospital report",               sections: ["hospitals"] },
  { id: "audit",          label: "Audit report",                  sections: ["activity"] },
];

function ReportBuilder({ onClose, tabs, hospitals, params, reportHref }: {
  onClose: () => void;
  tabs: TabId[];
  hospitals: Option[];
  params: Record<string, string | undefined>;
  reportHref: (sections: string[], extra?: Record<string, string | undefined>) => string;
}) {
  const types = REPORT_TYPES.filter((r) => r.sections === "all" || r.sections.some((s) => tabs.includes(s)));
  const [type, setType] = useState("complete");
  const [sections, setSections] = useState<Set<TabId>>(new Set(tabs));
  const [range, setRange] = useState(params.range ?? "30d");
  const [from, setFrom] = useState(params.from ?? "");
  const [to, setTo] = useState(params.to ?? "");
  const [hospital, setHospital] = useState(params.hospital ?? "");
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  function pickType(id: string) {
    setType(id);
    const t = REPORT_TYPES.find((r) => r.id === id)!;
    setSections(new Set(t.sections === "all" ? tabs : t.sections.filter((s) => tabs.includes(s))));
  }

  const toggle = (id: TabId) => setSections((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const ordered = TABS.map((t) => t.id).filter((id) => sections.has(id));
  const href = reportHref(ordered, {
    range: range === "30d" ? undefined : range,
    from: range === "custom" ? from || undefined : undefined,
    to: range === "custom" ? to || undefined : undefined,
    hospital: hospital || undefined,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[2px] p-0 sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="report-builder-title" className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white p-6 shadow-[0_24px_64px_-16px_rgba(16,24,40,0.35)] focus:outline-none animate-[fadeIn_200ms_ease-out]">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 rounded-lg p-1.5 text-[var(--color-ink-400)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink-700)]"><X size={16} /></button>
        <h2 id="report-builder-title" className="text-heading-sm font-semibold text-[var(--color-ink-900)]">Generate report</h2>
        <p className="mt-0.5 text-label text-[var(--color-ink-500)]">Builds a printable report you can save as PDF. Only data you can access is included.</p>

        <div className="mt-4 flex flex-col gap-3.5">
          <Field label="Report type">
            <SelectBox value={type} onChange={(e) => pickType(e.target.value)}>
              {types.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </SelectBox>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Date range">
              <SelectBox value={range} onChange={(e) => setRange(e.target.value)}>
                {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </SelectBox>
            </Field>
            {hospitals.length > 1 && (
              <Field label="Hospital">
                <SelectBox value={hospital} onChange={(e) => setHospital(e.target.value)}>
                  <option value="">All hospitals</option>
                  {hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                </SelectBox>
              </Field>
            )}
            {range === "custom" && (
              <>
                <Field label="From"><input type="date" className={control} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
                <Field label="To"><input type="date" className={control} value={to} onChange={(e) => setTo(e.target.value)} /></Field>
              </>
            )}
          </div>
          <fieldset>
            <legend className="mb-2 text-caption font-semibold text-[var(--color-ink-500)]">Sections</legend>
            <div className="grid grid-cols-2 gap-1.5">
              {TABS.filter((t) => tabs.includes(t.id)).map((t) => (
                <label key={t.id} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-2.5 py-2 text-label text-[var(--color-ink-700)] cursor-pointer has-[:checked]:border-[var(--color-primary-400)] has-[:checked]:bg-[var(--color-primary-50)]">
                  <input type="checkbox" checked={sections.has(t.id)} onChange={() => toggle(t.id)} className="accent-[var(--color-primary-600)]" />
                  {t.label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
          <a
            href={ordered.length ? href : undefined}
            target="_blank"
            rel="noopener"
            aria-disabled={ordered.length === 0}
            onClick={(e) => { if (!ordered.length || (range === "custom" && (!from || !to))) { e.preventDefault(); return; } onClose(); }}
            className={`${btnPrimary} ${ordered.length === 0 || (range === "custom" && (!from || !to)) ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <Printer size={13} /> Generate report
          </a>
        </div>
      </div>
    </div>
  );
}
