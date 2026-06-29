"use client";

import { useState } from "react";
import { ChevronDown, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { FieldWithHistory } from "@/components/ui/HistoryToggle";
import { ChipGroup } from "@/components/ui/Chip";
import { PAST_MEDICAL_HISTORY_CHIPS, VITAL_RANGES } from "@/lib/constants";
import { parseJSON } from "@/lib/json";
import { useAutoSave, SaveIndicator } from "@/lib/useAutoSave";
import { saveGeneralExam } from "./actions";

function parseBP(value: string): { sys: number; dia: number } | null {
  const m = value.replace(/\s/g, "").match(/^(\d{2,3})\/(\d{2,3})$/);
  if (!m) return null;
  return { sys: Number(m[1]), dia: Number(m[2]) };
}

function VitalWarning({ message }: { message: string }) {
  return (
    <span className="flex items-center gap-1 text-[10px] text-amber-600 mt-0.5 font-medium">
      <AlertTriangle size={10} /> {message}
    </span>
  );
}

function bpWarning(value: string): string {
  if (!value) return "";
  const bp = parseBP(value);
  if (!bp) return "";
  const { sys, dia } = bp;
  const { systolic, diastolic } = VITAL_RANGES;
  if (sys > systolic.max || dia > diastolic.max) return "High BP";
  if (sys < systolic.min || dia < diastolic.min) return "Low BP";
  return "";
}

function numWarning(value: string, range: { min: number; max: number }, label: string): string {
  const n = parseFloat(value);
  if (isNaN(n)) return "";
  if (n > range.max) return `High ${label}`;
  if (n < range.min) return `Low ${label}`;
  return "";
}

export function GeneralExamTab({ visit, priorVisits, udid, readOnly, customPmhChips }: { visit: any; priorVisits: any[]; udid: string; readOnly: boolean; customPmhChips?: string[] }) {
  const pmhChipOptions = customPmhChips ?? [...PAST_MEDICAL_HISTORY_CHIPS];
  const ge = visit.generalExam;
  const [vitalsOpen, setVitalsOpen] = useState(true);
  const [bp, setBp] = useState(ge?.bp ?? "");
  const [pulse, setPulse] = useState(ge?.pulse ?? "");
  const [temperature, setTemperature] = useState(ge?.temperature ?? "");
  const [weight, setWeight] = useState(ge?.weight ?? "");
  const [chiefComplaint, setChiefComplaint] = useState(ge?.chiefComplaint ?? "");
  const [hpi, setHpi] = useState(ge?.hpi ?? "");
  const [pmh, setPmh] = useState<string[]>(parseJSON(ge?.pastMedicalHistory, [] as string[]));
  const [pmhOther, setPmhOther] = useState(ge?.pmhOtherText ?? "");
  const [medications, setMedications] = useState(ge?.medications ?? "");
  const [allergies, setAllergies] = useState(ge?.allergies ?? "");
  const [nkda, setNkda] = useState(ge?.nkda ?? false);

  // PMH persists cumulatively across visits per the PRD
  const priorPmh = priorVisits.flatMap((v) => parseJSON<string[]>(v.generalExam?.pastMedicalHistory, []));
  const cumulativePmh = Array.from(new Set([...priorPmh, ...pmh]));

  const data = { bp, pulse, temperature, weight, chiefComplaint, hpi, pastMedicalHistory: JSON.stringify(cumulativePmh), pmhOtherText: pmhOther, medications, allergies, nkda };

  const state = useAutoSave(data, async (d) => {
    if (readOnly) return;
    await saveGeneralExam(visit.id, udid, d);
  });

  const histFor = (field: (g: any) => string | undefined) =>
    priorVisits
      .filter((v) => v.generalExam && field(v.generalExam))
      .map((v) => ({ date: v.date, value: field(v.generalExam)!, hospitalName: v.hospital?.name }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <SaveIndicator state={state} />
      </div>

      {/* VITALS — collapsible */}
      <Card className="p-0 overflow-hidden">
        <button
          type="button"
          onClick={() => setVitalsOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--color-surface-sunken)] transition-colors"
        >
          <span className="text-xs font-semibold tracking-widest text-[var(--color-ink-500)] uppercase">Vitals</span>
          <ChevronDown
            size={16}
            className={`text-[var(--color-ink-400)] transition-transform duration-200 ${vitalsOpen ? "rotate-180" : ""}`}
          />
        </button>
        {vitalsOpen && (
          <div className="px-4 pb-4 pt-1 grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-[var(--color-border)]">
            <FieldWithHistory label="BP" history={histFor((g) => g.bp)}>
              <input disabled={readOnly} value={bp} onChange={(e) => setBp(e.target.value)} placeholder="120/80"
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] disabled:bg-[var(--color-surface-sunken)]" />
              {bpWarning(bp) && <VitalWarning message={bpWarning(bp)} />}
            </FieldWithHistory>
            <FieldWithHistory label="Pulse" history={histFor((g) => g.pulse)}>
              <input disabled={readOnly} value={pulse} onChange={(e) => setPulse(e.target.value)} placeholder="bpm"
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] disabled:bg-[var(--color-surface-sunken)]" />
              {numWarning(pulse, VITAL_RANGES.pulse, "pulse") && <VitalWarning message={numWarning(pulse, VITAL_RANGES.pulse, "pulse")} />}
            </FieldWithHistory>
            <FieldWithHistory label="Temperature (°C)" history={histFor((g) => g.temperature)}>
              <input disabled={readOnly} value={temperature} onChange={(e) => setTemperature(e.target.value)} placeholder="37.0"
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] disabled:bg-[var(--color-surface-sunken)]" />
              {numWarning(temperature, VITAL_RANGES.temperature, "temperature") && <VitalWarning message={numWarning(temperature, VITAL_RANGES.temperature, "temperature")} />}
            </FieldWithHistory>
            <FieldWithHistory label="Weight (kg)" history={histFor((g) => g.weight)}>
              <input disabled={readOnly} value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="kg"
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] disabled:bg-[var(--color-surface-sunken)]" />
              {numWarning(weight, VITAL_RANGES.weight, "weight") && <VitalWarning message={numWarning(weight, VITAL_RANGES.weight, "weight")} />}
            </FieldWithHistory>
          </div>
        )}
      </Card>

      {/* CHIEF COMPLAINT */}
      <Card>
        <FieldWithHistory label="CHIEF COMPLAINT" history={histFor((g) => g.chiefComplaint)}>
          <textarea
            disabled={readOnly}
            value={chiefComplaint}
            onChange={(e) => setChiefComplaint(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] disabled:bg-[var(--color-surface-sunken)]"
          />
        </FieldWithHistory>
      </Card>

      {/* HISTORY OF PRESENT ILLNESS */}
      <Card>
        <FieldWithHistory label="HISTORY OF PRESENT ILLNESS" history={histFor((g) => g.hpi)}>
          <textarea
            disabled={readOnly}
            value={hpi}
            onChange={(e) => setHpi(e.target.value)}
            rows={3}
            placeholder="Onset, character, duration, aggravating/relieving factors..."
            className="w-full rounded-xl border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] disabled:bg-[var(--color-surface-sunken)]"
          />
        </FieldWithHistory>
      </Card>

      {/* PAST MEDICAL HISTORY */}
      <Card>
        <p className="text-xs font-semibold tracking-widest text-[var(--color-ink-500)] uppercase mb-3">
          Past Medical History <span className="text-[10px] font-normal normal-case tracking-normal text-[var(--color-ink-400)]">(cumulative across visits)</span>
        </p>
        <ChipGroup
          options={pmhChipOptions}
          value={pmh}
          onChange={readOnly ? () => {} : setPmh}
          allowOther
          otherValue={pmhOther}
          onOtherChange={readOnly ? undefined : setPmhOther}
        />
      </Card>

      {/* CURRENT MEDICATIONS */}
      <Card>
        <FieldWithHistory label="CURRENT MEDICATIONS" history={histFor((g) => g.medications)}>
          <textarea
            disabled={readOnly}
            value={medications}
            onChange={(e) => setMedications(e.target.value)}
            rows={2}
            placeholder="Drug, dosage, frequency"
            className="w-full rounded-xl border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] disabled:bg-[var(--color-surface-sunken)]"
          />
        </FieldWithHistory>
      </Card>

      {/* ALLERGIES */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold tracking-widest text-[var(--color-ink-500)] uppercase">Allergies</p>
          <label className="flex items-center gap-2 text-xs text-[var(--color-ink-500)]">
            <input type="checkbox" disabled={readOnly} checked={nkda} onChange={(e) => setNkda(e.target.checked)} />
            NKDA (No Known Drug Allergies)
          </label>
        </div>
        {!nkda && (
          <textarea
            disabled={readOnly}
            value={allergies}
            onChange={(e) => setAllergies(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] disabled:bg-[var(--color-surface-sunken)]"
          />
        )}
      </Card>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, readOnly }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; readOnly?: boolean }) {
  return (
    <div>
      <label className="text-xs font-medium text-[var(--color-ink-500)]">{label}</label>
      <input
        disabled={readOnly}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] disabled:bg-[var(--color-surface-sunken)]"
      />
    </div>
  );
}
