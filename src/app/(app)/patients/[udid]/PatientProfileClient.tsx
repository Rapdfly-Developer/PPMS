"use client";

import { useState, useMemo, useTransition } from "react";
import { format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight, ChevronDown, Hospital, Stethoscope, FileText,
  CheckCircle2, Clock, AlertCircle, Filter, ClipboardCheck,
  ArrowRightLeft, X, Download, Loader2,
  Activity, Scissors,
} from "lucide-react";
import { EmrViewerButton, VisitDownloadButton } from "./EmrViewerModal";
import {
  VisitSummaryTabs, useVisitSummaryState, VisitSummaryTabBar, VisitSummaryTabBody,
  Block, DataTable, Cols, DASH,
  TH, TD, TD_MUTED,
} from "./VisitSummaryTabs";
import { transferPatient } from "../actions";
import { convertNotesToCC } from "@/lib/appointment-cc";
export { TimeStampButton } from "./PatientTimeline";

/* ── Chief complaint parser (mirrors GeneralExamTab storage format) ──────────
   Stored as "[RE] [3 days] Redness | [LE] Watering". Appointment booking
   saves "RE | Since: 1 days | text" — convertNotesToCC normalises that first. */
function parseComplaints(raw: string) {
  return convertNotesToCC(raw).split("|").map((s) => s.trim()).filter(Boolean).map((seg) => {
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
  status: string;
  finalizedAt: string | null;
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
  medications: { id: string; drugName: string; dosage: string | null; frequency: string | null; duration: string | null; laterality: string | null }[];
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
        <div className="border-t border-[var(--color-border)] pt-2.5 flex flex-wrap gap-1">
          {parseComplaints(visit.chiefComplaint).map((c, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium">
              {[c.lat, c.text, c.since ? `· ${c.since}` : null].filter(Boolean).join(" ")}
            </span>
          ))}
        </div>
      )}

      {visit.diagnoses.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {visit.diagnoses.map((d, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-medium">
              {d.description}
            </span>
          ))}
        </div>
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
  const tabState = useVisitSummaryState(summary.id);
  return (
    <div className="mt-4 space-y-3">
      {/* ── Last Visit Summary ── */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white overflow-hidden">
        <div className="px-4 py-2 border-b border-[var(--color-border)] flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <Activity size={13} className="text-[var(--color-primary-600)] shrink-0" />
            <span className="text-xs font-semibold text-[var(--color-ink-800)]">Last Visit Summary</span>
            <span className="text-[var(--color-ink-300)] text-[10px]">·</span>
            <span className="text-[10px] text-[var(--color-ink-400)]">{format(new Date(summary.date), "dd MMM yyyy")}</span>
            <VisitSummaryTabBar
              tab={tabState.tab}
              switchTab={tabState.switchTab}
              loading={tabState.loading}
              compact
            />
          </div>
          {summary.hospitalName && (
            <span className="flex items-center gap-1 text-[11px] text-[var(--color-ink-400)] shrink-0">
              <Hospital size={11} />{summary.hospitalName}
            </span>
          )}
        </div>

        <div className="px-4 py-3 space-y-3">

          <VisitSummaryTabBody
            tab={tabState.tab}
            loading={tabState.loading}
            emrData={tabState.emrData}
            aiText={tabState.aiText}
            aiSource={tabState.aiSource}
            aiNotice={tabState.aiNotice}
            aiError={tabState.aiError}
            complaint={summary.chiefComplaint}
            diagnoses={summary.diagnoses.map((d) => d.description)}
            shortContent={
              <div className="space-y-4">
                {/* Same table grammar as the Long tab — shared column templates
                    and cell classes, so switching tabs does not shift the
                    columns around under the reader. */}
                {summary.visitType && (
                  <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-primary-50)] text-[var(--color-primary-600)]">{summary.visitType}</span>
                )}

                {summary.chiefComplaint && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-400)] shrink-0">Chief Complaint</span>
                    {parseComplaints(summary.chiefComplaint).map((c, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium">
                        <FileText size={11} className="shrink-0 text-amber-500" />
                        {[c.lat, c.text, c.since ? `· ${c.since}` : null].filter(Boolean).join(" ")}
                      </span>
                    ))}
                  </div>
                )}

                {summary.diagnoses.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-400)] shrink-0">Diagnoses</span>
                    {[...summary.diagnoses]
                      .sort((a, b) => {
                        const ord: Record<string, number> = { ACTIVE: 0, CHRONIC: 1, RESOLVED: 2 };
                        return (ord[a.status] ?? 3) - (ord[b.status] ?? 3);
                      })
                      .map((d) => (
                        <span key={d.id} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border ${
                          d.status === "RESOLVED" ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                          : d.status === "CHRONIC" ? "bg-amber-50 border-amber-200 text-amber-800"
                          : "bg-red-50 border-red-200 text-red-800"
                        }`}>
                          <span className="font-bold text-[9px] uppercase opacity-70">{d.status}</span>
                          {d.laterality && <span className="font-bold">· {d.laterality}</span>}
                          · {d.description}
                          {d.provisional && <span className="italic opacity-70">(P)</span>}
                        </span>
                      ))}
                  </div>
                )}

                {summary.medications.length > 0 && (
                  <Block label="Medications">
                    <DataTable minWidth={360}>
                      <Cols widths={["6%", "38%", "18%", "20%", "18%"]} />
                      <thead>
                        <tr>
                          <th className={TH}>#</th>
                          <th className={TH}>Drug</th>
                          <th className={TH}>Dose</th>
                          <th className={TH}>Frequency</th>
                          <th className={TH}>Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.medications.map((m, idx) => (
                          <tr key={m.id}>
                            <td className={TD_MUTED}>{idx + 1}</td>
                            <td className={`${TD} font-semibold`}>
                              {m.laterality && (
                                <span className="font-bold text-[var(--color-primary-700)] mr-2">{m.laterality}</span>
                              )}
                              {m.drugName}
                            </td>
                            <td className={TD_MUTED}>{m.dosage || DASH}</td>
                            <td className={TD_MUTED}>{m.frequency || DASH}</td>
                            <td className={TD_MUTED}>{m.duration || DASH}</td>
                          </tr>
                        ))}
                      </tbody>
                    </DataTable>
                  </Block>
                )}

                {!summary.chiefComplaint && summary.diagnoses.length === 0 && summary.medications.length === 0 && (
                  <p className="text-[11px] italic text-[var(--color-ink-300)]">
                    No clinical data recorded for this visit.
                  </p>
                )}
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
}

/* ── Finalized visit confirmation modal ──────────────────────────────────────── */
function FinalizedVisitModal({
  visitId,
  udid,
  onClose,
}: {
  visitId: string;
  udid: string;
  onClose: () => void;
}) {
  const router = useRouter();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="px-6 py-5 flex flex-col items-center text-center gap-3">
          <div className="w-11 h-11 rounded-full bg-blue-50 flex items-center justify-center">
            <CheckCircle2 size={20} className="text-blue-500" />
          </div>
          <div>
            <p className="text-base font-bold text-[var(--color-ink-900)]">Finalized &amp; Signed</p>
            <p className="text-sm text-[var(--color-ink-500)] mt-1">
              You can only view. Do you wish to edit?
            </p>
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-5">
          <button
            onClick={() => { onClose(); router.push(`/emr/${udid}?visit=${visitId}`); }}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border border-[var(--color-border)] text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] transition-colors"
          >
            View Only
          </button>
          <button
            onClick={() => { onClose(); router.push(`/emr/${udid}?visit=${visitId}&edit=1`); }}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[var(--color-primary-900)] text-white hover:bg-[var(--color-primary-700)] transition-colors"
          >
            Edit
          </button>
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
  hasRequestedAppt = false,
  userRole,
  timelineEntries = [],
  lastVisitSummary = null,
  surgeryAdvisedVisitId = null,
  surgeryAdvisedName = null,
  surgeryAdvisedEye = null,
  surgeryAdvisedNotes = null,
  surgeryAdvisedDate = null,
  counsellingStatus = null,
}: {
  udid: string;
  visits: SerialVisit[];
  todayVisit: TodayVisit;
  todayAppointmentId?: string | null;
  hasRequestedAppt?: boolean;
  userRole: string;
  timelineEntries?: TimelineEntry[];
  lastVisitSummary?: LastVisitSummary | null;
  surgeryAdvisedVisitId?: string | null;
  surgeryAdvisedName?: string | null;
  surgeryAdvisedEye?: string | null;
  surgeryAdvisedNotes?: string | null;
  surgeryAdvisedDate?: string | null;
  counsellingStatus?: string | null;
}) {
  const hasToday = todayVisit !== null;
  const hasPendingAppointment = !hasToday && !!todayAppointmentId;
  const todayIsFinalized = hasToday && todayVisit!.status === "CLOSED";
  const [showFinalizedModal, setShowFinalizedModal] = useState(false);

  return (
    <>
      {showFinalizedModal && todayVisit && (
        <FinalizedVisitModal
          visitId={todayVisit.id}
          udid={udid}
          onClose={() => setShowFinalizedModal(false)}
        />
      )}
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
            todayIsFinalized ? (
              <button
                onClick={() => setShowFinalizedModal(true)}
                className="flex-1 flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl font-semibold text-sm bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
              >
                <Stethoscope size={16} />
                Today's Visit
              </button>
            ) : (
              <Link
                href={`/emr/${udid}?visit=${todayVisit!.id}`}
                className="flex-1 flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl font-semibold text-sm bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
              >
                <Stethoscope size={16} />
                Today's Visit
              </Link>
            )
          ) : hasPendingAppointment ? (
            <Link
              href={`/emr/${udid}`}
              className="flex-1 flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl font-semibold text-sm bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <Stethoscope size={16} />
              Today&apos;s Visit
            </Link>
          ) : hasRequestedAppt ? (
            <button
              disabled
              className="flex-1 flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl font-semibold text-sm bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)] border border-[var(--color-border)] cursor-not-allowed"
              title="Patient has an appointment today but has not been moved to the queue yet"
            >
              <Clock size={16} />
              Not in Queue Yet
            </button>
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

      {/* Finalize time badge */}
      {todayIsFinalized && todayVisit?.finalizedAt && (
        <div className="flex items-center gap-1.5 mt-2">
          <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
          <span className="text-[11px] text-[var(--color-ink-500)]">
            Finalized at{" "}
            <span className="font-semibold text-emerald-600">
              {new Date(todayVisit.finalizedAt).toLocaleTimeString("en-IN", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
                timeZone: "Asia/Kolkata",
              })}
            </span>
          </span>
        </div>
      )}

      {/* ── Surgical Counselling card ─────────────────────────────────── */}
      {surgeryAdvisedVisitId && (
        <Link
          href={`/counseling/${udid}`}
          className="block mt-4 rounded-xl border border-teal-300 bg-teal-50 overflow-hidden hover:border-teal-400 hover:bg-teal-100/60 transition-colors group"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-teal-100 border-b border-teal-200">
            <div className="flex items-center gap-2">
              <Scissors size={15} className="text-teal-700" />
              <p className="text-sm font-semibold text-teal-900">Surgical Counselling</p>
            </div>
            <div className="flex items-center gap-2">
              {counsellingStatus && counsellingStatus !== "DRAFT" && (
                <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  counsellingStatus === "CONFIRMED"             ? "bg-teal-100 text-teal-700 border-teal-200" :
                  counsellingStatus === "FIT_FOR_SURGERY"       ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                  counsellingStatus === "NOT_FIT"               ? "bg-red-100 text-red-700 border-red-200" :
                  counsellingStatus === "DEFERRED"              ? "bg-orange-100 text-orange-700 border-orange-200" :
                  counsellingStatus === "INVESTIGATIONS_REQUIRED" ? "bg-blue-100 text-blue-700 border-blue-200" :
                  "bg-teal-200 text-teal-800 border-teal-300"
                }`}>
                  {counsellingStatus === "TENTATIVE_COMPLETED"     ? "Tentative Submitted" :
                   counsellingStatus === "FIT_FOR_SURGERY"         ? "Fit for Surgery" :
                   counsellingStatus === "NOT_FIT"                 ? "Not Fit" :
                   counsellingStatus === "DEFERRED"                ? "Deferred" :
                   counsellingStatus === "INVESTIGATIONS_REQUIRED" ? "Investigations" :
                   counsellingStatus === "CONFIRMED"               ? "Confirmed" : counsellingStatus}
                </span>
              )}
              <ChevronRight size={14} className="text-teal-500 group-hover:text-teal-700 transition-colors" />
            </div>
          </div>

          {/* Details */}
          <div className="px-4 py-3 flex flex-col gap-2.5">
            {surgeryAdvisedDate && (
              <p className="text-[10px] font-semibold text-teal-600 uppercase tracking-widest">
                Counselled on {format(new Date(surgeryAdvisedDate), "dd MMM yyyy")}
              </p>
            )}

            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {surgeryAdvisedName && (
                <div>
                  <p className="text-[10px] font-bold text-teal-700 uppercase tracking-wide mb-0.5">Procedure</p>
                  <p className="text-sm font-medium text-teal-900">{surgeryAdvisedName}</p>
                </div>
              )}
              {surgeryAdvisedEye && (
                <div>
                  <p className="text-[10px] font-bold text-teal-700 uppercase tracking-wide mb-0.5">Eye</p>
                  <p className="text-sm font-semibold text-teal-900">{surgeryAdvisedEye}</p>
                </div>
              )}
            </div>

            {surgeryAdvisedNotes && (
              <div>
                <p className="text-[10px] font-bold text-teal-700 uppercase tracking-wide mb-0.5">Counselling Notes</p>
                <p className="text-sm text-teal-800 whitespace-pre-line">{surgeryAdvisedNotes}</p>
              </div>
            )}

            {!surgeryAdvisedName && !surgeryAdvisedEye && !surgeryAdvisedNotes && (
              <p className="text-xs text-teal-700 italic">Surgery advised — no details recorded yet.</p>
            )}
          </div>
        </Link>
      )}

      {/* ── Last Visit Summary + Investigations ─────────────────────── */}
      {lastVisitSummary && (
        <LastVisitSummarySection summary={lastVisitSummary} />
      )}
    </>
  );
}
