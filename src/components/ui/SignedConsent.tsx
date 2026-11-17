"use client";

// Signed consent file: once uploaded it replaces the consent wording. Shared by
// Counselling and the IPD Consents form.

import { useRef, useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, FileText, Trash2, Upload } from "lucide-react";
import { fileHref } from "@/lib/file-href";

/** The uploaded signed consent, shown large: an image in full width, a PDF in a tall viewer. */
export function SignedConsentView({ file, title }: { file: { ref: string; name: string; at: string }; title: string }) {
  const url = fileHref(file.ref)!;
  const isPdf = /\.pdf(\?|$)/i.test(file.ref) || /\.pdf$/i.test(file.name);
  const isImg = /\.(png|jpe?g|webp|gif)(\?|$)/i.test(file.ref) || /\.(png|jpe?g|webp|gif)$/i.test(file.name);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800 ring-1 ring-emerald-200">
        <span className="inline-flex items-center gap-1.5 font-semibold"><CheckCircle2 size={14} /> Signed consent uploaded</span>
        <span className="text-emerald-700/80">{file.name} · {format(new Date(file.at), "EEE, d MMM yyyy, h:mm a")}</span>
      </div>
      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)]/50">
        {isImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={`Signed ${title}`} className="mx-auto block max-h-[85vh] w-auto max-w-full object-contain" />
        ) : isPdf ? (
          <iframe src={`${url}#view=FitH`} title={`Signed ${title}`} className="block h-[85vh] w-full bg-white" />
        ) : (
          <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-6 text-sm font-medium text-[var(--color-primary-700)] hover:underline">
            <FileText size={16} /> Open {file.name}
          </a>
        )}
      </div>
    </div>
  );
}

/** Upload, replace or remove the signed consent file of the open consent. */
export function SignedConsentUpload({ file, title, onChange }: {
  file?: { ref: string; name: string; at: string };
  title: string;
  onChange: (f: { ref: string; name: string; at: string } | undefined) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const upload = async (f: File | undefined) => {
    if (ref.current) ref.current.value = "";
    if (!f) return;
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "Upload failed");
      onChange({ ref: json.url, name: f.name, at: new Date().toISOString() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-[var(--color-primary-200)] bg-[var(--color-primary-50)]/30 p-1.5 pl-3">
      <input ref={ref} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      <Upload size={14} className="shrink-0 text-[var(--color-primary-500)]" />
      <p className="flex-1 min-w-0 text-[13px] text-[var(--color-ink-600)]">
        {file ? <>Signed copy of <b className="text-[var(--color-ink-800)]">{title}</b> is shown above. Saved with the Save button.</> : <>Upload the signed <b className="text-[var(--color-ink-800)]">{title}</b> (PDF or photo). It replaces the wording above.</>}
      </p>
      {error && <span className="text-xs text-red-600">{error}</span>}
      {file && (confirm ? (
        <button type="button" onClick={() => { onChange(undefined); setConfirm(false); }} className="h-8 rounded-full bg-red-600 px-3 text-xs font-semibold text-white hover:bg-red-700">Remove file?</button>
      ) : (
        <button type="button" onClick={() => setConfirm(true)} className="h-8 inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-white px-3 text-xs font-semibold text-[var(--color-ink-500)] hover:border-red-300 hover:text-red-600"><Trash2 size={12} /> Remove</button>
      ))}
      <button type="button" disabled={busy} onClick={() => ref.current?.click()}
        className="h-8 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary-600)] px-3.5 text-xs font-semibold text-white hover:bg-[var(--color-primary-700)] disabled:opacity-60">
        <Upload size={12} className={busy ? "animate-pulse" : ""} /> {busy ? "Uploading..." : file ? "Replace file" : "Upload signed consent"}
      </button>
    </div>
  );
}
