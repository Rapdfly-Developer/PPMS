"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Save, Printer, FileSignature, CheckCircle2, Download, ChevronDown } from "lucide-react";
import { touchVisit, closeVisit } from "./actions";

export function EmrActionBar({ visit, udid }: { visit: any; udid: string }) {
  const [pending, startTransition] = useTransition();
  const [draftSaved, setDraftSaved] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
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

  return (
    <div className="fixed bottom-0 left-0 md:left-56 right-0 z-20 border-t border-[var(--color-border)] bg-white/95 backdrop-blur-sm px-6 md:px-8 py-3 flex items-center justify-end gap-3 shadow-[0_-4px_16px_rgba(20,36,43,0.06)]">
      {draftSaved && <span className="text-xs font-medium text-[var(--color-success-600)] mr-1">Draft saved</span>}

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

      {/* Print Rx dropdown */}
      <div className="relative" ref={printRef}>
        <button
          onClick={() => setPrintOpen((v) => !v)}
          className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl bg-white border border-[var(--color-border)] hover:border-[var(--color-primary-500)] text-[var(--color-ink-700)]"
        >
          <Printer size={15} /> Print Rx <ChevronDown size={13} className={`transition-transform ${printOpen ? "rotate-180" : ""}`} />
        </button>

        {printOpen && (
          <div className="absolute bottom-full mb-2 right-0 w-52 rounded-xl border border-[var(--color-border)] bg-white shadow-lg overflow-hidden z-30">
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
                <p className="text-[10px] text-[var(--color-ink-400)]">Opens in browser for printing</p>
              </div>
            </a>
            <div className="border-t border-[var(--color-border)]" />
            <a
              href={`${pdfBase}?dl=1`}
              download
              onClick={() => setPrintOpen(false)}
              className="flex items-center gap-3 px-4 py-3 text-sm text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] transition-colors"
            >
              <Download size={15} className="text-[var(--color-primary-600)] shrink-0" />
              <div>
                <p className="font-medium">Download PDF</p>
                <p className="text-[10px] text-[var(--color-ink-400)]">Save to device</p>
              </div>
            </a>
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
          onClick={() => startTransition(() => closeVisit(visit.id, udid))}
          className="flex items-center gap-2 text-sm font-medium px-5 py-2 rounded-xl bg-[var(--color-primary-900)] text-white hover:bg-[var(--color-primary-700)] disabled:opacity-60"
        >
          <FileSignature size={15} /> Finalize & Sign
        </button>
      )}
    </div>
  );
}
