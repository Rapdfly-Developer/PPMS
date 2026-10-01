"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, X } from "lucide-react";

/**
 * Distinguishes single from double activation (click/touch/keyboard).
 * Returns a stable `activate()` to call on each interaction event.
 * Single fires after `delay` ms with no second call; double fires immediately
 * on the second call. The 250ms delay prevents a double-tap from appending
 * the keyword before removing it.
 */
function useDoubleActivation(onSingle: () => void, onDouble: () => void, delay = 250) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const singleRef = useRef(onSingle);
  const doubleRef = useRef(onDouble);
  singleRef.current = onSingle;
  doubleRef.current = onDouble;

  useEffect(() => () => { if (timerRef.current !== null) clearTimeout(timerRef.current); }, []);

  return useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      doubleRef.current();
    } else {
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        singleRef.current();
      }, delay);
    }
  }, [delay]);
}

function loadKws(fieldKey: string): string[] {
  try { return JSON.parse(localStorage.getItem(`kw_${fieldKey}`) ?? "[]"); } catch { return []; }
}

function saveKws(fieldKey: string, kws: string[]) {
  try { localStorage.setItem(`kw_${fieldKey}`, JSON.stringify(kws)); } catch { /* storage unavailable */ }
}

/**
 * Folds keywords saved under older storage keys into this field's key, once.
 *
 * Chief complaint was captured in two places that each kept their own list —
 * the booking form under `ppms:complaint-keywords`, the EMR under
 * `kw_ge_chiefComplaint` — so a term saved on one side never appeared on the
 * other. Both now read one key; this carries the existing vocabulary across
 * rather than silently dropping what doctors had already built up.
 */
function migrateLegacyKws(fieldKey: string, legacyKeys: readonly string[]) {
  try {
    const current = loadKws(fieldKey);
    const merged = [...current];
    let moved = false;
    for (const legacy of legacyKeys) {
      const raw = localStorage.getItem(legacy);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const k of parsed) {
          if (typeof k === "string" && k && !merged.includes(k)) { merged.push(k); moved = true; }
        }
      }
      localStorage.removeItem(legacy);
    }
    if (moved) saveKws(fieldKey, merged);
  } catch { /* storage unavailable — nothing to migrate */ }
}

/** Single chip button with double-activation support. */
function ChipBtn({
  kw,
  onSingle,
  onDouble,
  className,
  children,
}: {
  kw: string;
  onSingle: () => void;
  onDouble: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const activate = useDoubleActivation(onSingle, onDouble);
  return (
    <button
      type="button"
      onClick={activate}
      title={`${kw} — double-tap to remove from text`}
      className={className}
    >
      {children}
    </button>
  );
}

function KeywordChips({
  fieldKey,
  onAppend,
  onRemoveFromText,
  disabled,
  builtIns = [],
  legacyKeys,
}: {
  fieldKey: string;
  onAppend: (kw: string) => void;
  onRemoveFromText: (kw: string) => void;
  disabled: boolean;
  /** Always-present suggestions. Not removable: they are not the user's to delete. */
  builtIns?: readonly string[];
  legacyKeys?: readonly string[];
}) {
  const [kws, setKws] = useState<string[]>([]);
  useEffect(() => {
    if (legacyKeys?.length) migrateLegacyKws(fieldKey, legacyKeys);
    setKws(loadKws(fieldKey));
  }, [fieldKey, legacyKeys]);

  const remove = (kw: string) => {
    const next = kws.filter((k) => k !== kw);
    setKws(next);
    saveKws(fieldKey, next);
  };

  // A built-in the user also saved would otherwise render twice.
  const custom = kws.filter((k) => !builtIns.some((b) => b.toLowerCase() === k.toLowerCase()));

  if (disabled || (custom.length === 0 && builtIns.length === 0)) return null;

  return (
    <>
      {builtIns.map((kw) => (
        <ChipBtn
          key={`builtin-${kw}`}
          kw={kw}
          onSingle={() => onAppend(kw)}
          onDouble={() => onRemoveFromText(kw)}
          className="inline-flex items-center px-2 py-0.5 rounded-full border border-[var(--color-border)] bg-white text-[11px] text-[var(--color-ink-600)] hover:border-[var(--color-primary-400)] hover:text-[var(--color-primary-700)] transition-colors"
        >
          {kw}
        </ChipBtn>
      ))}
      {custom.map((kw) => (
        <span
          key={kw}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-[var(--color-primary-300)] bg-[var(--color-primary-50)] text-[11px] text-[var(--color-primary-700)]"
        >
          <ChipBtn
            kw={kw}
            onSingle={() => onAppend(kw)}
            onDouble={() => onRemoveFromText(kw)}
            className="hover:underline"
          >
            {kw}
          </ChipBtn>
          <button type="button" onClick={() => remove(kw)} className="ml-0.5 text-[var(--color-ink-400)] hover:text-red-500 transition-colors" title={`Delete saved keyword "${kw}"`}>
            <X size={9} strokeWidth={2.5} />
          </button>
        </span>
      ))}
    </>
  );
}

function AddKeywordButton({
  getValue,
  fieldKey,
  onRefresh,
}: {
  getValue: () => string;
  fieldKey: string;
  onRefresh: () => void;
}) {
  const add = () => {
    const raw = getValue().trim();
    if (!raw) return;
    const kws = loadKws(fieldKey);
    if (kws.includes(raw)) return;
    saveKws(fieldKey, [...kws, raw]);
    onRefresh();
  };

  return (
    <button
      type="button"
      onClick={add}
      className="self-start inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-[var(--color-primary-300)] bg-[var(--color-primary-50)] text-[10px] font-medium text-[var(--color-primary-700)] hover:bg-[var(--color-primary-100)] transition-colors whitespace-nowrap"
    >
      <Plus size={11} strokeWidth={2.5} />
      Keyword
    </button>
  );
}

/** Remove one occurrence of `kw` from a comma- or space/newline-separated text field.
 *  Only removes whole-word matches; does not remove when `kw` appears inside a longer word. */
export function removeKeywordFromText(text: string, kw: string): string {
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Comma-separated: "a, Kw, b" → "a, b"  |  "a, Kw" → "a"  |  "Kw, b" → "b"
  // Word-boundary anchors ensure "Pain" doesn't strip "Eye Pain".
  const commaRe = new RegExp(
    `(?:^|(?<=,)\\s*)${escaped}(?=\\s*(?:,|$))`,
    "i"
  );

  // Attempt comma-aware removal first (text contains a comma)
  if (text.includes(",")) {
    const parts = text.split(",").map((p) => p.trim());
    const idx = parts.findIndex((p) => p.toLowerCase() === kw.toLowerCase());
    if (idx !== -1) {
      parts.splice(idx, 1);
      return parts.filter(Boolean).join(", ").trim();
    }
    // keyword not a standalone comma-token — fall through to word removal
    void commaRe; // suppress unused-var lint
  }

  // Space/newline-separated (textarea): use word boundaries
  // \b works for ASCII keywords; multi-word keywords need exact sequence match
  const spaceRe = new RegExp(`(?<![\\w])${escaped}(?![\\w])`, "i");
  return text
    .replace(spaceRe, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/^\s+|\s+$/g, "");
}

/* ── KeywordChipsRow ──────────────────────────────────────────────────────── */

/** Renders only the Add-keyword button + keyword chips, with no input field.
 *  Use when the text input is managed externally (e.g. inside a custom row). */
export function KeywordChipsRow({
  fieldKey,
  builtIns,
  legacyKeys,
  getValue,
  onAppend,
  onRemoveFromText,
}: {
  fieldKey: string;
  getValue: () => string;
  onAppend: (kw: string) => void;
  onRemoveFromText: (kw: string) => void;
  builtIns?: readonly string[];
  legacyKeys?: readonly string[];
}) {
  const [tick, setTick] = useState(0);
  return (
    <div data-overview-hide className="flex flex-wrap items-center gap-1.5">
      <AddKeywordButton getValue={getValue} fieldKey={fieldKey} onRefresh={() => setTick((t) => t + 1)} />
      <KeywordChips
        key={tick}
        fieldKey={fieldKey}
        builtIns={builtIns}
        legacyKeys={legacyKeys}
        onAppend={onAppend}
        onRemoveFromText={onRemoveFromText}
        disabled={false}
      />
    </div>
  );
}

/* ── KeywordInput ─────────────────────────────────────────────────────────── */

export function KeywordInput({
  fieldKey,
  value,
  onChange,
  disabled,
  placeholder,
  className,
  builtIns,
  legacyKeys,
}: {
  fieldKey: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Always-offered suggestions, shown before the user's own saved keywords. */
  builtIns?: readonly string[];
  /** Older localStorage keys whose keywords should be folded into this field. */
  legacyKeys?: readonly string[];
  className?: string;
}) {
  const [tick, setTick] = useState(0);

  return (
    <div className="flex flex-col gap-1.5">
      <input
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={
          className ??
          "w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] disabled:bg-[var(--color-surface-sunken)]"
        }
      />
      {!disabled && (
        <div data-overview-hide className="flex flex-wrap items-center gap-1.5">
          <AddKeywordButton getValue={() => value} fieldKey={fieldKey} onRefresh={() => setTick((t) => t + 1)} />
          <KeywordChips key={tick} fieldKey={fieldKey} builtIns={builtIns} legacyKeys={legacyKeys} onAppend={(kw) => onChange(value ? `${value}, ${kw}` : kw)} onRemoveFromText={(kw) => onChange(removeKeywordFromText(value, kw))} disabled={false} />
        </div>
      )}
    </div>
  );
}

/* ── KeywordTextarea ──────────────────────────────────────────────────────── */

export function KeywordTextarea({
  fieldKey,
  value,
  onChange,
  disabled,
  placeholder,
  rows,
  className,
  afterButtons,
  builtIns,
  legacyKeys,
}: {
  fieldKey: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Always-offered suggestions, shown before the user's own saved keywords. */
  builtIns?: readonly string[];
  /** Older localStorage keys whose keywords should be folded into this field. */
  legacyKeys?: readonly string[];
  rows?: number;
  className?: string;
  afterButtons?: React.ReactNode;
}) {
  const [tick, setTick] = useState(0);

  return (
    <div className="flex flex-col gap-1.5">
      <textarea
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows ?? 2}
        className={
          className ??
          "w-full rounded-xl border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] disabled:bg-[var(--color-surface-sunken)]"
        }
      />
      {!disabled && (
        <div data-overview-hide className="flex flex-wrap items-center gap-1.5">
          {/* The whole trimmed value, not the last word: complaints are mostly
              multi-word ("Blurred Vision", "Foreign Body Sensation"), and the
              old last-word behaviour saved "Vision" for "Blurred Vision". That
              matters more now the vocabulary is shared with the booking form. */}
          <AddKeywordButton getValue={() => value.trim()} fieldKey={fieldKey} onRefresh={() => setTick((t) => t + 1)} />
          <KeywordChips key={tick} fieldKey={fieldKey} builtIns={builtIns} legacyKeys={legacyKeys} onAppend={(kw) => onChange(value ? `${value} ${kw}` : kw)} onRemoveFromText={(kw) => onChange(removeKeywordFromText(value, kw))} disabled={false} />
          {afterButtons}
        </div>
      )}
    </div>
  );
}
