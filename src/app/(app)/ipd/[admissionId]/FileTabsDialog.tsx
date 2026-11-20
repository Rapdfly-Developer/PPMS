"use client";

// Pick the tabs of the IPD patient file: once when the file is created (from
// the patient profile or the file page), and later to add tabs.

import { useState, useTransition } from "react";
import { Check, Lock, X } from "lucide-react";
import { format, isToday } from "date-fns";

/** The long summary's tab title: today's, or the day and date of the admitting visit. */
export const summaryTitle = (visitDate: string) =>
  isToday(new Date(visitDate)) ? "Today's Long Summary" : `Long Summary · ${format(new Date(visitDate), "d MMM yyyy, EEE")}`;

export interface TabChoice { key: string; title: string; preOp?: boolean }

function Tick({ on, locked }: { on: boolean; locked?: boolean }) {
  return (
    <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border-[1.5px] transition-colors ${
      on ? "border-[var(--color-primary-600)] bg-[var(--color-primary-600)]" : "border-[var(--color-ink-300)] bg-white"
    } ${locked ? "opacity-60" : ""}`}>
      {on && <Check size={11} strokeWidth={3} className="text-white" />}
    </span>
  );
}

export function FileTabsDialog({ title, sub, always, choices, initial, confirmLabel, custom, onConfirm, onClose }: {
  title: string;
  sub?: string;
  /** Tabs the file always has (shown ticked, can't be unticked). */
  always: TabChoice[];
  choices: TabChoice[];
  initial: string[];
  confirmLabel: string;
  /** Also offer a custom form by name. */
  custom?: boolean;
  /** Resolves to an error message, or nothing when done. */
  onConfirm: (tabs: string[], customName: string) => Promise<string | undefined>;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<string[]>(initial);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const toggle = (k: string) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  const allOn = choices.length > 0 && choices.every((c) => picked.includes(c.key));
  const submit = () => start(async () => {
    setError("");
    const err = await onConfirm(choices.map((c) => c.key).filter((k) => picked.includes(k)), name.trim());
    if (err) setError(err);
  });
  const nothing = picked.length === 0 && !name.trim();

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl p-5 shadow-2xl bg-white" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-1">
          <p className="text-base font-bold text-[var(--color-ink-900)]">{title}</p>
          <button onClick={onClose} className="p-1 rounded-lg text-[var(--color-ink-400)] hover:bg-[var(--color-surface-sunken)]" aria-label="Close"><X size={16} /></button>
        </div>
        {sub && <p className="text-xs text-[var(--color-ink-500)] mb-3">{sub}</p>}

        <div className="grid gap-1.5 sm:grid-cols-2">
          {always.map((c) => (
            <div key={c.key} className="flex items-center gap-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-sunken)]/60 px-3 py-2 text-sm text-[var(--color-ink-600)]"
              title="Every patient file has this tab">
              <Tick on locked /> <span className="flex-1 min-w-0">{c.title}</span> <Lock size={12} className="shrink-0 text-[var(--color-ink-400)]" />
            </div>
          ))}
          {choices.map((c) => {
            const on = picked.includes(c.key);
            return (
              <button key={c.key} type="button" onClick={() => toggle(c.key)}
                className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  on ? "border-[var(--color-primary-300)] bg-[var(--color-primary-50)] text-[var(--color-ink-900)]" : "border-[var(--color-border)] text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]"
                }`}>
                <Tick on={on} />
                <span className="flex-1 min-w-0">{c.title}</span>
                {c.preOp && <span className="shrink-0 text-micro font-bold rounded px-1 py-px bg-amber-50 text-amber-700 border border-amber-200">Pre-op</span>}
              </button>
            );
          })}
        </div>
        {choices.length > 1 && (
          <button type="button" onClick={() => setPicked(allOn ? [] : choices.map((c) => c.key))}
            className="mt-2 text-xs font-semibold text-[var(--color-primary-700)] hover:underline">
            {allOn ? "Clear all" : "Select all"}
          </button>
        )}
        {choices.length === 0 && !custom && <p className="text-sm text-[var(--color-ink-500)]">Every tab is already in the file.</p>}

        {custom && (
          <div className="mt-3">
            <p className="text-[10.5px] font-bold tracking-wider text-[var(--color-ink-500)] uppercase mb-1">Or a custom form</p>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Form name, e.g. Physician fitness"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-2.5 py-1.5 text-sm text-[var(--color-ink-800)] placeholder:text-[var(--color-ink-300)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-transparent" />
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]">Cancel</button>
          <button disabled={pending || (custom && nothing)} onClick={submit}
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] disabled:opacity-60">
            {pending ? "Saving..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
