"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { ChevronRight, Printer, FileSignature, CheckCircle2, Download, ChevronDown, FileText, PackageOpen, X, Lock, PenLine, Search, Clock, Plus } from "lucide-react";
import { isSameDay } from "date-fns";
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

const HISTORY_KEY = "ppms_partial_dispense_history";

function loadHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]"); } catch { return []; }
}
function saveHistory(reason: string, prev: string[]) {
  const next = [reason, ...prev.filter((r) => r !== reason)].slice(0, 10);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
}

function PartialDispenseModal({
  onConfirm,
  onCancel,
  loading,
}: {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [query, setQuery]   = useState("");
  const [reason, setReason] = useState("");
  const [open, setOpen]     = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setHistory(loadHistory()); }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredPresets = PARTIAL_REASONS.filter((r) =>
    r.toLowerCase().includes(query.toLowerCase())
  );
  const filteredHistory = history.filter(
    (r) =>
      r.toLowerCase().includes(query.toLowerCase()) &&
      !PARTIAL_REASONS.includes(r)
  );
  const canAddCustom =
    query.trim().length > 0 &&
    !PARTIAL_REASONS.some((r) => r.toLowerCase() === query.trim().toLowerCase()) &&
    !history.some((r) => r.toLowerCase() === query.trim().toLowerCase());

  function select(r: string) {
    setReason(r);
    setQuery(r);
    setOpen(false);
  }

  function handleConfirm() {
    const r = reason.trim();
    if (!r) return;
    const next = [r, ...history.filter((h) => h !== r)].slice(0, 10);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    setHistory(next);
    onConfirm(r);
  }

  const showDropdown = open && (filteredPresets.length > 0 || filteredHistory.length > 0 || canAddCustom);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <PackageOpen size={18} className="text-amber-600" />
            <h2 className="text-base font-bold text-[var(--color-ink-900)]">Reason for Partial Dispense</h2>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)]">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-3">
          {/* Searchable combobox */}
          <div ref={ref} className="relative">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] pointer-events-none" />
              <input
                type="text"
                value={query}
                autoFocus
                onChange={(e) => {
                  setQuery(e.target.value);
                  setReason(e.target.value);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && query.trim()) {
                    select(query.trim());
                  } else if (e.key === "Escape") {
                    setOpen(false);
                  }
                }}
                placeholder="Search or type a reason…"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[var(--color-border)] text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-[var(--color-surface)]"
              />
            </div>

            {showDropdown && (
              <ul className="absolute z-50 left-0 right-0 mt-1 rounded-xl border border-[var(--color-border)] bg-white shadow-xl overflow-hidden max-h-64 overflow-y-auto">
                {/* Preset reasons */}
                {filteredPresets.length > 0 && (
                  <>
                    <li className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-400)] bg-[var(--color-surface-sunken)]">
                      Presets
                    </li>
                    {filteredPresets.map((r) => (
                      <li key={r}>
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); select(r); }}
                          className={`w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center justify-between gap-2 ${
                            reason === r
                              ? "bg-amber-50 text-amber-800 font-semibold"
                              : "text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]"
                          }`}
                        >
                          {r}
                          {reason === r && <CheckCircle2 size={13} className="text-amber-600 shrink-0" />}
                        </button>
                      </li>
                    ))}
                  </>
                )}

                {/* History */}
                {filteredHistory.length > 0 && (
                  <>
                    <li className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-400)] bg-[var(--color-surface-sunken)] flex items-center gap-1.5 border-t border-[var(--color-border)]">
                      <Clock size={10} /> Recent
                    </li>
                    {filteredHistory.map((r) => (
                      <li key={r}>
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); select(r); }}
                          className={`w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center gap-2 ${
                            reason === r
                              ? "bg-amber-50 text-amber-800 font-semibold"
                              : "text-[var(--color-ink-700)] hover:bg-amber-50/60"
                          }`}
                        >
                          <Clock size={12} className="text-[var(--color-ink-400)] shrink-0" />
                          {r}
                          {reason === r && <CheckCircle2 size={13} className="ml-auto text-amber-600 shrink-0" />}
                        </button>
                      </li>
                    ))}
                  </>
                )}

                {/* Add custom keyword */}
                {canAddCustom && (
                  <li className="border-t border-[var(--color-border)]">
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); select(query.trim()); }}
                      className="w-full text-left px-3 py-2.5 text-sm text-amber-700 hover:bg-amber-50 transition-colors flex items-center gap-2"
                    >
                      <Plus size={13} className="shrink-0" />
                      Add &ldquo;<span className="font-semibold">{query.trim()}</span>&rdquo; as custom reason
                    </button>
                  </li>
                )}
              </ul>
            )}
          </div>

          {/* Selected reason badge */}
          {reason.trim() && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
              <CheckCircle2 size={14} className="text-amber-600 shrink-0" />
              <span className="text-sm text-amber-800 font-medium flex-1 min-w-0 truncate">{reason}</span>
              <button
                type="button"
                onClick={() => { setReason(""); setQuery(""); }}
                className="text-amber-400 hover:text-amber-700 shrink-0 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <p className="text-[11px] text-[var(--color-ink-400)]">
            Type a keyword to search presets, pick a recent reason, or enter a custom one and press Enter.
          </p>
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
            onClick={handleConfirm}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
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
  const finalizedToday = visit.finalizedAt
    ? isSameDay(new Date(visit.finalizedAt), new Date())
    : false;
  const autoClosed = closed && !!visit.finalizedBy?.startsWith("SYSTEM");

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
          autoClosed ? (
            <span className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700">
              <Lock size={15} /> Auto-closed at EOD
            </span>
          ) : finalizedToday ? (
            <>
              <span className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-600">
                <PenLine size={13} /> Editable until EOD
              </span>
              <button
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await closeVisit(visit.id, udid);
                    setShowSuccess(true);
                  })
                }
                className="flex items-center gap-2 text-sm font-medium px-5 py-2 rounded-xl bg-[var(--color-primary-900)] text-white hover:bg-[var(--color-primary-700)] transition-colors disabled:opacity-60"
              >
                <FileSignature size={15} /> {pending ? "Re-signing…" : "Re-sign & Lock"}
              </button>
            </>
          ) : (
            <span className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl bg-[var(--color-success-100)] text-[var(--color-success-600)]">
              <CheckCircle2 size={15} /> Finalized &amp; Signed
            </span>
          )
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
