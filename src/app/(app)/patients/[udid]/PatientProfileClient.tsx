"use client";

import { useState, useMemo, useTransition, useRef } from "react";
import { format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight, ChevronDown, Hospital, Stethoscope, FileText,
  CheckCircle2, Clock, AlertCircle, Filter, ClipboardCheck,
  ArrowRightLeft, X, Download, Loader2,
  Pill, FlaskConical, Activity, Microscope, Eye, Paperclip, Upload, Camera,
} from "lucide-react";
import { EmrViewerButton, VisitDownloadButton } from "./EmrViewerModal";
import { VisitSummaryTabs } from "./VisitSummaryTabs";
import { transferPatient } from "../actions";
import { attachResult } from "../../emr/[udid]/actions";
export { TimeStampButton } from "./PatientTimeline";

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

/* ── Result Lightbox ─────────────────────────────────────────────────────────── */
function ResultLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  const isImage = /\.(jpg|jpeg|png|webp)$/i.test(url);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <p className="text-sm font-semibold text-[var(--color-ink-800)]">Investigation Result</p>
          <div className="flex items-center gap-2">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              download
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] transition-colors flex items-center gap-1.5"
            >
              <Download size={12} /> Download
            </a>
            <button onClick={onClose} className="text-[var(--color-ink-400)] hover:text-[var(--color-ink-800)]">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="p-4">
          {isImage ? (
            <img src={url} alt="Result" className="max-h-[70vh] w-full object-contain rounded-xl" />
          ) : (
            <div className="flex flex-col items-center gap-3 py-8">
              <Paperclip size={32} className="text-[var(--color-ink-300)]" />
              <p className="text-sm text-[var(--color-ink-500)]">Non-image result — open in a new tab to view.</p>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-xl bg-[var(--color-primary-600)] text-white text-sm font-semibold hover:bg-[var(--color-primary-700)] transition-colors"
              >
                Open File
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Upload result button for investigation orders ───────────────────────────── */
function UploadResultButton({ orderId, udid }: { orderId: string; udid: string }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "Upload failed");
      startTransition(async () => {
        const result = await attachResult(orderId, udid, json.url);
        if (result?.error) setError(result.error);
      });
    } catch (err: any) {
      setError(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.docx" className="hidden" onChange={handleFile} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1 text-[11px] font-medium px-2 py-1.5 rounded-lg border border-dashed border-[var(--color-primary-400)] text-[var(--color-primary-600)] hover:bg-[var(--color-primary-50)] disabled:opacity-50 transition-colors"
        >
          {uploading ? <Upload size={12} className="animate-pulse" /> : <Upload size={12} />}
          {uploading ? "Uploading…" : "Add File"}
        </button>
        <button
          type="button"
          disabled={uploading}
          onClick={() => cameraRef.current?.click()}
          className="flex items-center gap-1 text-[11px] font-medium px-2 py-1.5 rounded-lg border border-dashed border-amber-400 text-amber-600 hover:bg-amber-50 disabled:opacity-50 transition-colors"
        >
          <Camera size={12} /> Camera
        </button>
      </div>
      {error && <p className="text-[10px] text-red-600">{error}</p>}
    </div>
  );
}

/* ── Last Visit Summary section ─────────────────────────────────────────────── */
function LastVisitSummarySection({ summary, udid }: { summary: LastVisitSummary; udid: string }) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
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
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)] mb-1">Chief Complaint</p>
              <p className="text-sm text-[var(--color-ink-800)]">{summary.chiefComplaint}</p>
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
              <div className="space-y-1.5">
                {summary.medications.map((m) => (
                  <div key={m.id} className="flex items-start gap-2">
                    <Pill size={12} className="text-[var(--color-primary-400)] mt-0.5 shrink-0" />
                    <div className="text-xs text-[var(--color-ink-700)]">
                      <span className="font-semibold">{m.drugName}</span>
                      {m.dosage && <span className="text-[var(--color-ink-400)]"> · {m.dosage}</span>}
                      {m.frequency && <span className="text-[var(--color-ink-400)]"> · {m.frequency}</span>}
                      {m.duration && <span className="text-[var(--color-ink-400)]"> · {m.duration}</span>}
                      {m.instructions && <span className="text-[var(--color-ink-400)]"> — {m.instructions}</span>}
                    </div>
                  </div>
                ))}
              </div>
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

      {/* ── Investigation Orders (timeline with date groups) ── */}
      {summary.investigations.length > 0 && (() => {
        /* group by calendar date */
        const groups: { date: string; label: string; items: typeof summary.investigations }[] = [];
        for (const inv of [...summary.investigations].reverse()) {
          const d = inv.createdAt.slice(0, 10);
          const existing = groups.find((g) => g.date === d);
          if (existing) existing.items.push(inv);
          else groups.push({ date: d, label: format(new Date(inv.createdAt), "dd MMM yyyy"), items: [inv] });
        }
        return (
          <div className="rounded-xl border border-[var(--color-border)] bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center gap-2">
              <Microscope size={14} className="text-[var(--color-primary-600)]" />
              <p className="text-sm font-semibold text-[var(--color-ink-800)]">Previous Investigation Orders</p>
              <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                {summary.investigations.length} pending
              </span>
            </div>
            <div className="px-4 py-4 space-y-4 max-h-[420px] overflow-y-auto">
              {groups.map((group) => (
                <div key={group.date}>
                  {/* date header */}
                  <p className="text-[11px] font-semibold text-[var(--color-ink-400)] mb-2">{group.label}</p>
                  <ul className="space-y-0">
                    {group.items.map((inv, idx) => {
                      const catKey = (inv.category ?? "").toLowerCase();
                      const palette =
                        catKey.includes("imag") ? { dot: "bg-violet-100", icon: "text-violet-600", badge: "bg-violet-100 text-violet-700" } :
                        catKey.includes("lab")  ? { dot: "bg-cyan-100",   icon: "text-cyan-600",   badge: "bg-cyan-100 text-cyan-700"   } :
                        catKey.includes("path") ? { dot: "bg-rose-100",   icon: "text-rose-600",   badge: "bg-rose-100 text-rose-700"   } :
                        catKey.includes("proc") ? { dot: "bg-amber-100",  icon: "text-amber-600",  badge: "bg-amber-100 text-amber-700" } :
                                                  { dot: "bg-teal-100",   icon: "text-teal-600",   badge: "bg-teal-100 text-teal-700"   };
                      const isLast = idx === group.items.length - 1;
                      return (
                        <li key={inv.id} className="flex gap-3">
                          {/* rail */}
                          <div className="flex flex-col items-center shrink-0">
                            <div className={`w-8 h-8 rounded-full ${palette.dot} flex items-center justify-center z-10`}>
                              <FlaskConical size={13} className={palette.icon} />
                            </div>
                            {!isLast && <div className="w-0.5 flex-1 my-1 bg-slate-100" />}
                          </div>
                          {/* card */}
                          <div className={`flex-1 min-w-0 bg-slate-50 rounded-xl border border-slate-100 px-3 py-2.5 flex items-center gap-3 hover:bg-white transition-colors ${isLast ? "mb-0" : "mb-2"}`}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${palette.badge}`}>
                                  {inv.category || "Test"}
                                </span>
                                <p className="text-sm font-semibold text-[var(--color-ink-800)]">{inv.testName}</p>
                              </div>
                              <p className="text-[11px] text-[var(--color-ink-400)] mt-0.5">
                                {[inv.laterality, inv.priority, inv.status.replace(/_/g, " ")].filter(Boolean).join(" · ")}
                                {inv.notes && <span className="italic"> · {inv.notes}</span>}
                              </p>
                            </div>
                            <p className="shrink-0 text-[10px] text-[var(--color-ink-400)]">
                              {format(new Date(inv.createdAt), "h:mm a")}
                            </p>
                            {inv.resultRef ? (
                              <button
                                onClick={() => setLightboxUrl(inv.resultRef)}
                                className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors"
                              >
                                <Eye size={12} /> View
                              </button>
                            ) : (
                              <UploadResultButton orderId={inv.id} udid={udid} />
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {lightboxUrl && <ResultLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
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
        <LastVisitSummarySection summary={lastVisitSummary} udid={udid} />
      )}
    </>
  );
}
