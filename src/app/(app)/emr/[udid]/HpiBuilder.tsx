"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, Sparkles, Check } from "lucide-react";
import {
  HPI_GROUPS, HPI_CHARACTER_GROUPS, HPI_FACTOR_GROUP, HPI_NEGATIVES,
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
        className={`${CTRL} w-full flex items-center gap-1 text-left ${selected.length ? "border-[var(--color-primary-300)] bg-[var(--color-primary-50)]/60" : "text-[var(--color-ink-400)]"}`}
      >
        <span className="flex-1 min-w-0 truncate">{summary}</span>
        <ChevronDown size={11} className="shrink-0 text-[var(--color-ink-400)]" />
      </button>
      {open && (
        <div className="absolute z-30 left-0 mt-1 min-w-[220px] max-w-[320px] rounded-xl border border-[var(--color-border)] bg-white shadow-xl overflow-hidden">
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
      <p className="sm:w-36 shrink-0 pt-1 text-micro font-bold uppercase tracking-widest text-[var(--color-ink-400)]">{label}</p>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function Fields({ defs, fields, set, disabled, cols = "sm:grid-cols-3" }: { defs: HpiFieldDef[]; fields: HpiFields; set: (k: string, v: string | string[]) => void; disabled?: boolean; cols?: string }) {
  return (
    <div className={`grid grid-cols-2 ${cols} gap-1.5`}>
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
  const negatives = Array.isArray(fields.negatives) ? fields.negatives : [];

  return (
    <div data-overview-hide className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)]/50 p-3 flex flex-col gap-2.5">
      {HPI_GROUPS.map((g) => (
        <Row key={g.id} label={g.label}>
          <Fields defs={g.fields} fields={fields} set={set} disabled={disabled} />
        </Row>
      ))}

      <Row label="Character">
        <div className="flex flex-wrap gap-1.5">
          {HPI_CHARACTER_GROUPS.map((g) => {
            const on = openChar.includes(g.id);
            const filled = groupFilled(g.fields, fields);
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => toggleChar(g.id)}
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-caption font-medium transition-colors ${
                  on ? "bg-[var(--color-primary-600)] border-[var(--color-primary-600)] text-white" :
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
          <div key={g.id} className="mt-2 pl-2.5 border-l-2 border-[var(--color-primary-200)]">
            <p className="mb-1 text-micro font-semibold text-[var(--color-primary-700)]">{g.label}</p>
            <Fields defs={g.fields} fields={fields} set={set} disabled={disabled} />
          </div>
        ))}
      </Row>

      <Row label={HPI_FACTOR_GROUP.label}>
        <Fields defs={HPI_FACTOR_GROUP.fields} fields={fields} set={set} disabled={disabled} />
      </Row>

      <Row label="Negative History">
        <div className="flex flex-col gap-1">
          {HPI_NEGATIVES.map((n) => {
            const on = negatives.includes(n);
            return (
              <label key={n} className="flex items-start gap-2 text-xs text-[var(--color-ink-700)] cursor-pointer">
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={on}
                  onChange={() => set("negatives", on ? negatives.filter((x) => x !== n) : [...negatives, n])}
                  className="mt-0.5 w-3.5 h-3.5 accent-[var(--color-primary-600)] shrink-0"
                />
                <span>{n}</span>
              </label>
            );
          })}
        </div>
      </Row>

      <Row label="Other Descriptions">
        <input
          value={typeof fields.other === "string" ? fields.other : ""}
          disabled={disabled}
          onChange={(e) => set("other", e.target.value)}
          placeholder="Anything else, if any"
          className={`${CTRL} w-full`}
        />
      </Row>

      {!disabled && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onGenerate}
            className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary-600)] text-white text-xs font-medium px-3.5 py-1.5 shadow-sm hover:bg-[var(--color-primary-700)] transition-colors"
          >
            <Sparkles size={12} /> Generate HPI
          </button>
        </div>
      )}
    </div>
  );
}
