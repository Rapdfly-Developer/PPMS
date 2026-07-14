"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import {
  UploadCloud, Camera, X, FileText,
  CheckCircle2, Eye, RefreshCw, Trash2, Aperture, FolderOpen,
} from "lucide-react";

export interface UploadedFile {
  savedName: string;
  originalFileName: string;
  mimeType: string;
  previewUrl?: string;
}

export function SmartUploadBox({
  label,
  uploadLabel,
  subtitle,
  accept,
  value,
  onChange,
}: {
  label: string;
  uploadLabel: string;
  subtitle: string;
  accept: string;
  value: UploadedFile | null;
  onChange: (file: UploadedFile | null) => void;
}) {
  const [sheetOpen, setSheetOpen]     = useState(false);
  const [camOpen, setCamOpen]         = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [err, setErr]                 = useState("");

  const galleryRef = useRef<HTMLInputElement>(null);
  const filesRef   = useRef<HTMLInputElement>(null);
  const videoRef   = useRef<HTMLVideoElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);

  const hasPDF = accept.includes("pdf");

  const stopCam = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOpen(false);
  }, []);

  async function upload(file: File | Blob, name: string) {
    setErr("");
    setUploading(true);
    setSheetOpen(false);
    try {
      const fd = new FormData();
      fd.append(
        "file",
        file instanceof File ? file : new File([file], name, { type: "image/jpeg" }),
      );
      const res  = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) { setErr(json.error ?? "Upload failed."); return; }

      const mimeType   = file instanceof File ? file.type : "image/jpeg";
      const previewUrl = mimeType.startsWith("image/") ? URL.createObjectURL(file) : undefined;
      onChange({
        savedName:        json.savedName,
        originalFileName: json.originalFileName ?? name,
        mimeType:         json.mimeType ?? mimeType,
        previewUrl,
      });
    } catch {
      setErr("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function openCam() {
    setSheetOpen(false);
    setErr("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setCamOpen(true);
    } catch {
      setErr("Camera access denied.");
    }
  }

  useEffect(() => {
    if (camOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [camOpen]);

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  function capture() {
    const v = videoRef.current;
    if (!v) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    c.toBlob(
      (blob) => { if (blob) { upload(blob, `${label}-${Date.now()}.jpg`); stopCam(); } },
      "image/jpeg",
      0.92,
    );
  }

  function remove() {
    if (value?.previewUrl) URL.revokeObjectURL(value.previewUrl);
    onChange(null);
  }

  const isPDF = value?.mimeType === "application/pdf";

  return (
    <>
      <div className="flex flex-col gap-1.5">
        {/* ── Upload card / preview ───────────────────────────────────────── */}
        {!value ? (
          <button
            type="button"
            onClick={() => { setErr(""); setSheetOpen(true); }}
            disabled={uploading}
            style={{ borderRadius: 20 }}
            className="group w-full border-2 border-dashed border-[var(--color-primary-300)] bg-gradient-to-b from-[var(--color-primary-50)] to-white hover:from-[var(--color-primary-100)] hover:border-[var(--color-primary-500)] active:scale-[0.97] transition-all duration-200 p-7 flex flex-col items-center gap-3 shadow-sm hover:shadow-md disabled:opacity-50 cursor-pointer"
          >
            {uploading ? (
              <div className="size-12 rounded-2xl bg-[var(--color-primary-100)] flex items-center justify-center">
                <div className="size-6 rounded-full border-2 border-[var(--color-primary-300)] border-t-[var(--color-primary-700)] animate-spin" />
              </div>
            ) : (
              <div className="size-12 rounded-2xl bg-[var(--color-primary-100)] group-hover:bg-[var(--color-primary-200)] flex items-center justify-center transition-colors">
                <UploadCloud size={24} className="text-[var(--color-primary-700)]" />
              </div>
            )}
            <div className="text-center">
              <p className="text-sm font-semibold text-[var(--color-ink-800)]">
                {uploading ? "Uploading…" : uploadLabel}
              </p>
              <p className="text-xs text-[var(--color-ink-400)] mt-0.5">{subtitle}</p>
            </div>
          </button>
        ) : (
          <div
            style={{ borderRadius: 20 }}
            className="border border-[var(--color-success-300)] bg-[var(--color-success-50)] overflow-hidden shadow-sm"
          >
            {isPDF ? (
              <div className="flex items-center gap-4 p-5">
                <div className="size-14 rounded-2xl bg-red-100 flex items-center justify-center shrink-0 shadow-sm">
                  <FileText size={24} className="text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-ink-900)] truncate">
                    {value.originalFileName}
                  </p>
                  <p className="text-xs text-[var(--color-ink-400)] mt-0.5">PDF Document</p>
                </div>
                <div className="size-8 rounded-full bg-[var(--color-success-500)] flex items-center justify-center shrink-0 shadow">
                  <CheckCircle2 size={16} className="text-white" />
                </div>
              </div>
            ) : (
              value.previewUrl && (
                <div className="relative">
                  <img
                    src={value.previewUrl}
                    alt={label}
                    className="w-full h-44 object-cover"
                  />
                  <div className="absolute top-3 right-3 size-8 rounded-full bg-[var(--color-success-500)] flex items-center justify-center shadow-lg">
                    <CheckCircle2 size={16} className="text-white" />
                  </div>
                </div>
              )
            )}

            {/* Action bar */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-success-200)] bg-white/70">
              <p className="text-xs text-[var(--color-ink-500)] font-medium truncate max-w-[45%]">
                {value.originalFileName}
              </p>
              <div className="flex items-center gap-3">
                {value.previewUrl && (
                  <button
                    type="button"
                    onClick={() => setPreviewOpen(true)}
                    className="flex items-center gap-1 text-xs font-semibold text-[var(--color-primary-600)] hover:text-[var(--color-primary-800)] transition-colors"
                  >
                    <Eye size={13} /> Preview
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSheetOpen(true)}
                  className="flex items-center gap-1 text-xs font-semibold text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)] transition-colors"
                >
                  <RefreshCw size={13} /> Replace
                </button>
                <button
                  type="button"
                  onClick={remove}
                  className="flex items-center gap-1 text-xs font-semibold text-[var(--color-danger-500)] hover:text-[var(--color-danger-700)] transition-colors"
                >
                  <Trash2 size={13} /> Remove
                </button>
              </div>
            </div>
          </div>
        )}

        {err && (
          <p className="text-xs text-[var(--color-danger-600)] px-1">{err}</p>
        )}
      </div>

      {/* ── Hidden file inputs ────────────────────────────────────────────── */}
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f, f.name);
          e.target.value = "";
        }}
      />
      <input
        ref={filesRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f, f.name);
          e.target.value = "";
        }}
      />

      {/* ── Bottom sheet ──────────────────────────────────────────────────── */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          onClick={() => setSheetOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40" style={{ backdropFilter: "blur(4px)" }} />
          <div
            className="ppms-slide-up relative bg-white overflow-hidden shadow-2xl"
            style={{ borderRadius: "28px 28px 0 0" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle pill */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            {/* Sheet header */}
            <div className="px-6 py-3 border-b border-gray-100">
              <p className="text-base font-bold text-[var(--color-ink-900)]">{label}</p>
              <p className="text-xs text-[var(--color-ink-400)] mt-0.5">{subtitle}</p>
            </div>

            {/* Options */}
            <div className="px-4 pt-3 pb-2 flex flex-col gap-2">
              {/* Take Photo */}
              <button
                type="button"
                onClick={openCam}
                className="flex items-center gap-4 w-full px-4 py-3.5 rounded-2xl bg-gray-50 hover:bg-[var(--color-primary-50)] active:scale-[0.97] transition-all text-left"
              >
                <div className="size-10 rounded-xl bg-[var(--color-primary-100)] flex items-center justify-center shrink-0">
                  <Camera size={20} className="text-[var(--color-primary-700)]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--color-ink-900)]">📷 Take Photo</p>
                  <p className="text-xs text-[var(--color-ink-400)]">Open camera</p>
                </div>
              </button>

              {/* Choose from Gallery */}
              <button
                type="button"
                onClick={() => { setSheetOpen(false); galleryRef.current?.click(); }}
                className="flex items-center gap-4 w-full px-4 py-3.5 rounded-2xl bg-gray-50 hover:bg-[var(--color-primary-50)] active:scale-[0.97] transition-all text-left"
              >
                <div className="size-10 rounded-xl bg-[var(--color-primary-100)] flex items-center justify-center shrink-0">
                  <span className="text-xl leading-none">🖼️</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--color-ink-900)]">🖼️ Choose from Gallery</p>
                  <p className="text-xs text-[var(--color-ink-400)]">Select an image</p>
                </div>
              </button>

              {/* Browse Files — only for Aadhaar (PDF allowed) */}
              {hasPDF && (
                <button
                  type="button"
                  onClick={() => { setSheetOpen(false); filesRef.current?.click(); }}
                  className="flex items-center gap-4 w-full px-4 py-3.5 rounded-2xl bg-gray-50 hover:bg-[var(--color-primary-50)] active:scale-[0.97] transition-all text-left"
                >
                  <div className="size-10 rounded-xl bg-[var(--color-primary-100)] flex items-center justify-center shrink-0">
                    <FolderOpen size={20} className="text-[var(--color-primary-700)]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-ink-900)]">📄 Browse Files</p>
                    <p className="text-xs text-[var(--color-ink-400)]">PDF or image files</p>
                  </div>
                </button>
              )}
            </div>

            {/* Cancel */}
            <div className="px-4 pb-8">
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="flex items-center justify-center gap-2 w-full px-4 py-3.5 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 active:scale-[0.97] transition-all"
              >
                <span className="text-sm font-semibold text-[var(--color-ink-600)]">❌ Cancel</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Camera overlay ────────────────────────────────────────────────── */}
      {camOpen && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black p-4">
          <div className="relative w-full max-w-lg">
            <button
              type="button"
              onClick={stopCam}
              className="absolute top-3 right-3 z-10 size-10 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
            >
              <X size={18} />
            </button>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full rounded-2xl bg-black"
            />
            <div className="flex justify-center mt-5">
              <button
                type="button"
                onClick={capture}
                className="flex items-center gap-2.5 px-8 py-3.5 rounded-full bg-white text-[var(--color-ink-900)] font-bold text-sm hover:bg-gray-100 active:scale-95 shadow-xl transition-all"
              >
                <Aperture size={18} /> Capture Photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Image preview overlay ─────────────────────────────────────────── */}
      {previewOpen && value?.previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="relative max-w-2xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="absolute -top-4 -right-4 z-10 size-10 flex items-center justify-center rounded-full bg-white text-gray-800 shadow-lg hover:bg-gray-100 transition-colors"
            >
              <X size={18} />
            </button>
            <img
              src={value.previewUrl}
              alt={label}
              className="w-full rounded-2xl shadow-2xl"
            />
            <p className="text-center text-white/60 text-xs mt-3 font-medium">
              {value.originalFileName}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
