"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownRight, ArrowUpRight, ArrowUpDown, ChevronLeft, ChevronRight, Download, Info, Minus, RefreshCw, Search, AlertTriangle } from "lucide-react";
import { METRICS, formatMetric, type KpiValue, type TableData, type CellValue } from "@/lib/analytics/definitions";
import { Sparkline } from "./charts";
import { downloadTableCsv } from "./export";

/* ═══ Info tooltip ═════════════════════════════════════════════════════════ */

export function InfoTip({ text, label }: { text: string; label: string }) {
  const id = useId();
  return (
    <span className="relative inline-flex group/tip">
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
        className="invisible opacity-0 group-hover/tip:visible group-hover/tip:opacity-100 group-focus-within/tip:visible group-focus-within/tip:opacity-100 transition-opacity absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-30 w-60 rounded-lg bg-[var(--color-ink-900)] px-3 py-2 text-[11.5px] font-normal normal-case tracking-normal leading-snug text-white shadow-lg"
      >
        {text}
      </span>
    </span>
  );
}

/* ═══ KPI card ═════════════════════════════════════════════════════════════ */

function changeText(k: KpiValue, compareLabel: string): { text: string; dir: "up" | "down" | "flat" } | null {
  const def = METRICS[k.id];
  if (k.prev === undefined || k.prev === null || k.value === null || k.display) return null;
  if (def.format === "percent") {
    const diff = Math.round((k.value - k.prev) * 10) / 10;
    if (diff === 0) return { text: `No change vs ${compareLabel}`, dir: "flat" };
    return { text: `${Math.abs(diff)} pts ${diff > 0 ? "higher" : "lower"} than ${compareLabel}`, dir: diff > 0 ? "up" : "down" };
  }
  if (k.prev === 0) {
    return k.value === 0 ? { text: `No change vs ${compareLabel}`, dir: "flat" } : { text: `None recorded in ${compareLabel}`, dir: "up" };
  }
  const ch = Math.round(((k.value - k.prev) / k.prev) * 1000) / 10;
  if (ch === 0) return { text: `No change vs ${compareLabel}`, dir: "flat" };
  return { text: `${Math.abs(ch)}% ${ch > 0 ? "increase" : "decrease"} vs ${compareLabel}`, dir: ch > 0 ? "up" : "down" };
}

export function KpiCard({ kpi, compareLabel }: { kpi: KpiValue; compareLabel: string }) {
  const def = METRICS[kpi.id];
  const label = kpi.label ?? def.label;
  const change = changeText(kpi, compareLabel);
  const Arrow = change?.dir === "up" ? ArrowUpRight : change?.dir === "down" ? ArrowDownRight : Minus;

  const body = (
    <>
      <div className="flex items-center gap-1.5">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-500)] truncate">{label}</p>
        <InfoTip text={def.tooltip} label={label} />
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className="text-[26px] sm:text-[28px] font-bold leading-none tracking-tight tabular-nums text-[var(--color-ink-900)]">
          {kpi.display ?? formatMetric(kpi.value, def.format)}
        </p>
        {kpi.spark && <Sparkline values={kpi.spark} />}
      </div>
      {kpi.sub && <p className="mt-1.5 text-[11.5px] text-[var(--color-ink-500)] truncate">{kpi.sub}</p>}
      {change && (
        <p className="mt-1.5 flex items-start gap-1 text-[11px] leading-snug text-[var(--color-ink-500)]">
          <Arrow size={12} className="mt-px shrink-0" aria-hidden="true" />
          <span>{change.text}</span>
        </p>
      )}
    </>
  );

  const cls = "block h-full rounded-xl border border-[var(--color-border)] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow] duration-200";
  return kpi.href ? (
    <Link href={kpi.href} className={`${cls} hover:border-[var(--color-primary-400)] hover:shadow-[0_4px_16px_rgba(21,122,115,0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)]`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function KpiGrid({ kpis, compareLabel }: { kpis: KpiValue[]; compareLabel: string }) {
  return (
    <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 min-[1800px]:grid-cols-5 gap-3">
      {kpis.map((k) => <KpiCard key={`${k.id}-${k.label ?? ""}`} kpi={k} compareLabel={compareLabel} />)}
    </div>
  );
}

/* ═══ Panels and section headings ══════════════════════════════════════════ */

export function Panel({ title, subtitle, action, children, className = "" }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-[var(--color-border)] bg-white p-4 sm:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] min-w-0 break-inside-avoid ${className}`}>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-[var(--color-ink-900)]">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[12px] text-[var(--color-ink-400)]">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="pt-2">
      <h2 className="text-[18px] font-semibold tracking-tight text-[var(--color-ink-900)]">{title}</h2>
      {subtitle && <p className="mt-0.5 text-[12.5px] text-[var(--color-ink-400)]">{subtitle}</p>}
    </div>
  );
}

export function Grid2({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">{children}</div>;
}

export function Grid3({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">{children}</div>;
}

/* ═══ Error state ══════════════════════════════════════════════════════════ */

export function SectionError({ message }: { message: string }) {
  const router = useRouter();
  return (
    <div role="alert" className="flex flex-col items-center gap-2 rounded-xl border border-red-200 bg-red-50/60 px-6 py-10 text-center">
      <AlertTriangle size={20} className="text-red-500" />
      <p className="text-[14px] font-semibold text-[var(--color-ink-900)]">{message}</p>
      <p className="text-[12.5px] text-[var(--color-ink-500)]">The rest of Analytics is unaffected.</p>
      <button
        type="button"
        onClick={() => router.refresh()}
        className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]"
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
                className="w-full rounded-lg border border-[var(--color-border)] bg-white py-1.5 pl-8 pr-3 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
              />
            </label>
          ) : <span />}
          {exportable && (
            <button
              type="button"
              onClick={() => downloadTableCsv(table)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-[12px] font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]"
            >
              <Download size={12} /> CSV
            </button>
          )}
        </div>
      )}

      {table.rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--color-border)] px-4 py-8 text-center text-[12.5px] text-[var(--color-ink-400)]">
          No records for this period.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full text-[12.5px]">
            <caption className="sr-only">{table.title}</caption>
            <thead className="bg-[var(--color-surface-sunken)]/70">
              <tr>
                {table.columns.map((c) => {
                  const active = sort?.key === c.key;
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      aria-sort={active ? (sort!.dir === 1 ? "ascending" : "descending") : "none"}
                      className={`px-3 py-2 font-semibold text-[11.5px] text-[var(--color-ink-500)] whitespace-nowrap ${c.align === "right" ? "text-right" : "text-left"}`}
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
                <tr key={i} className="hover:bg-[var(--color-surface-sunken)]/50">
                  {table.columns.map((c) => {
                    const v = r[c.key];
                    const text = typeof v === "number" ? v.toLocaleString("en-IN") : (v ?? "—");
                    return (
                      <td key={c.key} className={`px-3 py-2 text-[var(--color-ink-700)] ${c.align === "right" ? "text-right tabular-nums" : ""} ${c.key === firstKey ? "font-medium text-[var(--color-ink-900)]" : ""}`}>
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
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-[var(--color-ink-400)]">
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
