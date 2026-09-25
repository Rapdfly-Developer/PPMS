"use client";

import { useState, useRef } from "react";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Building2, Stethoscope } from "lucide-react";
import { EmrViewerButton, VisitDownloadButton } from "../EmrViewerModal";
import { VisitSummaryTabs } from "../VisitSummaryTabs";

export interface VisitRow {
  id:          string;
  visitNumber: number;
  date:        string;
  status:      string;
  visitType:   string | null;
  hospital:    { name: string } | null;
  doctor:      { name: string } | null;
  generalExam: { chiefComplaint: string | null } | null;
  diagnoses:   { description: string }[];
}

export function VisitsListClient({ visits, udid }: { visits: VisitRow[]; udid: string }) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const tabsRef = useRef<HTMLDivElement>(null);

  if (visits.length === 0) {
    return (
      <div className="text-center py-16 text-[var(--color-ink-400)]">
        <p className="text-sm sm:text-base">No visits recorded yet.</p>
      </div>
    );
  }

  const v        = visits[selectedIdx];
  const isClosed = v.status === "CLOSED";
  const canPrev  = selectedIdx < visits.length - 1;
  const canNext  = selectedIdx > 0;

  function goTo(idx: number) {
    setSelectedIdx(idx);
    const tabs = tabsRef.current;
    if (!tabs) return;
    const tab = tabs.children[idx] as HTMLElement | undefined;
    tab?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }

  return (
    <div className="flex flex-col gap-4">

      {/* ── Tab bar ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => goTo(selectedIdx + 1)}
          disabled={!canPrev}
          aria-label="Older visit"
          className="shrink-0 size-8 sm:size-9 flex items-center justify-center rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-ink-500)] hover:bg-[var(--color-surface-sunken)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={15} />
        </button>

        <div
          ref={tabsRef}
          className="flex-1 flex gap-1.5 overflow-x-auto scrollbar-hide py-1 scroll-smooth"
          style={{ scrollbarWidth: "none" }}
        >
          {visits.map((visit, idx) => {
            const active = idx === selectedIdx;
            return (
              <button
                key={visit.id}
                onClick={() => goTo(idx)}
                className={`shrink-0 flex flex-col items-center px-3 py-1.5 rounded-xl border text-center transition-all ${
                  active
                    ? "border-[var(--color-primary-600)] bg-[var(--color-primary-700)] text-white shadow-sm"
                    : "border-[var(--color-border)] bg-white text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)]"
                }`}
              >
                <span className={`text-[9px] sm:text-[10px] font-bold ${active ? "text-white/80" : "text-[var(--color-primary-600)]"}`}>
                  Visit #{visit.visitNumber}
                </span>
                <span className={`text-[11px] sm:text-xs font-semibold leading-tight ${active ? "text-white" : "text-[var(--color-ink-800)]"}`}>
                  {format(new Date(visit.date), "dd MMM")}
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => goTo(selectedIdx - 1)}
          disabled={!canNext}
          aria-label="Newer visit"
          className="shrink-0 size-8 sm:size-9 flex items-center justify-center rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-ink-500)] hover:bg-[var(--color-surface-sunken)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={15} />
        </button>
      </div>

      {/* ── Visit card — 2-col on lg+ ──────────────────────────────── */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white overflow-hidden">
        <div className="flex flex-col lg:flex-row">

          {/* Left panel: visit metadata */}
          <div className="lg:w-64 xl:w-72 2xl:w-80 shrink-0 p-5 flex flex-col gap-4 border-b lg:border-b-0 lg:border-r border-[var(--color-border)] bg-[var(--color-surface-sunken)]">

            {/* Visit number + status badges */}
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="text-xs font-bold text-[var(--color-primary-700)] bg-[var(--color-primary-50)] px-2 py-0.5 rounded-md">
                  Visit #{v.visitNumber}
                </span>
                {isClosed ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Completed</span>
                ) : (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">In Progress</span>
                )}
                {v.visitType && (
                  <span className="text-[10px] text-[var(--color-ink-400)] font-medium">{v.visitType}</span>
                )}
              </div>
              <p className="text-base sm:text-lg font-bold text-[var(--color-ink-900)]">
                {format(new Date(v.date), "dd MMM yyyy")}
              </p>
            </div>

            {/* Hospital & Doctor */}
            <div className="flex flex-col gap-2">
              {v.hospital && (
                <div className="flex items-center gap-2">
                  <Building2 size={13} className="shrink-0 text-[var(--color-ink-400)]" />
                  <span className="text-[12px] sm:text-[13px] text-[var(--color-ink-600)] leading-snug">{v.hospital.name}</span>
                </div>
              )}
              {v.doctor && (
                <div className="flex items-center gap-2">
                  <Stethoscope size={13} className="shrink-0 text-[var(--color-ink-400)]" />
                  <span className="text-[12px] sm:text-[13px] text-[var(--color-ink-600)]">Dr. {v.doctor.name}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-auto pt-2 flex items-center gap-2">
              {v.generalExam ? (
                <>
                  <EmrViewerButton visitId={v.id} visitNumber={v.visitNumber} udid={udid} />
                  <VisitDownloadButton visitId={v.id} />
                </>
              ) : (
                <span className="inline-flex items-center text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-white border border-[var(--color-border)] text-[var(--color-ink-400)] cursor-not-allowed">
                  No EMR
                </span>
              )}
            </div>
          </div>

          {/* Right panel: summary — key forces remount on visit change so stale state never bleeds across visits */}
          <div className="flex-1 min-w-0 p-5">
            <VisitSummaryTabs
              key={v.id}
              visitId={v.id}
              complaint={v.generalExam?.chiefComplaint ?? null}
              diagnoses={v.diagnoses.map((d) => d.description)}
              bare
            />
          </div>

        </div>
      </div>

      {/* ── Visit counter ────────────────────────────────────────────── */}
      <p className="text-center text-xs text-[var(--color-ink-400)]">
        Showing visit {visits.length - selectedIdx} of {visits.length}
      </p>

    </div>
  );
}
