"use client";

import { useState, useTransition } from "react";
import { SingleChipSelect } from "@/components/ui/Chip";
import { WARDS, ANAESTHESIA_TYPES, SURGERY_TYPES } from "@/lib/constants";
import { saveDispense, saveAdmission, saveSurgicalCounselling, saveFollowUp } from "./actions";
import { AlertTriangle } from "lucide-react";

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

export function FollowUpdatesPanel({ visit, udid }: { visit: any; udid: string }) {
  const toInputDate = (d: any) => d ? new Date(d).toISOString().slice(0, 10) : "";
  const [followUpDate, setFollowUpDate] = useState(toInputDate(visit.followUpDate));
  const [referralEnabled, setReferralEnabled] = useState(visit.referralEnabled ?? false);
  const [referralNote, setReferralNote] = useState(visit.referralNote ?? "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

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
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  const chipCls = "px-3 py-1 rounded-full text-xs border border-[var(--color-border)] bg-white text-[var(--color-ink-600)] hover:border-[var(--color-primary-400)] hover:bg-[var(--color-primary-50)] transition-colors";

  const save = () =>
    startTransition(async () => {
      await saveFollowUp(visit.id, udid, { followUpDate: followUpDate || null, referralEnabled, referralNote });
      setSaved(true);
    });

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
  const [surgeryType, setSurgeryType] = useState(sc?.surgeryType ?? SURGERY_TYPES[0]);
  const [rightEye, setRightEye] = useState(sc?.rightEye ?? false);
  const [leftEye, setLeftEye] = useState(sc?.leftEye ?? false);
  const [anaesthesiaType, setAnaesthesiaType] = useState(sc?.anaesthesiaType ?? ANAESTHESIA_TYPES[0]);
  const [surgeryDate, setSurgeryDate] = useState(sc?.surgeryDate ? new Date(sc.surgeryDate).toISOString().slice(0, 10) : "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <div className="rounded-xl border border-[var(--color-border)] p-4">
      <p className="text-sm font-medium text-[var(--color-ink-700)] mb-3">Surgical Counselling</p>
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-xs font-medium text-[var(--color-ink-500)] mb-1.5">Type of Surgery</p>
          <SingleChipSelect options={SURGERY_TYPES} value={surgeryType} onChange={setSurgeryType} />
        </div>
        <div>
          <p className="text-xs font-medium text-[var(--color-ink-500)] mb-1.5">Eye Selection</p>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={rightEye} onChange={(e) => setRightEye(e.target.checked)} /> Right Eye</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={leftEye} onChange={(e) => setLeftEye(e.target.checked)} /> Left Eye</label>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-[var(--color-ink-500)] mb-1.5">Type of Anaesthesia</p>
          <SingleChipSelect options={ANAESTHESIA_TYPES} value={anaesthesiaType} onChange={setAnaesthesiaType} />
        </div>
        <div className="max-w-[200px]">
          <label className="text-xs font-medium text-[var(--color-ink-500)]">Date of Surgery</label>
          <input type="date" value={surgeryDate} onChange={(e) => setSurgeryDate(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm" />
        </div>
      </div>

      {sc?.conflictFlag && (
        <p className="flex items-center gap-1.5 text-xs text-[var(--color-danger-600)] bg-[var(--color-danger-100)] rounded-lg px-3 py-2 mt-3">
          <AlertTriangle size={13} /> Potential scheduling conflict with an existing appointment on this date.
        </p>
      )}

      <button
        disabled={pending || !surgeryDate}
        onClick={() =>
          startTransition(async () => {
            await saveSurgicalCounselling(visit.id, udid, { surgeryType, rightEye, leftEye, anaesthesiaType, surgeryDate });
            setSaved(true);
          })
        }
        className="mt-3 text-sm font-medium px-4 py-2 rounded-lg bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] disabled:opacity-50"
      >
        Save Surgical Counselling
      </button>
      {saved && <span className="ml-3 text-xs text-[var(--color-success-600)] font-medium">Saved</span>}
    </div>
  );
}
