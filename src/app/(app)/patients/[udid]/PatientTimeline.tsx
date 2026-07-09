"use client";

import { useState, useTransition, useMemo } from "react";
import { format, isToday, formatDistanceToNow } from "date-fns";
import {
  X, Search, Stethoscope, FlaskConical, Scissors, BedDouble,
  Receipt, ArrowRightLeft, FileText, ChevronDown, ChevronUp,
  Timer, Building2, UserRound, CalendarDays, SlidersHorizontal,
  Loader2, Pill, CheckCircle2, Clock, AlertCircle,
} from "lucide-react";
import { getPatientTimeline, type TimelineEvent, type TimelineEventType } from "../actions";

/* ── Config ─────────────────────────────────────────────────────────────────── */
const EVENT_CFG = {
  CONSULTATION: {
    label: "Consultation", Icon: Stethoscope,
    dot: "bg-teal-500", border: "border-l-teal-400",
    badge: "bg-teal-100 text-teal-700", card: "bg-teal-50/40",
  },
  INVESTIGATION: {
    label: "Investigation", Icon: FlaskConical,
    dot: "bg-violet-500", border: "border-l-violet-400",
    badge: "bg-violet-100 text-violet-700", card: "bg-violet-50/40",
  },
  SURGERY: {
    label: "Surgery", Icon: Scissors,
    dot: "bg-rose-500", border: "border-l-rose-400",
    badge: "bg-rose-100 text-rose-700", card: "bg-rose-50/40",
  },
  ADMISSION: {
    label: "IPD / Admission", Icon: BedDouble,
    dot: "bg-orange-500", border: "border-l-orange-400",
    badge: "bg-orange-100 text-orange-700", card: "bg-orange-50/40",
  },
  BILLING: {
    label: "Billing", Icon: Receipt,
    dot: "bg-emerald-500", border: "border-l-emerald-400",
    badge: "bg-emerald-100 text-emerald-700", card: "bg-emerald-50/40",
  },
  TRANSFER: {
    label: "Transfer", Icon: ArrowRightLeft,
    dot: "bg-amber-500", border: "border-l-amber-400",
    badge: "bg-amber-100 text-amber-700", card: "bg-amber-50/40",
  },
  EXTERNAL: {
    label: "External Visit", Icon: FileText,
    dot: "bg-slate-400", border: "border-l-slate-400",
    badge: "bg-slate-100 text-slate-600", card: "bg-slate-50/40",
  },
} as const;

const ALL_TYPES = Object.keys(EVENT_CFG) as TimelineEventType[];

function relTime(iso: string) {
  const d = new Date(iso);
  return isToday(d)
    ? formatDistanceToNow(d, { addSuffix: true })
    : format(d, "dd MMM yyyy");
}

function fullTime(iso: string) {
  const d = new Date(iso);
  return format(d, "dd MMM yyyy · hh:mm a");
}

/* ── Event detail expander ───────────────────────────────────────────────────── */
function EventDetail({ ev }: { ev: TimelineEvent }) {
  const d = ev.detail;

  if (ev.type === "CONSULTATION") return (
    <div className="mt-3 space-y-2 text-xs text-[var(--color-ink-700)]">
      {d.complaint && <p><span className="font-semibold text-[var(--color-ink-500)] uppercase tracking-wide text-[10px]">Chief Complaint</span><br />{d.complaint}</p>}
      {(d.bp || d.pulse) && (
        <p className="flex gap-4">
          {d.bp    && <span><span className="font-semibold">BP </span>{d.bp}</span>}
          {d.pulse && <span><span className="font-semibold">Pulse </span>{d.pulse}</span>}
        </p>
      )}
      {d.diagnoses && d.diagnoses.length > 0 && (
        <div>
          <p className="font-semibold text-[var(--color-ink-500)] uppercase tracking-wide text-[10px] mb-1">Diagnoses</p>
          <ul className="space-y-0.5">
            {d.diagnoses.map((dx, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0" />
                <span>{dx.description}{dx.icd10Code && <span className="text-[var(--color-ink-400)] ml-1">({dx.icd10Code})</span>}{dx.laterality && <span className="text-[var(--color-ink-400)] ml-1">· {dx.laterality}</span>}{dx.provisional && <span className="ml-1 text-amber-600 font-medium">Provisional</span>}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {d.medications && d.medications.length > 0 && (
        <div>
          <p className="font-semibold text-[var(--color-ink-500)] uppercase tracking-wide text-[10px] mb-1">Medications</p>
          <ul className="space-y-0.5">
            {d.medications.map((m, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <Pill size={11} className="text-teal-500 mt-0.5 shrink-0" />
                <span>{m.drugName}{m.dosage && ` · ${m.dosage}`}{m.frequency && ` · ${m.frequency}`}{m.duration && ` · ${m.duration}`}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  if (ev.type === "INVESTIGATION") return (
    <div className="mt-3 space-y-1.5">
      {d.orders?.map((o) => (
        <div key={o.id} className="flex items-center justify-between text-xs bg-white rounded-lg px-3 py-2 border border-violet-100">
          <span className="font-medium text-[var(--color-ink-800)]">{o.testName}</span>
          <div className="flex items-center gap-2 shrink-0">
            {o.laterality && <span className="text-[var(--color-ink-400)]">{o.laterality}</span>}
            <StatusBadge status={o.status} />
          </div>
        </div>
      ))}
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
      {d.fromHospital && <p><span className="font-semibold">From: </span>{d.fromHospital}</p>}
      {d.toHospital   && <p><span className="font-semibold">To: </span>{d.toHospital}</p>}
      {d.transferReason && <p><span className="font-semibold">Reason: </span>{d.transferReason}</p>}
    </div>
  );

  if (ev.type === "EXTERNAL") return (
    <div className="mt-3 text-xs text-[var(--color-ink-700)] space-y-1">
      {d.externalHospital  && <p><span className="font-semibold">Hospital: </span>{d.externalHospital}</p>}
      {d.externalDiagnosis && <p><span className="font-semibold">Diagnosis: </span>{d.externalDiagnosis}</p>}
      {d.externalTreatment && <p><span className="font-semibold">Treatment: </span>{d.externalTreatment}</p>}
      {d.scanRef && (
        <a href={d.scanRef} target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary-600)] underline">View Scan</a>
      )}
      <p><span className="font-semibold">Status: </span>{d.verificationStatus?.replace("_", " ")}</p>
    </div>
  );

  return null;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
    ORDERED:          { label: "Ordered",     cls: "bg-blue-100 text-blue-700",    Icon: Clock },
    IN_PROGRESS:      { label: "In Progress", cls: "bg-amber-100 text-amber-700",  Icon: Clock },
    RESULT_AVAILABLE: { label: "Result",      cls: "bg-emerald-100 text-emerald-700", Icon: CheckCircle2 },
    REVIEWED:         { label: "Reviewed",    cls: "bg-teal-100 text-teal-700",    Icon: CheckCircle2 },
  };
  const cfg = map[status] ?? { label: status, cls: "bg-slate-100 text-slate-600", Icon: AlertCircle };
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${cfg.cls}`}>
      <cfg.Icon size={9} />{cfg.label}
    </span>
  );
}

/* ── Single event card ───────────────────────────────────────────────────────── */
function EventCard({ ev, isLast }: { ev: TimelineEvent; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = EVENT_CFG[ev.type];

  return (
    <div className="relative flex gap-4">
      {/* Vertical rail */}
      <div className="flex flex-col items-center shrink-0">
        <div className={`w-3 h-3 rounded-full ${cfg.dot} ring-2 ring-white shadow-sm mt-1 shrink-0`} />
        {!isLast && <div className="w-px flex-1 bg-[var(--color-border)] mt-1" />}
      </div>

      {/* Card */}
      <div className={`flex-1 mb-4 rounded-xl border border-[var(--color-border)] border-l-4 ${cfg.border} ${cfg.card} overflow-hidden`}>
        <div
          className="px-4 py-3 cursor-pointer select-none"
          onClick={() => setExpanded((p) => !p)}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${cfg.badge}`}>
                  <cfg.Icon size={9} />{cfg.label}
                </span>
                {ev.detail.visitStatus === "CLOSED" && (
                  <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">Finalized</span>
                )}
              </div>
              <p className="text-sm font-semibold text-[var(--color-ink-800)] leading-tight line-clamp-2">{ev.title}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-medium text-[var(--color-ink-500)]">{relTime(ev.date)}</p>
              {expanded
                ? <ChevronUp size={14} className="ml-auto mt-1 text-[var(--color-ink-400)]" />
                : <ChevronDown size={14} className="ml-auto mt-1 text-[var(--color-ink-400)]" />}
            </div>
          </div>

          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-[var(--color-ink-400)]">
            {ev.hospitalName && (
              <span className="flex items-center gap-1"><Building2 size={10} />{ev.hospitalName}</span>
            )}
            {ev.doctorName && (
              <span className="flex items-center gap-1"><UserRound size={10} />{ev.doctorName}</span>
            )}
            <span className="flex items-center gap-1 ml-auto"><CalendarDays size={10} />{fullTime(ev.date)}</span>
          </div>
        </div>

        {expanded && (
          <div className="px-4 pb-3 border-t border-[var(--color-border)]/60">
            <EventDetail ev={ev} />
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

  // Filters
  const [search,       setSearch]       = useState("");
  const [typeFilter,   setTypeFilter]   = useState<TimelineEventType | "ALL">("ALL");
  const [hospitalFilter, setHospitalFilter] = useState("ALL");
  const [doctorFilter,   setDoctorFilter]   = useState("ALL");
  const [dateFrom,     setDateFrom]     = useState("");
  const [dateTo,       setDateTo]       = useState("");
  const [showFilters,  setShowFilters]  = useState(false);

  // Load once when first opened
  if (open && !loaded && !isPending) {
    startTrans(async () => {
      const data = await getPatientTimeline(patientId);
      setEvents(data);
      setLoaded(true);
    });
  }

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
      if (dateFrom && new Date(ev.date) < new Date(dateFrom)) return false;
      if (dateTo   && new Date(ev.date) > new Date(dateTo + "T23:59:59")) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!ev.searchText.includes(q) && !ev.title.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [events, typeFilter, hospitalFilter, doctorFilter, dateFrom, dateTo, search]);

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

        {/* Search + filter bar */}
        <div className="px-4 py-3 border-b border-[var(--color-border)] bg-white shrink-0 space-y-2">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]" />
            <input
              type="text"
              placeholder="Search diagnosis, medication, test, hospital…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-[var(--color-border)] rounded-lg outline-none focus:border-[var(--color-primary-400)] bg-[var(--color-surface-sunken)]"
            />
          </div>

          {/* Type filter chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
            <button
              onClick={() => setTypeFilter("ALL")}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${typeFilter === "ALL" ? "bg-[var(--color-primary-600)] text-white border-[var(--color-primary-600)]" : "border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)]"}`}
            >
              All Events
            </button>
            {ALL_TYPES.map((t) => {
              const cfg = EVENT_CFG[t];
              const active = typeFilter === t;
              return (
                <button
                  key={t}
                  onClick={() => setTypeFilter(active ? "ALL" : t)}
                  className={`shrink-0 inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${active ? cfg.badge + " border-current" : "border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)]"}`}
                >
                  <cfg.Icon size={10} />{cfg.label}
                </button>
              );
            })}
            <button
              onClick={() => setShowFilters((p) => !p)}
              className={`shrink-0 ml-auto flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${showFilters ? "bg-[var(--color-primary-50)] border-[var(--color-primary-400)] text-[var(--color-primary-700)]" : "border-[var(--color-border)] text-[var(--color-ink-600)]"}`}
            >
              <SlidersHorizontal size={10} /> Filters
            </button>
          </div>

          {/* Extra filters */}
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
              <div className="flex items-center gap-1.5">
                <label className="text-[10px] font-semibold text-[var(--color-ink-500)] shrink-0">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="flex-1 text-xs border border-[var(--color-border)] rounded-lg px-2 py-1.5 bg-white outline-none focus:border-[var(--color-primary-400)]"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-[10px] font-semibold text-[var(--color-ink-500)] shrink-0">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="flex-1 text-xs border border-[var(--color-border)] rounded-lg px-2 py-1.5 bg-white outline-none focus:border-[var(--color-primary-400)]"
                />
              </div>
              {(hospitalFilter !== "ALL" || doctorFilter !== "ALL" || dateFrom || dateTo) && (
                <button
                  onClick={() => { setHospitalFilter("ALL"); setDoctorFilter("ALL"); setDateFrom(""); setDateTo(""); }}
                  className="col-span-2 text-xs text-[var(--color-primary-600)] hover:underline text-left"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Timeline body */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {isPending && (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-[var(--color-ink-400)]">
              <Loader2 size={28} className="animate-spin text-[var(--color-primary-500)]" />
              <p className="text-sm">Loading patient history…</p>
            </div>
          )}

          {!isPending && events && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-[var(--color-ink-400)]">
              <Search size={28} className="opacity-30" />
              <p className="text-sm font-medium">No events match your filters</p>
              <button
                onClick={() => { setSearch(""); setTypeFilter("ALL"); setHospitalFilter("ALL"); setDoctorFilter("ALL"); setDateFrom(""); setDateTo(""); }}
                className="text-xs text-[var(--color-primary-600)] hover:underline"
              >
                Clear all filters
              </button>
            </div>
          )}

          {!isPending && filtered.length > 0 && (
            <div className="pl-1">
              {filtered.map((ev, i) => (
                <EventCard key={ev.id} ev={ev} isLast={i === filtered.length - 1} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Trigger button (exported for page.tsx) ──────────────────────────────────── */
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
