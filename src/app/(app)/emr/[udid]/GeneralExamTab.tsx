"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { convertNotesToCC, parseComplaintItems } from "@/lib/appointment-cc";
import { ChevronDown, AlertTriangle, Plus, X, Tag } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { FieldWithHistory } from "@/components/ui/HistoryToggle";
import { PAST_MEDICAL_HISTORY_CHIPS, VITAL_RANGES, CHIEF_COMPLAINT_FIELD_KEY, CHIEF_COMPLAINT_LEGACY_KEYS } from "@/lib/constants";
import { appendComplaintKeyword, OPHTHALMIC_COMPLAINTS } from "@/components/ui/ComplaintCombobox";
import { parseJSON } from "@/lib/json";
import { useAutoSave, SaveIndicator } from "@/lib/useAutoSave";
import { KeywordTextarea, KeywordChipsRow, removeKeywordFromText } from "@/components/emr/KeywordField";
import { saveGeneralExam } from "./actions";
import { HpiBuilder } from "./HpiBuilder";
import { createPortal } from "react-dom";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { HpiFormatted } from "@/components/emr/HpiFormatted";
import { buildHpiText, hasHpiFields, type HpiFields } from "@/lib/hpi-builder";
import { type MedEntry, searchMedications, saveCustomMedication } from "@/lib/ophthalmic-medications";
import { useEmrOverview } from "./EmrOverviewContext";
import { useEMRSaveContext } from "./EmrSaveContext";
import { ComplaintChips } from "@/components/ui/ComplaintChips";
import { FREQUENCY_OPTIONS, DOSE_OPTIONS, DURATION_OPTIONS } from "@/lib/medication-options";

const LATERALITY_OPTIONS = ["RE", "LE", "OU"] as const;
// Default keywords for the Family History card (doctors can add their own).
const FAMILY_HISTORY_KEYWORDS = [
  "Glaucoma",
  "Diabetes mellitus",
  "Hypertension",
  "High myopia",
  "Squint / amblyopia",
  "Early-onset cataract",
  "Keratoconus",
  "Retinitis pigmentosa",
  "Age-related macular degeneration",
  "Consanguineous marriage",
  "No significant family history",
] as const;
type Laterality = typeof LATERALITY_OPTIONS[number];
const SINCE_UNITS = ["days", "weeks", "months", "years"] as const;
const PMH_CUSTOM_KEY = "kw_ge_pmh_custom";

type CurrentMed = { drugName: string; route?: string; laterality?: string; dosage: string; frequency: string; duration: string };
// Same routes as the Plan tab; systemic routes (Oral, IV, IM) take no eye.
const CM_ROUTE_OPTIONS = ["Topical", "Oral", "IM", "IV", "Subconjunctival", "Intravitreal", "Subtenon"] as const;
const CM_NO_LATERALITY_ROUTES = ["Oral", "IV", "IM"];

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

// Same dose / frequency / duration options as the Plan tab prescription.
const CM_DOSE_OPTIONS = DOSE_OPTIONS;
const CM_FREQ_OPTIONS = FREQUENCY_OPTIONS;
const CM_DUR_OPTIONS  = DURATION_OPTIONS;

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
/** `lat` is RE / LE / OU, or "" when not recorded (the default). */
export type PmhEntry = { name: string; sinceNum: string; sinceUnit: string; lat?: string };

const emptyPmh = (name = ""): PmhEntry => ({ name, sinceNum: "", sinceUnit: "days", lat: "" });
const PMH_LATERALITY = ["RE", "LE", "OU"] as const;

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
        lat:       typeof o.lat === "string" && (PMH_LATERALITY as readonly string[]).includes(o.lat) ? o.lat : "",
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
      // Nor a blank laterality.
      byName.set(key, existing && !e.lat && existing.lat ? { ...e, lat: existing.lat } : e);
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

export function GeneralExamTab({ visit, priorVisits, udid, readOnly, patient }: { visit: any; priorVisits: any[]; udid: string; readOnly: boolean; patient?: { age?: number | null; sex?: string | null; occupation?: string | null } }) {
  const ge = visit.generalExam;
  const [vitalsOpen, setVitalsOpen] = useState(false);
  // Cards other than Chief Complaint start closed, like the
  // Plan tab's Minor Procedure / Patient Disposition cards.
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({});
  const toggleCard = (key: string) => setOpenCards((cur) => ({ ...cur, [key]: !cur[key] }));
  const [bp, setBp] = useState(ge?.bp ?? "");
  const [pulse, setPulse] = useState(ge?.pulse ?? "");
  const [temperature, setTemperature] = useState(ge?.temperature ?? "");
  const [weight, setWeight] = useState(ge?.weight ?? "");
  const [complaints, setComplaints] = useState<Complaint[]>(() => parseComplaints(ge?.chiefComplaint ?? ""));
  const [openKwIdx, setOpenKwIdx] = useState<number | null>(null);
  const [hpi, setHpi] = useState(ge?.hpi ?? "");
  // Structured HPI selections (dropdowns) and whether the box shows raw text for editing.
  const [hpiFields, setHpiFields] = useState<HpiFields>(() => parseJSON<HpiFields>(ge?.hpiFields, {}));
  const [hpiEditing, setHpiEditing] = useState(false);
  // Template on: dropdowns + Generate HPI. Off: the plain HPI text box. Starts on when this visit has template selections.
  const [hpiTemplate, setHpiTemplate] = useState(() => hasHpiFields(parseJSON<HpiFields>(ge?.hpiFields, {})));
  const [confirmHpiReplace, setConfirmHpiReplace] = useState(false);
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
  const [familyHistory, setFamilyHistory] = useState(ge?.familyHistory ?? "");

  const [medRows, setMedRows] = useState<CurrentMed[]>(() => parseMeds(ge?.medications ?? ""));
  const medications = serializeMeds(medRows);
  const [allergies, setAllergies] = useState(ge?.allergies ?? "");
  const [nkda, setNkda] = useState(ge?.nkda ?? false);

  const cumulativePmh = pmh.filter((entry) => entry.name.trim());

  // Past-history keywords the doctor added through "Other" — kept in this
  // browser (localStorage) and offered as chips on every visit from then on.
  const [customPmh, setCustomPmh] = useState<string[]>([]);
  useEffect(() => {
    try { setCustomPmh(JSON.parse(localStorage.getItem(PMH_CUSTOM_KEY) ?? "[]")); } catch { /* storage unavailable */ }
  }, []);
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherText, setOtherText] = useState("");
  const builtInPmh = PAST_MEDICAL_HISTORY_CHIPS.filter((option) => option !== "Other");
  // An entry literally named "Other" (saved before "Other" opened the keyword
  // box) is left out here so it does not show as a second "Other" chip.
  const displayPmhOptions = [...new Map(
    [...builtInPmh, ...customPmh, ...cumulativePmh.map((entry) => entry.name.trim())]
      .filter((option) => option.toLowerCase() !== "other")
      .map((option) => [option.toLowerCase(), option] as const),
  ).values()];

  const addOtherKeyword = () => {
    const name = otherText.trim();
    setOtherText("");
    setOtherOpen(false);
    if (!name) return;
    if (!displayPmhOptions.some((option) => option.toLowerCase() === name.toLowerCase())) {
      const next = [...customPmh, name];
      setCustomPmh(next);
      try { localStorage.setItem(PMH_CUSTOM_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
    }
    addPmhRow(name);
  };

  // Double-tap on a selected chip removes that entry; a single tap does nothing.
  const lastPmhTap = useRef<{ option: string; at: number } | null>(null);
  const tapSelectedPmh = (option: string) => {
    const now = Date.now();
    const last = lastPmhTap.current;
    if (last && last.option === option && now - last.at < 350) {
      lastPmhTap.current = null;
      setPmh((current) => {
        const next = current.filter((entry) => entry.name.trim().toLowerCase() !== option.toLowerCase());
        return next.length > 0 ? next : [emptyPmh()];
      });
    } else {
      lastPmhTap.current = { option, at: now };
    }
  };

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
  // Duration defaults to the first chief complaint's "since" until the doctor picks one.
  const ccDuration = (() => {
    const since = parseComplaintItems(chiefComplaintFull).find((c) => c.since)?.since;
    const m = since?.match(/^(\d+)\s+(\w+)$/);
    if (!m) return null;
    return { num: m[1], unit: m[2].endsWith("s") ? m[2] : `${m[2]}s` };
  })();
  const hpiFieldsView: HpiFields = !hpiFields.durationNum && ccDuration
    ? { ...hpiFields, durationNum: ccDuration.num, durationUnit: ccDuration.unit }
    : hpiFields;
  const setHpiFieldsFromBuilder = (next: HpiFields) => {
    // Keep following the chief complaint while the duration is still the untouched default.
    if (!hpiFields.durationNum && ccDuration && next.durationNum === ccDuration.num && next.durationUnit === ccDuration.unit) {
      const { durationNum: _n, durationUnit: _u, ...rest } = next;
      setHpiFields(rest);
    } else {
      setHpiFields(next);
    }
  };
  const generateHpi = () => {
    setHpi(buildHpiText(hpiFieldsView, patient ?? {}, chiefComplaintFull));
    setHpiEditing(false);
  };
  const data = { bp, pulse, temperature, weight, chiefComplaint: chiefComplaintFull, hpi, hpiFields: JSON.stringify(hpiFields), pastMedicalHistory: JSON.stringify(cumulativePmh), pmhOtherText: pmhOther, familyHistory, medications, allergies, nkda };

  const patchComplaint = (i: number, patch: Partial<Complaint>) =>
    setComplaints((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const removeComplaint = (i: number) => {
    setOpenKwIdx(null);
    setComplaints((prev) => (prev.length === 1 ? [emptyComplaint()] : prev.filter((_, idx) => idx !== i)));
  };

  const { savePaused } = useEMRSaveContext();
  const state = useAutoSave(data, async (d) => {
    if (readOnly) return;
    await saveGeneralExam(visit.id, udid, d);
  }, undefined, { flushOnUnmount: true, paused: savePaused });

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
  const hasFamilyHistory = !!familyHistory.trim();
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
      </Card>
      </div>

      {/* HISTORY OF PRESENT ILLNESS */}
      <div {...(overview && !hasHpi ? { "data-overview-empty-section": "" } : {})}>
      <Card>
        {overview || openCards.hpi ? (
          <FieldWithHistory
            label="HISTORY OF PRESENT ILLNESS"
            headerExtra={
              <span className="flex items-center gap-3">
                <CardChevron open onClick={() => toggleCard("hpi")} />
                <button
                  type="button"
                  data-overview-hide
                  role="switch"
                  aria-checked={hpiTemplate}
                  onClick={() => { setHpiTemplate((v) => !v); setHpiEditing(false); }}
                  className={`inline-flex items-center gap-1.5 rounded-full border pl-1 pr-2.5 py-0.5 text-caption font-medium transition-colors ${
                    hpiTemplate
                      ? "border-[var(--color-primary-300)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)]"
                      : "border-[var(--color-border)] bg-white text-[var(--color-ink-500)] hover:border-[var(--color-primary-300)]"
                  }`}
                >
                  <span className={`relative w-6 h-3.5 rounded-full transition-colors ${hpiTemplate ? "bg-[var(--color-primary-600)]" : "bg-[var(--color-ink-300)]"}`}>
                    <span className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white shadow transition-all ${hpiTemplate ? "left-3" : "left-0.5"}`} />
                  </span>
                  {hpiTemplate ? "Template On" : "Template Off"}
                </button>
              </span>
            }
            history={histFor((g) => g.hpi)} currentValue={hpi} onLoad={readOnly ? undefined : setHpi}
          >
            {!hpiTemplate ? (
              <KeywordTextarea fieldKey="ge_hpi" value={hpi} onChange={setHpi} disabled={readOnly} rows={3} placeholder="Onset, character, duration, aggravating/relieving factors..." />
            ) : (
            <div className="flex flex-col gap-2.5">
              {!readOnly && (
                <HpiBuilder
                  fields={hpiFieldsView}
                  onChange={setHpiFieldsFromBuilder}
                  disabled={readOnly}
                  onGenerate={() => { if (hpi.trim()) setConfirmHpiReplace(true); else generateHpi(); }}
                />
              )}
              {confirmHpiReplace && createPortal(
                <ConfirmDialog
                  title="Replace HPI?"
                  message="The current HPI text will be replaced with the newly generated one."
                  confirmLabel="Replace"
                  onConfirm={() => { setConfirmHpiReplace(false); generateHpi(); }}
                  onCancel={() => setConfirmHpiReplace(false)}
                />,
                document.body,
              )}
              {hpi.trim() && !hpiEditing ? (
                <div className="relative rounded-xl border border-sky-200 border-l-4 border-l-sky-400 bg-sky-50/60 px-3.5 py-2.5">
                  {!readOnly && (
                    <button
                      type="button"
                      data-overview-hide
                      onClick={() => setHpiEditing(true)}
                      className="absolute top-2 right-2 text-caption font-medium px-2 py-0.5 rounded-full border border-[var(--color-border)] bg-white text-[var(--color-ink-500)] hover:text-[var(--color-primary-700)] hover:border-[var(--color-primary-300)] transition-colors"
                    >
                      Edit
                    </button>
                  )}
                  <HpiFormatted text={hpi} />
                </div>
              ) : hpiEditing && (
                <div className="flex flex-col gap-1">
                  <KeywordTextarea fieldKey="ge_hpi" value={hpi} onChange={setHpi} disabled={readOnly} rows={3} placeholder="Onset, character, duration, aggravating/relieving factors..." />
                  {hpiEditing && (
                    <button type="button" onClick={() => setHpiEditing(false)} className="self-end text-caption font-medium text-[var(--color-primary-700)] hover:underline">
                      Done
                    </button>
                  )}
                </div>
              )}
            </div>
            )}
          </FieldWithHistory>
        ) : (
          <ClosedCardHeader label="HISTORY OF PRESENT ILLNESS" onClick={() => toggleCard("hpi")} />
        )}
      </Card>
      </div>

      {/* PAST HISTORY */}
      <div {...(overview && !hasPmh ? { "data-overview-empty-section": "" } : {})}>
      <Card>
        {overview || openCards.pmh ? (
        <>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <p className="text-xs font-semibold tracking-widest text-[var(--color-ink-500)] uppercase">
              Past History <span className="text-caption font-normal normal-case tracking-normal text-[var(--color-ink-400)]">(cumulative across visits)</span>
            </p>
            <CardChevron open onClick={() => toggleCard("pmh")} />
          </div>
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
                <div className="col-span-4 flex min-w-0 items-center gap-2 sm:col-span-1">
                  <select
                    value={entry.lat ?? ""}
                    onChange={(event) => patchPmh(index, { lat: event.target.value })}
                    disabled={readOnly}
                    aria-label={`Past history laterality ${index + 1}`}
                    className="w-[4.5rem] shrink-0 rounded-lg border border-[var(--color-border)] bg-white px-2 py-2 text-sm text-[var(--color-ink-700)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] disabled:bg-[var(--color-surface-sunken)]"
                  >
                    <option value="">—</option>
                    {PMH_LATERALITY.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                  <input
                    value={entry.name}
                    onChange={(event) => patchPmh(index, { name: event.target.value })}
                    disabled={readOnly}
                    aria-label={`Past history condition ${index + 1}`}
                    placeholder="Enter condition or past procedure"
                    className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-ink-800)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] disabled:bg-[var(--color-surface-sunken)]"
                  />
                </div>
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
              const active = cumulativePmh.some((entry) => entry.name.trim().toLowerCase() === option.toLowerCase());
              return (
                <button
                  key={option}
                  type="button"
                  className="chip-kw"
                  data-active={active}
                  title={active ? "Double-tap to remove" : undefined}
                  onClick={() => (active ? tapSelectedPmh(option) : addPmhRow(option))}
                >
                  {option}
                </button>
              );
            })}
            {otherOpen ? (
              <input
                autoFocus
                value={otherText}
                onChange={(event) => setOtherText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") { event.preventDefault(); addOtherKeyword(); }
                  if (event.key === "Escape") { setOtherText(""); setOtherOpen(false); }
                }}
                onBlur={addOtherKeyword}
                placeholder="New keyword…"
                aria-label="New past history keyword"
                className="w-36 rounded-full border border-[var(--color-primary-400)] bg-white px-2 py-0.5 text-caption text-[var(--color-ink-800)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
              />
            ) : (
              <button type="button" className="chip-kw" onClick={() => setOtherOpen(true)}>
                Other
              </button>
            )}
          </div>
        )}
        </>
        ) : (
          <ClosedCardHeader label="PAST HISTORY" onClick={() => toggleCard("pmh")} />
        )}
      </Card>
      </div>

      {/* CURRENT MEDICATIONS */}
      <div {...(overview && !hasMeds ? { "data-overview-empty-section": "" } : {})}>
      <Card>
        {overview || openCards.meds ? (
          <FieldWithHistory label="CURRENT MEDICATIONS" headerExtra={<CardChevron open onClick={() => toggleCard("meds")} />} history={histFor((g) => g.medications)} currentValue={medications} onLoad={readOnly ? undefined : (v) => setMedRows(parseMeds(v))}>
            {readOnly ? (
              <CmReadOnly meds={medRows.filter((m) => m.drugName.trim())} />
            ) : (
              <CmEditor rows={medRows} onChange={setMedRows} />
            )}
          </FieldWithHistory>
        ) : (
          <ClosedCardHeader label="CURRENT MEDICATIONS" onClick={() => toggleCard("meds")} />
        )}
      </Card>
      </div>

      {/* SYSTEMIC HISTORY */}
      <div {...(overview && !hasOtherHistory ? { "data-overview-empty-section": "" } : {})}>
      <Card>
        {overview || openCards.systemic ? (
          <FieldWithHistory label="SYSTEMIC HISTORY" headerExtra={<CardChevron open onClick={() => toggleCard("systemic")} />} history={histFor((g) => g.pmhOtherText)} currentValue={pmhOther} onLoad={readOnly ? undefined : setPmhOther}>
            <KeywordTextarea fieldKey="ge_pmh_other" value={pmhOther} onChange={setPmhOther} disabled={readOnly} rows={3} placeholder="Add relevant systemic history..." />
          </FieldWithHistory>
        ) : (
          <ClosedCardHeader label="SYSTEMIC HISTORY" onClick={() => toggleCard("systemic")} />
        )}
      </Card>
      </div>

      {/* FAMILY HISTORY */}
      <div {...(overview && !hasFamilyHistory ? { "data-overview-empty-section": "" } : {})}>
      <Card>
        {overview || openCards.family ? (
          <FieldWithHistory label="FAMILY HISTORY" headerExtra={<CardChevron open onClick={() => toggleCard("family")} />} history={histFor((g) => g.familyHistory)} currentValue={familyHistory} onLoad={readOnly ? undefined : setFamilyHistory}>
            <KeywordTextarea fieldKey="ge_family_history" builtIns={FAMILY_HISTORY_KEYWORDS} value={familyHistory} onChange={setFamilyHistory} disabled={readOnly} rows={3} placeholder="Add relevant family history..." />
          </FieldWithHistory>
        ) : (
          <ClosedCardHeader label="FAMILY HISTORY" onClick={() => toggleCard("family")} />
        )}
      </Card>
      </div>

      {/* ALLERGIES */}
      <div {...(overview && !hasAllergies ? { "data-overview-empty-section": "" } : {})}>
      <Card>
        {overview || openCards.allergies ? (
          <>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <p className="text-xs font-semibold tracking-widest text-[var(--color-ink-500)] uppercase">Allergies</p>
                <CardChevron open onClick={() => toggleCard("allergies")} />
              </div>
              <label className="flex items-center gap-2 text-xs text-[var(--color-ink-500)]">
                <input type="checkbox" disabled={readOnly} checked={nkda} onChange={(e) => setNkda(e.target.checked)} />
                NKDA (No Known Drug Allergies)
              </label>
            </div>
            {!nkda && (
              <KeywordTextarea fieldKey="ge_allergies" value={allergies} onChange={setAllergies} disabled={readOnly} rows={2} />
            )}
          </>
        ) : (
          <ClosedCardHeader label="ALLERGIES" onClick={() => toggleCard("allergies")} />
        )}
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
            className={`text-[var(--color-ink-400)] transition-transform duration-200 ${vitalsOpen || overview ? "rotate-180" : ""}`}
          />
        </button>
        {(vitalsOpen || overview) && (
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

/** Collapse chevron shown next to an open card's title. */
function CardChevron({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button data-overview-hide type="button" onClick={onClick} aria-label={open ? "Collapse" : "Expand"} className="text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)]">
      <ChevronDown size={14} className={`transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
    </button>
  );
}

/** A closed card: just its title and a chevron; clicking anywhere opens it. */
function ClosedCardHeader({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-3 w-full text-left">
      <span className="text-xs font-semibold tracking-widest text-[var(--color-ink-500)] uppercase">{label}</span>
      <ChevronDown size={14} className="text-[var(--color-ink-400)] shrink-0" />
    </button>
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
  // A typed name that is not in the list can be saved as a custom drug; it then
  // shows in this dropdown (and the Plan tab's) from then on.
  const typed = value.trim();
  const canAddCustom = !!typed && !suggestions.some((med) => med.name.toLowerCase() === typed.toLowerCase());

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
      {open && (suggestions.length > 0 || canAddCustom) && (
        <div
          className="absolute z-50 left-0 right-0 top-full mt-0.5 bg-white rounded-xl shadow-xl border border-[var(--color-border)] overflow-auto"
          style={{ maxHeight: 200 }}
          onMouseDown={(e) => { e.preventDefault(); if (blurRef.current) clearTimeout(blurRef.current); }}
        >
          {canAddCustom && (
            <button
              type="button"
              onClick={() => { saveCustomMedication({ name: typed }); onChange(typed); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-xs border-b border-[var(--color-border)] last:border-0 text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)] transition-colors"
            >
              + Add &ldquo;<span className="font-semibold">{typed}</span>&rdquo; as custom drug
            </button>
          )}
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
      {rows.map((row, i) => {
        // Route first; the rest of the row appears once it is chosen. Rows saved
        // before routes existed keep showing their fields.
        const showFields = !!row.route || !!(row.drugName || row.dosage || row.frequency || row.duration || row.laterality);
        const showEye = !row.route || !CM_NO_LATERALITY_ROUTES.includes(row.route);
        return (
        <div key={i} className="flex items-center gap-1.5">
          <select
            value={row.route ?? ""}
            onChange={(e) => {
              const route = e.target.value;
              onChange(rows.map((r, idx) => idx === i
                ? { ...r, route, ...(CM_NO_LATERALITY_ROUTES.includes(route) ? { laterality: "" } : {}) }
                : r));
            }}
            aria-label="Route"
            className={`${inputCls.replace("w-full ", "")} ${showFields ? "w-28" : "w-32"} shrink-0`}
          >
            <option value="">Route</option>
            {CM_ROUTE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          {showFields && (
          <>
          {showEye && (
          <select
            value={row.laterality ?? ""}
            onChange={(e) => set(i, "laterality", e.target.value)}
            aria-label="Laterality"
            className={`${inputCls.replace("w-full ", "")} w-16 shrink-0`}
          >
            <option value="">Eye</option>
            {LATERALITY_OPTIONS.map((lat) => <option key={lat} value={lat}>{lat}</option>)}
          </select>
          )}
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
          </>
          )}
          <button type="button" onClick={() => remove(i)} className={`shrink-0 text-[var(--color-ink-300)] hover:text-red-500 p-0.5 transition-colors ${showFields ? "" : "ml-auto"}`}>
            <X size={13} />
          </button>
        </div>
        );
      })}
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
          {m.laterality && <span className="font-semibold text-[var(--color-primary-700)]">{m.laterality}</span>}
          <span className="font-medium text-[var(--color-ink-800)]">{m.drugName}</span>
          {m.dosage    && <span className="text-[var(--color-ink-500)]">{m.dosage}</span>}
          {m.frequency && <span className="text-[var(--color-ink-500)]">{m.frequency}</span>}
          {m.duration  && <span className="text-[var(--color-primary-700)]">{m.duration}</span>}
        </div>
      ))}
    </div>
  );
}
