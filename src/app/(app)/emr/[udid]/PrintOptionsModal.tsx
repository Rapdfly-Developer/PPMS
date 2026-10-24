"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Printer, Download, X, Loader2, Check } from "lucide-react";
import { openPdfNative, isNativeShell } from "@/lib/open-pdf";
import { readCustomPrintPref } from "@/lib/useCustomPrintPref";
import { PRINT_SECTIONS } from "@/lib/print-sections";
import { getVisitEmrData } from "@/app/(app)/patients/[udid]/emr-viewer-action";

type PrintMode = "short" | "long" | "custom";

const MODES: { id: PrintMode; label: string }[] = [
  { id: "short",  label: "Short Print" },
  { id: "long",   label: "Long Print" },
  { id: "custom", label: "Custom Print" },
];

/**
 * Checkbox. Short / Long boxes are locked: they keep their tick in
 * colour (a disabled input would grey it out) but ignore clicks and focus.
 */
function PrintCheck({ checked, locked, onToggle, label }: {
  checked: boolean; locked: boolean; onToggle: () => void; label: string;
}) {
  return (
    <label className={`relative inline-grid place-items-center align-middle ${locked ? "cursor-default" : "cursor-pointer"}`}>
      <input
        type="checkbox"
        checked={checked}
        readOnly={locked}
        aria-readonly={locked}
        tabIndex={locked ? -1 : 0}
        onChange={locked ? undefined : onToggle}
        onClick={locked ? (e) => e.preventDefault() : undefined}
        aria-label={label}
        className={`peer appearance-none w-4 h-4 rounded-[4px] border-[1.5px] bg-white transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-100)] focus-visible:ring-offset-1 ${
          locked
            ? "border-[var(--color-ink-300)] checked:bg-[var(--color-primary-400)] checked:border-[var(--color-primary-400)]"
            : "border-[var(--color-ink-300)] hover:border-[var(--color-primary-500)] checked:bg-[var(--color-primary-600)] checked:border-[var(--color-primary-600)]"
        }`}
      />
      <Check
        size={11}
        strokeWidth={3}
        className="pointer-events-none absolute text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-150"
      />
    </label>
  );
}

/**
 * Print pop-up shared by the EMR action bar and the Previous Visits viewer.
 * Short and Long show which EMR sections they print (locked); Custom prints
 * only the ticked sections through the long-print renderer.
 */
export function PrintOptionsModal({
  visitId,
  udid,
  onClose,
}: {
  visitId: string;
  udid: string;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<PrintMode>("short");
  // Fetched on open so "no data" reflects what is saved right now, not the
  // page's first render.
  const [visit, setVisit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [custom, setCustom] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(PRINT_SECTIONS.map((s) => [s.id, readCustomPrintPref(visitId, s.id)]))
  );

  useEffect(() => {
    let live = true;
    getVisitEmrData(visitId)
      .then((v) => { if (live) setVisit(v); })
      .catch(() => {})
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [visitId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const saveCustom = (next: Record<string, boolean>) => {
    setCustom(next);
    try {
      for (const [id, on] of Object.entries(next)) localStorage.setItem(`cp_${visitId}_${id}`, on ? "1" : "0");
    } catch {}
  };

  const toggle = (id: string) => {
    setMode("custom");
    saveCustom({ ...custom, [id]: !custom[id] });
  };

  const startFrom = (preset: "short" | "long") => {
    setMode("custom");
    saveCustom(Object.fromEntries(PRINT_SECTIONS.map((s) => [s.id, s[preset]])));
  };

  const pdfBase = `/api/prescription-pdf/${visitId}`;
  const summaryBase = `/api/prescription-pdf/${visitId}/summary`;
  const anyCustom = PRINT_SECTIONS.some((s) => custom[s.id]);

  const handlePrint = () => {
    if (mode === "long") {
      void openPdfNative(pdfBase);
    } else if (mode === "short") {
      const spv = typeof window !== "undefined" ? localStorage.getItem(`spect_pin_${udid}`) : null;
      void openPdfNative(`${summaryBase}${spv ? `?spv=${spv}` : ""}`);
    } else {
      const params = new URLSearchParams();
      for (const s of PRINT_SECTIONS) params.set(s.id, custom[s.id] ? "1" : "0");
      void openPdfNative(`${pdfBase}?${params.toString()}`);
    }
    onClose();
  };

  const isChecked = (col: PrintMode, id: string) => {
    const s = PRINT_SECTIONS.find((x) => x.id === id)!;
    return col === "custom" ? !!custom[id] : s[col];
  };

  // Portalled to <body>: the Previous Visits card sits inside a transformed
  // parent, which would otherwise pin this "fixed" overlay to that card.
  return createPortal(
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-[0_24px_48px_-16px_rgba(15,23,42,0.28)] ring-1 ring-black/5 w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-start justify-between px-5 pt-4 pb-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-[var(--color-ink-900)]">Print</h2>
            <p className="text-caption text-[var(--color-ink-400)] mt-0.5">Choose a summary, or tick sections for a custom print</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid place-items-center w-7 h-7 -mr-1 rounded-md text-[var(--color-ink-400)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink-900)] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 pb-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-200">
          {/* Slider: only the chosen print's column is shown */}
          <div className="sticky top-0 z-10 bg-white pt-0.5 pb-3">
            <div className="relative grid grid-cols-3 rounded-lg bg-[var(--color-surface-sunken)] p-1">
              <span
                aria-hidden
                className="absolute top-1 bottom-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-md bg-[var(--color-primary-800)] shadow-sm transition-transform duration-200 ease-out"
                style={{ transform: `translateX(${MODES.findIndex((m) => m.id === mode) * 100}%)` }}
              />
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  aria-pressed={mode === m.id}
                  className={`relative z-[1] py-1.5 rounded-md text-caption font-medium transition-colors duration-200 ${
                    mode === m.id ? "text-white" : "text-[var(--color-ink-600)] hover:text-[var(--color-ink-900)]"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {mode === "custom" && (
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-micro text-[var(--color-ink-400)] mr-0.5">Start from</span>
                {(["short", "long"] as const).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => startFrom(preset)}
                    className="px-2 py-0.5 rounded-full border border-[var(--color-primary-200)] bg-[var(--color-primary-50)] text-micro font-medium text-[var(--color-primary-700)] hover:bg-[var(--color-primary-100)] hover:border-[var(--color-primary-300)] transition-colors"
                  >
                    {preset === "short" ? "Short" : "Long"}
                  </button>
                ))}
              </div>
            )}
          </div>
          <table className="w-full table-fixed border-separate border-spacing-0">
            <tbody>
              {PRINT_SECTIONS.map((s) => {
                const hasData = !loading && visit ? s.hasData(visit) : true;
                const label = MODES.find((m) => m.id === mode)!.label;
                return (
                  <tr key={s.id} className="group">
                    <td className="px-2.5 py-2 border-t border-[var(--color-border)]/70 group-hover:bg-[var(--color-primary-50)]/50 transition-colors">
                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-x-2 gap-y-0.5">
                        <span className={`text-caption sm:text-[13px] ${hasData ? "text-[var(--color-ink-800)]" : "text-[var(--color-ink-400)]"}`}>{s.label}</span>
                        {!hasData && (
                          <span className="ml-auto shrink-0 text-micro text-[var(--color-ink-300)]">no data</span>
                        )}
                      </div>
                    </td>
                    <td className="w-16 text-center py-2 border-t border-[var(--color-border)]/70 bg-[var(--color-primary-50)] transition-colors">
                      <PrintCheck
                        checked={isChecked(mode, s.id)}
                        locked={mode !== "custom"}
                        onToggle={() => toggle(s.id)}
                        label={`${s.label} — ${label}`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {loading && (
            <p className="flex items-center gap-2 px-3 py-2 text-caption text-[var(--color-ink-400)]">
              <Loader2 size={12} className="animate-spin" /> Checking which sections have data…
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[var(--color-border)]">
          <button
            type="button"
            disabled={mode === "custom" && !anyCustom}
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-primary-800)] text-white hover:bg-[var(--color-primary-700)] disabled:opacity-40 transition-colors"
          >
            <Printer size={13} /> Print
          </button>
          {/* Same Download as before: always the full PDF. A real <a download> on
              the web; on the native shell the anchor does nothing, so hand it to
              the Filesystem/FileOpener path. */}
          <a
            href={`${pdfBase}?dl=1`}
            download
            onClick={(e) => {
              if (isNativeShell()) {
                e.preventDefault();
                void openPdfNative(`${pdfBase}?dl=1`);
              }
              onClose();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--color-border)] text-[var(--color-ink-700)] hover:border-[var(--color-primary-500)] transition-colors"
          >
            <Download size={13} /> Download
          </a>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--color-ink-500)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink-900)] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
