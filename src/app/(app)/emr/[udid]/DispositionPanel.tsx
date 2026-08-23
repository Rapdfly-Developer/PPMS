"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { SingleChipSelect } from "@/components/ui/Chip";
import { WARDS, ANAESTHESIA_TYPES, SURGERY_TYPES } from "@/lib/constants";
import { saveDispense, saveAdmission, saveFollowUp, saveSurgicalCounselling, addInvestigationOrder } from "./actions";
import { AlertTriangle, History, Plus, X, Scissors, Check, Pencil, Trash2, ClipboardList, ChevronDown, ChevronUp } from "lucide-react";

/* ── Surgery Investigation Presets ───────────────────────────────────────── */

interface SurgeryInvPreset { surgeryName: string; investigations: string[]; }

const SURGERY_INV_KEY = "ppms_surgery_inv_presets_v1";

const DEFAULT_SURGERY_INV_PRESETS: SurgeryInvPreset[] = [
  {
    surgeryName: "Cataract Surgery",
    investigations: ["CBC", "Blood Sugar (Fasting)", "ECG", "Blood Pressure", "HIV", "HBsAg", "Serum Creatinine"],
  },
  {
    surgeryName: "LASIK",
    investigations: ["Corneal Topography", "Pachymetry", "Refraction", "Schirmer Test", "Keratometry", "Pupil Dilation Test"],
  },
  {
    surgeryName: "Glaucoma Surgery (Trabeculectomy)",
    investigations: ["CBC", "Blood Sugar", "Blood Pressure", "Coagulation Profile (PT/INR)", "ECG", "Chest X-ray"],
  },
  {
    surgeryName: "Pterygium Excision",
    investigations: ["CBC", "Blood Sugar", "Blood Pressure", "HIV", "HBsAg"],
  },
  {
    surgeryName: "Vitreoretinal Surgery",
    investigations: ["CBC", "Blood Sugar", "ECG", "Blood Pressure", "Coagulation Profile (PT/INR)", "HIV", "HBsAg", "Serum Creatinine"],
  },
  {
    surgeryName: "DCR (Dacryocystorhinostomy)",
    investigations: ["CBC", "Blood Sugar", "ECG", "Blood Pressure", "Nasal Endoscopy", "CT PNS"],
  },
];

function getSurgeryInvPresets(): SurgeryInvPreset[] {
  try {
    const stored = localStorage.getItem(SURGERY_INV_KEY);
    if (!stored) return DEFAULT_SURGERY_INV_PRESETS;
    const parsed: SurgeryInvPreset[] = JSON.parse(stored);
    // Merge: keep custom, fill in defaults for missing surgeries
    const names = new Set(parsed.map((p) => p.surgeryName));
    const merged = [...parsed, ...DEFAULT_SURGERY_INV_PRESETS.filter((p) => !names.has(p.surgeryName))];
    return merged;
  } catch { return DEFAULT_SURGERY_INV_PRESETS; }
}

function saveSurgeryInvPresets(presets: SurgeryInvPreset[]) {
  localStorage.setItem(SURGERY_INV_KEY, JSON.stringify(presets));
}

function getPresetForSurgery(surgeryName: string): SurgeryInvPreset | null {
  if (!surgeryName.trim()) return null;
  const all = getSurgeryInvPresets();
  return all.find((p) => p.surgeryName.toLowerCase() === surgeryName.toLowerCase()) ?? null;
}

// ── Searchable dropdown (combobox) ────────────────────────────────────────────
function SearchCombobox({
  value, onChange, options, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const filtered = options.filter((o) => o.toLowerCase().includes(value.toLowerCase()));

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-300)] pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3 py-2 pl-8 text-sm text-[var(--color-ink-800)] placeholder:text-[var(--color-ink-300)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-transparent"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((opt) => (
            <li key={opt}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onChange(opt); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-[var(--color-primary-50)] hover:text-[var(--color-primary-700)] ${
                  value === opt ? "bg-[var(--color-primary-50)] text-[var(--color-primary-700)] font-semibold" : "text-[var(--color-ink-700)]"
                }`}
              >
                {opt}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


const IN_VIEW_OF_KEYWORDS: { group: string; items: string[] }[] = [
  {
    group: "Treatment Review",
    items: ["Review of treatment response", "Medication adjustment", "Response to new medication", "Dose titration review"],
  },
  {
    group: "Post-operative",
    items: ["Post-operative review", "Wound healing assessment", "Suture removal", "Post-intravitreal injection review"],
  },
  {
    group: "Investigations",
    items: ["IOP check", "Visual field assessment", "OCT review", "Fundus examination", "Gonioscopy", "B-scan review"],
  },
  {
    group: "Disease Monitoring",
    items: ["Assessment of disease progression", "Monitoring of retinal status", "Corneal healing review", "Dry eye reassessment"],
  },
  {
    group: "Other",
    items: ["Contact lens fitting", "Spectacle prescription update", "Second opinion", "Routine review"],
  },
];

// Disposition panels (Dispense / Admit / Surgical Counselling), rendered
// inside the Plan tab's toggle group - see PlanTab.tsx.

export function DispositionToggle({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium border transition-colors ${
        active
          ? "bg-[var(--color-primary-600)] text-white border-[var(--color-primary-600)]"
          : "bg-white text-[var(--color-ink-700)] border-[var(--color-border)] hover:border-[var(--color-primary-500)]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

export function DispensePanel({ visit, udid }: { visit: any; udid: string }) {
  const diagnoses = (visit.diagnoses ?? []).map((d: any) => d.description).join(", ");
  const autoSummary = `Diagnosis: ${diagnoses || "—"}.\nFollow-up plan: review as advised.`;
  const [summary, setSummary] = useState(visit.dispense?.shortSummary ?? autoSummary);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <div className="rounded-xl border border-[var(--color-border)] p-4">
      <p className="text-sm font-medium text-[var(--color-ink-700)] mb-2">Patient Dispense — Short Summary</p>
      <textarea
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        rows={4}
        className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
      />
      {saved && <span className="mt-2 text-xs text-[var(--color-success-600)] font-medium">Saved</span>}
    </div>
  );
}

export function AdmitPanel({ visit, udid, patientSex }: { visit: any; udid: string; patientSex: string }) {
  const [reason, setReason] = useState(visit.admission?.reason ?? "");
  const [ward, setWard] = useState(visit.admission?.ward ?? (patientSex === "FEMALE" ? "FEMALE_WARD" : "MALE_WARD"));
  const [days, setDays] = useState(visit.admission?.numberOfDays?.toString() ?? "1");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <div className="rounded-xl border border-[var(--color-border)] p-4">
      <p className="text-sm font-medium text-[var(--color-ink-700)] mb-3">Admission</p>
      <div className="flex flex-col gap-3">
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for admission" rows={2} className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm" />
        <div>
          <p className="text-xs font-medium text-[var(--color-ink-500)] mb-1.5">Ward (auto-suggested from registered sex, editable)</p>
          <SingleChipSelect options={WARDS} value={ward} onChange={setWard} />
        </div>
        <div className="max-w-[160px]">
          <label className="text-xs font-medium text-[var(--color-ink-500)]">Number of Days</label>
          <input type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm" />
        </div>
      </div>
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await saveAdmission(visit.id, udid, { reason, ward, numberOfDays: parseInt(days, 10) || 1 });
            setSaved(true);
          })
        }
        className="mt-3 text-sm font-medium px-4 py-2 rounded-lg bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)]"
      >
        Save Admission
      </button>
      {saved && <span className="ml-3 text-xs text-[var(--color-success-600)] font-medium">Saved — hospital notified</span>}
    </div>
  );
}

export function FollowUpdatesPanel({ visit, udid, priorVisits = [] }: { visit: any; udid: string; priorVisits?: any[] }) {
  const toInputDate = (d: any) => d ? new Date(d).toISOString().slice(0, 10) : "";
  const [followUpDate, setFollowUpDate] = useState(toInputDate(visit.followUpDate));
  const [referralEnabled, setReferralEnabled] = useState(visit.referralEnabled ?? false);
  const [referralNote, setReferralNote]       = useState(visit.referralNote ?? "");
  const [inViewOf, setInViewOf]               = useState(visit.inViewOf ?? "");
  const [showHistory, setShowHistory]         = useState(false);
  const [showKeywords, setShowKeywords]       = useState(false);
  const [pending, startTransition]            = useTransition();
  const [saved, setSaved]                     = useState(false);
  const inViewOfRef = useRef<HTMLInputElement>(null);

  const addWeeks = (weeks: number) => {
    const d = new Date();
    d.setDate(d.getDate() + weeks * 7);
    setFollowUpDate(d.toISOString().slice(0, 10));
    setSaved(false);
  };
  const addMonths = (months: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    setFollowUpDate(d.toISOString().slice(0, 10));
    setSaved(false);
  };

  const formatDate = (iso: string) => {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  const appendKeyword = (kw: string) => {
    setInViewOf((prev: string) => {
      const sep = prev.trim() ? (prev.trimEnd().endsWith(".") ? " " : ", ") : "";
      return prev.trimEnd() + sep + kw;
    });
    setSaved(false);
    inViewOfRef.current?.focus();
  };

  const chipCls = "px-3 py-1 rounded-full text-xs border border-[var(--color-border)] bg-white text-[var(--color-ink-600)] hover:border-[var(--color-primary-400)] hover:bg-[var(--color-primary-50)] transition-colors";
  const btnCls  = "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors";

  const save = () =>
    startTransition(async () => {
      await saveFollowUp(visit.id, udid, { followUpDate: followUpDate || null, referralEnabled, referralNote, inViewOf });
      setSaved(true);
    });

  const pastWithViewOf = priorVisits.filter((v) => v.id !== visit.id && v.inViewOf);

  return (
    <div className="rounded-xl border border-[var(--color-border)] p-4 flex flex-col gap-5">
      {/* Follow-up date */}
      <div>
        <p className="text-[10px] font-semibold tracking-widest text-[var(--color-ink-400)] uppercase mb-2">Follow-up</p>
        <p className="text-xs text-[var(--color-ink-500)] mb-1.5">Follow-up Date</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={followUpDate}
            onChange={(e) => { setFollowUpDate(e.target.value); setSaved(false); }}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
          />
          <button className={chipCls} onClick={() => addWeeks(1)}>1w</button>
          <button className={chipCls} onClick={() => addWeeks(2)}>2w</button>
          <button className={chipCls} onClick={() => addWeeks(4)}>4w</button>
          <button className={chipCls} onClick={() => addMonths(3)}>3m</button>
          <button className={chipCls} onClick={() => addMonths(6)}>6m</button>
          {followUpDate && (
            <span className="text-sm text-[var(--color-ink-500)]">{formatDate(followUpDate)}</span>
          )}
        </div>
      </div>

      {/* In View Of */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold tracking-widest text-[var(--color-ink-400)] uppercase">In View Of</p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => { setShowHistory((v) => !v); setShowKeywords(false); }}
              className={`${btnCls} ${showHistory
                ? "bg-[var(--color-primary-50)] border-[var(--color-primary-300)] text-[var(--color-primary-700)]"
                : "border-[var(--color-border)] text-[var(--color-ink-500)] hover:text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]"}`}
            >
              <History size={12} /> History
            </button>
            <button
              onClick={() => { setShowKeywords((v) => !v); setShowHistory(false); }}
              className={`${btnCls} ${showKeywords
                ? "bg-[var(--color-primary-50)] border-[var(--color-primary-300)] text-[var(--color-primary-700)]"
                : "border-[var(--color-border)] text-[var(--color-ink-500)] hover:text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]"}`}
            >
              <Plus size={12} /> Keyword
            </button>
          </div>
        </div>

        <input
          ref={inViewOfRef}
          value={inViewOf}
          onChange={(e) => { setInViewOf(e.target.value); setSaved(false); }}
          placeholder="e.g. Review of treatment response, IOP check…"
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3 py-2 text-sm text-[var(--color-ink-800)] placeholder:text-[var(--color-ink-300)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-transparent"
        />

        {/* History panel */}
        {showHistory && (
          <div className="mt-2 rounded-xl border border-[var(--color-border)] bg-white shadow-sm overflow-hidden">
            <div className="px-3 py-2 bg-[var(--color-surface-sunken)] border-b border-[var(--color-border)] flex items-center justify-between">
              <span className="text-[10px] font-bold text-[var(--color-ink-400)] uppercase tracking-widest">Previous — In View Of</span>
              <button onClick={() => setShowHistory(false)} className="text-[var(--color-ink-300)] hover:text-[var(--color-ink-700)]"><X size={12} /></button>
            </div>
            <div className="max-h-48 overflow-y-auto divide-y divide-[var(--color-border)]">
              {pastWithViewOf.length === 0 ? (
                <p className="px-3 py-4 text-xs text-[var(--color-ink-400)] text-center">No previous entries found.</p>
              ) : (
                pastWithViewOf.map((v) => (
                  <div key={v.id} className="px-3 py-2.5">
                    <p className="text-[10px] font-semibold text-[var(--color-ink-400)] mb-0.5">
                      {new Date(v.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                    <p className="text-xs text-[var(--color-ink-700)]">{v.inViewOf}</p>
                    <button
                      onClick={() => { setInViewOf(v.inViewOf); setSaved(false); setShowHistory(false); }}
                      className="mt-1 text-[10px] font-medium text-[var(--color-primary-600)] hover:underline"
                    >
                      Use this
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Keyword panel */}
        {showKeywords && (
          <div className="mt-2 rounded-xl border border-[var(--color-border)] bg-white shadow-sm overflow-hidden">
            <div className="px-3 py-2 bg-[var(--color-surface-sunken)] border-b border-[var(--color-border)] flex items-center justify-between">
              <span className="text-[10px] font-bold text-[var(--color-ink-400)] uppercase tracking-widest">Add Keyword</span>
              <button onClick={() => setShowKeywords(false)} className="text-[var(--color-ink-300)] hover:text-[var(--color-ink-700)]"><X size={12} /></button>
            </div>
            <div className="p-3 flex flex-col gap-3">
              {IN_VIEW_OF_KEYWORDS.map((group) => (
                <div key={group.group}>
                  <p className="text-[10px] font-bold text-[var(--color-ink-400)] uppercase tracking-widest mb-1.5">{group.group}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.items.map((kw) => (
                      <button
                        key={kw}
                        onClick={() => appendKeyword(kw)}
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

      {/* Referral */}
      <div>
        <p className="text-[10px] font-semibold tracking-widest text-[var(--color-ink-400)] uppercase mb-2">Referral</p>
        <label className="flex items-center gap-2 text-sm text-[var(--color-ink-700)] cursor-pointer">
          <input
            type="checkbox"
            checked={referralEnabled}
            onChange={(e) => { setReferralEnabled(e.target.checked); setSaved(false); }}
          />
          Enable referral
        </label>
        {referralEnabled && (
          <textarea
            value={referralNote}
            onChange={(e) => { setReferralNote(e.target.value); setSaved(false); }}
            rows={2}
            placeholder="Referral details..."
            className="mt-2 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
          />
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          disabled={pending}
          onClick={save}
          className="text-sm font-medium px-4 py-2 rounded-lg bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] disabled:opacity-60 transition-colors"
        >
          Save
        </button>
        {saved && <span className="text-xs text-[var(--color-success-600)] font-medium">Saved</span>}
      </div>
    </div>
  );
}

export function SurgicalPanel({ visit, udid }: { visit: any; udid: string }) {
  const [laterality, setLaterality] = useState<string>(visit.advisedSurgeryEye ?? "");
  const [procedure,  setProcedure]  = useState<string>(visit.advisedSurgeryName ?? "");
  const [anesthesia, setAnesthesia] = useState<string>(visit.advisedSurgeryNotes ?? "");
  const [surgDate,   setSurgDate]   = useState<string>(
    visit.advisedSurgeryDate ? new Date(visit.advisedSurgeryDate).toISOString().slice(0, 10) : ""
  );
  const [pending,  startTransition]  = useTransition();
  const [applying, startApply]       = useTransition();
  const [saved,    setSaved]         = useState(false);
  const [applied,  setApplied]       = useState(false);

  // Investigation preset state
  type InvItem = { name: string; checked: boolean };
  const [invItems,       setInvItems]       = useState<InvItem[]>([]);
  const [customInvInput, setCustomInvInput] = useState("");
  const [showManage,     setShowManage]     = useState(false);
  const [manageInput,    setManageInput]    = useState("");
  const [editInvIdx,     setEditInvIdx]     = useState<number | null>(null);
  const [editInvVal,     setEditInvVal]     = useState("");
  const [presetLoaded,   setPresetLoaded]   = useState<string | null>(null);

  const LABEL = "text-[10px] font-semibold text-[var(--color-ink-500)] uppercase tracking-wide mb-1.5";

  // Load preset when procedure changes
  useEffect(() => {
    if (!procedure.trim() || procedure === presetLoaded) return;
    const preset = getPresetForSurgery(procedure);
    if (preset) {
      setInvItems(preset.investigations.map((name) => ({ name, checked: true })));
    } else {
      setInvItems([]);
    }
    setPresetLoaded(procedure);
  }, [procedure, presetLoaded]);

  const addCustomInv = () => {
    const trimmed = customInvInput.trim();
    if (!trimmed || invItems.some((i) => i.name.toLowerCase() === trimmed.toLowerCase())) return;
    setInvItems((prev) => [...prev, { name: trimmed, checked: true }]);
    setCustomInvInput("");
  };

  const savePreset = () => {
    if (!procedure.trim()) return;
    const all = getSurgeryInvPresets();
    const names = invItems.map((i) => i.name);
    const idx = all.findIndex((p) => p.surgeryName.toLowerCase() === procedure.toLowerCase());
    if (idx >= 0) {
      all[idx] = { ...all[idx], investigations: names };
    } else {
      all.push({ surgeryName: procedure, investigations: names });
    }
    saveSurgeryInvPresets(all);
  };

  const applyToInvestigations = () => {
    const toAdd = invItems.filter((i) => i.checked);
    if (!toAdd.length) return;
    startApply(async () => {
      for (const item of toAdd) {
        await addInvestigationOrder(visit.id, udid, {
          category: "Pre-operative",
          testName: item.name,
          priority: "ROUTINE",
        });
      }
      setApplied(true);
      setTimeout(() => setApplied(false), 3000);
    });
  };

  const save = () =>
    startTransition(async () => {
      await saveSurgicalCounselling(visit.id, udid, {
        surgeryAdvised:      true,
        advisedSurgeryEye:   laterality || undefined,
        advisedSurgeryName:  procedure || undefined,
        advisedSurgeryNotes: anesthesia || undefined,
        advisedSurgeryDate:  surgDate || undefined,
      });
      setSaved(true);
    });

  const checkedCount = invItems.filter((i) => i.checked).length;

  return (
    <div className="rounded-xl border border-[var(--color-border)] p-4 flex flex-col gap-4">
      <p className="text-sm font-medium text-[var(--color-ink-700)]">Surgical Counselling</p>

      {/* Row: Laterality · Procedure · Anesthesia · Date */}
      <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr_auto] gap-3 items-end">
        {/* Laterality */}
        <div>
          <p className={LABEL}>Laterality</p>
          <div className="flex gap-1">
            {(["RE", "LE", "OU"] as const).map((lat) => (
              <button
                key={lat}
                type="button"
                onClick={() => { setLaterality(laterality === lat ? "" : lat); setSaved(false); }}
                className={`w-12 py-2 rounded-lg border text-xs font-bold transition-colors ${
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

        {/* Procedure */}
        <div>
          <p className={LABEL}>Procedure</p>
          <SearchCombobox
            value={procedure}
            onChange={(v) => { setProcedure(v); setSaved(false); setPresetLoaded(null); }}
            options={SURGERY_TYPES}
            placeholder="Search procedure..."
          />
        </div>

        {/* Anesthesia */}
        <div>
          <p className={LABEL}>Type of Anesthesia</p>
          <SearchCombobox
            value={anesthesia}
            onChange={(v) => { setAnesthesia(v); setSaved(false); }}
            options={ANAESTHESIA_TYPES}
            placeholder="Search anesthesia..."
          />
        </div>

        {/* Date — compact */}
        <div>
          <p className={LABEL}>Tentative Date</p>
          <input
            type="date"
            value={surgDate}
            onChange={(e) => { setSurgDate(e.target.value); setSaved(false); }}
            className="w-40 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3 py-2 text-sm text-[var(--color-ink-800)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-transparent"
          />
        </div>
      </div>

      {/* ── Investigation Preset ────────────────────────────────────────── */}
      {procedure.trim() && (
        <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[var(--color-surface-sunken)] border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2">
              <ClipboardList size={14} className="text-[var(--color-primary-600)]" />
              <p className="text-xs font-semibold text-[var(--color-ink-700)]">
                {invItems.length > 0
                  ? `Investigations for ${procedure}`
                  : `No preset for "${procedure}"`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowManage((v) => !v)}
              className="flex items-center gap-1 text-[10px] font-semibold text-[var(--color-primary-600)] hover:text-[var(--color-primary-800)] transition-colors"
            >
              Manage Preset {showManage ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
          </div>

          {/* Manage Preset panel */}
          {showManage && (
            <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-sunken)]/50 flex flex-col gap-2">
              <p className="text-[10px] font-bold text-[var(--color-ink-400)] uppercase tracking-widest">Edit preset for &quot;{procedure}&quot;</p>
              <ul className="flex flex-col gap-1">
                {invItems.map((item, i) => (
                  <li key={i} className="flex items-center gap-2">
                    {editInvIdx === i ? (
                      <>
                        <input
                          autoFocus
                          value={editInvVal}
                          onChange={(e) => setEditInvVal(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const t = editInvVal.trim();
                              if (t) setInvItems((prev) => prev.map((it, idx) => idx === i ? { ...it, name: t } : it));
                              setEditInvIdx(null);
                            }
                            if (e.key === "Escape") setEditInvIdx(null);
                          }}
                          className="flex-1 text-xs rounded border border-[var(--color-primary-300)] px-2 py-0.5 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const t = editInvVal.trim();
                            if (t) setInvItems((prev) => prev.map((it, idx) => idx === i ? { ...it, name: t } : it));
                            setEditInvIdx(null);
                          }}
                          className="text-[var(--color-primary-600)] hover:text-[var(--color-primary-800)]"
                        >
                          <Check size={13} />
                        </button>
                        <button type="button" onClick={() => setEditInvIdx(null)} className="text-[var(--color-ink-400)]">
                          <X size={13} />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-xs text-[var(--color-ink-700)]">{item.name}</span>
                        <button
                          type="button"
                          onClick={() => { setEditInvIdx(i); setEditInvVal(item.name); }}
                          className="text-[var(--color-ink-300)] hover:text-[var(--color-primary-600)] transition-colors"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setInvItems((prev) => prev.filter((_, idx) => idx !== i))}
                          className="text-[var(--color-ink-300)] hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={11} />
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              <div className="flex gap-2 mt-1">
                <input
                  value={manageInput}
                  onChange={(e) => setManageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const t = manageInput.trim();
                      if (t && !invItems.some((i) => i.name.toLowerCase() === t.toLowerCase())) {
                        setInvItems((prev) => [...prev, { name: t, checked: true }]);
                        setManageInput("");
                      }
                    }
                  }}
                  placeholder="Add investigation to preset…"
                  className="flex-1 text-xs rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-400)]"
                />
                <button
                  type="button"
                  onClick={() => {
                    const t = manageInput.trim();
                    if (t && !invItems.some((i) => i.name.toLowerCase() === t.toLowerCase())) {
                      setInvItems((prev) => [...prev, { name: t, checked: true }]);
                      setManageInput("");
                    }
                  }}
                  disabled={!manageInput.trim()}
                  className="px-2.5 py-1 rounded-lg bg-[var(--color-primary-600)] text-white text-xs font-medium disabled:opacity-40 hover:bg-[var(--color-primary-700)] transition-colors"
                >
                  <Plus size={12} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => { savePreset(); setShowManage(false); }}
                className="self-start text-xs font-semibold px-3 py-1 rounded-lg bg-[var(--color-primary-50)] border border-[var(--color-primary-200)] text-[var(--color-primary-700)] hover:bg-[var(--color-primary-100)] transition-colors mt-1"
              >
                Save Preset
              </button>
            </div>
          )}

          {/* Checklist */}
          <div className="px-4 py-3 flex flex-col gap-2">
            {invItems.length === 0 ? (
              <p className="text-xs text-[var(--color-ink-400)] text-center py-2">
                No investigations configured. Use &quot;Manage Preset&quot; to add them.
              </p>
            ) : (
              <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
                {invItems.map((item, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => setInvItems((prev) => prev.map((it, idx) => idx === i ? { ...it, checked: !it.checked } : it))}
                      className="w-3.5 h-3.5 accent-[var(--color-primary-600)] shrink-0 cursor-pointer"
                      id={`inv-${i}`}
                    />
                    <label htmlFor={`inv-${i}`} className="text-xs text-[var(--color-ink-700)] cursor-pointer flex-1 leading-tight">
                      {item.name}
                    </label>
                    <button
                      type="button"
                      onClick={() => setInvItems((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-[var(--color-ink-200)] hover:text-red-400 transition-colors shrink-0"
                    >
                      <X size={11} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Add custom investigation */}
            <div className="flex gap-2 mt-1">
              <input
                value={customInvInput}
                onChange={(e) => setCustomInvInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomInv(); } }}
                placeholder="Add custom investigation…"
                className="flex-1 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-400)]"
              />
              <button
                type="button"
                onClick={addCustomInv}
                disabled={!customInvInput.trim()}
                className="px-2.5 py-1 rounded-lg border border-[var(--color-border)] text-[var(--color-ink-500)] hover:border-[var(--color-primary-300)] hover:text-[var(--color-primary-700)] disabled:opacity-40 transition-colors"
              >
                <Plus size={12} />
              </button>
            </div>

            {/* Apply button */}
            <button
              type="button"
              disabled={checkedCount === 0 || applying}
              onClick={applyToInvestigations}
              className="mt-1 self-start flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--color-primary-600)] text-white text-xs font-semibold hover:bg-[var(--color-primary-700)] disabled:opacity-40 transition-colors"
            >
              {applying ? (
                <span>Applying…</span>
              ) : applied ? (
                <><Check size={12} /> Applied to Investigations</>
              ) : (
                <><ClipboardList size={12} /> Apply to Plan ({checkedCount})</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Save row */}
      <div className="flex items-center gap-3">
        <button
          disabled={pending}
          onClick={save}
          className="text-sm font-medium px-4 py-2 rounded-lg bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] disabled:opacity-60 transition-colors"
        >
          Save
        </button>
        {saved && <span className="text-xs text-[var(--color-success-600)] font-medium">Saved</span>}
      </div>
    </div>
  );
}

