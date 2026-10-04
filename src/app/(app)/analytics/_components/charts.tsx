"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import type { Cat, SeriesDef, SeriesPoint } from "@/lib/analytics/definitions";

/* ═══ Measurement ══════════════════════════════════════════════════════════ */

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

function niceMax(v: number) {
  if (v <= 4) return 4;
  const mag = 10 ** Math.floor(Math.log10(v));
  const n = v / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * mag;
}

const fmt = (n: number) => n.toLocaleString("en-IN");

/** Monotone cubic path (Fritsch–Carlson): smooth, never overshoots below zero. */
function monotonePath(pts: { x: number; y: number }[]) {
  const n = pts.length;
  if (n === 0) return "";
  if (n < 3) return pts.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
  const dx: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1].x - pts[i].x);
    m.push((pts[i + 1].y - pts[i].y) / (dx[i] || 1));
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${pts[i].x + h},${pts[i].y + t[i] * h} ${pts[i + 1].x - h},${pts[i + 1].y - t[i + 1] * h} ${pts[i + 1].x},${pts[i + 1].y}`;
  }
  return d;
}

/* ═══ Empty state ══════════════════════════════════════════════════════════ */

export function ChartEmpty({ message = "No data for this period", height = 160 }: { message?: string; height?: number }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl bg-[#F7F9FA] px-6 text-center" style={{ minHeight: height }}>
      <span className="mb-1 flex h-9 w-9 items-center justify-center rounded-full bg-white text-[var(--color-ink-400)] shadow-[0_1px_2px_rgba(16,24,40,0.06)]" aria-hidden="true">
        <BarChart3 size={16} strokeWidth={1.75} />
      </span>
      <p className="text-label font-semibold text-[var(--color-ink-700)]">{message}</p>
      <p className="max-w-[260px] text-caption leading-snug text-[var(--color-ink-400)]">Nothing was recorded for the selected filters. Try a wider date range or another hospital.</p>
    </div>
  );
}

/* ═══ Trend chart ══════════════════════════════════════════════════════════ */

export function TrendChart({
  points, series, height = 240, title,
}: { points: SeriesPoint[]; series: SeriesDef[]; height?: number; title: string }) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<number | null>(null);
  const gradId = useId().replace(/:/g, "");

  const visible = series.filter((s) => !hidden.has(s.key));
  const hasData = points.some((p) => series.some((s) => (p.values[s.key] ?? 0) > 0));
  const max = niceMax(Math.max(1, ...points.flatMap((p) => visible.map((s) => p.values[s.key] ?? 0))));

  const pad = { top: 12, right: 12, bottom: 28, left: 36 };
  const cw = Math.max(0, width - pad.left - pad.right);
  const ch = height - pad.top - pad.bottom;
  const xOf = (i: number) => pad.left + (points.length <= 1 ? cw / 2 : (i / (points.length - 1)) * cw);
  const yOf = (v: number) => pad.top + ch - (v / max) * ch;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((r) => Math.round(r * max));
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(cw / 72))));

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - pad.left;
    const i = points.length <= 1 ? 0 : Math.round((x / cw) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  }

  return (
    <figure className="m-0">
      <div className="mb-3 flex flex-wrap items-center gap-x-1 gap-y-1.5" role="group" aria-label={`${title} series`}>
        {series.map((s) => {
          const off = hidden.has(s.key);
          return (
            <button
              key={s.key}
              type="button"
              aria-pressed={!off}
              onClick={() => setHidden((h) => { const n = new Set(h); if (n.has(s.key)) n.delete(s.key); else n.add(s.key); return n; })}
              title={off ? `Show ${s.label}` : `Hide ${s.label}`}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-medium transition-[opacity,background-color] duration-150 hover:bg-[#F2F5F6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)] ${off ? "opacity-40" : ""}`}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              <span className="text-[var(--color-ink-700)]">{s.label}</span>
            </button>
          );
        })}
      </div>

      <div ref={ref} className="relative w-full" style={{ height }}>
        {!hasData ? (
          <ChartEmpty height={height} />
        ) : width > 0 && (
          <>
            <svg width={width} height={height} onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label={`${title} chart`} className="block touch-pan-y">
              <defs>
                {visible.map((s) => (
                  <linearGradient key={s.key} id={`${gradId}-${s.key}`} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={s.color} stopOpacity={0.12} />
                    <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={pad.left} x2={pad.left + cw} y1={yOf(t)} y2={yOf(t)} stroke={t === 0 ? "#DCE2E5" : "#EEF1F3"} />
                  <text x={pad.left - 10} y={yOf(t) + 3.5} textAnchor="end" fontSize="11" fill="var(--color-ink-400)">{fmt(t)}</text>
                </g>
              ))}
              {points.map((p, i) => ((i % labelEvery === 0 && points.length - 1 - i >= labelEvery * 0.6) || i === points.length - 1) && (
                <text key={p.key} x={xOf(i)} y={height - 8} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"} fontSize="11" fill="var(--color-ink-400)">{p.label}</text>
              ))}
              {visible.map((s, si) => {
                const pts = points.map((p, i) => ({ x: xOf(i), y: yOf(p.values[s.key] ?? 0) }));
                const line = monotonePath(pts);
                return (
                  <g key={s.key}>
                    {si === 0 && pts.length > 1 && (
                      <path d={`${line} L${pts[pts.length - 1].x},${yOf(0)} L${pts[0].x},${yOf(0)} Z`} fill={`url(#${gradId}-${s.key})`} />
                    )}
                    <path d={line} fill="none" stroke={s.color} strokeWidth={si === 0 ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round" />
                    {points.length === 1 && <circle cx={pts[0].x} cy={pts[0].y} r={3.5} fill={s.color} />}
                  </g>
                );
              })}
              {hover !== null && (
                <g pointerEvents="none">
                  <line x1={xOf(hover)} x2={xOf(hover)} y1={pad.top} y2={pad.top + ch} stroke="#CBD4D8" />
                  {visible.map((s) => (
                    <circle key={s.key} cx={xOf(hover)} cy={yOf(points[hover].values[s.key] ?? 0)} r={3.5} fill="#fff" stroke={s.color} strokeWidth={2} />
                  ))}
                </g>
              )}
            </svg>
            {hover !== null && (
              <div
                className="pointer-events-none absolute top-1 z-10 min-w-[170px] rounded-xl border border-[var(--color-border)] bg-white px-3.5 py-3 shadow-[0_12px_32px_-12px_rgba(16,24,40,0.22)] animate-[fadeIn_150ms_ease-out]"
                style={xOf(hover) > width / 2 ? { right: width - xOf(hover) + 14 } : { left: xOf(hover) + 14 }}
              >
                <p className="mb-2 text-caption font-semibold text-[var(--color-ink-900)]">{points[hover].label}</p>
                <div className="flex flex-col gap-1.5">
                  {visible.map((s) => (
                    <p key={s.key} className="flex items-center justify-between gap-5 text-caption text-[var(--color-ink-500)]">
                      <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.label}</span>
                      <span className="font-semibold tabular-nums text-[var(--color-ink-900)]">{fmt(points[hover].values[s.key] ?? 0)}</span>
                    </p>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <table className="sr-only">
        <caption>{title}</caption>
        <thead><tr><th>Period</th>{series.map((s) => <th key={s.key}>{s.label}</th>)}</tr></thead>
        <tbody>{points.map((p) => <tr key={p.key}><td>{p.label}</td>{series.map((s) => <td key={s.key}>{p.values[s.key] ?? 0}</td>)}</tr>)}</tbody>
      </table>
    </figure>
  );
}

/* ═══ Column chart (weekday / hour distributions) ══════════════════════════ */

export function ColumnChart({ data, color = "var(--color-primary-600)", height = 180, title }: { data: Cat[]; color?: string; height?: number; title: string }) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <ChartEmpty height={height} />;

  const max = niceMax(Math.max(...data.map((d) => d.value)));
  const pad = { top: 18, bottom: 24, left: 4, right: 4 };
  const ch = height - pad.top - pad.bottom;
  const slot = width > 0 ? (width - pad.left - pad.right) / data.length : 0;
  const bw = Math.max(4, Math.min(36, slot * 0.62));
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(width / 44))));

  return (
    <figure className="m-0">
      <div ref={ref} className="w-full" style={{ height }}>
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={`${title} chart`} className="block">
            <line x1={pad.left} x2={width - pad.right} y1={pad.top + ch} y2={pad.top + ch} stroke="var(--color-border)" />
            {data.map((d, i) => {
              const h = (d.value / max) * ch;
              const x = pad.left + slot * i + (slot - bw) / 2;
              const active = hover === i;
              return (
                <g key={d.label} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
                  <rect x={pad.left + slot * i} y={pad.top} width={slot} height={ch} fill="transparent" />
                  <rect x={x} y={pad.top + ch - h} width={bw} height={Math.max(h, d.value > 0 ? 2 : 0)} rx={Math.min(4, bw / 3)} fill={d.color ?? color} opacity={hover === null || active ? 1 : 0.45} />
                  {(active || (data.length <= 12 && d.value > 0)) && (
                    <text x={x + bw / 2} y={pad.top + ch - h - 5} textAnchor="middle" fontSize="10.5" fontWeight={600} fill="var(--color-ink-700)">{fmt(d.value)}</text>
                  )}
                  {(i % labelEvery === 0) && (
                    <text x={x + bw / 2} y={height - 7} textAnchor="middle" fontSize="10.5" fill="var(--color-ink-400)">{d.label}</text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>{data.map((d) => <tr key={d.label}><th>{d.label}</th><td>{d.value}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

/* ═══ Horizontal bar list (categories, comparisons) ════════════════════════ */

export function BarList({ data, color = "var(--color-primary-600)", limit, showShare = true }: { data: Cat[]; color?: string; limit?: number; showShare?: boolean }) {
  const rows = limit ? data.slice(0, limit) : data;
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <ChartEmpty height={120} />;
  const max = Math.max(...rows.map((d) => d.value), 1);

  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((d) => {
        const inner = (
          <>
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <span className="min-w-0 truncate text-label text-[var(--color-ink-700)]" title={d.label}>{d.label}</span>
              <span className="shrink-0 text-caption tabular-nums">
                <span className="font-semibold text-[var(--color-ink-900)]">{fmt(d.value)}</span>
                {showShare && <span className="text-[var(--color-ink-400)] ml-1.5">{Math.round((d.value / total) * 100)}%</span>}
              </span>
            </div>
            <div className="h-2 rounded-full bg-[#EEF1F3] overflow-hidden">
              <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${(d.value / max) * 100}%`, background: d.color ?? color }} />
            </div>
          </>
        );
        return (
          <li key={d.label}>
            {d.href
              ? <Link href={d.href} className="block rounded-md -mx-1 px-1 py-0.5 hover:bg-[var(--color-surface-sunken)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)]">{inner}</Link>
              : inner}
          </li>
        );
      })}
    </ul>
  );
}

/* ═══ Donut ════════════════════════════════════════════════════════════════ */

function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  // Rounded: trig results differ in the last digits between Node and the browser, which breaks hydration.
  const p = (a: number) => [Math.round((cx + r * Math.cos(a - Math.PI / 2)) * 100) / 100, Math.round((cy + r * Math.sin(a - Math.PI / 2)) * 100) / 100];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  return `M${x0},${y0} A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1},${y1}`;
}

export function Donut({ data, centerLabel = "Total", title }: { data: Cat[]; centerLabel?: string; title: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <ChartEmpty height={150} />;

  const size = 150, r = 58, sw = 18;
  const gap = data.filter((d) => d.value > 0).length > 1 ? 0.025 : 0;
  const shown = hover !== null ? data[hover] : null;
  const starts = data.map((_, i) => data.slice(0, i).reduce((sum, d) => sum + d.value, 0));

  return (
    <div className="flex flex-col sm:flex-row items-center gap-5">
      <svg width={size} height={size} role="img" aria-label={`${title}: ${data.map((d) => `${d.label} ${d.value}`).join(", ")}`} className="shrink-0">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-surface-sunken)" strokeWidth={sw} />
        {data.map((d, i) => {
          const a0 = (starts[i] / total) * Math.PI * 2;
          const a1 = ((starts[i] + d.value) / total) * Math.PI * 2;
          if (d.value === 0) return null;
          const full = a1 - a0 >= Math.PI * 2 - 1e-6;
          return full ? (
            <circle key={d.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.color} strokeWidth={sw} />
          ) : (
            <path
              key={d.label}
              d={arc(size / 2, size / 2, r, a0 + gap, Math.max(a0 + gap, a1 - gap))}
              fill="none"
              stroke={d.color}
              strokeWidth={hover === i ? sw + 4 : sw}
              strokeLinecap="butt"
              opacity={hover === null || hover === i ? 1 : 0.4}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              className="transition-all duration-150"
            />
          );
        })}
        <text x={size / 2} y={size / 2 - 2} textAnchor="middle" fontSize="20" fontWeight={700} fill="var(--color-ink-900)">{fmt(shown ? shown.value : total)}</text>
        <text x={size / 2} y={size / 2 + 15} textAnchor="middle" fontSize="10.5" fill="var(--color-ink-400)">{shown ? `${Math.round((shown.value / total) * 100)}%` : centerLabel}</text>
      </svg>
      <ul className="flex-1 w-full flex flex-col gap-1.5 min-w-0">
        {data.map((d, i) => (
          <li
            key={d.label}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
            className={`flex items-center justify-between gap-3 rounded-md px-1.5 py-1 text-label ${hover === i ? "bg-[var(--color-surface-sunken)]" : ""}`}
          >
            <span className="inline-flex items-center gap-2 min-w-0">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: d.color }} />
              <span className="truncate text-[var(--color-ink-700)]">{d.label}</span>
            </span>
            <span className="shrink-0 tabular-nums">
              <span className="font-semibold text-[var(--color-ink-900)]">{fmt(d.value)}</span>
              <span className="ml-1.5 text-[var(--color-ink-400)]">{Math.round((d.value / total) * 100)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ═══ Sparkline ════════════════════════════════════════════════════════════ */

/** Sums a long daily series into at most `max` bins so the trend reads cleanly at sparkline size. */
function binned(values: number[], max = 15) {
  if (values.length <= max) return values;
  const size = values.length / max;
  return Array.from({ length: max }, (_, i) => values.slice(Math.floor(i * size), Math.floor((i + 1) * size)).reduce((a, b) => a + b, 0));
}

export function Sparkline({ values, color = "var(--color-primary-600)" }: { values: number[]; color?: string }) {
  const gradId = useId().replace(/:/g, "");
  const w = 84, h = 30;
  const series = binned(values);
  if (series.length < 2 || series.every((v) => v === 0)) return null;
  const max = Math.max(...series, 1);
  const pts = series.map((v, i) => ({ x: (i / (series.length - 1)) * w, y: h - 3 - (v / max) * (h - 6) }));
  const line = monotonePath(pts);
  return (
    <svg width={w} height={h} aria-hidden="true" className="shrink-0 overflow-visible">
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.16} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#${gradId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={2.25} fill="#fff" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}

/* ═══ Heatmap (weekday × hour) ═════════════════════════════════════════════ */

export function Heatmap({ days, hours, values, title }: { days: string[]; hours: string[]; values: number[][]; title: string }) {
  const max = Math.max(1, ...values.flat());
  const total = values.flat().reduce((s, v) => s + v, 0);
  if (total === 0) return <ChartEmpty height={180} />;
  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-[3px] text-caption" aria-label={title}>
        <thead>
          <tr>
            <th className="w-10" />
            {hours.map((h) => <th key={h} scope="col" className="font-medium text-[var(--color-ink-400)] whitespace-nowrap px-0.5">{h.replace(" ", "")}</th>)}
          </tr>
        </thead>
        <tbody>
          {days.map((d, di) => (
            <tr key={d}>
              <th scope="row" className="pr-1.5 text-left font-medium text-[var(--color-ink-500)]">{d}</th>
              {values[di].map((v, hi) => (
                <td
                  key={hi}
                  title={`${d} ${hours[hi]}: ${v} appointment${v === 1 ? "" : "s"}`}
                  className="h-7 min-w-[28px] rounded-[5px] text-center tabular-nums"
                  style={{
                    background: v === 0 ? "var(--color-surface-sunken)" : `rgba(21, 122, 115, ${0.12 + (v / max) * 0.78})`,
                    color: v / max > 0.55 ? "#fff" : "var(--color-ink-700)",
                  }}
                >
                  {v || ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ═══ Pipeline (stage → stage) ═════════════════════════════════════════════ */

export function Pipeline({ steps }: { steps: Cat[] }) {
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <ol className="grid gap-2 sm:grid-cols-5">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].value : null;
        return (
          <li key={s.label} className="relative rounded-xl border border-[var(--color-border)] bg-white p-3">
            <p className="text-caption font-semibold uppercase tracking-wide text-[var(--color-ink-500)]">{s.label}</p>
            <p className="mt-1 text-heading-lg font-bold tabular-nums text-[var(--color-ink-900)] leading-none">{fmt(s.value)}</p>
            <div className="mt-2.5 h-1.5 rounded-full bg-[var(--color-surface-sunken)] overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${(s.value / max) * 100}%`, background: s.color }} />
            </div>
            <p className="mt-1.5 text-caption text-[var(--color-ink-400)]">
              {prev === null ? "Starting stage" : prev > 0 ? `${Math.round((s.value / prev) * 100)}% of previous stage` : "—"}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
