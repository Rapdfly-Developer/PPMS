"use client";

import { useState, useTransition, useEffect, useRef, useMemo, Fragment } from "react";
import { createPortal } from "react-dom";
import { publishProtocolPrompts } from "./protocol-prompts-store";
import { Card } from "@/components/ui/Card";
import { History } from "lucide-react";
import { useEmrOverview } from "./EmrOverviewContext";
import { useEMRSaveContext } from "./EmrSaveContext";
import { parseJSON } from "@/lib/json";
import { useAutoSave, SaveIndicator } from "@/lib/useAutoSave";
import { addMedication, removeMedication, updateMedication, clearAllMedications, saveRefraction, saveFollowUp, saveAdviseNotes, saveAnesthesiaType, saveProcedureLaterality, saveProcedureName, saveProcedureNotes, addInvestigationOrder, deleteInvestigationOrder } from "./actions";
import { DispositionToggle, FollowUpdatesPanel, ReferralPanel } from "./DispositionPanel";
import { Plus, X, Stethoscope, ChevronDown, Pencil, Trash2, RefreshCw, Share2, Search, Pill, Sparkles, CheckCircle2, Check, AlertTriangle } from "lucide-react";
import {
  type TreatmentPreset, type PresetMatch, type AppliedPreset,
  getTreatmentPresets, matchPresets, mergeMeds,
  getApplied, setApplied, clearApplied,
  getDiagnosisSnapshot, setDiagnosisSnapshot,
  getDismissedPresets, addDismissedPreset, clearDismissedPresets,
  saveTreatmentPresets,
} from "./treatmentPresets";
import { type MedEntry, searchMedications, saveCustomMedication } from "@/lib/ophthalmic-medications";
import { INV_CATALOG } from "@/lib/investigation-catalog";
import { FREQUENCY_OPTIONS, DOSE_OPTIONS, DURATION_OPTIONS } from "@/lib/medication-options";
import { appendKeywordAsBullet, KeywordChipsRow, KeywordInput, KeywordTextarea, KeywordTextareaControlsRow, removeKeywordFromText } from "@/components/emr/KeywordField";

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
    drugs.forEach((drug) => saveCustomMedication({ name: drug.drugName, defaultDose: drug.dosage }));
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

  // Shown as a pop-up over the page; Esc or a click outside closes it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[1px]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="w-full max-w-3xl max-h-[85vh] flex flex-col border border-[var(--color-border)] rounded-2xl bg-white shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] shrink-0">
        <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-700)]">Medication Presets</p>
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
        <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-sunken)] shrink-0 max-h-[45vh] overflow-y-auto">
          <p className="text-xs font-semibold text-[var(--color-ink-600)] mb-2">{editId ? "Edit Preset" : "New Preset"}</p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input value={formCategory} onChange={(e) => setFormCategory(e.target.value)} placeholder="Category (e.g. Glaucoma)" className="rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-xs" />
            <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Preset name" className="rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-xs" />
          </div>
          <div className="overflow-x-auto">
          {formDrugs.map((d, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-1.5 mb-1.5 min-w-[400px]">
              <input value={d.drugName}  onChange={(e) => setDrugField(i, "drugName",  e.target.value)} placeholder="Drug name"  className="rounded border border-[var(--color-border)] px-2 py-1 text-xs" />
              <input value={d.dosage}    onChange={(e) => setDrugField(i, "dosage",    e.target.value)} placeholder="Dosage"     className="rounded border border-[var(--color-border)] px-2 py-1 text-xs" />
              <input value={d.frequency} onChange={(e) => setDrugField(i, "frequency", e.target.value)} placeholder="Frequency"  className="rounded border border-[var(--color-border)] px-2 py-1 text-xs" />
              <input value={d.duration}  onChange={(e) => setDrugField(i, "duration",  e.target.value)} placeholder="Duration"   className="rounded border border-[var(--color-border)] px-2 py-1 text-xs" />
              <button onClick={() => setFormDrugs(formDrugs.filter((_, idx) => idx !== i))} className="text-[var(--color-ink-400)] hover:text-red-500"><X size={12} /></button>
            </div>
          ))}
          </div>
          <div className="flex gap-2 mt-2">
            <button onClick={() => setFormDrugs([...formDrugs, { drugName: "", dosage: "", frequency: "", duration: "" }])} className="text-xs text-[var(--color-primary-700)] hover:underline">+ Add drug row</button>
            <div className="ml-auto flex gap-2 shrink-0">
              <button onClick={resetForm} className="text-xs px-3 py-1 rounded-lg border border-[var(--color-border)] hover:bg-white">Cancel</button>
              <button onClick={saveForm} className="text-xs px-3 py-1 rounded-lg bg-[var(--color-primary-600)] text-white font-medium hover:bg-[var(--color-primary-700)]">Save Preset</button>
            </div>
          </div>
        </div>
      )}

      {/* Preset list */}
      <div className="px-4 py-3 flex-1 min-h-0 overflow-y-auto">
        {Object.keys(grouped).length === 0 ? (
          <p className="text-label sm:text-sm text-[var(--color-ink-400)] text-center py-6">No presets yet. Click &quot;+ New Preset&quot; to create one.</p>
        ) : (
          Object.entries(grouped).map(([cat, items]) => (
            <div key={cat} className="mb-5">
              <p className="text-caption font-bold uppercase tracking-widest text-[var(--color-ink-400)] mb-2">{cat}</p>
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
                        <li key={i} className="text-caption text-[var(--color-ink-500)]">
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
    </div>,
    document.body,
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
  const btnCls = "text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors";

  return (
    <div className="rounded-2xl border border-[#B2DEDA] bg-[#EEF8F7] overflow-hidden">
      {/* Header row */}
      {/* grow + basis-full (NOT flex-1): flex-1 is shorthand that sets flex-basis
          to 0, which let this column shrink to ~44px at 320px while flex-wrap
          never fired — a long diagnosis like "Corneal neovascularisation" then
          painted its glyphs straight over the Change button. basis-full gives
          the text its own row below sm so the buttons wrap beneath it, and
          sm:basis-0 restores the original side-by-side row. break-words is a
          second, independent guard so no single token can ever overflow its box. */}
      <div className="px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-start gap-3 grow basis-full sm:basis-0 min-w-0">
          <CheckCircle2 size={15} className="text-[#0F766E] shrink-0 mt-0.5" />
          <div className="min-w-0 break-words">
            <span className="text-xs font-semibold text-[#0F766E]">
              {diagnosisLabel ? `${diagnosisLabel}: ` : "Preset Applied: "}
            </span>
            <span className="text-xs text-[#0F766E]/80">{applied.map((a) => a.presetName).join(", ")}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-auto">
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

    </div>
  );
}

/* ── Autocomplete drug-name input (used in the preset form) ─────────────────── */
function DrugNameInput({
  value,
  onChange,
  className,
  placeholder,
}: {
  value: string;
  onChange: (name: string, defaultDose?: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [open, setOpen]   = useState(false);
  const [idx,  setIdx]    = useState(-1);
  const blurRef           = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestions       = useMemo(() => searchMedications(value), [value]);

  const select = (med: MedEntry) => {
    onChange(med.name, med.defaultDose);
    setOpen(false);
    setIdx(-1);
  };

  // A typed name that is not in the list can be saved as a custom drug, as in
  // Current Medications; it then shows in both dropdowns from then on.
  const typed = value.trim();
  const canAddCustom = !!typed && !suggestions.some((med) => med.name.toLowerCase() === typed.toLowerCase());

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || !suggestions.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, -1)); }
    else if (e.key === "Enter" && idx >= 0) { e.preventDefault(); select(suggestions[idx]); }
    else if (e.key === "Escape") { setOpen(false); setIdx(-1); }
  };

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setIdx(-1); }}
        onFocus={() => setOpen(true)}
        onBlur={() => { blurRef.current = setTimeout(() => setOpen(false), 150); }}
        onKeyDown={onKeyDown}
        placeholder={placeholder ?? "Drug name"}
        className={className}
        autoComplete="off"
      />
      {open && (suggestions.length > 0 || canAddCustom) && (
        <div
          className="absolute z-50 left-0 top-full mt-0.5 min-w-full w-max max-w-[min(460px,90vw)] bg-white rounded-xl shadow-xl border border-[var(--color-border)] overflow-auto"
          style={{ maxHeight: 220 }}
          onMouseDown={(e) => {
            e.preventDefault();
            if (blurRef.current) clearTimeout(blurRef.current);
          }}
        >
          {canAddCustom && (
            <button
              type="button"
              onClick={() => { saveCustomMedication({ name: typed }); onChange(typed); setOpen(false); setIdx(-1); }}
              className="w-full text-left px-3 py-2 text-xs border-b border-[var(--color-border)] last:border-0 text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)] transition-colors break-words"
            >
              + Add &ldquo;<span className="font-semibold">{typed}</span>&rdquo; as custom drug
            </button>
          )}
          {suggestions.map((med, i) => (
            <button
              key={med.id}
              type="button"
              onClick={() => select(med)}
              className={[
                "w-full text-left px-3 py-2 flex items-start gap-2 transition-colors",
                i === idx
                  ? "bg-[var(--color-primary-50)]"
                  : "hover:bg-[var(--color-surface-sunken)]",
                i < suggestions.length - 1 ? "border-b border-[var(--color-border)]" : "",
              ].join(" ")}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[var(--color-ink-800)] break-words">{med.name}</p>
                <p className="text-caption text-[var(--color-ink-400)] break-words">
                  {med.category}
                  {med.brand ? ` · ${med.brand}` : ""}
                  {med.defaultDose ? ` · ${med.defaultDose}` : ""}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Generic autocomplete for short option lists (dose, duration) ────────────── */
function OptionsInput({
  value,
  options,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const blurRef         = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
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
          style={{ maxHeight: 180 }}
          onMouseDown={(e) => {
            e.preventDefault();
            if (blurRef.current) clearTimeout(blurRef.current);
          }}
        >
          {filtered.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => { onChange(opt); setOpen(false); }}
              className={[
                "w-full text-left px-3 py-1.5 text-xs font-medium text-[var(--color-ink-700)] transition-colors",
                "hover:bg-[var(--color-primary-50)] hover:text-[var(--color-primary-700)]",
                opt !== filtered[filtered.length - 1] ? "border-b border-[var(--color-border)]" : "",
              ].join(" ")}
            >
              {opt}
            </button>
          ))}
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
  type TaperStep = TaperLevel;
  type FormMed = { drugName: string; dosage: string; frequency: string; duration: string; taperLevels: TaperStep[] };
  const blankMed = (): FormMed => ({ drugName: "", dosage: "", frequency: "", duration: "", taperLevels: [] });

  const [selected, setSelected] = useState<Set<string>>(
    matches[0]?.preset.id ? new Set([matches[0].preset.id]) : new Set()
  );
  const [customPresets, setCustomPresets] = useState<TreatmentPreset[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formMeds, setFormMeds] = useState<FormMed[]>([blankMed()]);
  const [formAdvice, setFormAdvice] = useState("");
  const [formInvestigations, setFormInvestigations] = useState<string[]>([]);
  const [editingInvIndex, setEditingInvIndex] = useState<number | null>(null);
  const [showInvPicker, setShowInvPicker] = useState(false);
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
        ? base.medications.map((m) => ({ drugName: m.drugName, dosage: m.dosage ?? "", frequency: m.frequency ?? "", duration: m.duration ?? "", taperLevels: [] }))
        : [blankMed()]
    );
    setFormAdvice(base?.advice ?? "");
    setFormInvestigations(base?.investigations ?? []);
    setFormFollowUp(base?.followUpDays ? String(base.followUpDays) : "");
    setEditingPresetId(null);
    setShowForm(true);
  };

  const openEditForm = (preset: TreatmentPreset) => {
    setFormName(preset.name);
    setFormMeds(preset.medications.map((m) => ({ drugName: m.drugName, dosage: m.dosage ?? "", frequency: m.frequency ?? "", duration: m.duration ?? "", taperLevels: [] })));
    setFormAdvice(preset.advice ?? "");
    setFormInvestigations(preset.investigations ?? []);
    setFormFollowUp(preset.followUpDays ? String(preset.followUpDays) : "");
    setEditingPresetId(preset.id);
    setShowForm(true);
  };

  const saveCustomProtocol = () => {
    const meds = formMeds.filter((m) => m.drugName.trim());
    if (!formName.trim() || !meds.length) return;
    meds.forEach((med) => saveCustomMedication({ name: med.drugName, defaultDose: med.dosage }));
    const newPreset: TreatmentPreset = {
      id: `custom-tx-${Date.now()}`,
      name: formName.trim(),
      diagnosisCodes: matches.map((m) => m.diagnosisCode),
      diagnosisKeywords: [],
      medications: meds.map((m) => {
        const tapParts = formatTaperSteps(m.taperLevels);
        const tapStr   = tapParts.length ? ` → Taper: ${tapParts.join(" → ")}` : "";
        return { drugName: m.drugName.trim(), dosage: m.dosage || undefined, frequency: m.frequency || undefined, duration: (m.duration + tapStr) || undefined };
      }),
      advice: formAdvice.trim() || undefined,
      investigations: formInvestigations.length ? formInvestigations : undefined,
      followUpDays: formFollowUp ? Number(formFollowUp) : undefined,
      isDefault: false,
      createdAt: new Date().toISOString(),
    };
    saveTreatmentPresets([...getTreatmentPresets(), newPreset]);
    setCustomPresets((prev) => [...prev, newPreset]);
    setSelected(new Set([newPreset.id]));
    setShowForm(false);
  };

  const updateProtocol = () => {
    if (!editingPresetId) return;
    const meds = formMeds.filter((m) => m.drugName.trim());
    if (!formName.trim() || !meds.length) return;
    meds.forEach((med) => saveCustomMedication({ name: med.drugName, defaultDose: med.dosage }));
    const all = getTreatmentPresets();
    const existing = all.find((p) => p.id === editingPresetId);
    const updated: TreatmentPreset = {
      ...(existing ?? { id: editingPresetId, diagnosisCodes: matches.map((m) => m.diagnosisCode), diagnosisKeywords: [], isDefault: false, createdAt: new Date().toISOString() }),
      name: formName.trim(),
      medications: meds.map((m) => {
        const tapParts = formatTaperSteps(m.taperLevels);
        const tapStr   = tapParts.length ? ` → Taper: ${tapParts.join(" → ")}` : "";
        return { drugName: m.drugName.trim(), dosage: m.dosage || undefined, frequency: m.frequency || undefined, duration: (m.duration + tapStr) || undefined };
      }),
      advice: formAdvice.trim() || undefined,
      investigations: formInvestigations.length ? formInvestigations : undefined,
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

  /* Exactly one entry per preset id.
     Editing a built-in default stores an override under the SAME id (that is how
     getTreatmentPresets overrides defaults), so the same preset arrives twice:
     from `matches` — the original default, captured once at mount — and from
     `customPresets`, the refreshed override. Concatenating them produced two
     cards sharing an id, which React warned about, showed as two selected
     radios, and let a stale entry into selectedPresets — dragging its
     followUpDays into the Math.min() that sets the follow-up date.
     The override replaces the default in place, keeping its position and the
     real diagnosis metadata for that match. */
  const allMatches: PresetMatch[] = (() => {
    const byId = new Map<string, PresetMatch>();
    for (const m of matches) byId.set(m.preset.id, m);
    for (const p of customPresets) {
      const existing = byId.get(p.id);
      byId.set(p.id, existing
        ? { ...existing, preset: p }
        : {
            preset: p,
            diagnosisCode: matches[0]?.diagnosisCode ?? "",
            diagnosisDesc: matches[0]?.diagnosisDesc ?? "Custom",
          });
    }
    return [...byId.values()];
  })();

  const toggle = (id: string) =>
    setSelected(new Set([id]));

  const selectedPresets = allMatches.filter((m) => selected.has(m.preset.id)).map((m) => m.preset);

  const inp = "w-full rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#0F766E] focus:border-[#0F766E]";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden"
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
            <p className="text-label sm:text-sm font-semibold text-white">Select Treatment Preset</p>
          </div>
          <button type="button" onClick={onClose} className="text-white/60 hover:text-white p-1">
            <X size={16} />
          </button>
        </div>

        {/* Preset list + form */}
        <div className="p-5 flex flex-col gap-3 max-h-[78vh] overflow-y-auto">
          <p className="text-xs text-[var(--color-ink-400)]">
            Select one preset to apply. Selecting a new protocol automatically deselects the previous one.
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
                <input type="radio" checked={checked} onChange={() => toggle(preset.id)} className="mt-1 accent-[#0F766E]" />
                <div className="flex-1 min-w-0">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-caption font-bold px-2 py-0.5 rounded-full bg-[#0F766E] text-white shrink-0">
                        Protocol {protocolNum}
                      </span>
                      <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-800)]">{preset.name}</p>
                      {isCustom && (
                        <span className="text-micro font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 shrink-0">CUSTOM</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.preventDefault()}>
                      {preset.followUpDays && (
                        <span className="text-caption font-medium px-2 py-0.5 rounded-full bg-[#EEF8F7] text-[#0F766E] border border-[#B2DEDA]">
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
                            className="px-2 py-0.5 rounded-lg bg-red-500 text-white text-caption font-semibold hover:bg-red-600 transition-colors"
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
                          <span className="text-caption text-[var(--color-ink-400)]">
                            {[m.dosage, m.frequency, m.duration].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>

                  {/* Extras */}
                  {preset.investigations && preset.investigations.length > 0 && (
                    <p className="text-caption text-[var(--color-ink-400)] mt-1">
                      <span className="font-semibold">Investigations:</span> {preset.investigations.join(", ")}
                    </p>
                  )}
                  {preset.advice && (
                    <p className="text-caption text-[var(--color-ink-400)] italic mt-0.5">
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
                <label className="text-caption font-semibold text-[var(--color-ink-400)] uppercase tracking-wide block mb-1">Protocol Name *</label>
                <input autoFocus value={formName} onChange={(e) => setFormName(e.target.value)} className={inp} placeholder="e.g. Corneal Ulcer, Protocol 2" />
              </div>

              {/* Drug rows */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-caption font-semibold text-[var(--color-ink-400)] uppercase tracking-wide">Medications *</label>
                  <button
                    type="button"
                    onClick={() => setFormMeds([...formMeds, blankMed()])}
                    className="flex items-center gap-1 text-caption font-semibold text-[#0F766E] hover:underline"
                  >
                    <Plus size={10} /> Add Drug
                  </button>
                </div>
                <div className="flex flex-col gap-1.5">
                  {formMeds.map((med, i) => (
                    <div key={i} className="flex flex-col gap-1">
                      {/* Main drug row — every field wide enough to read in full; wraps on phones */}
                      <div>
                      <div className="grid gap-1 items-center grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1fr)_20px] sm:grid-cols-[minmax(0,1fr)_80px_190px_120px_20px]">
                        <div className="col-span-4 sm:col-span-1 min-w-0">
                        <DrugNameInput
                          value={med.drugName}
                          onChange={(name, defaultDose) => {
                            const n = [...formMeds];
                            n[i] = { ...n[i], drugName: name, ...(defaultDose ? { dosage: defaultDose } : {}) };
                            setFormMeds(n);
                          }}
                          className={inp}
                        />
                        </div>
                        <OptionsInput
                          value={med.dosage}
                          onChange={(v) => { const n = [...formMeds]; n[i] = { ...n[i], dosage: v }; setFormMeds(n); }}
                          options={DOSE_OPTIONS}
                          placeholder="Dose"
                          className={inp}
                        />
                        <OptionsInput
                          value={med.frequency}
                          onChange={(v) => { const n = [...formMeds]; n[i] = { ...n[i], frequency: v }; setFormMeds(n); }}
                          options={FREQUENCY_OPTIONS}
                          placeholder="Frequency"
                          className={inp}
                        />
                        <OptionsInput
                          value={med.duration}
                          onChange={(v) => { const n = [...formMeds]; n[i] = { ...n[i], duration: v }; setFormMeds(n); }}
                          options={DURATION_OPTIONS}
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
                      </div>{/* /drug row */}

                      {/* Tapering toggle */}
                      <div className="pl-1">
                        <label className="flex items-center gap-1.5 cursor-pointer w-fit">
                          <input
                            type="checkbox"
                            checked={med.taperLevels.length > 0}
                            onChange={(e) => {
                              const n = [...formMeds];
                              n[i] = { ...n[i], taperLevels: e.target.checked ? [blankTaper()] : [] };
                              setFormMeds(n);
                            }}
                            className="accent-[var(--color-primary-600)] w-3 h-3 rounded"
                          />
                          <span className="text-caption font-medium text-[var(--color-ink-500)]">Tapering dose</span>
                        </label>
                      </div>

                      {/* Tapering levels */}
                      {med.taperLevels.map((level, li) => (
                        <div key={li} className="pl-4 border-l-2 border-[var(--color-primary-300)]" style={{ marginLeft: `${li * 10 + 4}px` }}>
                          <p className="text-micro font-bold uppercase tracking-widest text-[var(--color-primary-600)] mb-1">
                            ↓ Taper{med.taperLevels.length > 1 ? ` ${li + 1}` : ""}
                          </p>
                          <div className="overflow-x-auto">
                          <div className="grid gap-1 items-center min-w-[390px]" style={{ gridTemplateColumns: "80px 130px 50px 80px auto" }}>
                            <OptionsInput
                              value={level.dose}
                              onChange={(v) => {
                                const n = [...formMeds]; const t = [...n[i].taperLevels]; t[li] = { ...t[li], dose: v }; n[i] = { ...n[i], taperLevels: t }; setFormMeds(n);
                              }}
                              options={DOSE_OPTIONS}
                              placeholder="Dose"
                              className={inp}
                            />
                            <select
                              value={level.frequency}
                              onChange={(e) => {
                                const n = [...formMeds]; const t = [...n[i].taperLevels]; t[li] = { ...t[li], frequency: e.target.value }; n[i] = { ...n[i], taperLevels: t }; setFormMeds(n);
                              }}
                              className={inp}
                            >
                              <option value="">Frequency</option>
                              {FREQUENCY_OPTIONS.map((f) => <option key={f}>{f}</option>)}
                            </select>
                            <select
                              value={level.durationNum}
                              onChange={(e) => {
                                const n = [...formMeds]; const t = [...n[i].taperLevels]; t[li] = { ...t[li], durationNum: e.target.value }; n[i] = { ...n[i], taperLevels: t }; setFormMeds(n);
                              }}
                              className={inp}
                            >
                              <option value="">—</option>
                              {Array.from({ length: 12 }, (_, k) => k + 1).map((v) => <option key={v} value={String(v)}>{v}</option>)}
                            </select>
                            <select
                              value={level.durationUnit}
                              onChange={(e) => {
                                const n = [...formMeds]; const t = [...n[i].taperLevels]; t[li] = { ...t[li], durationUnit: e.target.value }; n[i] = { ...n[i], taperLevels: t }; setFormMeds(n);
                              }}
                              className={inp}
                            >
                              {["days", "weeks", "months"].map((u) => <option key={u}>{u}</option>)}
                            </select>
                            {/* Add next level */}
                            {li === med.taperLevels.length - 1 && li < 4 && (
                              <label className="flex items-center gap-1 cursor-pointer whitespace-nowrap">
                                <input
                                  type="checkbox"
                                  checked={false}
                                  onChange={(e) => {
                                    if (!e.target.checked) return;
                                    const n = [...formMeds]; n[i] = { ...n[i], taperLevels: [...n[i].taperLevels, blankTaper()] }; setFormMeds(n);
                                  }}
                                  className="accent-[var(--color-primary-600)] w-3 h-3"
                                />
                                <span className="text-caption text-[var(--color-ink-500)]">+ Taper</span>
                              </label>
                            )}
                            {li < med.taperLevels.length - 1 && (
                              <button type="button" onClick={() => {
                                const n = [...formMeds]; n[i] = { ...n[i], taperLevels: n[i].taperLevels.filter((_, k) => k <= li) }; setFormMeds(n);
                              }} className="text-[var(--color-ink-300)] hover:text-red-500 transition-colors">
                                <X size={11} />
                              </button>
                            )}
                          </div>
                          </div>{/* /overflow-x-auto taper row */}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Follow-up */}
              <div>
                <label className="text-caption font-semibold text-[var(--color-ink-400)] uppercase tracking-wide block mb-1">Follow-up Days</label>
                <input type="number" min="1" value={formFollowUp} onChange={(e) => setFormFollowUp(e.target.value)} placeholder="e.g. 7" className={inp} />
              </div>

              {/* Investigations */}
              <div>
                <label className="text-caption font-semibold text-[var(--color-ink-400)] uppercase tracking-wide block mb-1">Investigations</label>
                <div className="flex flex-col gap-1">
                  {formInvestigations.map((inv, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0F766E]/50 shrink-0" />
                      {editingInvIndex === i ? (
                        <input
                          autoFocus
                          value={inv}
                          onChange={(e) => {
                            const next = [...formInvestigations];
                            next[i] = e.target.value;
                            setFormInvestigations(next);
                          }}
                          onBlur={() => setEditingInvIndex(null)}
                          onKeyDown={(e) => { if (e.key === "Enter") setEditingInvIndex(null); }}
                          className="flex-1 min-w-0 text-xs bg-transparent outline-none border-b border-[#0F766E]"
                        />
                      ) : (
                        <span className="flex-1 min-w-0 text-xs text-[var(--color-ink-700)] truncate">{inv}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setEditingInvIndex(i)}
                        className="shrink-0 p-1 rounded-lg text-[var(--color-ink-400)] hover:text-[#0F766E] hover:bg-[#DCF3F1] transition-colors"
                        title="Edit investigation"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormInvestigations(formInvestigations.filter((_, j) => j !== i));
                          setEditingInvIndex(null);
                        }}
                        className="shrink-0 p-1 rounded-lg text-[var(--color-ink-400)] hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Remove investigation"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                  {formInvestigations.length === 0 && (
                    <p className="text-caption text-[var(--color-ink-300)] italic px-0.5">No investigations added.</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowInvPicker(true)}
                  className="mt-1.5 flex items-center gap-1 text-caption font-semibold text-[#0F766E] hover:underline"
                >
                  <Plus size={10} /> Add
                </button>
              </div>

              {/* Advice */}
              <div>
                <label className="text-caption font-semibold text-[var(--color-ink-400)] uppercase tracking-wide block mb-1">Advice (optional)</label>
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
              className="px-4 py-2 rounded-xl border border-[var(--color-border)] text-label sm:text-sm font-medium text-[var(--color-ink-500)] hover:bg-[var(--color-surface-sunken)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={selected.size === 0 || applying}
              onClick={() => onApply(selectedPresets)}
              className="px-5 py-2 rounded-xl bg-[#0F766E] text-white text-label sm:text-sm font-semibold hover:bg-[#0D6862] transition-colors disabled:opacity-40 flex items-center gap-2"
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

      {/* Investigation picker — same catalog as the Investigations tab */}
      {showInvPicker && (
        <InvestigationPickerModal
          existing={formInvestigations}
          onAdd={(names) => {
            setFormInvestigations((prev) => [...prev, ...names.filter((n) => !prev.includes(n))]);
            setShowInvPicker(false);
          }}
          onClose={() => setShowInvPicker(false)}
        />
      )}
    </div>
  );
}

/* ── Investigation picker modal ────────────────────────────────────────────
   Reuses INV_CATALOG (the same data source as the Investigations tab) so
   protocol investigations stay in sync with the actual test catalog.       */
function InvestigationPickerModal({
  existing,
  onAdd,
  onClose,
}: {
  existing: string[];
  onAdd: (names: string[]) => void;
  onClose: () => void;
}) {
  // Custom tests added in the Investigations tab ("+ Add Test"), from the same
  // browser library that tab reads. Ones outside a catalog category go under
  // "Other", as they do there.
  const [customTests] = useState<{ name: string; category: string }[]>(() => {
    try {
      const stored: { name: string; category: string }[] = JSON.parse(localStorage.getItem("ppms_inv_favorites") ?? "[]");
      return stored.filter((t) => t?.name && !Object.values(INV_CATALOG).flat().some((i) => i.name === t.name));
    } catch { return []; }
  });
  const inCatalogCategory = (t: { category: string }) => Object.keys(INV_CATALOG).includes(t.category);
  const categories = [
    ...Object.keys(INV_CATALOG),
    ...(customTests.some((t) => !inCatalogCategory(t)) ? ["Other"] : []),
  ];
  const [activeCategory, setActiveCategory] = useState(categories[0]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  const toggle = (name: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  const allItems: { name: string; isCustom?: boolean }[] = [
    ...Object.values(INV_CATALOG).flat(),
    ...customTests.map((t) => ({ name: t.name, isCustom: true })),
  ];
  const items: { name: string; isCustom?: boolean }[] = query.trim()
    ? allItems.filter((i) => i.name.toLowerCase().includes(query.toLowerCase()))
    : [
        ...(INV_CATALOG[activeCategory] ?? []),
        ...customTests
          .filter((t) => (activeCategory === "Other" ? !inCatalogCategory(t) : t.category === activeCategory))
          .map((t) => ({ name: t.name, isCustom: true })),
      ];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        style={{ background: "var(--color-surface)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-5 py-4 flex items-center justify-between shrink-0"
          style={{ background: "linear-gradient(135deg, #0F766E 0%, #0D9488 100%)" }}
        >
          <p className="text-label sm:text-sm font-semibold text-white">Add Investigation</p>
          <button type="button" onClick={onClose} className="text-white/60 hover:text-white p-1">
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pt-4 pb-2 shrink-0">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search investigations…"
              className="w-full rounded-lg border border-[var(--color-border)] pl-8 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#0F766E] focus:border-[#0F766E]"
            />
          </div>
        </div>

        {/* Category tabs (hidden while searching) */}
        {!query.trim() && (
          <div className="flex overflow-x-auto scrollbar-thin border-b border-[var(--color-border)] shrink-0">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-2 text-xs whitespace-nowrap transition-colors border-b-2 ${
                  activeCategory === cat
                    ? "border-[#0F766E] text-[#0F766E] font-semibold bg-[#EEF8F7]"
                    : "border-transparent text-[var(--color-ink-500)] font-medium hover:text-[var(--color-ink-700)]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Test list */}
        <div className="p-4 flex flex-col gap-1.5 overflow-y-auto">
          {items.map((item) => {
            const checked = selected.has(item.name);
            const alreadyAdded = existing.includes(item.name);
            return (
              <label
                key={item.name}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                  alreadyAdded
                    ? "border-[var(--color-border)] bg-[var(--color-surface-sunken)] text-[var(--color-ink-300)] cursor-not-allowed"
                    : checked
                    ? "border-[#B2DEDA] bg-[#EEF8F7] text-[var(--color-ink-800)]"
                    : "border-[var(--color-border)] text-[var(--color-ink-700)] hover:border-[#B2DEDA] hover:bg-[#EEF8F7]/40"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked || alreadyAdded}
                  disabled={alreadyAdded}
                  onChange={() => toggle(item.name)}
                  className="accent-[#0F766E]"
                />
                {item.name}
                {item.isCustom && !alreadyAdded && (
                  <span className="ml-auto text-caption font-medium px-1.5 py-0.5 rounded-full bg-[#EEF8F7] text-[#0F766E] border border-[#B2DEDA] shrink-0">
                    Custom
                  </span>
                )}
                {alreadyAdded && <span className="ml-auto text-caption italic">Added</span>}
              </label>
            );
          })}
          {items.length === 0 && (
            <p className="text-xs text-[var(--color-ink-400)] text-center py-6">No matching investigations.</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[var(--color-border)] flex items-center justify-between gap-3 shrink-0">
          <span className="text-xs text-[var(--color-ink-400)]">{selected.size} selected</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl border border-[var(--color-border)] text-xs font-medium text-[var(--color-ink-500)] hover:bg-[var(--color-surface-sunken)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={selected.size === 0}
              onClick={() => onAdd([...selected])}
              className="px-4 py-1.5 rounded-xl bg-[#0F766E] text-white text-xs font-semibold hover:bg-[#0D6862] disabled:opacity-40 transition-colors"
            >
              Add {selected.size > 0 ? selected.size : ""}
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

export function ProtocolPromptCard({
  diagnosisDesc,
  onConfirm,
  onDismiss,
}: {
  diagnosisDesc: string;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-primary-100)] bg-[var(--color-primary-50)]/70 pl-2 pr-1.5 py-1 flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
      <span className="w-5 h-5 rounded-full bg-[var(--color-primary-600)] flex items-center justify-center shrink-0">
        <Stethoscope size={10} className="text-white" />
      </span>
      <p className="flex-1 min-w-0 truncate text-xs text-[var(--color-primary-800)]">
        Do you wish to apply <span className="font-semibold">{diagnosisDesc}</span> protocol?
      </p>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onDismiss}
          className="text-caption font-medium px-2.5 py-0.5 rounded-full text-[var(--color-ink-500)] hover:bg-white transition-colors"
        >
          No
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="text-caption font-semibold px-2.5 py-0.5 rounded-full bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] transition-colors"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}

/* ── PlanTab ─────────────────────────────────────────────────────────────── */

export function PlanTab({ visit, udid, patientSex, priorVisits = [], readOnly = false }: { visit: any; udid: string; patientSex: string; priorVisits?: any[]; readOnly?: boolean }) {
  const [presetMatches, setPresetMatches]   = useState<PresetMatch[]>([]);
  const [appliedPresets, setAppliedPresets] = useState<AppliedPreset[]>([]);
  const [dismissedIds, setDismissedIds]     = useState<string[]>([]);
  const [toastNames, setToastNames]         = useState<string[]>([]);
  const [applying, startApply]              = useTransition();
  const [pendingDiagPrompts, setPendingDiagPrompts] = useState<{ diagnosisDesc: string; laterality?: string; matches: PresetMatch[] }[]>([]);
  const [activeDialogDiag, setActiveDialogDiag]     = useState<{ diagnosisDesc: string; laterality?: string; matches: PresetMatch[]; isChanging: boolean } | null>(null);
  const [adviseNotes, setAdviseNotes]       = useState<string>(visit.adviseNotes ?? "");
  const { savePaused } = useEMRSaveContext();
  useAutoSave(adviseNotes, (notes) => saveAdviseNotes(visit.id, udid, notes), undefined, { flushOnUnmount: true, paused: savePaused || readOnly });

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

    // Suppress prompt if all preset meds for this diagnosis are already in the visit (DB source of truth)
    const existingDrugNames = new Set(
      (visit.medications ?? []).map((m: any) => m.drugName.toLowerCase())
    );

    // ALL diagnoses get a prompt card — unless already applied, dismissed, or meds already present
    const pending = diagnoses
      .filter((d) => {
        if (appliedDiagDescs.has(d.description))   return false;
        if (dismissedDiagDescs.has(d.description)) return false;
        const diagMatches = matchesByDesc[d.description] ?? [];
        if (diagMatches.length > 0) {
          const allDrugs = diagMatches.flatMap((m) => m.preset.medications.map((med) => med.drugName.toLowerCase()));
          if (allDrugs.length > 0 && allDrugs.every((drug) => existingDrugNames.has(drug))) return false;
        }
        return true;
      })
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
      saveCustomMedication({ name: med.drugName, defaultDose: med.dosage });
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
        // saveFollowUp writes `data.inViewOf ?? null`, so omitting this wipes
        // any "In view of" text the doctor already entered.
        inViewOf:        visit.inViewOf ?? null,
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

  // Share the pending prompts with the Assessment tab; its Confirm / No run these same handlers.
  const promptHandlers = useRef({
    confirm: (diag: { diagnosisDesc: string; laterality?: string; matches: PresetMatch[] }) => setActiveDialogDiag({ ...diag, isChanging: false }),
    dismiss: handleDismissPrompt,
  });
  promptHandlers.current.dismiss = handleDismissPrompt;
  useEffect(() => {
    publishProtocolPrompts({
      prompts: readOnly ? [] : pendingDiagPrompts,
      confirm: (p) => promptHandlers.current.confirm(p),
      dismiss: (desc, matches) => promptHandlers.current.dismiss(desc, matches),
    });
  }, [pendingDiagPrompts, readOnly]);
  useEffect(() => () => publishProtocolPrompts(null), []);

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
        defaultLaterality={diagLaterality}
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
        readOnly={readOnly}
      />
      <AdviseNotesCard visit={visit} priorVisits={priorVisits} adviseNotes={adviseNotes} onAdviseChange={setAdviseNotes} readOnly={readOnly} />
      <MinorProcedureCard visit={visit} udid={udid} priorVisits={priorVisits} readOnly={readOnly} />
      <DispositionCard visit={visit} udid={udid} patientSex={patientSex} priorVisits={priorVisits} readOnly={readOnly} />

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

// Default keywords for Minor Procedure notes; "+ Keyword" adds the doctor's own.
const MED_INSTRUCTION_KEYWORDS = [
  "Shake well before use",
  "Wait 5 minutes between drops",
  "At bedtime",
  "After meals",
  "Before meals",
  "Keep refrigerated",
] as const;

const PROCEDURE_NOTE_KEYWORDS = [
  "Procedure uneventful", "Patient tolerated well", "No complications",
  "Informed consent taken", "Asepsis maintained", "Haemostasis achieved",
  "Specimen sent for HPE", "Antibiotic ointment applied", "Pad and bandage applied",
  "Review after 1 week",
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

// Legacy per-doctor key retained only so existing saved procedures can be
// folded into the universal browser library.
const procKwKey = (doctorId: string) => `proc_custom_${doctorId}`;

const ANESTHESIA_LIBRARY_KEY = "ppms_custom_anesthesia_v1";

function getCustomAnesthesia(): string[] {
  try { return JSON.parse(localStorage.getItem(ANESTHESIA_LIBRARY_KEY) ?? "[]"); } catch { return []; }
}

function saveCustomAnesthesia(value: string): string[] {
  const trimmed = value.trim();
  const current = getCustomAnesthesia();
  if (!trimmed || ANESTHESIA_KEYWORDS.some((item) => item.toLowerCase() === trimmed.toLowerCase()) || current.some((item) => item.toLowerCase() === trimmed.toLowerCase())) return current;
  const next = [...current, trimmed];
  localStorage.setItem(ANESTHESIA_LIBRARY_KEY, JSON.stringify(next));
  return next;
}

function parseProcedureList(raw: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((s): s is string => typeof s === "string");
  } catch {}
  return [raw];
}

function AdviseNotesCard({ visit, priorVisits, adviseNotes, onAdviseChange, readOnly = false }: { visit: any; priorVisits: any[]; adviseNotes: string; onAdviseChange: (notes: string) => void; readOnly?: boolean }) {
  const overview = useEmrOverview();
  // Starts closed unless this visit already has advise notes.
  const [open, setOpen] = useState(() => !!adviseNotes.trim());
  const [showHistory, setShowHistory] = useState(false);
  const previous = priorVisits.filter((v) => v.id !== visit.id && v.adviseNotes);

  return (
    <div {...(overview && !adviseNotes.trim() ? { "data-overview-empty-section": "" } : {})}>
    <Card>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 text-left flex-1 min-w-0"
        >
          <p className="text-label sm:text-sm font-medium text-[var(--color-ink-700)]">Advise Notes</p>
          <ChevronDown size={14} className={`text-[var(--color-ink-400)] transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
        </button>
        {open && !readOnly && (
          <button
            data-overview-hide
            onClick={() => setShowHistory((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors shrink-0 ${
              showHistory
                ? "bg-[var(--color-primary-50)] border-[var(--color-primary-300)] text-[var(--color-primary-700)]"
                : "border-[var(--color-border)] text-[var(--color-ink-500)] hover:text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]"
            }`}
          >
            <History size={12} /> History
          </button>
        )}
      </div>
      {open && <div className="mt-3">

      <KeywordTextarea
        fieldKey="plan_advise_notes"
        builtIns={ALL_ADVISE_KEYWORDS}
        showControls={!readOnly}
        disabled={readOnly}
        value={adviseNotes}
        onChange={onAdviseChange}
        placeholder="Type advise notes or use keywords…"
        rows={3}
        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3 py-2 text-sm text-[var(--color-ink-800)] placeholder:text-[var(--color-ink-300)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-transparent"
      />

      {showHistory && (
        <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-white shadow-sm overflow-hidden">
          <div className="px-3 py-2 bg-[var(--color-surface-sunken)] border-b border-[var(--color-border)] flex items-center justify-between">
            <span className="text-caption font-bold text-[var(--color-ink-400)] uppercase tracking-widest">Previous Advise Notes</span>
            <button onClick={() => setShowHistory(false)} className="text-[var(--color-ink-300)] hover:text-[var(--color-ink-700)]"><X size={12} /></button>
          </div>
          <div className="max-h-56 overflow-y-auto divide-y divide-[var(--color-border)]">
            {previous.length === 0 ? (
              <p className="px-3 py-4 text-xs text-[var(--color-ink-400)] text-center">No previous advise notes found.</p>
            ) : (
              previous.map((v) => (
                <div key={v.id} className="px-3 py-2.5">
                  <p className="text-caption font-semibold text-[var(--color-ink-400)] mb-1">
                    {new Date(v.date).toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                  <p className="text-xs text-[var(--color-ink-700)] whitespace-pre-wrap leading-relaxed">{v.adviseNotes}</p>
                  <button
                    onClick={() => { onAdviseChange(v.adviseNotes); setShowHistory(false); }}
                    className="mt-1.5 text-caption font-medium text-[var(--color-primary-600)] hover:underline"
                  >
                    Use this
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      </div>}
    </Card>
    </div>
  );
}

function MinorProcedureCard({ visit, udid, priorVisits, readOnly = false }: { visit: any; udid: string; priorVisits: any[]; readOnly?: boolean }) {
  const overview = useEmrOverview();
  // Starts closed unless a procedure, its notes or the anesthesia are already saved.
  const [open,           setOpen]           = useState(() => !!(visit.procedureName?.trim() || visit.procedureNotes?.trim() || visit.anesthesiaType?.trim()));
  const [laterality,     setLaterality]     = useState<string>(visit.procedureLaterality ?? "OU");
  const [anesthesia,     setAnesthesia]     = useState<string>(visit.anesthesiaType ?? "");
  const [customAnesthesia, setCustomAnesthesia] = useState<string[]>(() => typeof window === "undefined" ? [] : getCustomAnesthesia());
  const [showHistory,    setShowHistory]    = useState(false);
  const [anesthesiaOpen, setAnesthesiaOpen] = useState(false);

  // Input IS the procedure — auto-saved directly, no separate add step
  const [procInput, setProcInput]   = useState<string>(() => {
    const list = parseProcedureList(visit.procedureName ?? "");
    return list.length > 1 ? list.map((item) => `• ${item}`).join("\n") : (list[0] ?? "");
  });
  const [procNotes, setProcNotes]   = useState<string>(visit.procedureNotes ?? "");

  // Existing per-doctor terms are migrated into one browser-wide library.
  const doctorId: string = visit.doctorId ?? "";
  const legacyProcedureKwKeys = useMemo(() => [procKwKey(doctorId)], [doctorId]);

  const { savePaused: minorProcSavePaused } = useEMRSaveContext();
  useAutoSave(laterality, (val) => saveProcedureLaterality(visit.id, udid, val), undefined, { flushOnUnmount: true, paused: minorProcSavePaused || readOnly });
  useAutoSave(anesthesia, (val) => saveAnesthesiaType(visit.id, udid, val),        undefined, { flushOnUnmount: true, paused: minorProcSavePaused || readOnly });
  useAutoSave(procInput,  (val) => saveProcedureName(visit.id, udid, val),         undefined, { flushOnUnmount: true, paused: minorProcSavePaused || readOnly });
  useAutoSave(procNotes,  (val) => saveProcedureNotes(visit.id, udid, val),        undefined, { flushOnUnmount: true, paused: minorProcSavePaused || readOnly });

  const filteredAnesthesia = [...ANESTHESIA_KEYWORDS, ...customAnesthesia].filter((kw) =>
    anesthesia.trim() === "" || kw.toLowerCase().includes(anesthesia.toLowerCase())
  );

  const historyBtnCls = `flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
    showHistory
      ? "bg-[var(--color-primary-50)] border-[var(--color-primary-300)] text-[var(--color-primary-700)]"
      : "border-[var(--color-border)] text-[var(--color-ink-500)] hover:text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]"
  }`;

  const procIsEmpty = !procInput.trim() && !anesthesia.trim() && !procNotes.trim();

  return (
    <div {...(overview && procIsEmpty ? { "data-overview-empty-section": "" } : {})}>
    <Card>
      {/* Heading row */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 text-left flex-1 min-w-0"
        >
          <p className="text-label sm:text-sm font-medium text-[var(--color-ink-700)]">Minor Procedure</p>
          <ChevronDown size={14} className={`text-[var(--color-ink-400)] transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <button data-overview-hide onClick={() => setShowHistory((v) => !v)} className={`${historyBtnCls} shrink-0`}>
            <History size={12} /> History
          </button>
        )}
      </div>
      {open && <div className="mt-4">

      {/* Laterality | Procedure | Anesthesia */}
      <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr] gap-3 items-start">

        {/* Laterality */}
        <div className="shrink-0">
          <label className="text-caption font-semibold text-[var(--color-ink-500)] uppercase tracking-wide block mb-1.5">
            Laterality
          </label>
          <div className="flex gap-1">
            {(["RE", "LE", "OU"] as const).map((lat) => (
              <button
                key={lat}
                onClick={() => { if (!readOnly) setLaterality(lat); }}
                disabled={readOnly}
                className={`w-10 py-2 rounded-lg border text-xs font-bold transition-colors ${
                  laterality === lat
                    ? "bg-[var(--color-primary-600)] border-[var(--color-primary-600)] text-white"
                    : "border-[var(--color-border)] text-[var(--color-ink-500)] hover:border-[var(--color-primary-300)] hover:text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)]"
                }${readOnly ? " opacity-60 cursor-default" : ""}`}
              >
                {lat}
              </button>
            ))}
          </div>
        </div>

        {/* Procedure keywords */}
        <div className="min-w-0">
          <label className="text-caption font-semibold text-[var(--color-ink-500)] uppercase tracking-wide block mb-1.5">
            Procedure
          </label>
          <KeywordTextarea
            fieldKey="minor_procedure"
            legacyKeys={legacyProcedureKwKeys}
            builtIns={PROCEDURE_KEYWORDS}
            value={procInput}
            onChange={setProcInput}
            disabled={readOnly}
            rows={1}
            showControls={false}
            placeholder="Select a keyword below or type a procedure…"
            className="w-full min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3 py-2 text-sm text-[var(--color-ink-800)] placeholder:text-[var(--color-ink-300)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-transparent"
          />
        </div>

        {/* Anesthesia */}
        <div className="min-w-0 relative">
          <label className="text-caption font-semibold text-[var(--color-ink-500)] uppercase tracking-wide block mb-1.5">
            Type of Anesthesia
          </label>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-300)] pointer-events-none" />
            <input
              value={anesthesia}
              onChange={(e) => { if (!readOnly) { setAnesthesia(e.target.value); setAnesthesiaOpen(true); } }}
              onFocus={() => { if (!readOnly) setAnesthesiaOpen(true); }}
              onBlur={() => {
                if (!readOnly) setCustomAnesthesia(saveCustomAnesthesia(anesthesia));
                setTimeout(() => setAnesthesiaOpen(false), 150);
              }}
              readOnly={readOnly}
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
                  className={`w-full text-left px-3 py-2.5 text-label sm:text-sm transition-colors flex items-center justify-between gap-2 ${
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

        {/* Original full-width quick-add arrangement — hidden when readOnly */}
        {!readOnly && (
          <div data-overview-hide className="mt-3">
            <p className="mb-2 text-caption font-semibold uppercase tracking-wide text-[var(--color-ink-400)]">Quick Add</p>
            <KeywordTextareaControlsRow
              fieldKey="minor_procedure"
              legacyKeys={legacyProcedureKwKeys}
              builtIns={PROCEDURE_KEYWORDS}
              value={procInput}
              onChange={setProcInput}
            />
          </div>
        )}

        {/* Procedure Notes */}
      <div className="mt-3">
        <label className="text-caption font-semibold text-[var(--color-ink-500)] uppercase tracking-wide block mb-1.5">
          Procedure Notes
        </label>
        <KeywordTextarea
          fieldKey="minor_procedure_notes"
          builtIns={PROCEDURE_NOTE_KEYWORDS}
          showControls={!readOnly}
          value={procNotes}
          onChange={setProcNotes}
          placeholder="Add notes about the procedure…"
          rows={3}
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3 py-2 text-sm text-[var(--color-ink-800)] placeholder:text-[var(--color-ink-300)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-transparent"
        />
      </div>

      {/* History panel */}
      {showHistory && (
        <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-white shadow-sm overflow-hidden">
          <div className="px-3 py-2 bg-[var(--color-surface-sunken)] border-b border-[var(--color-border)] flex items-center justify-between">
            <span className="text-caption font-bold text-[var(--color-ink-400)] uppercase tracking-widest">Previous Procedures</span>
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
                        <p className="text-caption font-semibold text-[var(--color-ink-400)] mb-1">
                          {new Date(v.date).toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "short", year: "numeric" })}
                          {v.procedureLaterality && <span className="ml-1.5 font-bold text-[var(--color-primary-600)]">{v.procedureLaterality}</span>}
                        </p>
                        {(priorProcs.length > 0 || v.procedureName) && (
                          <div className="mb-0.5">
                            <span className="text-micro font-bold uppercase tracking-wide text-[var(--color-ink-300)]">Procedure</span>
                            {priorProcs.length > 0
                              ? priorProcs.map((p, i) => <p key={i} className="text-xs font-medium text-[var(--color-ink-700)]">{p}</p>)
                              : <p className="text-xs font-medium text-[var(--color-ink-700)]">{v.procedureName}</p>
                            }
                          </div>
                        )}
                        {v.anesthesiaType && (
                          <div className="mb-0.5">
                            <span className="text-micro font-bold uppercase tracking-wide text-[var(--color-ink-300)]">Anesthesia</span>
                            <p className="text-xs text-[var(--color-ink-600)]">{v.anesthesiaType}</p>
                          </div>
                        )}
                        {v.procedureNotes && (
                          <div>
                            <span className="text-micro font-bold uppercase tracking-wide text-[var(--color-ink-300)]">Notes</span>
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
                        className="shrink-0 text-caption font-medium text-[var(--color-primary-600)] hover:underline"
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
      </div>}
    </Card>
    </div>
  );
}

const ROUTE_OPTIONS = ["Topical", "Oral", "IM", "IV", "Subconjunctival", "Intravitreal", "Subtenon"];
// Systemic routes carry no eye; every other route is given a laterality.
const NO_LATERALITY_ROUTES = ["Oral", "IV", "IM"];
const routeHasLaterality = (r: string | null | undefined) => !!r && !NO_LATERALITY_ROUTES.includes(r);

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
const ALL_ADVISE_KEYWORDS = ADVISE_KEYWORDS.flatMap((group) => group.items);

type TaperLevel = { dose: string; frequency: string; durationNum: string; durationUnit: string };

const blankTaper = (): TaperLevel => ({ dose: "", frequency: "", durationNum: "", durationUnit: "days" });

function formatTaperSteps(levels: TaperLevel[]): string[] {
  return levels
    .filter((l) => l.frequency && l.durationNum)
    .map((l) => `${l.dose.trim() ? `${l.dose.trim()} · ` : ""}${l.frequency} × ${l.durationNum} ${l.durationUnit}`);
}

function parseTaperSteps(text: string): TaperLevel[] {
  return text.split(" → ").flatMap((step) => {
    const m = step.match(/^(?:(.+?) · )?(.*?) × (\d+) (days|weeks|months|years)$/);
    return m ? [{ dose: m[1] ?? "", frequency: m[2], durationNum: m[3], durationUnit: m[4] }] : [];
  });
}

// Taper steps live in instructions ("Tapering: ...") or, for preset-applied
// drugs, appended to duration (" → Taper: ..."). Unparseable text is left as-is.
function splitTaper(instructions: string | null | undefined, duration: string | null | undefined) {
  const parts = String(instructions ?? "").split(" | ");
  const instrTaper = parts.find((part) => part.startsWith("Tapering: "))?.slice("Tapering: ".length);
  const [baseDuration, presetTaper] = String(duration ?? "").split(" → Taper: ", 2);
  const taperText = instrTaper || presetTaper;
  const taper = taperText ? parseTaperSteps(taperText) : [];
  if (taperText && taper.length === 0) {
    return { note: String(instructions ?? ""), duration: String(duration ?? ""), taper };
  }
  return {
    note: parts.filter((part) => part && !part.startsWith("Tapering: ")).join(" | "),
    duration: baseDuration,
    taper,
  };
}
type EditDraft = { drugName: string; dosage: string; frequency: string; duration: string; instructions: string; route?: string; laterality?: string; taperLevels: TaperLevel[] };

function PrescriptionCard({ visit, udid, priorVisits, defaultLaterality = "OU", toastNames, onCloseToast, pendingDiagPrompts, onConfirmPrompt, onDismissPrompt, appliedByDiag, presetMatches, onRemoveApplied, onChangeProtocol, activeDialogDiag, setActiveDialogDiag, applying, onApplyProtocol, readOnly = false }: { visit: any; udid: string; priorVisits: any[]; defaultLaterality?: string; toastNames: string[]; onCloseToast: () => void; pendingDiagPrompts: { diagnosisDesc: string; laterality?: string; matches: PresetMatch[] }[]; onConfirmPrompt: (diag: { diagnosisDesc: string; laterality?: string; matches: PresetMatch[] }) => void; onDismissPrompt: (desc: string, matches: PresetMatch[]) => void; appliedByDiag: Record<string, any[]>; presetMatches: PresetMatch[]; onRemoveApplied: (desc: string) => void; onChangeProtocol: (desc: string, matches: PresetMatch[]) => void; activeDialogDiag: any; setActiveDialogDiag: (v: any) => void; applying: boolean; onApplyProtocol: (selected: TreatmentPreset[], diagnosisDesc: string, isChanging: boolean) => void; readOnly?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [showPresets, setShowPresets] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>({ drugName: "", dosage: "", frequency: "", duration: "", instructions: "", route: "Topical", laterality: "OU", taperLevels: [] });
  const [clearConfirm, setClearConfirm] = useState(false);

  const [drugName, setDrugName]       = useState("");
  const [dose, setDose]               = useState("");
  const [route, setRoute]             = useState("");
  const [laterality, setLaterality]   = useState(defaultLaterality);
  useEffect(() => { setLaterality(defaultLaterality); }, [defaultLaterality]);
  const [frequency, setFrequency]         = useState("");
  const [durationSel, setDurationSel]     = useState("");
  const [taperLevels, setTaperLevels] = useState<TaperLevel[]>([]);
  const [instructions, setInstructions]   = useState("");

  // Suggested investigations from all applied presets
  /* Each suggested investigation carries the diagnosis (or diagnoses) whose
     treatment preset suggested it. That becomes the "In view of" indication on
     the order, which is otherwise left blank for chip-added tests. A test
     suggested by two diagnoses lists both rather than arbitrarily picking one. */
  const allSuggestedInvs = useMemo(() => {
    const byName = new Map<string, Set<string>>();
    for (const [diagDesc, diagApplied] of Object.entries(appliedByDiag)) {
      for (const a of diagApplied) {
        const preset = presetMatches.find((m) => m.preset.id === a.presetId)?.preset;
        for (const inv of preset?.investigations ?? []) {
          if (!byName.has(inv)) byName.set(inv, new Set());
          if (diagDesc) byName.get(inv)!.add(diagDesc);
        }
      }
    }
    return [...byName.entries()].map(([name, diags]) => ({ name, indication: [...diags].join(", ") }));
  }, [appliedByDiag, presetMatches]);
  // Normalize investigation names the same way as the server action
  const normInv = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();

  // Map of normalizedName → orderId for investigations already in this visit
  const buildInvMap = (orders: any[]) => {
    const map = new Map<string, string>();
    for (const o of orders) map.set(normInv(o.testName as string), o.id as string);
    return map;
  };
  const [invOrderMap, setInvOrderMap] = useState<Map<string, string>>(() => buildInvMap(visit.investigationOrders ?? []));
  useEffect(() => { setInvOrderMap(buildInvMap(visit.investigationOrders ?? [])); }, [visit.investigationOrders]);
  const [, startInvTransition] = useTransition();

  const medications: any[] = visit.medications ?? [];

  const resetDraft = () => {
    setDrugName(""); setDose(""); setRoute(""); setLaterality(defaultLaterality);
    setFrequency(""); setDurationSel("");
    setTaperLevels([]);
    setInstructions("");
  };

  const applyPreset = (drugs: PresetDrug[]) => {
    startTransition(async () => {
      for (const d of drugs) {
        saveCustomMedication({ name: d.drugName, defaultDose: d.dosage });
        await addMedication(visit.id, udid, d);
      }
      setShowPresets(false);
    });
  };

  const startEdit = (m: any) => {
    const split = splitTaper(m.instructions, m.duration);
    setEditingId(m.id);
    setEditDraft({
      drugName: m.drugName ?? "",
      dosage: m.dosage ?? "",
      frequency: m.frequency ?? "",
      duration: split.duration,
      instructions: split.note,
      route: m.route ?? "Topical",
      laterality: m.laterality ?? defaultLaterality,
      taperLevels: split.taper,
    });
  };

  const saveEdit = (id: string) => {
    if (!editDraft.drugName.trim()) return;
    startTransition(async () => {
      saveCustomMedication({ name: editDraft.drugName, route: editDraft.route, defaultDose: editDraft.dosage });
      const tapParts = formatTaperSteps(editDraft.taperLevels);
      const taperNote = tapParts.length ? `Tapering: ${tapParts.join(" → ")}` : "";
      const finalInstructions = [editDraft.instructions.trim(), taperNote].filter(Boolean).join(" | ");
      await updateMedication(id, udid, { drugName: editDraft.drugName.trim(), dosage: editDraft.dosage, frequency: editDraft.frequency, duration: editDraft.duration, instructions: finalInstructions, route: editDraft.route, laterality: routeHasLaterality(editDraft.route) ? editDraft.laterality : undefined });
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
      saveCustomMedication({ name: drugName, route, defaultDose: dose });
      const duration = durationSel;
      const tapParts = formatTaperSteps(taperLevels);
      const tapNote = tapParts.length ? `Tapering: ${tapParts.join(" → ")}` : "";
      const finalInstructions = [instructions, tapNote].filter(Boolean).join(" | ");
      await addMedication(visit.id, udid, { drugName, dosage: dose, frequency, duration, instructions: finalInstructions, route, laterality: routeHasLaterality(route) ? laterality : undefined } as any);
      resetDraft();
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
      {/* Portalled to <body>: the Plan tab is display:none while Confirm is clicked from the Assessment tab */}
      {activeDialogDiag && typeof document !== "undefined" && createPortal(
        <PresetSelectDialog
          matches={activeDialogDiag.matches}
          onApply={(selected) => onApplyProtocol(selected, activeDialogDiag.diagnosisDesc, activeDialogDiag.isChanging)}
          onClose={() => setActiveDialogDiag(null)}
          applying={applying}
        />,
        document.body,
      )}

      <div className={`flex items-center mb-2 gap-2 ${Object.keys(appliedByDiag).length > 0 ? "mt-3" : ""}`}>
        <p className="text-label sm:text-sm font-medium text-[var(--color-ink-700)]">Medications</p>
        {!readOnly && (
          <div data-overview-hide className="flex items-center gap-2 ml-auto shrink-0">
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
        )}
      </div>


      {/* Per-diagnosis protocol prompt cards */}
      {!readOnly && pendingDiagPrompts.length > 0 && (
        <div className="flex flex-col gap-1 mb-2">
          {pendingDiagPrompts.map(({ diagnosisDesc, laterality: diagLat, matches }, i) => (
            <ProtocolPromptCard
              key={`${diagnosisDesc}-${diagLat ?? "none"}-${i}`}
              diagnosisDesc={diagLat ? `${diagnosisDesc} (${diagLat})` : diagnosisDesc}
              onConfirm={() => onConfirmPrompt({ diagnosisDesc, laterality: diagLat, matches })}
              onDismiss={() => onDismissPrompt(diagnosisDesc, matches)}
            />
          ))}
        </div>
      )}

      {showPresets && <PresetPanel onApply={applyPreset} onClose={() => setShowPresets(false)} />}

      {/* Add medication — route first, then the whole row on one line (like Current Medications) */}
      {!readOnly && (
        <div data-overview-hide className="mb-2 flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 flex-wrap md:flex-nowrap">
            <select
              value={route}
              onChange={(e) => setRoute(e.target.value)}
              aria-label="Route"
              className={`${inputCls.replace("w-full ", "")} w-28 shrink-0`}
            >
              <option value="">Route</option>
              {ROUTE_OPTIONS.map((r) => <option key={r}>{r}</option>)}
            </select>
            {route && (
              <>
                {routeHasLaterality(route) && (
                  <select
                    value={laterality}
                    onChange={(e) => setLaterality(e.target.value)}
                    aria-label="Laterality"
                    className={`${inputCls.replace("w-full ", "")} w-16 shrink-0`}
                  >
                    {["RE", "LE", "OU"].map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                )}
                <div className="flex-1 min-w-[260px]">
                  <DrugNameInput
                    value={drugName}
                    onChange={(name, defaultDose) => { setDrugName(name); if (defaultDose && !dose) setDose(defaultDose); }}
                    placeholder="Drug name"
                    className={inputCls}
                  />
                </div>
                <OptionsInput value={dose} onChange={setDose} options={DOSE_OPTIONS} placeholder="Dose" className={`${inputCls} w-20 shrink-0`} />
                <OptionsInput value={frequency} onChange={setFrequency} options={FREQUENCY_OPTIONS} placeholder="Frequency" className={`${inputCls} w-32 shrink-0`} />
                <OptionsInput value={durationSel} onChange={setDurationSel} options={DURATION_OPTIONS} placeholder="Duration" className={`${inputCls} w-24 shrink-0`} />
                <button type="button" onClick={resetDraft} aria-label="Clear" className="shrink-0 text-[var(--color-ink-300)] hover:text-red-500 p-0.5 transition-colors">
                  <X size={13} />
                </button>
              </>
            )}
          </div>
          {route && (
          <>
          {/* Tapering toggle + Instructions on one row; keywords below the box */}
          <div className="flex items-start gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer w-fit shrink-0 pt-2">
              <input
                type="checkbox"
                checked={taperLevels.length > 0}
                onChange={(e) => setTaperLevels(e.target.checked ? [blankTaper()] : [])}
                className="accent-[var(--color-primary-600)] w-3.5 h-3.5 rounded"
              />
              <span className="text-xs font-medium text-[var(--color-ink-600)]">Tapering dose</span>
            </label>
            <div className="flex-1 min-w-0">
              <KeywordInput
                fieldKey="med_instructions"
                value={instructions}
                onChange={setInstructions}
                builtIns={MED_INSTRUCTION_KEYWORDS}
                placeholder="Instructions — e.g. Apply 1 drop in RE at bedtime, shake well before use"
                className={inputCls}
              />
            </div>
          </div>
          {taperLevels.map((level, i) => (
            <div
              key={i}
              className="mb-2 max-w-3xl pl-3 border-l-2 border-[var(--color-primary-300)]"
              style={{ marginLeft: `${i * 14}px` }}
            >
              <p className="text-caption font-bold uppercase tracking-widest text-[var(--color-primary-600)] mb-1.5">
                ↓ Tapering dose{taperLevels.length > 1 ? ` ${i + 1}` : ""}
              </p>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <div>
                  <label className="text-caption font-medium text-[var(--color-ink-400)] uppercase tracking-wide block mb-0.5">Dose</label>
                  <OptionsInput
                    value={level.dose}
                    onChange={(v) => { const n = [...taperLevels]; n[i] = { ...n[i], dose: v }; setTaperLevels(n); }}
                    options={DOSE_OPTIONS}
                    placeholder="Dose"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="text-caption font-medium text-[var(--color-ink-400)] uppercase tracking-wide block mb-0.5">Frequency</label>
                  <select
                    value={level.frequency}
                    onChange={(e) => { const n = [...taperLevels]; n[i] = { ...n[i], frequency: e.target.value }; setTaperLevels(n); }}
                    className={inputCls}
                  >
                    <option value="">Select</option>
                    {FREQUENCY_OPTIONS.map((f) => <option key={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-caption font-medium text-[var(--color-ink-400)] uppercase tracking-wide block mb-0.5">Duration</label>
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
                        ? [...taperLevels.slice(0, i + 1), blankTaper()]
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
          <div className="flex justify-end mt-1.5">
            <button
              onClick={submitDrug}
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary-600)] text-white text-xs font-medium px-3.5 py-1.5 shadow-sm hover:bg-[var(--color-primary-700)] transition-colors disabled:opacity-60"
            >
              <Plus size={12} /> Add to Prescription
            </button>
          </div>
          </>
          )}
        </div>
      )}

      {medications.length === 0 ? (
        <p className="flex items-center gap-1.5 py-1.5 text-caption text-[var(--color-ink-300)]">
          <Pill size={11} className="shrink-0" />
          No medications yet. Choose a route to add one.
        </p>
      ) : (
        // The columns are fixed-width and total ~470px, so on a phone the table
        // scrolls inside its own card rather than pushing the page sideways.
        <div className="mt-1 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm table-fixed">
            <colgroup>
              <col className="w-8" />
              <col />
              <col className="w-24" />
              <col className="w-40" />
              <col className="w-28" />
              <col data-overview-hide className="w-16" />
            </colgroup>
            <tbody>
              {medications.map((m, idx) => {
                const isEditing = editingId === m.id;
                const cellCls = "w-full rounded border border-[var(--color-primary-300)] bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-500)]";
                const view = splitTaper(m.instructions, m.duration);
                return (
                  /* Key belongs on the element `.map()` returns — the fragment.
                     A `<>` shorthand cannot carry one, so each medication row
                     went unkeyed even though the inner <tr> had key={m.id}. */
                  <Fragment key={m.id}>
                    <tr className={`${idx > 0 ? "border-t border-[var(--color-border)]" : ""} ${isEditing ? "bg-[var(--color-primary-50)]" : "group bg-white hover:bg-[var(--color-surface-sunken)] transition-colors"}`}>
                      <td className="pl-1 pr-2 py-2 text-caption font-semibold text-[var(--color-ink-300)] tabular-nums whitespace-nowrap">{idx + 1}</td>

                      {/* Drug Name */}
                      <td className="px-2 py-2">
                        {isEditing ? (
                          <div className="flex flex-col gap-1">
                            <DrugNameInput
                              value={editDraft.drugName}
                              onChange={(name, defaultDose) => setEditDraft({ ...editDraft, drugName: name, ...(defaultDose && !editDraft.dosage ? { dosage: defaultDose } : {}) })}
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
                                <span className={`min-w-[28px] h-5 px-1.5 rounded-md flex items-center justify-center text-micro font-bold shrink-0 ${badge.bg} ${badge.text}`}>
                                  {badge.label}
                                </span>
                              ) : (
                                <div className="w-5 h-5 rounded-md bg-[var(--color-surface-sunken)] flex items-center justify-center shrink-0">
                                  <Pill size={11} className="text-[var(--color-ink-400)]" />
                                </div>
                              );
                            })()}
                            <span className="text-label sm:text-sm font-medium text-[var(--color-ink-900)] break-words">{m.drugName}</span>
                            {m.route && <span className="text-caption text-[var(--color-ink-400)] shrink-0">· {m.route}</span>}
                          </div>
                        )}
                      </td>

                      {/* Dose */}
                      <td className="px-2 py-2">
                        {isEditing ? (
                          <OptionsInput
                            value={editDraft.dosage}
                            onChange={(v) => setEditDraft({ ...editDraft, dosage: v })}
                            options={DOSE_OPTIONS}
                            placeholder="Dose"
                            className={cellCls}
                          />
                        ) : (
                          <span className="text-xs text-[var(--color-ink-600)]">{m.dosage || <span className="text-[var(--color-ink-300)]">—</span>}</span>
                        )}
                      </td>

                      {/* Frequency */}
                      <td className="px-2 py-2">
                        {isEditing ? (
                          <OptionsInput
                            value={editDraft.frequency}
                            onChange={(v) => setEditDraft({ ...editDraft, frequency: v })}
                            options={FREQUENCY_OPTIONS}
                            placeholder="Frequency"
                            className={cellCls}
                          />
                        ) : (
                          <span className="text-xs text-[var(--color-ink-600)]">{m.frequency || <span className="text-[var(--color-ink-300)]">—</span>}</span>
                        )}
                      </td>

                      {/* Duration */}
                      <td className="px-2 py-2">
                        {isEditing ? (
                          <OptionsInput
                            value={editDraft.duration}
                            onChange={(v) => setEditDraft({ ...editDraft, duration: v })}
                            options={DURATION_OPTIONS}
                            placeholder="Duration"
                            className={cellCls}
                          />
                        ) : (
                          <span className="text-xs text-[var(--color-ink-600)]">{view.duration || <span className="text-[var(--color-ink-300)]">—</span>}</span>
                        )}
                      </td>

                      {/* Actions — hidden when readOnly */}
                      <td data-overview-hide className="px-1 py-2">
                        {!readOnly && (
                          <div className={`flex items-center justify-end gap-0.5 ${isEditing ? "" : "opacity-60 group-hover:opacity-100 transition-opacity"}`}>
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
                                  className="p-1 rounded-md text-[var(--color-ink-300)] hover:text-[var(--color-primary-600)] hover:bg-[var(--color-primary-50)] transition-colors"
                                >
                                  <Pencil size={12} />
                                </button>
                                <button
                                  onClick={() => removeMedication(m.id, udid)}
                                  title="Delete"
                                  className="p-1 rounded-md text-[var(--color-ink-300)] hover:text-red-500 hover:bg-red-50 transition-colors"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* Tapering steps, aligned under Dose / Frequency / Duration */}
                    {!isEditing && view.taper.map((t, ti) => (
                      <tr key={`${m.id}-taper-${ti}`}>
                        <td />
                        <td className="px-2 pb-1.5 pt-0">
                          <span className="pl-7 text-micro font-bold uppercase tracking-widest text-[var(--color-primary-600)]">
                            ↓ Taper{view.taper.length > 1 ? ` ${ti + 1}` : ""}
                          </span>
                        </td>
                        <td className="px-2 pb-1.5 pt-0 text-xs text-[var(--color-ink-600)]">{t.dose || <span className="text-[var(--color-ink-300)]">—</span>}</td>
                        <td className="px-2 pb-1.5 pt-0 text-xs text-[var(--color-ink-600)]">{t.frequency}</td>
                        <td className="px-2 pb-1.5 pt-0 text-xs text-[var(--color-ink-600)]">{t.durationNum} {t.durationUnit}</td>
                        <td data-overview-hide />
                      </tr>
                    ))}

                    {/* Instructions sub-row */}
                    {(isEditing || view.note) && (
                      <tr key={`${m.id}-note`} className={isEditing ? "bg-[var(--color-primary-50)]" : ""}>
                        <td />
                        <td colSpan={4} className={`px-2 pt-0 ${isEditing ? "pb-2.5" : "pb-2 pl-9 text-caption text-[var(--color-ink-500)]"}`}>
                          {isEditing ? (
                            <div className="space-y-2">
                              <input
                                value={editDraft.instructions}
                                onChange={(e) => setEditDraft({ ...editDraft, instructions: e.target.value })}
                                placeholder="Instructions (optional)..."
                                className={cellCls + " w-full"}
                              />
                              <label className="flex w-fit cursor-pointer items-center gap-1.5">
                                <input
                                  type="checkbox"
                                  checked={editDraft.taperLevels.length > 0}
                                  onChange={(e) => setEditDraft({
                                    ...editDraft,
                                    taperLevels: e.target.checked ? [blankTaper()] : [],
                                  })}
                                  className="h-3.5 w-3.5 rounded accent-[var(--color-primary-600)]"
                                />
                                <span className="text-xs font-medium text-[var(--color-ink-600)]">Tapering dose</span>
                              </label>
                              {editDraft.taperLevels.map((level, levelIndex) => (
                                <div key={levelIndex} className="border-l-2 border-[var(--color-primary-300)] pl-3">
                                  <p className="mb-1 text-caption font-bold uppercase tracking-widest text-[var(--color-primary-600)]">
                                    ↓ Tapering dose{editDraft.taperLevels.length > 1 ? ` ${levelIndex + 1}` : ""}
                                  </p>
                                  <div className="grid grid-cols-3 gap-2">
                                    <OptionsInput
                                      value={level.dose}
                                      onChange={(v) => {
                                        const levels = [...editDraft.taperLevels];
                                        levels[levelIndex] = { ...level, dose: v };
                                        setEditDraft({ ...editDraft, taperLevels: levels });
                                      }}
                                      options={DOSE_OPTIONS}
                                      placeholder="Dose"
                                      className={cellCls}
                                    />
                                    <select
                                      value={level.frequency}
                                      onChange={(e) => {
                                        const levels = [...editDraft.taperLevels];
                                        levels[levelIndex] = { ...level, frequency: e.target.value };
                                        setEditDraft({ ...editDraft, taperLevels: levels });
                                      }}
                                      className={cellCls}
                                    >
                                      <option value="">Select frequency</option>
                                      {FREQUENCY_OPTIONS.map((option) => <option key={option}>{option}</option>)}
                                    </select>
                                    <div className="flex gap-1">
                                      <select
                                        value={level.durationNum}
                                        onChange={(e) => {
                                          const levels = [...editDraft.taperLevels];
                                          levels[levelIndex] = { ...level, durationNum: e.target.value };
                                          setEditDraft({ ...editDraft, taperLevels: levels });
                                        }}
                                        className={cellCls}
                                      >
                                        <option value="">—</option>
                                        {Array.from({ length: 10 }, (_, numberIndex) => numberIndex + 1).map((number) => (
                                          <option key={number} value={String(number)}>{number}</option>
                                        ))}
                                      </select>
                                      <select
                                        value={level.durationUnit}
                                        onChange={(e) => {
                                          const levels = [...editDraft.taperLevels];
                                          levels[levelIndex] = { ...level, durationUnit: e.target.value };
                                          setEditDraft({ ...editDraft, taperLevels: levels });
                                        }}
                                        className={cellCls}
                                      >
                                        {['days', 'weeks', 'months', 'years'].map((unit) => <option key={unit}>{unit}</option>)}
                                      </select>
                                    </div>
                                  </div>
                                  {levelIndex < 4 && (
                                    <label className="mt-1.5 flex w-fit cursor-pointer items-center gap-1.5">
                                      <input
                                        type="checkbox"
                                        checked={editDraft.taperLevels.length > levelIndex + 1}
                                        onChange={(e) => setEditDraft({
                                          ...editDraft,
                                          taperLevels: e.target.checked
                                            ? [...editDraft.taperLevels.slice(0, levelIndex + 1), blankTaper()]
                                            : editDraft.taperLevels.slice(0, levelIndex + 1),
                                        })}
                                        className="h-3.5 w-3.5 rounded accent-[var(--color-primary-600)]"
                                      />
                                      <span className="text-xs font-medium text-[var(--color-ink-600)]">Tapering dose</span>
                                    </label>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="whitespace-pre-line">{view.note}</span>
                          )}
                        </td>
                        <td />
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {/* ── Suggested Investigations (from applied protocols) ───────────── */}
      {allSuggestedInvs.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
          <p className="text-caption font-bold uppercase tracking-widest text-[#0F766E]/70 mb-2">Suggested Investigations</p>
          <div className="flex flex-wrap gap-1.5">
            {allSuggestedInvs.map(({ name: inv, indication }) => {
              const key   = normInv(inv);
              const added = invOrderMap.has(key);
              return (
                <button
                  key={inv}
                  type="button"
                  disabled={readOnly}
                  onClick={() => {
                    if (readOnly) return;
                    if (added) {
                      const orderId = invOrderMap.get(key)!;
                      setInvOrderMap((prev) => { const m = new Map(prev); m.delete(key); return m; });
                      startInvTransition(async () => { await deleteInvestigationOrder(orderId, udid); });
                    } else {
                      startInvTransition(async () => {
                        await addInvestigationOrder(visit.id, udid, {
                          category: "General",
                          testName: inv,
                          priority: "ROUTINE",
                          // "In view of", editable afterwards on the order card
                          notes: indication || undefined,
                        });
                      });
                      // optimistic: we don't have the id yet, mark with a sentinel
                      setInvOrderMap((prev) => { const m = new Map(prev); m.set(key, "__pending__"); return m; });
                    }
                  }}
                  className={`flex items-center gap-1 text-caption px-2.5 py-0.5 rounded-full border transition-colors ${
                    readOnly
                      ? added
                        ? "bg-[#0F766E] border-[#0F766E] text-white cursor-default opacity-80"
                        : "bg-white border-[#B2DEDA] text-[#0F766E] cursor-default opacity-60"
                      : added
                        ? "bg-[#0F766E] border-[#0F766E] text-white hover:bg-[#0D6862] cursor-pointer"
                        : "bg-white border-[#B2DEDA] text-[#0F766E] hover:bg-[#DCF3F1] hover:border-[#0F766E] cursor-pointer"
                  }`}
                >
                  {added && <Check size={10} />}
                  {inv}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}

function DispositionCard({ visit, udid, patientSex, priorVisits = [], readOnly = false }: { visit: any; udid: string; patientSex: string; priorVisits?: any[]; readOnly?: boolean }) {
  const overview = useEmrOverview();
  // Starts closed unless follow-up or referral details are saved; then it opens
  // with the panels that hold them.
  const [open, setOpen] = useState(() => !!(visit.followUpDate || visit.referralEnabled || visit.inViewOf));
  const [activePanels, setActivePanels] = useState<string[]>(
    [
      (visit.followUpDate || visit.inViewOf) && "follow",
      visit.referralEnabled && "referral",
    ].filter(Boolean) as string[]
  );
  // One panel at a time: opening Referral closes Follow Up Dates and vice versa.
  const togglePanel = (id: string) =>
    setActivePanels((cur) => (cur.includes(id) ? [] : [id]));

  const hasFollowUpData = !!(visit.followUpDate || visit.referralEnabled || visit.inViewOf);
  // In overview with data, auto-open the panels that hold it so the values are visible
  const displayPanels = overview && hasFollowUpData
    ? [...new Set([
        ...activePanels,
        ...(visit.followUpDate || visit.inViewOf ? ["follow"] : []),
        ...(visit.referralEnabled ? ["referral"] : []),
      ])]
    : activePanels;

  return (
    <div {...(overview && !hasFollowUpData ? { "data-overview-empty-section": "" } : {})}>
    <Card>
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center gap-1.5 text-left w-full mb-3">
        <p className="text-label sm:text-sm font-medium text-[var(--color-ink-700)]">Patient Disposition</p>
        <ChevronDown size={14} className={`text-[var(--color-ink-400)] transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && !readOnly && (
        <div data-overview-hide className="flex gap-3 flex-wrap mb-2">
          <DispositionToggle icon={<RefreshCw size={16} />}  label="Follow Up Dates"      active={activePanels.includes("follow")}   onClick={() => togglePanel("follow")} />
          <DispositionToggle icon={<Share2 size={16} />}     label="Referral"             active={activePanels.includes("referral")} onClick={() => togglePanel("referral")} />
        </div>
      )}
      {open && (
        <div className="flex flex-col gap-4">
          {displayPanels.includes("follow") && <FollowUpdatesPanel visit={visit} udid={udid} priorVisits={priorVisits} />}
          {displayPanels.includes("referral") && <ReferralPanel visit={visit} udid={udid} />}
        </div>
      )}
    </Card>
    </div>
  );
}
