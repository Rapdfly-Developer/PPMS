"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownRight, ArrowUpRight, ArrowUpDown, ChevronLeft, ChevronRight, Download, Info, Minus, RefreshCw, Search, AlertTriangle,
  Activity, AlarmClock, AlertCircle, Calendar, CalendarCheck, CalendarClock, CalendarDays, CalendarPlus, CalendarRange, CalendarX2,
  CheckCheck, CheckCircle2, CircleCheck, CircleX, ClipboardList, Clock, Clock3, FileCheck2, FilePen, FileSearch, FlaskConical,
  HeartPulse, HelpCircle, Hourglass, Layers, ListOrdered, LogIn, MessageSquareText, MessagesSquare, MonitorSmartphone, Percent,
  Pill, Printer, Repeat, Repeat2, Scissors, ScrollText, Share2, ShieldAlert, Stethoscope, Timer, UserPlus, UserX, Users, XCircle,
  type LucideIcon,
} from "lucide-react";
import { METRICS, formatMetric, type KpiValue, type MetricId, type TableData, type CellValue } from "@/lib/analytics/definitions";
import { buildQuery } from "@/lib/analytics/filters";
import { Sparkline } from "./charts";
import { downloadTableCsv } from "./export";

/* ═══ Info tooltip ═════════════════════════════════════════════════════════ */

export function InfoTip({ text, label }: { text: string; label: string }) {
  const id = useId();
  // Centred over its icon the tip ran off-screen for icons near either edge
  // (e.g. two-up KPI tiles on a phone). On open, nudge it sideways so it stays
  // at least 16px inside the viewport.
  const [shift, setShift] = useState(0);
  const place = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const w = Math.min(240, vw - 32);
    const left = r.left + r.width / 2 - w / 2;
    setShift(Math.max(16, Math.min(left, vw - 16 - w)) - left);
  };
  return (
    <span
      className="relative inline-flex group/tip"
      onPointerEnter={(e) => place(e.currentTarget)}
      onFocus={(e) => place(e.currentTarget)}
    >
      <button
        type="button"
        aria-describedby={id}
        aria-label={`About ${label}`}
        className="rounded-full text-[var(--color-ink-300)] hover:text-[var(--color-ink-500)] focus:outline-none focus-visible:text-[var(--color-ink-700)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)]"
      >
        <Info size={12} />
      </button>
      <span
        id={id}
        role="tooltip"
        style={{ transform: `translateX(calc(-50% + ${shift}px))` }}
        className="invisible opacity-0 group-hover/tip:visible group-hover/tip:opacity-100 group-focus-within/tip:visible group-focus-within/tip:opacity-100 transition-opacity absolute left-1/2 bottom-full mb-2 z-30 w-[min(15rem,calc(100vw-2rem))] rounded-lg bg-[var(--color-ink-900)] px-3 py-2 text-caption font-normal normal-case tracking-normal leading-snug text-white shadow-lg"
      >
        {text}
      </span>
    </span>
  );
}

/* ═══ KPI card ═════════════════════════════════════════════════════════════ */

type Tone = "teal" | "green" | "amber" | "red" | "blue";

const TONE_CLS: Record<Tone, string> = {
  teal:  "bg-[var(--color-primary-50)] text-[var(--color-primary-700)]",
  green: "bg-[#ECFDF3] text-[#067647]",
  amber: "bg-[#FFF7E6] text-[#B54708]",
  red:   "bg-[#FEF3F2] text-[#B42318]",
  blue:  "bg-[#EFF6FF] text-[#1D4ED8]",
};

const KPI_ICON: Partial<Record<MetricId, [LucideIcon, Tone]>> = {
  appointments: [Calendar, "teal"],
  completedAppointments: [CheckCircle2, "green"],
  pendingAppointments: [Clock, "amber"],
  cancelledAppointments: [XCircle, "red"],
  noShowAppointments: [UserX, "red"],
  rescheduledAppointments: [CalendarClock, "blue"],
  completionRate: [CircleCheck, "green"],
  cancellationRate: [CircleX, "red"],
  noShowRate: [UserX, "red"],
  avgAppointmentsPerDay: [CalendarDays, "teal"],
  peakDay: [CalendarRange, "blue"],
  peakHour: [Clock3, "blue"],
  totalPatients: [Users, "teal"],
  newPatients: [UserPlus, "teal"],
  patientsSeen: [Stethoscope, "teal"],
  returningPatients: [Repeat, "blue"],
  avgVisitsPerPatient: [Repeat2, "blue"],
  consultations: [Stethoscope, "teal"],
  finalizedConsultations: [FileCheck2, "green"],
  pendingDocumentation: [FilePen, "amber"],
  complaintsRecorded: [MessageSquareText, "teal"],
  treatmentPlans: [ClipboardList, "teal"],
  referrals: [Share2, "blue"],
  followUpRecommended: [CalendarPlus, "teal"],
  diagnoses: [Activity, "teal"],
  uniqueDiagnoses: [Layers, "blue"],
  provisionalDiagnoses: [HelpCircle, "amber"],
  prescriptions: [Pill, "teal"],
  medicationLines: [ListOrdered, "blue"],
  drugsPerPrescription: [Pill, "blue"],
  investigationsOrdered: [FlaskConical, "teal"],
  investigationsOpen: [Hourglass, "amber"],
  investigationsResultAvailable: [FileSearch, "blue"],
  investigationsReviewed: [CheckCheck, "green"],
  investigationReviewRate: [Percent, "green"],
  avgTimeToReview: [Timer, "blue"],
  surgeriesAdvised: [Scissors, "teal"],
  surgeryCounselled: [MessagesSquare, "blue"],
  fitForSurgery: [HeartPulse, "green"],
  notMarkedFit: [AlertCircle, "amber"],
  surgeriesScheduled: [CalendarCheck, "blue"],
  surgeriesCompleted: [CheckCircle2, "green"],
  followUpsDue: [CalendarClock, "teal"],
  followUpsCompleted: [CheckCircle2, "green"],
  followUpsPending: [Clock, "amber"],
  followUpsOverdue: [AlarmClock, "red"],
  followUpsMissed: [CalendarX2, "red"],
  followUpCompletionRate: [Percent, "green"],
  avgFollowUpInterval: [CalendarRange, "blue"],
  avgWait: [Hourglass, "amber"],
  avgTimeInClinic: [Timer, "blue"],
  activeUsers: [Users, "teal"],
  logins: [LogIn, "teal"],
  failedLogins: [ShieldAlert, "red"],
  activeSessions: [MonitorSmartphone, "green"],
  exportsAndPrints: [Printer, "blue"],
  auditEvents: [ScrollText, "teal"],
};

function changeOf(k: KpiValue): { chip: string; dir: "up" | "down" | "flat"; context: "vs" | "none" } | null {
  const def = METRICS[k.id];
  if (k.prev === undefined || k.prev === null || k.value === null || k.display) return null;
  if (def.format === "percent") {
    const diff = Math.round((k.value - k.prev) * 10) / 10;
    if (diff === 0) return { chip: "No change", dir: "flat", context: "vs" };
    return { chip: `${diff > 0 ? "+" : "−"}${Math.abs(diff)} pts`, dir: diff > 0 ? "up" : "down", context: "vs" };
  }
  if (k.prev === 0) return k.value === 0 ? { chip: "No change", dir: "flat", context: "vs" } : { chip: "New", dir: "up", context: "none" };
  const ch = Math.round(((k.value - k.prev) / k.prev) * 1000) / 10;
  if (ch === 0) return { chip: "No change", dir: "flat", context: "vs" };
  return { chip: `${Math.abs(ch)}%`, dir: ch > 0 ? "up" : "down", context: "vs" };
}

export function KpiCard({ kpi, compareLabel }: { kpi: KpiValue; compareLabel: string }) {
  const def = METRICS[kpi.id];
  const label = kpi.label ?? def.label;
  const change = changeOf(kpi);
  const [Icon, tone] = KPI_ICON[kpi.id] ?? [Activity, "teal" as Tone];
  const Arrow = change?.dir === "up" ? ArrowUpRight : change?.dir === "down" ? ArrowDownRight : Minus;
  const dirWord = change?.dir === "up" ? "increase" : change?.dir === "down" ? "decrease" : "";

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5 pt-1">
          {/* Wraps on phones (two-up tiles are narrow); the metric name must stay readable. */}
          <p className="break-words sm:truncate text-label font-semibold tracking-[0.01em] text-[var(--color-ink-500)]">{label}</p>
          <InfoTip text={def.tooltip} label={label} />
        </div>
        <span className={`hidden sm:flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${TONE_CLS[tone]}`} aria-hidden="true">
          <Icon size={15} strokeWidth={1.75} />
        </span>
      </div>
      <p className="mt-2.5 text-heading-lg min-[400px]:text-[28px] sm:text-[30px] font-bold leading-none tracking-[-0.02em] tabular-nums text-[var(--color-ink-900)]">
        {kpi.display ?? formatMetric(kpi.value, def.format)}
      </p>
      {kpi.sub && <p className="mt-2 break-words sm:truncate text-caption text-[var(--color-ink-500)]">{kpi.sub}</p>}
      {(change || kpi.spark) && (
        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          {change ? (
            <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-caption leading-snug text-[var(--color-ink-400)]">
              <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--color-surface-sunken)] px-1.5 py-0.5 font-semibold text-[var(--color-ink-700)]">
                <Arrow size={11} strokeWidth={2.25} aria-hidden="true" />
                {change.chip}
                {dirWord && <span className="sr-only"> {dirWord}</span>}
              </span>
              <span>{change.context === "vs" ? `vs ${compareLabel}` : `none in ${compareLabel}`}</span>
            </p>
          ) : <span />}
          {kpi.spark && <span className="hidden sm:block"><Sparkline values={kpi.spark} /></span>}
        </div>
      )}
    </>
  );

  const cls = "group flex h-full min-w-0 flex-col rounded-2xl border border-[var(--color-border)] bg-white p-4 sm:p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-[transform,border-color,box-shadow] duration-200 ease-out hover:-translate-y-px hover:border-[#D3DCDF] hover:shadow-[0_8px_24px_-12px_rgba(16,24,40,0.14)] motion-reduce:transition-none motion-reduce:hover:translate-y-0";
  return kpi.href ? (
    <Link href={kpi.href} className={`${cls} focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)] focus-visible:ring-offset-2`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Column count chosen from the card count so rows fill evenly instead of leaving one card stranded. */
function kpiCols(n: number) {
  if (n <= 2) return "sm:grid-cols-2";
  if (n === 3) return "sm:grid-cols-3";
  if (n === 4) return "sm:grid-cols-2 xl:grid-cols-4";
  if (n === 5) return "sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5";
  if (n === 6) return "sm:grid-cols-2 lg:grid-cols-3";
  if (n === 7 || n === 8) return "sm:grid-cols-2 lg:grid-cols-4";
  if (n === 9) return "sm:grid-cols-3";
  if (n === 10) return "sm:grid-cols-2 2xl:grid-cols-5";
  return "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
}

export function KpiGrid({ kpis, compareLabel }: { kpis: KpiValue[]; compareLabel: string }) {
  return (
    // Four or more tiles go two-up on phones: one per row made the Overview
    // eight screens of scrolling before the first chart.
    <div className={`grid ${kpis.length >= 4 ? "grid-cols-2" : "grid-cols-1"} gap-3 sm:gap-4 ${kpiCols(kpis.length)}`}>
      {kpis.map((k) => <KpiCard key={`${k.id}-${k.label ?? ""}`} kpi={k} compareLabel={compareLabel} />)}
    </div>
  );
}

/* ═══ Panels and section headings ══════════════════════════════════════════ */

export function Panel({ title, subtitle, icon: Icon, action, children, className = "" }: {
  title: string; subtitle?: string; icon?: LucideIcon; action?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={`min-w-0 break-inside-avoid rounded-2xl border border-[var(--color-border)] bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${className}`}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--color-primary-50)] text-[var(--color-primary-700)]" aria-hidden="true">
              <Icon size={15} strokeWidth={1.75} />
            </span>
          )}
          <div className="min-w-0">
            {/* Pinned to the app h4 token: the global [data-main-content] h3 rule would otherwise enlarge every card title. */}
            <h3 className="font-semibold tracking-[-0.01em] text-[var(--color-ink-900)]" style={{ fontSize: "var(--rf-fs-h4)", lineHeight: 1.3 }}>{title}</h3>
            {subtitle && <p className="mt-1 text-label leading-snug text-[var(--color-ink-400)]">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function SectionHeading({ title, subtitle, icon: Icon }: { title: string; subtitle?: string; icon?: LucideIcon }) {
  return (
    <div className="flex items-start gap-3 pt-3">
      {Icon && (
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] bg-white text-[var(--color-primary-700)]" aria-hidden="true">
          <Icon size={16} strokeWidth={1.75} />
        </span>
      )}
      <div>
        <h2 className="font-semibold tracking-[-0.015em] text-[var(--color-ink-900)]" style={{ fontSize: "var(--rf-fs-h3)", lineHeight: 1.3 }}>{title}</h2>
        {subtitle && <p className="mt-0.5 text-label text-[var(--color-ink-400)]">{subtitle}</p>}
      </div>
    </div>
  );
}

export function Grid2({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{children}</div>;
}

export function Grid3({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">{children}</div>;
}

/* ═══ Segmented period control (a shortcut onto the existing date-range filter) ═ */

const QUICK_RANGES = [{ id: "7d", label: "7 days" }, { id: "30d", label: "30 days" }, { id: "90d", label: "90 days" }];

export function RangeSwitch({ params, tab }: { params: Record<string, string | undefined>; tab: string }) {
  const current = params.range ?? "30d";
  return (
    <div role="group" aria-label="Quick date range" className="inline-flex rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-sunken)]/60 p-0.5">
      {QUICK_RANGES.map((r) => {
        const active = current === r.id;
        return (
          <Link
            key={r.id}
            href={`/analytics${buildQuery(params, { range: r.id === "30d" ? undefined : r.id, from: undefined, to: undefined, tab: tab === "overview" ? undefined : tab })}`}
            scroll={false}
            aria-current={active ? "true" : undefined}
            className={`rounded-lg px-3 py-1.5 text-caption font-semibold transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)] ${
              active ? "bg-[var(--color-primary-700)] text-white shadow-sm" : "text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)]"
            }`}
          >
            {r.label}
          </Link>
        );
      })}
    </div>
  );
}

/* ═══ Error state ══════════════════════════════════════════════════════════ */

export function SectionError({ message }: { message: string }) {
  const router = useRouter();
  return (
    <div role="alert" className="flex flex-col items-center gap-2 rounded-2xl border border-[#FECDCA] bg-[#FEF3F2]/60 px-6 py-12 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#B42318] shadow-sm"><AlertTriangle size={18} /></span>
      <p className="mt-1 text-body font-semibold text-[var(--color-ink-900)]">{message}</p>
      <p className="text-label text-[var(--color-ink-500)]">The rest of Analytics is unaffected.</p>
      <button
        type="button"
        onClick={() => router.refresh()}
        className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-[var(--color-border)] bg-white px-3.5 text-label font-semibold text-[var(--color-ink-700)] transition-colors hover:bg-[var(--color-surface-sunken)]"
      >
        <RefreshCw size={13} /> Retry
      </button>
    </div>
  );
}

/* ═══ Data table ═══════════════════════════════════════════════════════════ */

function compare(a: CellValue, b: CellValue) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a ?? "").localeCompare(String(b ?? ""), undefined, { numeric: true });
}

export function DataTable({
  table, pageSize = 10, searchable = true, exportable = true, print = false, footer,
}: { table: TableData; pageSize?: number; searchable?: boolean; exportable?: boolean; print?: boolean; footer?: ReactNode }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);

  const indexed = useMemo(() => table.rows.map((r, i) => ({ r, link: table.links?.[i] ?? null })), [table]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = q ? indexed.filter(({ r }) => Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(q))) : indexed;
    if (sort) rows = [...rows].sort((a, b) => compare(a.r[sort.key], b.r[sort.key]) * sort.dir);
    return rows;
  }, [indexed, query, sort]);

  const size = print ? 100 : pageSize;
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * size, current * size + size);
  const firstKey = table.columns[0]?.key;

  return (
    <div className="min-w-0">
      {!print && (searchable || exportable) && table.rows.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {searchable ? (
            <label className="relative flex-1 min-w-[180px] max-w-xs">
              <span className="sr-only">Search {table.title}</span>
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]" />
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(0); }}
                placeholder="Search"
                className="w-full rounded-lg border border-[var(--color-border)] bg-white py-1.5 pl-8 pr-3 text-label focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
              />
            </label>
          ) : <span />}
          {exportable && (
            <button
              type="button"
              onClick={() => downloadTableCsv(table)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-caption font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]"
            >
              <Download size={12} /> CSV
            </button>
          )}
        </div>
      )}

      {table.rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--color-border)] px-4 py-8 text-center text-label text-[var(--color-ink-400)]">
          No records for this period.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
          <table className="w-full text-label">
            <caption className="sr-only">{table.title}</caption>
            <thead className="bg-[#F7F9FA]">
              <tr>
                {table.columns.map((c) => {
                  const active = sort?.key === c.key;
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      aria-sort={active ? (sort!.dir === 1 ? "ascending" : "descending") : "none"}
                      className={`px-3.5 py-2.5 font-semibold text-caption text-[var(--color-ink-500)] whitespace-nowrap ${c.align === "right" ? "text-right" : "text-left"}`}
                    >
                      {print ? c.label : (
                        <button
                          type="button"
                          onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 1 ? -1 : 1 } : { key: c.key, dir: c.align === "right" ? -1 : 1 }))}
                          className={`inline-flex items-center gap-1 hover:text-[var(--color-ink-800)] ${c.align === "right" ? "flex-row-reverse" : ""}`}
                        >
                          {c.label}
                          <ArrowUpDown size={11} className={active ? "text-[var(--color-primary-600)]" : "opacity-40"} />
                        </button>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {visible.map(({ r, link }, i) => (
                <tr key={i} className="transition-colors hover:bg-[#F7F9FA]">
                  {table.columns.map((c) => {
                    const v = r[c.key];
                    const text = typeof v === "number" ? v.toLocaleString("en-IN") : (v ?? "—");
                    return (
                      <td key={c.key} className={`px-3.5 py-2.5 text-[var(--color-ink-700)] ${c.align === "right" ? "text-right tabular-nums" : ""} ${c.key === firstKey ? "font-medium text-[var(--color-ink-900)]" : ""}`}>
                        {link && c.key === firstKey && !print
                          ? <Link href={link} className="text-[var(--color-primary-700)] hover:underline">{text}</Link>
                          : text}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(table.note || pages > 1 || footer) && (
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-caption text-[var(--color-ink-400)]">
          <span>{table.note}</span>
          {footer ?? (pages > 1 && !print && (
            <nav aria-label={`${table.title} pages`} className="flex items-center gap-1">
              <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)} aria-label="Previous page" className="rounded-md border border-[var(--color-border)] bg-white p-1 disabled:opacity-40"><ChevronLeft size={14} /></button>
              <span className="px-2 tabular-nums">Page {current + 1} of {pages}</span>
              <button type="button" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} aria-label="Next page" className="rounded-md border border-[var(--color-border)] bg-white p-1 disabled:opacity-40"><ChevronRight size={14} /></button>
            </nav>
          ))}
        </div>
      )}
    </div>
  );
}
