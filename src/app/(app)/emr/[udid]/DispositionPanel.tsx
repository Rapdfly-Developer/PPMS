"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { SingleChipSelect } from "@/components/ui/Chip";
import { WARDS } from "@/lib/constants";
import { saveDispense, saveFollowUp, saveSurgicalCounselling, clearSurgicalCounselling } from "./actions";
import { AlertTriangle, History, Plus, Search, X } from "lucide-react";
import { useEmrOverview } from "./EmrOverviewContext";
import { appendKeywordAsBullet, KeywordChipsRow, KeywordInput, KeywordTextarea, removeKeywordFromText } from "@/components/emr/KeywordField";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { istTodayStr } from "@/lib/ist";
import { ANAESTHESIA_OPTIONS, SURGERY_OPTIONS, SURGICAL_NOTE_KEYWORDS, rescheduledSurgeryDate } from "@/lib/counselling";


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
            <>
              <span className="text-label sm:text-sm text-[var(--color-ink-500)]">{formatDate(followUpDate)}</span>
              <button
                type="button"
                data-overview-hide
                onClick={() => { setFollowUpDate(""); setSaved(false); }}
                title="Clear follow-up date"
                aria-label="Clear follow-up date"
                className="p-1 rounded-full text-[var(--color-ink-300)] hover:text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] transition-colors"
              >
                <X size={13} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* In View Of */}
      <div>
        <div className="flex items-start gap-3">
          <p className="text-caption font-semibold tracking-widest text-[var(--color-ink-400)] uppercase shrink-0 pt-2.5 w-24">In View Of</p>
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
              onClick={() => setShowHistory((v) => !v)}
              className={`${btnCls} ${showHistory
                ? "bg-[var(--color-primary-50)] border-[var(--color-primary-300)] text-[var(--color-primary-700)]"
                : "border-[var(--color-border)] text-[var(--color-ink-500)] hover:text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]"}`}
            >
              <History size={12} /> History
            </button>
          </div>
        </div>

        {/* Keywords — always shown under the box, like Referral's "In View Of" */}
        <div data-overview-hide className="mt-2 pl-[6.75rem]">
          <KeywordChipsRow
            fieldKey="plan_in_view_of"
            builtIns={ALL_IN_VIEW_OF_KEYWORDS}
            getValue={() => inViewOf}
            onAppend={appendKeyword}
            onRemoveFromText={(kw) => { setInViewOf((prev: string) => removeKeywordFromText(prev, kw)); setSaved(false); }}
          />
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
        <p className={labelCls}>Referral</p>
        {referralNote.trim() && <p className="text-label sm:text-sm text-[var(--color-ink-700)]">Referred to: {referralNote.trim()}</p>}
        {inViewOf.trim() && <p className="text-label sm:text-sm text-[var(--color-ink-500)]">In view of: {inViewOf.trim()}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] p-4 flex flex-col gap-4">
          {/* Stored in referralNote, as the referral details were. */}
          <div className="flex items-start gap-3">
            <p className={`${labelCls} shrink-0 pt-2.5`}>Referred To</p>
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

/* ── Surgical Counselling ─────────────────────────────────────────────────
   Saved on the visit (advisedSurgery* fields). Once the visit is finalized
   and signed, the patient appears in the Counselling module. */

const SURGERY_LIBRARY_KEY = "ppms_custom_surgery_v1";
// Shared with the Minor Procedure card so custom anaesthesia types appear in both.
const ANAESTHESIA_LIBRARY_KEY = "ppms_custom_anesthesia_v1";

function readLibrary(key: string): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function rememberInLibrary(key: string, builtIns: readonly string[], value: string): string[] {
  const v = value.trim();
  const current = readLibrary(key);
  const known = [...builtIns, ...current].some((s) => s.toLowerCase() === v.toLowerCase());
  if (!v || known) return current;
  const next = [...current, v];
  try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
  return next;
}

function SearchCombo({
  value, onChange, options, libraryKey, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  libraryKey: string;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState<string[]>(() => (typeof window === "undefined" ? [] : readLibrary(libraryKey)));
  const q = value.trim().toLowerCase();
  const matches = [...new Set([...options, ...custom])].filter((s) => !q || s.toLowerCase().includes(q));

  return (
    <div className="relative">
      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-300)] pointer-events-none" />
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => { setCustom(rememberInLibrary(libraryKey, options, value)); setTimeout(() => setOpen(false), 150); }}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] pl-8 pr-3 py-2 text-sm text-[var(--color-ink-800)] placeholder:text-[var(--color-ink-300)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-transparent"
      />
      {open && matches.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-white shadow-lg py-1">
          {matches.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(s); setOpen(false); }}
              className="block w-full text-left px-3 py-1.5 text-sm text-[var(--color-ink-700)] hover:bg-[var(--color-primary-50)]"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SurgicalCounsellingPanel({ visit, udid }: { visit: any; udid: string }) {
  const toInputDate = (d: any) => (d ? istTodayStr(new Date(d)) : "");
  const [eye, setEye]                 = useState<string>(visit.advisedSurgeryEye ?? "");
  const [name, setName]               = useState<string>(visit.advisedSurgeryName ?? "");
  const [anaesthesia, setAnaesthesia] = useState<string>(visit.advisedSurgeryAnaesthesia ?? "");
  const [date, setDate]               = useState<string>(toInputDate(visit.advisedSurgeryDate));
  const [notes, setNotes]             = useState<string>(visit.advisedSurgeryNotes ?? "");
  const [isSaved, setIsSaved]         = useState<boolean>(!!visit.surgeryAdvised);
  const [savedMsg, setSavedMsg]       = useState(false);
  const [error, setError]             = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  // Date Counselling moved the surgery to (the signed date here stays as written)
  const movedTo = rescheduledSurgeryDate(visit.advisedSurgeryDate, visit.counsellingRecord?.dateOfSurgery);
  const [pending, startTransition]    = useTransition();
  const overview = useEmrOverview();

  const touch = () => { setSavedMsg(false); setError(""); };
  const labelCls = "text-caption font-semibold tracking-widest text-[var(--color-ink-400)] uppercase block mb-1.5";

  const save = () =>
    startTransition(async () => {
      const r = await saveSurgicalCounselling(visit.id, udid, { eye, name, anaesthesia, date, notes });
      if (r.error) { setError(r.error); return; }
      setIsSaved(true);
      setSavedMsg(true);
    });

  const resetFields = () => {
    setEye(""); setName(""); setAnaesthesia(""); setDate(""); setNotes(""); touch();
  };

  // Cancel resets every field and removes what was saved for this visit.
  const cancel = () => {
    if (!isSaved) { resetFields(); return; }
    setConfirmClear(true);
  };

  const doClear = () =>
    startTransition(async () => {
      setConfirmClear(false);
      const r = await clearSurgicalCounselling(visit.id, udid);
      if (r.error) { setError(r.error); return; }
      resetFields();
      setIsSaved(false);
    });

  if (overview) {
    if (!visit.surgeryAdvised) return null;
    return (
      <div className="rounded-xl border border-[var(--color-border)] p-4 flex flex-col gap-1">
        <p className={labelCls}>Surgical Counselling</p>
        <p className="text-label sm:text-sm text-[var(--color-ink-700)]">
          {[visit.advisedSurgeryEye, visit.advisedSurgeryName, visit.advisedSurgeryAnaesthesia].filter(Boolean).join(" · ")}
        </p>
        {visit.advisedSurgeryDate && (
          <p className="text-label sm:text-sm text-[var(--color-ink-500)]">
            Tentative date: {new Date(visit.advisedSurgeryDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
          </p>
        )}
        {movedTo && (
          <p className="text-label sm:text-sm text-amber-700">
            {visit.advisedSurgeryDate ? "Rescheduled to " : "Tentative date: "}
            {movedTo.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
            {visit.advisedSurgeryDate ? " (Counselling)" : " (set in Counselling)"}
          </p>
        )}
        {visit.advisedSurgeryNotes && <p className="text-label sm:text-sm text-[var(--color-ink-500)] whitespace-pre-line">{visit.advisedSurgeryNotes}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] p-4 flex flex-col gap-4">
      {/* Line 1 — laterality, surgery, anaesthesia */}
      <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr] gap-3 items-start">
        <div className="shrink-0">
          <label className={labelCls}>Laterality</label>
          <div className="flex gap-1">
            {(["RE", "LE", "OU"] as const).map((lat) => (
              <button
                key={lat}
                type="button"
                onClick={() => { setEye(eye === lat ? "" : lat); touch(); }}
                className={`w-10 py-2 rounded-lg border text-xs font-bold transition-colors ${
                  eye === lat
                    ? "bg-[var(--color-primary-600)] border-[var(--color-primary-600)] text-white"
                    : "border-[var(--color-border)] text-[var(--color-ink-500)] hover:border-[var(--color-primary-300)] hover:text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)]"
                }`}
              >
                {lat}
              </button>
            ))}
          </div>
        </div>
        <div className="min-w-0">
          <label className={labelCls}>Name of Surgery</label>
          <SearchCombo value={name} onChange={(v) => { setName(v); touch(); }} options={SURGERY_OPTIONS} libraryKey={SURGERY_LIBRARY_KEY} placeholder="Search or type a surgery…" />
        </div>
        <div className="min-w-0">
          <label className={labelCls}>Type of Anesthesia</label>
          <SearchCombo value={anaesthesia} onChange={(v) => { setAnaesthesia(v); touch(); }} options={ANAESTHESIA_OPTIONS} libraryKey={ANAESTHESIA_LIBRARY_KEY} placeholder="Search anesthesia…" />
        </div>
      </div>

      {/* Line 2 — tentative date, notes */}
      <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-3 items-start">
        <div>
          <label className={labelCls}>Tentative Date</label>
          <input
            type="date"
            value={date}
            min={istTodayStr()}
            onChange={(e) => { setDate(e.target.value); touch(); }}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-transparent"
          />
          {movedTo && (
            <p className="mt-1 text-caption text-amber-700">
              {visit.advisedSurgeryDate ? "Rescheduled to " : "Set in Counselling: "}
              {movedTo.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
              {visit.advisedSurgeryDate ? " (Counselling)" : ""}
            </p>
          )}
        </div>
        <div className="min-w-0">
          <label className={labelCls}>Notes</label>
          <KeywordTextarea
            fieldKey="surgical_counselling_notes"
            builtIns={SURGICAL_NOTE_KEYWORDS}
            value={notes}
            onChange={(v) => { setNotes(v); touch(); }}
            rows={1}
            placeholder="Select a keyword below or type notes…"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600 flex items-center gap-1.5"><AlertTriangle size={14} /> {error}</p>}

      <div data-overview-hide className="flex items-center gap-3">
        <button
          disabled={pending || !name.trim()}
          onClick={save}
          className="text-label sm:text-sm font-medium px-4 py-2 rounded-lg bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] disabled:opacity-60 transition-colors"
        >
          Save
        </button>
        <button
          disabled={pending}
          onClick={cancel}
          className="text-label sm:text-sm font-medium px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] disabled:opacity-60 transition-colors"
        >
          Cancel
        </button>
        {savedMsg && <span className="text-xs text-[var(--color-success-600)] font-medium">Saved · goes to Counselling after Finalize &amp; Sign</span>}
      </div>

      {confirmClear && (
        <ConfirmDialog
          title="Remove surgical counselling?"
          message="This clears all fields and removes the saved surgery for this visit, so the patient will not go to Counselling."
          confirmLabel="Remove"
          onConfirm={doClear}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </div>
  );
}
