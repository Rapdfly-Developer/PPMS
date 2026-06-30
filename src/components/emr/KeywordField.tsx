"use client";

import { useState, useEffect } from "react";
import { Plus, X } from "lucide-react";

function loadKws(fieldKey: string): string[] {
  try { return JSON.parse(localStorage.getItem(`kw_${fieldKey}`) ?? "[]"); } catch { return []; }
}

function saveKws(fieldKey: string, kws: string[]) {
  localStorage.setItem(`kw_${fieldKey}`, JSON.stringify(kws));
}

function KeywordChips({
  fieldKey,
  onAppend,
  disabled,
}: {
  fieldKey: string;
  onAppend: (kw: string) => void;
  disabled: boolean;
}) {
  const [kws, setKws] = useState<string[]>([]);
  useEffect(() => { setKws(loadKws(fieldKey)); }, [fieldKey]);

  const remove = (kw: string) => {
    const next = kws.filter((k) => k !== kw);
    setKws(next);
    saveKws(fieldKey, next);
  };

  if (disabled || kws.length === 0) return null;

  return (
    <>
      {kws.map((kw) => (
        <span
          key={kw}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-[var(--color-primary-300)] bg-[var(--color-primary-50)] text-[11px] text-[var(--color-primary-700)]"
        >
          <button type="button" onClick={() => onAppend(kw)} className="hover:underline">
            {kw}
          </button>
          <button type="button" onClick={() => remove(kw)} className="ml-0.5 text-[var(--color-ink-400)] hover:text-red-500 transition-colors">
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

/* ── KeywordInput ─────────────────────────────────────────────────────────── */

export function KeywordInput({
  fieldKey,
  value,
  onChange,
  disabled,
  placeholder,
  className,
}: {
  fieldKey: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
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
        <div className="flex flex-wrap items-center gap-1.5">
          <AddKeywordButton getValue={() => value} fieldKey={fieldKey} onRefresh={() => setTick((t) => t + 1)} />
          <KeywordChips key={tick} fieldKey={fieldKey} onAppend={(kw) => onChange(value ? `${value}, ${kw}` : kw)} disabled={false} />
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
}: {
  fieldKey: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
  className?: string;
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
        <div className="flex flex-wrap items-center gap-1.5">
          <AddKeywordButton getValue={() => value.trim().split(/\s+/).pop() ?? value.trim()} fieldKey={fieldKey} onRefresh={() => setTick((t) => t + 1)} />
          <KeywordChips key={tick} fieldKey={fieldKey} onAppend={(kw) => onChange(value ? `${value} ${kw}` : kw)} disabled={false} />
        </div>
      )}
    </div>
  );
}
