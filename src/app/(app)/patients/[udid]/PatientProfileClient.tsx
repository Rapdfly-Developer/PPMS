"use client";

import { useState, useMemo, useTransition } from "react";
import { format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { openPdfNative } from "@/lib/open-pdf";
import {
  ChevronRight, ChevronDown, Hospital, Stethoscope, FileText,
  CheckCircle2, Clock, AlertCircle, Filter, ClipboardCheck,
  ArrowRightLeft, X, Download, Loader2, RefreshCw,
  Activity, Sparkles,
} from "lucide-react";
import { EmrViewerButton, VisitDownloadButton } from "./EmrViewerModal";
import {
  VisitSummaryTabs, useVisitSummaryState, VisitSummaryTabBar, VisitSummaryTabBody,
  Block, DataTable, Cols, DASH,
  TH, TD, TD_MUTED, COLS_INVESTIGATION,
  AIContent,
} from "./VisitSummaryTabs";
import { transferPatient, generateLongitudinalSummary } from "../actions";
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
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold border border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] transition-colors"
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
                <h2 className="text-[15px] sm:text-base font-bold text-[var(--color-ink-800)] mb-1">Transfer Complete</h2>
                <p className="text-[13px] sm:text-sm text-[var(--color-ink-500)] mb-5">
                  <span className="font-semibold text-[var(--color-ink-800)]">{patientName}</span> is now registered at{" "}
                  <span className="font-semibold text-[var(--color-ink-800)]">{done}</span>. All records moved with the patient.
                </p>
                <button
                  onClick={close}
                  className="w-full py-2 rounded-xl bg-[var(--color-primary-600)] text-white text-[13px] sm:text-sm font-semibold hover:bg-[var(--color-primary-700)] transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[15px] sm:text-base font-bold text-[var(--color-ink-800)]">Transfer Patient</h2>
                  <button onClick={close} className="text-[var(--color-ink-400)] hover:text-[var(--color-ink-800)]">
                    <X size={18} />
                  </button>
                </div>
                <p className="text-[13px] sm:text-sm text-[var(--color-ink-500)] mb-4">
                  Transferring <span className="font-semibold text-[var(--color-ink-800)]">{patientName}</span>
                  {currentHospitalName && (
                    <> from <span className="font-semibold text-[var(--color-ink-800)]">{currentHospitalName}</span></>
                  )}
                  . The patient and all records (visits, EMR, appointments) will be registered at the selected hospital.
                </p>
                <label className="block text-[11px] sm:text-xs font-semibold text-[var(--color-ink-600)] mb-1">Destination Hospital</label>
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
                  <p className="text-[11px] sm:text-xs text-[var(--color-ink-400)] -mt-1 mb-3">No other hospitals available.</p>
                )}
                <label className="block text-[11px] sm:text-xs font-semibold text-[var(--color-ink-600)] mb-1">Reason for Transfer <span className="font-normal text-[var(--color-ink-400)]">(optional)</span></label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Briefly describe the reason..."
                  rows={3}
                  className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm mb-2 outline-none focus:border-[var(--color-primary-500)] resize-none"
                />
                {error && (
                  <p className="text-[11px] sm:text-xs text-red-600 mb-2 flex items-center gap-1.5">
                    <AlertCircle size={12} className="shrink-0" /> {error}
                  </p>
                )}
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={close}
                    disabled={pending}
                    className="flex-1 py-2 rounded-xl border border-[var(--color-border)] text-[13px] sm:text-sm font-semibold text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] disabled:opacity-40 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirm}
                    disabled={!hospitalId || pending}
                    className="flex-1 py-2 rounded-xl bg-[var(--color-primary-600)] text-white text-[13px] sm:text-sm font-semibold hover:bg-[var(--color-primary-700)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
  followUpDate: string | null;
};

export type LongitudinalVisit = {
  id: string;
  date: string;
  visitType: string | null;
  hospitalName: string | null;
  chiefComplaint: string | null;
  diagnoses: { description: string; status: string; laterality: string | null }[];
  medications: { drugName: string; dosage: string | null; frequency: string | null; duration: string | null }[];
  investigations: { testName: string; status: string }[];
  followUpDate: string | null;
};

/* ── Status badge ────────────────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: SerialVisit["status"] }) {
  return status === "CLOSED" ? (
    <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
      <CheckCircle2 size={10} /> Completed
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
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
            <span className="text-[11px] sm:text-xs font-bold text-[var(--color-primary-700)] bg-[var(--color-primary-50)] px-2 py-0.5 rounded-md">
              Visit #{visit.visitNumber}
            </span>
            <StatusBadge status={visit.status} />
            {visit.visitType && (
              <span className="text-[9px] sm:text-[10px] text-[var(--color-ink-400)] font-medium">
                {visit.visitType}
              </span>
            )}
          </div>
          <p className="text-[13px] sm:text-sm font-semibold text-[var(--color-ink-800)] mt-1.5">
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
            className="shrink-0 inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)] cursor-not-allowed"
            title="No EMR available for this visit"
          >
            <FileText size={12} /> No EMR
          </span>
        )}
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] sm:text-xs text-[var(--color-ink-600)]">
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
            <span key={i} className="clinical-complaint-chip inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10px] sm:text-[11px]">
              {[c.lat, c.text, c.since ? `· ${c.since}` : null].filter(Boolean).join(" ")}
            </span>
          ))}
        </div>
      )}

      {visit.diagnoses.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {visit.diagnoses.map((d, i) => (
            <span key={i} className="clinical-diagnosis-chip inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10px] sm:text-[11px]">
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
    void openPdfNative(`/api/visit-summary-pdf/patient/${udid}`);
  };

  const filtered = useMemo(() => {
    if (hospitalFilter === "ALL") return visits;
    return visits.filter((v) => v.hospital?.name === hospitalFilter);
  }, [visits, hospitalFilter]);

  return (
    <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--color-primary-800)] text-white">
        <p className="font-semibold text-[13px] sm:text-sm">Previous Visits</p>
        <div className="flex items-center gap-3">
          <span className="text-[11px] sm:text-xs text-white/60">{visits.length} visit{visits.length !== 1 ? "s" : ""}</span>
          {visits.length > 0 && (
            <button
              onClick={handleDownloadAll}
              title="Print all visit summaries"
              className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-medium px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 transition-colors"
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
            <p className="text-[13px] sm:text-sm text-[var(--color-ink-400)]">No visits found.</p>
          </div>
        ) : (
          filtered.map((v) => <VisitCard key={v.id} visit={v} udid={udid} />)
        )}
      </div>
    </div>
  );
}

/* ── Last Visit Summary section ─────────────────────────────────────────────── */
function LastVisitSummarySection({
  summary,
  longitudinalVisits = [],
  udid,
}: {
  summary: LastVisitSummary;
  longitudinalVisits?: LongitudinalVisit[];
  udid: string;
}) {
  const tabState = useVisitSummaryState(summary.id, { autoGenerateAI: false });
  const hasLongitudinal = longitudinalVisits.length > 0;
  const [aiSubTab, setAiSubTab] = useState<"single" | "longitudinal">("single");

  const customAiContent = (
    <div>
      {/* Sub-switch — only when longitudinal data exists */}
      {hasLongitudinal && (
        <div className="mb-3">
          <div className="inline-flex items-center gap-0.5 rounded-md bg-[var(--color-surface-sunken)] p-[2px]">
            {(["single", "longitudinal"] as const).map((st) => (
              <button
                key={st}
                onClick={() => setAiSubTab(st)}
                className={`relative flex items-center rounded px-2.5 py-1 text-[9px] sm:text-[10px] font-semibold transition-all ${
                  aiSubTab === st
                    ? "bg-white shadow-sm text-violet-700 shadow-violet-100"
                    : "text-[var(--color-ink-400)] hover:text-[var(--color-ink-600)]"
                }`}
              >
                {st === "single" ? "Last Visit" : "Longitudinal"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Last Visit AI — always mounted while AI tab is active; hidden when longitudinal is shown */}
      <div hidden={aiSubTab !== "single"} aria-hidden={aiSubTab !== "single"}>
        {tabState.aiError ? (
          <div className="space-y-2">
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 text-[10px] sm:text-[11px] text-red-700">
              <AlertCircle size={12} className="shrink-0 mt-0.5" />
              <span>{tabState.aiError}</span>
            </div>
            <button
              onClick={() => tabState.retryAI()}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
            >
              <RefreshCw size={11} /> Try Again
            </button>
          </div>
        ) : tabState.aiText ? (
          <AIContent text={tabState.aiText} error={null} source={tabState.aiSource} notice={tabState.aiNotice} />
        ) : (
          <button
            onClick={() => tabState.requestAI()}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-[var(--color-primary-50)] text-[var(--color-primary-700)] border border-[var(--color-primary-200)] hover:bg-[var(--color-primary-100)] disabled:opacity-60 transition-colors"
          >
            <Sparkles size={11} /> Generate AI Summary
          </button>
        )}
      </div>

      {/* Longitudinal — always mounted so generated state survives Last Visit ↔ Longitudinal switches */}
      {hasLongitudinal && (
        <div hidden={aiSubTab !== "longitudinal"} aria-hidden={aiSubTab !== "longitudinal"}>
          <LongitudinalSummarySection udid={udid} visits={longitudinalVisits} inline />
        </div>
      )}
    </div>
  );

  return (
    <div className="mt-4 space-y-3">
      {/* ── Last Visit Summary ── */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white overflow-hidden">
        <div className="px-4 py-2 border-b border-[var(--color-border)] flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <Activity size={13} className="text-[var(--color-primary-600)] shrink-0" />
            <span className="text-[11px] sm:text-xs font-semibold text-[var(--color-ink-800)]">Last Visit Summary</span>
            <span className="text-[var(--color-ink-300)] text-[9px] sm:text-[10px]">·</span>
            <span className="text-[9px] sm:text-[10px] text-[var(--color-ink-400)]">{format(new Date(summary.date), "dd MMM yyyy")}</span>
            <VisitSummaryTabBar
              tab={tabState.tab}
              switchTab={tabState.switchTab}
              loading={tabState.loading}
              compact
            />
          </div>
          {summary.hospitalName && (
            <span className="flex items-center gap-1 text-[10px] sm:text-[11px] text-[var(--color-ink-400)] shrink-0">
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
                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-medium bg-[var(--color-primary-50)] text-[var(--color-primary-600)]">{summary.visitType}</span>
                )}

                {summary.chiefComplaint && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-400)] shrink-0">Chief Complaint</span>
                    {parseComplaints(summary.chiefComplaint).map((c, i) => (
                      <span key={i} className="clinical-complaint-chip inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] sm:text-[11px]">
                        <FileText size={11} className="shrink-0 text-amber-500" />
                        {[c.lat, c.text, c.since ? `· ${c.since}` : null].filter(Boolean).join(" ")}
                      </span>
                    ))}
                  </div>
                )}

                {summary.diagnoses.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-400)] shrink-0">Diagnoses</span>
                    {[...summary.diagnoses]
                      .sort((a, b) => {
                        const ord: Record<string, number> = { ACTIVE: 0, CHRONIC: 1, RESOLVED: 2 };
                        return (ord[a.status] ?? 3) - (ord[b.status] ?? 3);
                      })
                      .map((d) => (
                        <span key={d.id} className="clinical-diagnosis-chip inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] border">
                          {d.laterality && <span className="clinical-laterality mr-1">{d.laterality}</span>}
                          {d.description}
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

                {summary.investigations.length > 0 && (
                  <Block label="Investigations">
                    <DataTable minWidth={420}>
                      <Cols widths={COLS_INVESTIGATION} />
                      <thead>
                        <tr>
                          <th className={TH}>Eye</th>
                          <th className={TH}>Test</th>
                          <th className={TH}>In View Of</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.investigations.map((inv) => (
                          <tr key={inv.id}>
                            <td className={TD_MUTED}>{inv.laterality || DASH}</td>
                            <td className={`${TD} font-semibold`}>{inv.testName}</td>
                            <td className={`${TD_MUTED} italic`}>{inv.notes || DASH}</td>
                          </tr>
                        ))}
                      </tbody>
                    </DataTable>
                  </Block>
                )}

                {summary.followUpDate && (
                  <Block label="Follow-up">
                    <p className="text-[10px] sm:text-[11px] font-semibold text-[var(--color-ink-800)]">
                      {format(new Date(summary.followUpDate), "EEEE, dd MMM yyyy")}
                    </p>
                  </Block>
                )}

                {!summary.chiefComplaint && summary.diagnoses.length === 0 && summary.medications.length === 0
                  && summary.investigations.length === 0 && !summary.followUpDate && (
                  <p className="text-[10px] sm:text-[11px] italic text-[var(--color-ink-300)]">
                    No clinical data recorded for this visit.
                  </p>
                )}
              </div>
            }
            aiContent={customAiContent}
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
  returnTo,
}: {
  visitId: string;
  udid: string;
  onClose: () => void;
  returnTo?: string;
}) {
  const router = useRouter();
  const rtSuffix = returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : "";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 p-1.5 rounded-lg text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] transition-colors"
        >
          <X size={16} />
        </button>
        <div className="px-6 py-5 flex flex-col items-center text-center gap-3">
          <div className="w-11 h-11 rounded-full bg-blue-50 flex items-center justify-center">
            <CheckCircle2 size={20} className="text-blue-500" />
          </div>
          <div>
            <p className="text-[15px] sm:text-base font-bold text-[var(--color-ink-900)]">Finalized &amp; Signed</p>
            <p className="text-[13px] sm:text-sm text-[var(--color-ink-500)] mt-1">
              You can only view. Do you wish to edit?
            </p>
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-5">
          <button
            onClick={() => { onClose(); router.push(`/emr/${udid}?visit=${visitId}${rtSuffix}`); }}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border border-[var(--color-border)] text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] transition-colors"
          >
            View Only
          </button>
          <button
            onClick={() => { onClose(); router.push(`/emr/${udid}?visit=${visitId}&edit=1${rtSuffix}`); }}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[var(--color-primary-900)] text-white hover:bg-[var(--color-primary-700)] transition-colors"
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Longitudinal Summary Section ───────────────────────────────────────────── */
function LongitudinalSummarySection({ udid, visits, inline = false }: { udid: string; visits: LongitudinalVisit[]; inline?: boolean }) {
  const [aiText,    setAiText]    = useState<string | null>(null);
  const [aiSource,  setAiSource]  = useState<"claude" | "local">("local");
  const [aiNotice,  setAiNotice]  = useState<string | null>(null);
  const [aiError,   setAiError]   = useState<string | null>(null);
  const [pending,   start]        = useTransition();

  if (visits.length === 0) return null;

  function handleGenerate() {
    setAiError(null);
    setAiText(null);
    setAiNotice(null);
    start(async () => {
      const res = await generateLongitudinalSummary(udid);
      if (res.error) { setAiError(res.error); return; }
      setAiText(res.text ?? null);
      setAiSource(res.source ?? "local");
      setAiNotice(res.notice ?? null);
    });
  }

  const firstDate = visits[visits.length - 1]?.date;
  const lastDate  = visits[0]?.date;

  /* ── Inline variant — used when embedded inside another card ── */
  if (inline) {
    return (
      <div className="space-y-3">
        {/* Generate / regenerate */}
        {!aiText && (
          <button
            onClick={handleGenerate}
            disabled={pending}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-[var(--color-primary-50)] text-[var(--color-primary-700)] border border-[var(--color-primary-200)] hover:bg-[var(--color-primary-100)] disabled:opacity-60 transition-colors"
          >
            {pending ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
            {pending ? "Generating…" : "Generate AI Summary"}
          </button>
        )}
        {/* AI error + retry */}
        {aiError && (
          <div className="space-y-2">
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 text-[10px] sm:text-[11px] text-red-700">
              <AlertCircle size={12} className="shrink-0 mt-0.5" />{aiError}
            </div>
            <button
              onClick={handleGenerate}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
            >
              <RefreshCw size={11} /> Try Again
            </button>
          </div>
        )}
        {/* AI text */}
        {aiText && (
          <div className="rounded-xl bg-violet-50/50 p-3.5">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5">
                <Sparkles size={11} className="text-violet-500" />
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-violet-600">
                  {aiSource === "claude" ? "Claude AI Summary" : "Auto-Generated Summary"}
                </span>
              </div>
              <button
                onClick={() => { setAiText(null); setAiNotice(null); }}
                className="p-1 rounded hover:bg-violet-100 text-violet-400 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
            {aiNotice && <p className="text-[9px] sm:text-[10px] leading-snug text-amber-700 mb-2">{aiNotice}</p>}
            <div className="space-y-1.5">
              {aiText.split(/\n+/).filter(Boolean).map((line, i) => (
                <p key={i} className="text-[10px] sm:text-[11px] leading-relaxed text-[var(--color-ink-700)]">{line}</p>
              ))}
            </div>
          </div>
        )}
        {/* Visit count + chronological list */}
        <div>
          <p className="text-[9px] sm:text-[10px] text-[var(--color-ink-400)] mb-2">
            {visits.length} visit{visits.length > 1 ? "s" : ""}
            {visits.length > 1 && firstDate && lastDate && (
              <> · {format(new Date(firstDate), "dd MMM yyyy")} – {format(new Date(lastDate), "dd MMM yyyy")}</>
            )}
          </p>
          <div className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)] overflow-hidden">
            {visits.map((v) => (
              <div key={v.id} className="px-3 py-2.5">
                <div className="flex items-start justify-between gap-2 mb-0.5">
                  <p className="text-[11px] font-semibold text-[var(--color-ink-800)]">
                    {format(new Date(v.date), "dd MMM yyyy")}
                  </p>
                  {v.followUpDate && (
                    <span className="text-[9px] font-medium text-[var(--color-primary-600)] bg-[var(--color-primary-50)] border border-[var(--color-primary-100)] px-1.5 py-0.5 rounded-full shrink-0">
                      F/U {format(new Date(v.followUpDate), "dd MMM")}
                    </span>
                  )}
                </div>
                {v.visitType && <p className="text-[9px] text-[var(--color-ink-400)]">{v.visitType}</p>}
                {v.diagnoses.length > 0 && (
                  <p className="clinical-diagnosis-text text-[10px] mt-0.5">
                    <span className="font-semibold">Dx:</span>{" "}
                    {v.diagnoses.map((d, i) => (
                      <span key={i}>{d.description}{d.laterality ? ` (${d.laterality})` : ""}{d.status === "RESOLVED" ? " ✓" : ""}{i < v.diagnoses.length - 1 ? ", " : ""}</span>
                    ))}
                  </p>
                )}
                {v.medications.length > 0 && (
                  <p className="text-[10px] text-[var(--color-ink-500)] mt-0.5">
                    <span className="font-semibold">Rx:</span>{" "}
                    {v.medications.map((m, i) => <span key={i}>{m.drugName}{i < v.medications.length - 1 ? ", " : ""}</span>)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-white overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Activity size={16} className="text-[var(--color-primary-600)] shrink-0" />
          <div>
            <p className="text-sm font-bold text-[var(--color-ink-900)]">Longitudinal Summary</p>
            <p className="text-[11px] text-[var(--color-ink-400)]">
              {visits.length} visit{visits.length > 1 ? "s" : ""}
              {firstDate && lastDate && visits.length > 1
                ? ` · ${format(new Date(firstDate), "dd MMM yyyy")} – ${format(new Date(lastDate), "dd MMM yyyy")}`
                : firstDate ? ` · ${format(new Date(firstDate), "dd MMM yyyy")}` : ""}
            </p>
          </div>
        </div>
        {!aiText && (
          <button
            onClick={handleGenerate}
            disabled={pending}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-[var(--color-primary-50)] text-[var(--color-primary-700)] border border-[var(--color-primary-200)] hover:bg-[var(--color-primary-100)] disabled:opacity-60 transition-colors shrink-0"
          >
            {pending ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
            {pending ? "Generating…" : "AI Summary"}
          </button>
        )}
      </div>

      {/* AI error + retry */}
      {aiError && (
        <div className="px-5 py-3 bg-red-50 border-b border-red-100">
          <div className="flex items-start gap-2 text-sm text-red-700 mb-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />{aiError}
          </div>
          <button
            onClick={handleGenerate}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
          >
            <RefreshCw size={11} /> Try Again
          </button>
        </div>
      )}

      {/* AI result */}
      {aiText && (
        <div className="px-5 py-4 bg-[var(--color-primary-50)] border-b border-[var(--color-primary-100)]">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-[11px] font-semibold text-[var(--color-primary-700)] uppercase tracking-wide">
              {aiSource === "claude" ? "AI-generated" : "Auto-generated"} Summary
            </p>
            <button
              onClick={() => { setAiText(null); setAiNotice(null); }}
              className="p-1 rounded hover:bg-[var(--color-primary-100)] text-[var(--color-primary-400)] transition-colors"
            >
              <X size={12} />
            </button>
          </div>
          {aiNotice && <p className="text-[11px] text-amber-600 mb-2">{aiNotice}</p>}
          <p className="text-[13px] text-[var(--color-ink-800)] leading-relaxed">{aiText}</p>
        </div>
      )}

      {/* Chronological visit timeline (newest first) */}
      <div className="divide-y divide-[var(--color-border)]">
        {visits.map((v) => (
          <div key={v.id} className="px-5 py-3.5">
            <div className="flex items-start justify-between gap-3 mb-1">
              <div>
                <p className="text-[13px] font-semibold text-[var(--color-ink-800)]">
                  {format(new Date(v.date), "dd MMM yyyy")}
                </p>
                <p className="text-[11px] text-[var(--color-ink-400)]">
                  {[v.visitType, v.hospitalName].filter(Boolean).join(" · ")}
                </p>
              </div>
              {v.followUpDate && (
                <span className="text-[10px] font-medium text-[var(--color-primary-600)] bg-[var(--color-primary-50)] border border-[var(--color-primary-100)] px-2 py-0.5 rounded-full shrink-0">
                  F/U {format(new Date(v.followUpDate), "dd MMM")}
                </span>
              )}
            </div>
            {v.chiefComplaint && (
              <p className="clinical-complaint-text text-[12px] mb-1">{v.chiefComplaint}</p>
            )}
            {v.diagnoses.length > 0 && (
              <p className="clinical-diagnosis-text text-[11px]">
                <span className="font-semibold">Dx:</span>{" "}
                {v.diagnoses.map((d, i) => (
                  <span key={i}>
                    {d.description}{d.laterality ? ` (${d.laterality})` : ""}
                    {d.status === "RESOLVED" ? " ✓" : ""}
                    {i < v.diagnoses.length - 1 ? ", " : ""}
                  </span>
                ))}
              </p>
            )}
            {v.medications.length > 0 && (
              <p className="text-[11px] text-[var(--color-ink-500)] mt-0.5">
                <span className="font-semibold">Rx:</span>{" "}
                {v.medications.map((m, i) => (
                  <span key={i}>{m.drugName}{i < v.medications.length - 1 ? ", " : ""}</span>
                ))}
              </p>
            )}
            {v.investigations.length > 0 && (
              <p className="text-[11px] text-[var(--color-ink-500)] mt-0.5">
                <span className="font-semibold">Inv:</span>{" "}
                {v.investigations.map((inv, i) => (
                  <span key={i}>{inv.testName}{i < v.investigations.length - 1 ? ", " : ""}</span>
                ))}
              </p>
            )}
          </div>
        ))}
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
  showTodayVisit = true,
  timelineEntries = [],
  lastVisitSummary = null,
  longitudinalVisits = [],
  profileReturnPath,
}: {
  udid: string;
  visits: SerialVisit[];
  todayVisit: TodayVisit;
  todayAppointmentId?: string | null;
  hasRequestedAppt?: boolean;
  userRole: string;
  showTodayVisit?: boolean;
  timelineEntries?: TimelineEntry[];
  lastVisitSummary?: LastVisitSummary | null;
  longitudinalVisits?: LongitudinalVisit[];
  profileReturnPath?: string;
}) {
  const hasToday = todayVisit !== null;
  const hasPendingAppointment = !hasToday && !!todayAppointmentId;
  const todayIsFinalized = hasToday && todayVisit!.status === "CLOSED";
  const [showFinalizedModal, setShowFinalizedModal] = useState(false);
  const emrReturnTo = profileReturnPath ?? `/patients/${udid}`;

  return (
    <>
      {showFinalizedModal && todayVisit && (
        <FinalizedVisitModal
          visitId={todayVisit.id}
          udid={udid}
          onClose={() => setShowFinalizedModal(false)}
          returnTo={emrReturnTo}
        />
      )}
      {/* ── Action buttons ───────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Previous Visits */}
        {visits.length === 0 ? (
          <button
            disabled
            className="flex-1 flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl font-semibold text-[13px] sm:text-sm bg-[var(--color-primary-600)] text-white opacity-40 cursor-not-allowed shadow-sm"
          >
            <ChevronRight size={16} />
            Previous Visits
          </button>
        ) : (
          <Link
            href={`/patients/${udid}/visits`}
            className="flex-1 flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl font-semibold text-[13px] sm:text-sm bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] transition-colors shadow-sm"
          >
            <ChevronRight size={16} />
            Previous Visits
            <span className="ml-1 bg-white/20 text-white text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full">
              {visits.length}
            </span>
          </Link>
        )}

        {/* Today's Visit — only shown when navigating from OPD Queue or Patient Library */}
        {showTodayVisit && userRole === "DOCTOR" ? (
          hasToday ? (
            todayIsFinalized ? (
              <button
                onClick={() => setShowFinalizedModal(true)}
                className="flex-1 flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl font-semibold text-[13px] sm:text-sm bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
              >
                <Stethoscope size={16} />
                Today's Visit
              </button>
            ) : (
              <Link
                href={`/emr/${udid}?visit=${todayVisit!.id}&returnTo=${encodeURIComponent(emrReturnTo)}`}
                className="flex-1 flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl font-semibold text-[13px] sm:text-sm bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
              >
                <Stethoscope size={16} />
                Today's Visit
              </Link>
            )
          ) : hasPendingAppointment ? (
            <Link
              href={`/emr/${udid}?returnTo=${encodeURIComponent(emrReturnTo)}`}
              className="flex-1 flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl font-semibold text-[13px] sm:text-sm bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <Stethoscope size={16} />
              Today&apos;s Visit
            </Link>
          ) : hasRequestedAppt ? (
            <button
              disabled
              className="flex-1 flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl font-semibold text-[13px] sm:text-sm bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)] border border-[var(--color-border)] cursor-not-allowed"
              title="Patient has an appointment today but has not been moved to the queue yet"
            >
              <Clock size={16} />
              Not in Queue Yet
            </button>
          ) : (
            <button
              disabled
              className="flex-1 flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl font-semibold text-[13px] sm:text-sm bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)] border border-[var(--color-border)] cursor-not-allowed"
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
          <span className="text-[10px] sm:text-[11px] text-[var(--color-ink-500)]">
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

      {/* ── Last Visit Summary (AI tab has Last Visit / Longitudinal sub-switch) ── */}
      {lastVisitSummary && (
        <LastVisitSummarySection
          summary={lastVisitSummary}
          longitudinalVisits={longitudinalVisits}
          udid={udid}
        />
      )}
    </>
  );
}
