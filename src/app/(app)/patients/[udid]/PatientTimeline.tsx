"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import {
  format,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, addMonths, subMonths,
} from "date-fns";
import {
  X, Search, Stethoscope, FlaskConical, Scissors, BedDouble,
  Receipt, ArrowRightLeft, FileText, ChevronDown, ChevronUp,
  Timer, CalendarDays, SlidersHorizontal,
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
    dot: "bg-violet-500", dotHex: "#8B5CF6",
    border: "border-l-violet-400",
    badge: "bg-violet-100 text-violet-700", card: "bg-violet-50/40",
  },
  SURGERY: {
    label: "Surgery", Icon: Scissors,
    dot: "bg-rose-500", dotHex: "#F43F5E",
    border: "border-l-rose-400",
    badge: "bg-rose-100 text-rose-700", card: "bg-rose-50/40",
  },
  ADMISSION: {
    label: "IPD / Admission", Icon: BedDouble,
    dot: "bg-orange-500", dotHex: "#F97316",
    border: "border-l-orange-400",
    badge: "bg-orange-100 text-orange-700", card: "bg-orange-50/40",
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
    const finalizedAt = d.finalizedAt ? new Date(d.finalizedAt) : null;
    const waitMins    = arrivedAt && seenAt
      ? Math.max(0, Math.round((seenAt.getTime() - arrivedAt.getTime()) / 60000))
      : null;
    const totalMins   = arrivedAt && finalizedAt
      ? Math.max(0, Math.round((finalizedAt.getTime() - arrivedAt.getTime()) / 60000))
      : null;
    const fmtDur = (m: number) => m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;

    return (
      <div className="mt-3 space-y-3 text-xs text-[var(--color-ink-700)]">
        {(d.bookedAt || d.arrivedAt || d.seenAt || d.finalizedAt) && (
          <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
            <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-500)] bg-[var(--color-surface-sunken)] border-b border-[var(--color-border)]">
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
                  <span className="flex items-center gap-1.5 text-blue-500">
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
          <div key={o.id} className="flex items-center gap-2 text-xs bg-white rounded-lg px-3 py-2.5 border border-violet-100">
            {o.laterality && (
              <span className="shrink-0 text-[10px] font-bold text-violet-600">{o.laterality}</span>
            )}
            <span className="flex-1 min-w-0 font-medium text-[var(--color-ink-800)] truncate">{o.testName}</span>
            {time && (
              <span className={`shrink-0 flex items-center gap-1 text-[10px] ${hasReport ? "text-emerald-600" : "text-[var(--color-ink-400)]"}`}>
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
    <div className="mt-3 text-xs text-[var(--color-ink-700)] space-y-1">
      <p><span className="font-semibold">Type: </span>{d.surgeryType}</p>
      {d.surgeryDate && <p><span className="font-semibold">Date: </span>{format(new Date(d.surgeryDate), "dd MMM yyyy")}</p>}
      <p><span className="font-semibold">Eye: </span>{[d.rightEye && "Right Eye", d.leftEye && "Left Eye"].filter(Boolean).join(", ") || "—"}</p>
      {d.anaesthesiaType && <p><span className="font-semibold">Anaesthesia: </span>{d.anaesthesiaType}</p>}
    </div>
  );

  if (ev.type === "ADMISSION") return (
    <div className="mt-3 text-xs text-[var(--color-ink-700)] space-y-1">
      {d.admissionReason && <p><span className="font-semibold">Reason: </span>{d.admissionReason}</p>}
      <p><span className="font-semibold">Ward: </span>{d.ward} · <span className="font-semibold">Days: </span>{d.numberOfDays}</p>
      <p><span className="font-semibold">Status: </span>{d.discharged ? `Discharged${d.dischargedAt ? " · " + format(new Date(d.dischargedAt), "dd MMM yyyy") : ""}` : "Admitted"}</p>
    </div>
  );

  if (ev.type === "BILLING") return (
    <div className="mt-3 text-xs text-[var(--color-ink-700)]">
      {d.billSummary && <p>{d.billSummary}</p>}
    </div>
  );

  if (ev.type === "TRANSFER") return (
    <div className="mt-3 text-xs text-[var(--color-ink-700)] space-y-1">
      {d.fromHospital    && <p><span className="font-semibold">From: </span>{d.fromHospital}</p>}
      {d.toHospital      && <p><span className="font-semibold">To: </span>{d.toHospital}</p>}
      {d.transferReason  && <p><span className="font-semibold">Reason: </span>{d.transferReason}</p>}
    </div>
  );

  if (ev.type === "EXTERNAL") return (
    <div className="mt-3 text-xs text-[var(--color-ink-700)] space-y-1">
      {d.externalHospital  && <p><span className="font-semibold">Hospital: </span>{d.externalHospital}</p>}
      {d.externalDiagnosis && <p><span className="font-semibold">Diagnosis: </span>{d.externalDiagnosis}</p>}
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
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${cfg.badge}`}>
                  <cfg.Icon size={9} />{cfg.label}
                </span>
                {ev.detail.visitStatus === "CLOSED" && (
                  <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">
                    Finalized
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-[var(--color-ink-800)] leading-tight">{ev.title}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] font-medium text-[var(--color-ink-400)]">{fullTime(ev.date)}</span>
              {expanded
                ? <ChevronUp size={13} className="text-[var(--color-ink-400)]" />
                : <ChevronDown size={13} className="text-[var(--color-ink-400)]" />}
            </div>
          </div>
          {(ev.hospitalName || ev.doctorName) && (
            <p className="mt-1 text-[11px] text-[var(--color-ink-400)] flex items-center gap-1.5 flex-wrap">
              {ev.hospitalName && <span>{ev.hospitalName}</span>}
              {ev.hospitalName && ev.doctorName && <span>·</span>}
              {ev.doctorName && <span>{ev.doctorName}</span>}
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
  const todayKey = format(new Date(), "yyyy-MM-dd");

  const cells = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end   = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  return (
    <div className="bg-white border-b border-[var(--color-border)] shrink-0">
      {/* Month navigation */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--color-border)]">
        <button
          onClick={onPrev}
          className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)] transition-colors"
        >
          <ChevronLeft size={13} />
        </button>

        <div className="flex items-center gap-1.5">
          <h3 className="text-xs font-bold text-[var(--color-ink-800)]">
            {format(currentMonth, "MMMM yyyy")}
          </h3>
          <button
            onClick={onToday}
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-[var(--color-primary-300)] text-[var(--color-primary-600)] hover:bg-[var(--color-primary-50)] transition-colors"
          >
            Today
          </button>
        </div>

        <button
          onClick={onNext}
          className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)] transition-colors"
        >
          <ChevronRight size={13} />
        </button>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 px-2 pt-1.5">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center text-[9px] font-bold text-[var(--color-ink-400)] uppercase tracking-wide pb-0.5">
            {d}
          </div>
        ))}
      </div>

      {/* Date cells */}
      <div className="grid grid-cols-7 px-2 pb-2 gap-y-0.5">
        {cells.map((day) => {
          const key         = format(day, "yyyy-MM-dd");
          const isThisMonth = isSameMonth(day, currentMonth);
          const isTod       = key === todayKey;
          const isSelected  = key === selectedKey;
          const dayEvents   = eventsByDate[key] ?? [];
          const hasEvents   = dayEvents.length > 0;

          const types = [...new Set(dayEvents.map((e) => e.type))] as TimelineEventType[];

          return (
            <button
              key={key}
              onClick={() => onSelectDate(key)}
              className={[
                "relative flex flex-col items-center py-0.5 rounded-lg transition-all",
                isSelected
                  ? "bg-[var(--color-primary-600)] text-white shadow-sm"
                  : isTod
                  ? "bg-[var(--color-primary-50)] text-[var(--color-primary-700)]"
                  : isThisMonth
                  ? "hover:bg-[var(--color-surface-sunken)] text-[var(--color-ink-700)]"
                  : "text-[var(--color-ink-300)] hover:bg-[var(--color-surface-sunken)]",
              ].join(" ")}
            >
              {/* Today ring */}
              {isTod && !isSelected && (
                <span className="absolute inset-0 rounded-lg ring-2 ring-[var(--color-primary-400)] ring-offset-0 pointer-events-none" />
              )}

              {/* Date number */}
              <span className={[
                "text-[11px] font-semibold leading-none",
                isSelected ? "text-white" : isTod ? "text-[var(--color-primary-700)]" : "",
              ].join(" ")}>
                {format(day, "d")}
              </span>

              {/* Event type dots */}
              <div className="flex items-center justify-center gap-0.5 mt-0.5 min-h-[5px]">
                {hasEvents && types.slice(0, 3).map((t) => (
                  <span
                    key={t}
                    className="w-1 h-1 rounded-full shrink-0"
                    style={{
                      background: isSelected ? "rgba(255,255,255,0.85)" : EVENT_CFG[t].dotHex,
                    }}
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2.5 flex-wrap px-3 py-1.5 border-t border-[var(--color-border)] bg-[var(--color-surface-sunken)]">
        {ALL_TYPES.map((t) => (
          <span key={t} className="flex items-center gap-1 text-[9px] text-[var(--color-ink-400)]">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: EVENT_CFG[t].dotHex }} />
            {EVENT_CFG[t].label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Day events panel ────────────────────────────────────────────────────────── */
function DayEventsPanel({ selectedKey, dayEvents }: { selectedKey: string; dayEvents: TimelineEvent[] }) {
  const label = selectedKey
    ? format(new Date(selectedKey), "EEEE, d MMMM yyyy")
    : "";

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Panel header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2.5 bg-[var(--color-surface-sunken)] border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <CalendarDays size={13} className="text-[var(--color-primary-500)]" />
          <span className="text-xs font-bold text-[var(--color-ink-700)]">{label}</span>
        </div>
        {dayEvents.length > 0 && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--color-primary-100)] text-[var(--color-primary-700)]">
            {dayEvents.length} event{dayEvents.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Events */}
      <div className="px-4 py-4">
        {dayEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-[var(--color-ink-400)]">
            <CalendarDays size={32} className="opacity-25" />
            <p className="text-sm font-medium text-[var(--color-ink-500)]">No events recorded for this date</p>
            <p className="text-xs text-[var(--color-ink-400)]">Select a highlighted date to view patient activity</p>
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

  // Filters
  const [search,         setSearch]         = useState("");
  const [typeFilter,     setTypeFilter]     = useState<TimelineEventType | "ALL">("ALL");
  const [hospitalFilter, setHospitalFilter] = useState("ALL");
  const [doctorFilter,   setDoctorFilter]   = useState("ALL");
  const [showFilters,    setShowFilters]    = useState(false);

  // Load once when first opened
  if (open && !loaded && !isPending) {
    startTrans(async () => {
      const data = await getPatientTimeline(patientId);
      setEvents(data);
      setLoaded(true);
    });
  }

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

  const hospitals = useMemo(() => {
    if (!events) return [];
    return [...new Set(events.map((e) => e.hospitalName).filter(Boolean) as string[])].sort();
  }, [events]);

  const doctors = useMemo(() => {
    if (!events) return [];
    return [...new Set(events.map((e) => e.doctorName).filter(Boolean) as string[])].sort();
  }, [events]);

  const filtered = useMemo(() => {
    if (!events) return [];
    return events.filter((ev) => {
      if (typeFilter !== "ALL" && ev.type !== typeFilter) return false;
      if (hospitalFilter !== "ALL" && ev.hospitalName !== hospitalFilter) return false;
      if (doctorFilter   !== "ALL" && ev.doctorName   !== doctorFilter)   return false;
      if (search) {
        const q = search.toLowerCase();
        if (!ev.searchText.includes(q) && !ev.title.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [events, typeFilter, hospitalFilter, doctorFilter, search]);

  // Group filtered events by date key, sorted ascending within each day
  const eventsByDate = useMemo(() => {
    const map: Record<string, TimelineEvent[]> = {};
    for (const ev of filtered) {
      const key = toDateKey(ev.date);
      (map[key] = map[key] ?? []).push(ev);
    }
    for (const key in map) {
      map[key].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }
    return map;
  }, [filtered]);

  const dayEvents = eventsByDate[selectedKey] ?? [];

  function goToday() {
    setCurrentMonth(new Date());
    setSelectedKey(todayKey);
  }

  function clearFilters() {
    setSearch(""); setTypeFilter("ALL"); setHospitalFilter("ALL"); setDoctorFilter("ALL");
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Panel */}
      <div className="absolute inset-y-0 right-0 w-full max-w-2xl bg-[var(--color-surface)] flex flex-col shadow-2xl">

        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-4 text-white shrink-0"
          style={{ background: "linear-gradient(135deg, var(--color-primary-800) 0%, var(--color-primary-600) 100%)" }}
        >
          <Timer size={18} />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/70 font-medium">Patient History Timeline</p>
            <h2 className="text-base font-bold leading-tight">{patientName}</h2>
          </div>
          {events && (
            <span className="text-xs bg-white/15 px-2 py-0.5 rounded-full font-semibold">
              {filtered.length} / {events.length} events
            </span>
          )}
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/15 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search + type chips */}
        <div className="px-4 py-3 border-b border-[var(--color-border)] bg-white shrink-0 space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]" />
              <input
                type="text"
                placeholder="Search diagnosis, medication, test, hospital…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border border-[var(--color-border)] rounded-lg outline-none focus:border-[var(--color-primary-400)] bg-[var(--color-surface-sunken)]"
              />
            </div>
            <button
              onClick={() => setShowFilters((p) => !p)}
              className={`shrink-0 flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${showFilters ? "bg-[var(--color-primary-50)] border-[var(--color-primary-400)] text-[var(--color-primary-700)]" : "border-[var(--color-border)] text-[var(--color-ink-600)]"}`}
            >
              <SlidersHorizontal size={12} /> Filters
            </button>
          </div>

          {/* Advanced filters */}
          {showFilters && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <select
                value={hospitalFilter}
                onChange={(e) => setHospitalFilter(e.target.value)}
                className="text-xs border border-[var(--color-border)] rounded-lg px-2 py-1.5 bg-white outline-none focus:border-[var(--color-primary-400)]"
              >
                <option value="ALL">All Hospitals</option>
                {hospitals.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
              <select
                value={doctorFilter}
                onChange={(e) => setDoctorFilter(e.target.value)}
                className="text-xs border border-[var(--color-border)] rounded-lg px-2 py-1.5 bg-white outline-none focus:border-[var(--color-primary-400)]"
              >
                <option value="ALL">All Doctors</option>
                {doctors.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              {(hospitalFilter !== "ALL" || doctorFilter !== "ALL" || search) && (
                <button
                  onClick={clearFilters}
                  className="col-span-2 text-xs text-[var(--color-primary-600)] hover:underline text-left"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Body */}
        {isPending ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[var(--color-ink-400)]">
            <Loader2 size={28} className="animate-spin text-[var(--color-primary-500)]" />
            <p className="text-sm">Loading patient history…</p>
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
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--color-primary-300)] text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)] transition-colors"
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
