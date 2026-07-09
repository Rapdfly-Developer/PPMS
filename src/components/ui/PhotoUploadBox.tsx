"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { UploadCloud, Camera, X, FileText, Aperture } from "lucide-react";

export interface UploadedFile {
  savedName: string;
  originalFileName: string;
  mimeType: string;
  previewUrl?: string;
}

export function PhotoUploadBox({
  label, hint, icon: Icon, value, onChange, accept = "image/*",
}: {
  label: string;
  hint: string;
  icon: React.ElementType;
  value: UploadedFile | null;
  onChange: (file: UploadedFile | null) => void;
  accept?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const [camOpen, setCamOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCam = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOpen(false);
  }, []);

  async function upload(file: File | Blob, name: string) {
    setErr(""); setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file instanceof File ? file : new File([file], name, { type: "image/jpeg" }));
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) { setErr(json.error ?? "Upload failed."); return; }
      const previewUrl = URL.createObjectURL(file);
      onChange({ savedName: json.savedName, originalFileName: json.originalFileName ?? name, mimeType: json.mimeType, previewUrl });
    } catch { setErr("Upload failed."); }
    finally { setUploading(false); }
  }

  async function openCam() {
    setErr("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setCamOpen(true);
    } catch { setErr("Camera access denied."); }
  }

  useEffect(() => {
    if (camOpen && videoRef.current && streamRef.current) videoRef.current.srcObject = streamRef.current;
  }, [camOpen]);
  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  function capture() {
    const v = videoRef.current; if (!v) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    c.toBlob((blob) => { if (blob) { upload(blob, `${label}-${Date.now()}.jpg`); stopCam(); } }, "image/jpeg", 0.92);
  }

  function remove() {
    if (value?.previewUrl) URL.revokeObjectURL(value.previewUrl);
    onChange(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-[var(--color-ink-700)] flex items-center gap-1.5">
        <Icon size={14} className="text-[var(--color-ink-400)]" /> {label}
      </label>

      {value ? (
        <div className="relative rounded-xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-surface-sunken)]">
          {value.previewUrl ? (
            <img src={value.previewUrl} alt={label} className="w-full h-36 object-cover" />
          ) : (
            <div className="w-full h-36 flex items-center justify-center">
              <FileText size={28} className="text-[var(--color-ink-300)]" />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-black/50 px-3 py-1.5 flex items-center justify-between">
            <p className="text-xs text-white truncate max-w-[80%]">{value.originalFileName}</p>
            <button type="button" onClick={remove} className="text-white/80 hover:text-white"><X size={14} /></button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex-1 flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface-sunken)] py-5 cursor-pointer hover:border-[var(--color-primary-400)] hover:bg-[var(--color-primary-50)] transition-colors disabled:opacity-50"
          >
            <UploadCloud size={18} className="text-[var(--color-primary-600)]" />
            <p className="text-xs font-semibold text-[var(--color-ink-700)]">{uploading ? "Uploading…" : "Upload File"}</p>
            <p className="text-[10px] text-[var(--color-ink-400)]">{hint}</p>
          </button>
          <input ref={fileRef} type="file" accept={accept} className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, f.name); e.target.value = ""; }} />
          <button
            type="button"
            onClick={openCam}
            disabled={uploading}
            className="flex-1 flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface-sunken)] py-5 cursor-pointer hover:border-[var(--color-primary-400)] hover:bg-[var(--color-primary-50)] transition-colors disabled:opacity-50"
          >
            <Camera size={18} className="text-[var(--color-primary-600)]" />
            <p className="text-xs font-semibold text-[var(--color-ink-700)]">Camera</p>
            <p className="text-[10px] text-[var(--color-ink-400)]">Capture now</p>
          </button>
        </div>
      )}

      {err && <p className="text-xs text-[var(--color-danger-600)]">{err}</p>}

      {camOpen && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-4">
          <div className="relative w-full max-w-lg">
            <button type="button" onClick={stopCam}
              className="absolute top-3 right-3 z-10 size-9 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30">
              <X size={18} />
            </button>
            <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-xl" />
            <div className="flex justify-center mt-4">
              <button type="button" onClick={capture}
                className="flex items-center gap-2 px-8 py-3 rounded-full bg-white text-[var(--color-ink-900)] font-semibold text-sm hover:bg-gray-100 shadow-lg">
                <Aperture size={18} /> Capture
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
