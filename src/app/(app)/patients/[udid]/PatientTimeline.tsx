"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import {
  format,
  startOfMonth, endOfMonth,
  eachDayOfInterval, isSameDay, getDay, addMonths, subMonths,
} from "date-fns";
import {
  X, Stethoscope, FlaskConical, Scissors,
  Receipt, ArrowRightLeft, FileText, ChevronDown, ChevronUp,
  Timer, CalendarDays,
  Loader2, CheckCircle2, Clock, AlertCircle, LogIn, Calendar,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { getPatientTimeline, type TimelineEvent, type TimelineEventType } from "../actions";

/* ── Config ─────────────────────────────────────────────────────────────────── */
const EVENT_CFG = {
  CONSULTATION: {
    label: "Consultation", Icon: Stethoscope,
    dot: "bg-teal-500", dotHex: "#14B8A6",
    border: "border-l-teal-400",
    badge: "bg-teal-100 text-teal-700", card: "bg-teal-50/40",
  },
  INVESTIGATION: {
    label: "Investigation", Icon: FlaskConical,
    dot: "bg-teal-500", dotHex: "#8B5CF6",
    border: "border-l-teal-300",
    badge: "bg-teal-50 text-teal-700", card: "bg-teal-50/40",
  },
  SURGERY: {
    label: "Surgery", Icon: Scissors,
    dot: "bg-rose-500", dotHex: "#F43F5E",
    border: "border-l-rose-400",
    badge: "bg-rose-100 text-rose-700", card: "bg-rose-50/40",
  },
  BILLING: {
    label: "Billing", Icon: Receipt,
    dot: "bg-emerald-500", dotHex: "#10B981",
    border: "border-l-emerald-400",
    badge: "bg-emerald-100 text-emerald-700", card: "bg-emerald-50/40",
  },
  TRANSFER: {
    label: "Transfer", Icon: ArrowRightLeft,
    dot: "bg-amber-500", dotHex: "#F59E0B",
    border: "border-l-amber-400",
    badge: "bg-amber-100 text-amber-700", card: "bg-amber-50/40",
  },
  EXTERNAL: {
    label: "External Visit", Icon: FileText,
    dot: "bg-slate-400", dotHex: "#94A3B8",
    border: "border-l-slate-400",
    badge: "bg-slate-100 text-slate-600", card: "bg-slate-50/40",
  },
} as const;

const ALL_TYPES = Object.keys(EVENT_CFG) as TimelineEventType[];
const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function toDateKey(iso: string) {
  return format(new Date(iso), "yyyy-MM-dd");
}

function fullTime(iso: string) {
  return format(new Date(iso), "d MMM yyyy, h:mm a");
}

function timeOnly(date: Date) {
  return format(date, "h:mm a");
}

/* ── EventDetail ─────────────────────────────────────────────────────────────── */
function EventDetail({ ev }: { ev: TimelineEvent }) {
  const d = ev.detail;

  if (ev.type === "CONSULTATION") {
    const arrivedAt   = d.arrivedAt   ? new Date(d.arrivedAt)   : null;
    const seenAt      = d.seenAt      ? new Date(d.seenAt)      : null;
    const consultationCompletedAt = d.consultationCompletedAt ? new Date(d.consultationCompletedAt) : null;
    const refractionStartedAt = d.refractionStartedAt ? new Date(d.refractionStartedAt) : null;
    const refractionPassedOverAt = d.refractionPassedOverAt ? new Date(d.refractionPassedOverAt) : null;
    const finalizedAt = d.finalizedAt ? new Date(d.finalizedAt) : null;
    const waitMins    = arrivedAt && seenAt
      ? Math.max(0, Math.round((seenAt.getTime() - arrivedAt.getTime()) / 60000))
      : null;
    const totalMins   = arrivedAt && finalizedAt
      ? Math.max(0, Math.round((finalizedAt.getTime() - arrivedAt.getTime()) / 60000))
      : null;
    const consultationMins = seenAt && consultationCompletedAt
      ? Math.max(0, Math.round((consultationCompletedAt.getTime() - seenAt.getTime()) / 60000))
      : null;
    const refractionMins = refractionStartedAt && refractionPassedOverAt
      ? Math.max(0, Math.round((refractionPassedOverAt.getTime() - refractionStartedAt.getTime()) / 60000))
      : null;
    const fmtDur = (m: number) => m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;

    return (
      <div className="mt-3 space-y-3 text-caption sm:text-xs text-[var(--color-ink-700)]">
        {(d.bookedAt || d.arrivedAt || d.seenAt || d.refractionStartedAt || d.finalizedAt) && (
          <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
            <p className="px-3 py-1.5 text-micro sm:text-micro sm:text-caption font-bold uppercase tracking-wider text-[var(--color-ink-500)] bg-[var(--color-surface-sunken)] border-b border-[var(--color-border)]">
              Visit Timeline
            </p>
            <div className="divide-y divide-[var(--color-border)]">
              {d.bookedAt && (
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="flex items-center gap-1.5 text-[var(--color-ink-500)]">
                    <Clock size={11} className="shrink-0" /> Appointment Booked
                  </span>
                  <span className="font-semibold text-[var(--color-ink-800)]">
                    {timeOnly(new Date(d.bookedAt))}
                  </span>
                </div>
              )}
              {d.scheduledAt && (
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="flex items-center gap-1.5 text-[var(--color-ink-500)]">
                    <Calendar size={11} className="shrink-0" /> Appointment Time
                  </span>
                  <span className="font-semibold text-[var(--color-ink-800)]">
                    {timeOnly(new Date(d.scheduledAt))}
                  </span>
                </div>
              )}
              {arrivedAt && (
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="flex items-center gap-1.5 text-teal-500">
                    <LogIn size={11} className="shrink-0" /> Arrived at Clinic
                  </span>
                  <span className="font-semibold text-[var(--color-ink-800)]">
                    {timeOnly(arrivedAt)}
                  </span>
                </div>
              )}
              {seenAt && (
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="flex items-center gap-1.5 text-teal-600">
                    <Stethoscope size={11} className="shrink-0" />
                    Seen by Doctor
                    {waitMins !== null && (
                      <span className="ml-1 text-amber-500 font-medium">({fmtDur(waitMins)} wait)</span>
                    )}
                  </span>
                  <span className="font-semibold text-[var(--color-ink-800)]">
                    {timeOnly(seenAt)}
                  </span>
                </div>
              )}
              {consultationCompletedAt && (
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="flex items-center gap-1.5 text-teal-600">
                    <Stethoscope size={11} className="shrink-0" /> Consultation Completed
                    {consultationMins !== null && (
                      <span className="ml-1 text-[var(--color-ink-400)] font-normal">
                        ({fmtDur(consultationMins)})
                      </span>
                    )}
                  </span>
                  <span className="font-semibold text-[var(--color-ink-800)]">
                    {timeOnly(consultationCompletedAt)}
                  </span>
                </div>
              )}
              {refractionStartedAt && (
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="flex items-center gap-1.5 text-cyan-600">
                    <Clock size={11} className="shrink-0" /> Refraction Started
                  </span>
                  <span className="font-semibold text-[var(--color-ink-800)]">
                    {timeOnly(refractionStartedAt)}
                  </span>
                </div>
              )}
              {refractionPassedOverAt && (
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="flex items-center gap-1.5 text-cyan-700">
                    <CheckCircle2 size={11} className="shrink-0" /> Passed to Doctor
                    {refractionMins !== null && (
                      <span className="ml-1 text-[var(--color-ink-400)] font-normal">
                        ({fmtDur(refractionMins)})
                      </span>
                    )}
                  </span>
                  <span className="font-semibold text-[var(--color-ink-800)]">
                    {timeOnly(refractionPassedOverAt)}
                  </span>
                </div>
              )}
              {d.partialDispenseAt && (
                <div className="flex items-center justify-between px-3 py-2 bg-amber-50/60">
                  <span className="flex items-center gap-1.5 text-amber-600">
                    <AlertCircle size={11} className="shrink-0" /> Partial Dispense
                  </span>
                  <span className="font-semibold text-amber-700">
                    {timeOnly(new Date(d.partialDispenseAt))}
                  </span>
                </div>
              )}
              {finalizedAt && (
                <div className="flex items-center justify-between px-3 py-2 bg-emerald-50/60">
                  <span className="flex items-center gap-1.5 text-emerald-600">
                    <CheckCircle2 size={11} className="shrink-0" />
                    Dispensed
                    {totalMins !== null && (
                      <span className="ml-1 text-[var(--color-ink-400)] font-normal">
                        ({fmtDur(totalMins)} total visit)
                      </span>
                    )}
                  </span>
                  <span className="font-semibold text-emerald-700">
                    {timeOnly(finalizedAt)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (ev.type === "INVESTIGATION") return (
    <div className="mt-3 space-y-2">
      {d.orders?.map((o) => {
        const hasReport = !!o.reportUpdatedAt;
        const time = hasReport ? o.reportUpdatedAt : o.orderedAt;
        return (
          <div key={o.id} className="flex items-center gap-2 text-xs bg-white rounded-lg px-3 py-2.5 border border-teal-50">
            {o.laterality && (
              <span className="shrink-0 text-micro sm:text-caption font-bold text-teal-600">{o.laterality}</span>
            )}
            <span className="flex-1 min-w-0 font-medium text-[var(--color-ink-800)] truncate">{o.testName}</span>
            {time && (
              <span className={`shrink-0 flex items-center gap-1 text-caption ${hasReport ? "text-emerald-600" : "text-[var(--color-ink-400)]"}`}>
                {hasReport ? <CheckCircle2 size={9} className="shrink-0" /> : <Clock size={9} className="shrink-0" />}
                {hasReport ? "Report updated" : "Ordered"}: {format(new Date(time), "d MMM yyyy, h:mm a")}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );

  if (ev.type === "SURGERY") return (
    <div className="mt-3 text-caption sm:text-xs text-[var(--color-ink-700)] space-y-1">
      <p><span className="font-semibold">Type: </span>{d.surgeryType}</p>
      {d.surgeryDate && <p><span className="font-semibold">Date: </span>{format(new Date(d.surgeryDate), "dd MMM yyyy")}</p>}
      <p><span className="font-semibold">Eye: </span>{[d.rightEye && "Right Eye", d.leftEye && "Left Eye"].filter(Boolean).join(", ") || "—"}</p>
      {d.anaesthesiaType && <p><span className="font-semibold">Anaesthesia: </span>{d.anaesthesiaType}</p>}
    </div>
  );

  if (ev.type === "BILLING") return (
    <div className="mt-3 text-caption sm:text-xs text-[var(--color-ink-700)]">
      {d.billSummary && <p>{d.billSummary}</p>}
    </div>
  );

  if (ev.type === "TRANSFER") return (
    <div className="mt-3 text-caption sm:text-xs text-[var(--color-ink-700)] space-y-1">
      {d.fromHospital    && <p><span className="font-semibold">From: </span>{d.fromHospital}</p>}
      {d.toHospital      && <p><span className="font-semibold">To: </span>{d.toHospital}</p>}
      {d.transferReason  && <p><span className="font-semibold">Reason: </span>{d.transferReason}</p>}
    </div>
  );

  if (ev.type === "EXTERNAL") return (
    <div className="mt-3 text-caption sm:text-xs text-[var(--color-ink-700)] space-y-1">
      {d.externalHospital  && <p><span className="font-semibold">Hospital: </span>{d.externalHospital}</p>}
      {d.externalDiagnosis && <p className="clinical-diagnosis-text"><span className="font-semibold">Diagnosis: </span>{d.externalDiagnosis}</p>}
      {d.externalTreatment && <p><span className="font-semibold">Treatment: </span>{d.externalTreatment}</p>}
      {d.scanRef && (
        <a href={d.scanRef} target="_blank" rel="noopener noreferrer"
          className="text-[var(--color-primary-600)] underline">View Scan</a>
      )}
      <p><span className="font-semibold">Status: </span>{d.verificationStatus?.replace("_", " ")}</p>
    </div>
  );

  return null;
}

/* ── Single event card (calendar day view) ───────────────────────────────────── */
function EventCard({ ev, isLast }: { ev: TimelineEvent; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = EVENT_CFG[ev.type];

  return (
    <div className="relative flex gap-3">
      {/* Vertical rail */}
      <div className="flex flex-col items-center shrink-0">
        <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot} ring-2 ring-white shadow-sm mt-1.5 shrink-0`} />
        {!isLast && <div className="w-px flex-1 bg-[var(--color-border)] mt-1" />}
      </div>

      {/* Card */}
      <div className={`flex-1 mb-3 rounded-xl border border-[var(--color-border)] border-l-4 ${cfg.border} ${cfg.card} overflow-hidden`}>
        <div className="px-3 py-2.5 cursor-pointer select-none" onClick={() => setExpanded((p) => !p)}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-micro sm:text-caption font-bold uppercase tracking-wide ${cfg.badge}`}>
                  <cfg.Icon size={9} />{cfg.label}
                </span>
                {ev.detail.visitStatus === "CLOSED" && (
                  <span className="text-caption font-semibold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">
                    Finalized
                  </span>
                )}
              </div>
              <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-800)] leading-tight">{ev.title}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-caption sm:text-caption font-medium text-[var(--color-ink-400)]">{fullTime(ev.date)}</span>
              {expanded
                ? <ChevronUp size={13} className="text-[var(--color-ink-400)]" />
                : <ChevronDown size={13} className="text-[var(--color-ink-400)]" />}
            </div>
          </div>
          {(ev.hospitalName || ev.doctorName) && (
            <p className="mt-1 text-caption sm:text-caption text-[var(--color-ink-400)] flex items-center gap-1.5 flex-wrap">
              {ev.hospitalName && <span>{ev.hospitalName}</span>}
              {ev.hospitalName && ev.doctorName && <span>·</span>}
              {ev.doctorName && <span>Dr. {ev.doctorName}</span>}
            </p>
          )}
        </div>
        {expanded && (
          <div className="px-3 pb-3 border-t border-[var(--color-border)]/60">
            <EventDetail ev={ev} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Calendar month grid ─────────────────────────────────────────────────────── */
const LEGEND_TYPES = ALL_TYPES.filter((t) => t !== "TRANSFER");

function CalendarGrid({
  currentMonth,
  selectedKey,
  eventsByDate,
  onSelectDate,
  onPrev,
  onNext,
  onToday,
}: {
  currentMonth: Date;
  selectedKey: string;
  eventsByDate: Record<string, TimelineEvent[]>;
  onSelectDate: (key: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const today = new Date();

  const days = useMemo(() => {
    return eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  }, [currentMonth]);

  const leadingBlanks = getDay(days[0]);

  return (
    <div className="shrink-0 px-5 pt-4 pb-3 border-b border-[var(--color-border)]"
      style={{ background: "linear-gradient(160deg, var(--color-primary-50) 0%, #fff 60%)" }}
    >
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onPrev}
          className="size-8 flex items-center justify-center rounded-full bg-white border border-[var(--color-border)] shadow-sm hover:shadow text-[var(--color-ink-500)] hover:text-[var(--color-primary-600)] transition-all"
        >
          <ChevronLeft size={14} />
        </button>

        <div className="text-center">
          <h3 className="text-[15px] font-bold tracking-tight text-[var(--color-ink-800)]">
            {format(currentMonth, "MMMM")}
          </h3>
          <p className="text-[11px] text-[var(--color-ink-400)] font-medium -mt-0.5">
            {format(currentMonth, "yyyy")}
          </p>
        </div>

        <button
          onClick={onNext}
          className="size-8 flex items-center justify-center rounded-full bg-white border border-[var(--color-border)] shadow-sm hover:shadow text-[var(--color-ink-500)] hover:text-[var(--color-primary-600)] transition-all"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 mb-2">
        {DAY_LABELS.map((d) => (
          <span key={d} className="text-center text-[9px] font-bold text-[var(--color-ink-300)] uppercase tracking-widest">
            {d}
          </span>
        ))}
      </div>

      {/* Date cells */}
      <div className="grid grid-cols-7 gap-y-1.5">
        {Array.from({ length: leadingBlanks }).map((_, i) => <div key={`b-${i}`} />)}
        {days.map((day) => {
          const key        = format(day, "yyyy-MM-dd");
          const isSelected = key === selectedKey;
          const isToday    = isSameDay(day, today);
          const dayEvents  = eventsByDate[key] ?? [];
          const hasEvents  = dayEvents.length > 0;
          const types      = [...new Set(dayEvents.map((e) => e.type))] as TimelineEventType[];

          return (
            <div key={key} className="flex justify-center">
              <button
                disabled={!hasEvents}
                onClick={() => hasEvents && onSelectDate(key)}
                className={[
                  "relative flex flex-col items-center justify-center size-9 rounded-xl transition-all duration-150",
                  isSelected
                    ? "bg-[var(--color-primary-600)] text-white shadow-md scale-105"
                    : hasEvents
                    ? "bg-white border border-[var(--color-primary-200)] text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)] hover:border-[var(--color-primary-300)] cursor-pointer shadow-sm"
                    : "text-[var(--color-ink-300)] cursor-default",
                  isToday && !isSelected ? "ring-2 ring-[var(--color-primary-400)] ring-offset-1" : "",
                ].join(" ")}
              >
                <span className={["text-[11px] font-bold leading-none", isSelected ? "text-white" : ""].join(" ")}>
                  {format(day, "d")}
                </span>
                {hasEvents && (
                  <div className="flex gap-[2px] mt-[3px]">
                    {types.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="w-[5px] h-[5px] rounded-full shrink-0"
                        style={{ background: isSelected ? "rgba(255,255,255,0.75)" : EVENT_CFG[t].dotHex }}
                      />
                    ))}
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Today button + Legend */}
      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[var(--color-border)]/60">
        <button
          onClick={onToday}
          className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-white border border-[var(--color-primary-200)] text-[var(--color-primary-600)] hover:bg-[var(--color-primary-50)] shadow-sm transition-all"
        >
          Today
        </button>
        <div className="flex flex-wrap gap-x-2.5 gap-y-1 justify-end">
          {LEGEND_TYPES.map((t) => (
            <span key={t} className="flex items-center gap-1 text-[9px] font-medium text-[var(--color-ink-400)]">
              <span className="size-1.5 rounded-full inline-block shrink-0" style={{ background: EVENT_CFG[t].dotHex }} />
              {EVENT_CFG[t].label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Day events panel ────────────────────────────────────────────────────────── */
function DayEventsPanel({ selectedKey, dayEvents }: { selectedKey: string; dayEvents: TimelineEvent[] }) {
  return (
    <div className="flex-1 overflow-y-auto">
      {/* Date label */}
      <div className="sticky top-0 z-10 px-5 py-2.5 bg-white/90 backdrop-blur-sm border-b border-[var(--color-border)]">
        <p className="text-xs font-semibold text-[var(--color-ink-600)]">
          {selectedKey ? format(new Date(selectedKey), "EEEE, d MMMM yyyy") : ""}
        </p>
      </div>

      <div className="px-4 py-4">
        {dayEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <CalendarDays size={28} className="text-[var(--color-ink-300)]" />
            <p className="text-xs text-[var(--color-ink-400)]">No activity on this date</p>
          </div>
        ) : (
          <div className="pl-1">
            {dayEvents.map((ev, i) => (
              <EventCard key={ev.id} ev={ev} isLast={i === dayEvents.length - 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main Timeline Modal ─────────────────────────────────────────────────────── */
export function PatientTimelineModal({
  patientId,
  patientName,
  open,
  onClose,
}: {
  patientId: string;
  patientName: string;
  open: boolean;
  onClose: () => void;
}) {
  const [events, setEvents]     = useState<TimelineEvent[] | null>(null);
  const [loaded, setLoaded]     = useState(false);
  const [isPending, startTrans] = useTransition();

  // Calendar state
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const [currentMonth,  setCurrentMonth]  = useState(() => new Date());
  const [selectedKey,   setSelectedKey]   = useState(todayKey);

  // Load once when first opened
  useEffect(() => {
    if (!open || loaded || isPending) return;
    startTrans(async () => {
      const data = await getPatientTimeline(patientId);
      setEvents(data);
      setLoaded(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loaded]);

  // After load: if today has no events, jump to the most recent event date
  useEffect(() => {
    if (!events || events.length === 0) return;
    const hasToday = events.some((ev) => toDateKey(ev.date) === todayKey);
    if (!hasToday) {
      const mostRecentDate = new Date(events[0].date);
      setCurrentMonth(new Date(mostRecentDate.getFullYear(), mostRecentDate.getMonth(), 1));
      setSelectedKey(toDateKey(events[0].date));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  // Group events by date key, sorted ascending within each day
  const eventsByDate = useMemo(() => {
    const map: Record<string, TimelineEvent[]> = {};
    for (const ev of (events ?? [])) {
      const key = toDateKey(ev.date);
      (map[key] = map[key] ?? []).push(ev);
    }
    for (const key in map) {
      map[key].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }
    return map;
  }, [events]);

  const dayEvents = eventsByDate[selectedKey] ?? [];

  function goToday() {
    setCurrentMonth(new Date());
    setSelectedKey(todayKey);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Panel */}
      <div className="absolute inset-y-0 right-0 w-full max-w-[400px] bg-[var(--color-surface)] flex flex-col shadow-2xl">

        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-4 text-white shrink-0"
          style={{ background: "linear-gradient(135deg, var(--color-primary-800) 0%, var(--color-primary-600) 100%)" }}
        >
          <Timer size={16} className="opacity-80" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-white/60 font-medium uppercase tracking-widest">History</p>
            <h2 className="text-sm font-bold leading-tight truncate">{patientName}</h2>
          </div>
          {events && (
            <span className="text-[10px] bg-white/15 px-2 py-0.5 rounded-full font-semibold">
              {events.length} visits
            </span>
          )}
          <button
            onClick={onClose}
            className="size-7 flex items-center justify-center rounded-full hover:bg-white/15 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        {isPending ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[var(--color-ink-400)]">
            <Loader2 size={28} className="animate-spin text-[var(--color-primary-500)]" />
            <p className="text-label sm:text-sm">Loading patient history…</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Calendar */}
            <CalendarGrid
              currentMonth={currentMonth}
              selectedKey={selectedKey}
              eventsByDate={eventsByDate}
              onSelectDate={(key) => {
                setSelectedKey(key);
                // If selected date is in a different month, navigate there
                const d = new Date(key);
                if (
                  d.getMonth() !== currentMonth.getMonth() ||
                  d.getFullYear() !== currentMonth.getFullYear()
                ) {
                  setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                }
              }}
              onPrev={() => setCurrentMonth((m) => subMonths(m, 1))}
              onNext={() => setCurrentMonth((m) => addMonths(m, 1))}
              onToday={goToday}
            />

            {/* Day events */}
            <DayEventsPanel selectedKey={selectedKey} dayEvents={dayEvents} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Trigger button ──────────────────────────────────────────────────────────── */
export function TimeStampButton({ patientId, patientName }: { patientId: string; patientName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--color-primary-400)] text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)] transition-colors"
      >
        <Timer size={13} />
        Time Stamp
      </button>
      <PatientTimelineModal
        patientId={patientId}
        patientName={patientName}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
