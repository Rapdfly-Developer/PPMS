"use client";

// Consent tabs, shared by Counselling and the IPD Consents form. Each consent
// is a soft pill of the same size; × closes (deletes) it after a confirm, and
// "+ New" opens a small menu: a prebuilt consent (with its wording) or a
// custom one by name.

import { useEffect, useRef, useState } from "react";
import { FileSignature, Lock, Plus, Search, Trash2, X } from "lucide-react";

export interface ConsentTab { id: string; label: string; badge?: number; /** Signed copy on file: can't be deleted. */ locked?: boolean }
export interface ConsentPreset { id: string; title: string; text: string }

export function ConsentTabBar({ items, active, onSelect, editable, onAdd, onRemove, presets = [] }: {
  items: ConsentTab[];
  active: string;
  onSelect: (id: string) => void;
  editable: boolean;
  /** A custom consent (title only), or a prebuilt one (its id and wording). */
  onAdd: (title: string, preset?: ConsentPreset) => void;
  onRemove: (id: string) => void;
  /** Prebuilt consents offered by "+ New" (those already on the sheet are hidden). */
  presets?: ConsentPreset[];
}) {
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState("");
  const [title, setTitle] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Close the menu on an outside click
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) { setMenu(false); setQ(""); setTitle(""); } };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  const have = new Set(items.map((i) => i.id));
  const available = presets.filter((p) => !have.has(p.id) && p.title.toLowerCase().includes(q.trim().toLowerCase()));
  const done = () => { setMenu(false); setQ(""); setTitle(""); };
  const addCustom = () => { if (title.trim()) { onAdd(title.trim()); done(); } };

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-[var(--color-border)]/70 bg-[var(--color-surface-sunken)]/70 p-1.5">
      {items.map((t) => {
        const on = t.id === active;
        const asking = confirm === t.id;
        return (
          <div key={t.id}
            className={`group relative flex h-8 w-[8.5rem] items-center gap-2 rounded-xl pl-2.5 pr-1.5 text-xs font-semibold transition-all duration-150 ${
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
                {t.locked && (
                  <span title="Locked: signed copy on file" className="grid h-5 w-5 shrink-0 place-items-center text-[var(--color-ink-400)]"><Lock size={11} /></span>
                )}
                {editable && !t.locked && (
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
      {editable && (
        <div ref={boxRef} className="relative">
          <button type="button" title="Add a consent" onClick={() => setMenu((m) => !m)}
            className={`flex h-8 items-center gap-1 rounded-xl border border-dashed px-3 text-xs font-semibold text-[var(--color-primary-700)] transition-colors hover:bg-white hover:border-[var(--color-primary-400)] ${menu ? "bg-white border-[var(--color-primary-400)]" : "border-[var(--color-primary-300)]"}`}>
            <Plus size={13} /> New
          </button>
          {menu && (
            <div className="absolute left-0 top-full z-40 mt-1.5 w-80 overflow-hidden rounded-2xl bg-white shadow-[0_16px_40px_-12px_rgba(15,23,42,0.3)] ring-1 ring-black/5">
              {/* Prebuilt consents, with their wording */}
              <div className="relative border-b border-[var(--color-border)]/70 p-2">
                <Search size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-ink-300)]" />
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search prebuilt consents"
                  className="h-8 w-full rounded-full border border-[var(--color-border)] bg-white pl-7 pr-3 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-200)]" />
              </div>
              <div className="max-h-64 overflow-y-auto py-1">
                <p className="px-3 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)]">Prebuilt</p>
                {available.map((p) => (
                  <button key={p.id} type="button" onClick={() => { onAdd(p.title, p); done(); }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[var(--color-primary-50)]">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-lg bg-[var(--color-primary-50)] text-[var(--color-primary-600)]"><FileSignature size={11} /></span>
                    <span className="truncate text-[12.5px] text-[var(--color-ink-800)]">{p.title}</span>
                  </button>
                ))}
                {available.length === 0 && <p className="px-3 py-1.5 text-[12px] text-[var(--color-ink-400)]">{q ? "No matching consent." : "All prebuilt consents are added."}</p>}
              </div>
              {/* Or a custom one, by name */}
              <div className="flex items-center gap-1.5 border-t border-[var(--color-border)]/70 bg-[var(--color-surface-sunken)]/40 p-2">
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Custom consent name"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } if (e.key === "Escape") done(); }}
                  className="h-8 min-w-0 flex-1 rounded-full border border-[var(--color-border)] bg-white px-3 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-200)]" />
                <button type="button" disabled={!title.trim()} onClick={addCustom}
                  className="h-8 shrink-0 rounded-full bg-[var(--color-primary-600)] px-3 text-xs font-semibold text-white hover:bg-[var(--color-primary-700)] disabled:opacity-40">Add custom</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
