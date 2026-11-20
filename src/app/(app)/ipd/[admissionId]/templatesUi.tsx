"use client";

// The doctor's own OT note templates and education sets, managed from inside
// the forms (no settings page): load, save as mine, rename, delete.

import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { BookmarkPlus, Check, ChevronDown, FolderOpen, Loader2, Pencil, Plus, Search, Settings2, Trash2, X } from "lucide-react";
import { deleteIpdTemplate, renameIpdTemplate, saveIpdTemplate, updateIpdTemplate } from "../actions";
import { MatchHighlight } from "@/components/ui/MatchHighlight";
import { MedicationEntry, type MedicationDraft } from "@/components/emr/MedicationEntry";

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
                        onBlur={() => rename(t)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); rename(t); } }} className={inp} aria-label="Name" />
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
      <span className="text-sm text-[var(--color-ink-800)]"><MatchHighlight text={x.label} term={q} /></span>
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

/* ── Education library: this surgery's sets, one simple list ─────────────── */

export interface LibrarySet { id: string; label: string; surgery: string | null; points: string[]; mine?: boolean }

/**
 * One "Library" button: a short list of this surgery's sets (the standard one
 * and the doctor's own). Tap a set to see its points, "Use" to put it on the
 * sheet; own sets can be edited or deleted, and "New set" starts from the
 * points on the sheet.
 */
export function EducationLibrary({ stage, standard, others = [], templates, surgery, current, active, onUse, onAddPoints, disabled }: {
  stage: "pre" | "post";
  standard: { id: string; label: string; points: string[] }[];
  /** Every other surgery's standard set, to copy points from. */
  others?: { id: string; label: string; points: string[] }[];
  templates: SavedTemplate[];
  surgery: string | null;
  /** The points on the sheet now (a new set starts from them). */
  current: string[];
  /** The set on the sheet now. */
  active?: string;
  onUse: (set: LibrarySet) => void;
  /** Copy points from another surgery: add them to the sheet's points, or use only them. */
  onAddPoints?: (points: string[], how: "add" | "replace", from: string) => void;
  disabled?: boolean;
}) {
  const router = useRouter();
  const kind = stage === "pre" ? "EDUCATION_PRE" : "EDUCATION";
  const [open, setOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [edit, setEdit] = useState<null | { id: string | null; name: string; points: string[] }>(null);
  const [point, setPoint] = useState("");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  // Copying from another surgery: search, the picked set and its ticked points
  const [oq, setOq] = useState("");
  const [pickId, setPickId] = useState<string | null>(null);
  const [ticked, setTicked] = useState<Set<number>>(new Set());
  const otherSets = useMemo(() => [
    // The doctor's sets saved for other surgeries, then every other surgery's standard set
    ...templates.filter((t) => t.kind === kind && !!surgery && (t.surgery ?? "").trim().toLowerCase() !== surgery.trim().toLowerCase())
      .map((t) => ({ id: t.id, label: t.name, sub: t.surgery ? `My set · ${t.surgery}` : "My set", points: t.items })),
    ...others.map((x) => ({ id: x.id, label: x.label, sub: "Prebuilt", points: x.points })),
  ], [templates, others, kind, surgery]);
  const otherShown = useMemo(() => {
    const t = oq.trim().toLowerCase();
    return t ? otherSets.filter((x) => `${x.label} ${x.sub}`.toLowerCase().includes(t)) : otherSets;
  }, [oq, otherSets]);
  const picked = otherSets.find((x) => x.id === pickId) ?? null;
  const pickSet = (id: string) => {
    const x = otherSets.find((y) => y.id === id);
    setPickId(id === pickId ? null : id);
    setTicked(new Set(x ? x.points.map((_, i) => i) : []));
  };

  const sets: LibrarySet[] = useMemo(() => [
    ...standard.map((x) => ({ id: x.id, label: x.label, surgery: x.label, points: x.points })),
    ...templates.filter((t) => t.kind === kind && (!surgery || (t.surgery ?? "").trim().toLowerCase() === surgery.trim().toLowerCase()))
      .map((t) => ({ id: t.id, label: t.name, surgery: t.surgery, points: t.items, mine: true })),
  ], [templates, standard, kind, surgery]);

  const close = () => { setOpen(false); setEdit(null); setError(""); setConfirmDel(null); setPickId(null); setOq(""); };
  const save = () => start(async () => {
    if (!edit) return;
    const r = edit.id
      ? await updateIpdTemplate(edit.id, edit.name, surgery, edit.points)
      : await saveIpdTemplate(kind, edit.name, surgery, edit.points);
    if (r.error) { setError(r.error); return; }
    setError(""); setEdit(null); router.refresh();
  });
  const del = (id: string) => start(async () => {
    const r = await deleteIpdTemplate(id);
    if (r.error) { setError(r.error); return; }
    setConfirmDel(null); router.refresh();
  });
  const addPoint = () => { if (!edit || !point.trim()) return; setEdit({ ...edit, points: [...edit.points, point.trim()] }); setPoint(""); };
  const btnP = "inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-[var(--color-primary-600)] text-white text-xs font-semibold hover:bg-[var(--color-primary-700)] disabled:opacity-50 transition-colors";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btnG}><FolderOpen size={12} /> Library</button>
      {open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--color-ink-900)]">{stage === "pre" ? "Pre-op" : "Post-op"} education sets</p>
                {surgery && <p className="truncate text-xs text-[var(--color-ink-500)]">{surgery}</p>}
              </div>
              <button type="button" onClick={close} aria-label="Close" className="p-1.5 rounded-full text-[var(--color-ink-400)] hover:bg-[var(--color-surface-sunken)]"><X size={16} /></button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-2">
              {edit ? (
                // New set (from the sheet's points) or editing an own set
                <div className="space-y-2.5">
                  <input autoFocus value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Name this set" className={inp} />
                  <ul className="space-y-1">
                    {edit.points.map((p, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <input value={p} onChange={(e) => setEdit({ ...edit, points: edit.points.map((x, j) => (j === i ? e.target.value : x)) })} className={inp} />
                        <button type="button" onClick={() => setEdit({ ...edit, points: edit.points.filter((_, j) => j !== i) })} aria-label="Remove point" className="p-1 rounded-full text-[var(--color-ink-300)] hover:bg-red-50 hover:text-red-600"><X size={13} /></button>
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-1.5">
                    <input value={point} onChange={(e) => setPoint(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPoint(); } }} placeholder="Add a point, then Enter" className={inp} />
                    <button type="button" disabled={!point.trim()} onClick={addPoint} className={btnG}>Add</button>
                  </div>
                  {error && <p className="text-xs text-red-600">{error}</p>}
                  <div className="flex justify-end gap-1.5 pt-1">
                    <button type="button" onClick={() => { setEdit(null); setError(""); }} className={btnG}>Cancel</button>
                    <button type="button" disabled={pending || !edit.name.trim() || !edit.points.some((x) => x.trim())} onClick={save} className={btnP}>
                      {pending && <Loader2 size={12} className="animate-spin" />} Save set
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {sets.map((x, i) => {
                    const inUse = x.label === active;
                    const expanded = openId === x.id;
                    // Section label before the first prebuilt set and the first own set
                    const label = i === 0 ? "Prebuilt for this surgery" : x.mine && !sets[i - 1].mine ? "My sets" : null;
                    return (
                      <Fragment key={x.id}>
                      {label && <p className="px-1 pt-1 text-[10.5px] font-bold uppercase tracking-wider text-[var(--color-ink-400)]">{label}</p>}
                      <div className={`rounded-xl border transition-colors ${inUse ? "border-[var(--color-primary-300)] bg-[var(--color-primary-50)]/40" : "border-[var(--color-border)] bg-white"}`}>
                        <div className="flex items-center gap-2 px-3 py-2">
                          <button type="button" onClick={() => setOpenId(expanded ? null : x.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                            <ChevronDown size={14} className={`shrink-0 text-[var(--color-ink-400)] transition-transform ${expanded ? "" : "-rotate-90"}`} />
                            <span className="min-w-0">
                              <span className="block truncate text-[13px] font-semibold text-[var(--color-ink-900)]">{x.mine ? x.label : x.label === standard[0]?.label ? "Standard set" : x.label.replace(`${standard[0]?.label} · `, "")}</span>
                              <span className="block text-[11px] text-[var(--color-ink-400)]">{x.mine ? "My set" : "Prebuilt"} · {x.points.length} points</span>
                            </span>
                          </button>
                          {x.mine && !disabled && (
                            confirmDel === x.id ? (
                              <button type="button" disabled={pending} onClick={() => del(x.id)} className="h-7 rounded-full bg-red-600 px-2.5 text-[11px] font-semibold text-white hover:bg-red-700">Delete?</button>
                            ) : (
                              <>
                                <button type="button" title="Edit" aria-label={`Edit ${x.label}`} onClick={() => { setEdit({ id: x.id, name: x.label, points: x.points }); setError(""); }} className="p-1.5 rounded-full text-[var(--color-ink-400)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink-700)]"><Settings2 size={13} /></button>
                                <button type="button" title="Delete" aria-label={`Delete ${x.label}`} onClick={() => setConfirmDel(x.id)} className="p-1.5 rounded-full text-[var(--color-ink-400)] hover:bg-red-50 hover:text-red-600"><Trash2 size={13} /></button>
                              </>
                            )
                          )}
                          {inUse
                            ? <span className="rounded-full bg-[var(--color-primary-100)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-primary-700)]">In use</span>
                            : !disabled && <button type="button" onClick={() => { onUse(x); close(); }} className={btnP}>Use</button>}
                        </div>
                        {expanded && (
                          <ol className="list-decimal space-y-1 border-t border-[var(--color-border)]/70 px-3 py-2 pl-8 text-[12.5px] leading-snug text-[var(--color-ink-700)]">
                            {x.points.map((p, i) => <li key={i}>{p}</li>)}
                          </ol>
                        )}
                      </div>
                      </Fragment>
                    );
                  })}
                  {error && <p className="text-xs text-red-600">{error}</p>}

                  {/* Copy points from another surgery's set */}
                  {onAddPoints && !disabled && otherSets.length > 0 && (
                    <div className="pt-2">
                      <p className="px-1 pb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-[var(--color-ink-400)]">From another surgery</p>
                      <div className="rounded-xl border border-[var(--color-border)] bg-white">
                        <div className="relative border-b border-[var(--color-border)]/70 p-2">
                          <Search size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-ink-300)]" />
                          <input value={oq} onChange={(e) => setOq(e.target.value)} placeholder="Search a surgery" className={`${inp} h-8 rounded-full pl-7 text-[13px]`} />
                        </div>
                        <div className="max-h-60 overflow-y-auto py-1">
                          {otherShown.map((x) => (
                            <div key={x.id}>
                              <button type="button" onClick={() => pickSet(x.id)}
                                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors ${pickId === x.id ? "bg-[var(--color-primary-50)]" : "hover:bg-[var(--color-surface-sunken)]"}`}>
                                <ChevronDown size={13} className={`shrink-0 text-[var(--color-ink-400)] transition-transform ${pickId === x.id ? "" : "-rotate-90"}`} />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[13px] text-[var(--color-ink-800)]"><MatchHighlight text={x.label} term={oq} /></span>
                                  <span className="block text-[11px] text-[var(--color-ink-400)]">{x.sub} · {x.points.length} points</span>
                                </span>
                              </button>
                              {pickId === x.id && picked && (
                                <div className="border-y border-[var(--color-border)]/60 bg-[var(--color-surface-sunken)]/40 px-3 py-2">
                                  <ul className="space-y-1">
                                    {picked.points.map((pt, i) => {
                                      const on = ticked.has(i);
                                      const already = current.includes(pt);
                                      return (
                                        <li key={i}>
                                          <label className={`flex cursor-pointer items-start gap-2 rounded-lg px-1.5 py-1 text-[12.5px] leading-snug ${already ? "text-[var(--color-ink-400)]" : "text-[var(--color-ink-700)]"} hover:bg-white`}>
                                            <input type="checkbox" checked={on} onChange={() => { const n = new Set(ticked); if (on) n.delete(i); else n.add(i); setTicked(n); }} className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[var(--color-primary-600)]" />
                                            <span>{pt}{already && <span className="ml-1 text-[10.5px] italic">(already on the sheet)</span>}</span>
                                          </label>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                  <div className="mt-2 flex flex-wrap justify-end gap-1.5">
                                    <button type="button" disabled={ticked.size === 0}
                                      onClick={() => { onAddPoints(picked.points.filter((_, i) => ticked.has(i)), "replace", picked.label); close(); }}
                                      className={`${btnG} disabled:opacity-40`}>Use only these</button>
                                    <button type="button" disabled={ticked.size === 0}
                                      onClick={() => { onAddPoints(picked.points.filter((_, i) => ticked.has(i)), "add", picked.label); close(); }}
                                      className={btnP}><Plus size={12} /> Add {ticked.size} point{ticked.size === 1 ? "" : "s"}</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                          {otherShown.length === 0 && <p className="px-3 py-2 text-sm text-[var(--color-ink-400)]">No matching surgery.</p>}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {!edit && !disabled && (
              <div className="border-t border-[var(--color-border)] px-3 py-2.5">
                <button type="button" onClick={() => { setEdit({ id: null, name: `My set · ${surgery || "Education"}`, points: current.filter((x) => x.trim()) }); setError(""); }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--color-primary-300)] py-2 text-xs font-semibold text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)]">
                  <BookmarkPlus size={13} /> New set from the points on the sheet
                </button>
              </div>
            )}
          </div>
        </div>, document.body
      )}
    </>
  );
}

/* ── After a custom point: save the whole set as a new Library set ──────── */

/**
 * Shown once a point is added to the sheet's set: saves all its points as a
 * new set of the doctor's in the Library (name editable), then the sheet uses it.
 */
export function SaveSetPrompt({ stage, surgery, points, defaultName, onSaved, onDismiss }: {
  stage: "pre" | "post"; surgery: string | null; points: string[]; defaultName: string;
  onSaved: (name: string) => void; onDismiss: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const save = () => start(async () => {
    const r = await saveIpdTemplate(stage === "pre" ? "EDUCATION_PRE" : "EDUCATION", name, surgery, points);
    if (r.error) { setError(r.error); return; }
    onSaved(name.trim());
    router.refresh();
  });
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-[var(--color-primary-200)] shadow-sm">
      <BookmarkPlus size={14} className="shrink-0 text-[var(--color-primary-600)]" />
      <span className="text-xs text-[var(--color-ink-600)]">Save this set with your point as a new set in the Library?</span>
      <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }}
        placeholder="Set name" className={`${inp} h-8 w-60 py-1 text-xs`} />
      <button type="button" disabled={pending || !name.trim()} onClick={save}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-[var(--color-primary-600)] text-white text-xs font-semibold disabled:opacity-50 hover:bg-[var(--color-primary-700)]">
        {pending && <Loader2 size={12} className="animate-spin" />} Save as new set
      </button>
      <button type="button" onClick={onDismiss} className="h-8 px-2 text-xs font-semibold text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)]">Not now</button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

/* ── Edit education: one pencil, a point / medication slider ────────────── */

type PointWay = "existing" | "scratch" | "other";
interface SimpleSet { id: string; label: string; sub: string; points: string[] }

/**
 * The pencil on the education card. A slider picks "Add a point" or "Add a
 * medication". Points can be added to the points already on the sheet, or a
 * new set made from scratch, or one made from another surgery's set with
 * extra points; a new set is saved to the doctor's sets for this surgery and
 * used on the sheet. Saved sets (prebuilt and own) stay one tap away.
 */
export function EducationEditDialog({ stage, surgery, current, others, templates, standard, active, defaultEye, onAddPoints, onUseSet, onAddMed, medCount }: {
  stage: "pre" | "post";
  surgery: string | null;
  current: string[];
  /** Every other surgery's prebuilt set. */
  others: { id: string; label: string; points: string[] }[];
  templates: SavedTemplate[];
  /** This surgery's prebuilt sets (for "Saved sets"). */
  standard: { id: string; label: string; points: string[] }[];
  active?: string;
  defaultEye: string;
  onAddPoints: (points: string[]) => void;
  onUseSet: (label: string, points: string[]) => void;
  onAddMed: (m: MedicationDraft) => void;
  medCount: number;
}) {
  const router = useRouter();
  const kind = stage === "pre" ? "EDUCATION_PRE" : "EDUCATION";
  const stageText = stage === "pre" ? "Pre-op" : "Post-op";
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"point" | "medication">("point");
  const [way, setWay] = useState<PointWay>("existing");
  const [point, setPoint] = useState("");
  const [added, setAdded] = useState<string[]>([]);
  // A new set (scratch or from another surgery)
  const [name, setName] = useState("");
  const [points, setPoints] = useState<string[]>([]);
  const [fromId, setFromId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [medsAdded, setMedsAdded] = useState(0);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const otherSets: SimpleSet[] = useMemo(() => [
    ...templates.filter((t) => t.kind === kind && !!surgery && (t.surgery ?? "").trim().toLowerCase() !== surgery.trim().toLowerCase())
      .map((t) => ({ id: t.id, label: t.name, sub: t.surgery ? `My set · ${t.surgery}` : "My set", points: t.items })),
    ...others.map((x) => ({ id: x.id, label: x.label, sub: "Prebuilt", points: x.points })),
  ], [templates, others, kind, surgery]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? otherSets.filter((x) => `${x.label} ${x.sub}`.toLowerCase().includes(t)) : otherSets;
  }, [q, otherSets]);
  const from = otherSets.find((x) => x.id === fromId) ?? null;

  const reset = () => { setPoint(""); setAdded([]); setName(""); setPoints([]); setFromId(null); setQ(""); setError(""); setMedsAdded(0); };
  const close = () => { setOpen(false); reset(); };
  const chooseWay = (w: PointWay) => {
    setWay(w); setPoint(""); setError("");
    setPoints([]); setFromId(null);
    setName(w === "scratch" ? `My set · ${surgery || stageText}` : "");
  };
  const addExisting = () => {
    const t = point.trim();
    if (!t) return;
    if (!current.includes(t) && !added.includes(t)) { onAddPoints([t]); setAdded([...added, t]); }
    setPoint("");
  };
  const addToNew = () => { const t = point.trim(); if (t && !points.includes(t)) setPoints([...points, t]); setPoint(""); };
  const pickFrom = (x: SimpleSet) => { setFromId(x.id); setPoints(x.points); setName(`My set · ${surgery || stageText} (from ${x.label})`); };
  const saveNew = () => start(async () => {
    const list = [...points, point.trim()].filter(Boolean);
    const r = await saveIpdTemplate(kind, name, surgery, list);
    if (r.error) { setError(r.error); return; }
    onUseSet(name.trim(), list);
    router.refresh();
    close();
  });

  const btnP = "inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-[var(--color-primary-600)] text-white text-xs font-semibold hover:bg-[var(--color-primary-700)] disabled:opacity-50 transition-colors";
  const tile = (w: PointWay, title: string, sub: string) => (
    <button type="button" onClick={() => chooseWay(w)}
      className={`flex-1 min-w-[150px] rounded-xl px-3 py-2 text-left ring-1 transition-all focus:outline-none ${way === w ? "bg-[var(--color-primary-50)] ring-[var(--color-primary-300)] shadow-sm" : "bg-white ring-[var(--color-border)] hover:ring-[var(--color-primary-200)]"}`}>
      <span className={`block text-[12.5px] font-semibold ${way === w ? "text-[var(--color-primary-700)]" : "text-[var(--color-ink-800)]"}`}>{title}</span>
      <span className="block text-[11px] leading-snug text-[var(--color-ink-400)]">{sub}</span>
    </button>
  );
  // Editable list for a new set's points
  const newList = (
    <ul className="space-y-1">
      {points.map((p, i) => (
        <li key={i} className="flex items-center gap-1.5">
          <input value={p} onChange={(e) => setPoints(points.map((x, j) => (j === i ? e.target.value : x)))} className={`${inp} h-8 text-[13px]`} />
          <button type="button" onClick={() => setPoints(points.filter((_, j) => j !== i))} aria-label="Remove point" className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[var(--color-ink-300)] hover:bg-red-50 hover:text-red-600"><X size={12} strokeWidth={2.5} /></button>
        </li>
      ))}
    </ul>
  );
  const pointInput = (onAdd: () => void, placeholder: string) => (
    <div className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white py-1 pl-3 pr-1">
      <Plus size={13} className="shrink-0 text-[var(--color-primary-500)]" />
      <input autoFocus value={point} onChange={(e) => setPoint(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAdd(); } }}
        placeholder={placeholder} className="flex-1 min-w-0 h-7 bg-transparent text-[13px] placeholder:text-[var(--color-ink-300)] focus:outline-none" />
      <button type="button" disabled={!point.trim()} onClick={onAdd} className="h-7 px-3 rounded-full bg-[var(--color-primary-600)] text-white text-xs font-semibold disabled:opacity-40 hover:bg-[var(--color-primary-700)]">Add</button>
    </div>
  );

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Edit education" aria-label="Edit education"
      className="grid h-8 w-8 place-items-center rounded-full text-[var(--color-primary-700)] ring-1 ring-[var(--color-primary-200)] bg-white hover:bg-[var(--color-primary-50)] transition-colors focus:outline-none focus-visible:ring-2"><Pencil size={14} /></button>
      {open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--color-ink-900)]">Edit {stageText.toLowerCase()} education</p>
                {surgery && <p className="truncate text-xs text-[var(--color-ink-500)]">{surgery}</p>}
              </div>
              <button type="button" onClick={close} aria-label="Close" className="p-1.5 rounded-full text-[var(--color-ink-400)] hover:bg-[var(--color-surface-sunken)]"><X size={16} /></button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-3">
              {/* Slider: a point or a medication */}
              <div className="relative grid grid-cols-2 rounded-full bg-[var(--color-surface-sunken)] p-1 text-xs font-semibold">
                <span aria-hidden className={`absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-white shadow-sm ring-1 ring-[var(--color-primary-200)] transition-transform duration-200 ${mode === "medication" ? "translate-x-full" : ""}`} />
                {(["point", "medication"] as const).map((m) => (
                  <button key={m} type="button" onClick={() => { setMode(m); setError(""); }}
                    className={`relative z-10 rounded-full py-1.5 transition-colors focus:outline-none ${mode === m ? "text-[var(--color-primary-700)]" : "text-[var(--color-ink-500)] hover:text-[var(--color-ink-700)]"}`}>
                    {m === "point" ? "Add a point" : "Add a medication"}
                  </button>
                ))}
              </div>

              {mode === "medication" ? (
                <div className="space-y-2">
                  <MedicationEntry stacked addLabel="Add medication" defaultEye={defaultEye} onAdd={(m) => { onAddMed(m); setMedsAdded((n) => n + 1); }} />
                  <p className="text-[11.5px] text-[var(--color-ink-400)]">{medCount} medicine{medCount === 1 ? "" : "s"} on the sheet{medsAdded ? ` · ${medsAdded} added now` : ""}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {tile("existing", "Add to these points", `Add to the ${current.length} points on the sheet`)}
                    {tile("scratch", "New set from scratch", "Write your own points")}
                    {tile("other", "From another surgery", "Copy its points, then add more")}
                  </div>

                  {way === "existing" && (
                    <div className="space-y-2">
                      {pointInput(addExisting, "Type a point, then Enter")}
                      {added.length > 0 && (
                        <>
                          <ul className="space-y-1">
                            {added.map((p) => <li key={p} className="flex items-start gap-2 text-[12.5px] text-[var(--color-ink-700)]"><Check size={13} className="mt-0.5 shrink-0 text-emerald-500" />{p}</li>)}
                          </ul>
                          <SaveSetPrompt stage={stage} surgery={surgery} points={[...current, ...added]} defaultName={`My set · ${surgery || stageText}`}
                            onSaved={(n) => { onUseSet(n, [...current, ...added]); close(); }} onDismiss={() => setAdded([])} />
                        </>
                      )}
                    </div>
                  )}

                  {way === "scratch" && (
                    <div className="space-y-2">
                      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name this set" className={inp} />
                      {newList}
                      {pointInput(addToNew, "Add a point, then Enter")}
                    </div>
                  )}

                  {way === "other" && (
                    from ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2 rounded-xl bg-[var(--color-surface-sunken)]/60 px-3 py-1.5">
                          <span className="min-w-0 truncate text-[12px] text-[var(--color-ink-600)]">From <b className="text-[var(--color-ink-800)]">{from.label}</b></span>
                          <button type="button" onClick={() => { setFromId(null); setPoints([]); }} className="shrink-0 text-[11.5px] font-semibold text-[var(--color-primary-700)] hover:underline">Change</button>
                        </div>
                        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name this set" className={inp} />
                        {newList}
                        {pointInput(addToNew, "Add more points, then Enter")}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-[var(--color-border)]">
                        <div className="relative border-b border-[var(--color-border)]/70 p-2">
                          <Search size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-ink-300)]" />
                          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a surgery" className={`${inp} h-8 rounded-full pl-7 text-[13px]`} />
                        </div>
                        <div className="max-h-56 overflow-y-auto py-1">
                          {shown.map((x) => (
                            <button key={x.id} type="button" onClick={() => pickFrom(x)} className="block w-full px-3 py-1.5 text-left hover:bg-[var(--color-primary-50)]">
                              <span className="block truncate text-[13px] text-[var(--color-ink-800)]"><MatchHighlight text={x.label} term={q} /></span>
                              <span className="block text-[11px] text-[var(--color-ink-400)]">{x.sub} · {x.points.length} points</span>
                            </button>
                          ))}
                          {shown.length === 0 && <p className="px-3 py-2 text-sm text-[var(--color-ink-400)]">No matching surgery.</p>}
                        </div>
                      </div>
                    )
                  )}
                  {error && <p className="text-xs text-red-600">{error}</p>}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)] px-4 py-2.5">
              {/* Prebuilt and own sets for this surgery */}
              <EducationLibrary stage={stage} standard={standard} templates={templates} surgery={surgery} current={current} active={active}
                onUse={(x) => { onUseSet(x.label, x.points); close(); }} />
              {mode === "point" && way !== "existing" ? (
                <button type="button" disabled={pending || !name.trim() || ![...points, point].some((x) => x.trim())} onClick={saveNew} className={btnP}>
                  {pending && <Loader2 size={12} className="animate-spin" />} Save and use
                </button>
              ) : (
                <button type="button" onClick={close} className={btnP}>Done</button>
              )}
            </div>
          </div>
        </div>, document.body
      )}
    </>
  );
}

/* ── Education sets dialog: every set for every surgery, with search ────── */

/**
 * The pencil on the education card, like the EMR protocol list: this surgery's
 * sets first, then every other surgery's, then the doctor's own. Search narrows
 * the list, a row opens to show its points, "Use" puts the set on the sheet,
 * and "New set" saves a custom one.
 */
export function EducationSetsDialog({ stage, surgery, standard, others, templates, active, onUse }: {
  stage: "pre" | "post";
  surgery: string | null;
  standard: { id: string; label: string; points: string[] }[];
  others: { id: string; label: string; points: string[] }[];
  templates: SavedTemplate[];
  active?: string;
  onUse: (label: string, points: string[]) => void;
}) {
  const router = useRouter();
  const kind = stage === "pre" ? "EDUCATION_PRE" : "EDUCATION";
  const stageText = stage === "pre" ? "Pre-op" : "Post-op";
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const groups = useMemo(() => {
    const mine = templates.filter((t) => t.kind === kind).map((t) => ({ id: t.id, label: t.name, sub: t.surgery ? `My set · ${t.surgery}` : "My set", points: t.items }));
    const all = [
      { title: surgery ? `For ${surgery}` : "For this surgery", sets: standard.map((x) => ({ id: x.id, label: x.label, sub: "Prebuilt", points: x.points })) },
      { title: "Other surgeries", sets: others.map((x) => ({ id: x.id, label: x.label, sub: "Prebuilt", points: x.points })) },
      { title: "My sets", sets: mine },
    ];
    const t = q.trim().toLowerCase();
    return all.map((g) => ({ ...g, sets: t ? g.sets.filter((s) => `${s.label} ${s.sub} ${s.points.join(" ")}`.toLowerCase().includes(t)) : g.sets })).filter((g) => g.sets.length > 0);
  }, [q, standard, others, templates, kind, surgery]);

  const close = () => { setOpen(false); setQ(""); setOpenId(null); setCreating(false); setName(""); setText(""); setError(""); };
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const saveNew = () => start(async () => {
    const r = await saveIpdTemplate(kind, name, surgery, lines);
    if (r.error) { setError(r.error); return; }
    onUse(name.trim(), lines);
    router.refresh();
    close();
  });

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Education sets" aria-label="Education sets"
        className="grid h-8 w-8 place-items-center rounded-full text-[var(--color-primary-700)] ring-1 ring-[var(--color-primary-200)] bg-white hover:bg-[var(--color-primary-50)] transition-colors focus:outline-none focus-visible:ring-2"><Pencil size={14} /></button>
      {open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
              <p className="text-sm font-semibold text-[var(--color-ink-900)]">{stageText} education sets</p>
              <button type="button" onClick={close} aria-label="Close" className="p-1.5 rounded-full text-[var(--color-ink-400)] hover:bg-[var(--color-surface-sunken)]"><X size={16} /></button>
            </div>

            {creating ? (
              <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-4">
                <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Name this set" className={inp} />
                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={7} placeholder="One point per line" className={`${inp} resize-none`} />
                {error && <p className="text-xs text-red-600">{error}</p>}
                <div className="flex justify-end gap-1.5">
                  <button type="button" onClick={() => { setCreating(false); setError(""); }} className={btnG}>Cancel</button>
                  <button type="button" disabled={pending || !name.trim() || lines.length === 0} onClick={saveNew}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[var(--color-primary-600)] px-3.5 text-xs font-semibold text-white hover:bg-[var(--color-primary-700)] disabled:opacity-50">
                    {pending && <Loader2 size={12} className="animate-spin" />} Save and use
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-2.5">
                  <div className="relative min-w-0 flex-1">
                    <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-300)]" />
                    <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sets or surgeries" className={`${inp} pl-8`} />
                  </div>
                  <button type="button" onClick={() => setCreating(true)} className={btnG}><Plus size={12} /> New set</button>
                </div>
                <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
                  {groups.length === 0 && <p className="py-6 text-center text-sm text-[var(--color-ink-400)]">No sets match.</p>}
                  {groups.map((g) => (
                    <Fragment key={g.title}>
                      <p className="px-1 pt-1.5 text-[10.5px] font-bold uppercase tracking-wider text-[var(--color-ink-400)]">{g.title}</p>
                      {g.sets.map((x) => {
                        const expanded = openId === x.id;
                        const inUse = x.label === active;
                        return (
                          <div key={x.id} className={`rounded-xl border ${inUse ? "border-[var(--color-primary-300)] bg-[var(--color-primary-50)]/40" : "border-[var(--color-border)] bg-white"}`}>
                            <div className="flex items-center gap-2 px-3 py-2">
                              <button type="button" onClick={() => setOpenId(expanded ? null : x.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                                <ChevronDown size={14} className={`shrink-0 text-[var(--color-ink-400)] transition-transform ${expanded ? "" : "-rotate-90"}`} />
                                <span className="min-w-0">
                                  <span className="block truncate text-[13px] font-semibold text-[var(--color-ink-900)]"><MatchHighlight text={x.label} term={q} /></span>
                                  <span className="block text-[11px] text-[var(--color-ink-400)]">{x.sub} · {x.points.length} points</span>
                                </span>
                              </button>
                              {inUse
                                ? <span className="rounded-full bg-[var(--color-primary-100)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-primary-700)]">In use</span>
                                : <button type="button" onClick={() => { onUse(x.label, x.points); close(); }}
                                    className="inline-flex h-8 items-center rounded-full bg-[var(--color-primary-600)] px-3.5 text-xs font-semibold text-white hover:bg-[var(--color-primary-700)]">Use</button>}
                            </div>
                            {expanded && (
                              <ol className="list-decimal space-y-1 border-t border-[var(--color-border)]/70 px-3 py-2 pl-8 text-[12.5px] text-[var(--color-ink-700)]">
                                {x.points.map((p, i) => <li key={i}>{p}</li>)}
                              </ol>
                            )}
                          </div>
                        );
                      })}
                    </Fragment>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
