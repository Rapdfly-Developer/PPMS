"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { PrintOptionsModal } from "./PrintOptionsModal";
import { ChevronRight, Printer, FileSignature, CheckCircle2, CheckCheck, ChevronDown, PackageOpen, X, Lock, PenLine, Search, Clock, Plus } from "lucide-react";
import { isSameDay } from "date-fns";
import { useRouter } from "next/navigation";
import { useSidebar } from "@/components/ui/SidebarContext";
import { Toast } from "@/components/ui/Toast";
import { closeVisit, markPartialDispense, passOverToDoctor } from "./actions";
import { useEMRSaveContext } from "./EmrSaveContext";

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
            <h2 className="text-heading-sm sm:text-base font-bold text-[var(--color-ink-900)]">Reason for Partial Dispense</h2>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)]">
            <X size={16} />
          </button>
        </div>

        <div ref={ref} className="px-6 py-5 space-y-3">
          {/* Input */}
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
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[var(--color-border)] text-sm focus:outline-none focus:border-[var(--color-primary-400)] focus:ring-2 focus:ring-[var(--color-primary-100)] bg-[var(--color-surface)] placeholder:text-[var(--color-ink-300)]"
            />
          </div>

          {/* Inline dropdown list */}
          {showDropdown && (
            <ul className="rounded-xl border border-[var(--color-border)] bg-white overflow-hidden max-h-52 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-200">
              {filteredPresets.length > 0 && (
                <>
                  <li className="px-3 py-1.5 text-caption font-semibold uppercase tracking-widest text-[var(--color-ink-300)] bg-[var(--color-surface-sunken)]">
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
                            : "text-[var(--color-ink-800)] hover:bg-gray-50"
                        }`}
                      >
                        {r}
                        {reason === r && <CheckCircle2 size={13} className="text-amber-600 shrink-0" />}
                      </button>
                    </li>
                  ))}
                </>
              )}

              {filteredHistory.length > 0 && (
                <>
                  <li className="px-3 py-1.5 text-caption font-semibold uppercase tracking-widest text-[var(--color-ink-300)] bg-[var(--color-surface-sunken)] flex items-center gap-1.5 border-t border-[var(--color-border)]">
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
                            : "text-[var(--color-ink-800)] hover:bg-gray-50"
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

          {/* Selected reason badge — shown when dropdown is closed */}
          {!showDropdown && reason.trim() && (
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

          {!showDropdown && (
            <p className="text-caption text-[var(--color-ink-400)]">
              Type a keyword to search presets, pick a recent reason, or enter a custom one and press Enter.
            </p>
          )}
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
          <h2 className="text-base sm:text-lg font-bold">Consultation Completed</h2>
          <p className="text-sm text-emerald-100 mt-1">EMR has been finalized and signed.</p>
          <p className="text-xs text-emerald-200 mt-3 opacity-80">Redirecting to patient profile…</p>
        </div>
      </div>
    </div>
  );
}

export function EmrActionBar({
  visit, udid, patientName, currentTabIndex = 0, totalTabs = 1, onNextSection,
  editMode, onEnterEditMode, openPartialSignal = 0, isRefractionist = false,
  canPrint = false, canPartialDispense = false, finalizedToday: finalizedTodayProp,
}: {
  visit: any; udid: string; patientName?: string;
  currentTabIndex?: number; totalTabs?: number; onNextSection?: () => void;
  editMode?: boolean; onEnterEditMode?: () => void;
  /**
   * Incremented by the exit guard to open the Partial Dispense modal that
   * already lives here. A counter rather than a boolean so a second request
   * still fires after the modal has been dismissed once.
   */
  openPartialSignal?: number;
  isRefractionist?: boolean;
  canPrint?: boolean;
  canPartialDispense?: boolean;
  /** When provided, overrides the internal isSameDay(finalizedAt) check — use to suppress edit for view-only sources. */
  finalizedToday?: boolean;
}) {
  const router = useRouter();
  const { collapsed } = useSidebar();
  const { unpauseSaves } = useEMRSaveContext();
  const [pending, startTransition] = useTransition();
  const [partialPending, startPartialTransition] = useTransition();
  const [passOverPending, startPassOver] = useTransition();
  const [passOverDone, setPassOverDone] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showPartialModal, setShowPartialModal] = useState(false);
  // The exit guard asks for this modal by bumping openPartialSignal. Derived
  // rather than mirrored into state via an effect: setState inside an effect
  // cascades an extra render. The modal is open when the parent's signal is
  // newer than the last one dismissed here, or when opened from the button.
  const [dismissedSignal, setDismissedSignal] = useState(0);
  const showPartial = showPartialModal || openPartialSignal > dismissedSignal;
  const closePartial = () => {
    setShowPartialModal(false);
    setDismissedSignal(openPartialSignal);
  };
  const [partialDone, setPartialDone] = useState(false);

  useEffect(() => {
    if (partialDone) router.push("/dashboard");
  }, [partialDone, router]);

  useEffect(() => {
    if (!passOverDone) return;
    const t = setTimeout(() => router.push("/opd"), 1500);
    return () => clearTimeout(t);
  }, [passOverDone, router]);
  const closed = visit.status === "CLOSED";
  const isLastTab = currentTabIndex >= totalTabs - 1;
  const finalizedToday = finalizedTodayProp !== undefined ? finalizedTodayProp : visit.finalizedAt
    ? isSameDay(new Date(visit.finalizedAt), new Date())
    : false;
  const autoClosed = closed && !!visit.finalizedBy?.startsWith("SYSTEM");
  const sessionIncomplete = autoClosed && !!visit.finalizedBy?.includes("end of session");


  const desktopSidebarOffset = collapsed
    ? "min-[1025px]:left-16"
    : "min-[1025px]:left-60 min-[1920px]:left-[268px] min-[2560px]:left-[288px] min-[3840px]:left-[312px]";

  return (
    <>
      {showSuccess && <SuccessModal udid={udid} onClose={() => setShowSuccess(false)} />}
      {passOverDone && <Toast message="Passed over to doctor." onDone={() => {}} />}
      {showPrint && <PrintOptionsModal visitId={visit.id} udid={udid} onClose={() => setShowPrint(false)} />}
      {showPartial && (
        <PartialDispenseModal
          loading={partialPending}
          onCancel={closePartial}
          onConfirm={(reason) => {
            startPartialTransition(async () => {
              await markPartialDispense(visit.id, udid, reason);
              closePartial();
              setPartialDone(true);
            });
          }}
        />
      )}

      {/* justify-end-safe, not justify-end: with plain flex-end an over-wide row
          overflows past the START edge, which is not counted in scrollWidth and
          cannot be scrolled to — the first button (Next) was simply stranded
          off-screen. "safe" keeps end-alignment while the row fits and falls
          back to start-alignment when it does not, so any overflow lands on the
          END edge where overflow-x-auto can reach it. The row fits outright at
          >=360px, so the scroll only ever engages on very narrow phones. */}
      <div className={`fixed bottom-16 lg:bottom-0 short:bottom-0 left-0 ${desktopSidebarOffset} right-0 z-20 border-t border-[var(--color-border)] bg-white/95 backdrop-blur-sm px-2 md:px-8 py-3 flex flex-nowrap items-center gap-2 md:gap-3 md:justify-end shadow-[0_-4px_16px_rgba(20,36,43,0.06)] transition-[left] duration-200 overflow-x-auto`}>
        {!closed && !isLastTab && (
          <button
            onClick={onNextSection}
            className="flex-1 md:flex-none flex items-center justify-center gap-1 text-caption sm:text-sm font-medium px-2.5 py-2.5 md:px-4 md:py-2 rounded-xl bg-white border border-[var(--color-border)] hover:border-[var(--color-primary-500)] text-[var(--color-ink-700)] whitespace-nowrap"
          >
            Next <ChevronRight size={13} />
          </button>
        )}

        {/* Print Rx — opens the print pop-up; shown when emr.print permission is granted */}
        {canPrint && <div className="flex-1 md:flex-none relative">
          <button
            onClick={() => setShowPrint(true)}
            className="w-full flex items-center justify-center gap-1 text-caption sm:text-sm font-medium px-2.5 py-2.5 md:px-4 md:py-2 rounded-xl bg-white border border-[var(--color-border)] hover:border-[var(--color-primary-500)] text-[var(--color-ink-700)] whitespace-nowrap"
          >
            <Printer size={13} /> Print Rx <ChevronDown size={11} />
          </button>
        </div>}


        {canPartialDispense && !closed && (
          <button
            disabled={partialPending}
            onClick={() => setShowPartialModal(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-1 text-caption sm:text-sm font-medium px-2.5 py-2.5 md:px-4 md:py-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-700 hover:bg-amber-100 disabled:opacity-60 whitespace-nowrap"
          >
            <PackageOpen size={13} /> {partialPending ? "Saving…" : <><span className="hidden sm:inline">Partial </span>Dispense</>}
          </button>
        )}

        {isRefractionist ? (
          <button
            disabled={passOverPending || passOverDone}
            onClick={() => startPassOver(async () => {
              await passOverToDoctor(visit.id);
              setPassOverDone(true);
            })}
            className="flex-1 md:flex-none flex items-center justify-center gap-1 text-caption sm:text-sm font-medium px-2.5 py-2.5 md:px-5 md:py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 whitespace-nowrap"
          >
            <CheckCheck size={13} /> {passOverPending ? "Saving…" : passOverDone ? "Passed over" : "Pass Over to Doctor"}
          </button>
        ) : closed ? (
          autoClosed ? (
            <span className="flex-1 md:flex-none flex items-center justify-center gap-1 text-caption sm:text-sm font-medium px-2.5 py-2.5 md:px-4 md:py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 whitespace-nowrap">
              <Lock size={13} /> {sessionIncomplete ? "Incomplete" : <><span className="hidden sm:inline">Auto-closed at </span>EOD</>}
            </span>
          ) : finalizedToday ? (
            <>
              {!editMode && (
                <button
                  onClick={onEnterEditMode}
                  className="flex-1 md:flex-none flex items-center justify-center gap-1 text-caption sm:text-xs font-medium px-2.5 py-2.5 md:px-3 md:py-2 rounded-xl bg-teal-50 border border-teal-100 text-teal-600 hover:bg-teal-50 hover:border-teal-300 transition-colors whitespace-nowrap"
                >
                  <PenLine size={12} /> Edit
                </button>
              )}
              <button
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    if (editMode) unpauseSaves();
                    await closeVisit(visit.id, udid);
                    setShowSuccess(true);
                  })
                }
                className="flex-1 md:flex-none flex items-center justify-center gap-1 text-caption sm:text-sm font-medium px-2.5 py-2.5 md:px-5 md:py-2 rounded-xl bg-[var(--color-primary-900)] text-white hover:bg-[var(--color-primary-700)] transition-colors disabled:opacity-60 whitespace-nowrap"
              >
                <FileSignature size={13} /> {pending ? "Saving…" : <><span className="hidden sm:inline">Finalize &amp; </span>Sign</>}
              </button>
            </>
          ) : (
            <span className="flex-1 md:flex-none flex items-center justify-center gap-1 text-caption sm:text-sm font-medium px-2.5 py-2.5 md:px-4 md:py-2 rounded-xl bg-[var(--color-success-100)] text-[var(--color-success-600)] whitespace-nowrap">
              <CheckCircle2 size={13} /> Finalized
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
            className="flex-1 md:flex-none flex items-center justify-center gap-1 text-caption sm:text-sm font-medium px-2.5 py-2.5 md:px-5 md:py-2 rounded-xl bg-[var(--color-primary-900)] text-white hover:bg-[var(--color-primary-700)] disabled:opacity-60 whitespace-nowrap"
          >
            <FileSignature size={13} /> {pending ? "Saving…" : <><span className="hidden sm:inline">Finalize &amp; </span>Sign</>}
          </button>
        )}
      </div>
    </>
  );
}
