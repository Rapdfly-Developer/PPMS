"use client";

// Activity timeline as a floating panel from the right (same look as the Patient
// profile's Time Stamp): teal header, month calendar, then the selected day's
// events as small cards linked by a vertical line.

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { addMonths, eachDayOfInterval, endOfMonth, format, getDay, isSameDay, startOfMonth, subMonths } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, History, X } from "lucide-react";

export interface TimelineEvent { at: string; title: string; detail?: string | null; by?: string | null; kind: string }
export interface KindCfg { label: string; hex: string }

const DAY_LABELS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const keyOf = (iso: string) => format(new Date(iso), "yyyy-MM-dd");

export function ActivityPanel({ kicker, title, events, kinds, onClose }: {
  kicker: string; title: string; events: TimelineEvent[]; kinds: Record<string, KindCfg>; onClose: () => void;
}) {
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const sorted = useMemo(() => [...events].sort((a, b) => b.at.localeCompare(a.at)), [events]);
  const latestKey = sorted.length ? keyOf(sorted[0].at) : todayKey;
  const [sel, setSel] = useState(latestKey);
  const [month, setMonth] = useState(() => startOfMonth(new Date(latestKey)));

  const byDay = useMemo(() => {
    const map: Record<string, TimelineEvent[]> = {};
    for (const e of sorted) (map[keyOf(e.at)] ??= []).push(e);
    for (const k in map) map[k].sort((a, b) => a.at.localeCompare(b.at));
    return map;
  }, [sorted]);
  const dayEvents = byDay[sel] ?? [];
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const legend = [...new Set(events.map((e) => e.kind))].filter((k) => kinds[k]);
  const pick = (key: string) => {
    setSel(key);
    const d = new Date(key);
    if (d.getMonth() !== month.getMonth() || d.getFullYear() !== month.getFullYear()) setMonth(startOfMonth(d));
  };

  return (
    <div className="fixed inset-0 z-[200]" style={{ background: "rgba(0,0,0,0.45)" }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.aside
        initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="absolute inset-y-0 right-0 flex w-full max-w-[520px] flex-col bg-[var(--color-surface)] shadow-2xl"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 px-5 py-4 text-white" style={{ background: "linear-gradient(135deg, var(--color-primary-800) 0%, var(--color-primary-600) 100%)" }}>
          <History size={16} className="opacity-80" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-widest text-white/60">{kicker}</p>
            <h2 className="truncate text-sm font-bold leading-tight">{title}</h2>
          </div>
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold">{events.length} event{events.length === 1 ? "" : "s"}</span>
          <button onClick={onClose} className="flex size-7 items-center justify-center rounded-full transition-colors hover:bg-white/15" aria-label="Close"><X size={14} /></button>
        </div>

        {/* Calendar */}
        <div className="shrink-0 border-b border-[var(--color-border)] px-8 pb-1.5 pt-2" style={{ background: "linear-gradient(160deg, var(--color-primary-50) 0%, #fff 60%)" }}>
          <div className="mb-1.5 flex items-center justify-between">
            <button type="button" onClick={() => setMonth((m) => subMonths(m, 1))} className="flex size-7 items-center justify-center rounded-full border border-[var(--color-border)] bg-white text-[var(--color-ink-500)] shadow-sm hover:text-[var(--color-primary-600)]" aria-label="Previous month"><ChevronLeft size={13} /></button>
            <h3 className="text-[13px] font-bold tracking-tight text-[var(--color-ink-800)]">{format(month, "MMMM yyyy")}</h3>
            <button type="button" onClick={() => setMonth((m) => addMonths(m, 1))} className="flex size-7 items-center justify-center rounded-full border border-[var(--color-border)] bg-white text-[var(--color-ink-500)] shadow-sm hover:text-[var(--color-primary-600)]" aria-label="Next month"><ChevronRight size={13} /></button>
          </div>
          <div className="mb-1 grid grid-cols-7">
            {DAY_LABELS.map((x) => <span key={x} className="text-center text-[9px] font-bold uppercase tracking-widest text-[var(--color-ink-300)]">{x}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: getDay(days[0]) }).map((_, i) => <div key={`b${i}`} />)}
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const list = byDay[key] ?? [];
              const has = list.length > 0;
              const isSel = key === sel;
              const on = [...new Set(list.map((e) => e.kind))].filter((k) => kinds[k]);
              return (
                <button key={key} type="button" disabled={!has} onClick={() => pick(key)}
                  className={`relative flex h-9 w-full flex-col items-center justify-center rounded-xl transition-all ${isSel ? "bg-[var(--color-primary-600)] text-white shadow-sm" : has ? "cursor-pointer bg-[var(--color-primary-50)] text-[var(--color-primary-700)] hover:bg-[var(--color-primary-100)]" : "cursor-default text-[var(--color-ink-300)]"} ${isSameDay(day, new Date()) && !isSel ? "ring-2 ring-[var(--color-primary-400)] ring-offset-1" : ""}`}>
                  <span className="text-[11px] font-bold leading-none">{format(day, "d")}</span>
                  {has && (
                    <span className="mt-[3px] flex gap-[3px]">
                      {on.slice(0, 3).map((k) => <span key={k} className="size-[4px] shrink-0 rounded-full" style={{ background: isSel ? "rgba(255,255,255,0.8)" : kinds[k].hex }} />)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-[var(--color-border)]/60 pt-1.5">
            <button type="button" onClick={() => pick(todayKey)} className="rounded-full border border-[var(--color-primary-200)] bg-white px-2.5 py-1 text-[10px] font-semibold text-[var(--color-primary-600)] shadow-sm hover:bg-[var(--color-primary-50)]">Today</button>
            <div className="flex flex-wrap justify-end gap-x-2 gap-y-1">
              {legend.map((k) => (
                <span key={k} className="flex items-center gap-1 text-[9px] font-medium text-[var(--color-ink-400)]"><span className="inline-block size-1.5 shrink-0 rounded-full" style={{ background: kinds[k].hex }} />{kinds[k].label}</span>
              ))}
            </div>
          </div>
        </div>

        {/* The day's events: cards linked by a line */}
        <div className="flex-1 overflow-y-auto">
          <div className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-white/90 px-5 py-2.5 backdrop-blur-sm">
            <p className="text-xs font-semibold text-[var(--color-ink-600)]">{format(new Date(sel), "d MMMM yyyy, EEEE")}</p>
          </div>
          <div className="px-4 py-4">
            {dayEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16">
                <CalendarDays size={28} className="text-[var(--color-ink-300)]" />
                <p className="text-xs text-[var(--color-ink-400)]">No activity on this date</p>
              </div>
            ) : (
              <ol className="pl-1">
                {dayEvents.map((e, i) => {
                  const cfg = kinds[e.kind] ?? { label: e.kind, hex: "#94A3B8" };
                  return (
                    <li key={i} className="relative flex gap-3" title={e.detail ?? undefined}>
                      <div className="flex shrink-0 flex-col items-center">
                        <span className="mt-2 size-2.5 shrink-0 rounded-full shadow-sm ring-2 ring-white" style={{ background: cfg.hex }} />
                        {i < dayEvents.length - 1 && <span className="mt-1 w-px flex-1 bg-[var(--color-border)]" />}
                      </div>
                      <div className="mb-3 min-w-0 flex-1 rounded-xl border border-l-4 border-[var(--color-border)] bg-white px-3 py-2" style={{ borderLeftColor: cfg.hex }}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ background: `${cfg.hex}1f`, color: cfg.hex }}>{cfg.label}</span>
                          <span className="shrink-0 text-[11px] font-medium tabular-nums text-[var(--color-ink-400)]">{format(new Date(e.at), "h:mm a")}</span>
                        </div>
                        <p className="mt-1 truncate text-sm font-semibold leading-tight text-[var(--color-ink-800)]">{e.title}</p>
                        {e.by && <p className="mt-0.5 truncate text-[11px] text-[var(--color-ink-400)]">{e.by}</p>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      </motion.aside>
    </div>
  );
}
