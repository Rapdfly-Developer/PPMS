"use client";

import { useState, useTransition, useRef } from "react";
import {
  Upload, FileImage, FileText, CheckCircle2, XCircle,
  Pencil, Loader2, FileScan, CloudUpload, X,
} from "lucide-react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";

type Patient = { id: string; name: string; udid: string };
type Visit = {
  id: string;
  patientId: string;
  patient: { name: string; udid: string };
  sourceDate: Date | string | null;
  sourceHospital: string | null;
  extractedDiagnosis: string | null;
  extractedTreatment: string | null;
  scanFileRef: string | null;
  verificationStatus: string;
  createdAt: Date | string;
};

const STATUS_CLS: Record<string, string> = {
  PENDING_REVIEW: "bg-amber-100 text-amber-700",
  VERIFIED:       "bg-green-100 text-green-700",
  REJECTED:       "bg-red-100 text-red-700",
};

export function PastVisitsClient({
  patients,
  visits: initialVisits,
  canVerify,
}: {
  patients: Patient[];
  visits: Visit[];
  canVerify: boolean;
}) {
  const router = useRouter();
  const [visits, setVisits] = useState(initialVisits);

  // ── Upload form state ──────────────────────────────────────────────────────
  const [showForm, setShowForm]     = useState(false);
  const [patientId, setPatientId]   = useState("");
  const [file, setFile]             = useState<File | null>(null);
  const [preview, setPreview]       = useState<string | null>(null);
  const [dragging, setDragging]     = useState(false);
  const [sourceDate, setSourceDate] = useState("");
  const [sourceHosp, setSourceHosp] = useState("");
  const [diagnosis, setDiagnosis]   = useState("");
  const [treatment, setTreatment]   = useState("");
  const [uploading, setUploading]   = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickFile = (f: File) => {
    setFile(f);
    setError(null);
    if (f.type.startsWith("image/")) {
      setPreview(URL.createObjectURL(f));
    } else {
      setPreview(null); // PDF — show icon only
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) pickFile(f);
  };

  const handleSubmit = async () => {
    if (!patientId) { setError("Please select a patient."); return; }
    if (!file)      { setError("Please choose a file to upload."); return; }

    setUploading(true);
    setError(null);

    try {
      // 1. Upload file
      const fd = new FormData();
      fd.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadJson.error ?? "Upload failed.");

      // 2. Create PastExternalVisit record via server action
      const { createPastVisit } = await import("./actions");
      await createPastVisit({
        patientId,
        savedName: uploadJson.savedName,
        originalFileName: uploadJson.originalFileName,
        sourceDate: sourceDate || null,
        sourceHospital: sourceHosp || null,
        extractedDiagnosis: diagnosis || null,
        extractedTreatment: treatment || null,
      });

      // 3. Reset form and refresh
      setShowForm(false);
      setFile(null); setPreview(null); setPatientId("");
      setSourceDate(""); setSourceHosp(""); setDiagnosis(""); setTreatment("");
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 fade-in">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-ink-900)] tracking-tight">
            Past External Visits
          </h1>
          <p className="text-sm text-[var(--color-ink-400)] mt-0.5">
            Upload and manage previous medical documents — images or PDFs
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary-600)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-700)] transition-colors shadow-sm"
        >
          <CloudUpload size={16} />
          Add Document
        </button>
      </div>

      {/* ── Upload form ───────────────────────────────────────────────────── */}
      {showForm && (
        <div className="surface-card p-6 space-y-5">
          <h2 className="text-base font-semibold text-[var(--color-ink-900)]">Upload Previous Document</h2>

          {/* Patient selector */}
          <div>
            <label className="text-sm font-medium text-[var(--color-ink-700)]">Patient *</label>
            <select
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
            >
              <option value="">— Select patient —</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.udid}
                </option>
              ))}
            </select>
          </div>

          {/* Drop zone */}
          <div>
            <label className="text-sm font-medium text-[var(--color-ink-700)]">Document (image or PDF) *</label>
            {file ? (
              <div className="mt-1.5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] overflow-hidden">
                {preview ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview} alt="preview" className="w-full max-h-64 object-contain bg-white" />
                    <button
                      onClick={clearFile}
                      className="absolute top-2 right-2 bg-white rounded-full p-1 shadow hover:bg-red-50 text-red-500"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between px-4 py-4">
                    <div className="flex items-center gap-3">
                      <FileText size={28} className="text-[var(--color-primary-600)]" />
                      <div>
                        <p className="text-sm font-medium text-[var(--color-ink-800)]">{file.name}</p>
                        <p className="text-xs text-[var(--color-ink-400)]">
                          {(file.size / 1024).toFixed(0)} KB · PDF
                        </p>
                      </div>
                    </div>
                    <button onClick={clearFile} className="p-1.5 text-[var(--color-ink-400)] hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <label
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={`mt-1.5 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed py-12 cursor-pointer transition-colors ${
                  dragging
                    ? "border-[var(--color-primary-500)] bg-[var(--color-primary-50)]"
                    : "border-[var(--color-border)] hover:border-[var(--color-primary-400)] hover:bg-[var(--color-primary-50)]"
                }`}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && pickFile(e.target.files[0])}
                />
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-[var(--color-primary-100)] p-3 text-[var(--color-primary-600)]">
                    <FileImage size={22} />
                  </div>
                  <div className="rounded-xl bg-[var(--color-primary-100)] p-3 text-[var(--color-primary-600)]">
                    <FileText size={22} />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-[var(--color-ink-700)]">
                    Drag &amp; drop or <span className="text-[var(--color-primary-600)]">browse</span>
                  </p>
                  <p className="text-xs text-[var(--color-ink-400)] mt-0.5">
                    PNG · JPEG · WebP · PDF — max 20 MB
                  </p>
                </div>
              </label>
            )}
          </div>

          {/* Optional metadata */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-[var(--color-ink-700)]">Date of Visit</label>
              <input
                type="date"
                value={sourceDate}
                onChange={(e) => setSourceDate(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--color-ink-700)]">Previous Hospital / Clinic</label>
              <input
                type="text"
                value={sourceHosp}
                onChange={(e) => setSourceHosp(e.target.value)}
                placeholder="e.g. City Eye Hospital"
                className="mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--color-ink-700)]">Diagnosis</label>
              <input
                type="text"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="e.g. Cataract — Bilateral"
                className="mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--color-ink-700)]">Treatment / Medications</label>
              <input
                type="text"
                value={treatment}
                onChange={(e) => setTreatment(e.target.value)}
                placeholder="e.g. Timolol 0.5% eye drops"
                className="mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-[var(--color-danger-600)] bg-[var(--color-danger-100)] rounded-xl px-4 py-2.5">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={handleSubmit}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary-600)] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-700)] transition-colors disabled:opacity-60"
            >
              {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              {uploading ? "Uploading..." : "Save Document"}
            </button>
            <button
              onClick={() => { setShowForm(false); clearFile(); setError(null); }}
              className="rounded-xl border border-[var(--color-border)] px-5 py-2.5 text-sm font-medium text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Documents list ────────────────────────────────────────────────── */}
      {initialVisits.length === 0 && !showForm ? (
        <div className="surface-card py-16 flex flex-col items-center gap-3 text-[var(--color-ink-400)]">
          <FileScan size={36} className="opacity-25" />
          <p className="text-sm font-medium">No documents uploaded yet</p>
          <p className="text-xs">Click "Add Document" to upload a previous medical record</p>
        </div>
      ) : (
        <div className="space-y-3">
          {initialVisits.map((v) => (
            <VisitCard key={v.id} visit={v} canVerify={canVerify} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Single document card ──────────────────────────────────────────────────────

function VisitCard({ visit, canVerify }: { visit: Visit; canVerify: boolean }) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [hosp, setHosp] = useState(visit.sourceHospital ?? "");
  const [diag, setDiag] = useState(visit.extractedDiagnosis ?? "");
  const [treat, setTreat] = useState(visit.extractedTreatment ?? "");
  const router = useRouter();

  const isPDF = visit.scanFileRef?.endsWith(".pdf");
  const isPending = visit.verificationStatus === "PENDING_REVIEW";

  const act = (fn: () => Promise<void>) =>
    startTransition(async () => { await fn(); router.refresh(); });

  const doVerify = (status: "VERIFIED" | "REJECTED", corrected?: Record<string, string>) => {
    act(async () => {
      const { updatePastVisit } = await import("./actions");
      await updatePastVisit(visit.id, status, corrected);
    });
  };

  return (
    <div className="surface-card p-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        {/* Left: icon + info */}
        <div className="flex items-start gap-4 min-w-0 flex-1">
          <div className="shrink-0 rounded-xl bg-[var(--color-primary-50)] p-3 text-[var(--color-primary-600)]">
            {isPDF ? <FileText size={22} /> : <FileImage size={22} />}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <p className="font-semibold text-[var(--color-ink-900)] text-sm">{visit.patient.name}</p>
              <span className="text-xs font-mono text-[var(--color-ink-400)]">{visit.patient.udid}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_CLS[visit.verificationStatus]}`}>
                {visit.verificationStatus.replace(/_/g, " ")}
              </span>
            </div>

            {editing ? (
              <div className="flex flex-col gap-2 mt-2">
                <input value={hosp} onChange={(e) => setHosp(e.target.value)} placeholder="Hospital / clinic" className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm w-full" />
                <input value={diag} onChange={(e) => setDiag(e.target.value)} placeholder="Diagnosis" className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm w-full" />
                <input value={treat} onChange={(e) => setTreat(e.target.value)} placeholder="Treatment / medications" className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm w-full" />
                <div className="flex gap-2 mt-1">
                  <button disabled={pending} onClick={() => { doVerify("VERIFIED", { sourceHospital: hosp, extractedDiagnosis: diag, extractedTreatment: treat }); setEditing(false); }} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-100 text-green-700 hover:opacity-80">
                    <CheckCircle2 size={13} /> Save & Verify
                  </button>
                  <button onClick={() => setEditing(false)} className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-ink-600)]">Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-xs text-[var(--color-ink-500)]">
                  {visit.sourceDate ? format(new Date(visit.sourceDate), "d MMM yyyy") : "Date not set"}
                  {visit.sourceHospital ? ` · ${visit.sourceHospital}` : ""}
                </p>
                {visit.extractedDiagnosis && (
                  <p className="text-sm text-[var(--color-ink-700)] mt-1">{visit.extractedDiagnosis}</p>
                )}
                {visit.extractedTreatment && (
                  <p className="text-xs text-[var(--color-ink-500)] mt-0.5">{visit.extractedTreatment}</p>
                )}
                <p className="text-[11px] font-mono text-[var(--color-ink-300)] mt-1">{visit.scanFileRef}</p>
              </>
            )}
          </div>
        </div>

        {/* Right: uploaded date */}
        <p className="text-xs text-[var(--color-ink-400)] shrink-0">
          {format(new Date(visit.createdAt), "d MMM yyyy")}
        </p>
      </div>

      {/* Actions (Doctor only, pending only) */}
      {canVerify && isPending && !editing && (
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[var(--color-border)]">
          <button disabled={pending} onClick={() => doVerify("VERIFIED")} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-100 text-green-700 hover:opacity-80">
            <CheckCircle2 size={13} /> Verify
          </button>
          <button disabled={pending} onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 hover:opacity-80">
            <Pencil size={13} /> Edit & Verify
          </button>
          <button disabled={pending} onClick={() => doVerify("REJECTED")} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:opacity-80">
            <XCircle size={13} /> Reject
          </button>
        </div>
      )}
    </div>
  );
}
