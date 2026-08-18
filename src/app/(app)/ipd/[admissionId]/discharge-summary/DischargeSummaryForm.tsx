"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, FileText, CheckCircle2, AlertCircle, Printer, Save,
  User, Stethoscope, Pill, Calendar, ClipboardList, Activity,
} from "lucide-react";
import { format } from "date-fns";
import { saveDischargeSummary } from "../../actions";

// ── Types ────────────────────────────────────────────────────────────────────

type Props = {
  admission: { id: string; discharged: boolean; dischargedAt: string | null; createdAt: string; ward: string; reason: string };
  patient: { name: string; udid: string; age: number; sex: string; mobile: string | null };
  visit: { date: string; doctorName: string; hospitalName: string };
  otRecord: { procedurePerformed: string | null; iolModel: string | null; iolPower: string | null; complications: string | null; anesthesiaTypeRecorded: string | null; surgeryScheduleId: string } | null;
  medications: { drugName: string; dosage: string; frequency: string; duration: string; instructions: string }[];
  diagnoses: { description: string; laterality: string | null }[];
  existing: {
    id: string; surgeryPerformed: string; operatingEye: string; anesthesiaUsed: string; iolDetails: string;
    postOpDiagnosis: string; intraopComplications: string; postOpCourse: string; conditionAtDischarge: string;
    dischargeMedications: string; dischargeInstructions: string; activityRestrictions: string;
    dietAdvice: string; woundCareInstructions: string; followUpDate: string; followUpInstructions: string;
  } | null;
};

const CONDITIONS = [
  { value: "STABLE",        label: "Stable",          color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  { value: "IMPROVED",      label: "Improved",         color: "text-blue-700 bg-blue-50 border-blue-200" },
  { value: "AGAINST_ADVICE",label: "Against Medical Advice", color: "text-orange-700 bg-orange-50 border-orange-200" },
  { value: "TRANSFERRED",   label: "Transferred",      color: "text-purple-700 bg-purple-50 border-purple-200" },
];

const EYE_OPTIONS = [
  { value: "RE", label: "Right Eye (RE)" },
  { value: "LE", label: "Left Eye (LE)" },
  { value: "BE", label: "Both Eyes (BE)" },
];

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-[var(--color-border)]">
      <Icon size={15} className="text-[var(--color-primary)]" />
      <h2 className="text-sm font-semibold text-[var(--color-ink-800)]">{title}</h2>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-ink-900)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent placeholder:text-[var(--color-ink-300)]";
const textareaCls = inputCls + " resize-none";

export default function DischargeSummaryForm({
  admission, patient, visit, otRecord, medications, diagnoses, existing,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill from OT record
  const defaultSurgery = otRecord?.procedurePerformed ?? "";
  const defaultEye = "";
  const defaultAnesthesia = otRecord?.anesthesiaTypeRecorded ?? "";
  const defaultIol = otRecord?.iolModel && otRecord?.iolPower ? `${otRecord.iolModel} ${otRecord.iolPower}` : "";
  const defaultDiagnosis = diagnoses.map(d => (d.laterality ? `${d.laterality} ` : "") + d.description).join("; ");
  const defaultComplications = otRecord?.complications ?? "";
  const defaultMeds = medications.length
    ? JSON.stringify(medications.map(m => ({ drugName: m.drugName, dosage: m.dosage, frequency: m.frequency, duration: m.duration, instructions: m.instructions })))
    : "";

  const [form, setForm] = useState({
    surgeryPerformed:     existing?.surgeryPerformed     ?? defaultSurgery,
    operatingEye:         existing?.operatingEye         ?? defaultEye,
    anesthesiaUsed:       existing?.anesthesiaUsed       ?? defaultAnesthesia,
    iolDetails:           existing?.iolDetails           ?? defaultIol,
    postOpDiagnosis:      existing?.postOpDiagnosis      ?? defaultDiagnosis,
    intraopComplications: existing?.intraopComplications ?? defaultComplications,
    postOpCourse:         existing?.postOpCourse         ?? "",
    conditionAtDischarge: existing?.conditionAtDischarge ?? "STABLE",
    dischargeMedications: existing?.dischargeMedications ?? defaultMeds,
    dischargeInstructions:existing?.dischargeInstructions ?? "",
    activityRestrictions: existing?.activityRestrictions ?? "",
    dietAdvice:           existing?.dietAdvice           ?? "",
    woundCareInstructions:existing?.woundCareInstructions ?? "",
    followUpDate:         existing?.followUpDate         ?? "",
    followUpInstructions: existing?.followUpInstructions ?? "",
  });

  // Discharge meds as editable rows
  const parsedMeds: { drugName: string; dosage: string; frequency: string; duration: string; instructions: string }[] = (() => {
    try { return JSON.parse(form.dischargeMedications); } catch { return []; }
  })();

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  function updateMed(idx: number, field: string, value: string) {
    const meds = [...parsedMeds];
    (meds[idx] as any)[field] = value;
    setForm(f => ({ ...f, dischargeMedications: JSON.stringify(meds) }));
  }
  function addMed() {
    const meds = [...parsedMeds, { drugName: "", dosage: "", frequency: "", duration: "", instructions: "" }];
    setForm(f => ({ ...f, dischargeMedications: JSON.stringify(meds) }));
  }
  function removeMed(idx: number) {
    const meds = parsedMeds.filter((_, i) => i !== idx);
    setForm(f => ({ ...f, dischargeMedications: JSON.stringify(meds) }));
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await saveDischargeSummary({ admissionId: admission.id, ...form });
      if (res.error) { setError(res.error); return; }
      setSaved(true);
    });
  }

  const conditionInfo = CONDITIONS.find(c => c.value === form.conditionAtDischarge);

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-[var(--color-border)] px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/ipd" className="p-1.5 rounded-lg hover:bg-[var(--color-ink-50)] text-[var(--color-ink-500)]">
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <p className="text-xs text-[var(--color-ink-400)]">Discharge Summary</p>
            <p className="font-semibold text-sm text-[var(--color-ink-900)] truncate">{patient.name} · {patient.udid}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {saved && (
            <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
              <CheckCircle2 size={13} /> Saved
            </span>
          )}
          {existing && (
            <a
              href={`/api/discharge-summary-pdf/${admission.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-ink-50)] text-[var(--color-ink-700)]"
            >
              <Printer size={14} /> Print PDF
            </a>
          )}
          <button
            onClick={handleSave}
            disabled={pending}
            className="flex items-center gap-1.5 text-xs font-semibold px-4 py-1.5 rounded-lg bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50"
          >
            <Save size={14} /> {pending ? "Saving…" : "Save Summary"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-4 sm:mx-6 mt-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Patient info strip */}
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            ["Patient", patient.name],
            ["UHID", patient.udid],
            ["Age / Sex", `${patient.age} yrs / ${patient.sex}`],
            ["Admission Date", format(new Date(admission.createdAt), "dd MMM yyyy")],
            ["Doctor", `Dr. ${visit.doctorName}`],
            ["Hospital", visit.hospitalName],
            ["Ward", admission.ward.replace("_", " ")],
            ["Status", admission.discharged ? `Discharged ${admission.dischargedAt ? format(new Date(admission.dischargedAt), "dd MMM yyyy") : ""}` : "Admitted"],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-400)]">{label}</p>
              <p className="text-sm font-medium text-[var(--color-ink-900)] mt-0.5">{value}</p>
            </div>
          ))}
        </div>

        {/* Section 1: Surgery Details */}
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
          <SectionHeader icon={Stethoscope} title="Surgery Details" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Surgery / Procedure performed">
              <input className={inputCls} value={form.surgeryPerformed} onChange={set("surgeryPerformed")} placeholder="e.g. SICS, Phacoemulsification" />
            </Field>
            <Field label="Operating Eye">
              <select className={inputCls} value={form.operatingEye} onChange={set("operatingEye")}>
                <option value="">Select eye</option>
                {EYE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Anesthesia used">
              <input className={inputCls} value={form.anesthesiaUsed} onChange={set("anesthesiaUsed")} placeholder="e.g. Topical, Peribulbar, GA" />
            </Field>
            <Field label="IOL details (model / power)">
              <input className={inputCls} value={form.iolDetails} onChange={set("iolDetails")} placeholder="e.g. Acrysof IQ +22.0D" />
            </Field>
          </div>
        </div>

        {/* Section 2: Clinical Outcome */}
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
          <SectionHeader icon={Activity} title="Clinical Outcome" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Post-op diagnosis">
              <input className={inputCls} value={form.postOpDiagnosis} onChange={set("postOpDiagnosis")} placeholder="e.g. Senile cataract OU" />
            </Field>
            <Field label="Intra-op complications">
              <input className={inputCls} value={form.intraopComplications} onChange={set("intraopComplications")} placeholder="None / describe" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Post-op course">
                <textarea className={textareaCls} rows={3} value={form.postOpCourse} onChange={set("postOpCourse")} placeholder="Recovery details, any events during stay…" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Condition at discharge">
                <div className="flex flex-wrap gap-2 mt-1">
                  {CONDITIONS.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, conditionAtDischarge: c.value }))}
                      className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${form.conditionAtDischarge === c.value ? c.color + " ring-2 ring-offset-1 ring-current" : "border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-ink-50)]"}`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          </div>
        </div>

        {/* Section 3: Discharge Medications */}
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
          <SectionHeader icon={Pill} title="Discharge Medications" />
          <div className="space-y-3">
            {parsedMeds.length === 0 && (
              <p className="text-sm text-[var(--color-ink-400)] italic">No medications added.</p>
            )}
            {parsedMeds.map((m, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-start bg-[var(--color-ink-50)] rounded-lg p-3">
                <div className="col-span-12 sm:col-span-4">
                  <input className={inputCls} placeholder="Drug name" value={m.drugName} onChange={e => updateMed(i, "drugName", e.target.value)} />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <input className={inputCls} placeholder="Dosage" value={m.dosage} onChange={e => updateMed(i, "dosage", e.target.value)} />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <input className={inputCls} placeholder="Frequency" value={m.frequency} onChange={e => updateMed(i, "frequency", e.target.value)} />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <input className={inputCls} placeholder="Duration" value={m.duration} onChange={e => updateMed(i, "duration", e.target.value)} />
                </div>
                <div className="col-span-8 sm:col-span-1">
                  <input className={inputCls} placeholder="Notes" value={m.instructions} onChange={e => updateMed(i, "instructions", e.target.value)} />
                </div>
                <div className="col-span-4 sm:col-span-1 flex items-center justify-end">
                  <button onClick={() => removeMed(i)} className="text-red-500 hover:text-red-700 text-xs font-medium px-2 py-2">✕</button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addMed}
              className="text-sm font-medium text-[var(--color-primary)] hover:underline"
            >
              + Add medication
            </button>
          </div>
        </div>

        {/* Section 4: Instructions */}
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
          <SectionHeader icon={ClipboardList} title="Discharge Instructions" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field label="Discharge instructions">
                <textarea className={textareaCls} rows={3} value={form.dischargeInstructions} onChange={set("dischargeInstructions")} placeholder="Eye care, hygiene, when to return…" />
              </Field>
            </div>
            <Field label="Activity restrictions">
              <textarea className={textareaCls} rows={2} value={form.activityRestrictions} onChange={set("activityRestrictions")} placeholder="No heavy lifting, avoid water in eyes…" />
            </Field>
            <Field label="Wound care instructions">
              <textarea className={textareaCls} rows={2} value={form.woundCareInstructions} onChange={set("woundCareInstructions")} placeholder="Eye shield at night, clean with cotton…" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Diet advice">
                <input className={inputCls} value={form.dietAdvice} onChange={set("dietAdvice")} placeholder="No specific restrictions / describe" />
              </Field>
            </div>
          </div>
        </div>

        {/* Section 5: Follow-up */}
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
          <SectionHeader icon={Calendar} title="Follow-Up" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Follow-up date">
              <input type="date" className={inputCls} value={form.followUpDate} onChange={set("followUpDate")} />
            </Field>
            <Field label="Follow-up instructions">
              <input className={inputCls} value={form.followUpInstructions} onChange={set("followUpInstructions")} placeholder="Review VA, suture removal, etc." />
            </Field>
          </div>
        </div>

        {/* Save bottom */}
        <div className="flex justify-end gap-3 pb-10">
          <Link href="/ipd" className="px-5 py-2 text-sm rounded-lg border border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-ink-50)]">
            Back to IPD
          </Link>
          <button
            onClick={handleSave}
            disabled={pending}
            className="flex items-center gap-1.5 px-6 py-2 text-sm font-semibold rounded-lg bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50"
          >
            <Save size={15} /> {pending ? "Saving…" : "Save Discharge Summary"}
          </button>
        </div>

      </div>
    </div>
  );
}
