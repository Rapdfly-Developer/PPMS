"use client";

// The EMR prescription "add medication" row (route, eye, drug, dose, frequency,
// duration, tapering dose and instructions), for sheets that keep their own
// list of medicines (the Counselling / IPD education sheet).

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { KeywordInput } from "@/components/emr/KeywordField";
import { DOSE_OPTIONS, DURATION_OPTIONS, FREQUENCY_OPTIONS } from "@/lib/medication-options";
import { saveCustomMedication } from "@/lib/ophthalmic-medications";
import {
  DrugNameInput, MED_INSTRUCTION_KEYWORDS, OptionsInput, ROUTE_OPTIONS, blankTaper, formatTaperSteps, routeHasLaterality, type TaperLevel,
} from "@/app/(app)/emr/[udid]/PlanTab";

export interface MedicationDraft { route: string; eye: string; name: string; dose: string; frequency: string; duration: string; instructions: string }

const inputCls = "w-full rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-500)]";
const lbl = "text-caption font-medium text-[var(--color-ink-400)] uppercase tracking-wide block mb-0.5";

export function MedicationEntry({ onAdd, defaultEye = "OU", addLabel = "Add medication", stacked = false }: {
  onAdd: (m: MedicationDraft) => void;
  defaultEye?: string;
  addLabel?: string;
  /** Narrow places (a pop-up): route, eye and drug on one line, dose, frequency and duration below. */
  stacked?: boolean;
}) {
  const [route, setRoute] = useState("");
  const [eye, setEye] = useState(defaultEye);
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [frequency, setFrequency] = useState("");
  const [duration, setDuration] = useState("");
  const [instructions, setInstructions] = useState("");
  const [taper, setTaper] = useState<TaperLevel[]>([]);

  const reset = () => { setRoute(""); setEye(defaultEye); setName(""); setDose(""); setFrequency(""); setDuration(""); setInstructions(""); setTaper([]); };
  const submit = () => {
    if (!name.trim()) return;
    saveCustomMedication({ name, route, defaultDose: dose });
    const steps = formatTaperSteps(taper);
    const tapNote = steps.length ? `Tapering: ${steps.join(" → ")}` : "";
    onAdd({
      route, eye: routeHasLaterality(route) ? eye : "", name: name.trim(), dose, frequency, duration,
      instructions: [instructions.trim(), tapNote].filter(Boolean).join(" | "),
    });
    reset();
  };
  const setLevel = (i: number, patch: Partial<TaperLevel>) => setTaper(taper.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  const fieldCls = "w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-200)]";
  return (
    <div className="flex flex-col gap-1.5">
      {stacked ? (
        <div className="space-y-2">
          <div className={`grid gap-2 ${routeHasLaterality(route) ? "grid-cols-[8rem_5rem_minmax(0,1fr)]" : "grid-cols-[8rem_minmax(0,1fr)]"}`}>
            <select value={route} onChange={(e) => setRoute(e.target.value)} aria-label="Route" className={fieldCls}>
              <option value="">Route</option>
              {ROUTE_OPTIONS.map((r) => <option key={r}>{r}</option>)}
            </select>
            {routeHasLaterality(route) && (
              <select value={eye} onChange={(e) => setEye(e.target.value)} aria-label="Laterality" className={fieldCls}>
                {["RE", "LE", "OU"].map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            )}
            {route
              ? <DrugNameInput value={name} onChange={(n, d) => { setName(n); if (d && !dose) setDose(d); }} placeholder="Drug name" className={fieldCls} />
              : <p className="self-center text-[12px] text-[var(--color-ink-400)]">Choose a route to add a medicine.</p>}
          </div>
          {route && (
            <div className="grid grid-cols-3 gap-2">
              <OptionsInput value={dose} onChange={setDose} options={DOSE_OPTIONS} placeholder="Dose" className={fieldCls} />
              <OptionsInput value={frequency} onChange={setFrequency} options={FREQUENCY_OPTIONS} placeholder="Frequency" className={fieldCls} />
              <OptionsInput value={duration} onChange={setDuration} options={DURATION_OPTIONS} placeholder="Duration" className={fieldCls} />
            </div>
          )}
        </div>
      ) : (
      <>
      <div className="flex items-center gap-1.5 flex-wrap md:flex-nowrap">
        <select value={route} onChange={(e) => setRoute(e.target.value)} aria-label="Route" className={`${inputCls.replace("w-full ", "")} w-28 shrink-0`}>
          <option value="">Route</option>
          {ROUTE_OPTIONS.map((r) => <option key={r}>{r}</option>)}
        </select>
        {route && (
          <>
            {routeHasLaterality(route) && (
              <select value={eye} onChange={(e) => setEye(e.target.value)} aria-label="Laterality" className={`${inputCls.replace("w-full ", "")} w-16 shrink-0`}>
                {["RE", "LE", "OU"].map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            )}
            <div className="flex-1 min-w-[220px]">
              <DrugNameInput value={name} onChange={(n, d) => { setName(n); if (d && !dose) setDose(d); }} placeholder="Drug name" className={inputCls} />
            </div>
            <OptionsInput value={dose} onChange={setDose} options={DOSE_OPTIONS} placeholder="Dose" className={`${inputCls} w-20 shrink-0`} />
            <OptionsInput value={frequency} onChange={setFrequency} options={FREQUENCY_OPTIONS} placeholder="Frequency" className={`${inputCls} w-32 shrink-0`} />
            <OptionsInput value={duration} onChange={setDuration} options={DURATION_OPTIONS} placeholder="Duration" className={`${inputCls} w-24 shrink-0`} />
            <button type="button" onClick={reset} aria-label="Clear" className="shrink-0 text-[var(--color-ink-300)] hover:text-red-500 p-0.5 transition-colors"><X size={13} /></button>
          </>
        )}
      </div>
      {!route && <p className="text-caption text-[var(--color-ink-400)]">Choose a route to add a medicine.</p>}
      </>
      )}
      {route && (
        <>
          <div className="flex items-start gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer w-fit shrink-0 pt-2">
              <input type="checkbox" checked={taper.length > 0} onChange={(e) => setTaper(e.target.checked ? [blankTaper()] : [])} className="accent-[var(--color-primary-600)] w-3.5 h-3.5 rounded" />
              <span className="text-xs font-medium text-[var(--color-ink-600)]">Tapering dose</span>
            </label>
            <div className="flex-1 min-w-0">
              <KeywordInput fieldKey="med_instructions" value={instructions} onChange={setInstructions} builtIns={MED_INSTRUCTION_KEYWORDS}
                placeholder="Instructions, e.g. Apply 1 drop in RE at bedtime, shake well before use" className={inputCls} />
            </div>
          </div>
          {taper.map((level, i) => (
            <div key={i} className="mb-2 max-w-3xl pl-3 border-l-2 border-[var(--color-primary-300)]" style={{ marginLeft: `${i * 14}px` }}>
              <p className="text-caption font-bold uppercase tracking-widest text-[var(--color-primary-600)] mb-1.5">↓ Tapering dose{taper.length > 1 ? ` ${i + 1}` : ""}</p>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <div>
                  <label className={lbl}>Dose</label>
                  <OptionsInput value={level.dose} onChange={(x) => setLevel(i, { dose: x })} options={DOSE_OPTIONS} placeholder="Dose" className={inputCls} />
                </div>
                <div>
                  <label className={lbl}>Frequency</label>
                  <select value={level.frequency} onChange={(e) => setLevel(i, { frequency: e.target.value })} className={inputCls}>
                    <option value="">Select</option>
                    {FREQUENCY_OPTIONS.map((f) => <option key={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Duration</label>
                  <div className="flex gap-1">
                    <select value={level.durationNum} onChange={(e) => setLevel(i, { durationNum: e.target.value })} className={`${inputCls} flex-1 min-w-0`}>
                      <option value="">-</option>
                      {Array.from({ length: 10 }, (_, j) => j + 1).map((n) => <option key={n} value={String(n)}>{n}</option>)}
                    </select>
                    <select value={level.durationUnit} onChange={(e) => setLevel(i, { durationUnit: e.target.value })} className={`${inputCls} flex-1 min-w-0`}>
                      {["days", "weeks", "months", "years"].map((u) => <option key={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              {i < 4 && (
                <label className="flex items-center gap-1.5 cursor-pointer w-fit">
                  <input type="checkbox" checked={taper.length > i + 1}
                    onChange={(e) => setTaper(e.target.checked ? [...taper.slice(0, i + 1), blankTaper()] : taper.slice(0, i + 1))}
                    className="accent-[var(--color-primary-600)] w-3.5 h-3.5 rounded" />
                  <span className="text-xs font-medium text-[var(--color-ink-600)]">Tapering dose</span>
                </label>
              )}
            </div>
          ))}
          <div className="flex justify-end mt-1.5">
            <button type="button" onClick={submit} disabled={!name.trim()}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary-600)] text-white text-xs font-medium px-3.5 py-1.5 shadow-sm hover:bg-[var(--color-primary-700)] transition-colors disabled:opacity-50">
              <Plus size={12} /> {addLabel}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
