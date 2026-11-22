"use client";

// Browser-style tabs (like Google Chrome): rounded tabs, the open one joins the panel
// below it, a × on every tab, a + to add, and drag to reorder.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";

export interface ChromeTab {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  /** Small extras after the label (badges, camera). */
  extra?: ReactNode;
  /** Shows the × on this tab. */
  closable?: boolean;
  /** Plain text used for the × label. */
  title?: string;
  /** A thin vertical line before this tab. */
  separatorBefore?: boolean;
}

/** Applies a saved order to a list of ids; ids that are not in the saved order keep their place at the end. */
export function applyOrder<T extends { id: string }>(items: T[], saved: string[]): T[] {
  if (!saved.length) return items;
  const rank = new Map(saved.map((id, i) => [id, i]));
  return items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => (rank.get(a.it.id) ?? 1e6 + a.i) - (rank.get(b.it.id) ?? 1e6 + b.i))
    .map((x) => x.it);
}

/** A list kept in the browser per key (the tab order of one file). */
export function useSavedList(storageKey: string): [string[], (v: string[]) => void] {
  const [list, setList] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const v = raw ? JSON.parse(raw) : [];
      setList(Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
    } catch { setList([]); }
  }, [storageKey]);
  const save = (v: string[]) => {
    setList(v);
    try { localStorage.setItem(storageKey, JSON.stringify(v)); } catch { /* storage may be blocked */ }
  };
  return [list, save];
}

export function ChromeTabBar({
  tabs, activeId, onSelect, onReorder, onClose, onAdd, reopen, onReopen, trailing, label = "Tabs", dragDisabled, variant = "chrome",
}: {
  tabs: ChromeTab[];
  activeId: string;
  onSelect: (id: string) => void;
  /** New order of the tab ids after a drag. */
  onReorder?: (ids: string[]) => void;
  onClose?: (id: string) => void;
  /** The + button (opens the add dialog). */
  onAdd?: () => void;
  /** Or: closed tabs the + button lists to reopen. */
  reopen?: { id: string; label: string; icon?: ReactNode }[];
  onReopen?: (id: string) => void;
  /** Extra controls after the +, not draggable. */
  trailing?: ReactNode;
  label?: string;
  dragDisabled?: boolean;
  /** "chrome": rounded tabs joined to the panel. "underline": plain tabs with an underline on the open one. */
  variant?: "chrome" | "underline";
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<{ id: string; after: boolean } | null>(null);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const off = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener("mousedown", off);
    return () => document.removeEventListener("mousedown", off);
  }, [menu]);

  const drop = () => {
    if (dragId && over && dragId !== over.id && onReorder) {
      const ids = tabs.map((t) => t.id).filter((id) => id !== dragId);
      const at = ids.indexOf(over.id);
      ids.splice(over.after ? at + 1 : at, 0, dragId);
      onReorder(ids);
    }
    setDragId(null); setOver(null);
  };

  const canDrag = !!onReorder && !dragDisabled && tabs.length > 1;
  const underline = variant === "underline";

  return (
    <div role="tablist" aria-label={label} className={underline ? "flex flex-wrap items-center gap-1 border-b border-[var(--color-border)] mb-5" : "sticky top-0 z-20 flex flex-wrap items-end gap-x-1 gap-y-0.5 px-1 pt-1 -mb-px bg-[var(--color-bg)]"}>
      {tabs.map((t) => {
        const on = t.id === activeId;
        const dropBefore = over?.id === t.id && !over.after && dragId !== t.id;
        const dropAfter = over?.id === t.id && over.after && dragId !== t.id;
        return (
          <div key={t.id} data-tab={t.id}
            style={!underline && !on ? { borderColor: "transparent" } : undefined}
            draggable={canDrag}
            onDragStart={(e) => { setDragId(t.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", t.id); }}
            onDragOver={(e) => {
              if (!dragId) return;
              e.preventDefault(); e.dataTransfer.dropEffect = "move";
              const r = e.currentTarget.getBoundingClientRect();
              setOver({ id: t.id, after: e.clientX > r.left + r.width / 2 });
            }}
            onDrop={(e) => { e.preventDefault(); drop(); }}
            onDragEnd={() => { setDragId(null); setOver(null); }}
            className={`group relative shrink-0 flex items-center whitespace-nowrap transition-colors ${dragId === t.id ? "opacity-40" : ""} ${
              underline
                ? `text-sm font-medium ${on ? "text-[var(--color-primary-700)]" : "text-[var(--color-ink-500)] hover:text-[var(--color-ink-700)]"}`
                : `h-10 rounded-t-xl border border-b-0 text-xs font-semibold ${on
                  ? "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-ink-900)] shadow-[0_-1px_4px_rgba(15,23,42,0.05)]"
                  : "bg-transparent border-transparent text-[var(--color-ink-500)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink-700)]"}`
            }`}>
            {t.separatorBefore && !underline && <span aria-hidden className="pointer-events-none absolute -left-1.5 top-1/2 h-5 w-px -translate-y-1/2 bg-[var(--color-border)]" />}
            {dropBefore && <span className="absolute -left-[3px] top-1.5 bottom-1.5 w-[3px] rounded-full bg-[var(--color-primary-500)]" />}
            {dropAfter && <span className="absolute -right-[3px] top-1.5 bottom-1.5 w-[3px] rounded-full bg-[var(--color-primary-500)]" />}
            <button type="button" role="tab" aria-selected={on} onClick={() => onSelect(t.id)}
              className={`inline-flex h-full items-center outline-none ${underline ? "gap-1.5 px-4 py-2.5" : `gap-2 pl-3 ${t.closable && onClose && on ? "pr-1" : "pr-3.5"}`} ${canDrag ? "cursor-grab active:cursor-grabbing" : ""}`}>
              {t.icon}<span>{t.label}</span>{t.extra}
            </button>
            {t.closable && onClose && on && (
              <button type="button" aria-label={`Close ${t.title ?? "tab"}`} title="Close this tab"
                onClick={(e) => { e.stopPropagation(); onClose(t.id); }}
                className={`${underline ? "mr-2" : "mr-1.5"} grid h-5 w-5 place-items-center rounded-full text-[var(--color-ink-400)] hover:bg-red-50 hover:text-red-600`}>
                <X size={12} />
              </button>
            )}
            {underline && on && <span aria-hidden className="absolute left-0 right-0 -bottom-px h-[2px] bg-[var(--color-primary-600)]" />}
          </div>
        );
      })}

      {(onAdd || (reopen && reopen.length > 0)) && (
        <div ref={menuRef} className="relative shrink-0 mb-1">
          <button type="button" title={onAdd ? "Add tabs" : "Reopen a closed tab"} aria-label={onAdd ? "Add tabs" : "Reopen a closed tab"}
            onClick={() => (onAdd ? onAdd() : setMenu((v) => !v))}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)]">
            <Plus size={16} />
          </button>
          {menu && reopen && (
            <div className="absolute left-0 top-9 z-30 min-w-[11rem] rounded-xl border border-[var(--color-border)] bg-white p-1 shadow-lg">
              {reopen.map((r) => (
                <button key={r.id} type="button" onClick={() => { setMenu(false); onReopen?.(r.id); }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-primary-50)]">
                  {r.icon}{r.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {trailing}
    </div>
  );
}
