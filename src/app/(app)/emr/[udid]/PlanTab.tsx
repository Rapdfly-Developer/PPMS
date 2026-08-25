"use client";

import { useState, useTransition, useEffect, useRef, useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { History } from "lucide-react";
import { parseJSON } from "@/lib/json";
import { useAutoSave, SaveIndicator } from "@/lib/useAutoSave";
import { addMedication, removeMedication, updateMedication, clearAllMedications, saveRefraction, saveFollowUp, saveAdviseNotes, saveAnesthesiaType, saveProcedureLaterality, saveProcedureName, saveProcedureNotes, addInvestigationOrder } from "./actions";
import { DispositionToggle, AdmitPanel, FollowUpdatesPanel, SurgicalPanel } from "./DispositionPanel";
import { Plus, X, BedDouble, Stethoscope, ChevronDown, Pencil, Trash2, RefreshCw, Search, Pill, Sparkles, CheckCircle2, Check, AlertTriangle, Scissors } from "lucide-react";
import {
  type TreatmentPreset, type PresetMatch, type AppliedPreset,
  getTreatmentPresets, matchPresets, mergeMeds,
  getApplied, setApplied, clearApplied,
  getDiagnosisSnapshot, setDiagnosisSnapshot,
  getDismissedPresets, addDismissedPreset, clearDismissedPresets,
  saveTreatmentPresets,
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

function AutoApplyToast({ names, onClose }: { names: string[]; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="rounded-2xl border border-[#B2DEDA] bg-[#EEF8F7] px-4 py-3 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="w-7 h-7 rounded-xl bg-[#0F766E] flex items-center justify-center shrink-0">
        <Sparkles size={13} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-xs font-semibold text-[#0F766E]">Auto-applied: </span>
        <span className="text-xs text-[#0F766E]/80">{names.join(", ")}</span>
      </div>
      <button type="button" onClick={onClose} className="text-[#0F766E]/50 hover:text-[#0F766E] transition-colors p-1">
        <X size={13} />
      </button>
    </div>
  );
}

function PresetAppliedBadge({
  applied,
  presetMatches,
  onRemove,
  onChange,
  diagnosisLabel,
  visitId,
  udid,
}: {
  applied: AppliedPreset[];
  presetMatches: PresetMatch[];
  onRemove: () => void;
  onChange: () => void;
  diagnosisLabel?: string;
  visitId?: string;
  udid?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing]   = useState(false);
  const [addedInvs, setAddedInvs] = useState<Set<string>>(new Set());
  const [, startInvTransition] = useTransition();

  // Collect advice + investigations from applied presets
  const details = applied
    .map((a) => presetMatches.find((m) => m.preset.id === a.presetId)?.preset)
    .filter((p): p is NonNullable<typeof p> => !!p);
  const allAdvice          = details.map((p) => p.advice).filter((a): a is string => !!a);
  const allInvestigations  = [...new Set(details.flatMap((p) => p.investigations ?? []))];

  // Edit state
  const [editInvestigations, setEditInvestigations] = useState<string[]>([]);
  const [newInvInput, setNewInvInput]               = useState("");

  const startEditing = () => {
    setEditInvestigations([...allInvestigations]);
    setNewInvInput("");
    setEditing(true);
    setExpanded(true);
  };

  const saveEdits = () => {
    const all = getTreatmentPresets();
    const updatedIds = new Set(applied.map((a) => a.presetId));
    const updated = all.map((p) =>
      updatedIds.has(p.id) ? { ...p, investigations: editInvestigations } : p
    );
    const storedIds = new Set(all.map((p) => p.id));
    const missingDefaults = details.filter((p) => !storedIds.has(p.id)).map((p) => ({
      ...p,
      investigations: editInvestigations,
    }));
    saveTreatmentPresets([...updated, ...missingDefaults]);
    setEditing(false);
  };

  const addInvestigation = () => {
    const v = newInvInput.trim();
    if (v && !editInvestigations.includes(v)) setEditInvestigations((prev) => [...prev, v]);
    setNewInvInput("");
  };

  const hasDetails = allInvestigations.length > 0;
  const btnCls = "text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors";

  return (
    <div className="rounded-2xl border border-[#B2DEDA] bg-[#EEF8F7] overflow-hidden">
      {/* Header row */}
      <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
        <CheckCircle2 size={15} className="text-[#0F766E] shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold text-[#0F766E]">
            {diagnosisLabel ? `${diagnosisLabel}: ` : "Preset Applied: "}
          </span>
          <span className="text-xs text-[#0F766E]/80">{applied.map((a) => a.presetName).join(", ")}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {hasDetails && (
            <button
              type="button"
              onClick={() => { setExpanded((v) => !v); if (editing && expanded) setEditing(false); }}
              className={`${btnCls} text-[#0F766E]/60 hover:text-[#0F766E] border-[#B2DEDA] hover:bg-[#DCF3F1]`}
            >
              {expanded ? "Hide details" : "Details"}
            </button>
          )}
          {hasDetails && !editing && (
            <button
              type="button"
              onClick={startEditing}
              className={`${btnCls} text-[#0F766E]/60 hover:text-[#0F766E] border-[#B2DEDA] hover:bg-[#DCF3F1] flex items-center gap-1`}
            >
              <Pencil size={11} /> Edit
            </button>
          )}
          <button
            type="button"
            onClick={onChange}
            className={`${btnCls} text-[#0F766E] hover:text-[#0D6862] border-[#B2DEDA] hover:bg-[#DCF3F1] font-semibold`}
          >
            Change
          </button>
          <button
            type="button"
            onClick={onRemove}
            className={`${btnCls} text-[#0F766E]/60 hover:text-red-600 border-[#B2DEDA] hover:border-red-200 hover:bg-red-50`}
          >
            Remove
          </button>
        </div>
      </div>

      {/* Expandable details */}
      {expanded && (
        <div className="border-t border-[#B2DEDA] px-4 py-3 flex flex-col gap-3">
          {/* Investigations */}
          {(editing ? true : allInvestigations.length > 0) && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#0F766E]/60 mb-1.5">Suggested Investigations</p>
              {editing ? (
                <>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {editInvestigations.map((inv) => (
                      <span
                        key={inv}
                        className="flex items-center gap-1 text-[11px] pl-2.5 pr-1.5 py-0.5 rounded-full bg-white border border-[#B2DEDA] text-[#0F766E]"
                      >
                        {inv}
                        <button
                          type="button"
                          onClick={() => setEditInvestigations((prev) => prev.filter((v) => v !== inv))}
                          className="text-[#0F766E]/50 hover:text-red-500 transition-colors"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      value={newInvInput}
                      onChange={(e) => setNewInvInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addInvestigation(); } }}
                      placeholder="Type investigation and press Enter"
                      className="flex-1 rounded-lg border border-[#B2DEDA] bg-white px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
                    />
                    <button
                      type="button"
                      onClick={addInvestigation}
                      disabled={!newInvInput.trim()}
                      className="px-2.5 py-1 rounded-lg bg-[#0F766E] text-white text-xs font-medium hover:bg-[#0D6862] disabled:opacity-40 transition-colors"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {allInvestigations.map((inv) => {
                    const added = addedInvs.has(inv);
                    return (
                      <button
                        key={inv}
                        type="button"
                        disabled={added || !visitId || !udid}
                        onClick={() => {
                          if (!visitId || !udid) return;
                          setAddedInvs((prev) => new Set([...prev, inv]));
                          startInvTransition(async () => {
                            await addInvestigationOrder(visitId, udid, {
                              category: "General",
                              testName: inv,
                              priority: "ROUTINE",
                            });
                          });
                        }}
                        className={`flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full border transition-colors ${
                          added
                            ? "bg-[#0F766E] border-[#0F766E] text-white cursor-default"
                            : "bg-white border-[#B2DEDA] text-[#0F766E] hover:bg-[#DCF3F1] hover:border-[#0F766E] cursor-pointer"
                        }`}
                      >
                        {added && <Check size={10} />}
                        {inv}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Edit action buttons */}
          {editing && (
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-3 py-1.5 rounded-lg border border-[#B2DEDA] text-xs font-medium text-[#0F766E]/60 hover:bg-[#DCF3F1] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdits}
                className="px-3 py-1.5 rounded-lg bg-[#0F766E] text-white text-xs font-semibold hover:bg-[#0D6862] transition-colors flex items-center gap-1.5"
              >
                <Check size={11} /> Save Changes
              </button>
            </div>
          )}
        </div>
      )}
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
  type FormMed = { drugName: string; dosage: string; frequency: string; duration: string };
  const blankMed = (): FormMed => ({ drugName: "", dosage: "", frequency: "", duration: "" });

  const [selected, setSelected] = useState<Set<string>>(
    matches[0]?.preset.id ? new Set([matches[0].preset.id]) : new Set()
  );
  const [customPresets, setCustomPresets] = useState<TreatmentPreset[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formMeds, setFormMeds] = useState<FormMed[]>([blankMed()]);
  const [formAdvice, setFormAdvice] = useState("");
  const [formInvestigations, setFormInvestigations] = useState("");
  const [formFollowUp, setFormFollowUp] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Load matching custom presets from localStorage on mount
  useEffect(() => {
    const all = getTreatmentPresets().filter((p) => !p.isDefault);
    const diagCodes = matches.map((m) => m.diagnosisCode);
    const diagDescs = matches.map((m) => m.diagnosisDesc.toLowerCase());
    setCustomPresets(
      all.filter((p) =>
        p.diagnosisCodes.some((c) => diagCodes.some((d) => d.startsWith(c) || c.startsWith(d.slice(0, 3)))) ||
        p.diagnosisKeywords.some((kw) => diagDescs.some((d) => d.includes(kw.toLowerCase())))
      )
    );
  }, []);

  const openForm = () => {
    const base = matches[0]?.preset;
    setFormName(`Protocol ${matches.length + customPresets.length + 1}`);
    setFormMeds(
      base?.medications.length
        ? base.medications.map((m) => ({ drugName: m.drugName, dosage: m.dosage ?? "", frequency: m.frequency ?? "", duration: m.duration ?? "" }))
        : [blankMed()]
    );
    setFormAdvice(base?.advice ?? "");
    setFormInvestigations(base?.investigations?.join(", ") ?? "");
    setFormFollowUp(base?.followUpDays ? String(base.followUpDays) : "");
    setEditingPresetId(null);
    setShowForm(true);
  };

  const openEditForm = (preset: TreatmentPreset) => {
    setFormName(preset.name);
    setFormMeds(preset.medications.map((m) => ({ drugName: m.drugName, dosage: m.dosage ?? "", frequency: m.frequency ?? "", duration: m.duration ?? "" })));
    setFormAdvice(preset.advice ?? "");
    setFormInvestigations(preset.investigations?.join(", ") ?? "");
    setFormFollowUp(preset.followUpDays ? String(preset.followUpDays) : "");
    setEditingPresetId(preset.id);
    setShowForm(true);
  };

  const saveCustomProtocol = () => {
    const meds = formMeds.filter((m) => m.drugName.trim());
    if (!formName.trim() || !meds.length) return;
    const newPreset: TreatmentPreset = {
      id: `custom-tx-${Date.now()}`,
      name: formName.trim(),
      diagnosisCodes: matches.map((m) => m.diagnosisCode),
      diagnosisKeywords: [],
      medications: meds.map((m) => ({ drugName: m.drugName.trim(), dosage: m.dosage || undefined, frequency: m.frequency || undefined, duration: m.duration || undefined })),
      advice: formAdvice.trim() || undefined,
      investigations: formInvestigations ? formInvestigations.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
      followUpDays: formFollowUp ? Number(formFollowUp) : undefined,
      isDefault: false,
      createdAt: new Date().toISOString(),
    };
    saveTreatmentPresets([...getTreatmentPresets(), newPreset]);
    setCustomPresets((prev) => [...prev, newPreset]);
    setSelected((prev) => new Set([...prev, newPreset.id]));
    setShowForm(false);
  };

  const updateProtocol = () => {
    if (!editingPresetId) return;
    const meds = formMeds.filter((m) => m.drugName.trim());
    if (!formName.trim() || !meds.length) return;
    const all = getTreatmentPresets();
    const existing = all.find((p) => p.id === editingPresetId);
    const updated: TreatmentPreset = {
      ...(existing ?? { id: editingPresetId, diagnosisCodes: matches.map((m) => m.diagnosisCode), diagnosisKeywords: [], isDefault: false, createdAt: new Date().toISOString() }),
      name: formName.trim(),
      medications: meds.map((m) => ({ drugName: m.drugName.trim(), dosage: m.dosage || undefined, frequency: m.frequency || undefined, duration: m.duration || undefined })),
      advice: formAdvice.trim() || undefined,
      investigations: formInvestigations ? formInvestigations.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
      followUpDays: formFollowUp ? Number(formFollowUp) : undefined,
      isDefault: false,
    };
    const newAll = existing ? all.map((p) => p.id === editingPresetId ? updated : p) : [...all, updated];
    saveTreatmentPresets(newAll);
    // Refresh local custom list; if originally default now stored as custom override
    setCustomPresets((prev) => {
      const exists = prev.find((p) => p.id === editingPresetId);
      return exists ? prev.map((p) => p.id === editingPresetId ? updated : p) : [...prev, updated];
    });
    setShowForm(false);
    setEditingPresetId(null);
  };

  const deleteProtocol = (id: string) => {
    const all = getTreatmentPresets().filter((p) => p.id !== id);
    saveTreatmentPresets(all);
    setCustomPresets((prev) => prev.filter((p) => p.id !== id));
    setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
    setDeleteConfirmId(null);
  };

  const allMatches: PresetMatch[] = [
    ...matches,
    ...customPresets.map((p) => ({
      preset: p,
      diagnosisCode: matches[0]?.diagnosisCode ?? "",
      diagnosisDesc: matches[0]?.diagnosisDesc ?? "Custom",
    })),
  ];

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const selectedPresets = allMatches.filter((m) => selected.has(m.preset.id)).map((m) => m.preset);

  const inp = "w-full rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#0F766E] focus:border-[#0F766E]";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden"
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

        {/* Preset list + form */}
        <div className="p-5 flex flex-col gap-3 max-h-[78vh] overflow-y-auto">
          <p className="text-xs text-[var(--color-ink-400)]">
            Select one or more presets to apply. Duplicate medications will be automatically skipped.
          </p>

          {allMatches.map(({ preset, diagnosisDesc }, idx) => {
            const checked = selected.has(preset.id);
            const isCustom = !preset.isDefault;
            const protocolNum = idx + 1;
            const isDelConfirm = deleteConfirmId === preset.id;
            return (
              <label
                key={preset.id}
                className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                  checked ? "border-[#B2DEDA] bg-[#EEF8F7]" : "border-[var(--color-border)] hover:border-[#B2DEDA] hover:bg-[#EEF8F7]/40"
                }`}
              >
                <input type="checkbox" checked={checked} onChange={() => toggle(preset.id)} className="mt-1 accent-[#0F766E]" />
                <div className="flex-1 min-w-0">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#0F766E] text-white shrink-0">
                        Protocol {protocolNum}
                      </span>
                      <p className="text-sm font-semibold text-[var(--color-ink-800)]">{preset.name}</p>
                      {isCustom && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 shrink-0">CUSTOM</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.preventDefault()}>
                      {preset.followUpDays && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#EEF8F7] text-[#0F766E] border border-[#B2DEDA]">
                          F/U {preset.followUpDays}d
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); openEditForm(preset); }}
                        className="p-1.5 rounded-lg text-[var(--color-ink-400)] hover:text-[#0F766E] hover:bg-[#DCF3F1] transition-colors"
                        title="Edit protocol"
                      >
                        <Pencil size={11} />
                      </button>
                      {isDelConfirm ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); deleteProtocol(preset.id); }}
                            className="px-2 py-0.5 rounded-lg bg-red-500 text-white text-[10px] font-semibold hover:bg-red-600 transition-colors"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); setDeleteConfirmId(null); }}
                            className="p-1 rounded-lg text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)] transition-colors"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); setDeleteConfirmId(preset.id); }}
                          className="p-1.5 rounded-lg text-[var(--color-ink-400)] hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Delete protocol"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Medications */}
                  <ul className="flex flex-col gap-1.5 mb-2">
                    {preset.medications.map((m, i) => (
                      <li key={i} className="flex items-baseline gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#0F766E]/50 shrink-0 mt-1.5" />
                        <span className="text-xs font-medium text-[var(--color-ink-800)]">{m.drugName}</span>
                        {(m.dosage || m.frequency || m.duration) && (
                          <span className="text-[11px] text-[var(--color-ink-400)]">
                            {[m.dosage, m.frequency, m.duration].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>

                  {/* Extras */}
                  {preset.investigations && preset.investigations.length > 0 && (
                    <p className="text-[11px] text-[var(--color-ink-400)] mt-1">
                      <span className="font-semibold">Investigations:</span> {preset.investigations.join(", ")}
                    </p>
                  )}
                  {preset.advice && (
                    <p className="text-[11px] text-[var(--color-ink-400)] italic mt-0.5">
                      <span className="font-semibold not-italic">Advice:</span> {preset.advice}
                    </p>
                  )}
                </div>
              </label>
            );
          })}

          {/* ── Add / Edit Protocol ─────────────────────────────────── */}
          {!showForm ? (
            <button
              type="button"
              onClick={openForm}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border-2 border-dashed border-[var(--color-border)] text-xs font-medium text-[var(--color-ink-400)] hover:border-[#0F766E] hover:text-[#0F766E] hover:bg-[#EEF8F7]/40 transition-colors"
            >
              <Plus size={13} /> Add Custom Protocol
            </button>
          ) : (
            <div className="rounded-xl border-2 border-[#B2DEDA] bg-[#EEF8F7]/50 p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-[#0F766E] uppercase tracking-wide">
                  {editingPresetId ? "Edit Protocol" : "New Custom Protocol"}
                </p>
                <button type="button" onClick={() => { setShowForm(false); setEditingPresetId(null); }} className="text-[var(--color-ink-300)] hover:text-[var(--color-ink-700)]">
                  <X size={13} />
                </button>
              </div>

              {/* Name */}
              <div>
                <label className="text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-wide block mb-1">Protocol Name *</label>
                <input autoFocus value={formName} onChange={(e) => setFormName(e.target.value)} className={inp} placeholder="e.g. Corneal Ulcer — Protocol 2" />
              </div>

              {/* Drug rows */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-wide">Medications *</label>
                  <button
                    type="button"
                    onClick={() => setFormMeds([...formMeds, blankMed()])}
                    className="flex items-center gap-1 text-[10px] font-semibold text-[#0F766E] hover:underline"
                  >
                    <Plus size={10} /> Add Drug
                  </button>
                </div>
                <div className="flex flex-col gap-1.5">
                  {formMeds.map((med, i) => (
                    <div key={i} className="grid gap-1 items-center" style={{ gridTemplateColumns: "1fr 70px 130px 70px 20px" }}>
                      <input
                        value={med.drugName}
                        onChange={(e) => { const n = [...formMeds]; n[i] = { ...n[i], drugName: e.target.value }; setFormMeds(n); }}
                        placeholder="Drug name"
                        className={inp}
                      />
                      <input
                        value={med.dosage}
                        onChange={(e) => { const n = [...formMeds]; n[i] = { ...n[i], dosage: e.target.value }; setFormMeds(n); }}
                        placeholder="Dose"
                        className={inp}
                      />
                      <select
                        value={med.frequency}
                        onChange={(e) => { const n = [...formMeds]; n[i] = { ...n[i], frequency: e.target.value }; setFormMeds(n); }}
                        className={inp}
                      >
                        <option value="">Frequency</option>
                        {FREQUENCY_OPTIONS.map((f) => <option key={f}>{f}</option>)}
                      </select>
                      <input
                        value={med.duration}
                        onChange={(e) => { const n = [...formMeds]; n[i] = { ...n[i], duration: e.target.value }; setFormMeds(n); }}
                        placeholder="Duration"
                        className={inp}
                      />
                      <button
                        type="button"
                        onClick={() => setFormMeds(formMeds.filter((_, j) => j !== i))}
                        className="text-[var(--color-ink-300)] hover:text-red-500 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* F/U + Investigations */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-wide block mb-1">Follow-up Days</label>
                  <input type="number" min="1" value={formFollowUp} onChange={(e) => setFormFollowUp(e.target.value)} placeholder="e.g. 7" className={inp} />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-wide block mb-1">Investigations</label>
                  <input value={formInvestigations} onChange={(e) => setFormInvestigations(e.target.value)} placeholder="Comma-separated" className={inp} />
                </div>
              </div>

              {/* Advice */}
              <div>
                <label className="text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-wide block mb-1">Advice (optional)</label>
                <textarea
                  value={formAdvice}
                  onChange={(e) => setFormAdvice(e.target.value)}
                  rows={2}
                  className={inp + " resize-none"}
                  placeholder="e.g. Strict hygiene. No contact lens use until healed."
                />
              </div>

              <button
                type="button"
                onClick={editingPresetId ? updateProtocol : saveCustomProtocol}
                disabled={!formName.trim() || !formMeds.some((m) => m.drugName.trim())}
                className="w-full py-2 rounded-xl bg-[#0F766E] text-white text-xs font-semibold hover:bg-[#0D6862] disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5"
              >
                <Check size={12} /> {editingPresetId ? "Update Protocol" : "Save & Add to List"}
              </button>
            </div>
          )}
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

/* ── Per-diagnosis dismissal helpers ─────────────────────────────────────── */

const diagDismissedKey = (visitId: string) => `ppms_diag_dismissed_${visitId}`;
const getDismissedDiagDescs = (visitId: string): string[] => {
  try { return JSON.parse(localStorage.getItem(diagDismissedKey(visitId)) ?? "[]"); } catch { return []; }
};
const addDismissedDiagDesc = (visitId: string, desc: string) => {
  const cur = getDismissedDiagDescs(visitId);
  if (!cur.includes(desc)) localStorage.setItem(diagDismissedKey(visitId), JSON.stringify([...cur, desc]));
};
const removeDismissedDiagDesc = (visitId: string, desc: string) => {
  const cur = getDismissedDiagDescs(visitId).filter((d) => d !== desc);
  localStorage.setItem(diagDismissedKey(visitId), JSON.stringify(cur));
};

/* ── Protocol prompt card ────────────────────────────────────────────────── */

function ProtocolPromptCard({
  diagnosisDesc,
  onConfirm,
  onDismiss,
}: {
  diagnosisDesc: string;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-primary-200)] bg-[var(--color-primary-50)] px-4 py-3 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="w-7 h-7 rounded-xl bg-[var(--color-primary-600)] flex items-center justify-center shrink-0">
        <Stethoscope size={13} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-[var(--color-primary-800)]">
          Do you wish to apply <span className="font-bold">{diagnosisDesc}</span> protocol?
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)] transition-colors"
        >
          No
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] transition-colors"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}

/* ── PlanTab ─────────────────────────────────────────────────────────────── */

export function PlanTab({ visit, udid, patientSex, priorVisits = [] }: { visit: any; udid: string; patientSex: string; priorVisits?: any[] }) {
  const [presetMatches, setPresetMatches]   = useState<PresetMatch[]>([]);
  const [appliedPresets, setAppliedPresets] = useState<AppliedPreset[]>([]);
  const [dismissedIds, setDismissedIds]     = useState<string[]>([]);
  const [toastNames, setToastNames]         = useState<string[]>([]);
  const [applying, startApply]              = useTransition();
  const [pendingDiagPrompts, setPendingDiagPrompts] = useState<{ diagnosisDesc: string; laterality?: string; matches: PresetMatch[] }[]>([]);
  const [activeDialogDiag, setActiveDialogDiag]     = useState<{ diagnosisDesc: string; laterality?: string; matches: PresetMatch[]; isChanging: boolean } | null>(null);
  const [adviseNotes, setAdviseNotes]       = useState<string>(visit.adviseNotes ?? "");
  useAutoSave(adviseNotes, (notes) => saveAdviseNotes(visit.id, udid, notes));

  const diagnoses: { icd10Code: string; description: string; laterality?: string }[] = visit.diagnoses ?? [];
  const medications: any[] = visit.medications ?? [];

  // Derive a single default laterality from all current diagnoses.
  // If every diagnosis agrees on the same eye → use it; mixed/none → OU.
  const diagLaterality = useMemo(() => {
    const lats = [...new Set(diagnoses.map((d) => d.laterality).filter(Boolean))];
    return lats.length === 1 ? lats[0] : "OU";
  }, [diagnoses]);

  // Stable string key — effect re-runs when diagnosis list changes
  const diagKey = useMemo(
    () => diagnoses.map((d) => d.icd10Code).sort().join(","),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [diagnoses.map((d) => d.icd10Code).sort().join(",")],
  );

  useEffect(() => {
    const allPresets     = getTreatmentPresets();
    const matches        = matchPresets(diagnoses, allPresets);
    setPresetMatches(matches);

    const alreadyApplied = getApplied(visit.id);
    setAppliedPresets(alreadyApplied);

    const dismissed      = getDismissedPresets(visit.id);
    setDismissedIds(dismissed);

    const appliedDiagDescs   = new Set(alreadyApplied.map((a) => a.diagnosisDesc));
    const dismissedDiagDescs = new Set(getDismissedDiagDescs(visit.id));

    // Build a lookup of preset matches by diagnosis description
    const matchesByDesc: Record<string, PresetMatch[]> = {};
    for (const m of matches) {
      (matchesByDesc[m.diagnosisDesc] = matchesByDesc[m.diagnosisDesc] ?? []).push(m);
    }

    // ALL diagnoses get a prompt card — unless the doctor already applied or dismissed this diagnosis
    const pending = diagnoses
      .filter((d) => !appliedDiagDescs.has(d.description) && !dismissedDiagDescs.has(d.description))
      .map((d) => ({
        diagnosisDesc: d.description,
        laterality: d.laterality,
        matches: matchesByDesc[d.description] ?? [],
      }));

    setPendingDiagPrompts(pending);
    setDiagnosisSnapshot(visit.id, diagnoses.map((d) => d.icd10Code));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagKey]);

  // Core logic: add meds + follow-up + track applied record for a diagnosis
  const applyPresetsForDiag = async (selected: TreatmentPreset[], diagnosisDesc: string, baselineMeds: any[]) => {
    const newMeds = mergeMeds(selected, baselineMeds);
    for (const med of newMeds) {
      await addMedication(visit.id, udid, { ...med, laterality: (med as any).laterality ?? diagLaterality });
    }
    const followUpDays = selected.map((p) => p.followUpDays).filter((d): d is number => !!d);
    if (followUpDays.length > 0 && !visit.followUpDate) {
      const fuDate = new Date();
      fuDate.setDate(fuDate.getDate() + Math.min(...followUpDays));
      await saveFollowUp(visit.id, udid, {
        followUpDate:    fuDate.toISOString(),
        referralEnabled: visit.referralEnabled ?? false,
        referralNote:    visit.referralNote ?? null,
      });
    }
    const newRecords: AppliedPreset[] = selected.map((p) => ({
      presetId:      p.id,
      presetName:    p.name,
      appliedAt:     new Date().toISOString(),
      diagnosisDesc,
    }));
    const base = appliedPresets.filter((a) => a.diagnosisDesc !== diagnosisDesc);
    const existingIds = new Set(base.map((a) => a.presetId));
    const merged = [...base, ...newRecords.filter((r) => !existingIds.has(r.presetId))];
    setApplied(visit.id, merged);
    setAppliedPresets(merged);
    const advice = selected.map((p) => p.advice).filter(Boolean).join("\n");
    if (advice) setAdviseNotes((prev) => {
      const existingLines = new Set(prev.split("\n").map((l) => l.trim()).filter(Boolean));
      const newLines = advice.split("\n").map((l) => l.trim()).filter((l) => l && !existingLines.has(l));
      if (!newLines.length) return prev;
      return prev.trim() ? `${prev.trim()}\n${newLines.join("\n")}` : newLines.join("\n");
    });
    setToastNames(selected.map((p) => p.name));
    setPendingDiagPrompts((prev) => prev.filter((p) => p.diagnosisDesc !== diagnosisDesc));
    setActiveDialogDiag(null);
  };

  // Initial apply — no old meds to remove
  const handleInitialApply = (selected: TreatmentPreset[], diagnosisDesc: string) => {
    startApply(() => applyPresetsForDiag(selected, diagnosisDesc, medications));
  };

  // Change protocol — remove old preset meds for this diagnosis, then add new ones
  const handleChangeProtocolForDiag = (selected: TreatmentPreset[], diagnosisDesc: string) => {
    startApply(async () => {
      const diagApplied = appliedPresets.filter((a) => a.diagnosisDesc === diagnosisDesc);
      const oldPresetIds = new Set(diagApplied.map((a) => a.presetId));
      const allPresets = getTreatmentPresets();
      const oldPresets = allPresets.filter((p) => oldPresetIds.has(p.id));
      const oldDrugNames = new Set(oldPresets.flatMap((p) => p.medications.map((m) => m.drugName.toLowerCase())));
      const medsToDelete = (visit.medications ?? []).filter((m: any) => oldDrugNames.has(m.drugName.toLowerCase()));
      for (const med of medsToDelete) {
        await removeMedication(med.id, udid);
      }
      const remainingMeds = (visit.medications ?? []).filter((m: any) => !oldDrugNames.has(m.drugName.toLowerCase()));
      await applyPresetsForDiag(selected, diagnosisDesc, remainingMeds);
    });
  };

  // Dismiss a protocol prompt for a diagnosis
  const handleDismissPrompt = (diagnosisDesc: string, matches: PresetMatch[]) => {
    addDismissedDiagDesc(visit.id, diagnosisDesc);
    matches.forEach((m) => addDismissedPreset(visit.id, m.preset.id));
    setDismissedIds((prev) => [...prev, ...matches.map((m) => m.preset.id)]);
    setPendingDiagPrompts((prev) => prev.filter((p) => p.diagnosisDesc !== diagnosisDesc));
  };

  // Delete protocol and remove its medications from Plan
  const handleRemoveAppliedForDiag = (diagnosisDesc: string) => {
    startApply(async () => {
      const diagApplied = appliedPresets.filter((a) => a.diagnosisDesc === diagnosisDesc);
      const oldPresetIds = new Set(diagApplied.map((a) => a.presetId));
      const allPresets = getTreatmentPresets();
      const oldPresets = allPresets.filter((p) => oldPresetIds.has(p.id));
      const oldDrugNames = new Set(oldPresets.flatMap((p) => p.medications.map((m) => m.drugName.toLowerCase())));
      const medsToDelete = (visit.medications ?? []).filter((m: any) => oldDrugNames.has(m.drugName.toLowerCase()));
      for (const med of medsToDelete) {
        await removeMedication(med.id, udid);
      }
      const updated = appliedPresets.filter((a) => a.diagnosisDesc !== diagnosisDesc);
      setApplied(visit.id, updated);
      setAppliedPresets(updated);
      // Restore prompt so doctor can re-apply — always show for any diagnosis
      removeDismissedDiagDesc(visit.id, diagnosisDesc);
      const diagMatches = presetMatches.filter((m) => m.diagnosisDesc === diagnosisDesc);
      const diag = diagnoses.find((d) => d.description === diagnosisDesc);
      setPendingDiagPrompts((prev) =>
        prev.some((p) => p.diagnosisDesc === diagnosisDesc)
          ? prev
          : [...prev, { diagnosisDesc, laterality: diag?.laterality, matches: diagMatches }]
      );
    });
  };

  // Group applied presets by diagnosis for per-diagnosis badges
  const appliedByDiag = useMemo(() => {
    const byDiag: Record<string, AppliedPreset[]> = {};
    for (const a of appliedPresets) {
      (byDiag[a.diagnosisDesc] = byDiag[a.diagnosisDesc] ?? []).push(a);
    }
    return byDiag;
  }, [appliedPresets]);

  return (
    <div className="flex flex-col gap-5">
      <PrescriptionCard
        visit={visit} udid={udid} priorVisits={priorVisits}
        defaultLaterality={diagLaterality} adviseNotes={adviseNotes} onAdviseChange={setAdviseNotes}
        toastNames={toastNames} onCloseToast={() => setToastNames([])}
        pendingDiagPrompts={pendingDiagPrompts}
        onConfirmPrompt={(diag) => setActiveDialogDiag({ ...diag, isChanging: false })}
        onDismissPrompt={handleDismissPrompt}
        appliedByDiag={appliedByDiag}
        presetMatches={presetMatches}
        onRemoveApplied={handleRemoveAppliedForDiag}
        onChangeProtocol={(desc, matches) => setActiveDialogDiag({ diagnosisDesc: desc, matches, isChanging: true })}
        activeDialogDiag={activeDialogDiag}
        setActiveDialogDiag={setActiveDialogDiag}
        applying={applying}
        onApplyProtocol={(selected, diagnosisDesc, isChanging) =>
          isChanging ? handleChangeProtocolForDiag(selected, diagnosisDesc) : handleInitialApply(selected, diagnosisDesc)
        }
      />
      <MinorProcedureCard visit={visit} udid={udid} priorVisits={priorVisits} />
      <OpticalPrescriptionCard visit={visit} />
      <DispositionCard visit={visit} udid={udid} patientSex={patientSex} priorVisits={priorVisits} />

    </div>
  );
}


const ANESTHESIA_KEYWORDS = [
  "Topical Anesthesia",
  "Local Infiltration",
  "Peribulbar Block",
  "Retrobulbar Block",
  "Sub-Tenon's Block",
  "General Anesthesia",
  "Monitored Anesthesia Care (MAC)",
  "Sedation + Topical",
];

const PROCEDURE_KEYWORDS = [
  "Chalazion excision",
  "Chalazion incision and curettage",
  "Foreign body removal (corneal)",
  "Foreign body removal (conjunctival)",
  "Subconjunctival injection",
  "Punctal plug insertion",
  "Punctal cautery",
  "Epilation",
  "Lid margin scrubbing",
  "Corneal scraping for culture",
  "Conjunctival swab",
  "Lacrimal probing",
  "Symblepharon release",
  "Eyelid laceration repair",
  "YAG capsulotomy",
  "Laser peripheral iridotomy (LPI)",
  "Selective laser trabeculoplasty (SLT)",
  "Argon laser photocoagulation",
  "Pan-retinal photocoagulation (PRP)",
  "Focal laser photocoagulation",
  "Anterior chamber paracentesis",
  "Subtenon injection",
  "Botulinum toxin injection",
  "Conjunctival peritomy",
  "Amniotic membrane transplant",
  "Corneal collagen cross-linking (CXL)",
  "Superficial keratectomy",
  "Cauterization of corneal ulcer",
];

// Scoped per-doctor, same pattern as seg_custom_* in Anterior Segment
const procKwKey = (doctorId: string) => `proc_custom_${doctorId}`;

function getCustomProcedureKws(doctorId: string): string[] {
  try { return JSON.parse(localStorage.getItem(procKwKey(doctorId)) ?? "[]"); } catch { return []; }
}
function saveCustomProcedureKw(doctorId: string, kw: string): void {
  const cur = getCustomProcedureKws(doctorId);
  // Case-insensitive duplicate guard — same logic as Anterior Segment's addKeyword
  if (cur.some((k) => k.toLowerCase() === kw.toLowerCase())) return;
  localStorage.setItem(procKwKey(doctorId), JSON.stringify([...cur, kw]));
}
function deleteCustomProcedureKw(doctorId: string, kw: string): void {
  const cur = getCustomProcedureKws(doctorId).filter((k) => k !== kw);
  localStorage.setItem(procKwKey(doctorId), JSON.stringify(cur));
}

function parseProcedureList(raw: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((s): s is string => typeof s === "string");
  } catch {}
  return [raw];
}

function MinorProcedureCard({ visit, udid, priorVisits }: { visit: any; udid: string; priorVisits: any[] }) {
  const [laterality,     setLaterality]     = useState<string>(visit.procedureLaterality ?? "OU");
  const [anesthesia,     setAnesthesia]     = useState<string>(visit.anesthesiaType ?? "");
  const [showHistory,    setShowHistory]    = useState(false);
  const [anesthesiaOpen, setAnesthesiaOpen] = useState(false);

  // Input IS the procedure — auto-saved directly, no separate add step
  const [procInput, setProcInput]   = useState<string>(() => {
    const list = parseProcedureList(visit.procedureName ?? "");
    return list.join(", ");
  });
  const [procNotes, setProcNotes]   = useState<string>(visit.procedureNotes ?? "");
  const [customKws, setCustomKws]   = useState<string[]>([]);
  const procInputRef = useRef<HTMLInputElement>(null);

  // Per-doctor scope — same as seg_custom_* in Anterior Segment
  const doctorId: string = visit.doctorId ?? "";

  useEffect(() => { setCustomKws(getCustomProcedureKws(doctorId)); }, [doctorId]);

  useAutoSave(laterality, (val) => saveProcedureLaterality(visit.id, udid, val));
  useAutoSave(anesthesia, (val) => saveAnesthesiaType(visit.id, udid, val));
  useAutoSave(procInput,  (val) => saveProcedureName(visit.id, udid, val));
  useAutoSave(procNotes,  (val) => saveProcedureNotes(visit.id, udid, val));

  const allKeywords = [...PROCEDURE_KEYWORDS, ...customKws];

  // Save the current input text as a permanent custom keyword (does not clear input)
  const saveKeyword = () => {
    const trimmed = procInput.trim();
    if (!trimmed) return;
    if (!allKeywords.some((k) => k.toLowerCase() === trimmed.toLowerCase())) {
      saveCustomProcedureKw(doctorId, trimmed);
      setCustomKws(getCustomProcedureKws(doctorId));
    }
  };

  const isNewKeyword = procInput.trim().length > 0 &&
    !allKeywords.some((k) => k.toLowerCase() === procInput.trim().toLowerCase());

  const filteredAnesthesia = ANESTHESIA_KEYWORDS.filter((kw) =>
    anesthesia.trim() === "" || kw.toLowerCase().includes(anesthesia.toLowerCase())
  );

  const historyBtnCls = `flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
    showHistory
      ? "bg-[var(--color-primary-50)] border-[var(--color-primary-300)] text-[var(--color-primary-700)]"
      : "border-[var(--color-border)] text-[var(--color-ink-500)] hover:text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]"
  }`;

  return (
    <Card>
      {/* Heading row */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p className="text-sm font-medium text-[var(--color-ink-700)]">Minor Procedure</p>
        <button onClick={() => setShowHistory((v) => !v)} className={historyBtnCls}>
          <History size={12} /> History
        </button>
      </div>

      {/* Single row: Laterality | Procedure | Anesthesia */}
      <div className="flex gap-3 items-end">

        {/* Laterality */}
        <div className="shrink-0">
          <label className="text-[10px] font-semibold text-[var(--color-ink-500)] uppercase tracking-wide block mb-1.5">
            Laterality
          </label>
          <div className="flex gap-1">
            {(["RE", "LE", "OU"] as const).map((lat) => (
              <button
                key={lat}
                onClick={() => setLaterality(lat)}
                className={`w-10 py-2 rounded-lg border text-xs font-bold transition-colors ${
                  laterality === lat
                    ? "bg-[var(--color-primary-600)] border-[var(--color-primary-600)] text-white"
                    : "border-[var(--color-border)] text-[var(--color-ink-500)] hover:border-[var(--color-primary-300)] hover:text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)]"
                }`}
              >
                {lat}
              </button>
            ))}
          </div>
        </div>

        {/* Procedure — custom input only, keywords shown as chips below */}
        <div className="flex-1 min-w-0">
          <label className="text-[10px] font-semibold text-[var(--color-ink-500)] uppercase tracking-wide block mb-1.5">
            Procedure
          </label>
          <div className="flex gap-2">
            <input
              ref={procInputRef}
              value={procInput}
              onChange={(e) => setProcInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") setProcInput(""); }}
              placeholder="Select a keyword below or type a procedure…"
              className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3 py-2 text-sm text-[var(--color-ink-800)] placeholder:text-[var(--color-ink-300)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-transparent"
            />
            {isNewKeyword && (
              <button
                onClick={saveKeyword}
                className="shrink-0 px-3 py-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition-colors flex items-center gap-1"
                title="Save as a permanent keyword"
              >
                Save keyword
              </button>
            )}
          </div>
        </div>

        {/* Anesthesia */}
        <div className="flex-1 min-w-0 relative">
          <label className="text-[10px] font-semibold text-[var(--color-ink-500)] uppercase tracking-wide block mb-1.5">
            Type of Anesthesia
          </label>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-300)] pointer-events-none" />
            <input
              value={anesthesia}
              onChange={(e) => { setAnesthesia(e.target.value); setAnesthesiaOpen(true); }}
              onFocus={() => setAnesthesiaOpen(true)}
              onBlur={() => setTimeout(() => setAnesthesiaOpen(false), 150)}
              placeholder="Search anesthesia…"
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] pl-8 pr-7 py-2 text-sm text-[var(--color-ink-800)] placeholder:text-[var(--color-ink-300)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-transparent"
            />
            {anesthesia && (
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { setAnesthesia(""); setAnesthesiaOpen(true); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-300)] hover:text-[var(--color-ink-600)]"
              >
                <X size={13} />
              </button>
            )}
          </div>
          {anesthesiaOpen && filteredAnesthesia.length > 0 && (
            <div className="absolute z-20 mt-1 w-full rounded-xl border border-[var(--color-border)] bg-white shadow-lg overflow-hidden">
              {filteredAnesthesia.map((kw) => (
                <button
                  key={kw}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { setAnesthesia(kw); setAnesthesiaOpen(false); }}
                  className={`w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center justify-between gap-2 ${
                    anesthesia === kw
                      ? "bg-[var(--color-primary-50)] text-[var(--color-primary-700)] font-medium"
                      : "text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]"
                  }`}
                >
                  {kw}
                  {anesthesia === kw && <Check size={13} className="shrink-0 text-[var(--color-primary-600)]" />}
                </button>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Procedure Notes */}
      <div className="mt-3">
        <label className="text-[10px] font-semibold text-[var(--color-ink-500)] uppercase tracking-wide block mb-1.5">
          Procedure Notes
        </label>
        <textarea
          value={procNotes}
          onChange={(e) => setProcNotes(e.target.value)}
          placeholder="Add notes about the procedure…"
          rows={3}
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3 py-2 text-sm text-[var(--color-ink-800)] placeholder:text-[var(--color-ink-300)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-transparent resize-none"
        />
      </div>

      {/* Keyword chips */}
      <div className="mt-3">
        <p className="text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-wide mb-2">Quick Add</p>
        <div className="flex flex-wrap gap-1.5">
          {allKeywords.map((kw) => {
            const isCustom = customKws.includes(kw);
            return (
              <div key={kw} className="flex items-center">
                <button
                  onClick={() => { setProcInput(kw); procInputRef.current?.focus(); }}
                  className={`text-xs px-2.5 py-1 rounded-l-full border transition-colors ${
                    isCustom
                      ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                      : "border-[var(--color-border)] bg-[var(--color-surface-sunken)] text-[var(--color-ink-700)] hover:border-[var(--color-primary-300)] hover:bg-[var(--color-primary-50)] hover:text-[var(--color-primary-700)]"
                  } ${isCustom ? "" : "rounded-r-full"}`}
                >
                  {kw}
                </button>
                {isCustom && (
                  <button
                    onClick={() => { deleteCustomProcedureKw(doctorId, kw); setCustomKws(getCustomProcedureKws(doctorId)); }}
                    className="px-1.5 py-1 rounded-r-full border border-l-0 border-amber-200 bg-amber-50 text-amber-400 hover:text-red-500 hover:bg-red-50 hover:border-red-200 transition-colors"
                    title="Remove custom keyword"
                  >
                    <X size={10} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* History panel */}
      {showHistory && (
        <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-white shadow-sm overflow-hidden">
          <div className="px-3 py-2 bg-[var(--color-surface-sunken)] border-b border-[var(--color-border)] flex items-center justify-between">
            <span className="text-[10px] font-bold text-[var(--color-ink-400)] uppercase tracking-widest">Previous Procedures</span>
            <button onClick={() => setShowHistory(false)} className="text-[var(--color-ink-300)] hover:text-[var(--color-ink-700)]"><X size={12} /></button>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-[var(--color-border)]">
            {priorVisits.filter((v) => v.id !== visit.id && (v.anesthesiaType || v.procedureName || v.procedureLaterality || v.procedureNotes)).length === 0 ? (
              <p className="px-3 py-4 text-xs text-[var(--color-ink-400)] text-center">No previous records found.</p>
            ) : (
              priorVisits
                .filter((v) => v.id !== visit.id && (v.anesthesiaType || v.procedureName || v.procedureLaterality || v.procedureNotes))
                .map((v) => {
                  const priorProcs = parseProcedureList(v.procedureName ?? "");
                  return (
                    <div key={v.id} className="px-3 py-2.5 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold text-[var(--color-ink-400)] mb-1">
                          {new Date(v.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                          {v.procedureLaterality && <span className="ml-1.5 font-bold text-[var(--color-primary-600)]">{v.procedureLaterality}</span>}
                        </p>
                        {(priorProcs.length > 0 || v.procedureName) && (
                          <div className="mb-0.5">
                            <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--color-ink-300)]">Procedure</span>
                            {priorProcs.length > 0
                              ? priorProcs.map((p, i) => <p key={i} className="text-xs font-medium text-[var(--color-ink-700)]">{p}</p>)
                              : <p className="text-xs font-medium text-[var(--color-ink-700)]">{v.procedureName}</p>
                            }
                          </div>
                        )}
                        {v.anesthesiaType && (
                          <div className="mb-0.5">
                            <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--color-ink-300)]">Anesthesia</span>
                            <p className="text-xs text-[var(--color-ink-600)]">{v.anesthesiaType}</p>
                          </div>
                        )}
                        {v.procedureNotes && (
                          <div>
                            <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--color-ink-300)]">Notes</span>
                            <p className="text-xs text-[var(--color-ink-600)] whitespace-pre-wrap">{v.procedureNotes}</p>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          if (v.procedureLaterality) setLaterality(v.procedureLaterality);
                          if (v.anesthesiaType) setAnesthesia(v.anesthesiaType);
                          if (priorProcs.length > 0) setProcInput(priorProcs.join(", "));
                          else if (v.procedureName) setProcInput(v.procedureName);
                          if (v.procedureNotes) setProcNotes(v.procedureNotes);
                          setShowHistory(false);
                        }}
                        className="shrink-0 text-[10px] font-medium text-[var(--color-primary-600)] hover:underline"
                      >
                        Use this
                      </button>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

const FREQUENCY_OPTIONS = [
  "OD (Once daily)", "BD (Twice daily)", "TID (Three times daily)",
  "QID (Four times daily)", "QHS (At bedtime)", "PRN (As needed)",
  "Stat (Immediately)",
];

const DOSE_OPTIONS = [
  "1 drop", "2 drops",
  "½ tablet", "1 tablet", "2 tablets",
  "1 capsule", "2 capsules",
  "0.05 mL", "0.1 mL", "0.5 mL", "1 mL",
  "5 mL", "10 mL",
  "25 mg", "50 mg", "100 mg", "250 mg", "500 mg", "1 g",
];

const DURATION_OPTIONS = [
  "1 day", "2 days", "3 days", "4 days", "5 days", "6 days", "7 days",
  "10 days", "14 days", "3 weeks", "4 weeks",
  "1 month", "2 months", "3 months", "6 months", "1 year",
  "Long-term",
];

const ROUTE_OPTIONS = ["Topical", "Oral", "IM", "IV", "Subconjunctival", "Intravitreal", "Subtenon"];

const ADVISE_KEYWORDS: { group: string; items: string[] }[] = [
  {
    group: "Eye Care",
    items: ["Avoid rubbing eyes", "Wear protective glasses", "Use dark glasses outdoors", "Avoid eye makeup", "Keep eyes clean and dry"],
  },
  {
    group: "Drops & Medication",
    items: ["Instill drops as prescribed", "Wash hands before instilling drops", "Shake bottle before use", "Wait 5 min between different drops", "Store drops in a cool place"],
  },
  {
    group: "Activity",
    items: ["Avoid swimming", "Avoid dusty environments", "No strenuous activity", "Avoid screen time for 24h", "Avoid driving after dilation"],
  },
  {
    group: "Post-operative",
    items: ["Avoid bending over", "Avoid water contact with eyes", "Lie flat after intravitreal injection", "No heavy lifting", "Sleep on non-operated side"],
  },
  {
    group: "Diet & Lifestyle",
    items: ["High fiber diet", "Avoid alcohol", "Adequate sleep", "Stay well hydrated", "Avoid smoking"],
  },
  {
    group: "Follow-up",
    items: ["Follow up as scheduled", "Return immediately if vision worsens", "Return if pain increases", "Call clinic if discharge occurs"],
  },
];

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

type EditDraft = { drugName: string; dosage: string; frequency: string; duration: string; instructions: string; route?: string; laterality?: string };

function PrescriptionCard({ visit, udid, priorVisits, defaultLaterality = "OU", adviseNotes, onAdviseChange, toastNames, onCloseToast, pendingDiagPrompts, onConfirmPrompt, onDismissPrompt, appliedByDiag, presetMatches, onRemoveApplied, onChangeProtocol, activeDialogDiag, setActiveDialogDiag, applying, onApplyProtocol }: { visit: any; udid: string; priorVisits: any[]; defaultLaterality?: string; adviseNotes: string; onAdviseChange: (notes: string) => void; toastNames: string[]; onCloseToast: () => void; pendingDiagPrompts: { diagnosisDesc: string; laterality?: string; matches: PresetMatch[] }[]; onConfirmPrompt: (diag: { diagnosisDesc: string; laterality?: string; matches: PresetMatch[] }) => void; onDismissPrompt: (desc: string, matches: PresetMatch[]) => void; appliedByDiag: Record<string, any[]>; presetMatches: PresetMatch[]; onRemoveApplied: (desc: string) => void; onChangeProtocol: (desc: string, matches: PresetMatch[]) => void; activeDialogDiag: any; setActiveDialogDiag: (v: any) => void; applying: boolean; onApplyProtocol: (selected: TreatmentPreset[], diagnosisDesc: string, isChanging: boolean) => void }) {
  const [pending, startTransition] = useTransition();
  const [showAddDrug, setShowAddDrug] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>({ drugName: "", dosage: "", frequency: "", duration: "", instructions: "", route: "Topical", laterality: "OU" });
  const [clearConfirm, setClearConfirm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showKeywords, setShowKeywords] = useState(false);
  const adviseRef = useRef<HTMLTextAreaElement>(null);

  const [drugName, setDrugName]       = useState("");
  const [dose, setDose]               = useState("");
  const [route, setRoute]             = useState("Topical");
  const [laterality, setLaterality]   = useState(defaultLaterality);
  useEffect(() => { setLaterality(defaultLaterality); }, [defaultLaterality]);
  const [frequency, setFrequency]         = useState("");
  const [durationSel, setDurationSel]     = useState("");
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
    setLaterality(defaultLaterality);
    setFrequency(""); setDurationSel("");
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

  const startEdit = (m: any) => {
    setEditingId(m.id);
    setEditDraft({ drugName: m.drugName ?? "", dosage: m.dosage ?? "", frequency: m.frequency ?? "", duration: m.duration ?? "", instructions: m.instructions ?? "", route: m.route ?? "Topical", laterality: m.laterality ?? defaultLaterality });
  };

  const saveEdit = (id: string) => {
    if (!editDraft.drugName.trim()) return;
    startTransition(async () => {
      await updateMedication(id, udid, { drugName: editDraft.drugName.trim(), dosage: editDraft.dosage, frequency: editDraft.frequency, duration: editDraft.duration, instructions: editDraft.instructions, route: editDraft.route, laterality: editDraft.route === "Topical" ? editDraft.laterality : undefined });
      setEditingId(null);
    });
  };

  const handleClearAll = () => {
    if (!clearConfirm) { setClearConfirm(true); setTimeout(() => setClearConfirm(false), 3500); return; }
    startTransition(async () => {
      await clearAllMedications(visit.id, udid);
      setClearConfirm(false);
    });
  };

  const submitDrug = () => {
    if (!drugName.trim()) return;
    startTransition(async () => {
      const duration = durationSel;
      const tapParts = taperLevels
        .filter((l) => l.frequency && l.durationNum)
        .map((l) => `${l.frequency} × ${l.durationNum} ${l.durationUnit}`);
      const tapNote = tapParts.length ? `Tapering: ${tapParts.join(" → ")}` : "";
      const finalInstructions = [instructions, tapNote].filter(Boolean).join(" | ");
      await addMedication(visit.id, udid, { drugName, dosage: dose, frequency, duration, instructions: finalInstructions, route, laterality: route === "Topical" ? laterality : undefined } as any);
      setDrugName(""); setDose(""); setRoute("Topical"); setFrequency(""); setDurationSel("");
      setTaperLevels([]);
      setInstructions("");
      setShowAddDrug(false);
      setSearchQuery("");
      setShowDropdown(false);
      setTimeout(() => searchRef.current?.focus(), 80);
    });
  };

  const inputCls = "w-full rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-500)]";

  const getMedBadge = (r: string | null | undefined, lat: string | null | undefined, name: string) => {
    const route = r ?? "";
    const dn = name ?? "";
    if (route === "Topical" || /eye\s*drops?|eye\s*oint/i.test(dn)) {
      return { label: lat || defaultLaterality, bg: "bg-[var(--color-primary-100)]", text: "text-[var(--color-primary-700)]" };
    }
    if (/syrup|suspension/i.test(route) || /syrup|suspension/i.test(dn)) {
      return { label: "SYP", bg: "bg-emerald-100", text: "text-emerald-700" };
    }
    if (route === "IM" || route === "IV" || route === "Intravitreal" || route === "Subconjunctival" || route === "Subtenon" || /inject/i.test(dn)) {
      return { label: "INJ", bg: "bg-rose-100", text: "text-rose-700" };
    }
    if (route === "Oral" || /tablet|capsule/i.test(dn)) {
      return { label: "TAB", bg: "bg-amber-100", text: "text-amber-700" };
    }
    return null;
  };

  return (
    <Card>
      {/* Protocol toast */}
      {toastNames.length > 0 && (
        <AutoApplyToast names={toastNames} onClose={onCloseToast} />
      )}

      {/* Per-diagnosis applied protocol badges */}
      {Object.entries(appliedByDiag).map(([diagnosisDesc, diagApplied]) => (
        <PresetAppliedBadge
          key={diagnosisDesc}
          applied={diagApplied}
          presetMatches={presetMatches.filter((m) => m.diagnosisDesc === diagnosisDesc)}
          diagnosisLabel={diagnosisDesc}
          visitId={visit.id}
          udid={udid}
          onRemove={() => onRemoveApplied(diagnosisDesc)}
          onChange={() => onChangeProtocol(diagnosisDesc, presetMatches.filter((m) => m.diagnosisDesc === diagnosisDesc))}
        />
      ))}

      {/* Protocol selection dialog */}
      {activeDialogDiag && (
        <PresetSelectDialog
          matches={activeDialogDiag.matches}
          onApply={(selected) => onApplyProtocol(selected, activeDialogDiag.diagnosisDesc, activeDialogDiag.isChanging)}
          onClose={() => setActiveDialogDiag(null)}
          applying={applying}
        />
      )}

      <div className={`flex items-center justify-between mb-3 flex-wrap gap-2 ${Object.keys(appliedByDiag).length > 0 ? "mt-4" : ""}`}>
        <p className="text-sm font-medium text-[var(--color-ink-700)]">Prescription / Medications</p>
        <div className="flex items-center gap-2">
          {medications.length > 0 && (
            <button
              onClick={handleClearAll}
              disabled={pending}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                clearConfirm
                  ? "bg-red-50 text-red-600 border-red-300 hover:bg-red-100"
                  : "bg-white text-[var(--color-ink-500)] border-[var(--color-border)] hover:border-red-300 hover:text-red-500"
              }`}
            >
              {clearConfirm ? <><AlertTriangle size={12} /> Confirm Clear All?</> : <><Trash2 size={12} /> Clear All</>}
            </button>
          )}
          <button
            onClick={() => setShowPresets((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-white border border-[var(--color-border)] hover:border-[var(--color-primary-500)] transition-colors"
          >
            <ChevronDown size={13} className={showPresets ? "rotate-180 transition-transform" : "transition-transform"} /> Presets
          </button>
        </div>
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
                  {(() => {
                    const badge = getMedBadge(med.route, null, med.name);
                    return badge ? (
                      <span className={`min-w-[32px] h-8 px-1.5 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${badge.bg} ${badge.text}`}>
                        {badge.label === "OU" || badge.label === "RE" || badge.label === "LE" ? "EYE" : badge.label}
                      </span>
                    ) : (
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        i === activeIndex ? "bg-[var(--color-primary-100)]" : "bg-[var(--color-surface-sunken)]"
                      }`}>
                        <Pill size={15} className="text-[var(--color-ink-400)]" />
                      </div>
                    );
                  })()}
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

      {/* Per-diagnosis protocol prompt cards — shown below search */}
      {pendingDiagPrompts.map(({ diagnosisDesc, laterality: diagLat, matches }) => (
        <ProtocolPromptCard
          key={diagnosisDesc}
          diagnosisDesc={diagLat ? `${diagnosisDesc} (${diagLat})` : diagnosisDesc}
          onConfirm={() => onConfirmPrompt({ diagnosisDesc, laterality: diagLat, matches })}
          onDismiss={() => onDismissPrompt(diagnosisDesc, matches)}
        />
      ))}

      {showPresets && <PresetPanel onApply={applyPreset} onClose={() => setShowPresets(false)} />}

      {/* Add Drug form */}
      {showAddDrug && (
        <div className="mb-4 p-3.5 rounded-xl border border-[var(--color-primary-200)] bg-[var(--color-primary-50)] shadow-sm">
          <div className="flex items-center justify-between mb-3 max-w-3xl">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[var(--color-primary-600)] flex items-center justify-center">
                <Pill size={13} className="text-white" />
              </div>
              <p className="text-xs font-semibold text-[var(--color-primary-700)]">#{medications.length + 1}</p>
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
              <select value={dose} onChange={(e) => setDose(e.target.value)} className={inputCls}>
                <option value="">— Select dose —</option>
                {DOSE_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
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
              <select value={durationSel} onChange={(e) => setDurationSel(e.target.value)} className={inputCls}>
                <option value="">— Select —</option>
                {DURATION_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
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
        <div className="mt-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="px-3 py-1.5 text-left text-[10px] font-bold text-[var(--color-ink-300)] uppercase tracking-widest w-12">#</th>
                <th className="px-3 py-1.5 text-left text-[10px] font-bold text-[var(--color-ink-300)] uppercase tracking-widest">Drug Name</th>
                <th className="px-3 py-1.5 text-left text-[10px] font-bold text-[var(--color-ink-300)] uppercase tracking-widest w-24">Dose</th>
                <th className="px-3 py-1.5 text-left text-[10px] font-bold text-[var(--color-ink-300)] uppercase tracking-widest w-44">Frequency</th>
                <th className="px-3 py-1.5 text-left text-[10px] font-bold text-[var(--color-ink-300)] uppercase tracking-widest w-28">Duration</th>
                <th className="px-3 py-1.5 w-20" />
              </tr>
            </thead>
            <tbody>
              {medications.map((m, idx) => {
                const isEditing = editingId === m.id;
                const cellCls = "w-full rounded border border-[var(--color-primary-300)] bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-500)]";
                return (
                  <>
                    <tr key={m.id} className={isEditing ? "bg-[var(--color-primary-50)]" : "bg-white hover:bg-[var(--color-surface-sunken)] transition-colors"}>
                      <td className="px-3 py-3 text-xs font-bold text-[var(--color-primary-600)] whitespace-nowrap">{idx + 1}</td>

                      {/* Drug Name */}
                      <td className="px-3 py-2.5">
                        {isEditing ? (
                          <div className="flex flex-col gap-1">
                            <input
                              autoFocus
                              value={editDraft.drugName}
                              onChange={(e) => setEditDraft({ ...editDraft, drugName: e.target.value })}
                              className={cellCls}
                            />
                            <select
                              value={editDraft.route ?? "Topical"}
                              onChange={(e) => setEditDraft({ ...editDraft, route: e.target.value })}
                              className={cellCls}
                            >
                              {ROUTE_OPTIONS.map((r) => <option key={r}>{r}</option>)}
                            </select>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            {(() => {
                              const badge = getMedBadge(m.route, m.laterality, m.drugName);
                              return badge ? (
                                <span className={`min-w-[32px] h-7 px-1.5 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${badge.bg} ${badge.text}`}>
                                  {badge.label}
                                </span>
                              ) : (
                                <div className="w-7 h-7 rounded-lg bg-[var(--color-surface-sunken)] flex items-center justify-center shrink-0">
                                  <Pill size={13} className="text-[var(--color-ink-400)]" />
                                </div>
                              );
                            })()}
                            <span className="text-sm font-semibold text-[var(--color-ink-900)]">{m.drugName}</span>
                          </div>
                        )}
                      </td>

                      {/* Dose */}
                      <td className="px-3 py-2.5">
                        {isEditing ? (
                          <select
                            value={editDraft.dosage}
                            onChange={(e) => setEditDraft({ ...editDraft, dosage: e.target.value })}
                            className={cellCls}
                          >
                            <option value="">— Select —</option>
                            {DOSE_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                          </select>
                        ) : (
                          <span className="text-xs text-[var(--color-ink-600)]">{m.dosage || <span className="text-[var(--color-ink-300)]">—</span>}</span>
                        )}
                      </td>

                      {/* Frequency */}
                      <td className="px-3 py-2.5">
                        {isEditing ? (
                          <select
                            value={editDraft.frequency}
                            onChange={(e) => setEditDraft({ ...editDraft, frequency: e.target.value })}
                            className={cellCls}
                          >
                            <option value="">— Select —</option>
                            {FREQUENCY_OPTIONS.map((f) => <option key={f}>{f}</option>)}
                          </select>
                        ) : (
                          <span className="text-xs text-[var(--color-ink-600)]">{m.frequency || <span className="text-[var(--color-ink-300)]">—</span>}</span>
                        )}
                      </td>

                      {/* Duration */}
                      <td className="px-3 py-2.5">
                        {isEditing ? (
                          <select
                            value={editDraft.duration}
                            onChange={(e) => setEditDraft({ ...editDraft, duration: e.target.value })}
                            className={cellCls}
                          >
                            <option value="">— Select —</option>
                            {DURATION_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                          </select>
                        ) : (
                          <span className="text-xs text-[var(--color-ink-600)]">{m.duration || <span className="text-[var(--color-ink-300)]">—</span>}</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => saveEdit(m.id)}
                                disabled={pending || !editDraft.drugName.trim()}
                                title="Save"
                                className="p-1.5 rounded-lg bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] disabled:opacity-40 transition-colors"
                              >
                                <Check size={13} />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                title="Cancel"
                                className="p-1.5 rounded-lg text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)] hover:bg-white transition-colors"
                              >
                                <X size={13} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEdit(m)}
                                title="Edit"
                                className="p-1.5 rounded-lg text-[var(--color-ink-300)] hover:text-[var(--color-primary-600)] hover:bg-[var(--color-primary-50)] transition-colors"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                onClick={() => removeMedication(m.id, udid)}
                                title="Delete"
                                className="p-1.5 rounded-lg text-[var(--color-ink-300)] hover:text-red-500 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Instructions sub-row */}
                    {(isEditing || m.instructions) && (
                      <tr key={`${m.id}-note`} className={isEditing ? "bg-[var(--color-primary-50)]" : ""}>
                        <td />
                        <td colSpan={4} className="px-3 pb-2.5 pt-0">
                          {isEditing ? (
                            <input
                              value={editDraft.instructions}
                              onChange={(e) => setEditDraft({ ...editDraft, instructions: e.target.value })}
                              placeholder="Instructions (optional)..."
                              className={cellCls + " w-full"}
                            />
                          ) : (
                            <span className="text-xs text-[var(--color-ink-600)]">{m.instructions}</span>
                          )}
                        </td>
                        <td />
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {/* ── Advise Notes ─────────────────────────────────────────────── */}
      <div className="mt-5 pt-4 border-t border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-[var(--color-ink-700)]">Advise Notes</label>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => { setShowHistory((v) => !v); setShowKeywords(false); }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors
                ${showHistory
                  ? "bg-[var(--color-primary-50)] border-[var(--color-primary-300)] text-[var(--color-primary-700)]"
                  : "border-[var(--color-border)] text-[var(--color-ink-500)] hover:text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]"}`}
            >
              <History size={12} />
              History
            </button>
            <button
              onClick={() => { setShowKeywords((v) => !v); setShowHistory(false); }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors
                ${showKeywords
                  ? "bg-[var(--color-primary-50)] border-[var(--color-primary-300)] text-[var(--color-primary-700)]"
                  : "border-[var(--color-border)] text-[var(--color-ink-500)] hover:text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]"}`}
            >
              <Plus size={12} />
              Keyword
            </button>
          </div>
        </div>

        <textarea
          ref={adviseRef}
          value={adviseNotes}
          onChange={(e) => onAdviseChange(e.target.value)}
          rows={3}
          placeholder="Type advise notes or use keywords below…"
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3 py-2.5 text-sm text-[var(--color-ink-800)] placeholder:text-[var(--color-ink-300)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-transparent resize-none leading-relaxed"
        />

        {/* History panel — below textarea */}
        {showHistory && (
          <div className="mt-2 rounded-xl border border-[var(--color-border)] bg-white shadow-sm overflow-hidden">
            <div className="px-3 py-2 bg-[var(--color-surface-sunken)] border-b border-[var(--color-border)] flex items-center justify-between">
              <span className="text-[10px] font-bold text-[var(--color-ink-400)] uppercase tracking-widest">Previous Advise Notes</span>
              <button onClick={() => setShowHistory(false)} className="text-[var(--color-ink-300)] hover:text-[var(--color-ink-700)]"><X size={12} /></button>
            </div>
            <div className="max-h-56 overflow-y-auto divide-y divide-[var(--color-border)]">
              {priorVisits.filter((v) => v.id !== visit.id && v.adviseNotes).length === 0 ? (
                <p className="px-3 py-4 text-xs text-[var(--color-ink-400)] text-center">No previous advise notes found.</p>
              ) : (
                priorVisits
                  .filter((v) => v.id !== visit.id && v.adviseNotes)
                  .map((v) => (
                    <div key={v.id} className="px-3 py-2.5">
                      <p className="text-[10px] font-semibold text-[var(--color-ink-400)] mb-1">
                        {new Date(v.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </p>
                      <p className="text-xs text-[var(--color-ink-700)] whitespace-pre-wrap leading-relaxed">{v.adviseNotes}</p>
                      <button
                        onClick={() => { onAdviseChange(v.adviseNotes); setShowHistory(false); }}
                        className="mt-1.5 text-[10px] font-medium text-[var(--color-primary-600)] hover:underline"
                      >
                        Use this
                      </button>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}

        {/* Keyword panel — below textarea */}
        {showKeywords && (
          <div className="mt-2 rounded-xl border border-[var(--color-border)] bg-white shadow-sm overflow-hidden">
            <div className="px-3 py-2 bg-[var(--color-surface-sunken)] border-b border-[var(--color-border)] flex items-center justify-between">
              <span className="text-[10px] font-bold text-[var(--color-ink-400)] uppercase tracking-widest">Add Keyword</span>
              <button onClick={() => setShowKeywords(false)} className="text-[var(--color-ink-300)] hover:text-[var(--color-ink-700)]"><X size={12} /></button>
            </div>
            <div className="p-3 flex flex-col gap-3">
              {ADVISE_KEYWORDS.map((group) => (
                <div key={group.group}>
                  <p className="text-[10px] font-bold text-[var(--color-ink-400)] uppercase tracking-widest mb-1.5">{group.group}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.items.map((kw) => (
                      <button
                        key={kw}
                        onClick={() => {
                          onAdviseChange(adviseNotes.trim()
                            ? adviseNotes.trimEnd() + (adviseNotes.trimEnd().endsWith(".") ? " " : ". ") + kw + "."
                            : kw + ".");
                          adviseRef.current?.focus();
                        }}
                        className="px-2 py-0.5 rounded-full border border-[var(--color-primary-200)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)] text-[11px] font-medium hover:bg-[var(--color-primary-100)] transition-colors"
                      >
                        {kw}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function OpticalPrescriptionCard({ visit }: { visit: any }) {
  const rc = visit.refraction;
  type RxFields = { sph: string; cyl: string; axis: string; nearSph: string; va: string; nearVa: string };
  const emptyRx: RxFields = { sph: "", cyl: "", axis: "", nearSph: "", va: "", nearVa: "" };
  const re: RxFields = parseJSON(rc?.re, emptyRx);
  const le: RxFields = parseJSON(rc?.le, emptyRx);

  const hasData = [re.sph, re.cyl, re.axis, re.va, re.nearSph, re.nearVa,
                   le.sph, le.cyl, le.axis, le.va, le.nearSph, le.nearVa]
    .some((v) => v && v !== "-");

  const cell = (val: string) => (val && val !== "-" ? val : <span className="text-[var(--color-ink-300)]">—</span>);

  const HEADERS = ["Sph", "Cyl", "Axis°", "VA", "Add", "NV"];
  const ROWS: { label: string; rx: RxFields }[] = [
    { label: "Right Eye", rx: re },
    { label: "Left Eye",  rx: le },
  ];

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-[var(--color-ink-700)]">Optical Prescription</p>
        {hasData && (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-[var(--color-primary-600)] bg-[var(--color-primary-50)] border border-[var(--color-primary-200)] rounded-full px-2 py-0.5">
            <CheckCircle2 size={10} />
            Added to Summary
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className="text-left pb-2 pr-6 text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)]" />
              {HEADERS.map((h) => (
                <th key={h} className="text-center pb-2 px-4 text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)]">
                  {h === "VA" || h === "NV"
                    ? <span className="inline-block px-2 py-0.5 rounded bg-[var(--color-surface-sunken)] text-[var(--color-ink-300)]">{h}</span>
                    : h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map(({ label, rx }) => (
              <tr key={label} className="border-b border-[var(--color-border)]">
                <td className="py-3 pr-6 text-xs font-semibold text-[var(--color-primary-700)] whitespace-nowrap">{label}</td>
                <td className="text-center py-3 px-4 text-sm text-[var(--color-ink-800)]">{cell(rx.sph)}</td>
                <td className="text-center py-3 px-4 text-sm text-[var(--color-ink-800)]">{cell(rx.cyl)}</td>
                <td className="text-center py-3 px-4 text-sm text-[var(--color-ink-800)]">{cell(rx.axis)}</td>
                <td className="text-center py-3 px-4 text-sm">
                  <span className="inline-block px-2.5 py-0.5 rounded bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]">{cell(rx.va)}</span>
                </td>
                <td className="text-center py-3 px-4 text-sm text-[var(--color-ink-800)]">{cell(rx.nearSph)}</td>
                <td className="text-center py-3 px-4 text-sm">
                  <span className="inline-block px-2.5 py-0.5 rounded bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]">{cell(rx.nearVa)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function DispositionCard({ visit, udid, patientSex, priorVisits = [] }: { visit: any; udid: string; patientSex: string; priorVisits?: any[] }) {
  const [activePanels, setActivePanels] = useState<string[]>(
    [
      visit.admission && "admit",
      visit.surgeryAdvised && "surgical",
    ].filter(Boolean) as string[]
  );
  const togglePanel = (id: string) =>
    setActivePanels((cur) => (cur.includes(id) ? cur.filter((p) => p !== id) : [...cur, id]));

  return (
    <Card>
      <p className="text-sm font-medium text-[var(--color-ink-700)] mb-3">Patient Disposition</p>
      <div className="flex gap-3 flex-wrap mb-2">
        <DispositionToggle icon={<BedDouble size={16} />}  label="Admit"                active={activePanels.includes("admit")}    onClick={() => togglePanel("admit")} />
        <DispositionToggle icon={<Scissors size={16} />}   label="Surgical Counselling" active={activePanels.includes("surgical")} onClick={() => togglePanel("surgical")} />
        <DispositionToggle icon={<RefreshCw size={16} />}  label="Follow Up Dates"      active={activePanels.includes("follow")}   onClick={() => togglePanel("follow")} />
      </div>
      <div className="flex flex-col gap-4">
        {activePanels.includes("admit")    && <AdmitPanel          visit={visit} udid={udid} patientSex={patientSex} />}
        {activePanels.includes("surgical") && <SurgicalPanel        visit={visit} udid={udid} />}
        {activePanels.includes("follow")   && <FollowUpdatesPanel   visit={visit} udid={udid} priorVisits={priorVisits} />}
      </div>
    </Card>
  );
}
