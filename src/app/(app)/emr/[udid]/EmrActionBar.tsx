"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Save, Printer, FileSignature, CheckCircle2, Download, ChevronDown, X, FileText } from "lucide-react";
import Link from "next/link";
import { touchVisit, closeVisit } from "./actions";

function SuccessModal({ visitId, onClose }: { visitId: string; onClose: () => void }) {
  const pdfBase = `/api/prescription-pdf/${visitId}`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-emerald-600 px-6 py-5 text-white text-center">
          <CheckCircle2 size={40} className="mx-auto mb-2" />
          <h2 className="text-lg font-bold">Consultation Completed</h2>
          <p className="text-sm text-emerald-100 mt-1">EMR has been finalized and signed.</p>
        </div>
        {/* Actions */}
        <div className="px-6 py-5 flex flex-col gap-3">
          <a
            href={pdfBase}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-[var(--color-primary-600)] text-white text-sm font-semibold hover:bg-[var(--color-primary-700)] transition-colors"
          >
            <Printer size={16} /> View Prescription
          </a>
          <Link
            href="/appointments"
            className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl border border-[var(--color-border)] text-sm font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] transition-colors"
          >
            Back to Appointments
          </Link>
        </div>
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/15 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

export function EmrActionBar({ visit, udid, patientName }: { visit: any; udid: string; patientName?: string }) {
  const [pending, startTransition] = useTransition();
  const [draftSaved, setDraftSaved] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const closed = visit.status === "CLOSED";

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (printRef.current && !printRef.current.contains(e.target as Node)) {
        setPrintOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const pdfBase = `/api/prescription-pdf/${visit.id}`;
  const summaryBase = `/api/prescription-pdf/${visit.id}/summary`;

  return (
    <>
      {showSuccess && <SuccessModal visitId={visit.id} onClose={() => setShowSuccess(false)} />}

      <div className="fixed bottom-0 left-0 md:left-56 right-0 z-20 border-t border-[var(--color-border)] bg-white/95 backdrop-blur-sm px-6 md:px-8 py-3 flex items-center justify-end gap-3 shadow-[0_-4px_16px_rgba(20,36,43,0.06)]">
        {draftSaved && <span className="text-xs font-medium text-[var(--color-success-600)] mr-1">Draft saved</span>}

        {!closed && (
          <button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await touchVisit(visit.id, udid);
                setDraftSaved(true);
                setTimeout(() => setDraftSaved(false), 2500);
              })
            }
            className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl bg-white border border-[var(--color-border)] hover:border-[var(--color-primary-500)] text-[var(--color-ink-700)] disabled:opacity-60"
          >
            <Save size={15} /> Save Draft
          </button>
        )}

        {/* Print Rx dropdown */}
        <div className="relative" ref={printRef}>
          <button
            onClick={() => setPrintOpen((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl bg-white border border-[var(--color-border)] hover:border-[var(--color-primary-500)] text-[var(--color-ink-700)]"
          >
            <Printer size={15} /> Print Rx <ChevronDown size={13} className={`transition-transform ${printOpen ? "rotate-180" : ""}`} />
          </button>

          {printOpen && (
            <div className="absolute bottom-full mb-2 right-0 w-56 rounded-xl border border-[var(--color-border)] bg-white shadow-lg overflow-hidden z-30">
              {/* 1. Open & Print */}
              <a
                href={pdfBase}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setPrintOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-sm text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] transition-colors"
              >
                <Printer size={15} className="text-[var(--color-primary-600)] shrink-0" />
                <div>
                  <p className="font-medium">Open &amp; Print</p>
                  <p className="text-[10px] text-[var(--color-ink-400)]">Full Rx in browser</p>
                </div>
              </a>

              <div className="border-t border-[var(--color-border)]" />

              {/* 2. Download PDF */}
              <a
                href={`${pdfBase}?dl=1`}
                download
                onClick={() => setPrintOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-sm text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] transition-colors"
              >
                <Download size={15} className="text-[var(--color-primary-600)] shrink-0" />
                <div>
                  <p className="font-medium">Download PDF</p>
                  <p className="text-[10px] text-[var(--color-ink-400)]">Save full EMR to device</p>
                </div>
              </a>

              <div className="border-t border-[var(--color-border)]" />

              {/* 3. Print Short Summary */}
              <button
                onClick={() => { setPrintOpen(false); window.print(); }}
                className="flex items-center gap-3 px-4 py-3 w-full text-left text-sm text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] transition-colors"
              >
                <FileText size={15} className="text-[var(--color-primary-600)] shrink-0" />
                <div>
                  <p className="font-medium">Print Short Summary</p>
                  <p className="text-[10px] text-[var(--color-ink-400)]">Plan, Rx &amp; advice only</p>
                </div>
              </button>
            </div>
          )}
        </div>

        {closed ? (
          <span className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl bg-[var(--color-success-100)] text-[var(--color-success-600)]">
            <CheckCircle2 size={15} /> Finalized & Signed
          </span>
        ) : (
          <button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await closeVisit(visit.id, udid);
                setShowSuccess(true);
              })
            }
            className="flex items-center gap-2 text-sm font-medium px-5 py-2 rounded-xl bg-[var(--color-primary-900)] text-white hover:bg-[var(--color-primary-700)] disabled:opacity-60"
          >
            <FileSignature size={15} /> {pending ? "Finalizing…" : "Finalize & Sign"}
          </button>
        )}
      </div>
    </>
  );
}
