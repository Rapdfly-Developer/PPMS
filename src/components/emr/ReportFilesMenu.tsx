"use client";

// One "Report" button for an uploaded investigation report. Clicking it opens
// four options: View, Re-upload, Delete and Add more. With more than one file,
// View and Delete ask which file. No inline previews of the files.

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { ChevronDown, Eye, FileText, Plus, Trash2, Upload } from "lucide-react";
import { fileHref } from "@/lib/file-href";

export interface ReportFile { ref: string; at: string | null; main: boolean }

type Pick = null | "view" | "delete";

export function ReportFilesMenu({ files, locked, onView, onReplace, onAddMore, onDelete }: {
  /** Main file first, then the ones added with "Add more". */
  files: ReportFile[];
  /** Read-only: only View is offered. */
  locked?: boolean;
  onView: (url: string) => void;
  /** Called with the uploaded file's url. */
  onReplace: (url: string) => Promise<{ error?: string } | void>;
  onAddMore: (url: string) => Promise<{ error?: string } | void>;
  onDelete: (file: ReportFile) => Promise<{ error?: string } | void>;
}) {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<Pick>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const modeRef = useRef<"replace" | "add">("replace");

  // Close on an outside click
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) { setOpen(false); setPick(null); setConfirm(null); } };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const done = () => { setOpen(false); setPick(null); setConfirm(null); };
  const fileLabel = (f: ReportFile, i: number) => `File ${i + 1}${f.at ? ` · ${format(new Date(f.at), "EEE, d MMM, h:mm a")}` : ""}`;

  const run = async (fn: () => Promise<{ error?: string } | void>) => {
    setBusy(true);
    setError("");
    try {
      const r = await fn();
      if (r && r.error) setError(r.error); else done();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    await run(async () => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || json.error) return { error: json.error ?? "Upload failed" };
      return modeRef.current === "add" ? onAddMore(json.url) : onReplace(json.url);
    });
  };
  const chooseFile = (mode: "replace" | "add") => { modeRef.current = mode; fileRef.current?.click(); };

  const view = (f: ReportFile) => { onView(fileHref(f.ref)!); done(); };
  const del = (f: ReportFile) => {
    if (confirm !== f.ref) { setConfirm(f.ref); return; }
    void run(() => onDelete(f));
  };

  const item = "w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-primary-50)] disabled:opacity-50";

  return (
    <div ref={boxRef} className="relative flex flex-col items-end gap-0.5">
      <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.docx" className="hidden" onChange={upload} />
      <button
        type="button"
        disabled={busy}
        onClick={() => { setOpen((o) => !o); setPick(null); setConfirm(null); }}
        className="flex items-center gap-1 text-caption font-medium px-2 py-1 rounded-lg border border-[var(--color-primary-400)] text-[var(--color-primary-700)] bg-white hover:bg-[var(--color-primary-50)] disabled:opacity-50 transition-colors"
      >
        <FileText size={12} className={busy ? "animate-pulse" : ""} />
        {busy ? "..." : "Report"}
        {files.length > 1 && <span className="rounded-full bg-[var(--color-primary-100)] px-1.5 text-[10px] tabular-nums">{files.length}</span>}
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-52 rounded-lg border border-[var(--color-border)] bg-white py-1 shadow-lg">
          {pick === null ? (
            <>
              <button type="button" className={item} onClick={() => (files.length > 1 ? setPick("view") : view(files[0]))}><Eye size={13} /> View</button>
              {!locked && (
                <>
                  <button type="button" className={item} disabled={busy} onClick={() => chooseFile("replace")}><Upload size={13} /> Re-upload</button>
                  {files.length > 1
                    ? <button type="button" className={`${item} !text-red-600 hover:!bg-red-50`} onClick={() => setPick("delete")}><Trash2 size={13} /> Delete</button>
                    : <button type="button" className={`${item} !text-red-600 hover:!bg-red-50`} disabled={busy} onClick={() => del(files[0])}><Trash2 size={13} /> {confirm ? "Sure? Click to delete" : "Delete"}</button>}
                  <button type="button" className={item} disabled={busy} onClick={() => chooseFile("add")}><Plus size={13} /> Add more</button>
                </>
              )}
            </>
          ) : (
            <>
              <p className="px-3 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">{pick === "view" ? "View which file?" : "Delete which file?"}</p>
              {files.map((f, i) => (
                <button key={f.ref} type="button" disabled={busy}
                  className={`${item} ${pick === "delete" ? "!text-red-600 hover:!bg-red-50" : ""}`}
                  onClick={() => (pick === "view" ? view(f) : del(f))}>
                  {pick === "view" ? <Eye size={13} /> : <Trash2 size={13} />}
                  {pick === "delete" && confirm === f.ref ? "Sure? Click to delete" : fileLabel(f, i)}
                </button>
              ))}
            </>
          )}
        </div>
      )}
      {error && <p className="text-caption text-red-600">{error}</p>}
    </div>
  );
}
