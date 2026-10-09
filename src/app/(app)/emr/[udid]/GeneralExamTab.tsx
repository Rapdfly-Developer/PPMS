"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { convertNotesToCC } from "@/lib/appointment-cc";
import { ChevronDown, AlertTriangle, Plus, X, Tag } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { FieldWithHistory } from "@/components/ui/HistoryToggle";
import { PAST_MEDICAL_HISTORY_CHIPS, VITAL_RANGES, CHIEF_COMPLAINT_FIELD_KEY, CHIEF_COMPLAINT_LEGACY_KEYS } from "@/lib/constants";
import { appendComplaintKeyword, OPHTHALMIC_COMPLAINTS } from "@/components/ui/ComplaintCombobox";
import { parseJSON } from "@/lib/json";
import { useAutoSave, SaveIndicator } from "@/lib/useAutoSave";
import { KeywordTextarea, KeywordChipsRow, removeKeywordFromText } from "@/components/emr/KeywordField";
import { saveGeneralExam } from "./actions";
import { type MedEntry, searchMedications } from "@/lib/ophthalmic-medications";
import { useEmrOverview } from "./EmrOverviewContext";
import { useCustomPrintPref } from "@/lib/useCustomPrintPref";
import { ComplaintChips } from "@/components/ui/ComplaintChips";

const LATERALITY_OPTIONS = ["RE", "LE", "OU"] as const;
type Laterality = typeof LATERALITY_OPTIONS[number];
const SINCE_UNITS = ["days", "weeks", "months", "years"] as const;

type CurrentMed = { drugName: string; dosage: string; frequency: string; duration: string };

function parseMeds(raw: string): CurrentMed[] {
  if (!raw.trim()) return [{ drugName: "", dosage: "", frequency: "", duration: "" }];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.length > 0) return arr as CurrentMed[];
  } catch {}
  return [{ drugName: raw.trim(), dosage: "", frequency: "", duration: "" }];
}

function serializeMeds(meds: CurrentMed[]): string {
  const filled = meds.filter((m) => m.drugName.trim());
  return filled.length === 0 ? "" : JSON.stringify(filled);
}

const CM_DOSE_OPTIONS = ["1 drop","2 drops","½ tablet","1 tablet","2 tablets","1 capsule","25 mg","50 mg","100 mg","250 mg","500 mg","1 g"];
const CM_FREQ_OPTIONS = ["OD (Once daily)","BD (Twice daily)","TID (Three times daily)","QID (Four times daily)","5 times daily","QHS (At bedtime)","PRN (As needed)"];
const CM_DUR_OPTIONS  = ["1 day","3 days","1 week","2 weeks","1 month","3 months","6 months","1 year","Long-term","As needed","Until healed"];

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

/* Past history is stored in the same JSON column as before, but each
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
    <span className="flex items-center gap-1 text-caption text-amber-600 mt-0.5 font-medium">
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

function ComplaintKeywordButton({
  idx,
  open,
  onToggle,
  onClose,
  getValue,
  onAppend,
  onRemoveFromText,
}: {
  idx: number;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  getValue: () => string;
  onAppend: (kw: string) => void;
  onRemoveFromText: (kw: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const popoverId = `cc-kw-popover-${idx}`;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <div ref={ref} className="relative shrink-0" data-overview-hide>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={popoverId}
        aria-label="Keyword suggestions for this complaint"
        title="Keyword suggestions"
        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-caption font-medium transition-colors whitespace-nowrap ${
          open
            ? "border-[var(--color-primary-400)] bg-[var(--color-primary-100)] text-[var(--color-primary-700)]"
            : "border-[var(--color-border)] bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)] hover:border-[var(--color-primary-300)] hover:text-[var(--color-primary-700)]"
        }`}
      >
        <Tag size={10} strokeWidth={2} />
        Keywords
      </button>
      {open && (
        <div
          id={popoverId}
          role="dialog"
          aria-label="Keyword suggestions"
          className="absolute z-50 top-full mt-1.5 left-0 w-72 max-w-[min(18rem,calc(100vw-1rem))] bg-white border border-[var(--color-border)] rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.10)] p-3"
        >
          <KeywordChipsRow
            fieldKey={CHIEF_COMPLAINT_FIELD_KEY}
            builtIns={OPHTHALMIC_COMPLAINTS}
            legacyKeys={CHIEF_COMPLAINT_LEGACY_KEYS}
            getValue={getValue}
            onAppend={(kw) => { onAppend(kw); onClose(); }}
            onRemoveFromText={(kw) => { onRemoveFromText(kw); onClose(); }}
          />
        </div>
      )}
    </div>
  );
}

export function GeneralExamTab({ visit, priorVisits, udid, readOnly }: { visit: any; priorVisits: any[]; udid: string; readOnly: boolean }) {
  const ge = visit.generalExam;
  const [vitalsOpen, setVitalsOpen] = useState(true);
  const [bp, setBp] = useState(ge?.bp ?? "");
  const [pulse, setPulse] = useState(ge?.pulse ?? "");
  const [temperature, setTemperature] = useState(ge?.temperature ?? "");
  const [weight, setWeight] = useState(ge?.weight ?? "");
  const [complaints, setComplaints] = useState<Complaint[]>(() => parseComplaints(ge?.chiefComplaint ?? ""));
  const [openKwIdx, setOpenKwIdx] = useState<number | null>(null);
  const [hpi, setHpi] = useState(ge?.hpi ?? "");
  const [pmh, setPmh] = useState<PmhEntry[]>(() => {
    // Every saved visit contains a cumulative snapshot. Seed from the newest
    // prior snapshot so deleted entries do not reappear from older visits.
    const latestPrior = priorVisits
      .map((prior) => parsePmh(prior.generalExam?.pastMedicalHistory))
      .find((entries) => entries.length > 0) ?? [];
    const initial = mergePmh(latestPrior, parsePmh(ge?.pastMedicalHistory));
    return initial.length > 0 ? initial : [emptyPmh()];
  });
  const [pmhOther, setPmhOther] = useState(ge?.pmhOtherText ?? "");

  const [medRows, setMedRows] = useState<CurrentMed[]>(() => parseMeds(ge?.medications ?? ""));
  const medications = serializeMeds(medRows);
  const [allergies, setAllergies] = useState(ge?.allergies ?? "");
  const [nkda, setNkda] = useState(ge?.nkda ?? false);

  const [ccInPrint, setCcInPrint] = useCustomPrintPref(visit.id, "cc");
  const [allergyInPrint, setAllergyInPrint] = useCustomPrintPref(visit.id, "allergy");

  const cumulativePmh = pmh.filter((entry) => entry.name.trim());
  const displayPmhOptions = [...new Set([...PAST_MEDICAL_HISTORY_CHIPS, ...cumulativePmh.map((entry) => entry.name)])];

  const patchPmh = (index: number, patch: Partial<PmhEntry>) =>
    setPmh((current) => current.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));

  const addPmhRow = (name = "") => {
    const normalized = name.trim().toLowerCase();
    setPmh((current) => {
      if (normalized && current.some((entry) => entry.name.trim().toLowerCase() === normalized)) return current;
      // If adding a named entry and there's already an empty row, fill it rather than appending.
      if (normalized) {
        const emptyIdx = current.findIndex((entry) => !entry.name.trim());
        if (emptyIdx !== -1) {
          return current.map((entry, i) => i === emptyIdx ? { ...entry, name: name.trim() } : entry);
        }
      }
      // Don't add a second empty row if one already exists.
      if (!normalized && current.some((entry) => !entry.name.trim())) return current;
      return [...current, emptyPmh(name)];
    });
  };

  const removePmhRow = (index: number) =>
    setPmh((current) => current.filter((_, i) => i !== index));

  const chiefComplaintFull = serializeComplaints(complaints);
  const data = { bp, pulse, temperature, weight, chiefComplaint: chiefComplaintFull, hpi, pastMedicalHistory: JSON.stringify(cumulativePmh), pmhOtherText: pmhOther, medications, allergies, nkda };

  const patchComplaint = (i: number, patch: Partial<Complaint>) =>
    setComplaints((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const removeComplaint = (i: number) => {
    setOpenKwIdx(null);
    setComplaints((prev) => (prev.length === 1 ? [emptyComplaint()] : prev.filter((_, idx) => idx !== i)));
  };

  const state = useAutoSave(data, async (d) => {
    if (readOnly) return;
    await saveGeneralExam(visit.id, udid, d);
  });

  const overview = useEmrOverview();
  const visiblePmhOptions = overview
    ? displayPmhOptions.filter((option) => cumulativePmh.some((entry) => entry.name.toLowerCase() === option.toLowerCase()))
    : displayPmhOptions;

  const histFor = (field: (g: any) => string | undefined) =>
    priorVisits
      .filter((v) => v.generalExam && field(v.generalExam))
      .map((v) => ({ date: v.date, value: field(v.generalExam)!, hospitalName: v.hospital?.name }));

  // Section-level "has data" checks — used in overview mode to hide empty cards.
  const hasCC         = complaints.some((c) => c.text.trim());
  const hasHpi        = !!hpi.trim();
  const hasPmh        = cumulativePmh.length > 0;
  const hasMeds       = medRows.some((m) => m.drugName.trim());
  const hasOtherHistory = !!pmhOther.trim();
  const hasAllergies  = nkda || !!allergies.trim();
  const hasVitals     = !!(bp || pulse || temperature || weight);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <SaveIndicator state={state} />
      </div>

      {/* CHIEF COMPLAINT */}
      <div {...(overview && !hasCC ? { "data-overview-empty-section": "" } : {})}>
      <Card>
        <FieldWithHistory
          label="CHIEF COMPLAINT"
          history={histFor((g) => g.chiefComplaint)}
          currentValue={chiefComplaintFull}
          onLoad={(v) => setComplaints(parseComplaints(v))}
          renderValue={(v) => <ComplaintChips value={v} wrap />}
        >
          <div className="flex flex-col gap-2">
            {complaints.map((c, i) => (
              <div
                key={i}
                className={i > 0 ? "pt-2 border-t border-dashed border-[var(--color-border)]" : ""}
              >
                {/* Single complaint line: bullet | lat | text | since | remove */}
                <div className="flex items-center gap-1.5 min-w-0 flex-wrap sm:flex-nowrap">
                  {complaints.length > 1 && (
                    <span className="text-caption font-bold text-[var(--color-ink-400)] w-5 text-center shrink-0 select-none">
                      {i + 1}.
                    </span>
                  )}

                  {/* Laterality */}
                  <div className="flex gap-0.5 shrink-0">
                    {LATERALITY_OPTIONS.map((opt) => {
                      const active = c.lat === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          disabled={readOnly}
                          onClick={() => patchComplaint(i, { lat: active ? null : opt })}
                          className="px-2.5 py-0.5 rounded-full text-caption font-bold transition-all"
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

                  {/* Complaint text — multiple selected keywords stay in this field as bullets */}
                  <textarea
                    value={c.text}
                    onChange={(e) => patchComplaint(i, { text: e.target.value.replace(/\|/g, "/") })}
                    disabled={readOnly}
                    placeholder="Complaint…"
                    rows={Math.max(1, Math.min(5, c.text.split("\n").length))}
                    className="grow basis-full sm:basis-0 min-w-0 resize-none rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1 text-sm leading-5 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] disabled:bg-[var(--color-surface-sunken)]"
                  />

                  {/* Keyword popover trigger */}
                  {!readOnly && (
                    <ComplaintKeywordButton
                      idx={i}
                      open={openKwIdx === i}
                      onToggle={() => setOpenKwIdx(openKwIdx === i ? null : i)}
                      onClose={() => setOpenKwIdx(null)}
                      getValue={() => c.text}
                      onAppend={(kw) => patchComplaint(i, { text: appendComplaintKeyword(c.text, kw) })}
                      onRemoveFromText={(kw) => patchComplaint(i, { text: removeKeywordFromText(c.text, kw) })}
                    />
                  )}

                  {/* Since */}
                  <span
                    className="text-caption font-semibold text-[var(--color-ink-400)] shrink-0"
                    {...(!c.sinceNum ? { "data-ov-empty": "" } : {})}
                  >Since</span>
                  <select
                    value={c.sinceNum}
                    onChange={(e) => patchComplaint(i, { sinceNum: e.target.value })}
                    disabled={readOnly}
                    className="text-caption border border-[var(--color-border)] rounded-md px-1.5 py-1 bg-white text-[var(--color-ink-700)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-500)] disabled:opacity-50 w-12 shrink-0"
                    {...(!c.sinceNum ? { "data-ov-empty": "" } : {})}
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
                    className="text-caption border border-[var(--color-border)] rounded-md px-1.5 py-1 bg-white text-[var(--color-ink-700)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-500)] disabled:opacity-50 w-16 shrink-0"
                    {...(!c.sinceNum ? { "data-ov-empty": "" } : {})}
                  >
                    {SINCE_UNITS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>

                  {/* Remove */}
                  {!readOnly && complaints.length > 1 && (
                    <button
                      data-overview-hide
                      type="button"
                      onClick={() => removeComplaint(i)}
                      title={`Remove complaint ${i + 1}`}
                      className="p-1 rounded-lg text-[var(--color-ink-400)] hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                    >
                      <X size={13} strokeWidth={2.5} />
                    </button>
                  )}
                </div>


              </div>
            ))}
          </div>
        </FieldWithHistory>
        <div className="flex justify-end mt-2">
          <label className="flex items-center gap-1.5 text-caption cursor-pointer select-none text-[var(--color-ink-500)] hover:text-[var(--color-ink-700)]">
            <input type="checkbox" checked={ccInPrint} onChange={(e) => setCcInPrint(e.target.checked)} className="accent-[var(--color-primary-600)]" />
            Add to custom print
          </label>
        </div>
      </Card>
      </div>

      {/* HISTORY OF PRESENT ILLNESS */}
      <div {...(overview && !hasHpi ? { "data-overview-empty-section": "" } : {})}>
      <Card>
        <FieldWithHistory label="HISTORY OF PRESENT ILLNESS" history={histFor((g) => g.hpi)} currentValue={hpi} onLoad={readOnly ? undefined : setHpi}>
          <KeywordTextarea fieldKey="ge_hpi" value={hpi} onChange={setHpi} disabled={readOnly} rows={3} placeholder="Onset, character, duration, aggravating/relieving factors..." />
        </FieldWithHistory>
      </Card>
      </div>

      {/* PAST HISTORY */}
      <div {...(overview && !hasPmh ? { "data-overview-empty-section": "" } : {})}>
      <Card>
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold tracking-widest text-[var(--color-ink-500)] uppercase">
            Past History <span className="text-caption font-normal normal-case tracking-normal text-[var(--color-ink-400)]">(cumulative across visits)</span>
          </p>
          {!readOnly && (
            <button
              data-overview-hide
              type="button"
              onClick={() => addPmhRow()}
              aria-label="Add past history entry"
              title="Add past history entry"
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-primary-300)] bg-[var(--color-primary-50)] px-2.5 py-1.5 text-caption font-semibold text-[var(--color-primary-700)] hover:bg-[var(--color-primary-100)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] transition-colors"
            >
              <Plus size={13} strokeWidth={2.5} /> Add
            </button>
          )}
        </div>

        <div className="space-y-2">
          {pmh.map((entry, index) => (
            <div
              key={index}
              className="flex items-start gap-2"
            >
              <span className="w-6 pt-2 text-caption font-semibold tabular-nums text-[var(--color-ink-400)]">{index + 1}.</span>
              <div className="grid min-w-0 flex-1 grid-cols-[auto_4.5rem_minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[minmax(12rem,1fr)_auto_4.5rem_6.5rem_auto]">
                <input
                  value={entry.name}
                  onChange={(event) => patchPmh(index, { name: event.target.value })}
                  disabled={readOnly}
                  aria-label={`Past history condition ${index + 1}`}
                  placeholder="Enter condition or past procedure"
                  className="col-span-4 min-w-0 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-ink-800)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] disabled:bg-[var(--color-surface-sunken)] sm:col-span-1"
                />
                <span className="text-caption font-semibold text-[var(--color-ink-400)]">Since</span>
                <select
                  value={entry.sinceNum}
                  onChange={(event) => patchPmh(index, { sinceNum: event.target.value })}
                  disabled={readOnly}
                  aria-label={`Past history duration ${index + 1}`}
                  className="rounded-lg border border-[var(--color-border)] bg-white px-2 py-2 text-sm text-[var(--color-ink-700)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] disabled:bg-[var(--color-surface-sunken)]"
                >
                  <option value="">—</option>
                  {Array.from({ length: 100 }, (_, n) => n + 1).map((n) => (
                    <option key={n} value={String(n)}>{n}</option>
                  ))}
                </select>
                <select
                  value={entry.sinceUnit}
                  onChange={(event) => patchPmh(index, { sinceUnit: event.target.value })}
                  disabled={readOnly || !entry.sinceNum}
                  aria-label={`Past history duration unit ${index + 1}`}
                  className="rounded-lg border border-[var(--color-border)] bg-white px-2 py-2 text-sm capitalize text-[var(--color-ink-700)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] disabled:bg-[var(--color-surface-sunken)] disabled:opacity-60"
                >
                  {SINCE_UNITS.map((unit) => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
                {!readOnly && (
                  <button
                    data-overview-hide
                    type="button"
                    onClick={() => removePmhRow(index)}
                    aria-label={`Delete past history entry ${index + 1}`}
                    title="Delete entry"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-ink-400)] hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors"
                  >
                    <X size={15} strokeWidth={2.25} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {pmh.length === 0 && (
            <p className="rounded-lg border border-dashed border-[var(--color-border)] px-3 py-2 text-caption text-[var(--color-ink-400)]">
              {readOnly ? "No past history recorded." : "No past history added."}
            </p>
          )}
        </div>

        {!readOnly && (
          <div data-overview-hide className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[var(--color-border)] pt-3">
            <span className="mr-1 text-caption font-semibold text-[var(--color-ink-400)]">Keywords</span>
            {visiblePmhOptions.map((option) => {
              const active = cumulativePmh.some((entry) => entry.name.toLowerCase() === option.toLowerCase());
              return (
                <button
                  key={option}
                  type="button"
                  disabled={active}
                  className="chip disabled:cursor-default"
                  data-active={active}
                  onClick={() => addPmhRow(option)}
                >
                  {option}
                </button>
              );
            })}
          </div>
        )}
      </Card>
      </div>

      {/* CURRENT MEDICATIONS */}
      <div {...(overview && !hasMeds ? { "data-overview-empty-section": "" } : {})}>
      <Card>
        <FieldWithHistory label="CURRENT MEDICATIONS" history={histFor((g) => g.medications)} currentValue={medications} onLoad={readOnly ? undefined : (v) => setMedRows(parseMeds(v))}>
          {readOnly ? (
            <CmReadOnly meds={medRows.filter((m) => m.drugName.trim())} />
          ) : (
            <CmEditor rows={medRows} onChange={setMedRows} />
          )}
        </FieldWithHistory>
      </Card>
      </div>

      {/* SYSTEMIC HISTORY */}
      <div {...(overview && !hasOtherHistory ? { "data-overview-empty-section": "" } : {})}>
      <Card>
        <FieldWithHistory label="SYSTEMIC HISTORY" history={histFor((g) => g.pmhOtherText)} currentValue={pmhOther} onLoad={readOnly ? undefined : setPmhOther}>
          <KeywordTextarea fieldKey="ge_pmh_other" value={pmhOther} onChange={setPmhOther} disabled={readOnly} rows={3} placeholder="Add relevant systemic history..." />
        </FieldWithHistory>
      </Card>
      </div>

      {/* ALLERGIES */}
      <div {...(overview && !hasAllergies ? { "data-overview-empty-section": "" } : {})}>
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
        <div className="flex justify-end mt-2">
          <label className="flex items-center gap-1.5 text-caption cursor-pointer select-none text-[var(--color-ink-500)] hover:text-[var(--color-ink-700)]">
            <input type="checkbox" checked={allergyInPrint} onChange={(e) => setAllergyInPrint(e.target.checked)} className="accent-[var(--color-primary-600)]" />
            Add to custom print
          </label>
        </div>
      </Card>
      </div>

      {/* VITALS — collapsible, moved to bottom */}
      <div {...(overview && !hasVitals ? { "data-overview-empty-section": "" } : {})}>
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

// ── Current Medications structured editor ─────────────────────────────────

function CmDrugInput({ value, onChange, className }: { value: string; onChange: (name: string, defaultDose?: string) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const blurRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestions = useMemo(() => searchMedications(value), [value]);

  return (
    <div className="relative flex-1 min-w-0">
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => { blurRef.current = setTimeout(() => setOpen(false), 150); }}
        placeholder="Drug name"
        className={className}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <div
          className="absolute z-50 left-0 right-0 top-full mt-0.5 bg-white rounded-xl shadow-xl border border-[var(--color-border)] overflow-auto"
          style={{ maxHeight: 200 }}
          onMouseDown={(e) => { e.preventDefault(); if (blurRef.current) clearTimeout(blurRef.current); }}
        >
          {suggestions.map((med: MedEntry) => (
            <button
              key={med.id}
              type="button"
              onClick={() => { onChange(med.name, med.defaultDose); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-xs border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-primary-50)] hover:text-[var(--color-primary-700)] transition-colors"
            >
              <span className="font-semibold">{med.name}</span>
              {med.defaultDose && <span className="text-[var(--color-ink-400)] ml-1">· {med.defaultDose}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CmOptionsInput({ value, options, onChange, placeholder, className }: { value: string; options: string[]; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const blurRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    return q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
  }, [value, options]);

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => { blurRef.current = setTimeout(() => setOpen(false), 150); }}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div
          className="absolute z-50 left-0 right-0 top-full mt-0.5 bg-white rounded-xl shadow-xl border border-[var(--color-border)] overflow-auto"
          style={{ maxHeight: 160 }}
          onMouseDown={(e) => { e.preventDefault(); if (blurRef.current) clearTimeout(blurRef.current); }}
        >
          {filtered.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => { onChange(opt); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-xs border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-primary-50)] hover:text-[var(--color-primary-700)] transition-colors"
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CmEditor({ rows, onChange }: { rows: CurrentMed[]; onChange: (r: CurrentMed[]) => void }) {
  const set = (i: number, field: keyof CurrentMed, val: string) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, [field]: val } : r)));

  const remove = (i: number) => {
    const next = rows.filter((_, idx) => idx !== i);
    onChange(next.length === 0 ? [{ drugName: "", dosage: "", frequency: "", duration: "" }] : next);
  };

  const inputCls = "w-full rounded-lg border border-[var(--color-border)] bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-400)]";

  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <CmDrugInput
            value={row.drugName}
            onChange={(name, defaultDose) =>
              onChange(rows.map((r, idx) => idx === i ? { ...r, drugName: name, ...(defaultDose && !r.dosage ? { dosage: defaultDose } : {}) } : r))
            }
            className={`${inputCls} flex-1 min-w-0`}
          />
          <CmOptionsInput value={row.dosage} options={CM_DOSE_OPTIONS} onChange={(v) => set(i, "dosage", v)} placeholder="Dose" className={`${inputCls} w-20 shrink-0`} />
          <CmOptionsInput value={row.frequency} options={CM_FREQ_OPTIONS} onChange={(v) => set(i, "frequency", v)} placeholder="Frequency" className={`${inputCls} w-32 shrink-0`} />
          <CmOptionsInput value={row.duration} options={CM_DUR_OPTIONS} onChange={(v) => set(i, "duration", v)} placeholder="Duration" className={`${inputCls} w-24 shrink-0`} />
          <button type="button" onClick={() => remove(i)} className="shrink-0 text-[var(--color-ink-300)] hover:text-red-500 p-0.5 transition-colors">
            <X size={13} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, { drugName: "", dosage: "", frequency: "", duration: "" }])}
        className="self-start text-xs text-[var(--color-primary-700)] hover:underline mt-0.5"
      >
        + Add medication
      </button>
    </div>
  );
}

function CmReadOnly({ meds }: { meds: CurrentMed[] }) {
  if (meds.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      {meds.map((m, i) => (
        <div key={i} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
          <span className="font-medium text-[var(--color-ink-800)]">{m.drugName}</span>
          {m.dosage    && <span className="text-[var(--color-ink-500)]">{m.dosage}</span>}
          {m.frequency && <span className="text-[var(--color-ink-500)]">{m.frequency}</span>}
          {m.duration  && <span className="text-[var(--color-primary-700)]">{m.duration}</span>}
        </div>
      ))}
    </div>
  );
}
