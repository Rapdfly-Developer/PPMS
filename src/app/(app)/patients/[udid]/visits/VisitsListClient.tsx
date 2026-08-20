"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ChevronRight, ChevronDown } from "lucide-react";
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (visits.length === 0) {
    return (
      <div className="text-center py-16 text-[var(--color-ink-400)]">
        <p className="text-base">No visits recorded yet.</p>
      </div>
    );
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {visits.map((v, idx) => {
        const isMostRecent = idx === 0;
        const isOpen       = isMostRecent || expanded.has(v.id);
        const isClosed     = v.status === "CLOSED";

        /* ── Collapsed row ── */
        if (!isOpen) {
          return (
            <button
              key={v.id}
              onClick={() => toggle(v.id)}
              className="w-full text-left rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 flex items-center justify-between gap-3 hover:bg-[var(--color-surface-sunken)] transition-colors group"
            >
              <div className="flex items-center gap-2.5 flex-wrap">
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
                <span className="text-sm font-semibold text-[var(--color-ink-800)]">
                  {format(new Date(v.date), "dd MMM yyyy")}
                </span>
              </div>
              <ChevronRight size={14} className="shrink-0 text-[var(--color-ink-300)] group-hover:text-[var(--color-ink-500)] transition-colors" />
            </button>
          );
        }

        /* ── Expanded card ── */
        return (
          <div key={v.id} className="rounded-xl border border-[var(--color-border)] bg-white p-4 flex flex-col gap-3">
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
                <div className="flex items-center gap-2 mt-1.5">
                  <p className="text-sm font-semibold text-[var(--color-ink-800)]">
                    {format(new Date(v.date), "dd MMM yyyy")}
                  </p>
                  {/* Collapse button for older visits */}
                  {!isMostRecent && (
                    <button
                      onClick={() => toggle(v.id)}
                      className="inline-flex items-center gap-0.5 text-[10px] text-[var(--color-ink-400)] hover:text-[var(--color-ink-600)] transition-colors"
                    >
                      <ChevronDown size={11} /> collapse
                    </button>
                  )}
                </div>
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
        );
      })}
    </div>
  );
}
