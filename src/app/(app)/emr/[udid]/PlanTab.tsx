"use client";

import { useState, useTransition, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { History } from "lucide-react";
import { parseJSON } from "@/lib/json";
import { useAutoSave, SaveIndicator } from "@/lib/useAutoSave";
import { addMedication, removeMedication, saveRefraction } from "./actions";
import { DispositionToggle, AdmitPanel, SurgicalPanel, FollowUpdatesPanel } from "./DispositionPanel";
import { Plus, X, BedDouble, Stethoscope, ChevronDown, Pencil, Trash2, RefreshCw } from "lucide-react";

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

export function PlanTab({ visit, udid, patientSex }: { visit: any; udid: string; patientSex: string }) {
  return (
    <div className="flex flex-col gap-5">
      <PrescriptionCard visit={visit} udid={udid} />
      <OpticalPrescriptionCard visit={visit} udid={udid} />
      <DispositionCard visit={visit} udid={udid} patientSex={patientSex} />
    </div>
  );
}

const QUICK_DRUGS = [
  "Timolol 0.5%", "Latanoprost 0.005%", "Prednisolone 1%",
  "Ciprofloxacin 0.3%", "Tobramycin 0.3%", "Moxifloxacin 0.5%",
  "Sodium hyaluronate", "Carboxymethylcellulose",
];

const FREQUENCY_OPTIONS = [
  "OD (Once daily)", "BD (Twice daily)", "TID (Three times daily)",
  "QID (Four times daily)", "QHS (At bedtime)", "PRN (As needed)",
  "Stat (Immediately)",
];

const ROUTE_OPTIONS = ["Topical", "Oral", "IM", "IV", "Subconjunctival", "Intravitreal", "Subtenon"];

function PrescriptionCard({ visit, udid }: { visit: any; udid: string }) {
  const [pending, startTransition] = useTransition();
  const [showAddDrug, setShowAddDrug] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [drugName, setDrugName]       = useState("");
  const [dose, setDose]               = useState("");
  const [route, setRoute]             = useState("Topical");
  const [frequency, setFrequency]     = useState("");
  const [duration, setDuration]       = useState("");
  const [instructions, setInstructions] = useState("");
  const [rxCount, setRxCount]         = useState(0);

  const medications: any[] = visit.medications ?? [];

  const openWithDrug = (name: string) => {
    setDrugName(name);
    setDose(""); setFrequency(""); setDuration(""); setInstructions("");
    setShowAddDrug(true);
    setRxCount((c) => c + 1);
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
      await addMedication(visit.id, udid, { drugName, dosage: dose, frequency, duration, instructions } as any);
      setDrugName(""); setDose(""); setRoute("Topical"); setFrequency(""); setDuration(""); setInstructions("");
      setShowAddDrug(false);
    });
  };

  const inputCls = "w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]";

  return (
    <Card>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-sm font-medium text-[var(--color-ink-700)]">Prescription / Medications</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPresets((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-white border border-[var(--color-border)] hover:border-[var(--color-primary-500)]"
          >
            <ChevronDown size={13} className={showPresets ? "rotate-180 transition-transform" : "transition-transform"} /> Presets
          </button>
          <button
            onClick={() => { setDrugName(""); setShowAddDrug((v) => !v); setRxCount((c) => c + 1); }}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[var(--color-ink-800)] text-white hover:bg-[var(--color-ink-700)] transition-colors"
          >
            <Plus size={13} /> Add Drug
          </button>
        </div>
      </div>

      {/* Quick drug chips */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {QUICK_DRUGS.map((drug) => (
          <button
            key={drug}
            disabled={pending}
            onClick={() => openWithDrug(drug)}
            className={`px-2.5 py-1 rounded-full text-xs border transition-colors disabled:opacity-40 ${
              drugName === drug && showAddDrug
                ? "border-[var(--color-primary-500)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)] font-medium"
                : "border-[var(--color-border)] bg-white text-[var(--color-ink-600)] hover:border-[var(--color-primary-400)] hover:bg-[var(--color-primary-50)]"
            }`}
          >
            + {drug}
          </button>
        ))}
      </div>

      {showPresets && <PresetPanel onApply={applyPreset} onClose={() => setShowPresets(false)} />}

      {/* Add Drug form */}
      {showAddDrug && (
        <div className="mb-4 p-4 rounded-2xl border border-[var(--color-border)] bg-white">
          <div className="flex items-center justify-between mb-3 max-w-3xl">
            <p className="text-xs font-semibold text-[var(--color-ink-600)]">Rx #{medications.length + 1}</p>
            <button onClick={() => setShowAddDrug(false)} className="text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)]"><X size={14} /></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 max-w-3xl">
            <div className="col-span-2">
              <label className="text-xs text-[var(--color-ink-500)] block mb-1">Drug Name</label>
              <input value={drugName} onChange={(e) => setDrugName(e.target.value)} placeholder="Drug name" className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-[var(--color-ink-500)] block mb-1">Dose</label>
              <input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="e.g. 1 drop" className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-[var(--color-ink-500)] block mb-1">Route</label>
              <select value={route} onChange={(e) => setRoute(e.target.value)} className={inputCls}>
                {ROUTE_OPTIONS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 max-w-3xl">
            <div className="col-span-2">
              <label className="text-xs text-[var(--color-ink-500)] block mb-1">Frequency</label>
              <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className={inputCls}>
                <option value="">— Select —</option>
                {FREQUENCY_OPTIONS.map((f) => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[var(--color-ink-500)] block mb-1">Duration (days)</label>
              <input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 7" className={inputCls} />
            </div>
            <div className="flex flex-col justify-end">
              <button onClick={submitDrug} disabled={pending} className="w-full rounded-xl bg-[var(--color-primary-600)] text-white text-xs font-medium py-2 hover:bg-[var(--color-primary-700)] transition-colors disabled:opacity-60">
                Add to Prescription
              </button>
            </div>
          </div>
          <div className="mb-3 max-w-3xl">
            <label className="text-xs text-[var(--color-ink-500)] block mb-1">Instructions</label>
            <input value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="e.g. Apply 1 drop in RE at bedtime, shake well before use" className={inputCls} />
          </div>
        </div>
      )}

      {medications.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-400)] py-4 text-center">No medications added. Use quick buttons above or &quot;Add Drug&quot;.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {medications.map((m) => (
            <li key={m.id} className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm">
              <span>
                <span className="font-medium text-[var(--color-ink-900)]">{m.drugName}</span>
                {(m.dosage || m.frequency || m.duration) && (
                  <span className="text-[var(--color-ink-400)] ml-2 text-xs">
                    {[m.dosage, m.frequency, m.duration].filter(Boolean).join(" · ")}
                  </span>
                )}
              </span>
              <button onClick={() => removeMedication(m.id, udid)} className="text-[var(--color-ink-400)] hover:text-[var(--color-danger-600)]">
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function OpticalPrescriptionCard({ visit }: { visit: any; udid: string }) {
  const rc = visit.refraction;
  const re = parseJSON(rc?.re, { sph: "", cyl: "", axis: "", nearSph: "" });
  const le = parseJSON(rc?.le, { sph: "", cyl: "", axis: "", nearSph: "" });

  const cell = (value: string) => (
    <td className="px-3 py-2 text-center text-xs text-[var(--color-ink-700)] border border-[var(--color-border)]">
      <span className={value ? "font-mono" : "text-[var(--color-ink-300)]"}>{value || "—"}</span>
    </td>
  );

  const th = (label: string) => (
    <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-500)] border border-[var(--color-border)] bg-[var(--color-surface-sunken)]">
      {label}
    </th>
  );

  const eyeCell = (label: string, color: string) => (
    <td className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-wide border border-[var(--color-border)] ${color}`}>
      {label}
    </td>
  );

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-[var(--color-ink-700)]">Optical Prescription</p>
        <p className="text-[10px] text-[var(--color-ink-400)]">Imported from Refractive Correction</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {th("Eye")}
              {th("SPH")}
              {th("CYL")}
              {th("AXIS")}
              {th("ADD")}
            </tr>
          </thead>
          <tbody>
            <tr>
              {eyeCell("RE", "text-[var(--color-primary-700)] bg-[var(--color-primary-50)]")}
              {cell(re.sph)}
              {cell(re.cyl)}
              {cell(re.axis)}
              {cell(re.nearSph)}
            </tr>
            <tr>
              {eyeCell("LE", "text-[var(--color-primary-700)] bg-[var(--color-primary-50)]")}
              {cell(le.sph)}
              {cell(le.cyl)}
              {cell(le.axis)}
              {cell(le.nearSph)}
            </tr>
          </tbody>
        </table>
      </div>
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
        <DispositionToggle icon={<RefreshCw size={16} />}    label="Follow Updates"       active={activePanels.includes("follow")}  onClick={() => togglePanel("follow")} />
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
