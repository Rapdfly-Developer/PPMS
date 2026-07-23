"use client";

import { useState, useTransition, useRef, useEffect, ReactNode } from "react";
import { ChevronRight, Printer, FileSignature, CheckCircle2, Download, ChevronDown, X, FileText } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { closeVisit } from "./actions";

function SuccessModal({ udid, onClose }: { udid: string; onClose: () => void }) {
  const router = useRouter();

  const goToProfile = () => {
    onClose();
    router.push(`/patients/${udid}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
      {/* X button above the card */}
      <button
        onClick={onClose}
        className="mb-3 w-9 h-9 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/35 text-white transition-colors"
      >
        <X size={18} />
      </button>

      {/* Clickable card → patient profile */}
      <div
        onClick={goToProfile}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden cursor-pointer hover:shadow-3xl hover:scale-[1.01] transition-all duration-150 active:scale-[0.99]"
      >
        <div className="bg-emerald-600 px-6 py-6 text-white text-center">
          <CheckCircle2 size={40} className="mx-auto mb-2" />
          <h2 className="text-lg font-bold">Consultation Completed</h2>
          <p className="text-sm text-emerald-100 mt-1">EMR has been finalized and signed.</p>
          <p className="text-xs text-emerald-200 mt-3 opacity-80">Tap to view patient profile →</p>
        </div>
      </div>
    </div>
  );
}

export function EmrActionBar({
  visit, udid, patientName, currentTabIndex = 0, totalTabs = 1, onNextSection,
}: {
  visit: any; udid: string; patientName?: string;
  currentTabIndex?: number; totalTabs?: number; onNextSection?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [printOpen, setPrintOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const closed = visit.status === "CLOSED";
  const isLastTab = currentTabIndex >= totalTabs - 1;

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
      {showSuccess && <SuccessModal udid={udid} onClose={() => setShowSuccess(false)} />}

      <div className="fixed bottom-0 left-0 md:left-56 right-0 z-20 border-t border-[var(--color-border)] bg-white/95 backdrop-blur-sm px-6 md:px-8 py-3 flex items-center justify-end gap-3 shadow-[0_-4px_16px_rgba(20,36,43,0.06)]">
        {!closed && !isLastTab && (
          <button
            onClick={onNextSection}
            className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl bg-white border border-[var(--color-border)] hover:border-[var(--color-primary-500)] text-[var(--color-ink-700)]"
          >
            Next Section <ChevronRight size={15} />
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
              {/* 1. Print Long Summary */}
              <a
                href={pdfBase}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setPrintOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-sm text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] transition-colors"
              >
                <Printer size={15} className="text-[var(--color-primary-600)] shrink-0" />
                <div>
                  <p className="font-medium">Print Long Summary</p>
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
                onClick={() => { setPrintOpen(false); window.open(`/api/prescription-pdf/${visit.id}/summary`, "_blank"); }}
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
