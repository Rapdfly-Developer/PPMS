"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import {
  AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, CheckCircle2, ChevronDown, ChevronRight, Clock, HeartPulse,
  IndianRupee, Lightbulb, Lock, Minus, Printer, Scissors, Stethoscope, Users, X, type LucideIcon,
} from "lucide-react";
import { buildQuery } from "@/lib/analytics/filters";
import { cardMeta, type AttentionItem, type CardId, type CardSummary, type DrillData, type JourneyStep, type OutcomeRow, type Tile } from "@/lib/analytics/cards";
import type { Cat } from "@/lib/analytics/definitions";
import { Sparkline } from "./charts";
import { DataTable } from "./ui";

export const CARD_ICON: Record<CardId, LucideIcon> = {
  clinical: Stethoscope,
  surgery: Scissors,
  social: Users,
  financial: IndianRupee,
  pulse: HeartPulse,
};

type Params = Record<string, string | undefined>;
const cardHref = (params: Params, card?: CardId) => `/analytics${buildQuery(params, { card })}`;

/* ═══ The five cards: always on top ════════════════════════════════════════ */

export function CardLanding({ cards, params, active = null }: { cards: CardSummary[]; params: Params; active?: CardId | null }) {
  return (
    <div className={`grid gap-3 ${active ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-5" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"}`}>
      {cards.map((c) => <LandingCard key={c.id} summary={c} href={cardHref(params, c.id)} compact={!!active} active={active === c.id} dimmed={!!active && active !== c.id} />)}
    </div>
  );
}

/** A soft trend line that runs the full width of a card's bottom edge. */
function CardWave({ values, height }: { values: number[]; height: number }) {
  const gradId = useId().replace(/:/g, "");
  // Group into at most 16 points so the line stays smooth
  const size = Math.max(1, Math.ceil(values.length / 16));
  const pts: number[] = [];
  for (let i = 0; i < values.length; i += size) pts.push(values.slice(i, i + size).reduce((a, b) => a + b, 0));
  if (pts.length < 2 || pts.every((v) => v === 0)) return null;
  const max = Math.max(...pts, 1);
  const w = 100;
  const xy = pts.map((v, i) => [(i / (pts.length - 1)) * w, height - 2 - (v / max) * (height - 8)] as const);
  // Smooth curve through the points
  let line = `M${xy[0][0]},${xy[0][1]}`;
  for (let i = 1; i < xy.length; i++) {
    const [x0, y0] = xy[i - 1];
    const [x1, y1] = xy[i];
    const mx = (x0 + x1) / 2;
    line += ` C${mx},${y0} ${mx},${y1} ${x1},${y1}`;
  }
  return (
    <svg aria-hidden="true" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 bottom-0 w-full" style={{ height }}>
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity={0.28} />
          <stop offset="100%" stopColor="#fff" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${height} L0,${height} Z`} fill={`url(#${gradId})`} />
      <path d={line} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={1.4} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
    </svg>
  );
}

function LandingCard({ summary: s, href, compact, active, dimmed }: { summary: CardSummary; href: string; compact: boolean; active: boolean; dimmed: boolean }) {
  const m = cardMeta(s.id);
  const Icon = CARD_ICON[s.id];
  const soon = s.id === "surgery";
  const Arrow = s.changePct === null ? null : s.changePct > 0 ? ArrowUpRight : s.changePct < 0 ? ArrowDownRight : Minus;
  const chip = s.locked ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-micro font-semibold"><Lock size={10} /> No access</span>
  ) : soon ? (
    <span className="rounded-full bg-white/20 px-2 py-0.5 text-micro font-semibold uppercase tracking-wide">Soon</span>
  ) : Arrow && s.changePct !== null ? (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-white/20 px-1.5 py-0.5 text-caption font-semibold tabular-nums backdrop-blur-sm">
      <Arrow size={12} strokeWidth={2.4} aria-hidden="true" />{Math.abs(s.changePct)}%
    </span>
  ) : null;

  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={`group relative isolate flex flex-col overflow-hidden rounded-2xl text-white transition-[transform,box-shadow,opacity] duration-200 ease-out hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary-500)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${
        compact ? "p-3.5" : "min-h-[148px] p-4"
      } ${
        active ? "shadow-[0_14px_30px_-14px_rgba(16,24,40,0.6)] ring-2 ring-[var(--color-ink-900)]/70 ring-offset-2"
          : dimmed ? "opacity-60 shadow-[0_6px_16px_-10px_rgba(16,24,40,0.4)] hover:opacity-100"
          : "shadow-[0_10px_26px_-14px_rgba(16,24,40,0.5)] hover:shadow-[0_18px_36px_-16px_rgba(16,24,40,0.55)]"
      }`}
      style={{ background: `linear-gradient(135deg, ${m.from} 0%, ${m.to} 100%)` }}
    >
      {/* Depth: a soft highlight, a fine dot texture, and the trend along the bottom */}
      <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-14 -z-10 h-36 w-36 rounded-full bg-white/[0.12] blur-[2px]" />
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 opacity-[0.08]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)", backgroundSize: "14px 14px" }} />
      {!s.locked && !compact && <CardWave values={s.spark} height={54} />}

      <div className="relative flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className={`flex shrink-0 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm ${compact ? "h-7 w-7" : "h-8 w-8"}`} aria-hidden="true"><Icon size={compact ? 14 : 16} strokeWidth={2} /></span>
          <span className="truncate text-label font-semibold tracking-[0.01em]">{m.label}</span>
        </span>
        {chip}
      </div>

      <p className={`relative font-bold leading-none tracking-[-0.02em] tabular-nums ${compact ? "mt-2 text-[22px]" : "mt-3 text-[28px]"}`}>
        {s.locked ? "Locked" : s.headline}
        {!compact && !s.locked && <span className="ml-1.5 align-middle text-caption font-medium tracking-normal text-white/80">{s.headlineLabel}</span>}
      </p>
      {compact
        ? <p className="relative mt-1 truncate text-caption text-white/80">{s.locked ? "No access" : s.headlineLabel}</p>
        : (
          <div className="relative mt-auto flex items-end justify-between gap-2 pt-3">
            <p className="min-w-0 text-caption leading-snug text-white/90">{s.locked ? "Your role cannot view clinical records." : s.line}</p>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20 transition-colors group-hover:bg-white group-hover:text-[var(--color-ink-900)]" aria-hidden="true">
              <ArrowRight size={13} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </span>
          </div>
        )}
    </Link>
  );
}

/* ═══ Title bar of the open dashboard ══════════════════════════════════════ */

export function DashHeader({ card, params, canPrint, print }: { card: CardId; params: Params; canPrint: boolean; print?: boolean }) {
  const m = cardMeta(card);
  const Icon = CARD_ICON[card];
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: `linear-gradient(140deg, ${m.from}, ${m.to})` }} aria-hidden="true"><Icon size={18} /></span>
        <div className="min-w-0">
          <h2 className="font-semibold tracking-[-0.015em] text-[var(--color-ink-900)]" style={{ fontSize: "var(--rf-fs-h3)", lineHeight: 1.25 }}>{m.label}</h2>
          <p className="text-label text-[var(--color-ink-500)]">{m.tagline}</p>
        </div>
      </div>
      {!print && (
        <div className="flex items-center gap-2">
          {canPrint && card !== "surgery" && (
            <a
              href={`/analytics/report${buildQuery(params, { card })}`}
              target="_blank"
              rel="noopener"
              className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-[var(--color-border)] bg-white px-3 text-label font-medium text-[var(--color-ink-700)] transition-colors hover:border-[#CBD4D8] hover:bg-[#F7F9FA]"
            >
              <Printer size={13} /> One-page summary
            </a>
          )}
          <Link href={cardHref(params)} scroll={false} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-[var(--color-border)] bg-white px-3 text-label font-medium text-[var(--color-ink-700)] transition-colors hover:border-[#CBD4D8] hover:bg-[#F7F9FA]">
            <X size={13} /> Close
          </Link>
        </div>
      )}
    </div>
  );
}

/* ═══ Needs attention ══════════════════════════════════════════════════════ */

const SEVERITY: Record<AttentionItem["severity"], { dot: string; text: string; label: string }> = {
  high:   { dot: "bg-[#D92D20]", text: "text-[#B42318]", label: "Act now" },
  medium: { dot: "bg-[#DC6803]", text: "text-[#B54708]", label: "This week" },
  low:    { dot: "bg-[#1570EF]", text: "text-[#175CD3]", label: "Good to know" },
};
const ATTENTION_SHOWN = 3;

export function AttentionStrip({ items, print }: { items: AttentionItem[]; print?: boolean }) {
  const [all, setAll] = useState(false);
  const shown = print || all ? items : items.slice(0, ATTENTION_SHOWN);
  return (
    <section aria-label="Needs attention" className="flex h-full break-inside-avoid flex-col rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FEF3F2] text-[#D92D20]" aria-hidden="true"><Bell size={14} /></span>
        <h3 className="font-semibold tracking-[-0.01em] text-[var(--color-ink-900)]" style={{ fontSize: "var(--rf-fs-h4)", lineHeight: 1.3 }}>Needs attention</h3>
        {items.length > 0 && <span className="rounded-full bg-[#FEF3F2] px-1.5 py-0.5 text-micro font-bold tabular-nums text-[#B42318]">{items.length}</span>}
      </div>
      {items.length === 0 ? (
        <p className="flex items-center gap-2 rounded-xl bg-[#ECFDF3] px-3 py-2.5 text-label font-medium text-[#067647]">
          <CheckCircle2 size={15} /> Nothing needs your attention in this period.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--color-border)]">
          {shown.map((it) => {
            const sev = SEVERITY[it.severity];
            const body = (
              <>
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${sev.dot}`} aria-hidden="true" />
                <span className="min-w-0 flex-1 text-label leading-snug text-[var(--color-ink-800)]" title={it.detail}>{it.text}</span>
                <span className={`shrink-0 text-micro font-semibold uppercase tracking-wide ${sev.text}`}>{sev.label}</span>
                {it.href && !print && <ChevronRight size={14} className="mt-0.5 shrink-0 text-[var(--color-ink-300)]" aria-hidden="true" />}
              </>
            );
            return (
              <li key={it.text}>
                {it.href && !print
                  ? <Link href={it.href} scroll={false} className="-mx-1.5 flex items-start gap-2.5 rounded-lg px-1.5 py-2 hover:bg-[var(--color-surface-sunken)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)]">{body}</Link>
                  : <div className="flex items-start gap-2.5 py-2">{body}</div>}
              </li>
            );
          })}
        </ul>
      )}
      {!print && items.length > ATTENTION_SHOWN && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-1.5 inline-flex items-center gap-1 self-start text-caption font-semibold text-[var(--color-primary-700)] hover:underline">
          {all ? "Show fewer" : `Show ${items.length - ATTENTION_SHOWN} more`} <ChevronDown size={12} className={all ? "rotate-180" : ""} />
        </button>
      )}
    </section>
  );
}

/* ═══ The story: headline sentence, then the rest as a timeline ═══════════ */

/** Text with [[highlighted]] parts, shown in the card's colour. */
function Rich({ text, color }: { text: string; color: string }) {
  const parts = text.split(/\[\[|\]\]/);
  return <>{parts.map((part, i) => (i % 2 === 1 ? <span key={i} className="font-bold" style={{ color }}>{part}</span> : <span key={i}>{part}</span>))}</>;
}

/** The single most important sentence of the card, large, at the top. */
export function StoryHero({ text, card }: { text: string; card: CardId }) {
  const m = cardMeta(card);
  return (
    <section aria-label="Headline" className="relative isolate overflow-hidden rounded-2xl border px-5 py-4" style={{ background: `linear-gradient(100deg, ${m.tint} 0%, #fff 78%)`, borderColor: `${m.from}26` }}>
      <span aria-hidden="true" className="pointer-events-none absolute -left-2 -top-6 -z-10 select-none text-[120px] font-bold leading-none opacity-[0.08]" style={{ color: m.from }}>&ldquo;</span>
      <p className="text-micro font-bold uppercase tracking-[0.14em]" style={{ color: m.ink }}>The short version</p>
      <p className="mt-1 max-w-4xl text-[19px] font-semibold leading-snug tracking-[-0.01em] text-[var(--color-ink-900)] sm:text-[21px]">{text}</p>
    </section>
  );
}

export function Takeaways({ items, card }: { items: string[]; card: CardId }) {
  const m = cardMeta(card);
  if (items.length === 0) return null;
  return (
    <section aria-label="The story so far" className="h-full break-inside-avoid rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: m.tint, color: m.ink }} aria-hidden="true"><Lightbulb size={14} /></span>
        <h3 className="font-semibold tracking-[-0.01em] text-[var(--color-ink-900)]" style={{ fontSize: "var(--rf-fs-h4)", lineHeight: 1.3 }}>The story so far</h3>
      </div>
      {/* A line runs down through the points, like a timeline */}
      <ol className="relative ml-2 flex flex-col gap-3 border-l-2 pl-5" style={{ borderColor: `${m.from}33` }}>
        {items.map((t, i) => (
          <li key={t} className="relative text-label leading-snug text-[var(--color-ink-800)]">
            <span aria-hidden="true" className="absolute -left-[30px] top-0 flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] font-bold text-white ring-4 ring-white" style={{ background: m.from }}>{i + 1}</span>
            {t}
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ═══ A chapter's opening: one clear sentence and the numbers behind it ════ */

export interface Lead {
  /** The finding in one sentence. Wrap the key figures in [[double brackets]]. */
  headline: string;
  facts?: { value: string; label: string }[];
  /** What to do about it, or how to read it. */
  note?: string;
}

export function StoryLead({ lead, card, kicker }: { lead: Lead; card: CardId; kicker: string }) {
  const m = cardMeta(card);
  return (
    <div className="grid grid-cols-1 items-center gap-x-8 gap-y-4 rounded-2xl p-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]" style={{ background: m.tint }}>
      <div className="min-w-0 border-l-[3px] pl-4" style={{ borderColor: m.from }}>
        <p className="text-micro font-bold uppercase tracking-[0.12em]" style={{ color: m.ink }}>{kicker}</p>
        <p className="mt-1 text-[18px] font-semibold leading-snug tracking-[-0.01em] text-[var(--color-ink-900)] sm:text-[20px]"><Rich text={lead.headline} color={m.ink} /></p>
        {lead.note && <p className="mt-1.5 text-label leading-snug text-[var(--color-ink-600)]">{lead.note}</p>}
      </div>
      {lead.facts && lead.facts.length > 0 && (
        <dl className="grid divide-x divide-[rgba(16,24,40,0.08)] rounded-xl bg-white/80 py-2.5" style={{ gridTemplateColumns: `repeat(${lead.facts.length}, minmax(0, 1fr))` }}>
          {lead.facts.map((fact) => (
            <div key={fact.label} className="min-w-0 px-3 text-center">
              <dd className="truncate text-[22px] font-bold leading-none tracking-[-0.02em] tabular-nums" style={{ color: m.ink }} title={fact.value}>{fact.value}</dd>
              <dt className="mt-1 text-caption leading-tight text-[var(--color-ink-500)]">{fact.label}</dt>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/* ═══ Squares: 100 squares, each one percent ═══════════════════════════════ */

export function Squares({ data, unit }: { data: Cat[]; unit: string }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return <p className="rounded-xl bg-[#F7F9FA] px-4 py-8 text-center text-label text-[var(--color-ink-400)]">No data for this period</p>;
  // Share out exactly 100 squares; leftovers go to the largest remainders
  const exact = data.map((d) => (d.value / total) * 100);
  const cells = exact.map(Math.floor);
  let left = 100 - cells.reduce((a, b) => a + b, 0);
  for (const i of exact.map((v, idx) => [v - Math.floor(v), idx] as const).sort((x, y) => y[0] - x[0]).map(([, idx]) => idx)) {
    if (left <= 0) break;
    cells[i]++;
    left--;
  }
  const colors = cells.flatMap((n, i) => Array.from({ length: n }, () => data[i].color ?? "#94A3B8"));
  return (
    <div className="flex flex-col gap-3">
      <div className="grid w-full max-w-[420px] grid-cols-[repeat(20,minmax(0,1fr))] gap-[3px]" role="img" aria-label={data.map((d) => `${d.label}: ${d.value}`).join(", ")}>
        {colors.map((color, i) => <span key={i} className="aspect-square rounded-[3px]" style={{ background: color }} />)}
      </div>
      <ul className="flex flex-col gap-1.5">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2 text-label">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: d.color ?? "#94A3B8" }} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-[var(--color-ink-700)]">{d.label}</span>
            <span className="shrink-0 font-semibold tabular-nums text-[var(--color-ink-900)]">{d.value.toLocaleString("en-IN")}</span>
            <span className="w-10 shrink-0 text-right tabular-nums text-[var(--color-ink-400)]">{cells[i]}%</span>
          </li>
        ))}
      </ul>
      <p className="text-caption text-[var(--color-ink-400)]">Each square is 1% of {unit}.</p>
    </div>
  );
}

/* ═══ Headline tiles ═══════════════════════════════════════════════════════ */

const BAND_TONE = {
  typical: "text-[#067647] bg-[#ECFDF3]",
  above: "text-[#175CD3] bg-[#EFF8FF]",
  below: "text-[#B54708] bg-[#FFFAEB]",
};

export function TileGrid({ tiles, card }: { tiles: Tile[]; card: CardId }) {
  const m = cardMeta(card);
  const cols = tiles.length >= 6 ? "sm:grid-cols-3 xl:grid-cols-6" : tiles.length === 5 ? "sm:grid-cols-3 xl:grid-cols-5" : "sm:grid-cols-2 xl:grid-cols-4";
  return (
    <div className={`grid grid-cols-2 gap-3 ${cols}`}>
      {tiles.map((t) => {
        const good = t.changePct === null || t.changePct === undefined || t.changePct === 0 ? null : (t.changePct > 0) === (t.upIsGood ?? true);
        const Arrow = !t.changePct ? Minus : t.changePct > 0 ? ArrowUpRight : ArrowDownRight;
        return (
          <div key={t.label} className="flex min-w-0 flex-col rounded-2xl border border-[var(--color-border)] bg-white p-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <p className="break-words text-caption font-semibold text-[var(--color-ink-500)]">{t.label}</p>
            <div className="mt-1.5 flex items-end justify-between gap-2">
              <p className="text-[22px] font-bold leading-none tracking-[-0.02em] tabular-nums text-[var(--color-ink-900)]">{t.value}</p>
              {t.spark && t.spark.some((v) => v > 0) && <span className="hidden sm:block"><Sparkline values={t.spark} color={m.from} /></span>}
            </div>
            {t.hint && <p className="mt-1.5 break-words text-caption text-[var(--color-ink-500)]">{t.hint}</p>}
            {(t.changePct !== null && t.changePct !== undefined) && (
              <p className="mt-2 flex items-center gap-1.5 text-caption text-[var(--color-ink-400)]">
                <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold tabular-nums ${
                  good === null ? "bg-[var(--color-surface-sunken)] text-[var(--color-ink-600)]" : good ? "bg-[#ECFDF3] text-[#067647]" : "bg-[#FEF3F2] text-[#B42318]"
                }`}>
                  <Arrow size={11} strokeWidth={2.4} aria-hidden="true" />{Math.abs(t.changePct)}%
                </span>
                vs before
              </p>
            )}
            {t.band && (
              <p className={`mt-2 rounded-lg px-2 py-1 text-caption font-medium leading-snug ${BAND_TONE[t.band.state]}`}>{t.band.text}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ═══ Patients behind a chart ══════════════════════════════════════════════ */

export function DrillPanel({ drill, closeHref }: { drill: DrillData; closeHref: string }) {
  return (
    <section id="drill" className="scroll-mt-24 rounded-2xl border-2 border-[var(--color-primary-300)] bg-white p-5 shadow-[0_12px_32px_-16px_rgba(21,122,115,0.45)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--color-primary-50)] text-[var(--color-primary-700)]" aria-hidden="true"><Users size={15} /></span>
          <div className="min-w-0">
            <h3 className="font-semibold tracking-[-0.01em] text-[var(--color-ink-900)]" style={{ fontSize: "var(--rf-fs-h4)", lineHeight: 1.3 }}>{drill.title}</h3>
            <p className="mt-0.5 text-label text-[var(--color-ink-400)]">{drill.subtitle} · {drill.table.rows.length.toLocaleString("en-IN")} {drill.table.rows.length === 1 ? "record" : "records"} · click a name to open the patient</p>
          </div>
        </div>
        <Link href={closeHref} scroll={false} aria-label="Close this list" className="shrink-0 rounded-lg p-1.5 text-[var(--color-ink-400)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink-800)]"><X size={16} /></Link>
      </div>
      <DataTable table={drill.table} pageSize={10} />
    </section>
  );
}

/* ═══ Better / same / worse bars ═══════════════════════════════════════════ */

export function OutcomeBars({ rows, unit }: { rows: OutcomeRow[]; unit: string }) {
  const parts = [
    { key: "better" as const, label: "Improved", color: "#12B76A" },
    { key: "same" as const, label: "Stayed the same", color: "#98A2B3" },
    { key: "worse" as const, label: "Got worse", color: "#F04438" },
  ];
  return (
    <div className="flex flex-col gap-3.5">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-[var(--color-ink-500)]">
        {parts.map((p) => <li key={p.key} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} aria-hidden="true" />{p.label}</li>)}
      </ul>
      {rows.map((r) => {
        const total = r.better + r.same + r.worse;
        return (
          <div key={r.label}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <p className="min-w-0 truncate text-label font-medium text-[var(--color-ink-800)]" title={r.label}>{r.label}</p>
              <p className="shrink-0 text-caption tabular-nums text-[var(--color-ink-400)]">{total.toLocaleString("en-IN")} {unit}</p>
            </div>
            <div className="flex h-6 overflow-hidden rounded-lg bg-[var(--color-surface-sunken)]" role="img" aria-label={`${r.label}: ${r.better} improved, ${r.same} the same, ${r.worse} worse`}>
              {parts.map((p) => {
                const share = total ? (r[p.key] / total) * 100 : 0;
                return share > 0 ? (
                  <span key={p.key} className="flex items-center justify-center text-micro font-semibold text-white" style={{ width: `${share}%`, background: p.color }} title={`${p.label}: ${r[p.key]} (${Math.round(share)}%)`}>
                    {share >= 9 ? `${Math.round(share)}%` : ""}
                  </span>
                ) : null;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══ Bars with a unit (%, min, rupees) ════════════════════════════════════ */

export function ValueBars({ data, format, max, color = "var(--color-primary-600)" }: { data: Cat[]; format: (v: number) => string; max?: number; color?: string }) {
  const top = max ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="flex flex-col gap-2.5">
      {data.map((d) => {
        const row = (
          <>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-label text-[var(--color-ink-700)]" title={d.label}>{d.label}</span>
              <span className="shrink-0 text-label font-semibold tabular-nums text-[var(--color-ink-900)]">{format(d.value)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-sunken)]">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, (d.value / top) * 100)}%`, background: d.color ?? color }} />
            </div>
          </>
        );
        return (
          <li key={d.label}>
            {d.href ? <Link href={d.href} scroll={false} className="-mx-1 block rounded-md px-1 py-0.5 hover:bg-[var(--color-surface-sunken)]">{row}</Link> : row}
          </li>
        );
      })}
    </ul>
  );
}

/* ═══ The patient journey ══════════════════════════════════════════════════ */

const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${Math.round(m % 60)} min` : `${Math.round(m)} min`);

export function JourneyFlow({ steps, color }: { steps: JourneyStep[]; color: string }) {
  const start = Math.max(1, steps[0]?.count ?? 1);
  return (
    <ol className="grid grid-cols-1 gap-3 md:grid-cols-4">
      {steps.map((s, i) => {
        const share = Math.round((s.count / start) * 100);
        const lost = i > 0 ? steps[i - 1].count - s.count : 0;
        return (
          <li key={s.label} className="relative">
            <div className="flex h-full flex-col rounded-2xl border border-[var(--color-border)] bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-caption font-semibold uppercase tracking-wide text-[var(--color-ink-500)]">{i + 1}. {s.label}</p>
                <span className="text-caption font-semibold tabular-nums" style={{ color }}>{share}%</span>
              </div>
              <p className="mt-1.5 text-[28px] font-bold leading-none tabular-nums text-[var(--color-ink-900)]">{s.count.toLocaleString("en-IN")}</p>
              {/* The bar narrows as patients drop out */}
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[var(--color-surface-sunken)]">
                <div className="h-full rounded-full" style={{ width: `${share}%`, background: color, opacity: 1 - i * 0.15 }} />
              </div>
              <p className="mt-2 text-caption text-[var(--color-ink-400)]">
                {i === 0 ? "Everyone who had an appointment" : lost > 0 ? `${lost.toLocaleString("en-IN")} did not reach this step` : "No one dropped out here"}
              </p>
              {s.minutes !== null && (
                <p className="mt-auto inline-flex items-center gap-1.5 pt-3 text-caption font-medium text-[var(--color-ink-700)]">
                  <Clock size={12} style={{ color }} aria-hidden="true" /> {fmtMin(s.minutes)} {s.minutesLabel}
                </p>
              )}
            </div>
            {i < steps.length - 1 && (
              <span aria-hidden="true" className="absolute -right-3 top-1/2 z-10 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--color-border)] bg-white text-[var(--color-ink-400)] md:flex">
                <ChevronRight size={14} />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ═══ Money: claimed, approved, received ═══════════════════════════════════ */

const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export function MoneyFlow({ money }: { money: { billed: number; approved: number; received: number; pending: number } }) {
  const top = Math.max(1, money.billed);
  const rows = [
    { label: "Claimed", value: money.billed, color: "#B45309", note: "What was billed to insurers" },
    { label: "Approved", value: money.approved, color: "#D97706", note: "What insurers agreed to pay" },
    { label: "Received", value: money.received, color: "#12B76A", note: "What has actually come in" },
  ];
  return (
    <div className="flex flex-col gap-4">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <p className="text-label font-semibold text-[var(--color-ink-800)]">{r.label} <span className="font-normal text-[var(--color-ink-400)]">· {r.note}</span></p>
            <p className="shrink-0 text-heading-sm font-bold tabular-nums text-[var(--color-ink-900)]">{rupees(r.value)}</p>
          </div>
          <div className="h-4 overflow-hidden rounded-lg bg-[var(--color-surface-sunken)]">
            <div className="h-full rounded-lg" style={{ width: `${Math.min(100, (r.value / top) * 100)}%`, background: r.color }} />
          </div>
        </div>
      ))}
      <p className="flex items-center gap-2 rounded-xl bg-[#FFFAEB] px-3.5 py-2.5 text-label text-[#B54708]">
        <AlertTriangle size={14} className="shrink-0" /> <span><span className="font-semibold">{rupees(money.pending)}</span> is still to come in from open claims.</span>
      </p>
    </div>
  );
}

/* ═══ Topics: one question area at a time ══════════════════════════════════ */

export interface TopicDef {
  id: string;
  /** Short name on the tab. */
  label: string;
  /** The question this topic answers, shown above its charts. */
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  /** Included in the one-page summary. */
  summary?: boolean;
  /** The finding that opens this topic. */
  lead?: Lead;
  content: ReactNode;
}

export function TopicTabs({ topics, card, print }: { topics: TopicDef[]; card: CardId; print?: boolean }) {
  const m = cardMeta(card);
  const [active, setActive] = useState(topics[0]?.id);
  const heading = (t: TopicDef) => (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]" style={{ background: m.tint, color: m.ink }} aria-hidden="true"><t.icon size={15} strokeWidth={1.8} /></span>
      <div>
        <h3 className="font-semibold tracking-[-0.01em] text-[var(--color-ink-900)]" style={{ fontSize: "var(--rf-fs-h3)", lineHeight: 1.3 }}>{t.title}</h3>
        {t.subtitle && <p className="mt-0.5 text-label text-[var(--color-ink-400)]">{t.subtitle}</p>}
      </div>
    </div>
  );

  if (print) {
    return (
      <>
        {topics.filter((t) => t.summary).map((t) => (
          <section key={t.id} className="flex flex-col gap-3 pt-2">
            {t.lead ? <StoryLead lead={t.lead} card={card} kicker={t.title} /> : heading(t)}
            {t.content}
          </section>
        ))}
      </>
    );
  }

  const current = topics.find((t) => t.id === active) ?? topics[0];
  if (!current) return null;
  const first = current.id === topics[0].id;
  return (
    <div>
      {/* Browser-style tabs: the active tab joins the card below */}
      <div role="tablist" aria-label="Analysis topics" className="relative z-[1] -mb-px flex items-end gap-1 overflow-x-auto px-1 [scrollbar-width:none]">
        {topics.map((t) => {
          const on = t.id === current.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActive(t.id)}
              style={on ? undefined : { borderColor: "transparent" }}
              className={`inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-t-xl border border-b-0 pl-3 pr-3.5 text-label font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)] ${
                on
                  ? "border-[var(--color-border)] bg-white text-[var(--color-ink-900)] shadow-[0_-1px_4px_rgba(15,23,42,0.05)]"
                  : "bg-transparent text-[var(--color-ink-500)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink-700)]"
              }`}
            >
              <span
                className="flex h-5 w-5 items-center justify-center rounded-md"
                style={on ? { background: m.tint, color: m.ink } : undefined}
                aria-hidden="true"
              >
                <t.icon size={13} strokeWidth={1.9} className={on ? "" : "text-[var(--color-ink-400)]"} />
              </span>
              {t.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className={`flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-white p-4 ${first ? "rounded-tl-none" : ""}`}>
        {current.lead ? (
          <StoryLead
            lead={{ ...current.lead, note: current.lead.note ?? current.subtitle }}
            card={card}
            kicker={`Chapter ${topics.findIndex((t) => t.id === current.id) + 1} of ${topics.length} · ${current.title}`}
          />
        ) : (
          <div>
            <h3 className="font-semibold tracking-[-0.01em] text-[var(--color-ink-900)]" style={{ fontSize: "var(--rf-fs-h4)", lineHeight: 1.3 }}>{current.title}</h3>
            {current.subtitle && <p className="mt-0.5 text-caption text-[var(--color-ink-400)]">{current.subtitle}</p>}
          </div>
        )}
        {current.content}
      </div>
    </div>
  );
}

/* ═══ Surgery placeholder ══════════════════════════════════════════════════ */

export function SurgeryPlaceholder() {
  const m = cardMeta("surgery");
  const planned = [
    "Surgeries advised, counselled, scheduled and done",
    "Vision before and after surgery, by procedure",
    "Complications and post-operative reviews",
    "Theatre use by day and by surgeon",
    "Waiting time from advice to surgery",
    "Cashless and self-pay split",
  ];
  return (
    <div className="rounded-3xl border border-dashed p-8 text-center sm:p-12" style={{ borderColor: `${m.from}55`, background: m.tint }}>
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl text-white" style={{ background: `linear-gradient(140deg, ${m.from}, ${m.to})` }} aria-hidden="true"><Scissors size={28} /></span>
      <h3 className="mt-4 text-heading-md font-bold tracking-tight" style={{ color: m.ink }}>Surgery analysis is coming with Phase 2</h3>
      <p className="mx-auto mt-2 max-w-xl text-label leading-relaxed text-[var(--color-ink-600)]">
        This space is reserved. Once the surgery, counselling and in-patient modules are complete, it will show:
      </p>
      <ul className="mx-auto mt-5 grid max-w-2xl grid-cols-1 gap-2 text-left sm:grid-cols-2">
        {planned.map((p) => (
          <li key={p} className="flex items-start gap-2.5 rounded-xl bg-white px-3.5 py-2.5 text-label text-[var(--color-ink-700)]">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: m.from }} aria-hidden="true" />{p}
          </li>
        ))}
      </ul>
    </div>
  );
}
