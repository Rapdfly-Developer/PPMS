"use client";

import { useState, useTransition, useEffect, useRef, useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { History } from "lucide-react";
import { parseJSON } from "@/lib/json";
import { useAutoSave, SaveIndicator } from "@/lib/useAutoSave";
import { addMedication, removeMedication, saveRefraction, saveFollowUp } from "./actions";
import { DispositionToggle, AdmitPanel, SurgicalPanel, FollowUpdatesPanel } from "./DispositionPanel";
import { Plus, X, BedDouble, Stethoscope, ChevronDown, Pencil, Trash2, RefreshCw, Search, Pill, Sparkles, AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import {
  type TreatmentPreset, type PresetMatch, type AppliedPreset,
  getTreatmentPresets, matchPresets, mergeMeds,
  getApplied, setApplied, clearApplied,
  getDiagnosisSnapshot, setDiagnosisSnapshot,
} from "./treatmentPresets";
import { type MedEntry, searchMedications, categoryColor } from "@/lib/ophthalmic-medications";
import { VA_SNELLEN_VALUES } from "@/lib/constants";

/* ── Preset types & storage ──────────────────────────────────────────────── */

const PRESET_KEY = "rx_presets_v1";

interface PresetDrug { drugName: string; dosage?: string; frequency?: string; duration?: string; }
interface Preset { id: string; category: string; name: string; drugs: PresetDrug[]; }

const DEFAULT_PRESETS: Preset[] = [
  {
    id: "default-1", category: "Primary Open-Angle Glaucoma (POAG)", name: "Standard",
    drugs: [
      { drugName: "Timolol 0.5%",      dosage: "1 drop", frequency: "BD (Twice daily)" },
      { drugName: "Latanoprost 0.005%", dosage: "1 drop", frequency: "OD (Once daily)" },
    ],
  },
  {
    id: "default-2", category: "Primary Open-Angle Glaucoma (POAG)", name: "Maximum Medical Therapy",
    drugs: [
      { drugName: "Timolol 0.5%",      dosage: "1 drop", frequency: "BD (Twice daily)" },
      { drugName: "Latanoprost 0.005%", dosage: "1 drop", frequency: "OD (Once daily)" },
      { drugName: "Brimonidine 0.2%",   dosage: "1 drop", frequency: "TID (Three times daily)" },
      { drugName: "Dorzolamide 2%",     dosage: "1 drop", frequency: "TID (Three times daily)" },
    ],
  },
  {
    id: "default-3", category: "Post Cataract Surgery", name: "Standard Post-op",
    drugs: [
      { drugName: "Prednisolone 1%",   dosage: "1 drop", frequency: "QID (Four times daily)" },
      { drugName: "Moxifloxacin 0.5%", dosage: "1 drop", frequency: "QID (Four times daily)" },
      { drugName: "Ketorolac 0.5%",    dosage: "1 drop", frequency: "TID (Three times daily)" },
    ],
  },
  {
    id: "default-4", category: "Dry Eye", name: "Standard",
    drugs: [
      { drugName: "Sodium hyaluronate",      dosage: "1 drop", frequency: "QID (Four times daily)" },
      { drugName: "Carboxymethylcellulose",  dosage: "1 drop", frequency: "QID (Four times daily)" },
    ],
  },
  {
    id: "default-5", category: "Allergic Conjunctivitis", name: "Standard",
    drugs: [
      { drugName: "Olopatadine 0.1%",    dosage: "1 drop", frequency: "BD (Twice daily)" },
      { drugName: "Ketotifen 0.025%",    dosage: "1 drop", frequency: "BD (Twice daily)" },
    ],
  },
];

function loadPresets(): Preset[] {
  try {
    const stored = localStorage.getItem(PRESET_KEY);
    if (!stored) return DEFAULT_PRESETS;
    const parsed = JSON.parse(stored);
    return parsed.length > 0 ? parsed : DEFAULT_PRESETS;
  } catch { return DEFAULT_PRESETS; }
}
function savePresets(presets: Preset[]) {
  localStorage.setItem(PRESET_KEY, JSON.stringify(presets));
}

/* ── PresetPanel ─────────────────────────────────────────────────────────── */

function PresetPanel({ onApply, onClose }: { onApply: (drugs: PresetDrug[]) => void; onClose: () => void }) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formCategory, setFormCategory] = useState("");
  const [formName, setFormName]         = useState("");
  const [formDrugs, setFormDrugs]       = useState<PresetDrug[]>([{ drugName: "", dosage: "", frequency: "", duration: "" }]);

  useEffect(() => { setPresets(loadPresets()); }, []);

  const grouped = presets.reduce<Record<string, Preset[]>>((acc, p) => {
    (acc[p.category] = acc[p.category] ?? []).push(p);
    return acc;
  }, {});

  const resetForm = () => { setFormCategory(""); setFormName(""); setFormDrugs([{ drugName: "", dosage: "", frequency: "", duration: "" }]); setEditId(null); setShowForm(false); };

  const openEdit = (p: Preset) => {
    setFormCategory(p.category); setFormName(p.name); setFormDrugs(p.drugs.map((d) => ({ ...d })));
    setEditId(p.id); setShowForm(true);
  };

  const saveForm = () => {
    const drugs = formDrugs.filter((d) => d.drugName.trim());
    if (!formName.trim() || !formCategory.trim() || !drugs.length) return;
    let updated: Preset[];
    if (editId) {
      updated = presets.map((p) => p.id === editId ? { id: editId, category: formCategory.trim(), name: formName.trim(), drugs } : p);
    } else {
      updated = [...presets, { id: Date.now().toString(), category: formCategory.trim(), name: formName.trim(), drugs }];
    }
    setPresets(updated); savePresets(updated); resetForm();
  };

  const deletePreset = (id: string) => {
    const updated = presets.filter((p) => p.id !== id);
    setPresets(updated); savePresets(updated);
  };

  const setDrugField = (i: number, field: keyof PresetDrug, val: string) => {
    const next = formDrugs.map((d, idx) => idx === i ? { ...d, [field]: val } : d);
    setFormDrugs(next);
  };

  return (
    <div className="border border-[var(--color-border)] rounded-xl bg-white mb-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <p className="text-sm font-semibold text-[var(--color-ink-700)]">Medication Presets</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-sunken)] transition-colors"
          >
            <Plus size={12} /> New Preset
          </button>
          <button onClick={onClose} className="text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)]"><X size={16} /></button>
        </div>
      </div>

      {/* New / Edit form */}
      {showForm && (
        <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-sunken)]">
          <p className="text-xs font-semibold text-[var(--color-ink-600)] mb-2">{editId ? "Edit Preset" : "New Preset"}</p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input value={formCategory} onChange={(e) => setFormCategory(e.target.value)} placeholder="Category (e.g. Glaucoma)" className="rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-xs" />
            <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Preset name" className="rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-xs" />
          </div>
          {formDrugs.map((d, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-1.5 mb-1.5">
              <input value={d.drugName}  onChange={(e) => setDrugField(i, "drugName",  e.target.value)} placeholder="Drug name"  className="rounded border border-[var(--color-border)] px-2 py-1 text-xs" />
              <input value={d.dosage}    onChange={(e) => setDrugField(i, "dosage",    e.target.value)} placeholder="Dosage"     className="rounded border border-[var(--color-border)] px-2 py-1 text-xs" />
              <input value={d.frequency} onChange={(e) => setDrugField(i, "frequency", e.target.value)} placeholder="Frequency"  className="rounded border border-[var(--color-border)] px-2 py-1 text-xs" />
              <input value={d.duration}  onChange={(e) => setDrugField(i, "duration",  e.target.value)} placeholder="Duration"   className="rounded border border-[var(--color-border)] px-2 py-1 text-xs" />
              <button onClick={() => setFormDrugs(formDrugs.filter((_, idx) => idx !== i))} className="text-[var(--color-ink-400)] hover:text-red-500"><X size={12} /></button>
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <button onClick={() => setFormDrugs([...formDrugs, { drugName: "", dosage: "", frequency: "", duration: "" }])} className="text-xs text-[var(--color-primary-700)] hover:underline">+ Add drug row</button>
            <div className="ml-auto flex gap-2">
              <button onClick={resetForm} className="text-xs px-3 py-1 rounded-lg border border-[var(--color-border)] hover:bg-white">Cancel</button>
              <button onClick={saveForm} className="text-xs px-3 py-1 rounded-lg bg-[var(--color-primary-600)] text-white font-medium hover:bg-[var(--color-primary-700)]">Save Preset</button>
            </div>
          </div>
        </div>
      )}

      {/* Preset list */}
      <div className="px-4 py-3 max-h-96 overflow-y-auto">
        {Object.keys(grouped).length === 0 ? (
          <p className="text-sm text-[var(--color-ink-400)] text-center py-6">No presets yet. Click &quot;+ New Preset&quot; to create one.</p>
        ) : (
          Object.entries(grouped).map(([cat, items]) => (
            <div key={cat} className="mb-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-400)] mb-2">{cat}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {items.map((p) => (
                  <div key={p.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] p-3">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-xs font-semibold text-[var(--color-ink-700)]">{p.name}</p>
                      <div className="flex gap-1.5">
                        <button onClick={() => openEdit(p)} className="text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)]"><Pencil size={12} /></button>
                        <button onClick={() => deletePreset(p.id)} className="text-[var(--color-ink-400)] hover:text-red-500"><Trash2 size={12} /></button>
                      </div>
                    </div>
                    <ul className="mb-3 space-y-0.5">
                      {p.drugs.map((d, i) => (
                        <li key={i} className="text-[11px] text-[var(--color-ink-500)]">
                          · {d.drugName}{d.dosage ? ` ${d.dosage}` : ""}{d.frequency ? ` ${d.frequency}` : ""}{d.duration ? ` ${d.duration}` : ""}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => onApply(p.drugs)}
                      className="w-full py-1.5 rounded-lg bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-xs font-medium text-[var(--color-ink-600)] hover:bg-[var(--color-primary-50)] hover:border-[var(--color-primary-300)] hover:text-[var(--color-primary-700)] transition-colors"
                    >
                      Apply ({p.drugs.length} drug{p.drugs.length !== 1 ? "s" : ""})
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ── Diagnosis-based treatment preset UI components ─────────────────── */

function PresetAvailableBanner({
  matches,
  onApply,
  onDismiss,
}: {
  matches: PresetMatch[];
  onApply: () => void;
  onDismiss: () => void;
}) {
  const diagNames = [...new Set(matches.map((m) => m.diagnosisDesc))];
  return (
    <div className="rounded-2xl border border-[#B2DEDA] bg-[#EEF8F7] px-4 py-3.5 flex items-start gap-3">
      <div className="w-8 h-8 rounded-xl bg-[#0F766E] flex items-center justify-center shrink-0 mt-0.5">
        <Sparkles size={15} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#0F766E]">
          Treatment preset{matches.length > 1 ? "s" : ""} available
        </p>
        <p className="text-xs text-[#0F766E]/80 mt-0.5 leading-relaxed">
          {diagNames.slice(0, 2).join(", ")}{diagNames.length > 2 ? ` +${diagNames.length - 2} more` : ""} — {matches.length} preset{matches.length > 1 ? "s" : ""} found
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs font-medium text-[#0F766E]/60 hover:text-[#0F766E] px-2 py-1.5 rounded-lg hover:bg-[#DCF3F1] transition-colors"
        >
          Dismiss
        </button>
        <button
          type="button"
          onClick={onApply}
          className="text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-[#0F766E] text-white hover:bg-[#0D6862] transition-colors flex items-center gap-1.5"
        >
          <Sparkles size={11} /> Apply Preset
        </button>
      </div>
    </div>
  );
}

function PresetAppliedBadge({
  applied,
  onRemove,
  onChange,
}: {
  applied: AppliedPreset[];
  onRemove: () => void;
  onChange: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[#B2DEDA] bg-[#EEF8F7] px-4 py-3 flex items-center gap-3 flex-wrap">
      <CheckCircle2 size={15} className="text-[#0F766E] shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-xs font-semibold text-[#0F766E]">Preset Applied: </span>
        <span className="text-xs text-[#0F766E]/80">
          {applied.map((a) => a.presetName).join(", ")}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onChange}
          className="text-xs font-medium text-[#0F766E] hover:text-[#0D6862] px-2.5 py-1 rounded-lg border border-[#B2DEDA] hover:bg-[#DCF3F1] transition-colors"
        >
          Change
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs font-medium text-[#0F766E]/60 hover:text-red-600 px-2.5 py-1 rounded-lg border border-[#B2DEDA] hover:border-red-200 hover:bg-red-50 transition-colors"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function DiagnosisChangedBanner({
  onUpdate,
  onDismiss,
}: {
  onUpdate: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 flex items-start gap-3">
      <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
        <AlertTriangle size={15} className="text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-800">Diagnoses have changed</p>
        <p className="text-xs text-amber-700/80 mt-0.5">The assessment diagnoses were updated. Would you like to load a new matching preset?</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs font-medium text-amber-700/60 hover:text-amber-800 px-2 py-1.5 rounded-lg hover:bg-amber-100 transition-colors"
        >
          Keep current
        </button>
        <button
          type="button"
          onClick={onUpdate}
          className="text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors flex items-center gap-1.5"
        >
          <ChevronRight size={11} /> Update
        </button>
      </div>
    </div>
  );
}

function PresetSelectDialog({
  matches,
  onApply,
  onClose,
  applying,
}: {
  matches: PresetMatch[];
  onApply: (selected: TreatmentPreset[]) => void;
  onClose: () => void;
  applying: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set([matches[0]?.preset.id]));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const selectedPresets = matches.filter((m) => selected.has(m.preset.id)).map((m) => m.preset);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: "var(--color-surface)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{ background: "linear-gradient(135deg, #0F766E 0%, #0D9488 100%)" }}
        >
          <div className="flex items-center gap-2.5">
            <Sparkles size={17} className="text-white/80" />
            <p className="text-sm font-semibold text-white">Select Treatment Preset</p>
          </div>
          <button type="button" onClick={onClose} className="text-white/60 hover:text-white p-1">
            <X size={16} />
          </button>
        </div>

        {/* Preset list */}
        <div className="p-5 flex flex-col gap-3 max-h-[65vh] overflow-y-auto">
          <p className="text-xs text-[var(--color-ink-400)]">
            Select one or more presets to apply. Duplicate medications will be automatically skipped.
          </p>
          {matches.map(({ preset, diagnosisDesc }) => {
            const checked = selected.has(preset.id);
            return (
              <label
                key={preset.id}
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                  checked
                    ? "border-[#B2DEDA] bg-[#EEF8F7]"
                    : "border-[var(--color-border)] hover:border-[#B2DEDA] hover:bg-[#EEF8F7]/40"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(preset.id)}
                  className="mt-0.5 accent-[#0F766E]"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-[var(--color-ink-800)]">{preset.name}</p>
                    {preset.followUpDays && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#EEF8F7] text-[#0F766E] border border-[#B2DEDA] shrink-0">
                        F/U {preset.followUpDays}d
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#0F766E]/70 mt-0.5 mb-2">
                    Matched: {diagnosisDesc}
                  </p>
                  <ul className="space-y-0.5">
                    {preset.medications.map((m, i) => (
                      <li key={i} className="text-xs text-[var(--color-ink-600)]">
                        · {m.drugName}{m.dosage ? ` ${m.dosage}` : ""}{m.frequency ? ` · ${m.frequency}` : ""}{m.duration ? ` · ${m.duration}` : ""}
                      </li>
                    ))}
                  </ul>
                  {preset.investigations && preset.investigations.length > 0 && (
                    <p className="text-[11px] text-[var(--color-ink-400)] mt-1.5">
                      Suggested investigations: {preset.investigations.join(", ")}
                    </p>
                  )}
                  {preset.advice && (
                    <p className="text-[11px] text-[var(--color-ink-400)] italic mt-1">
                      Advice: {preset.advice}
                    </p>
                  )}
                </div>
              </label>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[var(--color-border)] flex items-center justify-between gap-3">
          <span className="text-xs text-[var(--color-ink-400)]">
            {selected.size} preset{selected.size !== 1 ? "s" : ""} selected
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[var(--color-border)] text-sm font-medium text-[var(--color-ink-500)] hover:bg-[var(--color-surface-sunken)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={selected.size === 0 || applying}
              onClick={() => onApply(selectedPresets)}
              className="px-5 py-2 rounded-xl bg-[#0F766E] text-white text-sm font-semibold hover:bg-[#0D6862] transition-colors disabled:opacity-40 flex items-center gap-2"
            >
              {applying ? (
                <><RefreshCw size={13} className="animate-spin" /> Applying…</>
              ) : (
                <><Sparkles size={13} /> Apply Selected</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── PlanTab ─────────────────────────────────────────────────────────────── */

export function PlanTab({ visit, udid, patientSex }: { visit: any; udid: string; patientSex: string }) {
  const [presetMatches, setPresetMatches]   = useState<PresetMatch[]>([]);
  const [appliedPresets, setAppliedPresets] = useState<AppliedPreset[]>([]);
  const [diagChanged, setDiagChanged]       = useState(false);
  const [dismissed, setDismissed]           = useState(false);
  const [showDialog, setShowDialog]         = useState(false);
  const [applying, startApply]              = useTransition();

  const diagnoses: { icd10Code: string; description: string }[] = visit.diagnoses ?? [];
  const medications: any[] = visit.medications ?? [];

  // On mount: load presets, detect matches, check if diagnoses changed since last apply
  useEffect(() => {
    const allPresets  = getTreatmentPresets();
    const matches     = matchPresets(diagnoses, allPresets);
    setPresetMatches(matches);

    const alreadyApplied = getApplied(visit.id);
    setAppliedPresets(alreadyApplied);

    if (alreadyApplied.length > 0) {
      const snapshot     = getDiagnosisSnapshot(visit.id);
      const currentCodes = [...diagnoses.map((d) => d.icd10Code)].sort().join(",");
      if (snapshot.sort().join(",") !== currentCodes) {
        setDiagChanged(true);
      }
    }

    // Update snapshot to current diagnoses
    setDiagnosisSnapshot(visit.id, diagnoses.map((d) => d.icd10Code));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApplyPresets = (selected: TreatmentPreset[]) => {
    startApply(async () => {
      // Add non-duplicate medications
      const newMeds = mergeMeds(selected, medications);
      for (const med of newMeds) {
        await addMedication(visit.id, udid, med);
      }

      // Follow-up: use the shortest follow-up among selected presets
      const followUpDaysList = selected.map((p) => p.followUpDays).filter((d): d is number => !!d);
      if (followUpDaysList.length > 0) {
        const minDays   = Math.min(...followUpDaysList);
        const fuDate    = new Date();
        fuDate.setDate(fuDate.getDate() + minDays);
        await saveFollowUp(visit.id, udid, {
          followUpDate:    fuDate.toISOString(),
          referralEnabled: visit.referralEnabled ?? false,
          referralNote:    visit.referralNote ?? null,
        });
      }

      // Persist applied state
      const records: AppliedPreset[] = selected.map((p) => ({
        presetId:     p.id,
        presetName:   p.name,
        appliedAt:    new Date().toISOString(),
        diagnosisDesc: presetMatches.find((m) => m.preset.id === p.id)?.diagnosisDesc ?? "",
      }));
      setApplied(visit.id, records);
      setAppliedPresets(records);
      setDiagChanged(false);
      setDismissed(false);
      setShowDialog(false);
    });
  };

  const handleRemovePreset = () => {
    clearApplied(visit.id);
    setAppliedPresets([]);
    setDiagChanged(false);
    setDismissed(false);
  };

  const showAvailableBanner =
    !dismissed &&
    appliedPresets.length === 0 &&
    !diagChanged &&
    presetMatches.length > 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Diagnosis changed — prompt to update preset */}
      {diagChanged && (
        <DiagnosisChangedBanner
          onUpdate={() => { setDiagChanged(false); setShowDialog(true); }}
          onDismiss={() => setDiagChanged(false)}
        />
      )}

      {/* Preset available — offer to apply */}
      {showAvailableBanner && (
        <PresetAvailableBanner
          matches={presetMatches}
          onApply={() => presetMatches.length === 1 ? handleApplyPresets([presetMatches[0].preset]) : setShowDialog(true)}
          onDismiss={() => setDismissed(true)}
        />
      )}

      {/* Preset applied indicator */}
      {appliedPresets.length > 0 && !diagChanged && (
        <PresetAppliedBadge
          applied={appliedPresets}
          onRemove={handleRemovePreset}
          onChange={() => setShowDialog(true)}
        />
      )}

      <PrescriptionCard visit={visit} udid={udid} />
      <OpticalPrescriptionCard visit={visit} />
      <DispositionCard visit={visit} udid={udid} patientSex={patientSex} />

      {showDialog && (
        <PresetSelectDialog
          matches={presetMatches}
          onApply={handleApplyPresets}
          onClose={() => setShowDialog(false)}
          applying={applying}
        />
      )}
    </div>
  );
}

const FREQUENCY_OPTIONS = [
  "OD (Once daily)", "BD (Twice daily)", "TID (Three times daily)",
  "QID (Four times daily)", "QHS (At bedtime)", "PRN (As needed)",
  "Stat (Immediately)",
];

const ROUTE_OPTIONS = ["Topical", "Oral", "IM", "IV", "Subconjunctival", "Intravitreal", "Subtenon"];

/* ── Optical Prescription helpers ────────────────────────────────────────── */
const OPT_SPH_MAGS  = ["", ...Array.from({ length: 81 }, (_, i) => (i * 0.25).toFixed(2))];
const OPT_CYL_MAGS  = ["", ...Array.from({ length: 41 }, (_, i) => (i * 0.25).toFixed(2))];
const OPT_ADD_MAGS  = ["", ...Array.from({ length: 16 }, (_, i) => ((i + 1) * 0.25).toFixed(2))];
const OPT_AXIS_OPTS = ["", ...Array.from({ length: 180 }, (_, i) => String(i + 1))];
const OPT_VA_NEAR   = ["-", "N6", "N8", "N10", "N12", "N18", "N24", "N36", "CF", "HM", "PL", "NPL"];

function parseOptSignedVal(v: string): { sign: "+" | "-"; mag: string } {
  if (!v || v === "+") return { sign: "+", mag: "" };
  if (v === "-") return { sign: "-", mag: "" };
  return v.startsWith("-") ? { sign: "-", mag: v.slice(1) } : { sign: "+", mag: v.replace(/^\+/, "") };
}

function OptEyeColumns({ children }: { children: [React.ReactNode, React.ReactNode] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6">
      <div className="min-w-0 md:pr-8">
        <p className="text-xs font-semibold text-[var(--color-primary-700)] uppercase tracking-wide mb-3">Right Eye</p>
        {children[0]}
      </div>
      <div className="min-w-0 md:pl-8">
        <p className="text-xs font-semibold text-[var(--color-primary-700)] uppercase tracking-wide mb-3">Left Eye</p>
        {children[1]}
      </div>
    </div>
  );
}

function PrescriptionCard({ visit, udid }: { visit: any; udid: string }) {
  const [pending, startTransition] = useTransition();
  const [showAddDrug, setShowAddDrug] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [drugName, setDrugName]       = useState("");
  const [dose, setDose]               = useState("");
  const [route, setRoute]             = useState("Topical");
  const [frequency, setFrequency]         = useState("");
  const [durationNum, setDurationNum]     = useState("");
  const [durationUnit, setDurationUnit]   = useState("days");
  type TaperLevel = { frequency: string; durationNum: string; durationUnit: string };
  const [taperLevels, setTaperLevels] = useState<TaperLevel[]>([]);
  const [instructions, setInstructions]   = useState("");

  // Medication search state
  const [searchQuery, setSearchQuery]     = useState("");
  const [activeIndex, setActiveIndex]     = useState(-1);
  const [showDropdown, setShowDropdown]   = useState(false);
  const searchRef  = useRef<HTMLInputElement>(null);
  const blurTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const medications: any[] = visit.medications ?? [];

  const suggestions = useMemo(() => searchMedications(searchQuery), [searchQuery]);

  const openWithDrug = (name: string, defaultRoute?: string, defaultDose?: string) => {
    setDrugName(name);
    setDose(defaultDose ?? "");
    setRoute(defaultRoute ?? "Topical");
    setFrequency(""); setDurationNum(""); setDurationUnit("days");
    setTaperLevels([]);
    setInstructions("");
    setShowAddDrug(true);
  };

  const selectMed = (med: MedEntry) => {
    setSearchQuery(med.name);
    setShowDropdown(false);
    setActiveIndex(-1);
    openWithDrug(med.name, med.route, med.defaultDose);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      selectMed(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
      setActiveIndex(-1);
    }
  };

  const applyPreset = (drugs: PresetDrug[]) => {
    startTransition(async () => {
      for (const d of drugs) await addMedication(visit.id, udid, d);
      setShowPresets(false);
    });
  };

  const submitDrug = () => {
    if (!drugName.trim()) return;
    startTransition(async () => {
      const duration = durationNum ? `${durationNum} ${durationUnit}` : "";
      const tapParts = taperLevels
        .filter((l) => l.frequency && l.durationNum)
        .map((l) => `${l.frequency} × ${l.durationNum} ${l.durationUnit}`);
      const tapNote = tapParts.length ? `Tapering: ${tapParts.join(" → ")}` : "";
      const finalInstructions = [instructions, tapNote].filter(Boolean).join(" | ");
      await addMedication(visit.id, udid, { drugName, dosage: dose, frequency, duration, instructions: finalInstructions } as any);
      setDrugName(""); setDose(""); setRoute("Topical"); setFrequency(""); setDurationNum(""); setDurationUnit("days");
      setTaperLevels([]);
      setInstructions("");
      setShowAddDrug(false);
      setSearchQuery("");
      setShowDropdown(false);
      setTimeout(() => searchRef.current?.focus(), 80);
    });
  };

  const inputCls = "w-full rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-500)]";

  return (
    <Card>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-sm font-medium text-[var(--color-ink-700)]">Prescription / Medications</p>
        <button
          onClick={() => setShowPresets((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-white border border-[var(--color-border)] hover:border-[var(--color-primary-500)] transition-colors"
        >
          <ChevronDown size={13} className={showPresets ? "rotate-180 transition-transform" : "transition-transform"} /> Presets
        </button>
      </div>

      {/* Medication search */}
      <div className="relative mb-3">
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] pointer-events-none" />
          <input
            ref={searchRef}
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setActiveIndex(-1); setShowDropdown(true); }}
            onFocus={() => { if (blurTimer.current) clearTimeout(blurTimer.current); if (searchQuery.length >= 2) setShowDropdown(true); }}
            onBlur={() => { blurTimer.current = setTimeout(() => setShowDropdown(false), 150); }}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search medication by generic name, brand name, or strength..."
            className="w-full rounded-xl border border-[var(--color-border)] bg-white pl-10 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-[var(--color-primary-500)] transition-colors placeholder:text-[var(--color-ink-300)]"
          />
          {searchQuery && (
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); setSearchQuery(""); setShowDropdown(false); setShowAddDrug(false); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)] transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {showDropdown && suggestions.length > 0 && (
          <ul className="absolute z-30 left-0 right-0 mt-1.5 rounded-xl border border-[var(--color-border)] bg-white shadow-2xl overflow-hidden max-h-72 overflow-y-auto divide-y divide-[var(--color-border)]">
            {suggestions.map((med, i) => (
              <li key={med.id}>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); selectMed(med); }}
                  className={`w-full text-left px-3.5 py-2.5 flex items-center gap-3 transition-colors ${
                    i === activeIndex ? "bg-[var(--color-primary-50)]" : "hover:bg-[var(--color-surface-sunken)]"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    i === activeIndex ? "bg-[var(--color-primary-100)]" : "bg-[var(--color-surface-sunken)]"
                  }`}>
                    <Pill size={15} className="text-[var(--color-primary-600)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-[var(--color-ink-900)]">{med.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium shrink-0 ${categoryColor(med.category)}`}>
                        {med.category}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-ink-400)] mt-0.5">{med.form} · {med.route}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showPresets && <PresetPanel onApply={applyPreset} onClose={() => setShowPresets(false)} />}

      {/* Add Drug form */}
      {showAddDrug && (
        <div className="mb-4 p-3.5 rounded-xl border border-[var(--color-primary-200)] bg-[var(--color-primary-50)] shadow-sm">
          <div className="flex items-center justify-between mb-3 max-w-3xl">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[var(--color-primary-600)] flex items-center justify-center">
                <Pill size={13} className="text-white" />
              </div>
              <p className="text-xs font-semibold text-[var(--color-primary-700)]">Rx #{medications.length + 1}</p>
            </div>
            <button onClick={() => setShowAddDrug(false)} className="text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)]"><X size={13} /></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2 max-w-3xl">
            <div className="col-span-2">
              <label className="text-[10px] font-medium text-[var(--color-ink-400)] uppercase tracking-wide block mb-0.5">Drug Name</label>
              <input value={drugName} onChange={(e) => setDrugName(e.target.value)} placeholder="Drug name" className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] font-medium text-[var(--color-ink-400)] uppercase tracking-wide block mb-0.5">Dose</label>
              <input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="e.g. 1 drop" className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] font-medium text-[var(--color-ink-400)] uppercase tracking-wide block mb-0.5">Route</label>
              <select value={route} onChange={(e) => setRoute(e.target.value)} className={inputCls}>
                {ROUTE_OPTIONS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2 max-w-3xl">
            <div className="col-span-2">
              <label className="text-[10px] font-medium text-[var(--color-ink-400)] uppercase tracking-wide block mb-0.5">Frequency</label>
              <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className={inputCls}>
                <option value="">— Select —</option>
                {FREQUENCY_OPTIONS.map((f) => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-medium text-[var(--color-ink-400)] uppercase tracking-wide block mb-0.5">Duration</label>
              <div className="flex gap-1">
                <select value={durationNum} onChange={(e) => setDurationNum(e.target.value)} className={inputCls + " flex-1 min-w-0"}>
                  <option value="">—</option>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={String(n)}>{n}</option>
                  ))}
                </select>
                <select value={durationUnit} onChange={(e) => setDurationUnit(e.target.value)} className={inputCls + " flex-1 min-w-0"}>
                  {["days", "weeks", "months", "years"].map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-col justify-end">
              <button onClick={submitDrug} disabled={pending} className="w-full rounded-lg bg-[var(--color-primary-600)] text-white text-xs font-medium py-1.5 hover:bg-[var(--color-primary-700)] transition-colors disabled:opacity-60">
                Add to Prescription
              </button>
            </div>
          </div>

          {/* Tapering toggle — own row, aligned left */}
          <div className="mb-2 max-w-3xl">
            <label className="flex items-center gap-1.5 cursor-pointer w-fit">
              <input
                type="checkbox"
                checked={taperLevels.length > 0}
                onChange={(e) => setTaperLevels(e.target.checked ? [{ frequency: "", durationNum: "", durationUnit: "days" }] : [])}
                className="accent-[var(--color-primary-600)] w-3.5 h-3.5 rounded"
              />
              <span className="text-xs font-medium text-[var(--color-ink-600)]">Tapering dose</span>
            </label>
          </div>
          {taperLevels.map((level, i) => (
            <div
              key={i}
              className="mb-2 max-w-3xl pl-3 border-l-2 border-[var(--color-primary-300)]"
              style={{ marginLeft: `${i * 14}px` }}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-primary-600)] mb-1.5">
                ↓ Tapering dose{taperLevels.length > 1 ? ` ${i + 1}` : ""}
              </p>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="text-[10px] font-medium text-[var(--color-ink-400)] uppercase tracking-wide block mb-0.5">Frequency</label>
                  <select
                    value={level.frequency}
                    onChange={(e) => { const n = [...taperLevels]; n[i] = { ...n[i], frequency: e.target.value }; setTaperLevels(n); }}
                    className={inputCls}
                  >
                    <option value="">— Select —</option>
                    {FREQUENCY_OPTIONS.map((f) => <option key={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-[var(--color-ink-400)] uppercase tracking-wide block mb-0.5">Duration</label>
                  <div className="flex gap-1">
                    <select
                      value={level.durationNum}
                      onChange={(e) => { const n = [...taperLevels]; n[i] = { ...n[i], durationNum: e.target.value }; setTaperLevels(n); }}
                      className={inputCls + " flex-1 min-w-0"}
                    >
                      <option value="">—</option>
                      {Array.from({ length: 10 }, (_, j) => j + 1).map((n) => (
                        <option key={n} value={String(n)}>{n}</option>
                      ))}
                    </select>
                    <select
                      value={level.durationUnit}
                      onChange={(e) => { const n = [...taperLevels]; n[i] = { ...n[i], durationUnit: e.target.value }; setTaperLevels(n); }}
                      className={inputCls + " flex-1 min-w-0"}
                    >
                      {["days", "weeks", "months", "years"].map((u) => <option key={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              {/* Nested tapering checkbox — max 5 levels */}
              {i < 4 && (
                <label className="flex items-center gap-1.5 cursor-pointer w-fit">
                  <input
                    type="checkbox"
                    checked={taperLevels.length > i + 1}
                    onChange={(e) =>
                      setTaperLevels(e.target.checked
                        ? [...taperLevels.slice(0, i + 1), { frequency: "", durationNum: "", durationUnit: "days" }]
                        : taperLevels.slice(0, i + 1)
                      )
                    }
                    className="accent-[var(--color-primary-600)] w-3.5 h-3.5 rounded"
                  />
                  <span className="text-xs font-medium text-[var(--color-ink-600)]">Tapering dose</span>
                </label>
              )}
            </div>
          ))}
          <div className="max-w-3xl">
            <label className="text-[10px] font-medium text-[var(--color-ink-400)] uppercase tracking-wide block mb-0.5">Instructions</label>
            <input value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="e.g. Apply 1 drop in RE at bedtime, shake well before use" className={inputCls} />
          </div>
        </div>
      )}

      {medications.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-surface-sunken)] flex items-center justify-center">
            <Pill size={20} className="text-[var(--color-ink-300)]" />
          </div>
          <p className="text-sm text-[var(--color-ink-400)]">Search for a medication above to add it to the prescription.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2 mt-1">
          {medications.map((m, idx) => (
            <li key={m.id} className="rounded-xl border border-[var(--color-border)] bg-white p-3 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-50)] flex items-center justify-center shrink-0">
                    <Pill size={14} className="text-[var(--color-primary-600)]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-[var(--color-ink-400)] uppercase tracking-wide">Rx {idx + 1}</p>
                    <p className="text-sm font-semibold text-[var(--color-ink-900)] truncate">{m.drugName}</p>
                  </div>
                </div>
                <button
                  onClick={() => removeMedication(m.id, udid)}
                  className="text-[var(--color-ink-300)] hover:text-red-500 transition-colors shrink-0 mt-0.5"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {(m.dosage || m.frequency || m.duration || m.instructions) && (
                <div className="mt-2.5 pt-2.5 border-t border-[var(--color-border)] flex flex-wrap gap-x-4 gap-y-1">
                  {m.dosage     && <span className="text-xs text-[var(--color-ink-600)] font-medium">{m.dosage}</span>}
                  {m.frequency  && <span className="text-xs text-[var(--color-ink-500)]">{m.frequency}</span>}
                  {m.duration   && <span className="text-xs text-[var(--color-ink-500)]">{m.duration}</span>}
                  {m.instructions && <span className="text-xs text-[var(--color-ink-400)] italic w-full mt-0.5">{m.instructions}</span>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function OpticalPrescriptionCard({ visit }: { visit: any }) {
  const rc = visit.refraction;
  type RxFields = { sph: string; cyl: string; axis: string; nearSph: string; va: string; nearVa: string };
  const emptyRx: RxFields = { sph: "", cyl: "", axis: "", nearSph: "", va: "", nearVa: "" };
  const re: RxFields = parseJSON(rc?.re, emptyRx);
  const le: RxFields = parseJSON(rc?.le, emptyRx);

  const SEL = "rounded border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-1.5 py-1 text-xs cursor-default";

  const signedSelect = (label: string, value: string, mags: string[]) => {
    const { sign, mag } = parseOptSignedVal(value);
    return (
      <div className="flex flex-col gap-0.5">
        <label className="text-[10px] text-[var(--color-ink-400)] font-medium">{label}</label>
        <div className="flex items-center gap-1">
          <span
            className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold border"
            style={sign === "-"
              ? { background: "var(--color-primary-600)", color: "#fff", borderColor: "var(--color-primary-600)" }
              : { background: "var(--color-surface-sunken)", color: "var(--color-ink-600)", borderColor: "var(--color-border)" }}
          >
            {sign}
          </span>
          <select disabled value={mag} onChange={() => {}} className={`w-full min-w-0 ${SEL}`}>
            {mags.map((m) => <option key={m} value={m}>{m || "—"}</option>)}
          </select>
        </div>
      </div>
    );
  };

  const axisSelect = (label: string, value: string) => (
    <div className="flex flex-col gap-0.5 min-w-0">
      <label className="text-[10px] text-[var(--color-ink-400)] font-medium">{label}</label>
      <select disabled value={parseOptSignedVal(value).mag} onChange={() => {}} className={`w-full min-w-0 ${SEL}`}>
        {OPT_AXIS_OPTS.map((a) => <option key={a} value={a}>{a || "—"}</option>)}
      </select>
    </div>
  );

  const vaSelect = (label: string, value: string, options: readonly string[] = VA_SNELLEN_VALUES, className = "") => (
    <div className={`flex flex-col gap-0.5 min-w-0 ${className}`}>
      <label className="text-[10px] text-[var(--color-ink-400)] font-medium">{label}</label>
      <select disabled value={value || "-"} onChange={() => {}} className={`w-full min-w-0 ${SEL}`}>
        {options.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
    </div>
  );

  const SECTION_LABEL = "col-span-2 sm:col-span-5 text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-widest";

  const eyeFields = (val: RxFields) => (
    <div className="grid grid-cols-2 sm:grid-cols-[88px_88px_64px_20px_80px] gap-x-2 gap-y-2 items-end">
      <p className={SECTION_LABEL}>Distance</p>
      {signedSelect("Sph",       val.sph,     OPT_SPH_MAGS)}
      {signedSelect("Cyl",       val.cyl,     OPT_CYL_MAGS)}
      {axisSelect("Axis°",       val.axis)}
      <div aria-hidden="true" className="hidden sm:block" />
      {vaSelect("Resulting VA",  val.va)}
      <p className={`${SECTION_LABEL} mt-2`}>Near</p>
      {signedSelect("Sph (Add)", val.nearSph, OPT_ADD_MAGS)}
      {vaSelect("Resulting NV",  val.nearVa,  OPT_VA_NEAR, "col-start-2 sm:col-start-5")}
    </div>
  );

  return (
    <Card>
      <p className="text-sm font-medium text-[var(--color-ink-700)] mb-3">Optical Prescription</p>
      <OptEyeColumns>
        {eyeFields(re)}
        {eyeFields(le)}
      </OptEyeColumns>
    </Card>
  );
}

function DispositionCard({ visit, udid, patientSex }: { visit: any; udid: string; patientSex: string }) {
  const [activePanels, setActivePanels] = useState<string[]>(
    [visit.admission && "admit", visit.surgicalCounselling && "surgery"].filter(Boolean) as string[]
  );
  const togglePanel = (id: string) =>
    setActivePanels((cur) => (cur.includes(id) ? cur.filter((p) => p !== id) : [...cur, id]));

  return (
    <Card>
      <p className="text-sm font-medium text-[var(--color-ink-700)] mb-3">Patient Disposition</p>
      <div className="flex gap-3 flex-wrap mb-2">
        <DispositionToggle icon={<BedDouble size={16} />}    label="Admit"                active={activePanels.includes("admit")}   onClick={() => togglePanel("admit")} />
        <DispositionToggle icon={<Stethoscope size={16} />}  label="Surgical Counselling" active={activePanels.includes("surgery")} onClick={() => togglePanel("surgery")} />
        <DispositionToggle icon={<RefreshCw size={16} />}    label="Follow Up Dates"       active={activePanels.includes("follow")}  onClick={() => togglePanel("follow")} />
      </div>
      <p className="text-xs text-[var(--color-ink-400)] mb-4">These are not mutually exclusive — a patient may be both Admitted and have Surgical Counselling recorded.</p>
      <div className="flex flex-col gap-4">
        {activePanels.includes("admit")   && <AdmitPanel    visit={visit} udid={udid} patientSex={patientSex} />}
        {activePanels.includes("surgery") && <SurgicalPanel visit={visit} udid={udid} />}
        {activePanels.includes("follow")  && <FollowUpdatesPanel visit={visit} udid={udid} />}
      </div>
    </Card>
  );
}
