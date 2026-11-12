"use client";

// Custom options for IPD pick lists (diet types, quick notes, routes, …).
// Saved per field on this device, like the EMR's "+ Keyword" chips.

import { useMemo, useState, useSyncExternalStore } from "react";
import { Plus, X } from "lucide-react";
import { bumpUse, byUse, useFold, useLoadCounts, useSuggest } from "@/components/ui/Suggest";

const PREFIX = "ppms_ipd_opts_";

const EVENT = "ppms-ipd-options";

function parse(raw: string | null): string[] {
  try {
    const v = JSON.parse(raw ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); };
}

/** Built-in options plus the ones added on this device for this field. */
export function useCustomOptions(key: string, builtIns: readonly string[]) {
  // Read from storage after hydration (server snapshot is empty), and stay in
  // sync across every picker using the same field.
  const raw = useSyncExternalStore(
    subscribe,
    () => { try { return localStorage.getItem(PREFIX + key); } catch { return null; } },
    () => null,
  );
  const custom = useMemo(() => parse(raw), [raw]);
  const save = (next: string[]) => {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(next)); } catch { /* storage unavailable */ }
    window.dispatchEvent(new Event(EVENT));
  };
  const known = (v: string) => [...builtIns, ...custom].some((x) => x.toLowerCase() === v.toLowerCase());
  return {
    all: [...builtIns, ...custom.filter((c) => !builtIns.includes(c))],
    custom,
    isCustom: (v: string) => custom.includes(v),
    add: (v: string) => { const t = v.trim(); if (t && !known(t)) save([...custom, t]); return t; },
    remove: (v: string) => save(custom.filter((c) => c !== v)),
  };
}

/** "+ Custom" button that opens a small input; Enter adds the option. */
export function AddCustom({ onAdd, label = "Custom", placeholder = "Add option" }: { onAdd: (v: string) => void; label?: string; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const commit = () => { if (text.trim()) onAdd(text.trim()); setText(""); setOpen(false); };
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-dashed border-[var(--color-primary-300)] text-[11px] font-semibold text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)]">
        <Plus size={11} /> {label}
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } if (e.key === "Escape") setOpen(false); }}
        onBlur={commit}
        className="w-40 rounded-full border border-[var(--color-primary-300)] px-2.5 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-300)]" />
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setText(""); setOpen(false); }} className="p-0.5 text-[var(--color-ink-300)] hover:text-[var(--color-ink-600)]" aria-label="Cancel"><X size={12} /></button>
    </span>
  );
}

/** Small × to forget a custom option (built-in options can't be removed). */
export function RemoveCustom({ onRemove, label }: { onRemove: () => void; label: string }) {
  return (
    <button type="button" title={`Remove "${label}" from your options`} onClick={(e) => { e.stopPropagation(); onRemove(); }}
      className="ml-0.5 -mr-1 rounded-full p-0.5 opacity-60 hover:opacity-100 hover:bg-black/10" aria-label={`Remove ${label}`}>
      <X size={10} />
    </button>
  );
}

const chipBase = "inline-flex items-center rounded-full border text-xs font-medium transition-colors";

/** A row of option chips (built-in + custom) with "+ Custom". */
export function ChipRow({ storeKey, builtIns, isOn, onPick, editable = true, prefix = "", tone, limit = 8 }: {
  storeKey: string; builtIns: readonly string[]; isOn?: (v: string) => boolean; onPick: (v: string) => void;
  editable?: boolean; prefix?: string; tone?: (v: string) => string | undefined;
  /** How many chips show before "+ n more". */
  limit?: number;
}) {
  const o = useCustomOptions(storeKey, builtIns);
  // Most used first (as of page load, so chips don't move while clicking); folded to 8, selected ones always shown
  const counts = useLoadCounts(ns(storeKey));
  const ordered = byUse(o.all, counts);
  const { shown, toggle } = useFold(ordered, limit, (c) => isOn?.(c) ?? false);
  const pick = (c: string) => { bumpUse(ns(storeKey), c); onPick(c); };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {shown.map((c) => {
        const on = isOn?.(c) ?? false;
        return (
          <span key={c} className={`${chipBase} ${on ? (tone?.(c) ?? "bg-[var(--color-primary-600)] border-[var(--color-primary-600)] text-white") : "border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)]"}`}>
            <button type="button" disabled={!editable} onClick={() => pick(c)} className="px-2.5 py-1 disabled:cursor-default">{prefix}{c}</button>
            {editable && o.isCustom(c) && <span className="pr-1.5"><RemoveCustom label={c} onRemove={() => o.remove(c)} /></span>}
          </span>
        );
      })}
      {toggle}
      {editable && <AddCustom onAdd={(v) => { const t = o.add(v); if (t) pick(t); }} />}
    </div>
  );
}

const ns = (storeKey: string) => `ipd_${storeKey}`;

/**
 * Adds the type-ahead list to a field that has a ChipRow: the same options
 * (built-in + custom), most used first. `apply` puts a pick into the text;
 * "Save as keyword" adds the typed text to the options.
 */
export function SuggestField({ storeKey, builtIns, value, onChange, apply, disabled, className = "relative", children }: {
  storeKey: string; builtIns: readonly string[]; value: string; onChange: (v: string) => void;
  /** Default: replaces the text being typed after the last "," / ";" / line break with the pick. */
  apply?: (value: string, pick: string) => string;
  disabled?: boolean; className?: string;
  children: (input: { onFocus: () => void; onBlur: () => void; onKeyDown: (e: React.KeyboardEvent) => void; autoComplete: string }) => React.ReactNode;
}) {
  const o = useCustomOptions(storeKey, builtIns);
  const term = (value.split(/[,;\n•]/).pop() ?? "").trim();
  const put = apply ?? replaceTail;
  const s = useSuggest({
    ns: ns(storeKey), term, options: o.all,
    onPick: (x) => onChange(put(value, x)),
    onAddNew: (x) => { const t = o.add(x); if (t) onChange(put(value, t)); },
  });
  return (
    <div className={className}>
      {children(s.inputProps)}
      {!disabled && s.menu}
    </div>
  );
}

/** "a, b, wh" + "White" → "a, b, White" (keeps the separator style in use). */
export function replaceTail(value: string, pick: string): string {
  const cut = Math.max(value.lastIndexOf(","), value.lastIndexOf(";"), value.lastIndexOf("\n"), value.lastIndexOf("•"));
  if (cut < 0) return pick;
  const head = value.slice(0, cut + 1);
  return `${head}${head.endsWith("\n") ? "" : " "}${pick}`;
}

/** A drop-down whose options can be extended with "+ Custom" (the new option is selected). */
export function SelectWithCustom({ storeKey, builtIns, value, onChange, disabled, className }: {
  storeKey: string; builtIns: readonly string[]; value: string; onChange: (v: string) => void; disabled?: boolean; className: string;
}) {
  const o = useCustomOptions(storeKey, builtIns);
  const opts = value && !o.all.includes(value) ? [...o.all, value] : o.all;
  return (
    <div className="flex flex-1 min-w-0 items-center gap-1.5">
      <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={className}>
        {opts.map((x) => <option key={x}>{x}</option>)}
      </select>
      {!disabled && <AddCustom label="" placeholder="New option" onAdd={(v) => { const t = o.add(v); if (t) onChange(t); }} />}
    </div>
  );
}
