"use client";

import { useState, useTransition, useRef } from "react";
import { Card } from "@/components/ui/Card";
import { format } from "date-fns";
import { FileScan, CheckCircle2, XCircle, Upload, Camera, Pencil, Loader2, FileText, ZoomIn, X, Images, FolderOpen } from "lucide-react";
import { addPastExternalVisit, verifyPastExternalVisit } from "./actions";

export function PastExternalVisitsTab({
  patientId,
  udid,
  entries,
  canEdit,
  canUpload,
}: {
  patientId: string;
  udid: string;
  entries: any[];
  canEdit: boolean;
  canUpload: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showSheet, setShowSheet] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      // 1. Store file permanently — get a public URL for preview
      const uploadFd = new FormData();
      uploadFd.append("file", file);
      const uploadRes = await fetch("/api/uploads", { method: "POST", body: uploadFd });
      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadJson.error ?? "File upload failed.");
      const scanFileUrl: string = uploadJson.url;

      // 2. Run OCR (images only; skip PDF)
      let ocrFields: Record<string, any> = { originalFileName: file.name };
      if (file.type !== "application/pdf") {
        const ocrFd = new FormData();
        ocrFd.append("file", file);
        const ocrRes = await fetch("/api/ocr", { method: "POST", body: ocrFd });
        if (ocrRes.ok) ocrFields = { ...ocrFields, ...(await ocrRes.json()) };
      }

      await addPastExternalVisit(patientId, udid, {
        originalFileName: file.name,
        scanFileUrl,
        sourceDate: ocrFields.sourceDate,
        sourceHospital: ocrFields.sourceHospital,
        extractedDiagnosis: ocrFields.extractedDiagnosis,
        extractedTreatment: ocrFields.extractedTreatment,
        rawText: ocrFields.rawText,
      });
    } catch (err: any) {
      setUploadError(err.message ?? "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {canUpload && (
        <Card>
          {/* Drop-zone trigger */}
          <button
            type="button"
            disabled={uploading}
            onClick={() => setShowSheet(true)}
            className="w-full flex flex-col items-center justify-center gap-3 border-2 border-dashed border-[var(--color-border)] rounded-2xl py-8 transition-colors hover:border-[var(--color-primary-400)] hover:bg-[var(--color-primary-50)] disabled:opacity-50"
          >
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: "var(--color-primary-50)", border: "1.5px solid var(--color-primary-100)" }}>
              {uploading
                ? <Loader2 className="text-[var(--color-primary-600)] animate-spin" size={26} />
                : <Upload className="text-[var(--color-primary-600)]" size={26} />}
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-[var(--color-ink-700)]">
                {uploading ? "Processing…" : "Upload Files"}
              </p>
              <p className="text-xs text-[var(--color-ink-400)] mt-0.5">Image or PDF · Required</p>
            </div>
          </button>

          {/* Hidden inputs */}
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); e.target.value = ""; }} />
          <input ref={galleryInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); e.target.value = ""; }} />
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); e.target.value = ""; }} />

          {uploading && (
            <p className="text-xs text-[var(--color-primary-600)] mt-3 text-center animate-pulse">
              Uploading and running OCR extraction…
            </p>
          )}
          {uploadError && (
            <p className="text-sm text-[var(--color-danger-600)] bg-[var(--color-danger-100)] rounded-lg px-3 py-2 mt-3">
              {uploadError}
            </p>
          )}
        </Card>
      )}

      {/* Action sheet */}
      {showSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowSheet(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="relative w-full max-w-md mb-4 mx-4 rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: "rgba(255,255,255,0.97)", backdropFilter: "blur(20px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {[
              { icon: <Camera size={20} />, label: "Take Photo",           action: () => { setShowSheet(false); cameraInputRef.current?.click(); } },
              { icon: <Images size={20} />, label: "Choose from Gallery",  action: () => { setShowSheet(false); galleryInputRef.current?.click(); } },
              { icon: <FolderOpen size={20} />, label: "Browse Files",     action: () => { setShowSheet(false); fileInputRef.current?.click(); } },
            ].map(({ icon, label, action }, i) => (
              <button key={i} type="button" onClick={action}
                className="w-full flex items-center gap-4 px-6 py-4 text-sm font-medium text-[var(--color-ink-800)] hover:bg-[var(--color-primary-50)] transition-colors border-b border-[var(--color-border)]">
                <span className="text-[var(--color-primary-600)]">{icon}</span>
                {label}
              </button>
            ))}
            <button type="button" onClick={() => setShowSheet(false)}
              className="w-full flex items-center gap-4 px-6 py-4 text-sm font-medium text-[var(--color-ink-500)] hover:bg-gray-50 transition-colors">
              <X size={20} />
              Cancel
            </button>
          </div>
        </div>
      )}

      {entries.length === 0 && (
        <Card>
          <p className="text-sm text-[var(--color-ink-400)] py-6 text-center">
            No past external visit records on file.
          </p>
        </Card>
      )}

      <ol className="relative border-l-2 border-[var(--color-border)] ml-2 flex flex-col gap-5">
        {entries.map((entry) => (
          <li key={entry.id} className="ml-5 fade-in">
            <span className="absolute -left-[9px] mt-1.5 h-4 w-4 rounded-full bg-[var(--color-primary-500)] border-2 border-white" />
            <Card>
              <EntryRow
                entry={entry}
                udid={udid}
                canEdit={canEdit}
                pending={pending}
                startTransition={startTransition}
              />
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}

function EntryRow({
  entry,
  udid,
  canEdit,
  pending,
  startTransition,
}: {
  entry: any;
  udid: string;
  canEdit: boolean;
  pending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [sourceHospital, setSourceHospital] = useState(entry.sourceHospital ?? "");
  const [extractedDiagnosis, setExtractedDiagnosis] = useState(entry.extractedDiagnosis ?? "");
  const [extractedTreatment, setExtractedTreatment] = useState(entry.extractedTreatment ?? "");

  const isPendingReview = entry.verificationStatus === "PENDING_REVIEW";

  const fileUrl: string | null = entry.scanFileRef?.startsWith("/uploads/") ? entry.scanFileRef : null;
  const isImage = fileUrl && /\.(png|jpe?g|webp)$/i.test(fileUrl);
  const isPdf = fileUrl && /\.pdf$/i.test(fileUrl);

  const saveAndVerify = () => {
    startTransition(() =>
      verifyPastExternalVisit(entry.id, udid, "VERIFIED", { sourceHospital, extractedDiagnosis, extractedTreatment })
    );
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-2.5">
        <input
          value={sourceHospital}
          onChange={(e) => setSourceHospital(e.target.value)}
          placeholder="Source hospital / doctor"
          className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
        />
        <input
          value={extractedDiagnosis}
          onChange={(e) => setExtractedDiagnosis(e.target.value)}
          placeholder="Diagnosis"
          className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
        />
        <textarea
          value={extractedTreatment}
          onChange={(e) => setExtractedTreatment(e.target.value)}
          placeholder="Treatment / medications"
          rows={2}
          className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <button
            onClick={saveAndVerify}
            disabled={pending}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[var(--color-success-100)] text-[var(--color-success-600)] hover:opacity-80"
          >
            <CheckCircle2 size={13} /> Save & Verify
          </button>
          <button
            onClick={() => setEditing(false)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-white border border-[var(--color-border)]"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="rounded-lg bg-[var(--color-surface-sunken)] p-2 mt-0.5 shrink-0">
            <FileScan size={16} className="text-[var(--color-ink-500)]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--color-ink-900)]">
              {entry.sourceDate ? format(new Date(entry.sourceDate), "dd MMM yyyy") : "Date not detected"} · {entry.sourceHospital ?? "Hospital not detected"}
            </p>
            <p className="text-sm text-[var(--color-ink-700)] mt-1">{entry.extractedDiagnosis ?? "—"}</p>
            <p className="text-xs text-[var(--color-ink-500)] mt-0.5">{entry.extractedTreatment ?? ""}</p>
            {!fileUrl && entry.scanFileRef && (
              <p className="text-xs text-[var(--color-ink-400)] mt-1 font-mono truncate">{entry.scanFileRef}</p>
            )}
          </div>
        </div>
        <StatusPill status={entry.verificationStatus} />
      </div>

      {/* Image preview */}
      {isImage && (
        <div className="mt-3 relative group rounded-xl overflow-hidden border border-[var(--color-border)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fileUrl!}
            alt="Scanned record"
            className="w-full max-h-64 object-contain bg-[var(--color-surface-sunken)] cursor-zoom-in"
            onClick={() => setLightbox(true)}
          />
          <button
            onClick={() => setLightbox(true)}
            className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
            title="View full size"
          >
            <ZoomIn size={14} />
          </button>
        </div>
      )}

      {/* PDF link */}
      {isPdf && (
        <a
          href={fileUrl!}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-[var(--color-primary-700)] bg-[var(--color-primary-50)] border border-[var(--color-primary-200)] rounded-xl px-3 py-2 hover:bg-[var(--color-primary-100)] transition-colors"
        >
          <FileText size={14} /> View PDF document
        </a>
      )}

      {canEdit && isPendingReview && (
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-[var(--color-border)]">
          <button
            disabled={pending}
            onClick={() => startTransition(() => verifyPastExternalVisit(entry.id, udid, "VERIFIED"))}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[var(--color-success-100)] text-[var(--color-success-600)] hover:opacity-80"
          >
            <CheckCircle2 size={13} /> Verify as correct
          </button>
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[var(--color-info-100)] text-[var(--color-info-600)] hover:opacity-80"
          >
            <Pencil size={13} /> Correct & verify
          </button>
          <button
            disabled={pending}
            onClick={() => startTransition(() => verifyPastExternalVisit(entry.id, udid, "REJECTED"))}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[var(--color-danger-100)] text-[var(--color-danger-600)] hover:opacity-80"
          >
            <XCircle size={13} /> Reject extraction
          </button>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && isImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.88)" }}
          onClick={() => setLightbox(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fileUrl!}
            alt="Scanned record full size"
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(false)}
            className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 text-white p-2.5 rounded-xl transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      )}
    </>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING_REVIEW: "bg-[var(--color-accent-100)] text-[var(--color-accent-600)]",
    VERIFIED: "bg-[var(--color-success-100)] text-[var(--color-success-600)]",
    REJECTED: "bg-[var(--color-danger-100)] text-[var(--color-danger-600)]",
  };
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${map[status]}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
