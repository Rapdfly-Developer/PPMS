"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { deletePatient } from "./actions";

/** Trash button + confirmation dialog. The user must type the patient ID to enable deletion. */
export function DeletePatientButton({ patientId, patientName, patientCode, redirectTo, className }: { patientId: string; patientName: string; patientCode: string; redirectTo?: string; className?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "first" | "second">("idle");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const matches = typed.trim().toUpperCase() === patientCode.toUpperCase();

  function close() {
    if (pending) return;
    setStep("idle");
    setTyped("");
    setError(null);
  }

  function confirmDelete() {
    setError(null);
    startTransition(async () => {
      const res = await deletePatient(patientId);
      if (res.error) { setError(res.error); return; }
      setStep("idle");
      if (redirectTo) { router.push(redirectTo); } else { router.refresh(); }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setStep("first"); }}
        title="Delete patient"
        aria-label={`Delete patient ${patientName}`}
        className={className ?? "shrink-0 rounded-lg p-1.5 text-[var(--color-ink-400)] transition-colors hover:bg-red-50 hover:text-red-600"}
      >
        <Trash2 size={14} />
      </button>

      {step === "first" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
          onClick={(e) => { e.stopPropagation(); close(); }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="delete-first-title" onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <button type="button" onClick={close} aria-label="Close" className="absolute right-3 top-3 rounded-lg p-1.5 text-[var(--color-ink-400)] hover:bg-[var(--color-surface-sunken)]">
              <X size={16} />
            </button>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600"><AlertTriangle size={18} /></span>
              <div>
                <h2 id="delete-first-title" className="text-heading-sm font-semibold text-[var(--color-ink-900)]">Delete Patient Record?</h2>
                <p className="mt-1 text-label leading-relaxed text-[var(--color-ink-500)]">
                  This action is permanent and cannot be reversed. The patient&apos;s entire medical history, visits, prescriptions and records will be deleted forever. Are you sure you want to continue?
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={close} className="h-9 rounded-lg border border-[var(--color-border)] px-4 text-label font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]">Cancel</button>
              <button
                type="button"
                onClick={() => setStep("second")}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-red-600 px-4 text-label font-semibold text-white hover:bg-red-700"
              >
                Yes, continue
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "second" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
          onClick={(e) => { e.stopPropagation(); close(); }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="delete-patient-title" onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <button type="button" onClick={close} aria-label="Close" className="absolute right-3 top-3 rounded-lg p-1.5 text-[var(--color-ink-400)] hover:bg-[var(--color-surface-sunken)]">
              <X size={16} />
            </button>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600"><AlertTriangle size={18} /></span>
              <div>
                <h2 id="delete-patient-title" className="text-heading-sm font-semibold text-[var(--color-ink-900)]">Delete {patientName}?</h2>
                <p className="mt-1 text-label leading-relaxed text-[var(--color-ink-500)]">
                  This permanently deletes the patient and <strong>all</strong> their records: appointments, visits, EMR, prescriptions, investigations, diagnoses, surgery and insurance details. This cannot be undone.
                </p>
              </div>
            </div>
            <label className="mt-5 block text-label font-medium text-[var(--color-ink-700)]">
              Type <span className="font-mono font-semibold text-[var(--color-ink-900)]">{patientCode}</span> to confirm
              <input
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 font-mono text-label focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </label>
            {error && <p role="alert" className="mt-2 text-caption text-red-600">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={close} disabled={pending} className="h-9 rounded-lg border border-[var(--color-border)] px-4 text-label font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]">Cancel</button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={!matches || pending}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-red-600 px-4 text-label font-semibold text-white hover:bg-red-700 disabled:opacity-40"
              >
                <Trash2 size={13} /> {pending ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
