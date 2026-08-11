"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { SingleChipSelect } from "@/components/ui/Chip";
import { WARDS, ANAESTHESIA_TYPES, SURGERY_TYPES } from "@/lib/constants";
import { saveDispense, saveAdmission, saveSurgicalCounselling, saveFollowUp } from "./actions";
import { AlertTriangle, ChevronDown, History, Plus, X } from "lucide-react";

const SURGERY_NAME_OPTIONS = [
  "Phacoemulsification with IOL Implantation",
  "Manual Small Incision Cataract Surgery (MSICS)",
  "Extracapsular Cataract Extraction (ECCE)",
  "Intracapsular Cataract Extraction (ICCE)",
  "Trabeculectomy",
  "Ahmed Glaucoma Valve Implantation",
  "Baerveldt Glaucoma Implant",
  "Pars Plana Vitrectomy (PPV)",
  "Scleral Buckle",
  "Retinal Detachment Surgery",
  "Intravitreal Injection",
  "Laser Photocoagulation",
  "Penetrating Keratoplasty (PKP)",
  "Deep Anterior Lamellar Keratoplasty (DALK)",
  "Descemet Membrane Endothelial Keratoplasty (DMEK)",
  "Descemet Stripping Automated Endothelial Keratoplasty (DSAEK)",
  "Pterygium Excision with Conjunctival Autograft",
  "Dacryocystorhinostomy (DCR)",
  "Squint Surgery",
  "Entropion Correction",
  "Ectropion Correction",
  "Lid Repair",
  "Orbital Decompression",
  "Enucleation",
  "Evisceration",
];

function SurgeryNameCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = SURGERY_NAME_OPTIONS.filter((o) =>
    o.toLowerCase().includes(query.toLowerCase())
  );

  function select(opt: string) {
    onChange(opt);
    setQuery(opt);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          placeholder="e.g. Phacoemulsification with IOL implantation"
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3 py-2 pr-8 text-sm text-[var(--color-ink-800)] placeholder:text-[var(--color-ink-300)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-transparent"
          onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
        <ChevronDown
          size={14}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] pointer-events-none"
        />
      </div>
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg overflow-hidden max-h-52 overflow-y-auto">
          {filtered.map((opt) => (
            <li key={opt}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); select(opt); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-primary-50)] hover:text-[var(--color-primary-700)] transition-colors ${
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
  const sc = visit.surgicalCounselling;
  const [surgeryName, setSurgeryName] = useState(sc?.surgeryName ?? "");
  const [surgeryType, setSurgeryType] = useState(sc?.surgeryType ?? SURGERY_TYPES[0]);
  const [rightEye, setRightEye] = useState(sc?.rightEye ?? false);
  const [leftEye, setLeftEye] = useState(sc?.leftEye ?? false);
  const [anaesthesiaType, setAnaesthesiaType] = useState(sc?.anaesthesiaType ?? ANAESTHESIA_TYPES[0]);
  const [surgeryDate, setSurgeryDate] = useState(sc?.surgeryDate ? new Date(sc.surgeryDate).toISOString().slice(0, 10) : "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(!!sc);

  return (
    <div className="rounded-xl border border-[var(--color-border)] p-4">
      <p className="text-sm font-medium text-[var(--color-ink-700)] mb-3">Surgical Counselling</p>
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-xs font-medium text-[var(--color-ink-500)] mb-1.5">Name of Surgery</p>
          <SurgeryNameCombobox
            value={surgeryName}
            onChange={(v) => { setSurgeryName(v); setSaved(false); }}
          />
        </div>
        <div>
          <p className="text-xs font-medium text-[var(--color-ink-500)] mb-1.5">Type of Surgery</p>
          <SingleChipSelect options={SURGERY_TYPES} value={surgeryType} onChange={(v) => { setSurgeryType(v); setSaved(false); }} />
        </div>
        <div>
          <p className="text-xs font-medium text-[var(--color-ink-500)] mb-1.5">Eye Selection</p>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={rightEye} onChange={(e) => { setRightEye(e.target.checked); setSaved(false); }} /> Right Eye</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={leftEye} onChange={(e) => { setLeftEye(e.target.checked); setSaved(false); }} /> Left Eye</label>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-[var(--color-ink-500)] mb-1.5">Type of Anaesthesia</p>
          <SingleChipSelect options={ANAESTHESIA_TYPES} value={anaesthesiaType} onChange={(v) => { setAnaesthesiaType(v); setSaved(false); }} />
        </div>
        <div className="max-w-[200px]">
          <label className="text-xs font-medium text-[var(--color-ink-500)]">Date of Surgery</label>
          <input type="date" value={surgeryDate} onChange={(e) => { setSurgeryDate(e.target.value); setSaved(false); }} className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm" />
        </div>
      </div>

      {sc?.conflictFlag && (
        <p className="flex items-center gap-1.5 text-xs text-[var(--color-danger-600)] bg-[var(--color-danger-100)] rounded-lg px-3 py-2 mt-3">
          <AlertTriangle size={13} /> Potential scheduling conflict with an existing appointment on this date.
        </p>
      )}

      <button
        disabled={pending || !surgeryDate || saved}
        onClick={() =>
          startTransition(async () => {
            await saveSurgicalCounselling(visit.id, udid, { surgeryName, surgeryType, rightEye, leftEye, anaesthesiaType, surgeryDate });
            setSaved(true);
          })
        }
        className="mt-3 text-sm font-medium px-4 py-2 rounded-lg bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {saved ? "Saved" : pending ? "Saving…" : "Save Surgical Counselling"}
      </button>
      {saved && <span className="ml-3 text-xs text-[var(--color-success-600)] font-medium">Hospital admin notified</span>}
    </div>
  );
}
