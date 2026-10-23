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
  { id: "short",  label: "Print Short Summary" },
  { id: "long",   label: "Print Long Summary" },
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
        className={`peer appearance-none w-[18px] h-[18px] rounded-[5px] border-[1.5px] bg-white transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-100)] focus-visible:ring-offset-1 ${
          locked
            ? "border-[var(--color-ink-300)] checked:bg-[var(--color-primary-400)] checked:border-[var(--color-primary-400)]"
            : "border-[var(--color-ink-300)] hover:border-[var(--color-primary-500)] checked:bg-[var(--color-primary-600)] checked:border-[var(--color-primary-600)]"
        }`}
      />
      <Check
        size={12}
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
      <div className="bg-white rounded-2xl shadow-[0_24px_48px_-16px_rgba(15,23,42,0.28)] ring-1 ring-black/5 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-[var(--color-border)]">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight text-[var(--color-ink-900)]">Print</h2>
            <p className="text-caption text-[var(--color-ink-500)] mt-0.5">Choose a summary, or tick sections for a custom print</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid place-items-center w-7 h-7 -mr-1 rounded-md text-[var(--color-ink-400)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink-900)] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-2 sm:px-3 pb-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-200">
          <table className="w-full table-fixed border-separate border-spacing-0">
            <thead className="sticky top-0 z-10 bg-white">
              <tr>
                <th className="w-[31%] sm:w-[40%] px-2 sm:px-3 pt-4 pb-3" />
                {MODES.map((m) => (
                  <th key={m.id} className="px-1 sm:px-1.5 pt-4 pb-3 align-top">
                    <button
                      type="button"
                      onClick={() => setMode(m.id)}
                      aria-pressed={mode === m.id}
                      className={`w-full min-h-[44px] px-1 sm:px-2 py-2 rounded-lg border text-caption sm:text-[13px] font-medium leading-tight transition-colors duration-150 ${
                        mode === m.id
                          ? "bg-[var(--color-primary-800)] border-[var(--color-primary-800)] text-white"
                          : "bg-white border-[var(--color-border)] text-[var(--color-ink-700)] hover:border-[var(--color-primary-500)]"
                      }`}
                    >
                      {m.label}
                    </button>
                    {m.id === "custom" && (
                      <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-0.5">
                        <button type="button" onClick={() => startFrom("short")}
                          className="text-caption font-medium text-[var(--color-ink-500)] underline decoration-[var(--color-ink-300)] underline-offset-2 hover:text-[var(--color-primary-700)] hover:decoration-[var(--color-primary-500)] transition-colors">
                          Start from Short
                        </button>
                        <button type="button" onClick={() => startFrom("long")}
                          className="text-caption font-medium text-[var(--color-ink-500)] underline decoration-[var(--color-ink-300)] underline-offset-2 hover:text-[var(--color-primary-700)] hover:decoration-[var(--color-primary-500)] transition-colors">
                          Start from Long
                        </button>
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PRINT_SECTIONS.map((s) => {
                const hasData = !loading && visit ? s.hasData(visit) : true;
                return (
                  <tr key={s.id} className="group">
                    <td className="pl-2 pr-1 sm:px-3 py-2.5 border-t border-[var(--color-border)]/70 group-hover:bg-[var(--color-primary-50)]/50 transition-colors">
                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-x-2 gap-y-0.5">
                        <span className={`text-caption sm:text-[13px] ${hasData ? "text-[var(--color-ink-800)]" : "text-[var(--color-ink-400)]"}`}>{s.label}</span>
                        {!hasData && (
                          <span className="ml-auto shrink-0 text-[11px] text-[var(--color-ink-300)]">no data</span>
                        )}
                      </div>
                    </td>
                    {MODES.map((m) => (
                      <td
                        key={m.id}
                        className={`text-center py-2.5 border-t border-[var(--color-border)]/70 transition-colors ${
                          mode === m.id ? "bg-[var(--color-primary-50)]" : "group-hover:bg-[var(--color-primary-50)]/50"
                        }`}
                      >
                        <PrintCheck
                          checked={isChecked(m.id, s.id)}
                          locked={m.id !== "custom"}
                          onToggle={() => toggle(s.id)}
                          label={`${s.label} — ${m.label}`}
                        />
                      </td>
                    ))}
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

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-[var(--color-border)]">
          <button
            type="button"
            disabled={mode === "custom" && !anyCustom}
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium bg-[var(--color-primary-800)] text-white hover:bg-[var(--color-primary-700)] disabled:opacity-40 transition-colors"
          >
            <Printer size={14} /> Print
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
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium border border-[var(--color-border)] text-[var(--color-ink-700)] hover:border-[var(--color-primary-500)] transition-colors"
          >
            <Download size={14} /> Download
          </a>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-[13px] font-medium text-[var(--color-ink-500)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink-900)] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
