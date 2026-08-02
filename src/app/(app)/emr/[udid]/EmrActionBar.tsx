"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { ChevronRight, Printer, FileSignature, CheckCircle2, Download, ChevronDown, FileText, PackageOpen, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { closeVisit, markPartialDispense } from "./actions";

const PARTIAL_REASONS = [
  "Glasses not ready",
  "Medicine unavailable",
  "Awaiting test results",
  "Patient requested later pickup",
  "Frame selection pending",
  "Insurance approval pending",
];

function PartialDispenseModal({
  onConfirm,
  onCancel,
  loading,
}: {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <PackageOpen size={18} className="text-amber-600" />
            <h2 className="text-base font-bold text-[var(--color-ink-900)]">Reason for Partial Dispense</h2>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)]">
            <X size={16} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            {PARTIAL_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                  reason === r
                    ? "bg-amber-100 border-amber-400 text-amber-800"
                    : "bg-white border-[var(--color-border)] text-[var(--color-ink-600)] hover:border-amber-300 hover:bg-amber-50"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Or type a custom reason…"
            rows={3}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3 py-2.5 text-sm text-[var(--color-ink-900)] placeholder:text-[var(--color-ink-300)] focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
          />
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-[var(--color-border)]">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm font-medium border border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)]"
          >
            Cancel
          </button>
          <button
            disabled={!reason.trim() || loading}
            onClick={() => onConfirm(reason.trim())}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
          >
            <PackageOpen size={14} /> {loading ? "Saving…" : "Confirm Partial Dispense"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SuccessModal({ udid, onClose }: { udid: string; onClose: () => void }) {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => {
      onClose();
      router.push(`/patients/${udid}`);
    }, 1800);
    return () => clearTimeout(t);
  }, [udid, onClose, router]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="bg-emerald-600 px-6 py-6 text-white text-center">
          <CheckCircle2 size={40} className="mx-auto mb-2" />
          <h2 className="text-lg font-bold">Consultation Completed</h2>
          <p className="text-sm text-emerald-100 mt-1">EMR has been finalized and signed.</p>
          <p className="text-xs text-emerald-200 mt-3 opacity-80">Redirecting to patient profile…</p>
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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [partialPending, startPartialTransition] = useTransition();
  const [printOpen, setPrintOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showPartialModal, setShowPartialModal] = useState(false);
  const [partialDone, setPartialDone] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (partialDone) router.push("/dashboard");
  }, [partialDone, router]);
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
      {showPartialModal && (
        <PartialDispenseModal
          loading={partialPending}
          onCancel={() => setShowPartialModal(false)}
          onConfirm={(reason) => {
            startPartialTransition(async () => {
              await markPartialDispense(visit.id, udid, reason);
              setShowPartialModal(false);
              setPartialDone(true);
            });
          }}
        />
      )}

      <div className="fixed bottom-0 left-0 lg:left-60 right-0 z-20 border-t border-[var(--color-border)] bg-white/95 backdrop-blur-sm px-6 md:px-8 py-3 flex items-center justify-end gap-3 shadow-[0_-4px_16px_rgba(20,36,43,0.06)]">
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
                onClick={() => {
                  setPrintOpen(false);
                  const spv = typeof window !== "undefined" ? localStorage.getItem(`spect_pin_${udid}`) : null;
                  const url = `/api/prescription-pdf/${visit.id}/summary${spv ? `?spv=${spv}` : ""}`;
                  window.open(url, "_blank");
                }}
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

        {!closed && (
          <button
            disabled={partialPending}
            onClick={() => setShowPartialModal(true)}
            className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-700 hover:bg-amber-100 disabled:opacity-60"
          >
            <PackageOpen size={15} /> {partialPending ? "Saving…" : "Partial Dispense"}
          </button>
        )}

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
