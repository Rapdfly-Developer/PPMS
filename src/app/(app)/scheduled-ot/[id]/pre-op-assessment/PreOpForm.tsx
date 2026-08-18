"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, CheckCircle2, Activity } from "lucide-react";
import { savePreOpAssessment } from "../surgery-actions";

type Existing = {
  hasDiabetes: boolean; hasHypertension: boolean; hasCardiacDisease: boolean;
  hasAsthma: boolean; hasKidneyDisease: boolean; otherConditions: string;
  currentMedications: string; allergies: string; nkda: boolean;
  bloodSugarLevel: string; bpReading: string; ecgNormal: boolean | null;
  investigationNotes: string; asaGrade: string; anesthesiaFitness: string;
  fitnessNotes: string; assessedBy: string;
};

const FITNESS_OPTIONS = [
  { value: "FIT",          label: "Fit",          color: "emerald" },
  { value: "FIT_WITH_RISK", label: "Fit with Risk", color: "amber" },
  { value: "UNFIT",        label: "Unfit",         color: "red" },
];

export function PreOpForm({
  scheduleId, surgeryName, patientName, existing,
}: {
  scheduleId: string; surgeryName: string; patientName: string;
  existing: Existing | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState<Existing>({
    hasDiabetes:       existing?.hasDiabetes       ?? false,
    hasHypertension:   existing?.hasHypertension   ?? false,
    hasCardiacDisease: existing?.hasCardiacDisease  ?? false,
    hasAsthma:         existing?.hasAsthma          ?? false,
    hasKidneyDisease:  existing?.hasKidneyDisease   ?? false,
    otherConditions:   existing?.otherConditions    ?? "",
    currentMedications: existing?.currentMedications ?? "",
    allergies:         existing?.allergies          ?? "",
    nkda:              existing?.nkda               ?? false,
    bloodSugarLevel:   existing?.bloodSugarLevel    ?? "",
    bpReading:         existing?.bpReading          ?? "",
    ecgNormal:         existing?.ecgNormal          ?? null,
    investigationNotes: existing?.investigationNotes ?? "",
    asaGrade:          existing?.asaGrade           ?? "",
    anesthesiaFitness: existing?.anesthesiaFitness  ?? "FIT",
    fitnessNotes:      existing?.fitnessNotes       ?? "",
    assessedBy:        existing?.assessedBy         ?? "",
  });

  function check(key: keyof Existing) {
    setForm((f) => ({ ...f, [key]: !f[key] }));
  }

  function handleSave() {
    setErr("");
    start(async () => {
      const res = await savePreOpAssessment({ surgeryScheduleId: scheduleId, ...form });
      if (res.error) { setErr(res.error); return; }
      setSaved(true);
      setTimeout(() => router.push("/scheduled-ot"), 1200);
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 rounded-lg border border-[var(--color-border)] flex items-center justify-center text-[var(--color-ink-400)] hover:bg-[var(--color-surface-sunken)] transition-colors"
        >
          <ArrowLeft size={15} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-[var(--color-ink-900)]">Pre-Op Assessment</h1>
          <p className="text-xs text-[var(--color-ink-400)]">{surgeryName} · {patientName}</p>
        </div>
      </div>

      {/* Comorbidities */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white p-5 space-y-4">
        <h2 className="text-sm font-bold text-[var(--color-ink-700)] flex items-center gap-2">
          <Activity size={14} className="text-[var(--color-primary-500)]" /> Comorbidities
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {([
            { key: "hasDiabetes",       label: "Diabetes" },
            { key: "hasHypertension",   label: "Hypertension" },
            { key: "hasCardiacDisease", label: "Cardiac Disease" },
            { key: "hasAsthma",         label: "Asthma" },
            { key: "hasKidneyDisease",  label: "Kidney Disease" },
          ] as { key: keyof Existing; label: string }[]).map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form[key] as boolean}
                onChange={() => check(key)}
                className="w-4 h-4 rounded accent-[var(--color-primary-600)]"
              />
              <span className="text-sm text-[var(--color-ink-700)]">{label}</span>
            </label>
          ))}
        </div>
        <Field label="Other Conditions">
          <textarea
            value={form.otherConditions}
            onChange={(e) => setForm((f) => ({ ...f, otherConditions: e.target.value }))}
            rows={2}
            placeholder="Describe any other conditions…"
            className={`${INPUT} resize-none`}
          />
        </Field>
      </div>

      {/* Medications & Allergies */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white p-5 space-y-4">
        <h2 className="text-sm font-bold text-[var(--color-ink-700)]">Medications & Allergies</h2>
        <Field label="Current Medications">
          <textarea
            value={form.currentMedications}
            onChange={(e) => setForm((f) => ({ ...f, currentMedications: e.target.value }))}
            rows={2}
            placeholder="List current medications…"
            className={`${INPUT} resize-none`}
          />
        </Field>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.nkda}
              onChange={() => check("nkda")}
              className="w-4 h-4 rounded accent-[var(--color-primary-600)]"
            />
            <span className="text-sm font-semibold text-[var(--color-ink-700)]">NKDA (No Known Drug Allergies)</span>
          </label>
        </div>
        {!form.nkda && (
          <Field label="Allergies">
            <input
              value={form.allergies}
              onChange={(e) => setForm((f) => ({ ...f, allergies: e.target.value }))}
              placeholder="List drug/substance allergies…"
              className={INPUT}
            />
          </Field>
        )}
      </div>

      {/* Investigations */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white p-5 space-y-4">
        <h2 className="text-sm font-bold text-[var(--color-ink-700)]">Pre-Op Investigations</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Blood Sugar (mg/dL)">
            <input
              value={form.bloodSugarLevel}
              onChange={(e) => setForm((f) => ({ ...f, bloodSugarLevel: e.target.value }))}
              placeholder="e.g. 110"
              className={INPUT}
            />
          </Field>
          <Field label="BP Reading (mmHg)">
            <input
              value={form.bpReading}
              onChange={(e) => setForm((f) => ({ ...f, bpReading: e.target.value }))}
              placeholder="e.g. 120/80"
              className={INPUT}
            />
          </Field>
          <Field label="ECG">
            <div className="flex gap-3">
              {([
                { val: true,  label: "Normal" },
                { val: false, label: "Abnormal" },
                { val: null,  label: "Not done" },
              ] as { val: boolean | null; label: string }[]).map(({ val, label }) => (
                <label key={label} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    checked={form.ecgNormal === val}
                    onChange={() => setForm((f) => ({ ...f, ecgNormal: val }))}
                    className="accent-[var(--color-primary-600)]"
                  />
                  <span className="text-sm text-[var(--color-ink-700)]">{label}</span>
                </label>
              ))}
            </div>
          </Field>
          <Field label="ASA Grade">
            <select
              value={form.asaGrade}
              onChange={(e) => setForm((f) => ({ ...f, asaGrade: e.target.value }))}
              className={INPUT}
            >
              <option value="">Select…</option>
              {["I", "II", "III", "IV", "V", "VI"].map((g) => (
                <option key={g} value={g}>ASA {g}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Investigation Notes">
          <textarea
            value={form.investigationNotes}
            onChange={(e) => setForm((f) => ({ ...f, investigationNotes: e.target.value }))}
            rows={2}
            placeholder="Any other investigation findings…"
            className={`${INPUT} resize-none`}
          />
        </Field>
      </div>

      {/* Anesthesia Fitness */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white p-5 space-y-4">
        <h2 className="text-sm font-bold text-[var(--color-ink-700)]">Anesthesia Fitness</h2>
        <div className="flex gap-3 flex-wrap">
          {FITNESS_OPTIONS.map(({ value, label, color }) => (
            <button
              key={value}
              type="button"
              onClick={() => setForm((f) => ({ ...f, anesthesiaFitness: value }))}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                form.anesthesiaFitness === value
                  ? color === "emerald"
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : color === "amber"
                    ? "bg-amber-500 text-white border-amber-500"
                    : "bg-red-600 text-white border-red-600"
                  : "bg-white text-[var(--color-ink-500)] border-[var(--color-border)] hover:bg-[var(--color-surface-sunken)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Field label="Fitness Notes">
          <textarea
            value={form.fitnessNotes}
            onChange={(e) => setForm((f) => ({ ...f, fitnessNotes: e.target.value }))}
            rows={2}
            placeholder="e.g. Optimise BP before surgery…"
            className={`${INPUT} resize-none`}
          />
        </Field>
        <Field label="Assessed By">
          <input
            value={form.assessedBy}
            onChange={(e) => setForm((f) => ({ ...f, assessedBy: e.target.value }))}
            placeholder="Name of assessing doctor / anesthetist"
            className={INPUT}
          />
        </Field>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}
      {saved && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold">
          <CheckCircle2 size={15} /> Assessment saved. Returning…
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={pending}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary-600)] text-white text-sm font-semibold hover:bg-[var(--color-primary-700)] disabled:opacity-50 transition-colors"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          {existing ? "Update Assessment" : "Save Assessment"}
        </button>
        <button
          onClick={() => router.back()}
          className="px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-ink-500)] hover:bg-[var(--color-surface-sunken)] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

const INPUT = "w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] placeholder:text-[var(--color-ink-300)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold text-[var(--color-ink-400)] uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}
