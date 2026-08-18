"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, CheckCircle2, Eye } from "lucide-react";
import { savePostOpReview } from "../surgery-actions";

type Existing = {
  reVaUnaided: string; leVaUnaided: string;
  reBcva: string; leBcva: string;
  iopRe: string; iopLe: string;
  woundStatus: string; iolPosition: string; anteriorChamber: string;
  fundusNotes: string; complications: string;
  postOpMedications: string; instructions: string;
  followUpDate: string; reviewNotes: string;
};

export function PostOpForm({
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
    reVaUnaided:       existing?.reVaUnaided       ?? "",
    leVaUnaided:       existing?.leVaUnaided       ?? "",
    reBcva:            existing?.reBcva            ?? "",
    leBcva:            existing?.leBcva            ?? "",
    iopRe:             existing?.iopRe             ?? "",
    iopLe:             existing?.iopLe             ?? "",
    woundStatus:       existing?.woundStatus       ?? "",
    iolPosition:       existing?.iolPosition       ?? "",
    anteriorChamber:   existing?.anteriorChamber   ?? "",
    fundusNotes:       existing?.fundusNotes       ?? "",
    complications:     existing?.complications     ?? "",
    postOpMedications: existing?.postOpMedications ?? "",
    instructions:      existing?.instructions      ?? "",
    followUpDate:      existing?.followUpDate      ?? "",
    reviewNotes:       existing?.reviewNotes       ?? "",
  });

  function handleSave() {
    setErr("");
    start(async () => {
      const res = await savePostOpReview({ surgeryScheduleId: scheduleId, ...form });
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
          <h1 className="text-lg font-bold text-[var(--color-ink-900)]">Post-Op Review</h1>
          <p className="text-xs text-[var(--color-ink-400)]">{surgeryName} · {patientName}</p>
        </div>
      </div>

      {/* Visual Acuity */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white p-5 space-y-4">
        <h2 className="text-sm font-bold text-[var(--color-ink-700)] flex items-center gap-2">
          <Eye size={14} className="text-[var(--color-primary-500)]" /> Visual Acuity
        </h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <Field label="RE VA Unaided">
            <input value={form.reVaUnaided} onChange={(e) => setForm((f) => ({ ...f, reVaUnaided: e.target.value }))} placeholder="e.g. 6/60" className={INPUT} />
          </Field>
          <Field label="LE VA Unaided">
            <input value={form.leVaUnaided} onChange={(e) => setForm((f) => ({ ...f, leVaUnaided: e.target.value }))} placeholder="e.g. 6/60" className={INPUT} />
          </Field>
          <Field label="RE BCVA">
            <input value={form.reBcva} onChange={(e) => setForm((f) => ({ ...f, reBcva: e.target.value }))} placeholder="e.g. 6/9" className={INPUT} />
          </Field>
          <Field label="LE BCVA">
            <input value={form.leBcva} onChange={(e) => setForm((f) => ({ ...f, leBcva: e.target.value }))} placeholder="e.g. 6/9" className={INPUT} />
          </Field>
          <Field label="IOP RE (mmHg)">
            <input value={form.iopRe} onChange={(e) => setForm((f) => ({ ...f, iopRe: e.target.value }))} placeholder="e.g. 14" className={INPUT} />
          </Field>
          <Field label="IOP LE (mmHg)">
            <input value={form.iopLe} onChange={(e) => setForm((f) => ({ ...f, iopLe: e.target.value }))} placeholder="e.g. 14" className={INPUT} />
          </Field>
        </div>
      </div>

      {/* Ocular Exam */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white p-5 space-y-4">
        <h2 className="text-sm font-bold text-[var(--color-ink-700)]">Ocular Examination</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Wound Status">
            <input value={form.woundStatus} onChange={(e) => setForm((f) => ({ ...f, woundStatus: e.target.value }))} placeholder="e.g. Sealed, watertight" className={INPUT} />
          </Field>
          <Field label="IOL Position">
            <input value={form.iolPosition} onChange={(e) => setForm((f) => ({ ...f, iolPosition: e.target.value }))} placeholder="e.g. Well-centered in bag" className={INPUT} />
          </Field>
          <Field label="Anterior Chamber">
            <input value={form.anteriorChamber} onChange={(e) => setForm((f) => ({ ...f, anteriorChamber: e.target.value }))} placeholder="e.g. Formed, clear" className={INPUT} />
          </Field>
          <Field label="Fundus Notes">
            <input value={form.fundusNotes} onChange={(e) => setForm((f) => ({ ...f, fundusNotes: e.target.value }))} placeholder="e.g. Normal disc and vessels" className={INPUT} />
          </Field>
        </div>
        <Field label="Complications">
          <textarea
            value={form.complications}
            onChange={(e) => setForm((f) => ({ ...f, complications: e.target.value }))}
            rows={2}
            placeholder="Any post-op complications…"
            className={`${INPUT} resize-none`}
          />
        </Field>
      </div>

      {/* Medications & Instructions */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white p-5 space-y-4">
        <h2 className="text-sm font-bold text-[var(--color-ink-700)]">Post-Op Medications & Instructions</h2>
        <Field label="Post-Op Medications">
          <textarea
            value={form.postOpMedications}
            onChange={(e) => setForm((f) => ({ ...f, postOpMedications: e.target.value }))}
            rows={3}
            placeholder="e.g. Prednisolone eye drops 1% TDS × 4 weeks…"
            className={`${INPUT} resize-none`}
          />
        </Field>
        <Field label="Patient Instructions">
          <textarea
            value={form.instructions}
            onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
            rows={2}
            placeholder="e.g. Avoid rubbing eye, wear shield at night…"
            className={`${INPUT} resize-none`}
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Follow-Up Date">
            <input
              type="date"
              value={form.followUpDate}
              onChange={(e) => setForm((f) => ({ ...f, followUpDate: e.target.value }))}
              className={INPUT}
            />
          </Field>
        </div>
      </div>

      {/* Review Notes */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white p-5 space-y-3">
        <h2 className="text-sm font-bold text-[var(--color-ink-700)]">Review Notes</h2>
        <textarea
          value={form.reviewNotes}
          onChange={(e) => setForm((f) => ({ ...f, reviewNotes: e.target.value }))}
          rows={3}
          placeholder="General observations, plan, additional notes…"
          className={`${INPUT} resize-none`}
        />
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}
      {saved && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold">
          <CheckCircle2 size={15} /> Review saved. Returning…
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
          {existing ? "Update Review" : "Save Review"}
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
