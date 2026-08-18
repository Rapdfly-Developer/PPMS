"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ArrowLeft, Loader2, FileText } from "lucide-react";
import { saveConsent } from "../surgery-actions";

type Existing = {
  patientName: string; attendantName: string; relationship: string;
  surgeryExplained: boolean; risksExplained: boolean;
  alternativesExplained: boolean; questionsAnswered: boolean;
  consentGiven: boolean; notes: string;
};

export function ConsentForm({
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
    patientName:           existing?.patientName           ?? patientName,
    attendantName:         existing?.attendantName         ?? "",
    relationship:          existing?.relationship          ?? "",
    surgeryExplained:      existing?.surgeryExplained      ?? false,
    risksExplained:        existing?.risksExplained        ?? false,
    alternativesExplained: existing?.alternativesExplained ?? false,
    questionsAnswered:     existing?.questionsAnswered     ?? false,
    consentGiven:          existing?.consentGiven          ?? false,
    notes:                 existing?.notes                 ?? "",
  });

  function toggle(key: keyof Existing) {
    setForm((f) => ({ ...f, [key]: !f[key] }));
  }

  function handleSave() {
    setErr("");
    start(async () => {
      const res = await saveConsent({ surgeryScheduleId: scheduleId, ...form });
      if (res.error) { setErr(res.error); return; }
      setSaved(true);
      setTimeout(() => router.push("/scheduled-ot"), 1200);
    });
  }

  const allChecked = form.surgeryExplained && form.risksExplained && form.alternativesExplained && form.questionsAnswered;

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
          <h1 className="text-lg font-bold text-[var(--color-ink-900)]">Patient Consent</h1>
          <p className="text-xs text-[var(--color-ink-400)]">{surgeryName} · {patientName}</p>
        </div>
      </div>

      {/* Patient / Attendant */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white p-5 space-y-4">
        <h2 className="text-sm font-bold text-[var(--color-ink-700)] flex items-center gap-2">
          <FileText size={14} className="text-[var(--color-primary-500)]" /> Patient Details
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Patient Name *">
            <input
              value={form.patientName}
              onChange={(e) => setForm((f) => ({ ...f, patientName: e.target.value }))}
              className={INPUT}
            />
          </Field>
          <Field label="Attendant Name">
            <input
              value={form.attendantName}
              onChange={(e) => setForm((f) => ({ ...f, attendantName: e.target.value }))}
              placeholder="Guardian / relative"
              className={INPUT}
            />
          </Field>
          <Field label="Relationship to Patient">
            <input
              value={form.relationship}
              onChange={(e) => setForm((f) => ({ ...f, relationship: e.target.value }))}
              placeholder="e.g. Spouse, Parent"
              className={INPUT}
            />
          </Field>
        </div>
      </div>

      {/* Consent checklist */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white p-5 space-y-4">
        <h2 className="text-sm font-bold text-[var(--color-ink-700)]">Informed Consent Checklist</h2>
        <div className="space-y-3">
          {([
            { key: "surgeryExplained",      label: "Surgery procedure has been explained to the patient." },
            { key: "risksExplained",        label: "Risks and potential complications have been explained." },
            { key: "alternativesExplained", label: "Alternative treatments have been discussed." },
            { key: "questionsAnswered",     label: "Patient's questions have been answered satisfactorily." },
          ] as { key: keyof Existing; label: string }[]).map(({ key, label }) => (
            <label key={key} className="flex items-start gap-3 cursor-pointer group">
              <div
                onClick={() => toggle(key)}
                className={`mt-0.5 w-4.5 h-4.5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                  form[key] ? "bg-emerald-600 border-emerald-600" : "border-[var(--color-border)] bg-white group-hover:border-emerald-400"
                }`}
              >
                {form[key] && <CheckCircle2 size={11} className="text-white" />}
              </div>
              <span className="text-sm text-[var(--color-ink-700)]">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Consent given */}
      <div className={`rounded-xl border p-5 space-y-3 ${form.consentGiven ? "border-emerald-300 bg-emerald-50" : "border-[var(--color-border)] bg-white"}`}>
        <h2 className="text-sm font-bold text-[var(--color-ink-700)]">Final Consent Decision</h2>
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => toggle("consentGiven")}
            className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
              form.consentGiven ? "bg-emerald-600 border-emerald-600" : "border-[var(--color-border)] bg-white hover:border-emerald-400"
            }`}
          >
            {form.consentGiven && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
          </div>
          <span className="text-sm font-semibold text-[var(--color-ink-800)]">
            Patient / guardian has given informed consent for the surgery.
          </span>
        </label>
        {!allChecked && form.consentGiven && (
          <p className="text-xs text-amber-600 mt-1">Please complete all checklist items above before marking consent given.</p>
        )}
      </div>

      {/* Notes */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white p-5 space-y-3">
        <h2 className="text-sm font-bold text-[var(--color-ink-700)]">Additional Notes</h2>
        <textarea
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          rows={3}
          placeholder="Any special observations or concerns…"
          className={`${INPUT} resize-none`}
        />
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}
      {saved && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold">
          <CheckCircle2 size={15} /> Consent saved. Returning…
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={pending || !form.patientName}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary-600)] text-white text-sm font-semibold hover:bg-[var(--color-primary-700)] disabled:opacity-50 transition-colors"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          {existing ? "Update Consent" : "Save Consent"}
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
