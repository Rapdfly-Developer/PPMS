"use client";

// The doctor's own OT note templates and education sets, managed from inside
// the forms (no settings page): load, save as mine, rename, delete.

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookmarkPlus, ChevronDown, FolderOpen, Loader2, Search, Settings2, Trash2, X } from "lucide-react";
import { deleteIpdTemplate, renameIpdTemplate, saveIpdTemplate } from "../actions";

export interface SavedTemplate { id: string; kind: string; name: string; surgery: string | null; items: string[] }

const btnG = "inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-ink-700)] bg-white hover:bg-[var(--color-surface-sunken)] disabled:opacity-50 transition-colors";
const inp = "w-full rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-sm text-[var(--color-ink-800)] placeholder:text-[var(--color-ink-300)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-transparent";

/** Closes a pop-over when clicking outside it. */
function useOutside<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open, onClose]);
  return ref;
}

/* ── Save as my template / set ─────────────────────────────────────────── */

export function SaveAsMine({ kind, surgery, items, defaultName, label }: {
  kind: "OT" | "EDUCATION"; surgery: string | null; items: string[]; defaultName: string; label: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const save = () => start(async () => {
    const r = await saveIpdTemplate(kind, name, surgery, items);
    if (r.error) { setMsg(r.error); return; }
    setMsg("Saved"); setOpen(false); router.refresh();
    setTimeout(() => setMsg(""), 2500);
  });
  if (!open) {
    return (
      <span className="inline-flex items-center gap-2">
        <button type="button" disabled={!items.some((x) => x.trim())} onClick={() => { setName(defaultName); setOpen(true); setMsg(""); }} className={btnG}><BookmarkPlus size={12} /> {label}</button>
        {msg && <span className="text-xs font-semibold text-emerald-700">{msg}</span>}
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setOpen(false); }}
        placeholder="Name" className={`${inp} w-56`} />
      <button type="button" disabled={pending || !name.trim()} onClick={save} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] disabled:opacity-50">
        {pending ? <Loader2 size={12} className="animate-spin" /> : null} Save
      </button>
      <button type="button" onClick={() => setOpen(false)} className="p-1 text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)]" aria-label="Cancel"><X size={14} /></button>
      {msg && <span className="text-xs font-semibold text-red-600">{msg}</span>}
    </span>
  );
}

/* ── Manage (rename / delete) pop-up ───────────────────────────────────── */

export function ManageMine({ kind, templates, title }: { kind: "OT" | "EDUCATION"; templates: SavedTemplate[]; title: string }) {
  const router = useRouter();
  const mine = templates.filter((t) => t.kind === kind);
  const [open, setOpen] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const rename = (t: SavedTemplate) => {
    const n = (names[t.id] ?? t.name).trim();
    if (!n || n === t.name) return;
    start(async () => { const r = await renameIpdTemplate(t.id, n); if (r.error) setError(r.error); else { setError(""); router.refresh(); } });
  };
  const remove = (id: string) => start(async () => {
    const r = await deleteIpdTemplate(id);
    if (r.error) setError(r.error); else { setConfirmId(null); setError(""); router.refresh(); }
  });
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btnG}><Settings2 size={12} /> Manage{mine.length ? ` (${mine.length})` : ""}</button>
      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
          <div className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-base font-bold text-[var(--color-ink-900)]">{title}</p>
              <button onClick={() => setOpen(false)} className="p-1 rounded-lg text-[var(--color-ink-400)] hover:bg-[var(--color-surface-sunken)]" aria-label="Close"><X size={16} /></button>
            </div>
            {mine.length === 0 ? (
              <p className="text-sm text-[var(--color-ink-500)]">Nothing saved yet. Use &ldquo;Save as my {kind === "OT" ? "template" : "set"}&rdquo; on the form to add one.</p>
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {mine.map((t) => (
                  <li key={t.id} className="py-2.5">
                    <div className="flex items-center gap-2">
                      <input value={names[t.id] ?? t.name} onChange={(e) => setNames({ ...names, [t.id]: e.target.value })}
                        onBlur={() => rename(t)} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} className={inp} aria-label="Name" />
                      {confirmId === t.id ? (
                        <span className="flex items-center gap-1 shrink-0">
                          <button type="button" disabled={pending} onClick={() => remove(t.id)} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700">Delete</button>
                          <button type="button" onClick={() => setConfirmId(null)} className="text-xs font-semibold px-2 py-1.5 text-[var(--color-ink-500)]">Keep</button>
                        </span>
                      ) : (
                        <button type="button" onClick={() => setConfirmId(t.id)} className="p-1.5 rounded-lg text-[var(--color-ink-300)] hover:text-red-600 hover:bg-red-50 shrink-0" aria-label={`Delete ${t.name}`}><Trash2 size={14} /></button>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-[var(--color-ink-400)]">{t.items.length} {kind === "OT" ? "steps" : "points"}{t.surgery ? ` · ${t.surgery}` : ""}</p>
                  </li>
                ))}
              </ul>
            )}
            {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
            <p className="mt-3 text-[11px] text-[var(--color-ink-400)]">Changes here don&apos;t alter patients&apos; notes that already used a template.</p>
          </div>
        </div>
      )}
    </>
  );
}

/* ── OT notes: Load template menu ──────────────────────────────────────── */

export function LoadOtTemplate({ templates, surgery, starter, onLoad }: {
  templates: SavedTemplate[]; surgery: string | null; starter: string[]; onLoad: (steps: string[], name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useOutside<HTMLDivElement>(open, () => setOpen(false));
  const mine = templates.filter((t) => t.kind === "OT");
  const s = (surgery ?? "").toLowerCase();
  const forThis = mine.filter((t) => (t.surgery ?? "").toLowerCase() === s && s);
  const others = mine.filter((t) => !forThis.includes(t));
  const item = (label: string, sub: string, steps: string[], key: string) => (
    <button key={key} type="button" onClick={() => { onLoad(steps, label); setOpen(false); }} className="block w-full text-left px-3 py-2 hover:bg-[var(--color-primary-50)]">
      <span className="block text-sm font-semibold text-[var(--color-ink-800)]">{label}</span>
      <span className="block text-[11px] text-[var(--color-ink-400)]">{sub}</span>
    </button>
  );
  const head = (t: string) => <p className="px-3 pt-2 pb-1 text-[10.5px] font-bold uppercase tracking-wider text-[var(--color-ink-400)]">{t}</p>;
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((x) => !x)} className={btnG}><FolderOpen size={12} /> Load template <ChevronDown size={12} /></button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-80 max-h-80 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-white shadow-xl py-1">
          {forThis.length > 0 && <>{head("My templates for this surgery")}{forThis.map((t) => item(t.name, `${t.items.length} steps`, t.items, t.id))}</>}
          {others.length > 0 && <>{head("My other templates")}{others.map((t) => item(t.name, `${t.items.length} steps${t.surgery ? ` · ${t.surgery}` : ""}`, t.items, t.id))}</>}
          {head("Starter")}
          {item(`Starter template${surgery ? ` · ${surgery}` : ""}`, `${starter.length} steps`, starter, "starter")}
        </div>
      )}
    </div>
  );
}

/* ── Education: searchable set picker ──────────────────────────────────── */

export interface PickableSet { id: string; label: string; points: string[]; mine?: boolean }

export function EducationSetPicker({ value, sets, onPick, disabled }: { value: string; sets: PickableSet[]; onPick: (s: PickableSet) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useOutside<HTMLDivElement>(open, () => setOpen(false));
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? sets.filter((x) => x.label.toLowerCase().includes(t)) : sets;
  }, [q, sets]);
  const mine = shown.filter((x) => x.mine);
  const std = shown.filter((x) => !x.mine);
  const row = (x: PickableSet) => (
    <button key={x.id} type="button" onClick={() => { onPick(x); setOpen(false); setQ(""); }}
      className={`block w-full text-left px-3 py-1.5 hover:bg-[var(--color-primary-50)] ${x.label === value ? "bg-[var(--color-primary-50)]" : ""}`}>
      <span className="text-sm text-[var(--color-ink-800)]">{x.label}</span>
      <span className="ml-1.5 text-[11px] text-[var(--color-ink-400)]">{x.points.length} points</span>
    </button>
  );
  const head = (t: string) => <p className="px-3 pt-2 pb-1 text-[10.5px] font-bold uppercase tracking-wider text-[var(--color-ink-400)]">{t}</p>;
  return (
    <div ref={ref} className="relative w-full max-w-md">
      <button type="button" disabled={disabled} onClick={() => setOpen((x) => !x)}
        className="w-full flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-left text-sm text-[var(--color-ink-800)] disabled:cursor-default disabled:bg-[var(--color-surface-sunken)]/50">
        <span className="truncate"><span className="text-[var(--color-ink-400)]">Education set: </span><b>{value || "Choose"}</b></span>
        {!disabled && <ChevronDown size={14} className="shrink-0 text-[var(--color-ink-400)]" />}
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-[var(--color-border)] bg-white shadow-xl">
          <div className="relative p-2 border-b border-[var(--color-border)]">
            <Search size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-ink-300)]" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search surgery or set" className={`${inp} pl-7`} />
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {mine.length > 0 && <>{head("My sets")}{mine.map(row)}</>}
            {std.length > 0 && <>{head("Standard sets")}{std.map(row)}</>}
            {shown.length === 0 && <p className="px-3 py-3 text-sm text-[var(--color-ink-400)]">No matching set.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
