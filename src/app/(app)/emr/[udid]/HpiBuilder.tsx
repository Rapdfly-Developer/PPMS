"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, Sparkles, Check, X } from "lucide-react";
import {
  HPI_GROUPS, HPI_CHARACTER_GROUPS, HPI_FACTOR_GROUP, HPI_NEGATIVES, HPI_NEGATIVES_PREFIX, negativeRowValue,
  type HpiFieldDef, type HpiFields,
} from "@/lib/hpi-builder";

const CTRL = "rounded-lg border border-[var(--color-border)] bg-white px-2 py-1 text-xs text-[var(--color-ink-700)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-400)] disabled:bg-[var(--color-surface-sunken)]";
const customKey = (k: string) => `kw_hpi_${k}`;

/** Custom options a doctor added for one field, kept per browser like keywords. */
function useCustomOptions(fieldKey: string) {
  const [custom, setCustom] = useState<string[]>([]);
  useEffect(() => {
    try { const raw = JSON.parse(localStorage.getItem(customKey(fieldKey)) || "[]"); if (Array.isArray(raw)) setCustom(raw); } catch {}
  }, [fieldKey]);
  const add = (v: string) => {
    const next = custom.includes(v) ? custom : [...custom, v];
    setCustom(next);
    try { localStorage.setItem(customKey(fieldKey), JSON.stringify(next)); } catch {}
  };
  return { custom, add };
}

function AddCustom({ onAdd }: { onAdd: (v: string) => void }) {
  const [val, setVal] = useState("");
  const submit = () => { const v = val.trim(); if (v) { onAdd(v); setVal(""); } };
  return (
    <div className="flex items-center gap-1 px-2 py-1.5 border-t border-[var(--color-border)]">
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
        placeholder="Add custom…"
        className={`${CTRL} flex-1 min-w-0`}
      />
      <button type="button" onClick={submit} className="p-1 rounded-md text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)]" aria-label="Add custom option">
        <Plus size={12} />
      </button>
    </div>
  );
}

/** One dropdown: single choice, or several when `multi`. Both accept custom options. */
function HpiSelect({ def, value, onChange, disabled }: { def: HpiFieldDef; value: string | string[] | undefined; onChange: (v: string | string[]) => void; disabled?: boolean }) {
  const { custom, add } = useCustomOptions(def.key);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const options = [...def.options, ...custom.filter((c) => !def.options.includes(c))];
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  const summary = selected.length ? selected.join(", ") : def.label;

  const pick = (opt: string) => {
    if (def.multi) onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]);
    else { onChange(selected[0] === opt ? "" : opt); setOpen(false); }
  };

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        title={selected.length ? `${def.label}: ${summary}` : def.label}
        className={`w-full h-8 flex items-center gap-1.5 rounded-lg border px-2.5 text-left text-xs transition-all disabled:bg-[var(--color-surface-sunken)] ${
          selected.length
            ? "border-[var(--color-primary-300)] bg-[var(--color-primary-50)] text-[var(--color-primary-800)] font-medium shadow-[0_1px_0_rgba(13,148,136,0.06)]"
            : "border-[var(--color-border)] bg-white text-[var(--color-ink-400)] hover:border-[var(--color-primary-300)]"
        } ${open ? "ring-2 ring-[var(--color-primary-100)] border-[var(--color-primary-400)]" : ""}`}
      >
        <span className="flex-1 min-w-0 truncate">{summary}</span>
        <ChevronDown size={12} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""} ${selected.length ? "text-[var(--color-primary-500)]" : "text-[var(--color-ink-300)]"}`} />
      </button>
      {open && (
        <div className="absolute z-30 left-0 mt-1.5 min-w-[230px] max-w-[320px] rounded-xl border border-[var(--color-border)] bg-white shadow-[0_12px_32px_-8px_rgba(15,23,42,0.18)] overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          <p className="px-2.5 pt-2 pb-1 text-micro font-bold uppercase tracking-widest text-[var(--color-ink-400)]">{def.label}{def.multi ? " · choose any" : ""}</p>
          <ul className="max-h-56 overflow-y-auto">
            {options.map((opt) => {
              const on = selected.includes(opt);
              return (
                <li key={opt}>
                  <button
                    type="button"
                    onClick={() => pick(opt)}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs transition-colors ${on ? "bg-[var(--color-primary-50)] text-[var(--color-primary-800)]" : "text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]"}`}
                  >
                    <span className={`w-3.5 h-3.5 shrink-0 flex items-center justify-center border ${def.multi ? "rounded" : "rounded-full"} ${on ? "bg-[var(--color-primary-600)] border-[var(--color-primary-600)]" : "border-[var(--color-ink-300)]"}`}>
                      {on && <Check size={9} className="text-white" />}
                    </span>
                    <span className="flex-1">{opt}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <AddCustom onAdd={(v) => { add(v); pick(v); }} />
        </div>
      )}
    </div>
  );
}

function Row({ letter, label, children }: { letter: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1.5 sm:gap-3 px-4 py-3">
      <div className="sm:w-44 shrink-0 flex items-center gap-2 sm:pt-1">
        <span className="w-5 h-5 rounded-full bg-[var(--color-primary-50)] border border-[var(--color-primary-100)] text-micro font-bold text-[var(--color-primary-700)] flex items-center justify-center shrink-0">{letter}</span>
        <p className="text-micro font-bold uppercase tracking-[0.12em] text-[var(--color-ink-500)] leading-tight">{label}</p>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function Fields({ defs, fields, set, disabled, cols = "sm:grid-cols-3" }: { defs: HpiFieldDef[]; fields: HpiFields; set: (k: string, v: string | string[]) => void; disabled?: boolean; cols?: string }) {
  return (
    <div className={`grid grid-cols-2 ${cols} gap-2`}>
      {defs.map((d) => <HpiSelect key={d.key} def={d} value={fields[d.key]} onChange={(v) => set(d.key, v)} disabled={disabled} />)}
    </div>
  );
}

const groupFilled = (defs: HpiFieldDef[], f: HpiFields) =>
  defs.some((d) => { const v = f[d.key]; return Array.isArray(v) ? v.length > 0 : !!v; });

export function HpiBuilder({ fields, onChange, onGenerate, disabled }: {
  fields: HpiFields;
  onChange: (f: HpiFields) => void;
  onGenerate: () => void;
  disabled?: boolean;
}) {
  const set = (k: string, v: string | string[]) => onChange({ ...fields, [k]: v });
  // Character sub-groups: open the ones that already hold selections.
  const [openChar, setOpenChar] = useState<string[]>(() => HPI_CHARACTER_GROUPS.filter((g) => groupFilled(g.fields, fields)).map((g) => g.id));
  const toggleChar = (id: string) => setOpenChar((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  // Negative-history rows ("" = a row not chosen yet); at least one row is shown.
  const negRows = (Array.isArray(fields.negatives) ? fields.negatives : []).map(negativeRowValue);
  const shownNegRows = negRows.length ? negRows : [""];
  const setNegRow = (i: number, v: string) => set("negatives", shownNegRows.map((r, idx) => (idx === i ? v : r)));
  const removeNegRow = (i: number) => set("negatives", shownNegRows.filter((_, idx) => idx !== i));

  return (
    <div data-overview-hide className="rounded-2xl border border-[var(--color-border)] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="divide-y divide-[var(--color-border)]/70">
      {HPI_GROUPS.map((g, i) => (
        <Row key={g.id} letter={"abc"[i]} label={g.label}>
          <Fields defs={g.fields} fields={fields} set={set} disabled={disabled} />
        </Row>
      ))}

      <Row letter="d" label="Character">
        <div className="flex flex-wrap gap-1.5">
          {HPI_CHARACTER_GROUPS.map((g) => {
            const on = openChar.includes(g.id);
            const filled = groupFilled(g.fields, fields);
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => toggleChar(g.id)}
                className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full border text-caption font-medium transition-all ${
                  on ? "bg-[var(--color-primary-600)] border-[var(--color-primary-600)] text-white shadow-sm" :
                  filled ? "bg-[var(--color-primary-50)] border-[var(--color-primary-300)] text-[var(--color-primary-700)]" :
                  "bg-white border-[var(--color-border)] text-[var(--color-ink-500)] hover:border-[var(--color-primary-300)]"
                }`}
              >
                {g.label}
                {filled && !on && <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary-500)]" />}
              </button>
            );
          })}
        </div>
        {HPI_CHARACTER_GROUPS.filter((g) => openChar.includes(g.id)).map((g) => (
          <div key={g.id} className="mt-2.5 rounded-xl bg-[var(--color-primary-50)]/50 border border-[var(--color-primary-100)] p-2.5">
            <p className="mb-1.5 text-micro font-bold uppercase tracking-[0.12em] text-[var(--color-primary-700)]">{g.label}</p>
            <Fields defs={g.fields} fields={fields} set={set} disabled={disabled} />
          </div>
        ))}
      </Row>

      <Row letter="e" label={HPI_FACTOR_GROUP.label}>
        <Fields defs={HPI_FACTOR_GROUP.fields} fields={fields} set={set} disabled={disabled} cols="sm:grid-cols-3 lg:grid-cols-5" />
      </Row>

      <Row letter="f" label="Negative History">
        <div className="flex flex-col gap-1.5">
          {shownNegRows.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="shrink-0 text-xs font-medium text-[var(--color-ink-600)]">{HPI_NEGATIVES_PREFIX}</span>
              <div className="flex-1 min-w-0">
                <HpiSelect
                  def={{ key: "negatives", label: "Select…", options: HPI_NEGATIVES }}
                  value={row}
                  onChange={(v) => setNegRow(i, typeof v === "string" ? v : v[0] ?? "")}
                  disabled={disabled}
                />
              </div>
              {!disabled && shownNegRows.length > 1 && (
                <button type="button" onClick={() => removeNegRow(i)} aria-label="Remove negative history" className="shrink-0 p-0.5 text-[var(--color-ink-300)] hover:text-red-500 transition-colors">
                  <X size={13} />
                </button>
              )}
            </div>
          ))}
          {!disabled && (
            <button
              type="button"
              onClick={() => set("negatives", [...shownNegRows, ""])}
              className="self-start inline-flex items-center gap-1 text-caption font-medium text-[var(--color-primary-700)] hover:underline"
            >
              <Plus size={11} /> Add negative history
            </button>
          )}
        </div>
      </Row>

      <Row letter="g" label="Other Descriptions">
        <input
          value={typeof fields.other === "string" ? fields.other : ""}
          disabled={disabled}
          onChange={(e) => set("other", e.target.value)}
          placeholder="Anything else, if any"
          className="w-full h-8 rounded-lg border border-[var(--color-border)] bg-white px-2.5 text-xs text-[var(--color-ink-700)] placeholder:text-[var(--color-ink-300)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-100)] focus:border-[var(--color-primary-400)]"
        />
      </Row>
      </div>

      {!disabled && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-[var(--color-border)] bg-[var(--color-surface-sunken)]/60 rounded-b-2xl">
          <p className="text-caption text-[var(--color-ink-400)]">Only the details you fill in are written into the HPI.</p>
          <button
            type="button"
            onClick={onGenerate}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary-600)] text-white text-xs font-semibold px-4 py-1.5 shadow-sm hover:bg-[var(--color-primary-700)] hover:shadow transition-all shrink-0"
          >
            <Sparkles size={12} /> Generate HPI
          </button>
        </div>
      )}
    </div>
  );
}
