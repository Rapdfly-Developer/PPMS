"use client";

import { useState, useRef, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { format } from "date-fns";
import { Upload, Camera, Loader2, FileText, ZoomIn, X, Images, FolderOpen, FileScan, Pencil, Check } from "lucide-react";
import { addPastExternalVisit, renamePastExternalVisit } from "./actions";

// ── Inline rename widget for existing entries ────────────────────────────────
function InlineRename({
  id, udid, current,
}: { id: string; udid: string; current: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current);
  const [pending, startRename] = useTransition();

  function save() {
    if (!value.trim() || value.trim() === current) { setEditing(false); return; }
    startRename(async () => {
      await renamePastExternalVisit(id, udid, value.trim());
      setEditing(false);
    });
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-xs font-medium text-[var(--color-ink-700)] truncate">{current}</span>
        <button
          onClick={() => { setValue(current); setEditing(true); }}
          className="shrink-0 p-1 rounded-md hover:bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)] transition-colors"
          title="Rename"
        >
          <Pencil size={11} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
        className="flex-1 text-xs px-2 py-1 rounded-lg border border-[var(--color-primary-400)] bg-white text-[var(--color-ink-900)] outline-none min-w-0"
      />
      <button
        disabled={pending}
        onClick={save}
        className="shrink-0 p-1.5 rounded-md bg-[var(--color-primary-600)] text-white disabled:opacity-50"
        title="Save"
      >
        {pending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
      </button>
      <button
        onClick={() => setEditing(false)}
        className="shrink-0 p-1.5 rounded-md border border-[var(--color-border)] text-[var(--color-ink-500)] hover:bg-[var(--color-surface-sunken)]"
        title="Cancel"
      >
        <X size={11} />
      </button>
    </div>
  );
}

// ── Main tab ─────────────────────────────────────────────────────────────────
export function PastExternalVisitsTab({
  patientId,
  udid,
  entries,
  canUpload,
  canEdit: _canEdit,
}: {
  patientId: string;
  udid: string;
  entries: any[];
  canUpload: boolean;
  canEdit?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showSheet, setShowSheet] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  // pending file waiting for name confirmation
  const [pendingFile, setPendingFile] = useState<{ file: File; name: string; preview: string | null } | null>(null);

  const fileInputRef    = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef  = useRef<HTMLInputElement>(null);

  function onFileSelected(file: File) {
    const isImage = /\.(png|jpe?g|webp)$/i.test(file.name) || file.type.startsWith("image/");
    const preview = isImage ? URL.createObjectURL(file) : null;
    // Strip extension for the default label
    const baseName = file.name.replace(/\.[^.]+$/, "");
    setPendingFile({ file, name: baseName, preview });
  }

  async function confirmUpload() {
    if (!pendingFile) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", pendingFile.file);
      const res  = await fetch("/api/uploads", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "File upload failed.");
      await addPastExternalVisit(patientId, udid, {
        originalFileName: pendingFile.file.name,
        label:            pendingFile.name.trim() || pendingFile.file.name,
        scanFileUrl:      json.url,
      });
      if (pendingFile.preview) URL.revokeObjectURL(pendingFile.preview);
      setPendingFile(null);
    } catch (err: any) {
      setUploadError(err.message ?? "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function cancelPending() {
    if (pendingFile?.preview) URL.revokeObjectURL(pendingFile.preview);
    setPendingFile(null);
    setUploadError(null);
  }

  const sheetActions = [
    { icon: <Camera size={20} />,     label: "Take Photo",          ref: cameraInputRef },
    { icon: <Images size={20} />,     label: "Choose from Gallery", ref: galleryInputRef },
    { icon: <FolderOpen size={20} />, label: "Browse Files",        ref: fileInputRef },
  ];

  return (
    <div className="flex flex-col gap-4">
      {canUpload && !pendingFile && (
        <Card>
          <button
            type="button"
            disabled={uploading}
            onClick={() => setShowSheet(true)}
            className="w-full flex flex-col items-center justify-center gap-3 border-2 border-dashed border-[var(--color-border)] rounded-2xl py-8 transition-colors hover:border-[var(--color-primary-400)] hover:bg-[var(--color-primary-50)] disabled:opacity-50"
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: "var(--color-primary-50)", border: "1.5px solid var(--color-primary-100)" }}
            >
              <Upload className="text-[var(--color-primary-600)]" size={26} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-[var(--color-ink-700)]">Upload Document</p>
              <p className="text-xs text-[var(--color-ink-400)] mt-0.5">Image or PDF</p>
            </div>
          </button>

          <input ref={cameraInputRef}  type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) onFileSelected(e.target.files[0]); e.target.value = ""; }} />
          <input ref={galleryInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) onFileSelected(e.target.files[0]); e.target.value = ""; }} />
          <input ref={fileInputRef}    type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) onFileSelected(e.target.files[0]); e.target.value = ""; }} />
        </Card>
      )}

      {/* ── Pending file: name + confirm ───────────────────────────────────── */}
      {pendingFile && (
        <Card>
          <div className="flex flex-col gap-4">
            {/* Preview */}
            {pendingFile.preview ? (
              <div className="rounded-xl overflow-hidden border border-[var(--color-border)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pendingFile.preview} alt="Preview" className="w-full max-h-48 object-contain bg-[var(--color-surface-sunken)]" />
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-4 py-4">
                <FileText size={22} className="text-[var(--color-primary-600)] shrink-0" />
                <p className="text-sm text-[var(--color-ink-600)] truncate">{pendingFile.file.name}</p>
              </div>
            )}

            {/* Name input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--color-ink-600)]">Document name</label>
              <input
                autoFocus
                value={pendingFile.name}
                onChange={(e) => setPendingFile((p) => p ? { ...p, name: e.target.value } : p)}
                placeholder="Enter a name for this document"
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3 py-2.5 text-sm text-[var(--color-ink-900)] placeholder:text-[var(--color-ink-300)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)]"
              />
            </div>

            {uploadError && (
              <p className="text-sm text-[var(--color-danger-600)] bg-[var(--color-danger-100)] rounded-lg px-3 py-2">
                {uploadError}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <button
                disabled={uploading}
                onClick={cancelPending}
                className="px-4 py-2 rounded-xl text-sm font-medium border border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={uploading}
                onClick={confirmUpload}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] disabled:opacity-50"
              >
                {uploading
                  ? <><Loader2 size={14} className="animate-spin" /> Uploading…</>
                  : <><Upload size={14} /> Upload</>}
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Source picker sheet */}
      {showSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowSheet(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="relative w-full max-w-md mb-4 mx-4 rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: "rgba(255,255,255,0.97)", backdropFilter: "blur(20px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {sheetActions.map(({ icon, label, ref }, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { setShowSheet(false); ref.current?.click(); }}
                className="w-full flex items-center gap-4 px-6 py-4 text-sm font-medium text-[var(--color-ink-800)] hover:bg-[var(--color-primary-50)] transition-colors border-b border-[var(--color-border)]"
              >
                <span className="text-[var(--color-primary-600)]">{icon}</span>
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowSheet(false)}
              className="w-full flex items-center gap-4 px-6 py-4 text-sm font-medium text-[var(--color-ink-500)] hover:bg-gray-50 transition-colors"
            >
              <X size={20} /> Cancel
            </button>
          </div>
        </div>
      )}

      {entries.length === 0 && !pendingFile && (
        <Card>
          <p className="text-sm text-[var(--color-ink-400)] py-6 text-center">
            No documents uploaded yet.
          </p>
        </Card>
      )}

      {entries.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {entries.map((entry) => {
            const fileUrl: string | null = entry.scanFileRef || null;
            const isImage = fileUrl && /\.(png|jpe?g|webp)$/i.test(fileUrl);
            const isPdf   = fileUrl && /\.pdf$/i.test(fileUrl);
            // Label: user-set name → fallback to filename from URL
            const fallbackName = fileUrl
              ? decodeURIComponent(fileUrl.split("/").pop() ?? "Document")
              : "Document";
            const displayName = (entry.label as string | null) || fallbackName;
            const uploadedAt = entry.createdAt ? format(new Date(entry.createdAt), "d MMM yyyy, h:mm a") : "—";

            return (
              <Card key={entry.id} className="flex flex-col gap-3">
                {/* File preview */}
                {isImage && (
                  <div className="relative group rounded-xl overflow-hidden border border-[var(--color-border)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={fileUrl!}
                      alt={displayName}
                      className="w-full max-h-56 object-contain bg-[var(--color-surface-sunken)] cursor-zoom-in"
                      onClick={() => setLightbox(fileUrl)}
                    />
                    <button
                      onClick={() => setLightbox(fileUrl)}
                      className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      title="View full size"
                    >
                      <ZoomIn size={14} />
                    </button>
                  </div>
                )}

                {isPdf && (
                  <a
                    href={fileUrl!}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-4 py-4 hover:bg-[var(--color-primary-50)] hover:border-[var(--color-primary-200)] transition-colors"
                  >
                    <FileText size={22} className="text-[var(--color-primary-600)] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--color-ink-800)] truncate">{displayName}</p>
                      <p className="text-xs text-[var(--color-ink-400)] mt-0.5">Tap to open PDF</p>
                    </div>
                  </a>
                )}

                {!fileUrl && (
                  <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-4 py-4">
                    <FileScan size={22} className="text-[var(--color-ink-400)] shrink-0" />
                    <p className="text-sm text-[var(--color-ink-400)]">File unavailable</p>
                  </div>
                )}

                {/* Name + rename */}
                {fileUrl && (
                  <InlineRename id={entry.id} udid={udid} current={displayName} />
                )}

                {/* Date */}
                <p className="text-xs text-[var(--color-ink-400)]">Uploaded {uploadedAt}</p>
              </Card>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.88)" }}
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Full size record"
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 text-white p-2.5 rounded-xl transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
