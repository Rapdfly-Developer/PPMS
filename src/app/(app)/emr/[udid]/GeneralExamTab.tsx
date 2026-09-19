"use client";

import { useState } from "react";
import { convertNotesToCC } from "@/lib/appointment-cc";
import { ChevronDown, AlertTriangle, Plus, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { FieldWithHistory } from "@/components/ui/HistoryToggle";
import { PAST_MEDICAL_HISTORY_CHIPS, VITAL_RANGES, CHIEF_COMPLAINT_FIELD_KEY, CHIEF_COMPLAINT_LEGACY_KEYS } from "@/lib/constants";
import { OPHTHALMIC_COMPLAINTS } from "@/components/ui/ComplaintCombobox";
import { parseJSON } from "@/lib/json";
import { useAutoSave, SaveIndicator } from "@/lib/useAutoSave";
import { KeywordTextarea } from "@/components/emr/KeywordField";
import { saveGeneralExam } from "./actions";

const LATERALITY_OPTIONS = ["RE", "LE", "OU"] as const;
type Laterality = typeof LATERALITY_OPTIONS[number];
const SINCE_UNITS = ["days", "weeks", "months", "years"] as const;

function parseComplaintPrefixes(text: string): { lat: Laterality | null; sinceNum: string; sinceUnit: string; body: string } {
  let rest = text;
  const latM = rest.match(/^\[(RE|LE|OU)\]\s*/);
  const lat = latM ? (latM[1] as Laterality) : null;
  if (latM) rest = rest.slice(latM[0].length);
  const sinceM = rest.match(/^\[(\d+)\s+(days|weeks|months|years)\]\s*/);
  const sinceNum = sinceM ? sinceM[1] : "";
  const sinceUnit = sinceM ? sinceM[2] : "days";
  if (sinceM) rest = rest.slice(sinceM[0].length);
  return { lat, sinceNum, sinceUnit, body: rest };
}

/* Multiple chief complaints share the single chiefComplaint column, stored as
   "[RE] [3 days] Redness | [LE] Watering" so every downstream reader (PDFs,
   FHIR export, patient list, AI summary) keeps rendering all of them. */
const COMPLAINT_SEP = " | ";

type Complaint = { lat: Laterality | null; sinceNum: string; sinceUnit: string; text: string };

const emptyComplaint = (): Complaint => ({ lat: null, sinceNum: "", sinceUnit: "days", text: "" });

function parseComplaints(raw: string): Complaint[] {
  const segments = convertNotesToCC(raw).split("|").map((s) => s.trim()).filter(Boolean);
  if (segments.length === 0) return [emptyComplaint()];
  return segments.map((seg) => {
    const { lat, sinceNum, sinceUnit, body } = parseComplaintPrefixes(seg);
    return { lat, sinceNum, sinceUnit, text: body };
  });
}

function serializeComplaints(list: Complaint[]): string {
  return list
    .filter((c) => c.text.trim())
    .map((c) =>
      [c.lat ? `[${c.lat}]` : "", c.sinceNum ? `[${c.sinceNum} ${c.sinceUnit}]` : "", c.text.trim()]
        .filter(Boolean)
        .join(" ")
    )
    .join(COMPLAINT_SEP);
}

/* Past medical history is stored in the same JSON column as before, but each
   entry now carries an optional duration:
     [{ name: "HTN", sinceNum: "2", sinceUnit: "years" }, ...]
   Records written by the earlier chip UI are a plain string[] ("HTN"), so the
   parser accepts both and upgrades the old shape in place. Nothing is migrated
   in the database; an old record simply reads back with no since value. */
export type PmhEntry = { name: string; sinceNum: string; sinceUnit: string };

const emptyPmh = (name = ""): PmhEntry => ({ name, sinceNum: "", sinceUnit: "days" });

function parsePmh(raw: string | null | undefined): PmhEntry[] {
  const parsed = parseJSON<unknown>(raw, []);
  if (!Array.isArray(parsed)) return [];
  const out: PmhEntry[] = [];
  for (const item of parsed) {
    // Legacy: a bare condition name with no duration.
    if (typeof item === "string") {
      if (item.trim()) out.push(emptyPmh(item.trim()));
      continue;
    }
    if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      const name = typeof o.name === "string" ? o.name.trim() : "";
      if (!name) continue;
      out.push({
        name,
        sinceNum:  typeof o.sinceNum  === "string" ? o.sinceNum  : "",
        sinceUnit: typeof o.sinceUnit === "string" && o.sinceUnit ? o.sinceUnit : "days",
      });
    }
  }
  return out;
}

/** Merge prior-visit history with this visit's, de-duplicated by condition name.
    A later entry wins, so a duration added today replaces an older blank one. */
function mergePmh(...lists: PmhEntry[][]): PmhEntry[] {
  const byName = new Map<string, PmhEntry>();
  for (const list of lists) {
    for (const e of list) {
      if (!e.name.trim()) continue;
      const key = e.name.trim().toLowerCase();
      const existing = byName.get(key);
      // Don't let a blank duration overwrite one already recorded.
      if (existing && !e.sinceNum && existing.sinceNum) continue;
      byName.set(key, e);
    }
  }
  return [...byName.values()];
}

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
  const [complaints, setComplaints] = useState<Complaint[]>(() => parseComplaints(ge?.chiefComplaint ?? ""));
  const [hpi, setHpi] = useState(ge?.hpi ?? "");
  /* One row per condition, each with an optional "since". pmhOtherText is
     still written back untouched so free text saved by the old chip UI is not
     dropped on the next save. */
  const [pmh, setPmh] = useState<PmhEntry[]>(() => parsePmh(ge?.pastMedicalHistory));
  const [pmhOther] = useState(ge?.pmhOtherText ?? "");

  const patchPmh = (i: number, patch: Partial<PmhEntry>) =>
    setPmh((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  const addPmh = (name = "") => setPmh((prev) => [...prev, emptyPmh(name)]);
  const removePmh = (i: number) => setPmh((prev) => prev.filter((_, idx) => idx !== i));
  const [medications, setMedications] = useState(ge?.medications ?? "");
  const [allergies, setAllergies] = useState(ge?.allergies ?? "");
  const [nkda, setNkda] = useState(ge?.nkda ?? false);

  // PMH persists cumulatively across visits per the PRD
  const priorPmh = priorVisits.flatMap((v) => parsePmh(v.generalExam?.pastMedicalHistory));
  const cumulativePmh = mergePmh(priorPmh, pmh);

  const chiefComplaintFull = serializeComplaints(complaints);
  const data = { bp, pulse, temperature, weight, chiefComplaint: chiefComplaintFull, hpi, pastMedicalHistory: JSON.stringify(cumulativePmh), pmhOtherText: pmhOther, medications, allergies, nkda };

  const patchComplaint = (i: number, patch: Partial<Complaint>) =>
    setComplaints((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const removeComplaint = (i: number) =>
    setComplaints((prev) => (prev.length === 1 ? [emptyComplaint()] : prev.filter((_, idx) => idx !== i)));

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

      {/* CHIEF COMPLAINT */}
      <Card>
        <FieldWithHistory
          label="CHIEF COMPLAINT"
          history={histFor((g) => g.chiefComplaint)}
          currentValue={chiefComplaintFull}
          onLoad={(v) => setComplaints(parseComplaints(v))}
        >
          <div className="flex flex-col gap-3">
            {complaints.map((c, i) => (
              <div
                key={i}
                className={i > 0 ? "pt-3 border-t border-dashed border-[var(--color-border)]" : ""}
              >
                {/* Row 1: Laterality + remove */}
                <div className="flex items-center gap-1.5 mb-2">
                  {complaints.length > 1 && (
                    <span className="text-[10px] font-bold tracking-wider text-[var(--color-ink-400)] uppercase">
                      CC {i + 1}
                    </span>
                  )}
                  {LATERALITY_OPTIONS.map((opt) => {
                    const active = c.lat === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        disabled={readOnly}
                        onClick={() => patchComplaint(i, { lat: active ? null : opt })}
                        className="px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-all"
                        style={active ? {
                          background: "var(--color-primary-600)",
                          color: "#fff",
                          boxShadow: "0 2px 8px rgba(15,118,110,.25)",
                        } : {
                          background: "var(--color-surface-1, #F1F5F9)",
                          color: "var(--color-ink-500, #64748B)",
                          border: "1px solid var(--color-border, #E2E8F0)",
                        }}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>

                {/* Row 2: Since controls */}
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-[11px] font-semibold text-[var(--color-ink-400)] w-8 shrink-0">Since</span>
                  <select
                    value={c.sinceNum}
                    onChange={(e) => patchComplaint(i, { sinceNum: e.target.value })}
                    disabled={readOnly}
                    className="text-[11px] border border-[var(--color-border)] rounded-md px-1.5 py-0.5 bg-white text-[var(--color-ink-700)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-500)] disabled:opacity-50 w-12 shrink-0"
                  >
                    <option value="">—</option>
                    {Array.from({ length: 30 }, (_, n) => n + 1).map((n) => (
                      <option key={n} value={String(n)}>{n}</option>
                    ))}
                  </select>
                  <select
                    value={c.sinceUnit}
                    onChange={(e) => patchComplaint(i, { sinceUnit: e.target.value })}
                    disabled={readOnly || !c.sinceNum}
                    className="text-[11px] border border-[var(--color-border)] rounded-md px-1.5 py-0.5 bg-white text-[var(--color-ink-700)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-500)] disabled:opacity-50 w-16 shrink-0"
                  >
                    {SINCE_UNITS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                    {!readOnly && complaints.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeComplaint(i)}
                        title={`Remove Chief Complaint ${i + 1}`}
                        className="p-1 rounded-lg text-[var(--color-ink-400)] hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <X size={13} strokeWidth={2.5} />
                      </button>
                    )}
                </div>

                {/* Complaint textarea. Chief complaint is a single entry; the
                    map above still renders every segment of an older record that
                    was saved with more than one, so nothing is lost on read. */}
                <KeywordTextarea
                  fieldKey={CHIEF_COMPLAINT_FIELD_KEY}
                  builtIns={OPHTHALMIC_COMPLAINTS}
                  legacyKeys={CHIEF_COMPLAINT_LEGACY_KEYS}
                  value={c.text}
                  onChange={(v) => patchComplaint(i, { text: v.replace(/\|/g, "/") })}
                  disabled={readOnly}
                  rows={2}
                />
              </div>
            ))}
          </div>
        </FieldWithHistory>
      </Card>

      {/* HISTORY OF PRESENT ILLNESS */}
      <Card>
        <FieldWithHistory label="HISTORY OF PRESENT ILLNESS" history={histFor((g) => g.hpi)} currentValue={hpi} onLoad={readOnly ? undefined : setHpi}>
          <KeywordTextarea fieldKey="ge_hpi" value={hpi} onChange={setHpi} disabled={readOnly} rows={3} placeholder="Onset, character, duration, aggravating/relieving factors..." />
        </FieldWithHistory>
      </Card>

      {/* PAST MEDICAL HISTORY */}
      <Card>
        <p className="text-xs font-semibold tracking-widest text-[var(--color-ink-500)] uppercase mb-3">
          Past Medical History <span className="text-[10px] font-normal normal-case tracking-normal text-[var(--color-ink-400)]">(cumulative across visits)</span>
        </p>
        {/* One row per condition: the name (with the same keyword picker as
            elsewhere) plus an optional duration. The eight standard conditions
            and any custom keyword add a NEW row rather than appending text, so
            each condition keeps its own "since". */}
        <div className="flex flex-col gap-2">
          {pmh.map((entry, i) => (
            <div key={i} className="flex items-center gap-1.5 flex-wrap">
              <input
                value={entry.name}
                onChange={(e) => patchPmh(i, { name: e.target.value })}
                disabled={readOnly}
                placeholder="Condition"
                className="flex-1 min-w-[140px] rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] disabled:bg-[var(--color-surface-sunken)]"
              />
              <span className="text-[11px] font-semibold text-[var(--color-ink-400)] shrink-0">Since</span>
              <select
                value={entry.sinceNum}
                onChange={(e) => patchPmh(i, { sinceNum: e.target.value })}
                disabled={readOnly}
                className="text-[11px] border border-[var(--color-border)] rounded-md px-1.5 py-1 bg-white text-[var(--color-ink-700)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-500)] disabled:opacity-50 w-12 shrink-0"
              >
                <option value="">—</option>
                {Array.from({ length: 30 }, (_, n) => n + 1).map((n) => (
                  <option key={n} value={String(n)}>{n}</option>
                ))}
              </select>
              <select
                value={entry.sinceUnit}
                onChange={(e) => patchPmh(i, { sinceUnit: e.target.value })}
                disabled={readOnly || !entry.sinceNum}
                className="text-[11px] border border-[var(--color-border)] rounded-md px-1.5 py-1 bg-white text-[var(--color-ink-700)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-500)] disabled:opacity-50 w-16 shrink-0"
              >
                {SINCE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => removePmh(i)}
                  title={`Remove ${entry.name || "entry"}`}
                  className="p-1 rounded-lg text-[var(--color-ink-400)] hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                >
                  <X size={13} strokeWidth={2.5} />
                </button>
              )}
            </div>
          ))}

          {!readOnly && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => addPmh()}
                className="self-start inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-[var(--color-primary-300)] bg-[var(--color-primary-50)] text-[10px] font-medium text-[var(--color-primary-700)] hover:bg-[var(--color-primary-100)] transition-colors whitespace-nowrap"
              >
                <Plus size={11} strokeWidth={2.5} /> Add
              </button>
              {/* Quick-add: each keyword starts its own row. Already-listed
                  conditions are hidden so the same one is not added twice. */}
              {pmhChipOptions
                .filter((opt) => !pmh.some((e) => e.name.trim().toLowerCase() === opt.toLowerCase()))
                .map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => addPmh(opt)}
                    className="inline-flex items-center px-2 py-0.5 rounded-full border border-[var(--color-border)] bg-white text-[11px] text-[var(--color-ink-600)] hover:border-[var(--color-primary-400)] hover:text-[var(--color-primary-700)] transition-colors"
                  >
                    {opt}
                  </button>
                ))}
            </div>
          )}
        </div>
      </Card>

      {/* CURRENT MEDICATIONS */}
      <Card>
        <FieldWithHistory label="CURRENT MEDICATIONS" history={histFor((g) => g.medications)} currentValue={medications} onLoad={readOnly ? undefined : setMedications}>
          <KeywordTextarea fieldKey="ge_medications" value={medications} onChange={setMedications} disabled={readOnly} rows={2} placeholder="Drug, dosage, frequency" />
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
          <KeywordTextarea fieldKey="ge_allergies" value={allergies} onChange={setAllergies} disabled={readOnly} rows={2} />
        )}
      </Card>

      {/* VITALS — collapsible, moved to bottom */}
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
          <div className="px-4 pb-4 pt-1 grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-4 border-t border-[var(--color-border)] items-end">
            <FieldWithHistory label="BP" history={histFor((g) => g.bp)} currentValue={bp} onLoad={readOnly ? undefined : setBp} buttonPosition="below-label">
              <input disabled={readOnly} value={bp} onChange={(e) => setBp(e.target.value)} placeholder="120/80"
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] disabled:bg-[var(--color-surface-sunken)]" />
              {bpWarning(bp) && <VitalWarning message={bpWarning(bp)} />}
            </FieldWithHistory>
            <FieldWithHistory label="Pulse" history={histFor((g) => g.pulse)} currentValue={pulse} onLoad={readOnly ? undefined : setPulse} buttonPosition="below-label">
              <input disabled={readOnly} value={pulse} onChange={(e) => setPulse(e.target.value)} placeholder="bpm"
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] disabled:bg-[var(--color-surface-sunken)]" />
              {numWarning(pulse, VITAL_RANGES.pulse, "pulse") && <VitalWarning message={numWarning(pulse, VITAL_RANGES.pulse, "pulse")} />}
            </FieldWithHistory>
            <FieldWithHistory label="Temp (°C)" history={histFor((g) => g.temperature)} currentValue={temperature} onLoad={readOnly ? undefined : setTemperature} buttonPosition="below-label">
              <input disabled={readOnly} value={temperature} onChange={(e) => setTemperature(e.target.value)} placeholder="37.0"
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] disabled:bg-[var(--color-surface-sunken)]" />
              {numWarning(temperature, VITAL_RANGES.temperature, "temperature") && <VitalWarning message={numWarning(temperature, VITAL_RANGES.temperature, "temperature")} />}
            </FieldWithHistory>
            <FieldWithHistory label="Weight (kg)" history={histFor((g) => g.weight)} currentValue={weight} onLoad={readOnly ? undefined : setWeight} buttonPosition="below-label">
              <input disabled={readOnly} value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="kg"
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] disabled:bg-[var(--color-surface-sunken)]" />
              {numWarning(weight, VITAL_RANGES.weight, "weight") && <VitalWarning message={numWarning(weight, VITAL_RANGES.weight, "weight")} />}
            </FieldWithHistory>
          </div>
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
