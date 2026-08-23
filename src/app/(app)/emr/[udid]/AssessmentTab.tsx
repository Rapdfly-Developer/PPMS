"use client";

import { useState, useTransition, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { SingleChipSelect } from "@/components/ui/Chip";
import { ICD10_OPHTHALMOLOGY, DIAGNOSIS_STATUSES, LATERALITY } from "@/lib/constants";
import { addDiagnosis, updateDiagnosisStatus, removeDiagnosis, removeMedication } from "./actions";
import { useAutoSave, SaveIndicator } from "@/lib/useAutoSave";
import { X, History, ChevronDown, Search, PenLine, Plus, Check, Ban, Stethoscope, FileText, Lock, AlertTriangle } from "lucide-react";

const DOSAGE_OPTIONS = [
  "1 Drop","2 Drops","3 Drops","4 Drops","6 Drops",
  "0.5 ml","1 ml","2 ml","2.5 ml","5 ml","10 ml",
  "Half Tablet","1 Tablet","2 Tablets",
  "5 mg","10 mg","20 mg","25 mg","40 mg","50 mg","75 mg","100 mg","200 mg","250 mg","500 mg","1 g",
  "0.1%","0.5%","1%","2%","5%",
];

const FREQUENCY_OPTIONS = [
  "Once daily (OD)","Twice daily (BD)","Three times daily (TDS)","Four times daily (QID)",
  "Every 4 hours (Q4H)","Every 6 hours (Q6H)","Every 8 hours (Q8H)","Every 12 hours (Q12H)",
  "At bedtime (HS)","Before meals","After meals","With meals",
  "Once weekly","Twice weekly","Once monthly",
  "As needed (PRN)","Stat (immediately)",
];

const DURATION_OPTIONS = [
  "1 day","2 days","3 days","4 days","5 days","6 days",
  "1 week","10 days","2 weeks","3 weeks",
  "1 month","6 weeks","2 months","3 months","6 months","1 year",
  "Ongoing","Long term","Till review",
];

const FIELD_OPTIONS: Record<"dosage"|"frequency"|"duration", string[]> = {
  dosage: DOSAGE_OPTIONS,
  frequency: FREQUENCY_OPTIONS,
  duration: DURATION_OPTIONS,
};

function PresetFieldCombobox({
  field, value, onChange, placeholder,
}: {
  field: "dosage" | "frequency" | "duration";
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [inputVal, setInputVal] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setInputVal(value); }, [value]);

  const filtered = useMemo(() => {
    const q = inputVal.toLowerCase();
    return q ? FIELD_OPTIONS[field].filter((o) => o.toLowerCase().includes(q)) : FIELD_OPTIONS[field];
  }, [field, inputVal]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <input
        value={inputVal}
        onChange={(e) => { setInputVal(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] pr-6"
      />
      <ChevronDown
        size={11}
        className={`absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] pointer-events-none transition-transform ${open ? "rotate-180" : ""}`}
      />
      {open && (
        <ul className="absolute z-40 left-0 right-0 mt-1 rounded-xl border border-[var(--color-border)] bg-white shadow-xl overflow-hidden max-h-44 overflow-y-auto">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-xs text-[var(--color-ink-400)]">No matches — press Enter to use &ldquo;{inputVal}&rdquo;</li>
          ) : (
            filtered.map((opt) => (
              <li key={opt}>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); setInputVal(opt); onChange(opt); setOpen(false); }}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-[var(--color-surface-sunken)] ${opt === value ? "font-semibold text-[var(--color-primary-700)] bg-[var(--color-primary-50)]" : "text-[var(--color-ink-700)]"}`}
                >
                  {opt}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
import {
  getTreatmentPresets, saveTreatmentPresets,
  getApplied, setApplied,
  type TreatmentPreset,
  type TreatmentPresetMed,
} from "./treatmentPresets";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Toast } from "@/components/ui/Toast";
import { format } from "date-fns";
import { getCustomDiagnoses, saveCustomDiagnosis, isDuplicateDescription, type CustomDx } from "@/lib/customDiagnoses";

type DiagnosisItem = { code: string; description: string; custom: boolean; category?: string };

type TaperingStepDraft = { dosage: string; frequency: string; duration: string };
type PresetMedDraft = { drugName: string; steps: TaperingStepDraft[]; instructions: string };

type CustomModalState = {
  name: string;
  code: string;
  category: string;
  notes: string;
  target: "icd" | "provisional";
  error: string;
  step: "diagnosis" | "preset";
  savedCode: string;
  savedDescription: string;
};

/* ── Diagnosis row: Confirm / Reject, then protocol selection ────────────── */

// Kept at module scope so React preserves the subtree across parent renders --
// defining it inside AssessmentTab would remount every row on each render and
// steal focus from the status select.
function DiagnosisRow({
  d, provisional = false, isCustom, pending,
  onReject, onStatusChange,
}: {
  d: any;
  provisional?: boolean;
  isCustom: boolean;
  pending: boolean;
  onReject: (d: any) => void;
  onStatusChange: (d: any, status: string) => void;
}) {

  return (
    <li className="rounded-xl border border-[var(--color-border)] px-3.5 py-2.5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-[var(--color-ink-900)]">{d.description}</p>
            {isCustom && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Custom</span>
            )}
          </div>
          <p className="text-xs text-[var(--color-ink-400)] font-mono">
            {d.laterality ? `${d.laterality} · ` : ""}{d.icd10Code || "—"}{provisional ? " · Provisional" : ""}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <select
            value={d.status}
            onChange={(e) => onStatusChange(d, e.target.value)}
            className="text-xs rounded-lg border border-[var(--color-border)] px-2 py-1 bg-white"
          >
            {DIAGNOSIS_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            onClick={() => onReject(d)}
            disabled={pending}
            className="text-[var(--color-ink-400)] hover:text-[var(--color-danger-600)] disabled:opacity-50"
            aria-label={`Remove ${d.description}`}
          >
            <X size={15} />
          </button>
        </div>
      </div>

    </li>
  );
}

/* ── Protocol picker modal ───────────────────────────────────────────────── */

const PROTOCOL_SLOTS = ["Protocol 1", "Protocol 2", "Protocol 3"] as const;
type ProtocolSlot = typeof PROTOCOL_SLOTS[number] | "custom";

function ProtocolPickerModal({
  diagnosis,
  protocols,
  pending,
  onConfirm,
  onCancel,
}: {
  diagnosis: any;
  protocols: TreatmentPreset[];
  pending: boolean;
  onConfirm: (preset: TreatmentPreset | null, customName: string) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<ProtocolSlot>("Protocol 1");
  const [customName, setCustomName] = useState("");

  const canSubmit = selected !== "custom" || customName.trim().length > 0;

  function handleConfirm() {
    if (selected === "custom") {
      onConfirm(null, customName.trim());
    } else {
      const slotIndex = PROTOCOL_SLOTS.indexOf(selected);
      const preset = protocols[slotIndex] ?? null;
      onConfirm(preset, preset ? "" : selected);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="w-full max-w-sm rounded-2xl bg-[var(--color-surface)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-[var(--color-primary-600)]">
          <div className="flex items-center gap-2.5 text-white">
            <Stethoscope size={17} />
            <div>
              <p className="text-[13px] font-semibold">Select Treatment Protocol</p>
              <p className="text-[11px] text-white/70 mt-0.5 truncate max-w-[200px]">{diagnosis.description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/15 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-ink-400)] mb-1">
            Which protocol are you selecting?
          </p>

          {/* Fixed Protocol 1 / 2 / 3 slots */}
          {PROTOCOL_SLOTS.map((label, i) => {
            const preset = protocols[i] ?? null;
            const isActive = selected === label;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setSelected(label)}
                className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
                  isActive
                    ? "border-[var(--color-primary-500)] bg-[var(--color-primary-50)]"
                    : "border-[var(--color-border)] hover:border-[var(--color-primary-300)]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-ink-800)]">{label}</p>
                    {preset && (
                      <p className="text-xs text-[var(--color-ink-500)] mt-0.5">{preset.name}</p>
                    )}
                  </div>
                  {isActive && (
                    <Check size={16} className="text-[var(--color-primary-600)] shrink-0" />
                  )}
                </div>
              </button>
            );
          })}

          {/* Custom option */}
          <button
            type="button"
            onClick={() => setSelected("custom")}
            className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
              selected === "custom"
                ? "border-amber-400 bg-amber-50"
                : "border-[var(--color-border)] hover:border-amber-300"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText size={15} className="text-amber-600 shrink-0" />
                <p className="text-sm font-semibold text-[var(--color-ink-800)]">Custom</p>
              </div>
              {selected === "custom" && <Check size={16} className="text-amber-600 shrink-0" />}
            </div>
          </button>

          {selected === "custom" && (
            <textarea
              autoFocus
              rows={3}
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Describe the custom protocol…"
              className="w-full rounded-xl border border-[var(--color-border)] px-3.5 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 bg-[var(--color-surface)]"
            />
          )}
        </div>

        <div className="px-5 py-4 border-t border-[var(--color-border)] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit || pending}
            onClick={handleConfirm}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-[var(--color-primary-600)] text-white text-sm font-semibold hover:bg-[var(--color-primary-700)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Check size={14} />
            Confirm Diagnosis
          </button>
        </div>
      </div>
    </div>
  );
}

export function AssessmentTab({
  visit, udid, priorVisits = [], readOnly = false,
}: {
  visit: any;
  udid: string;
  priorVisits?: any[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  // Split diagnoses by provisional flag
  const provisionalDiagnoses: any[] = (visit.diagnoses ?? []).filter((d: any) => d.provisional);
  const diagnoses: any[] = (visit.diagnoses ?? []).filter((d: any) => !d.provisional);

  // Server actions on this tab throw when the visit is finalized or out of the
  // doctor's scope. Without surfacing that, the rejection is swallowed inside
  // the transition and the click looks like it simply did nothing.
  const [actionError, setActionError] = useState<string | null>(null);

  const [provQuery, setProvQuery] = useState("");
  const [provLaterality, setProvLateralityState] = useState<string>(
    () => sessionStorage.getItem(`prov-lat-${visit.id}`) ?? "OU"
  );
  const setProvLaterality = (v: string) => { sessionStorage.setItem(`prov-lat-${visit.id}`, v); setProvLateralityState(v); };
  const [showProvSuggestions, setShowProvSuggestions] = useState(false);
  const [provSuggestionIndex, setProvSuggestionIndex] = useState(-1);
  const provBlurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [provHistoryOpen, setProvHistoryOpen] = useState(false);
  const [confirmProvGroup, setConfirmProvGroup] = useState<any[] | null>(null);
  const [provDxToast, setProvDxToast] = useState(false);

  const [query, setQuery] = useState("");
  const [laterality, setLateralityState] = useState<string>(
    () => sessionStorage.getItem(`icd-lat-${visit.id}`) ?? "OU"
  );
  const setLaterality = (v: string) => { sessionStorage.setItem(`icd-lat-${visit.id}`, v); setLateralityState(v); };
  const [pending, startTransition] = useTransition();

  /** Runs a mutating server action, surfacing any error instead of failing silently. */
  const run = (fn: () => Promise<void>) => {
    if (readOnly) {
      setActionError("This consultation is finalized and read-only.");
      return;
    }
    setActionError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (err: unknown) {
        setActionError(err instanceof Error ? err.message : "Could not save that change.");
      }
    });
  };

  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmDxGroup, setConfirmDxGroup] = useState<any[] | null>(null);
  const [dxToast, setDxToast] = useState(false);
  const [presetToast, setPresetToast] = useState<string[]>([]);
  const [customDxList, setCustomDxList] = useState<CustomDx[]>([]);
  const [customModal, setCustomModal] = useState<CustomModalState | null>(null);
  const emptyStep = (): TaperingStepDraft => ({ dosage: "", frequency: "", duration: "" });
  const emptyMed = (): PresetMedDraft => ({ drugName: "", steps: [emptyStep()], instructions: "" });
  const [presetName, setPresetName] = useState("");
  const [presetMeds, setPresetMeds] = useState<PresetMedDraft[]>([emptyMed()]);
  const [presetFollowUpDays, setPresetFollowUpDays] = useState("");
  const [presetAdvice, setPresetAdvice] = useState("");
  const [presetInvestigations, setPresetInvestigations] = useState("");
  const [medDropdownOpen, setMedDropdownOpen] = useState(-1);
  const [allKnownMeds, setAllKnownMeds] = useState<import("./treatmentPresets").TreatmentPresetMed[]>([]);

  useEffect(() => {
    setCustomDxList(getCustomDiagnoses());
    const presets = getTreatmentPresets();
    const seen = new Set<string>();
    const meds: import("./treatmentPresets").TreatmentPresetMed[] = [];
    for (const preset of presets) {
      for (const med of preset.medications) {
        const key = med.drugName.toLowerCase();
        if (!seen.has(key)) { seen.add(key); meds.push(med); }
      }
    }
    setAllKnownMeds(meds);
  }, []);

  // Merged ICD-10 + custom diagnoses for search
  const allDiagnoses = useMemo<DiagnosisItem[]>(() => [
    ...ICD10_OPHTHALMOLOGY.map((d) => ({ ...d, custom: false })),
    ...customDxList.map((d) => ({ code: d.code, description: d.description, custom: true, category: d.category })),
  ], [customDxList]);

  // Prior visit groups — provisional
  const priorProvGroups = priorVisits
    .filter((v) => v.diagnoses?.some((d: any) => d.provisional))
    .map((v) => ({ date: v.date, diagnoses: (v.diagnoses as any[]).filter((d) => d.provisional) }));

  // Prior visit groups — ICD-10
  const priorDxGroups = priorVisits
    .filter((v) => v.diagnoses?.some((d: any) => !d.provisional))
    .map((v) => ({ date: v.date, diagnoses: (v.diagnoses as any[]).filter((d) => !d.provisional) }));

  const existingCodes = new Set(diagnoses.map((d: any) => d.icd10Code));
  const existingProvCodes = new Set(provisionalDiagnoses.map((d: any) => d.icd10Code));

  // Search suggestions — provisional
  const provSuggestions = useMemo(() =>
    provQuery.length >= 2
      ? allDiagnoses
          .filter((d) =>
            d.description.toLowerCase().includes(provQuery.toLowerCase()) ||
            d.code.toLowerCase().includes(provQuery.toLowerCase()),
          )
          .sort((a, b) => {
            const q = provQuery.toLowerCase();
            return (a.description.toLowerCase().startsWith(q) ? -1 : 0) -
                   (b.description.toLowerCase().startsWith(q) ? -1 : 0);
          })
          .slice(0, 8)
      : [],
  [provQuery, allDiagnoses]);

  // Search suggestions — ICD-10
  const icdMatches = useMemo(() =>
    query.length > 0
      ? allDiagnoses
          .filter((d) =>
            d.code.toLowerCase().includes(query.toLowerCase()) ||
            d.description.toLowerCase().includes(query.toLowerCase()),
          )
          .slice(0, 6)
      : [],
  [query, allDiagnoses]);

  const openCustomModal = (target: "icd" | "provisional") => {
    const prefill = target === "icd" ? query.trim() : provQuery.trim();
    setCustomModal({ name: prefill, code: "", category: "", notes: "", target, error: "", step: "diagnosis", savedCode: "", savedDescription: "" });
    if (target === "icd") setQuery(""); else setProvQuery("");
    setShowProvSuggestions(false);
  };

  const handleSaveCustomDx = () => {
    if (!customModal) return;
    const name = customModal.name.trim();
    if (!name) { setCustomModal({ ...customModal, error: "Diagnosis name is required." }); return; }
    if (isDuplicateDescription(name, ICD10_OPHTHALMOLOGY)) {
      setCustomModal({ ...customModal, error: "A diagnosis with this name already exists." }); return;
    }
    const saved = saveCustomDiagnosis({
      code: customModal.code.trim(),
      description: name,
      category: customModal.category.trim(),
      notes: customModal.notes.trim(),
    });
    setCustomDxList((prev) => [...prev, saved]);

    if (customModal.target === "icd") {
      addIcd(saved.code, saved.description);
    } else {
      addProv(saved.code, saved.description);
    }

    setPresetName(`${name} Protocol`);
    setPresetMeds([emptyMed()]);
    setPresetFollowUpDays("");
    setPresetAdvice("");
    setPresetInvestigations("");
    setCustomModal({ ...customModal, step: "preset", savedCode: saved.code, savedDescription: saved.description, error: "" });
  };

  const handleSavePreset = () => {
    if (!customModal) return;
    const validMeds: TreatmentPresetMed[] = presetMeds
      .filter((m) => m.drugName.trim())
      .map((m) => {
        const validSteps = m.steps.filter((s) => s.dosage || s.frequency || s.duration);
        return {
          drugName: m.drugName.trim(),
          ...(validSteps.length > 0 && { taperingSteps: validSteps }),
          // flat fields from first step — for backward compat with display code
          ...(validSteps[0]?.dosage     && { dosage:     validSteps[0].dosage }),
          ...(validSteps[0]?.frequency  && { frequency:  validSteps[0].frequency }),
          ...(validSteps[0]?.duration   && { duration:   validSteps[0].duration }),
          ...(m.instructions.trim()     && { instructions: m.instructions.trim() }),
        };
      });
    const investigations = presetInvestigations.trim()
      ? presetInvestigations.split("\n").map((s) => s.trim()).filter(Boolean)
      : undefined;
    const followUpDays = presetFollowUpDays ? parseInt(presetFollowUpDays, 10) : undefined;

    const newPreset = {
      id: `tx-custom-${Date.now()}`,
      name: presetName.trim() || `${customModal.savedDescription} Protocol`,
      diagnosisCodes: customModal.savedCode ? [customModal.savedCode] : [],
      diagnosisKeywords: [customModal.savedDescription.toLowerCase()],
      medications: validMeds,
      ...(investigations && { investigations }),
      ...(presetAdvice.trim() && { advice: presetAdvice.trim() }),
      ...(followUpDays        && { followUpDays }),
      createdAt: new Date().toISOString(),
    };

    const existing = getTreatmentPresets().filter((p) => !p.isDefault);
    saveTreatmentPresets([...existing, newPreset]);

    // The diagnosis itself was already added in the modal's first step. The new
    // preset now shows up as a protocol option once it is confirmed.
    router.refresh();
    setCustomModal(null);
  };

  // Remove preset meds when a diagnosis is deleted or its protocol is swapped.
  // Returns the ids of the medications actually deleted so a follow-on apply can
  // treat them as already gone -- `visit.medications` is a stale server snapshot
  // for the rest of this transition.
  const autoRemovePresetMeds = async (removedDesc: string, quiet = false): Promise<Set<string>> => {
    const allPresets = getTreatmentPresets();
    const applied    = getApplied(visit.id);

    // Use diagnosisDesc to find exactly which presets were triggered by this diagnosis
    const lostApplied = applied.filter((a) => a.diagnosisDesc === removedDesc);
    if (lostApplied.length === 0) return new Set();

    const lostIds     = new Set(lostApplied.map((a) => a.presetId));
    const lostPresets = allPresets.filter((p) => lostIds.has(p.id));

    if (lostPresets.length === 0) {
      setApplied(visit.id, applied.filter((a) => !lostIds.has(a.presetId)));
      return new Set();
    }

    const drugNamesToRemove = new Set<string>();
    lostPresets.forEach((p) => p.medications.forEach((m) => drugNamesToRemove.add(m.drugName.toLowerCase())));

    const currentMeds: any[] = visit.medications ?? [];
    const medsToDelete = currentMeds.filter((m) => drugNamesToRemove.has(m.drugName.toLowerCase()));
    for (const med of medsToDelete) { await removeMedication(med.id, udid); }

    setApplied(visit.id, applied.filter((a) => !lostIds.has(a.presetId)));

    if (!quiet && medsToDelete.length > 0) {
      setPresetToast([`Removed ${medsToDelete.length} preset medication${medsToDelete.length > 1 ? "s" : ""} from Plan`]);
      setTimeout(() => setPresetToast([]), 4000);
    }
    return new Set(medsToDelete.map((m) => m.id));
  };


  const handleStatusChange = (d: any, status: string) => {
    run(async () => {
      await updateDiagnosisStatus(d.id, udid, status);
    });
  };

  // Reject removes the diagnosis outright, along with any meds it contributed.
  const handleReject = (d: any) => {
    run(async () => {
      await autoRemovePresetMeds(d.description);
      await removeDiagnosis(d.id, udid);
    });
  };

  // Add provisional diagnosis
  const addProv = (code: string, description: string) => {
    run(async () => {
      await addDiagnosis(visit.id, udid, { icd10Code: code, description, laterality: provLaterality, provisional: true });
      setProvQuery("");
    });
  };

  // Add ICD-10 diagnosis
  const addIcd = (code: string, description: string) => {
    run(async () => {
      await addDiagnosis(visit.id, udid, { icd10Code: code, description, laterality });
      setQuery("");
    });
  };

  const loadProvGroup = (dxList: any[]) => {
    const missing = dxList.filter((d: any) => !existingProvCodes.has(d.icd10Code));
    run(async () => {
      for (const d of missing) {
        await addDiagnosis(visit.id, udid, { icd10Code: d.icd10Code, description: d.description, laterality: d.laterality ?? "OU", provisional: true });
      }
    });
    setProvHistoryOpen(false);
    setProvDxToast(true);
  };

  const loadDxGroup = (dxList: any[]) => {
    const missing = dxList.filter((d: any) => !existingCodes.has(d.icd10Code));
    run(async () => {
      for (const d of missing) {
        await addDiagnosis(visit.id, udid, { icd10Code: d.icd10Code, description: d.description, laterality: d.laterality ?? "OU" });
      }
    });
    setHistoryOpen(false);
    setDxToast(true);
  };

  const handleProvGroupDoubleClick = (dxList: any[]) => {
    if (provisionalDiagnoses.length > 0) setConfirmProvGroup(dxList);
    else loadProvGroup(dxList);
  };

  const handleDxGroupDoubleClick = (dxList: any[]) => {
    if (diagnoses.length > 0) setConfirmDxGroup(dxList);
    else loadDxGroup(dxList);
  };

  const isCustomDiagnosis = (d: any) =>
    !d.icd10Code || customDxList.some((c) => c.description.toLowerCase() === d.description.toLowerCase());

  const handleProvKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showProvSuggestions || provSuggestions.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setProvSuggestionIndex((i) => Math.min(i + 1, provSuggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setProvSuggestionIndex((i) => Math.max(i - 1, -1)); }
    else if (e.key === "Enter" && provSuggestionIndex >= 0) { e.preventDefault(); addProv(provSuggestions[provSuggestionIndex].code, provSuggestions[provSuggestionIndex].description); setShowProvSuggestions(false); setProvSuggestionIndex(-1); }
    else if (e.key === "Escape") { setShowProvSuggestions(false); setProvSuggestionIndex(-1); }
  };

  return (
    <>
    <div className="flex flex-col gap-5">

      {/* Finalized consultations are read-only — say so rather than letting
          clicks fail silently against the server-side guard. */}
      {readOnly && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
          <Lock size={15} className="shrink-0 mt-0.5" />
          <span>This consultation has been finalized and is read-only. Diagnoses can no longer be changed.</span>
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
        >
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <span className="flex-1">{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-red-500 hover:text-red-700 shrink-0"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Provisional Diagnosis ─────────────────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-[var(--color-ink-700)]">Provisional Diagnosis</p>
          <button
            type="button"
            onClick={() => setProvHistoryOpen((v) => !v)}
            className="flex items-center gap-1 text-xs text-[#0F766E] bg-[#EEF8F7] hover:bg-[#DCF3F1] font-medium px-2.5 py-0.5 rounded-full border border-[#B2DEDA] transition-colors"
          >
            <History size={11} />
            History {priorProvGroups.length > 0 && `(${priorProvGroups.length})`}
            <ChevronDown size={11} className={provHistoryOpen ? "rotate-180 transition-transform" : "transition-transform"} />
          </button>
        </div>

        {provHistoryOpen && (
          <div className="mb-4 rounded-xl border border-[#B2DEDA] bg-[#EEF8F7] p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#0F766E]">Previous Provisional Diagnoses</p>
              {priorProvGroups.length > 0 && (
                <p className="text-[10px] text-[#0D9488]">Double-click a visit to load its diagnoses</p>
              )}
            </div>
            {priorProvGroups.length === 0 ? (
              <p className="text-xs text-[var(--color-ink-400)] py-2 text-center">No previous records found.</p>
            ) : (
              <div className="space-y-3 max-h-56 overflow-y-auto scrollbar-thin">
                {priorProvGroups.map((g, gi) => (
                  <div
                    key={gi}
                    onDoubleClick={() => handleProvGroupDoubleClick(g.diagnoses)}
                    title="Double-click to add these diagnoses"
                    className="cursor-pointer rounded-lg px-2 py-1.5 -mx-1.5 hover:bg-[#DCF3F1] transition-colors select-none"
                  >
                    <p className="text-[10px] font-semibold text-[var(--color-ink-400)] mb-2">{format(new Date(g.date), "d MMM yyyy")}</p>
                    <div className="flex flex-col gap-1.5">
                      {g.diagnoses.map((d: any, di: number) => {
                        const sm = ({
                          ACTIVE:   { pill: "bg-amber-100 text-amber-700 border-amber-200",   label: "Active" },
                          CHRONIC:  { pill: "bg-orange-100 text-orange-700 border-orange-200", label: "Chronic" },
                          RESOLVED: { pill: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Resolved" },
                        } as Record<string, { pill: string; label: string }>)[d.status] ?? { pill: "bg-slate-100 text-slate-500 border-slate-200", label: d.status ?? "—" };
                        const nextStatus = d.status === "RESOLVED" ? "ACTIVE" : "RESOLVED";
                        const nextLabel  = d.status === "RESOLVED" ? "Still Active" : "Resolved";
                        return (
                          <div key={di} className="flex items-center gap-2 py-1 border-b border-[#B2DEDA]/40 last:border-0">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-[var(--color-ink-800)] leading-tight truncate">{d.description}</p>
                              {(d.laterality || d.icd10Code) && (
                                <p className="text-[10px] font-mono text-[var(--color-ink-400)] mt-0.5">
                                  {[d.laterality, d.icd10Code].filter(Boolean).join(" · ")}
                                </p>
                              )}
                            </div>
                            <span className={`inline-flex shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${sm.pill}`}>
                              {sm.label}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleStatusChange(d, nextStatus); }}
                              disabled={pending}
                              className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-ink-600)] hover:border-[var(--color-primary-300)] hover:text-[var(--color-primary-700)] transition-colors disabled:opacity-40"
                            >
                              {nextLabel}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-end gap-3 flex-wrap mb-2">
          <div>
            <p className="text-xs font-medium text-[var(--color-ink-500)] mb-1.5">Laterality</p>
            <SingleChipSelect options={LATERALITY} value={provLaterality} onChange={setProvLaterality} />
          </div>
          <div className="relative flex-1 min-w-[240px]">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] pointer-events-none" />
            <input
              value={provQuery}
              disabled={readOnly}
              onChange={(e) => { setProvQuery(e.target.value); setShowProvSuggestions(true); setProvSuggestionIndex(-1); }}
              onFocus={() => { if (provBlurTimerRef.current) clearTimeout(provBlurTimerRef.current); setShowProvSuggestions(true); }}
              onBlur={() => { provBlurTimerRef.current = setTimeout(() => setShowProvSuggestions(false), 150); }}
              onKeyDown={handleProvKeyDown}
              placeholder="Search ICD-10 code or description..."
              className="w-full rounded-xl border border-[var(--color-border)] pl-9 pr-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] disabled:opacity-60 disabled:cursor-not-allowed"
            />
            {showProvSuggestions && provQuery.length >= 2 && !readOnly && (
              <ul className="absolute z-20 left-0 right-0 mt-1 rounded-xl border border-[var(--color-border)] bg-white shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                {provSuggestions.length === 0 ? (
                  <li>
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); openCustomModal("provisional"); }}
                      className="w-full text-left px-3.5 py-3.5 text-sm flex items-center gap-2.5 text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)] transition-colors"
                    >
                      <Plus size={15} className="shrink-0 text-[var(--color-primary-500)]" />
                      <span>No diagnosis found. Add <span className="font-semibold">&ldquo;{provQuery.trim()}&rdquo;</span> as Custom Diagnosis</span>
                    </button>
                  </li>
                ) : (
                  <>
                    {provSuggestions.map((s, i) => (
                      <li key={s.code || s.description}>
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); addProv(s.code, s.description); setShowProvSuggestions(false); setProvSuggestionIndex(-1); }}
                          className={`w-full text-left px-3.5 py-2.5 text-sm text-[var(--color-ink-800)] hover:bg-[var(--color-surface-sunken)] flex items-center justify-between gap-4 transition-colors ${
                            i === provSuggestionIndex ? "bg-[var(--color-primary-50)] text-[var(--color-primary-700)]" : ""
                          }`}
                        >
                          <span className="flex-1 min-w-0 truncate">{s.description}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            {s.custom && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Custom</span>
                            )}
                            {s.code && <span className="text-xs font-mono text-[var(--color-ink-400)]">{s.code}</span>}
                          </div>
                        </button>
                      </li>
                    ))}
                    <li className="border-t border-[var(--color-border)]">
                      <button
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); openCustomModal("provisional"); }}
                        className="w-full text-left px-3.5 py-2.5 text-sm flex items-center gap-2 text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)] transition-colors"
                      >
                        <Plus size={13} className="shrink-0" />
                        <span>Add &ldquo;<span className="font-medium">{provQuery.trim()}</span>&rdquo; as Custom Diagnosis</span>
                      </button>
                    </li>
                  </>
                )}
              </ul>
            )}
          </div>
          <button
            type="button"
            onClick={() => openCustomModal("provisional")}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2.5 rounded-xl border transition-colors whitespace-nowrap bg-white text-[var(--color-ink-600)] border-[var(--color-border)] hover:border-[var(--color-primary-400)] hover:text-[var(--color-primary-600)]"
          >
            <PenLine size={13} />
            Add Manually
          </button>
        </div>

        {provisionalDiagnoses.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-400)] py-4 text-center">No provisional diagnoses added yet. Search above to begin.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {provisionalDiagnoses.map((d) => (
              <DiagnosisRow
                key={d.id}
                d={d}
                provisional
                isCustom={isCustomDiagnosis(d)}
                pending={pending}
                onReject={handleReject}
                onStatusChange={handleStatusChange}
              />
            ))}
          </ul>
        )}
      </Card>

      {/* ── Diagnosis (ICD-10) ────────────────────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-[var(--color-ink-700)]">Diagnosis (ICD-10)</p>
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            className="flex items-center gap-1 text-xs text-[#0F766E] bg-[#EEF8F7] hover:bg-[#DCF3F1] font-medium px-2.5 py-0.5 rounded-full border border-[#B2DEDA] transition-colors"
          >
            <History size={11} />
            History {priorDxGroups.length > 0 && `(${priorDxGroups.length})`}
            <ChevronDown size={11} className={historyOpen ? "rotate-180 transition-transform" : "transition-transform"} />
          </button>
        </div>
        {historyOpen && (
          <div className="mb-4 rounded-xl border border-[#B2DEDA] bg-[#EEF8F7] p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#0F766E]">Previous Diagnoses</p>
              {priorDxGroups.length > 0 && (
                <p className="text-[10px] text-[#0D9488]">Double-click a visit to load its diagnoses</p>
              )}
            </div>
            {priorDxGroups.length === 0 ? (
              <p className="text-xs text-[var(--color-ink-400)] py-2 text-center">No previous records found.</p>
            ) : (
              <div className="space-y-3 max-h-56 overflow-y-auto scrollbar-thin">
                {priorDxGroups.map((g, gi) => (
                  <div
                    key={gi}
                    onDoubleClick={() => handleDxGroupDoubleClick(g.diagnoses)}
                    title="Double-click to add these diagnoses"
                    className="cursor-pointer rounded-lg px-2 py-1.5 -mx-1.5 hover:bg-[#DCF3F1] transition-colors select-none"
                  >
                    <p className="text-[10px] font-semibold text-[var(--color-ink-400)] mb-2">{format(new Date(g.date), "d MMM yyyy")}</p>
                    <div className="flex flex-col gap-1.5">
                      {g.diagnoses.map((d: any, di: number) => {
                        const sm = ({
                          ACTIVE:   { pill: "bg-amber-100 text-amber-700 border-amber-200",   label: "Active" },
                          CHRONIC:  { pill: "bg-orange-100 text-orange-700 border-orange-200", label: "Chronic" },
                          RESOLVED: { pill: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Resolved" },
                        } as Record<string, { pill: string; label: string }>)[d.status] ?? { pill: "bg-slate-100 text-slate-500 border-slate-200", label: d.status ?? "—" };
                        const nextStatus = d.status === "RESOLVED" ? "ACTIVE" : "RESOLVED";
                        const nextLabel  = d.status === "RESOLVED" ? "Still Active" : "Resolved";
                        return (
                          <div key={di} className="flex items-center gap-2 py-1 border-b border-[#B2DEDA]/40 last:border-0">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-[var(--color-ink-800)] leading-tight truncate">{d.description}</p>
                              {(d.laterality || d.icd10Code) && (
                                <p className="text-[10px] font-mono text-[var(--color-ink-400)] mt-0.5">
                                  {[d.laterality, d.icd10Code].filter(Boolean).join(" · ")}
                                </p>
                              )}
                            </div>
                            <span className={`inline-flex shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${sm.pill}`}>
                              {sm.label}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleStatusChange(d, nextStatus); }}
                              disabled={pending}
                              className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-ink-600)] hover:border-[var(--color-primary-300)] hover:text-[var(--color-primary-700)] transition-colors disabled:opacity-40"
                            >
                              {nextLabel}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-end gap-3 flex-wrap mb-2">
          <div>
            <p className="text-xs font-medium text-[var(--color-ink-500)] mb-1.5">Laterality</p>
            <SingleChipSelect options={LATERALITY} value={laterality} onChange={setLaterality} />
          </div>
          <div className="relative flex-1 min-w-[240px]">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] pointer-events-none" />
            <input
              value={query}
              disabled={readOnly}
              onChange={(e) => { setQuery(e.target.value); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && query.trim() && icdMatches.length === 0) openCustomModal("icd");
              }}
              placeholder="Search ICD-10 code or description..."
              className="w-full rounded-xl border border-[var(--color-border)] pl-9 pr-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] disabled:opacity-60 disabled:cursor-not-allowed"
            />
            {query.length > 0 && !readOnly && (
              <ul className="absolute z-20 left-0 right-0 mt-1 rounded-xl border border-[var(--color-border)] bg-white shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                {icdMatches.length === 0 ? (
                  <li>
                    <button
                      onClick={() => openCustomModal("icd")}
                      className="w-full text-left px-3.5 py-3.5 text-sm flex items-center gap-2.5 text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)] transition-colors"
                    >
                      <Plus size={15} className="shrink-0 text-[var(--color-primary-500)]" />
                      <span>No diagnosis found. Add <span className="font-semibold">&ldquo;{query.trim()}&rdquo;</span> as Custom Diagnosis</span>
                    </button>
                  </li>
                ) : (
                  <>
                    {icdMatches.map((m) => (
                      <li key={m.code || m.description}>
                        <button
                          onClick={() => { addIcd(m.code, m.description); setQuery(""); }}
                          className="w-full text-left px-3.5 py-2.5 text-sm text-[var(--color-ink-800)] hover:bg-[var(--color-surface-sunken)] flex items-center justify-between gap-4"
                        >
                          <span className="flex-1 min-w-0 truncate">{m.description}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            {m.custom && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Custom</span>
                            )}
                            {m.code && <span className="text-xs font-mono text-[var(--color-ink-400)]">{m.code}</span>}
                          </div>
                        </button>
                      </li>
                    ))}
                    <li className="border-t border-[var(--color-border)]">
                      <button
                        onClick={() => openCustomModal("icd")}
                        className="w-full text-left px-3.5 py-2.5 text-sm flex items-center gap-2 text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)] transition-colors"
                      >
                        <Plus size={13} className="shrink-0" />
                        <span>Add &ldquo;<span className="font-medium">{query.trim()}</span>&rdquo; as Custom Diagnosis</span>
                      </button>
                    </li>
                  </>
                )}
              </ul>
            )}
          </div>
          <button
            type="button"
            onClick={() => openCustomModal("icd")}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2.5 rounded-xl border transition-colors whitespace-nowrap bg-white text-[var(--color-ink-600)] border-[var(--color-border)] hover:border-[var(--color-primary-400)] hover:text-[var(--color-primary-600)]"
          >
            <PenLine size={13} />
            Add Manually
          </button>
        </div>

        {diagnoses.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-400)] py-4 text-center">No diagnoses added yet. Search above to begin.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {diagnoses.map((d) => (
              <DiagnosisRow
                key={d.id}
                d={d}
                isCustom={isCustomDiagnosis(d)}
                pending={pending}
                onReject={handleReject}
                onStatusChange={handleStatusChange}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>

      {/* Custom Diagnosis → Add Preset modal */}
      {customModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={() => setCustomModal(null)}
        >
          <div
            className={`relative w-full rounded-2xl shadow-2xl overflow-hidden bg-white ${customModal.step === "preset" ? "max-w-xl" : "max-w-md"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="px-5 py-4 flex items-center justify-between border-b border-[var(--color-border)]"
              style={{ background: "linear-gradient(135deg, #0F766E 0%, #0D9488 100%)" }}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                  <Plus size={15} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {customModal.step === "preset" ? "Add Treatment Preset" : "Add Custom Diagnosis"}
                  </p>
                  {customModal.step === "preset" && (
                    <p className="text-xs text-white/70 mt-0.5">for <span className="font-medium text-white">{customModal.savedDescription}</span></p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 mr-2">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${customModal.step === "diagnosis" ? "bg-white text-[#0F766E]" : "bg-white/30 text-white"}`}>1</div>
                  <div className="w-4 h-px bg-white/30" />
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${customModal.step === "preset" ? "bg-white text-[#0F766E]" : "bg-white/30 text-white"}`}>2</div>
                </div>
                <button type="button" onClick={() => setCustomModal(null)} className="text-white/60 hover:text-white p-1 transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>

            {customModal.step === "diagnosis" && (
              <>
                <div className="px-5 py-4 flex flex-col gap-4">
                  {customModal.error && (
                    <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{customModal.error}</p>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-ink-600)] mb-1.5">
                      Diagnosis Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      autoFocus
                      value={customModal.name}
                      onChange={(e) => setCustomModal({ ...customModal, name: e.target.value, error: "" })}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSaveCustomDx(); }}
                      placeholder="e.g. Bilateral Exophoria"
                      className="w-full rounded-xl border border-[var(--color-border)] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--color-ink-600)] mb-1.5">
                        ICD Code <span className="text-[var(--color-ink-300)] font-normal">(optional)</span>
                      </label>
                      <input
                        value={customModal.code}
                        onChange={(e) => setCustomModal({ ...customModal, code: e.target.value })}
                        placeholder="e.g. H50.9"
                        className="w-full rounded-xl border border-[var(--color-border)] px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--color-ink-600)] mb-1.5">
                        Category <span className="text-[var(--color-ink-300)] font-normal">(optional)</span>
                      </label>
                      <input
                        value={customModal.category}
                        onChange={(e) => setCustomModal({ ...customModal, category: e.target.value })}
                        placeholder="e.g. Strabismus"
                        className="w-full rounded-xl border border-[var(--color-border)] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-ink-600)] mb-1.5">
                      Description <span className="text-[var(--color-ink-300)] font-normal">(optional)</span>
                    </label>
                    <textarea
                      rows={2}
                      value={customModal.notes}
                      onChange={(e) => setCustomModal({ ...customModal, notes: e.target.value })}
                      placeholder="Any additional notes about this diagnosis..."
                      className="w-full rounded-xl border border-[var(--color-border)] px-3.5 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
                    />
                  </div>
                  <p className="text-[11px] text-[var(--color-ink-400)] -mt-1">
                    Saved to your custom library. Next step: add a treatment preset so medications auto-populate in Plan.
                  </p>
                </div>
                <div className="px-5 py-4 border-t border-[var(--color-border)] flex items-center justify-end gap-2">
                  <button type="button" onClick={() => setCustomModal(null)}
                    className="px-4 py-2 rounded-xl border border-[var(--color-border)] text-sm font-medium text-[var(--color-ink-500)] hover:bg-[var(--color-surface-sunken)] transition-colors">
                    Cancel
                  </button>
                  <button type="button" disabled={!customModal.name.trim()} onClick={handleSaveCustomDx}
                    className="px-5 py-2 rounded-xl bg-[#0F766E] text-white text-sm font-semibold hover:bg-[#0D6862] transition-colors disabled:opacity-40">
                    Save &amp; Add →
                  </button>
                </div>
              </>
            )}

            {customModal.step === "preset" && (
              <>
                <div className="px-5 py-4 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-ink-600)] mb-1.5">Preset Name</label>
                    <input
                      autoFocus
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      placeholder="e.g. Infection Protocol"
                      className="w-full rounded-xl border border-[var(--color-border)] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-ink-600)] mb-2">Medication</label>
                    <div className="flex flex-col gap-2">
                      {presetMeds.map((m, i) => {
                        const medQuery = m.drugName.toLowerCase();
                        const medSuggestions = medQuery.length >= 1
                          ? allKnownMeds.filter((med) => med.drugName.toLowerCase().includes(medQuery)).slice(0, 8)
                          : [];
                        return (
                        <div key={i} className="rounded-xl border border-[var(--color-border)] p-3 flex flex-col gap-3">
                          {/* Drug name */}
                          <div className="relative">
                            <input
                              value={m.drugName}
                              onChange={(e) => { setPresetMeds((p) => p.map((r, idx) => idx === i ? { ...r, drugName: e.target.value } : r)); setMedDropdownOpen(i); }}
                              onFocus={() => setMedDropdownOpen(i)}
                              onBlur={() => setTimeout(() => setMedDropdownOpen((v) => v === i ? -1 : v), 150)}
                              placeholder="Drug name *"
                              autoComplete="off"
                              className="w-full rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
                            />
                            {medDropdownOpen === i && medSuggestions.length > 0 && (
                              <ul className="absolute z-30 left-0 right-0 mt-1 rounded-xl border border-[var(--color-border)] bg-white shadow-xl overflow-hidden max-h-52 overflow-y-auto">
                                {medSuggestions.map((med, mi) => (
                                  <li key={mi}>
                                    <button
                                      type="button"
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        const firstStep = med.taperingSteps?.[0];
                                        setPresetMeds((p) => p.map((r, idx) => idx === i ? {
                                          drugName: med.drugName,
                                          steps: med.taperingSteps
                                            ? med.taperingSteps.map((s) => ({ dosage: s.dosage, frequency: s.frequency, duration: s.duration }))
                                            : [{ dosage: med.dosage ?? "", frequency: med.frequency ?? "", duration: med.duration ?? "" }],
                                          instructions: med.instructions ?? "",
                                        } : r));
                                        setMedDropdownOpen(-1);
                                      }}
                                      className="w-full text-left px-3.5 py-2 hover:bg-[var(--color-surface-sunken)] transition-colors"
                                    >
                                      <p className="text-xs font-medium text-[var(--color-ink-800)] truncate">{med.drugName}</p>
                                      {(med.dosage || med.frequency || med.duration) && (
                                        <p className="text-[11px] text-[var(--color-ink-400)] mt-0.5 truncate">
                                          {[med.dosage, med.frequency, med.duration].filter(Boolean).join(" · ")}
                                        </p>
                                      )}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>

                          {/* Tapering steps */}
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">Tapering Schedule</p>
                            </div>
                            {m.steps.map((step, si) => (
                              <div key={si} className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-[var(--color-ink-400)] w-10 shrink-0 text-right">
                                  {si === 0 ? "Start" : `Step ${si + 1}`}
                                </span>
                                <div className="grid grid-cols-3 gap-1.5 flex-1">
                                  {(["dosage", "frequency", "duration"] as const).map((field) => (
                                    <PresetFieldCombobox
                                      key={field}
                                      field={field}
                                      value={step[field]}
                                      onChange={(v) => setPresetMeds((p) => p.map((r, ri) => ri === i
                                        ? { ...r, steps: r.steps.map((s, sj) => sj === si ? { ...s, [field]: v } : s) }
                                        : r
                                      ))}
                                      placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                                    />
                                  ))}
                                </div>
                                {m.steps.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => setPresetMeds((p) => p.map((r, ri) => ri === i
                                      ? { ...r, steps: r.steps.filter((_, sj) => sj !== si) }
                                      : r
                                    ))}
                                    className="text-[var(--color-ink-400)] hover:text-[var(--color-danger-600)] shrink-0 transition-colors"
                                  >
                                    <X size={13} />
                                  </button>
                                )}
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => setPresetMeds((p) => p.map((r, ri) => ri === i
                                ? { ...r, steps: [...r.steps, emptyStep()] }
                                : r
                              ))}
                              className="flex items-center gap-1 text-xs text-[var(--color-primary-600)] hover:text-[var(--color-primary-800)] font-medium mt-1 transition-colors w-fit"
                            >
                              <Plus size={12} /> Add Tapering Step
                            </button>
                          </div>

                          {/* Instructions */}
                          <input
                            value={m.instructions}
                            onChange={(e) => setPresetMeds((p) => p.map((r, idx) => idx === i ? { ...r, instructions: e.target.value } : r))}
                            placeholder="Instructions (optional)"
                            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
                          />
                        </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--color-ink-600)] mb-1.5">
                        Follow-up <span className="text-[var(--color-ink-300)] font-normal">(days)</span>
                      </label>
                      <input
                        type="number" min="1" max="365"
                        value={presetFollowUpDays}
                        onChange={(e) => setPresetFollowUpDays(e.target.value)}
                        placeholder="e.g. 7"
                        className="w-full rounded-xl border border-[var(--color-border)] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--color-ink-600)] mb-1.5">
                        Investigations <span className="text-[var(--color-ink-300)] font-normal">(one per line)</span>
                      </label>
                      <textarea rows={2}
                        value={presetInvestigations}
                        onChange={(e) => setPresetInvestigations(e.target.value)}
                        placeholder={"Visual Acuity\nIOP measurement"}
                        className="w-full rounded-xl border border-[var(--color-border)] px-3.5 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-ink-600)] mb-1.5">
                      Advice <span className="text-[var(--color-ink-300)] font-normal">(optional)</span>
                    </label>
                    <textarea rows={2}
                      value={presetAdvice}
                      onChange={(e) => setPresetAdvice(e.target.value)}
                      placeholder="Patient advice to include in the plan..."
                      className="w-full rounded-xl border border-[var(--color-border)] px-3.5 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
                    />
                  </div>
                </div>
                <div className="px-5 py-4 border-t border-[var(--color-border)] flex items-center justify-between gap-2">
                  <button type="button" onClick={() => setCustomModal(null)}
                    className="text-xs text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)] transition-colors">
                    Skip for now
                  </button>
                  <div className="flex items-center gap-2">
                    <button type="button"
                      disabled={!presetMeds.some((m) => m.drugName.trim())}
                      onClick={handleSavePreset}
                      className="px-5 py-2 rounded-xl bg-[#0F766E] text-white text-sm font-semibold hover:bg-[#0D6862] transition-colors disabled:opacity-40">
                      Save Preset &amp; Apply to Plan
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {confirmProvGroup && (
        <ConfirmDialog
          title="Load Previous Record?"
          message="Loading this history will add any missing provisional diagnoses. Do you want to continue?"
          onConfirm={() => { loadProvGroup(confirmProvGroup); setConfirmProvGroup(null); }}
          onCancel={() => setConfirmProvGroup(null)}
        />
      )}
      {confirmDxGroup && (
        <ConfirmDialog
          title="Load Previous Record?"
          message="Loading this history will replace the current unsaved values. Do you want to continue?"
          onConfirm={() => { loadDxGroup(confirmDxGroup); setConfirmDxGroup(null); }}
          onCancel={() => setConfirmDxGroup(null)}
        />
      )}
      {provDxToast && (
        <Toast message="Previous provisional diagnoses loaded." onDone={() => setProvDxToast(false)} />
      )}
      {dxToast && (
        <Toast message="Previous record loaded successfully." onDone={() => setDxToast(false)} />
      )}
      {presetToast.length > 0 && (
        <Toast
          message={`✨ Plan updated: ${presetToast.join(", ")}`}
          onDone={() => setPresetToast([])}
        />
      )}

    </>
  );
}
