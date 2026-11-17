"use client";

// Uploaded documents as small chips (view, remove) or just the upload button.
// Shared by Counselling (payment and implant documents) and the IPD Implant form.

import { useRef, useState } from "react";
import { format } from "date-fns";
import { FileText, Upload, X } from "lucide-react";
import { fileHref } from "@/lib/file-href";

import type { PaymentDoc } from "@/lib/counselling";

/** Insurance card, pre-authorisation, scheme card or letter: upload, view, remove. Saved with the common Save. */
export function PaymentDocs({ docs, onChange, editable, typeLabel, button, hint }: { docs: PaymentDoc[]; onChange: (d: PaymentDoc[]) => void; editable: boolean; typeLabel: string; /** Only the small upload button. */ button?: boolean; /** Button tooltip. */ hint?: string }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setError("");
    try {
      const added: PaymentDoc[] = [];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/uploads", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok || json.error) throw new Error(json.error ?? "Upload failed");
        added.push({ ref: json.url, name: file.name, at: new Date().toISOString() });
      }
      onChange([...docs, ...added]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (button) {
    if (!editable) return null;
    return (
      <span className="relative shrink-0">
        <input ref={fileRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.docx" className="hidden" onChange={(e) => upload(e.target.files)} />
        <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()}
          title={error || hint || `Upload ${typeLabel.toLowerCase()} document (card, pre-authorisation, letter)`}
          className={`h-8 inline-flex items-center gap-1 px-2.5 rounded-full border border-dashed text-xs font-semibold transition-colors disabled:opacity-50 ${error ? "border-red-300 text-red-600" : "border-[var(--color-primary-400)] text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)]"} bg-white`}>
          <Upload size={12} className={uploading ? "animate-pulse" : ""} />
          {uploading ? "..." : "Doc"}
          {docs.length > 0 && <span className="rounded-full bg-[var(--color-primary-100)] px-1.5 text-[10px] tabular-nums">{docs.length}</span>}
        </button>
      </span>
    );
  }

  return (
    <ul className="flex flex-wrap gap-1.5">
      {docs.map((d) => (
        <li key={d.ref} className="inline-flex items-center gap-1.5 max-w-full rounded-full border border-[var(--color-border)] bg-white pl-2.5 pr-1 py-0.5 text-xs">
          <FileText size={12} className="shrink-0 text-[var(--color-primary-600)]" />
          <a href={fileHref(d.ref)!} target="_blank" rel="noreferrer" className="truncate max-w-[220px] font-medium text-[var(--color-ink-700)] hover:text-[var(--color-primary-700)] hover:underline" title={d.name}>{d.name}</a>
          <span className="text-[10px] text-[var(--color-ink-400)] whitespace-nowrap">{format(new Date(d.at), "EEE, d MMM")}</span>
          {editable && (
            <button type="button" onClick={() => onChange(docs.filter((x) => x.ref !== d.ref))} aria-label={`Remove ${d.name}`}
              className="w-5 h-5 rounded-full flex items-center justify-center text-[var(--color-ink-300)] hover:bg-red-50 hover:text-red-600 transition-colors"><X size={11} /></button>
          )}
        </li>
      ))}
    </ul>
  );
}
