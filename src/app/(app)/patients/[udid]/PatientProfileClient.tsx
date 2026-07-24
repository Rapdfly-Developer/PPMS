"use client";

import { useState, useMemo, useTransition } from "react";
import { format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight, ChevronDown, Hospital, Stethoscope, FileText,
  CheckCircle2, Clock, AlertCircle, Filter, ClipboardCheck,
  ArrowRightLeft, X, Download, Loader2,
  Pill, Activity,
} from "lucide-react";
import { EmrViewerButton, VisitDownloadButton } from "./EmrViewerModal";
import { VisitSummaryTabs } from "./VisitSummaryTabs";
import { transferPatient } from "../actions";
export { TimeStampButton } from "./PatientTimeline";

/* ── Chief complaint parser (mirrors GeneralExamTab storage format) ──────────
   Stored as "[RE] [3 days] Redness | [LE] Watering"                          */
function parseComplaints(raw: string) {
  return raw.split("|").map((s) => s.trim()).filter(Boolean).map((seg) => {
    let rest = seg;
    const latM = rest.match(/^\[(RE|LE|OU)\]\s*/);
    const lat = latM ? latM[1] : null;
    if (latM) rest = rest.slice(latM[0].length);
    const sinceM = rest.match(/^\[(\d+)\s+(days|weeks|months|years)\]\s*/);
    const since = sinceM ? `${sinceM[1]} ${sinceM[2]}` : null;
    if (sinceM) rest = rest.slice(sinceM[0].length);
    return { lat, since, text: rest.trim() };
  });
}

/* ── Transfer Button ────────────────────────────────────────────────────────── */
export function TransferButton({
  patientId,
  patientName,
  currentHospitalId,
  currentHospitalName,
  hospitals,
}: {
  patientId: string;
  patientName: string;
  currentHospitalId: string | null;
  currentHospitalName: string | null;
  hospitals: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [hospitalId, setHospitalId] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const options = hospitals.filter((h) => h.id !== currentHospitalId);

  const close = () => {
    setOpen(false);
    setHospitalId("");
    setReason("");
    setError(null);
    setDone(null);
  };

  const confirm = () => {
    setError(null);
    startTransition(async () => {
      const res = await transferPatient(patientId, hospitalId, reason.trim() || undefined);
      if (res?.error) {
        setError(res.error);
      } else {
        setDone(res?.toHospital ?? "");
        router.refresh();
      }
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] transition-colors"
      >
        <ArrowRightLeft size={13} />
        Transfer
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={(e) => { if (e.target === e.currentTarget && !pending) close(); }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-[var(--color-ink-900)]">
            {done !== null ? (
              <div className="text-center py-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                  <CheckCircle2 size={24} className="text-emerald-600" />
                </div>
                <h2 className="text-base font-bold text-[var(--color-ink-800)] mb-1">Transfer Complete</h2>
                <p className="text-sm text-[var(--color-ink-500)] mb-5">
                  <span className="font-semibold text-[var(--color-ink-800)]">{patientName}</span> is now registered at{" "}
                  <span className="font-semibold text-[var(--color-ink-800)]">{done}</span>. All records moved with the patient.
                </p>
                <button
                  onClick={close}
                  className="w-full py-2 rounded-xl bg-[var(--color-primary-600)] text-white text-sm font-semibold hover:bg-[var(--color-primary-700)] transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold text-[var(--color-ink-800)]">Transfer Patient</h2>
                  <button onClick={close} className="text-[var(--color-ink-400)] hover:text-[var(--color-ink-800)]">
                    <X size={18} />
                  </button>
                </div>
                <p className="text-sm text-[var(--color-ink-500)] mb-4">
                  Transferring <span className="font-semibold text-[var(--color-ink-800)]">{patientName}</span>
                  {currentHospitalName && (
                    <> from <span className="font-semibold text-[var(--color-ink-800)]">{currentHospitalName}</span></>
                  )}
                  . The patient and all records (visits, EMR, appointments) will be registered at the selected hospital.
                </p>
                <label className="block text-xs font-semibold text-[var(--color-ink-600)] mb-1">Destination Hospital</label>
                <select
                  value={hospitalId}
                  onChange={(e) => setHospitalId(e.target.value)}
                  className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm mb-3 outline-none focus:border-[var(--color-primary-500)] bg-white cursor-pointer"
                >
                  <option value="">Select a hospital…</option>
                  {options.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
                {options.length === 0 && (
                  <p className="text-xs text-[var(--color-ink-400)] -mt-1 mb-3">No other hospitals available.</p>
                )}
                <label className="block text-xs font-semibold text-[var(--color-ink-600)] mb-1">Reason for Transfer <span className="font-normal text-[var(--color-ink-400)]">(optional)</span></label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Briefly describe the reason..."
                  rows={3}
                  className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm mb-2 outline-none focus:border-[var(--color-primary-500)] resize-none"
                />
                {error && (
                  <p className="text-xs text-red-600 mb-2 flex items-center gap-1.5">
                    <AlertCircle size={12} className="shrink-0" /> {error}
                  </p>
                )}
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={close}
                    disabled={pending}
                    className="flex-1 py-2 rounded-xl border border-[var(--color-border)] text-sm font-semibold text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] disabled:opacity-40 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirm}
                    disabled={!hospitalId || pending}
                    className="flex-1 py-2 rounded-xl bg-[var(--color-primary-600)] text-white text-sm font-semibold hover:bg-[var(--color-primary-700)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {pending ? "Transferring…" : "Confirm Transfer"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* ── Types ──────────────────────────────────────────────────────────────────── */
export type SerialVisit = {
  id: string;
  date: string;
  visitType: string | null;
  status: "IN_PROGRESS" | "CLOSED";
  visitNumber: number;
  hospital: { name: string } | null;
  doctor: { name: string } | null;
  chiefComplaint: string | null;
  diagnoses: { description: string }[];
  hasEmrData: boolean;
};

export type TodayVisit = {
  id: string;
  appointmentId: string | null;
} | null;

export type TimelineEntry = {
  id: string;
  action: string;
  entityId: string;
  completedBy: string | null;
  completedAt: string;
};

export type LastVisitSummary = {
  id: string;
  date: string;
  visitType: string | null;
  hospitalName: string | null;
  doctorName: string | null;
  chiefComplaint: string | null;
  diagnoses: { id: string; description: string; icd10Code: string; laterality: string | null; status: string; provisional: boolean }[];
  medications: { id: string; drugName: string; dosage: string | null; frequency: string | null; duration: string | null; instructions: string | null }[];
  investigations: { id: string; category: string; testName: string; priority: string; laterality: string | null; status: string; notes: string | null; resultRef: string | null; createdAt: string }[];
};

/* ── Status badge ────────────────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: SerialVisit["status"] }) {
  return status === "CLOSED" ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
      <CheckCircle2 size={10} /> Completed
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
      <Clock size={10} /> In Progress
    </span>
  );
}

/* ── Visit card inside drawer ────────────────────────────────────────────────── */
function VisitCard({ visit, udid }: { visit: SerialVisit; udid: string }) {
  const diagText = visit.diagnoses.map((d) => d.description).filter(Boolean).join(", ");

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-white p-4 flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-[var(--color-primary-700)] bg-[var(--color-primary-50)] px-2 py-0.5 rounded-md">
              Visit #{visit.visitNumber}
            </span>
            <StatusBadge status={visit.status} />
            {visit.visitType && (
              <span className="text-[10px] text-[var(--color-ink-400)] font-medium">
                {visit.visitType}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-[var(--color-ink-800)] mt-1.5">
            {format(new Date(visit.date), "dd MMM yyyy")}
          </p>
        </div>
        {visit.hasEmrData ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <EmrViewerButton visitId={visit.id} visitNumber={visit.visitNumber} udid={udid} />
            <VisitDownloadButton visitId={visit.id} />
          </div>
        ) : (
          <span
            className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)] cursor-not-allowed"
            title="No EMR available for this visit"
          >
            <FileText size={12} /> No EMR
          </span>
        )}
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-[var(--color-ink-600)]">
        {visit.hospital && (
          <span className="flex items-center gap-1.5 col-span-2 sm:col-span-1">
            <Hospital size={11} className="shrink-0 text-[var(--color-ink-400)]" />
            {visit.hospital.name}
          </span>
        )}
        {visit.doctor && (
          <span className="flex items-center gap-1.5 col-span-2 sm:col-span-1">
            <Stethoscope size={11} className="shrink-0 text-[var(--color-ink-400)]" />
            Dr. {visit.doctor.name}
          </span>
        )}
      </div>

      {visit.chiefComplaint && (
        <p className="text-xs text-[var(--color-ink-500)] border-t border-[var(--color-border)] pt-2.5">
          <span className="font-medium text-[var(--color-ink-400)]">Complaint: </span>
          {visit.chiefComplaint}
        </p>
      )}

      {diagText && (
        <p className="text-xs text-[var(--color-ink-500)]">
          <span className="font-medium text-[var(--color-ink-400)]">Diagnosis: </span>
          {diagText}
        </p>
      )}
    </div>
  );
}

/* ── Previous Visits Inline Panel ───────────────────────────────────────────── */
function PreviousVisitsPanel({ visits, udid }: { visits: SerialVisit[]; udid: string }) {
  const hospitals = useMemo(() => {
    const names = [...new Set(visits.map((v) => v.hospital?.name).filter(Boolean) as string[])];
    return names.sort();
  }, [visits]);

  const [hospitalFilter, setHospitalFilter] = useState("ALL");

  const handleDownloadAll = () => {
    window.open(`/api/visit-summary-pdf/patient/${udid}`, "_blank");
  };

  const filtered = useMemo(() => {
    if (hospitalFilter === "ALL") return visits;
    return visits.filter((v) => v.hospital?.name === hospitalFilter);
  }, [visits, hospitalFilter]);

  return (
    <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--color-primary-800)] text-white">
        <p className="font-semibold text-sm">Previous Visits</p>
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/60">{visits.length} visit{visits.length !== 1 ? "s" : ""}</span>
          {visits.length > 0 && (
            <button
              onClick={handleDownloadAll}
              title="Print all visit summaries"
              className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 transition-colors"
            >
              <Download size={12} />
              Download All
            </button>
          )}
        </div>
      </div>

      {/* Hospital filter */}
      {hospitals.length > 1 && (
        <div className="px-4 py-2.5 bg-white border-b border-[var(--color-border)] flex items-center gap-2">
          <Filter size={12} className="text-[var(--color-ink-400)] shrink-0" />
          <select
            value={hospitalFilter}
            onChange={(e) => setHospitalFilter(e.target.value)}
            className="flex-1 text-sm text-[var(--color-ink-700)] bg-transparent outline-none cursor-pointer"
          >
            <option value="ALL">All Hospitals</option>
            {hospitals.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </div>
      )}

      {/* Cards */}
      <div className="p-4 flex flex-col gap-3">
        {filtered.length === 0 ? (
          <div className="text-center py-8">
            <AlertCircle size={28} className="mx-auto text-[var(--color-ink-300)] mb-2" />
            <p className="text-sm text-[var(--color-ink-400)]">No visits found.</p>
          </div>
        ) : (
          filtered.map((v) => <VisitCard key={v.id} visit={v} udid={udid} />)
        )}
      </div>
    </div>
  );
}

/* ── Last Visit Summary section ─────────────────────────────────────────────── */
function LastVisitSummarySection({ summary }: { summary: LastVisitSummary }) {
  const statusColor: Record<string, string> = {
    ACTIVE:   "bg-red-50 text-red-700",
    RESOLVED: "bg-emerald-50 text-emerald-700",
    CHRONIC:  "bg-amber-50 text-amber-700",
  };
  const invStatusColor: Record<string, string> = {
    ORDERED:   "bg-blue-50 text-blue-700",
    COMPLETED: "bg-emerald-50 text-emerald-700",
    PENDING:   "bg-amber-50 text-amber-700",
    CANCELLED: "bg-slate-100 text-slate-500",
  };
  const priorityColor: Record<string, string> = {
    URGENT:   "bg-red-100 text-red-700",
    STAT:     "bg-red-100 text-red-700",
    ROUTINE:  "bg-slate-100 text-slate-600",
  };

  return (
    <div className="mt-4 space-y-3">
      {/* ── Last Visit Summary ── */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-[var(--color-primary-600)]" />
            <p className="text-sm font-semibold text-[var(--color-ink-800)]">Last Visit Summary</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--color-ink-400)]">
            <span>{format(new Date(summary.date), "dd MMM yyyy")}</span>
            {summary.visitType && <span className="px-2 py-0.5 rounded-full bg-[var(--color-primary-50)] text-[var(--color-primary-600)] font-medium">{summary.visitType}</span>}
          </div>
        </div>

        <div className="px-4 py-3 space-y-3">
          {/* Meta */}
          <div className="flex gap-4 text-xs text-[var(--color-ink-500)] flex-wrap">
            {summary.hospitalName && <span className="flex items-center gap-1"><Hospital size={11} />{summary.hospitalName}</span>}
            {summary.doctorName && <span className="flex items-center gap-1"><Stethoscope size={11} />Dr. {summary.doctorName}</span>}
          </div>

          <VisitSummaryTabs
            bare
            visitId={summary.id}
            complaint={summary.chiefComplaint}
            diagnoses={summary.diagnoses.map((d) => d.description)}
            shortContent={
              <div className="space-y-3">
          {/* Chief Complaint */}
          {summary.chiefComplaint && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)] mb-1.5">Chief Complaint</p>
              <div className="space-y-1">
                {parseComplaints(summary.chiefComplaint).map((c, i) => (
                  <p key={i} className="text-sm text-[var(--color-ink-800)]">
                    {c.lat && (
                      <span className="inline-block font-bold text-[var(--color-primary-700)] mr-1.5">{c.lat}</span>
                    )}
                    {c.text}
                    {c.since && (
                      <span className="text-[var(--color-ink-400)] ml-1.5">· Since {c.since}</span>
                    )}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Diagnoses */}
          {summary.diagnoses.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)] mb-1.5">Diagnoses</p>
              <div className="flex flex-wrap gap-1.5">
                {summary.diagnoses.map((d) => (
                  <span key={d.id} className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${statusColor[d.status] ?? "bg-slate-100 text-slate-700"}`}>
                    {d.description}
                    {d.laterality && <span className="opacity-70">· {d.laterality}</span>}
                    {d.provisional && <span className="opacity-60 italic">(P)</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Medications */}
          {summary.medications.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)] mb-1.5">Medications</p>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="text-left py-1 pr-3 text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-wide w-[35%]">Drug</th>
                    <th className="text-left py-1 pr-3 text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-wide w-[12%]">Dose</th>
                    <th className="text-left py-1 pr-3 text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-wide w-[18%]">Frequency</th>
                    <th className="text-left py-1 pr-3 text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-wide w-[12%]">Duration</th>
                    <th className="text-left py-1 text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-wide">Instructions</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.medications.map((m, i) => (
                    <tr key={m.id} className={i % 2 === 0 ? "bg-transparent" : "bg-[var(--color-surface-2)]"}>
                      <td className="py-1.5 pr-3 font-semibold text-[var(--color-ink-700)] align-top">
                        <span className="flex items-center gap-1.5">
                          <Pill size={11} className="text-[var(--color-primary-400)] shrink-0" />
                          {m.drugName}
                        </span>
                      </td>
                      <td className="py-1.5 pr-3 text-[var(--color-ink-500)] align-top">{m.dosage ?? "—"}</td>
                      <td className="py-1.5 pr-3 text-[var(--color-ink-500)] align-top">{m.frequency ?? "—"}</td>
                      <td className="py-1.5 pr-3 text-[var(--color-ink-500)] align-top">{m.duration ?? "—"}</td>
                      <td className="py-1.5 text-[var(--color-ink-500)] align-top">{m.instructions ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!summary.chiefComplaint && summary.diagnoses.length === 0 && summary.medications.length === 0 && (
            <p className="text-xs italic text-[var(--color-ink-300)]">No clinical data recorded for this visit.</p>
          )}
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
}

/* ── Main export ─────────────────────────────────────────────────────────────── */
export function PatientProfileClient({
  udid,
  visits,
  todayVisit,
  todayAppointmentId,
  userRole,
  timelineEntries = [],
  lastVisitSummary = null,
}: {
  udid: string;
  visits: SerialVisit[];
  todayVisit: TodayVisit;
  todayAppointmentId?: string | null;
  userRole: string;
  timelineEntries?: TimelineEntry[];
  lastVisitSummary?: LastVisitSummary | null;
}) {
  const hasToday = todayVisit !== null;
  const hasPendingAppointment = !hasToday && !!todayAppointmentId;

  return (
    <>
      {/* ── Action buttons ───────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Previous Visits */}
        {visits.length === 0 ? (
          <button
            disabled
            className="flex-1 flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl font-semibold text-sm bg-[var(--color-primary-600)] text-white opacity-40 cursor-not-allowed shadow-sm"
          >
            <ChevronRight size={16} />
            Previous Visits
          </button>
        ) : (
          <Link
            href={`/patients/${udid}/visits`}
            className="flex-1 flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl font-semibold text-sm bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] transition-colors shadow-sm"
          >
            <ChevronRight size={16} />
            Previous Visits
            <span className="ml-1 bg-white/20 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
              {visits.length}
            </span>
          </Link>
        )}

        {/* Today's Visit */}
        {userRole === "DOCTOR" ? (
          hasToday ? (
            <Link
              href={`/emr/${udid}?visit=${todayVisit!.id}`}
              className="flex-1 flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl font-semibold text-sm bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <Stethoscope size={16} />
              Today's Visit
            </Link>
          ) : hasPendingAppointment ? (
            <Link
              href={`/emr/${udid}`}
              className="flex-1 flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl font-semibold text-sm bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <Stethoscope size={16} />
              Open EMR
            </Link>
          ) : (
            <button
              disabled
              className="flex-1 flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl font-semibold text-sm bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)] border border-[var(--color-border)] cursor-not-allowed"
            >
              <AlertCircle size={16} />
              No Appointment Today
            </button>
          )
        ) : null}
      </div>


      {/* ── Last Visit Summary + Investigations ─────────────────────── */}
      {lastVisitSummary && (
        <LastVisitSummarySection summary={lastVisitSummary} />
      )}
    </>
  );
}
