"use client";

import { useState, useTransition } from "react";
import { SingleChipSelect } from "@/components/ui/Chip";
import { WARDS, ANAESTHESIA_TYPES, SURGERY_TYPES } from "@/lib/constants";
import { saveDispense, saveAdmission, saveSurgicalCounselling } from "./actions";
import { AlertTriangle, Download } from "lucide-react";

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
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await saveDispense(visit.id, udid, summary);
            setSaved(true);
          })
        }
        className="mt-3 text-sm font-medium px-4 py-2 rounded-lg bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)]"
      >
        Finalise Dispense Summary
      </button>
      {saved && <span className="ml-3 text-xs text-[var(--color-success-600)] font-medium">Saved</span>}
      <a
        href={`/api/dispense-pdf/${visit.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 mt-3 ml-2 text-sm font-medium px-4 py-2 rounded-lg bg-white border border-[var(--color-border)] hover:border-[var(--color-primary-500)] text-[var(--color-ink-700)]"
      >
        <Download size={14} /> Download Long Summary (PDF)
      </a>
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
