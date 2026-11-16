"use client";

// Consent tabs, shared by Counselling and the IPD Consents form. Each consent
// is a soft pill of the same size; × closes (deletes) it after a confirm, and
// "+ New" at the end adds one by name.

import { useState } from "react";
import { FileSignature, Plus, Trash2, X } from "lucide-react";

export interface ConsentTab { id: string; label: string; badge?: number }

export function ConsentTabBar({ items, active, onSelect, editable, onAdd, onRemove }: {
  items: ConsentTab[];
  active: string;
  onSelect: (id: string) => void;
  editable: boolean;
  onAdd: (title: string) => void;
  onRemove: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);
  const commit = () => { if (title.trim()) onAdd(title.trim()); setTitle(""); setAdding(false); };

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-[var(--color-border)]/70 bg-[var(--color-surface-sunken)]/70 p-1.5">
      {items.map((t) => {
        const on = t.id === active;
        const asking = confirm === t.id;
        return (
          <div key={t.id}
            className={`group relative flex h-9 w-[10.5rem] items-center gap-2 rounded-xl pl-2.5 pr-1.5 text-xs font-semibold transition-all duration-150 ${
              asking ? "bg-red-50 ring-1 ring-red-200 text-red-700"
                : on ? "bg-white text-[var(--color-primary-700)] shadow-[0_1px_2px_rgba(20,36,43,0.06),0_2px_8px_rgba(20,36,43,0.06)] ring-1 ring-[var(--color-primary-200)]"
                : "text-[var(--color-ink-500)] hover:bg-white/70 hover:text-[var(--color-ink-700)]"
            }`}>
            {asking ? (
              <>
                <Trash2 size={13} className="shrink-0" />
                <span className="flex-1 truncate">Delete?</span>
                <button type="button" onClick={() => { onRemove(t.id); setConfirm(null); }}
                  className="rounded-lg bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-red-700">Yes</button>
                <button type="button" onClick={() => setConfirm(null)} aria-label="Keep"
                  className="grid h-5 w-5 place-items-center rounded-full text-red-400 hover:bg-red-100 hover:text-red-700"><X size={11} /></button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => onSelect(t.id)} title={t.label} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-lg ${on ? "bg-[var(--color-primary-100)] text-[var(--color-primary-700)]" : "bg-white/80 text-[var(--color-ink-400)]"}`}>
                    <FileSignature size={11} />
                  </span>
                  <span className="truncate">{t.label}</span>
                </button>
                {!!t.badge && (
                  <span title={`${t.badge} to fill`} className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-amber-400 px-1 text-[9px] font-bold text-white tabular-nums">{t.badge}</span>
                )}
                {editable && (
                  <button type="button" title={`Delete ${t.label}`} aria-label={`Delete ${t.label}`} onClick={() => setConfirm(t.id)}
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[var(--color-ink-300)] transition-opacity hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink-700)] ${on ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus:opacity-100"}`}>
                    <X size={11} />
                  </button>
                )}
              </>
            )}
          </div>
        );
      })}
      {editable && (adding ? (
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Consent name, then Enter"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } if (e.key === "Escape") { setTitle(""); setAdding(false); } }}
          onBlur={commit}
          className="h-9 w-[13rem] rounded-xl border border-[var(--color-primary-300)] bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-200)]" />
      ) : (
        <button type="button" title="Add a consent" onClick={() => setAdding(true)}
          className="flex h-9 items-center gap-1 rounded-xl border border-dashed border-[var(--color-primary-300)] px-3 text-xs font-semibold text-[var(--color-primary-700)] transition-colors hover:bg-white hover:border-[var(--color-primary-400)]">
          <Plus size={13} /> New
        </button>
      ))}
    </div>
  );
}
