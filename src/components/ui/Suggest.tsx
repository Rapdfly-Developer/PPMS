"use client";

// Type-ahead suggestions for keyword fields across the app. Suggestions match
// anywhere in the word, the keywords picked most often come first, and the
// typed text can be saved as a new keyword. Usage is remembered per field on
// this device (like the keywords themselves).

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { Plus } from "lucide-react";
import { MatchHighlight } from "./MatchHighlight";

/* ── Usage counts ─────────────────────────────────────────────────────── */

const USE_PREFIX = "kw_use_";
const USE_EVENT = "ppms-kw-use";

function readCounts(ns: string): Record<string, number> {
  try {
    const v = JSON.parse(localStorage.getItem(USE_PREFIX + ns) ?? "{}");
    return v && typeof v === "object" ? v : {};
  } catch { return {}; }
}

/** Count one more use of a keyword in this field. */
export function bumpUse(ns: string, kw: string) {
  const k = kw.trim().toLowerCase();
  if (!k) return;
  try {
    const c = readCounts(ns);
    c[k] = (c[k] ?? 0) + 1;
    localStorage.setItem(USE_PREFIX + ns, JSON.stringify(c));
    window.dispatchEvent(new Event(USE_EVENT));
  } catch { /* storage unavailable */ }
}

function subscribe(cb: () => void) {
  window.addEventListener(USE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(USE_EVENT, cb); window.removeEventListener("storage", cb); };
}

/** Usage counts for a field, kept in sync with every picker using it. */
export function useUseCounts(ns: string): Record<string, number> {
  const raw = useSyncExternalStore(
    subscribe,
    () => { try { return localStorage.getItem(USE_PREFIX + ns); } catch { return null; } },
    () => null,
  );
  return useMemo(() => {
    try { const v = JSON.parse(raw ?? "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; }
  }, [raw]);
}

const loadCache = new Map<string, string | null>();
const noop = () => () => {};

/**
 * Usage counts as they were when the page loaded. Chip walls sort with these,
 * so chips don't jump around while they are being clicked; the next visit
 * shows the new order.
 */
export function useLoadCounts(ns: string): Record<string, number> {
  const raw = useSyncExternalStore(
    noop,
    () => {
      if (!loadCache.has(ns)) { try { loadCache.set(ns, localStorage.getItem(USE_PREFIX + ns)); } catch { loadCache.set(ns, null); } }
      return loadCache.get(ns) ?? null;
    },
    () => null,
  );
  return useMemo(() => {
    try { const v = JSON.parse(raw ?? "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; }
  }, [raw]);
}

/** Options with the most used first; ties keep their original order. */
export function byUse(options: readonly string[], counts: Record<string, number>): string[] {
  return options
    .map((o, i) => ({ o, i, n: counts[o.toLowerCase()] ?? 0 }))
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .map((x) => x.o);
}

/* ── Ranking ──────────────────────────────────────────────────────────── */

/** Matches for the typed term: whole-word starts first, then anywhere; most used first within each. */
export function rankSuggestions(term: string, options: readonly string[], counts: Record<string, number>, keepOrder = false): string[] {
  const t = term.trim().toLowerCase();
  const uniq = [...new Map(options.filter(Boolean).map((o) => [o.toLowerCase(), o])).values()];
  if (!t) return keepOrder ? uniq : byUse(uniq, counts);
  const scored = uniq
    .map((o, i) => {
      const lc = o.toLowerCase();
      const at = lc.indexOf(t);
      if (at < 0) return null;
      const rank = at === 0 ? 0 : /[\s(/-]/.test(lc[at - 1]) ? 1 : 2;
      return { o, i, rank, n: counts[lc] ?? 0 };
    })
    .filter((x): x is { o: string; i: number; rank: number; n: number } => !!x);
  scored.sort((a, b) => (keepOrder ? a.i - b.i : a.rank - b.rank || b.n - a.n || a.i - b.i));
  return scored.map((x) => x.o);
}

/* ── The dropdown ─────────────────────────────────────────────────────── */

const Highlight = MatchHighlight;

export interface SuggestOptions {
  /** The part of the field being typed (empty when nothing is being typed). */
  term: string;
  /** Everything that can be suggested. */
  options: readonly string[];
  /** Field id for usage counts. */
  ns: string;
  onPick: (option: string) => void;
  /** Offer "+ Save as keyword" for text that isn't a keyword yet. */
  onAddNew?: (text: string) => void;
  /** Keep the given order (e.g. surgery steps) instead of most used first. */
  keepOrder?: boolean;
  /** Show the list on focus even when nothing is typed. */
  openOnFocus?: boolean;
  /** Numbered rows (e.g. surgery steps). */
  numbered?: boolean;
  max?: number;
  /** Show the list in the page flow instead of floating (inside dialogs, so it is not cut off). */
  inline?: boolean;
}

/**
 * Autocomplete for a field: spread `inputProps` on the input / textarea, put
 * `menu` right after it inside a `relative` wrapper. ↑ ↓ move, Enter or Tab
 * pick, Esc closes. Picking counts as a use, so it ranks higher next time.
 */
export function useSuggest({ term, options, ns, onPick, onAddNew, keepOrder, openOnFocus, numbered, max = 8, inline }: SuggestOptions) {
  const counts = useUseCounts(ns);
  const [focused, setFocused] = useState(false);
  const [closedFor, setClosedFor] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  // Enter saves new text only after the user moves to that row on purpose
  const [movedFor, setMovedFor] = useState<string | null>(null);

  const t = term.trim();
  const matches = useMemo(() => rankSuggestions(t, options, counts, keepOrder).slice(0, max), [t, options, counts, keepOrder, max]);
  const exact = matches.some((m) => m.toLowerCase() === t.toLowerCase()) || options.some((o) => o.toLowerCase() === t.toLowerCase());
  const showAdd = !!onAddNew && t.length >= 2 && !exact;
  const rows = [...matches.map((m) => ({ kind: "pick" as const, text: m })), ...(showAdd ? [{ kind: "add" as const, text: t }] : [])];
  const open = focused && closedFor !== term && rows.length > 0 && (t.length > 0 || !!openOnFocus) && !(exact && matches.length === 1 && !openOnFocus);
  const idx = Math.min(active, Math.max(0, rows.length - 1));

  const choose = useCallback((row: { kind: "pick" | "add"; text: string }) => {
    if (row.kind === "add") onAddNew?.(row.text); else onPick(row.text);
    bumpUse(ns, row.text);
    setActive(0);
    setMovedFor(null);
    // Close the list once something is picked
    setClosedFor(row.text);
  }, [ns, onAddNew, onPick]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setMovedFor(term); setActive((i) => (i + 1) % rows.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setMovedFor(term); setActive((i) => (i - 1 + rows.length) % rows.length); }
    else if (e.key === "Enter" || e.key === "Tab") {
      if (!t && !openOnFocus) return;
      if (rows[idx].kind === "add" && movedFor !== term) return;
      e.preventDefault(); e.stopPropagation(); choose(rows[idx]);
    }
    else if (e.key === "Escape") { e.preventDefault(); setClosedFor(term); }
  };

  const inputProps = {
    onKeyDown,
    onFocus: () => { setFocused(true); setClosedFor(null); },
    onBlur: () => setFocused(false),
    autoComplete: "off",
  };

  const menu = open ? (
    <div role="listbox" className={`${inline ? "relative mt-1 max-h-48" : "absolute left-0 right-0 top-full mt-1 z-50 max-h-64"} overflow-y-auto rounded-lg border border-[var(--color-border)] bg-white shadow-lg py-1`}>
      {rows.map((row, i) => (
        <button key={`${row.kind}-${row.text}`} type="button" role="option" aria-selected={i === idx}
          onMouseDown={(e) => { e.preventDefault(); choose(row); }}
          onMouseEnter={() => setActive(i)}
          className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm ${i === idx ? "bg-[var(--color-primary-50)] text-[var(--color-primary-800)]" : "text-[var(--color-ink-700)]"}`}>
          {row.kind === "add" ? (
            <><Plus size={13} className="shrink-0 text-[var(--color-primary-600)]" /><span>Save <b className="font-semibold">&quot;{row.text}&quot;</b> as a keyword</span></>
          ) : (
            <>
              {numbered && <span className="w-5 shrink-0 text-right text-xs tabular-nums text-[var(--color-ink-400)]">{options.indexOf(row.text) + 1}.</span>}
              <span className="flex-1 min-w-0 truncate"><Highlight text={row.text} term={t} /></span>
              {(counts[row.text.toLowerCase()] ?? 0) > 1 && !keepOrder && <span className="text-micro text-[var(--color-ink-300)]">used {counts[row.text.toLowerCase()]}×</span>}
            </>
          )}
        </button>
      ))}
      <p className="px-3 pt-1 pb-0.5 text-micro text-[var(--color-ink-300)] border-t border-[var(--color-border)] mt-1">↑ ↓ to move · Enter to pick · Esc to close</p>
    </div>
  ) : null;

  return { inputProps, menu, open };
}

/** A chip wall folded to the most used few, with "+ n more". */
export function useFold<T>(items: readonly T[], limit = 8, keep?: (item: T) => boolean) {
  const [expanded, setExpanded] = useState(false);
  // Items that must stay visible (e.g. selected ones) are shown even when folded
  const folded = items.filter((x, i) => i < limit || keep?.(x));
  const hidden = items.length - folded.length;
  const shown = expanded || hidden === 0 ? items : folded;
  const toggle = hidden > 0 ? (
    <button type="button" onClick={() => setExpanded((v) => !v)}
      className="inline-flex items-center px-2 py-0.5 rounded-full text-caption font-semibold text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)]">
      {expanded ? "Show less" : `+ ${hidden} more`}
    </button>
  ) : null;
  return { shown, toggle };
}
