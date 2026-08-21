"use client";

import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { EmrViewerButton, VisitDownloadButton } from "../EmrViewerModal";
import { VisitSummaryTabs } from "../VisitSummaryTabs";

export interface VisitRow {
  id:          string;
  visitNumber: number;
  date:        string; // ISO
  status:      string;
  visitType:   string | null;
  hospital:    { name: string } | null;
  doctor:      { name: string } | null;
  generalExam: { chiefComplaint: string | null } | null;
  diagnoses:   { description: string }[];
}

export function VisitsListClient({ visits, udid }: { visits: VisitRow[]; udid: string }) {
  // visits[0] = most recent (highest visit number)
  const [selectedIdx, setSelectedIdx] = useState(0);
  const tabsRef = useRef<HTMLDivElement>(null);

  if (visits.length === 0) {
    return (
      <div className="text-center py-16 text-[var(--color-ink-400)]">
        <p className="text-base">No visits recorded yet.</p>
      </div>
    );
  }

  const v       = visits[selectedIdx];
  const isClosed = v.status === "CLOSED";
  const canPrev  = selectedIdx < visits.length - 1; // older visit
  const canNext  = selectedIdx > 0;                  // newer visit

  function goTo(idx: number) {
    setSelectedIdx(idx);
    // Scroll the selected tab into view
    const tabs = tabsRef.current;
    if (!tabs) return;
    const tab = tabs.children[idx] as HTMLElement | undefined;
    tab?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }

  return (
    <div className="flex flex-col gap-4">

      {/* ── Tab bar ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {/* Prev arrow (← older) */}
        <button
          onClick={() => goTo(selectedIdx + 1)}
          disabled={!canPrev}
          aria-label="Older visit"
          className="shrink-0 size-8 flex items-center justify-center rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-ink-500)] hover:bg-[var(--color-surface-sunken)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={15} />
        </button>

        {/* Scrollable visit tabs */}
        <div
          ref={tabsRef}
          className="flex-1 flex gap-2 overflow-x-auto scrollbar-hide py-1 scroll-smooth"
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
                <span className={`text-[10px] font-bold ${active ? "text-white/80" : "text-[var(--color-primary-600)]"}`}>
                  Visit #{visit.visitNumber}
                </span>
                <span className={`text-xs font-semibold leading-tight ${active ? "text-white" : "text-[var(--color-ink-800)]"}`}>
                  {format(new Date(visit.date), "dd MMM")}
                </span>
              </button>
            );
          })}
        </div>

        {/* Next arrow (→ newer) */}
        <button
          onClick={() => goTo(selectedIdx - 1)}
          disabled={!canNext}
          aria-label="Newer visit"
          className="shrink-0 size-8 flex items-center justify-center rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-ink-500)] hover:bg-[var(--color-surface-sunken)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={15} />
        </button>
      </div>

      {/* ── Single visit card ────────────────────────────────────────── */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white p-4 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
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
            <p className="text-sm font-semibold text-[var(--color-ink-800)] mt-1.5">
              {format(new Date(v.date), "dd MMM yyyy")}
            </p>
          </div>

          {v.generalExam ? (
            <div className="flex items-center gap-1.5 shrink-0">
              <EmrViewerButton visitId={v.id} visitNumber={v.visitNumber} udid={udid} />
              <VisitDownloadButton visitId={v.id} />
            </div>
          ) : (
            <span className="shrink-0 inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)] cursor-not-allowed">
              No EMR
            </span>
          )}
        </div>

        {/* Hospital / Doctor */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-[var(--color-ink-600)]">
          {v.hospital && (
            <span className="flex items-center gap-1.5 col-span-2 sm:col-span-1">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-[var(--color-ink-400)]">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              {v.hospital.name}
            </span>
          )}
          {v.doctor && (
            <span className="flex items-center gap-1.5 col-span-2 sm:col-span-1">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-[var(--color-ink-400)]">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
              Dr. {v.doctor.name}
            </span>
          )}
        </div>

        <VisitSummaryTabs
          visitId={v.id}
          complaint={v.generalExam?.chiefComplaint ?? null}
          diagnoses={v.diagnoses.map((d) => d.description)}
        />
      </div>

      {/* ── Visit counter ────────────────────────────────────────────── */}
      <p className="text-center text-xs text-[var(--color-ink-400)]">
        Showing visit {visits.length - selectedIdx} of {visits.length}
      </p>

    </div>
  );
}
