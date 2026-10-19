"use client";

import { useState, useMemo, useEffect } from "react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, isSameDay, addMonths, subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, Building2, Clock } from "lucide-react";
import { EmrViewerButton, VisitDownloadButton } from "../EmrViewerModal";
import { VisitSummaryTabs } from "../VisitSummaryTabs";

/* ── types ──────────────────────────────────────────────────────────────────── */
export interface VisitTimestamps {
  bookedAt:                string | null;
  scheduledAt:             string | null;
  arrivedAt:               string | null;
  seenAt:                  string | null;
  consultationCompletedAt: string | null;
  investigationOrderedAt:  string | null;
  reportUploadedAt:        string | null;
  refractionStartedAt:     string | null;
  refractionCompletedAt:   string | null;
  refractionPassedOverAt:  string | null;
  partialDispenseAt:       string | null;
  finalizedAt:             string | null;
  dispensedAt:             string | null;
}

export interface VisitRow {
  id:          string;
  visitNumber: number;
  date:        string;
  status:      string;
  visitType:   string | null;
  isWalkIn:    boolean;
  hospital:    { name: string } | null;
  doctor:      { name: string } | null;
  generalExam: { chiefComplaint: string | null } | null;
  diagnoses:   { description: string; laterality: string | null }[];
  timestamps:  VisitTimestamps;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
  });
}

/* ── Mini calendar ──────────────────────────────────────────────────────────── */
const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function MiniCalendar({
  visits, noShowDates, futureApptDates, selectedIdx, onSelect,
}: {
  visits: VisitRow[];
  noShowDates: string[];
  futureApptDates: string[];
  selectedIdx: number;
  onSelect: (idx: number) => void;
}) {
  const [calMonth, setCalMonth] = useState(() =>
    startOfMonth(new Date(visits[selectedIdx].date))
  );

  useEffect(() => {
    setCalMonth(startOfMonth(new Date(visits[selectedIdx].date)));
  }, [visits, selectedIdx]);

  const visitDateMap = useMemo(() => {
    const m = new Map<string, number>();
    visits.forEach((v, idx) => m.set(format(new Date(v.date), "yyyy-MM-dd"), idx));
    return m;
  }, [visits]);

  const noShowSet = useMemo(() => {
    const s = new Set<string>();
    noShowDates.forEach((d) => s.add(format(new Date(d), "yyyy-MM-dd")));
    return s;
  }, [noShowDates]);

  const futureSet = useMemo(() => {
    const s = new Set<string>();
    futureApptDates.forEach((d) => s.add(format(new Date(d), "yyyy-MM-dd")));
    return s;
  }, [futureApptDates]);

  const days = eachDayOfInterval({ start: startOfMonth(calMonth), end: endOfMonth(calMonth) });
  const leadingBlanks = getDay(days[0]);
  const today = new Date();

  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] p-3 select-none">
      {/* month nav */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setCalMonth((m) => subMonths(m, 1))}
          className="size-6 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)] transition-colors"
        >
          <ChevronLeft size={13} />
        </button>
        <span className="text-xs font-bold text-[var(--color-ink-800)]">
          {format(calMonth, "MMM yyyy")}
        </span>
        <button
          onClick={() => setCalMonth((m) => addMonths(m, 1))}
          className="size-6 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)] transition-colors"
        >
          <ChevronRight size={13} />
        </button>
      </div>

      {/* dow header */}
      <div className="grid grid-cols-7 mb-1.5">
        {DOW.map((d) => (
          <span key={d} className="text-center text-[10px] font-bold text-[var(--color-ink-300)] tracking-wide">
            {d}
          </span>
        ))}
      </div>

      {/* days */}
      <div className="grid grid-cols-7 gap-y-1">
        {Array.from({ length: leadingBlanks }).map((_, i) => <div key={`b-${i}`} />)}
        {days.map((day) => {
          const key      = format(day, "yyyy-MM-dd");
          const visitIdx = visitDateMap.get(key);
          const hasVisit = visitIdx !== undefined;
          const isNoShow = noShowSet.has(key);
          const isFuture = futureSet.has(key);
          const isSel    = hasVisit && visitIdx === selectedIdx;
          const isToday  = isSameDay(day, today);

          let cls = "mx-auto flex flex-col items-center justify-center rounded-full transition-all duration-150 ";
          if (hasVisit) {
            cls += "w-7 h-8 ";
          } else {
            cls += "size-7 ";
          }
          if (isSel)         cls += "bg-[var(--color-primary-700)] text-white shadow-sm";
          else if (hasVisit) cls += "bg-[var(--color-primary-100)] text-[var(--color-primary-700)] hover:bg-[var(--color-primary-200)] cursor-pointer";
          else if (isFuture) cls += "bg-indigo-100 text-indigo-600 cursor-default";
          else if (isNoShow) cls += "bg-red-100 text-red-500 cursor-default";
          else               cls += "text-[var(--color-ink-300)] cursor-default";
          if (isToday && !isSel) cls += " ring-2 ring-[var(--color-primary-400)] ring-offset-1";

          return (
            <button
              key={key}
              disabled={!hasVisit}
              onClick={() => hasVisit && onSelect(visitIdx!)}
              className={cls}
              title={
                hasVisit ? `Visit #${visits[visitIdx!].visitNumber} · ${format(day, "dd MMM yyyy")}` :
                isNoShow ? "No Show" :
                isFuture ? "Upcoming Appointment" : undefined
              }
            >
              <span className="text-[11px] font-semibold leading-none">{format(day, "d")}</span>
              {hasVisit && (
                <span className={`text-[8px] font-bold leading-none mt-0.5 ${isSel ? "text-white/80" : "text-[var(--color-primary-500)]"}`}>
                  #{visits[visitIdx!].visitNumber}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 pt-2.5 border-t border-[var(--color-border)]">
        <LegendDot color="bg-[var(--color-primary-300)]" label="Visit" />
        <LegendDot color="bg-red-300"    label="No Show" />
        {futureApptDates.length > 0 && <LegendDot color="bg-indigo-300" label="Upcoming" />}
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[10px] text-[var(--color-ink-500)]">
      <span className={`size-2 rounded-full inline-block ${color}`} />
      {label}
    </span>
  );
}

/* ── Timestamp timeline ─────────────────────────────────────────────────────── */
type TsGroup = "booking" | "clinical" | "dispense";
type TsStep  = { key: keyof VisitTimestamps; label: string; group: TsGroup };

const TS_STEPS: TsStep[] = [
  { key: "bookedAt",                label: "Booked",            group: "booking"  },
  { key: "scheduledAt",             label: "Appt. Time",        group: "booking"  },
  { key: "arrivedAt",               label: "Arrival Time",      group: "clinical" },
  { key: "seenAt",                  label: "Consult. Start",    group: "clinical" },
  { key: "refractionStartedAt",     label: "Refraction Start",  group: "clinical" },
  { key: "refractionCompletedAt",   label: "Refraction Done",   group: "clinical" },
  { key: "refractionPassedOverAt",  label: "Passed Over",       group: "clinical" },
  { key: "investigationOrderedAt",  label: "Inv. Ordered",      group: "clinical" },
  { key: "reportUploadedAt",        label: "Report Upload",     group: "clinical" },
  { key: "partialDispenseAt",       label: "Partial Dispense",  group: "dispense" },
  { key: "consultationCompletedAt", label: "Consult. End",      group: "clinical" },
];

function fmtDuration(fromIso: string | null, toIso: string | null): string | null {
  if (!fromIso || !toIso) return null;
  const mins = Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60000);
  if (mins <= 0) return null;
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const DURATION_METRICS: { label: string; from: keyof VisitTimestamps; to: keyof VisitTimestamps }[] = [
  { label: "Waiting Time",    from: "arrivedAt",           to: "seenAt"                  },
  { label: "Consultation",    from: "seenAt",              to: "consultationCompletedAt"  },
  { label: "Refraction",      from: "refractionStartedAt", to: "refractionCompletedAt"   },
  { label: "Total Visit",     from: "arrivedAt",           to: "finalizedAt"             },
];

function TimestampSection({ ts, isWalkIn }: { ts: VisitTimestamps; isWalkIn: boolean }) {
  const active = TS_STEPS
    .filter((s) => ts[s.key])
    .filter((s) => isWalkIn ? s.group !== "booking" : true)
    .map((s) => ({
      ...s,
      label: isWalkIn && s.key === "arrivedAt" ? "Walk-in Time" : s.label,
    }))
    .sort((a, b) => new Date(ts[a.key]!).getTime() - new Date(ts[b.key]!).getTime());
  if (active.length === 0) return null;

  const durations = DURATION_METRICS
    .map((d) => ({ label: d.label, value: fmtDuration(ts[d.from], ts[d.to]) }))
    .filter((d) => d.value);

  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] p-3">
      {/* heading */}
      <div className="flex items-center gap-1.5 mb-3">
        <Clock size={12} className="text-[var(--color-ink-400)]" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-500)]">
          Time Stamps
        </span>
      </div>

      {/* clean grid of chips */}
      <div className="grid grid-cols-2 gap-2">
        {active.map(({ key, label }) => (
          <div key={key} className="rounded-lg bg-[var(--color-surface-sunken)] px-2.5 py-2">
            <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-ink-400)] leading-tight mb-0.5">{label}</p>
            <p className="text-[12px] font-bold tabular-nums text-[var(--color-ink-800)] leading-none">{fmtTime(ts[key]!)}</p>
          </div>
        ))}
      </div>

      {/* durations */}
      {durations.length > 0 && (
        <div className="mt-2.5 pt-2.5 border-t border-[var(--color-border)] grid grid-cols-2 gap-2">
          {durations.map(({ label, value }) => (
            <div key={label} className="rounded-lg bg-[var(--color-primary-50)] px-2.5 py-2">
              <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-primary-400)] leading-tight mb-0.5">{label}</p>
              <p className="text-[12px] font-bold tabular-nums text-[var(--color-primary-700)] leading-none">{value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────────── */
export function VisitsListClient({
  visits, udid, initialVisitId, noShowDates = [], futureApptDates = [],
}: {
  visits: VisitRow[];
  udid: string;
  initialVisitId?: string;
  noShowDates?: string[];
  futureApptDates?: string[];
}) {
  const initialIdx = initialVisitId
    ? Math.max(0, visits.findIndex((v) => v.id === initialVisitId))
    : 0;
  const [selectedIdx, setSelectedIdx] = useState(initialIdx);

  if (visits.length === 0) {
    return (
      <div className="text-center py-16 text-[var(--color-ink-400)]">
        <p className="text-sm sm:text-base">No visits recorded yet.</p>
      </div>
    );
  }

  const v = visits[selectedIdx];
  const isClosed = v.status === "CLOSED";

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-[var(--color-border)] bg-white overflow-hidden shadow-sm">
        <div className="flex flex-col lg:flex-row">

          {/* ── Left grey panel ─────────────────────────────────────── */}
          <div className="lg:w-72 xl:w-80 shrink-0 flex flex-col border-b lg:border-b-0 lg:border-r border-[var(--color-border)] bg-[var(--color-surface-sunken)]">

            {/* Visit header */}
            <div className="px-4 py-3.5 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                <span className="text-xs font-bold text-[var(--color-primary-700)] bg-[var(--color-primary-50)] px-2.5 py-0.5 rounded-full">
                  Visit #{v.visitNumber}
                </span>
                {isClosed ? (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Completed
                  </span>
                ) : (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                    In Progress
                  </span>
                )}
                {v.visitType && (
                  <span className="text-xs text-[var(--color-ink-500)]">{v.visitType}</span>
                )}
              </div>
              <p className="text-sm font-bold text-[var(--color-ink-900)] mb-1">
                {format(new Date(v.date), "EEEE, dd MMM yyyy")}
              </p>
              {v.hospital && (
                <div className="flex items-center gap-1.5 text-xs text-[var(--color-ink-500)]">
                  <Building2 size={11} className="text-[var(--color-ink-300)] shrink-0" />
                  <span className="truncate">{v.hospital.name}</span>
                </div>
              )}
            </div>

            {/* Calendar + Timestamps */}
            <div className="flex-1">
              <div className="p-3">
                <MiniCalendar
                  visits={visits}
                  noShowDates={noShowDates}
                  futureApptDates={futureApptDates}
                  selectedIdx={selectedIdx}
                  onSelect={setSelectedIdx}
                />
              </div>
              <div className="px-3 pb-3">
                <TimestampSection ts={v.timestamps} isWalkIn={v.isWalkIn} />
              </div>
            </div>

            {/* Actions */}
            <div className="px-4 py-3 border-t border-[var(--color-border)] flex items-center gap-2">
              {v.generalExam ? (
                <>
                  <EmrViewerButton visitId={v.id} visitNumber={v.visitNumber} udid={udid} visitDate={v.date} />
                  <VisitDownloadButton visitId={v.id} udid={udid} />
                </>
              ) : (
                <span className="inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-[var(--color-border)] text-[var(--color-ink-400)] cursor-not-allowed">
                  No EMR
                </span>
              )}
            </div>
          </div>

          {/* ── Right panel: visit summary ───────────────────────────── */}
          <div className="flex-1 min-w-0 p-5">
            <VisitSummaryTabs
              key={v.id}
              visitId={v.id}
              complaint={v.generalExam?.chiefComplaint ?? null}
              diagnoses={v.diagnoses}
              bare
            />
          </div>

        </div>
      </div>

      <p className="text-center text-xs text-[var(--color-ink-400)]">
        Showing visit {visits.length - selectedIdx} of {visits.length}
      </p>
    </div>
  );
}
