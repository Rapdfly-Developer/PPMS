"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { SingleChipSelect } from "@/components/ui/Chip";
import { WARDS } from "@/lib/constants";
import { saveDispense, saveFollowUp } from "./actions";
import { AlertTriangle, History, Plus, X } from "lucide-react";
import { useEmrOverview } from "./EmrOverviewContext";
import { appendKeywordAsBullet, KeywordChipsRow, KeywordInput, removeKeywordFromText } from "@/components/emr/KeywordField";


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
const ALL_IN_VIEW_OF_KEYWORDS = IN_VIEW_OF_KEYWORDS.flatMap((group) => group.items);

// Disposition panels (Dispense / Admit / Follow Up Dates), rendered
// inside the Plan tab's toggle group - see PlanTab.tsx.

export function DispositionToggle({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-label sm:text-sm font-medium border transition-colors ${
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
      <p className="text-label sm:text-sm font-medium text-[var(--color-ink-700)] mb-2">Patient Dispense, Short Summary</p>
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

export function FollowUpdatesPanel({ visit, udid, priorVisits = [] }: { visit: any; udid: string; priorVisits?: any[] }) {
  const toInputDate = (d: any) => d ? new Date(d).toISOString().slice(0, 10) : "";
  const [followUpDate, setFollowUpDate] = useState(toInputDate(visit.followUpDate));
  const [inViewOf, setInViewOf]               = useState(visit.inViewOf ?? "");
  const [showHistory, setShowHistory]         = useState(false);
  const [showKeywords, setShowKeywords]       = useState(false);
  const [pending, startTransition]            = useTransition();
  const [saved, setSaved]                     = useState(false);
  const inViewOfRef = useRef<HTMLTextAreaElement>(null);

  /* Applying a treatment preset writes followUpDate straight to the visit, but
     this panel stays mounted throughout — so the initial useState value would
     keep showing the pre-preset date. Adopt the server value whenever it
     changes; only this field is synced, the rest of the panel is left alone. */
  useEffect(() => {
    setFollowUpDate(toInputDate(visit.followUpDate));
  }, [visit.followUpDate]);

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
    return new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "short", year: "numeric" });
  };

  const appendKeyword = (kw: string) => {
    setInViewOf((prev: string) => appendKeywordAsBullet(prev, kw));
    setSaved(false);
    inViewOfRef.current?.focus();
  };

  const chipCls = "px-3 py-1 rounded-full text-xs border border-[var(--color-border)] bg-white text-[var(--color-ink-600)] hover:border-[var(--color-primary-400)] hover:bg-[var(--color-primary-50)] transition-colors";
  const btnCls  = "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors";

  const save = () =>
    startTransition(async () => {
      await saveFollowUp(visit.id, udid, { followUpDate: followUpDate || null, inViewOf });
      setSaved(true);
    });

  const pastWithViewOf = priorVisits.filter((v) => v.id !== visit.id && v.inViewOf);

  return (
    <div className="rounded-xl border border-[var(--color-border)] p-4 flex flex-col gap-5">
      {/* Follow-up date */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="text-caption font-semibold tracking-widest text-[var(--color-ink-400)] uppercase">Follow-up</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={followUpDate}
            onChange={(e) => { setFollowUpDate(e.target.value); setSaved(false); }}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
          />
          <button data-overview-hide className={chipCls} onClick={() => addWeeks(1)}>1w</button>
          <button data-overview-hide className={chipCls} onClick={() => addWeeks(2)}>2w</button>
          <button data-overview-hide className={chipCls} onClick={() => addWeeks(4)}>4w</button>
          <button data-overview-hide className={chipCls} onClick={() => addMonths(3)}>3m</button>
          <button data-overview-hide className={chipCls} onClick={() => addMonths(6)}>6m</button>
          {followUpDate && (
            <span className="text-label sm:text-sm text-[var(--color-ink-500)]">{formatDate(followUpDate)}</span>
          )}
        </div>
      </div>

      {/* In View Of */}
      <div>
        <div className="flex items-start gap-3">
          <p className="text-caption font-semibold tracking-widest text-[var(--color-ink-400)] uppercase shrink-0 pt-2.5">In View Of</p>
          <textarea
            ref={inViewOfRef}
            value={inViewOf}
            onChange={(e) => { setInViewOf(e.target.value); setSaved(false); }}
            placeholder="e.g. Review of treatment response, IOP check…"
            rows={Math.max(1, Math.min(8, inViewOf.replace(/\r/g, "").split("\n").length))}
            className="flex-1 min-w-0 resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3 py-2 text-sm text-[var(--color-ink-800)] placeholder:text-[var(--color-ink-300)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-transparent"
          />
          <div data-overview-hide className="flex items-center gap-1.5 shrink-0 pt-1">
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

        {/* History panel */}
        {showHistory && (
          <div className="mt-2 rounded-xl border border-[var(--color-border)] bg-white shadow-sm overflow-hidden">
            <div className="px-3 py-2 bg-[var(--color-surface-sunken)] border-b border-[var(--color-border)] flex items-center justify-between">
              <span className="text-caption font-bold text-[var(--color-ink-400)] uppercase tracking-widest">Previous, In View Of</span>
              <button onClick={() => setShowHistory(false)} className="text-[var(--color-ink-300)] hover:text-[var(--color-ink-700)]"><X size={12} /></button>
            </div>
            <div className="max-h-48 overflow-y-auto divide-y divide-[var(--color-border)]">
              {pastWithViewOf.length === 0 ? (
                <p className="px-3 py-4 text-xs text-[var(--color-ink-400)] text-center">No previous entries found.</p>
              ) : (
                pastWithViewOf.map((v) => (
                  <div key={v.id} className="px-3 py-2.5">
                    <p className="text-caption font-semibold text-[var(--color-ink-400)] mb-0.5">
                      {new Date(v.date).toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                    <p className="text-xs text-[var(--color-ink-700)]">{v.inViewOf}</p>
                    <button
                      onClick={() => { setInViewOf(v.inViewOf); setSaved(false); setShowHistory(false); }}
                      className="mt-1 text-caption font-medium text-[var(--color-primary-600)] hover:underline"
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
              <span className="text-caption font-bold text-[var(--color-ink-400)] uppercase tracking-widest">Add Keyword</span>
              <button onClick={() => setShowKeywords(false)} className="text-[var(--color-ink-300)] hover:text-[var(--color-ink-700)]"><X size={12} /></button>
            </div>
            <div className="p-3">
              <KeywordChipsRow
                fieldKey="plan_in_view_of"
                builtIns={ALL_IN_VIEW_OF_KEYWORDS}
                getValue={() => inViewOf}
                onAppend={appendKeyword}
                onRemoveFromText={(kw) => { setInViewOf((prev: string) => removeKeywordFromText(prev, kw)); setSaved(false); }}
              />
            </div>
          </div>
        )}
      </div>

      <div data-overview-hide className="flex items-center gap-3">
        <button
          disabled={pending}
          onClick={save}
          className="text-label sm:text-sm font-medium px-4 py-2 rounded-lg bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] disabled:opacity-60 transition-colors"
        >
          Save
        </button>
        {saved && <span className="text-xs text-[var(--color-success-600)] font-medium">Saved</span>}
      </div>
    </div>
  );
}

// Default "In view of" keywords for a referral; ones saved with "+ Keyword"
// are kept on top of these (localStorage kw_referral_in_view_of).
const REFERRAL_IN_VIEW_OF_KEYWORDS = [
  "Retina evaluation", "Glaucoma evaluation", "Cornea opinion", "Neuro-ophthalmic evaluation",
  "Oculoplasty opinion", "Paediatric ophthalmology", "Low vision aids",
  "Diabetes control", "Hypertension control", "Physician fitness for surgery", "Cardiology clearance", "Neurology opinion",
];

type ReferralType = "INTERNAL" | "EXTERNAL";

export function ReferralPanel({ visit, udid }: { visit: any; udid: string }) {
  const [referralType, setReferralType]       = useState<ReferralType>(visit.referralType === "EXTERNAL" ? "EXTERNAL" : "INTERNAL");
  const [referralNote, setReferralNote]       = useState<string>(visit.referralNote ?? "");
  const [inViewOf, setInViewOf]               = useState<string>(visit.referralInViewOf ?? "");
  const [pending, startTransition]            = useTransition();
  const [saved, setSaved]                     = useState(false);
  const overview = useEmrOverview();
  // No checkbox: a referral exists once details or "In view of" are filled in.
  // referralEnabled is still stored because the prints and Overview read it.
  const referralEnabled = !!(referralNote.trim() || inViewOf.trim());

  const save = () =>
    startTransition(async () => {
      await saveFollowUp(visit.id, udid, {
        referralEnabled,
        referralNote,
        referralType: referralEnabled ? referralType : null,
        referralInViewOf: inViewOf,
      });
      setSaved(true);
    });

  const labelCls = "text-caption font-semibold tracking-widest text-[var(--color-ink-400)] uppercase";

  if (overview) {
    if (!referralEnabled) return null;
    return (
      <div className="rounded-xl border border-[var(--color-border)] p-4 flex flex-col gap-1">
        <p className={labelCls}>Referral · {referralType === "EXTERNAL" ? "External" : "Internal"}</p>
        {referralNote.trim() && <p className="text-label sm:text-sm text-[var(--color-ink-700)]">Referred by: {referralNote.trim()}</p>}
        {inViewOf.trim() && <p className="text-label sm:text-sm text-[var(--color-ink-500)]">In view of: {inViewOf.trim()}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] p-4 flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
          <p className={labelCls}>Referral</p>

          {/* Internal / External flip */}
          <div role="radiogroup" aria-label="Referral type" className="relative inline-grid grid-cols-2 rounded-full bg-[var(--color-surface-sunken)] p-0.5 text-xs font-medium">
            <span
              aria-hidden
              className={`absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-white shadow-sm ring-1 ring-[var(--color-border)] transition-transform duration-200 ${referralType === "EXTERNAL" ? "translate-x-full" : ""}`}
            />
            {(["INTERNAL", "EXTERNAL"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={referralType === t}
                onClick={() => { setReferralType(t); setSaved(false); }}
                className={`relative z-10 px-4 py-1.5 rounded-full transition-colors ${referralType === t ? "text-[var(--color-primary-700)]" : "text-[var(--color-ink-500)] hover:text-[var(--color-ink-700)]"}`}
              >
                {t === "INTERNAL" ? "Internal" : "External"}
              </button>
            ))}
          </div>
      </div>

          {/* Stored in referralNote, as the referral details were. */}
          <div className="flex items-start gap-3">
            <p className={`${labelCls} shrink-0 pt-2.5`}>Referred By</p>
            <div className="flex-1 min-w-0">
              <KeywordInput
                fieldKey="referral_referred_by"
                value={referralNote}
                onChange={(v) => { setReferralNote(v); setSaved(false); }}
                placeholder="e.g. Dr. name, hospital or clinic…"
              />
            </div>
          </div>

          <div className="flex items-start gap-3">
            <p className={`${labelCls} shrink-0 pt-2.5`}>In View Of</p>
            <div className="flex-1 min-w-0">
            <KeywordInput
              fieldKey="referral_in_view_of"
              builtIns={REFERRAL_IN_VIEW_OF_KEYWORDS}
              value={inViewOf}
              onChange={(v) => { setInViewOf(v); setSaved(false); }}
              placeholder="e.g. Retina evaluation, Physician fitness for surgery…"
            />
            </div>
          </div>

      <div data-overview-hide className="flex items-center gap-3">
        <button
          disabled={pending}
          onClick={save}
          className="text-label sm:text-sm font-medium px-4 py-2 rounded-lg bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] disabled:opacity-60 transition-colors"
        >
          Save
        </button>
        {saved && <span className="text-xs text-[var(--color-success-600)] font-medium">Saved</span>}
      </div>
    </div>
  );
}
