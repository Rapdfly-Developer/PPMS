"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { openPdfNative, isNativeShell } from "@/lib/open-pdf";
import { ChevronRight, Printer, FileSignature, CheckCircle2, CheckCheck, Download, ChevronDown, FileText, PackageOpen, X, Lock, PenLine, Search, Clock, Plus, SlidersHorizontal } from "lucide-react";
import { isSameDay } from "date-fns";
import { useRouter } from "next/navigation";
import { useSidebar } from "@/components/ui/SidebarContext";
import { Toast } from "@/components/ui/Toast";
import { closeVisit, markPartialDispense, passOverToDoctor } from "./actions";

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
                    <li className="px-3 py-1.5 text-caption font-bold uppercase tracking-widest text-[var(--color-ink-400)] bg-[var(--color-surface-sunken)]">
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
                    <li className="px-3 py-1.5 text-caption font-bold uppercase tracking-widest text-[var(--color-ink-400)] bg-[var(--color-surface-sunken)] flex items-center gap-1.5 border-t border-[var(--color-border)]">
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

          <p className="text-caption text-[var(--color-ink-400)]">
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

// ── Refraction section selection modal ─────────────────────────────────────

type RxSection = "rx" | "extras" | "va" | "retino";

interface RxOption { key: RxSection; label: string; sub: string }

function parseJSON<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  try { return typeof raw === "string" ? JSON.parse(raw) : (raw as T); } catch { return fallback; }
}

function getAvailableRxSections(visit: any): RxOption[] {
  const options: RxOption[] = [];

  if (visit?.refraction) {
    options.push({ key: "rx", label: "Spectacle Rx", sub: "Primary distance & near correction" });
  }

  if (visit?.visualAcuity) {
    options.push({ key: "va", label: "Visual Acuity", sub: "Unaided / PH / BCVA" });
  }

  if (visit?.retinoscopy) {
    options.push({ key: "retino", label: "Retinoscopy", sub: "RE / LE findings" });
  }

  if (visit?.refraction?.extraCorrections) {
    const raw = visit.refraction.extraCorrections;
    const extras: any[] = Array.isArray(raw)
      ? raw
      : (() => { try { return JSON.parse(raw); } catch { return []; } })();
    if (extras.length > 0) {
      options.push({ key: "extras", label: "Extra Corrections", sub: "Bifocal, contact lens, etc." });
    }
  }

  return options;
}

function RefractionSelectModal({
  options,
  title,
  onConfirm,
  onCancel,
}: {
  options: RxOption[];
  title: string;
  onConfirm: (selected: Set<RxSection>) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<Set<RxSection>>(() => new Set(options.map((o) => o.key)));

  function toggle(key: RxSection) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={16} className="text-[var(--color-primary-600)]" />
            <h2 className="text-sm font-bold text-[var(--color-ink-900)]">{title}</h2>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)]">
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-2">
          <p className="text-xs text-[var(--color-ink-400)] mb-3">Select which refraction sections to include in the PDF.</p>
          {options.map((opt) => (
            <label
              key={opt.key}
              className="flex items-start gap-3 p-3 rounded-xl border border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-surface-sunken)] transition-colors"
            >
              <input
                type="checkbox"
                checked={selected.has(opt.key)}
                onChange={() => toggle(opt.key)}
                className="mt-0.5 accent-[var(--color-primary-600)]"
              />
              <div>
                <p className="text-sm font-semibold text-[var(--color-ink-800)]">{opt.label}</p>
                <p className="text-caption text-[var(--color-ink-400)]">{opt.sub}</p>
              </div>
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-3 px-5 py-4 border-t border-[var(--color-border)]">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm font-medium border border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)]"
          >
            Cancel
          </button>
          <button
            disabled={selected.size === 0}
            onClick={() => onConfirm(selected)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-[var(--color-primary-700)] text-white hover:bg-[var(--color-primary-600)] disabled:opacity-50 transition-colors"
          >
            <Printer size={13} /> Open PDF
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
}) {
  const router = useRouter();
  const { collapsed } = useSidebar();
  const [pending, startTransition] = useTransition();
  const [partialPending, startPartialTransition] = useTransition();
  const [passOverPending, startPassOver] = useTransition();
  const [passOverDone, setPassOverDone] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [rxSelectFor, setRxSelectFor] = useState<"summary" | "long" | null>(null);
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
  const printRef = useRef<HTMLDivElement>(null);

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
  const desktopSidebarOffset = collapsed
    ? "min-[1025px]:left-16"
    : "min-[1025px]:left-60 min-[1920px]:left-[268px] min-[2560px]:left-[288px] min-[3840px]:left-[312px]";

  return (
    <>
      {showSuccess && <SuccessModal udid={udid} onClose={() => setShowSuccess(false)} />}
      {passOverDone && <Toast message="Passed over to doctor." onDone={() => {}} />}
      {rxSelectFor && (() => {
        const rxOptions = getAvailableRxSections(visit);
        const isLong = rxSelectFor === "long";
        const baseUrl = isLong ? pdfBase : summaryBase;
        const spv = !isLong && typeof window !== "undefined" ? localStorage.getItem(`spect_pin_${udid}`) : null;
        return (
          <RefractionSelectModal
            title={isLong ? "Long Summary — Refraction Sections" : "Short Summary — Refraction Sections"}
            options={rxOptions}
            onCancel={() => setRxSelectFor(null)}
            onConfirm={(sel) => {
              setRxSelectFor(null);
              const params = new URLSearchParams();
              if (spv) params.set("spv", spv);
              if (!sel.has("rx"))     params.set("rx",     "0");
              if (!sel.has("extras")) params.set("extras", "0");
              if (!sel.has("va"))     params.set("va",     "0");
              if (!sel.has("retino")) params.set("retino", "0");
              const url = `${baseUrl}${params.toString() ? `?${params}` : ""}`;
              void openPdfNative(url);
            }}
          />
        );
      })()}
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
          END edge where overflow-x-auto can reach it.

          overflow-x-auto is dropped while the Print Rx menu is open: a scroll
          container computes overflow-y to auto as well, which would clip that
          menu (it renders above the bar via bottom-full). The row fits outright
          at >=360px now, so the scroll only ever engages on very narrow phones,
          and never while the menu is open. */}
      <div className={`fixed bottom-16 lg:bottom-0 short:bottom-0 left-0 ${desktopSidebarOffset} right-0 z-20 border-t border-[var(--color-border)] bg-white/95 backdrop-blur-sm px-2 md:px-8 py-3 flex flex-nowrap items-center gap-2 md:gap-3 md:justify-end shadow-[0_-4px_16px_rgba(20,36,43,0.06)] transition-[left] duration-200 ${printOpen ? "" : "overflow-x-auto"}`}>
        {!closed && !isLastTab && (
          <button
            onClick={onNextSection}
            className="flex-1 md:flex-none flex items-center justify-center gap-1 text-caption sm:text-sm font-medium px-2.5 py-2.5 md:px-4 md:py-2 rounded-xl bg-white border border-[var(--color-border)] hover:border-[var(--color-primary-500)] text-[var(--color-ink-700)] whitespace-nowrap"
          >
            Next <ChevronRight size={13} />
          </button>
        )}

        {/* Print Rx dropdown — hidden for REFRACTIONIST */}
        {!isRefractionist && <div className="flex-1 md:flex-none relative" ref={printRef}>
          <button
            onClick={() => setPrintOpen((v) => !v)}
            className="w-full flex items-center justify-center gap-1 text-caption sm:text-sm font-medium px-2.5 py-2.5 md:px-4 md:py-2 rounded-xl bg-white border border-[var(--color-border)] hover:border-[var(--color-primary-500)] text-[var(--color-ink-700)] whitespace-nowrap"
          >
            <Printer size={13} /> Print Rx <ChevronDown size={11} className={`transition-transform ${printOpen ? "rotate-180" : ""}`} />
          </button>

          {printOpen && (
            <div className="absolute bottom-full mb-2 left-0 md:left-auto md:right-0 w-56 rounded-xl border border-[var(--color-border)] bg-white shadow-lg overflow-hidden z-30">
              {/* 1. Print Long Summary */}
              <button
                type="button"
                onClick={() => {
                  setPrintOpen(false);
                  const rxOptions = getAvailableRxSections(visit);
                  if (rxOptions.length <= 1) { void openPdfNative(pdfBase); return; }
                  setRxSelectFor("long");
                }}
                className="flex items-center gap-3 px-4 py-3 w-full text-left text-label sm:text-sm text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] transition-colors"
              >
                <Printer size={15} className="text-[var(--color-primary-600)] shrink-0" />
                <div>
                  <p className="font-medium">Print Long Summary</p>
                  <p className="text-caption text-[var(--color-ink-400)]">Full Rx in browser</p>
                </div>
              </button>

              <div className="border-t border-[var(--color-border)]" />

              {/* 2. Download PDF */}
              {/* Stays a real <a download> on the web so it saves straight to disk
                  without opening a tab. On the native shell the anchor does nothing,
                  so preventDefault and hand it to the Filesystem/FileOpener path. */}
              <a
                href={`${pdfBase}?dl=1`}
                download
                onClick={(e) => {
                  setPrintOpen(false);
                  if (isNativeShell()) {
                    e.preventDefault();
                    void openPdfNative(`${pdfBase}?dl=1`);
                  }
                }}
                className="flex items-center gap-3 px-4 py-3 text-label sm:text-sm text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] transition-colors"
              >
                <Download size={15} className="text-[var(--color-primary-600)] shrink-0" />
                <div>
                  <p className="font-medium">Download PDF</p>
                  <p className="text-caption text-[var(--color-ink-400)]">Save full EMR to device</p>
                </div>
              </a>

              <div className="border-t border-[var(--color-border)]" />

              {/* 3. Print Short Summary */}
              <button
                onClick={() => {
                  setPrintOpen(false);
                  const rxOptions = getAvailableRxSections(visit);
                  if (rxOptions.length <= 1) {
                    const spv = typeof window !== "undefined" ? localStorage.getItem(`spect_pin_${udid}`) : null;
                    void openPdfNative(`${summaryBase}${spv ? `?spv=${spv}` : ""}`);
                    return;
                  }
                  setRxSelectFor("summary");
                }}
                className="flex items-center gap-3 px-4 py-3 w-full text-left text-label sm:text-sm text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] transition-colors"
              >
                <FileText size={15} className="text-[var(--color-primary-600)] shrink-0" />
                <div>
                  <p className="font-medium">Print Short Summary</p>
                  <p className="text-caption text-[var(--color-ink-400)]">Plan, Rx &amp; advice only</p>
                </div>
              </button>
            </div>
          )}
        </div>}

        {!isRefractionist && !closed && (
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
              <Lock size={13} /> <span className="hidden sm:inline">Auto-closed at </span>EOD
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
