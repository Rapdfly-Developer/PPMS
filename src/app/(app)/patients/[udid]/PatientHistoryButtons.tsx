"use client";

import { NO_SHOW_KIND_LABEL } from "@/lib/noShowKinds";
import { useState, useTransition, useRef, useEffect } from "react";
import { format, addMonths } from "date-fns";
import { X, FlaskConical, Pill, Glasses, Loader2, ChevronDown, ChevronUp, Upload, Eye, Trash2, UserX, Calendar, Building2, Clock, Lock, Paperclip } from "lucide-react";
import { parseJSON } from "@/lib/json";
import {
  getPatientInvestigations,
  getPatientTreatmentHistory,
  getPatientSpectacleHistory,
  getPatientNoShows,
} from "../actions";
import { attachResult, deleteInvestigationOrder, updateInvestigationDoctorNotes, removeResult, addExtraResult, removeExtraResult } from "@/app/(app)/emr/[udid]/actions";
import { ExtraResultPreview } from "@/components/emr/ExtraResultPreview";
import { parseExtraResults, type ExtraResult } from "@/lib/investigation-extra-results";
import { KeywordInput } from "@/components/emr/KeywordField";
import { INV_DOCTOR_NOTE_DEFAULTS } from "@/lib/investigation-keywords";
import { fileHref } from "@/lib/file-href";
import { TimeStampButton } from "./PatientTimeline";
import { medicationLaterality } from "@/lib/medication-laterality";

/* ── Shared drawer shell ──────────────────────────────────────────────────── */
function Drawer({
  open,
  onClose,
  title,
  icon,
  children,
  wide = false,
  mid = false,
  xwide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
  mid?: boolean;
  xwide?: boolean;
}) {
  if (!open) return null;
  const widthCls = xwide ? "sm:max-w-5xl" : wide ? "sm:max-w-2xl" : mid ? "sm:max-w-xl" : "sm:max-w-lg";
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`bg-white w-full sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] rounded-t-2xl ${widthCls}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)] shrink-0">
          <div className="flex items-center gap-2 text-[var(--color-ink-800)]">
            <span className="text-[var(--color-primary-600)]">{icon}</span>
            <h2 className="text-sm font-bold">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--color-ink-400)] hover:text-[var(--color-ink-800)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4 scrollbar-thin">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ── Visit group header ───────────────────────────────────────────────────── */
function VisitGroup({
  date,
  hospitalName,
  children,
}: {
  date: string;
  hospitalName: string | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-[var(--color-surface-sunken)] text-left"
      >
        <div>
          <span className="text-xs font-semibold text-[var(--color-ink-800)]">
            {format(new Date(date), "dd MMM yyyy")}
          </span>
          {hospitalName && (
            <span className="ml-2 text-caption text-[var(--color-ink-400)]">{hospitalName}</span>
          )}
        </div>
        {open ? <ChevronUp size={14} className="text-[var(--color-ink-400)]" /> : <ChevronDown size={14} className="text-[var(--color-ink-400)]" />}
      </button>
      {open && <div className="px-4 py-3 space-y-2">{children}</div>}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="py-10 text-center text-sm text-[var(--color-ink-400)] border border-dashed border-[var(--color-border)] rounded-xl">
      No {label} on record.
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   1. Previous Investigation Orders
══════════════════════════════════════════════════════════════════════════ */
type InvVisit = Awaited<ReturnType<typeof getPatientInvestigations>>[number];

type InvOrder = InvVisit["orders"][number];

/** What the signed-in role may see and change on investigation orders. */
export type InvPerms = { view: boolean; upload: boolean; remove: boolean; notes: boolean };
const ALL_INV_PERMS: InvPerms = { view: true, upload: true, remove: true, notes: true };

/** An investigation is frozen 2 months after it was ordered: no more changes. */
const INV_FREEZE_MONTHS = 2;

const INV_PRIORITY_CLS: Record<string, string> = {
  ROUTINE: "bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]",
  URGENT:  "bg-[var(--color-accent-100)] text-[var(--color-accent-600)]",
  STAT:    "bg-[var(--color-danger-100)] text-[var(--color-danger-600)]",
};

/** Read-only box for a value set when the test was ordered. */
function InvInfoBox({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-2.5 py-1.5 text-label leading-snug ${className}`}>
      {children}
    </div>
  );
}

function InvOrderRow({ o, udid, onView, perms }: {
  o: InvOrder; idx: number; udid: string; onView: (ref: string) => void; perms: InvPerms;
}) {
  const [localResultRef, setLocalResultRef] = useState(o.resultRef ?? null);
  const [localUploadedAt, setLocalUploadedAt] = useState<string | null>(o.uploadedAt ?? null);
  const [uploading, setUploading]           = useState(false);
  const [uploadError, setUploadError]       = useState("");
  const [removing, startRemove]             = useTransition();
  const [confirmRemove, setConfirmRemove]   = useState(false);
  const [, startTx]                         = useTransition();
  const fileRef                             = useRef<HTMLInputElement>(null);
  const addMoreRef                          = useRef<HTMLInputElement>(null);
  const [extraFiles, setExtraFiles]         = useState<ExtraResult[]>(() => parseExtraResults(o.extraResultRefs));

  const hasFile = !!localResultRef;
  const frozen = new Date() > addMonths(new Date(o.createdAt), INV_FREEZE_MONTHS);
  const canUpload = perms.upload && !frozen;
  const canRemove = perms.remove && !frozen;
  const canNote   = perms.notes && !frozen;

  // Doctor's notes save on their own shortly after typing stops
  const [doctorNotes, setDoctorNotes] = useState(o.doctorNotes ?? "");
  const savedNotes = useRef(o.doctorNotes ?? "");
  const latestNotes = useRef(doctorNotes);
  latestNotes.current = doctorNotes;
  useEffect(() => {
    if (!canNote || doctorNotes === savedNotes.current) return;
    const timer = setTimeout(() => {
      savedNotes.current = doctorNotes;
      void updateInvestigationDoctorNotes(o.id, udid, doctorNotes);
    }, 800);
    return () => clearTimeout(timer);
  }, [doctorNotes, canNote, o.id, udid]);
  useEffect(() => () => {
    if (canNote && latestNotes.current !== savedNotes.current) {
      void updateInvestigationDoctorNotes(o.id, udid, latestNotes.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function uploadFile(file: File) {
    setUploading(true); setUploadError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res  = await fetch("/api/uploads", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "Upload failed");
      setLocalResultRef(json.url);
      setLocalUploadedAt(new Date().toISOString());
      startTx(async () => {
        const r = await attachResult(o.id, udid, json.url);
        if (r?.error) setUploadError(r.error);
      });
    } catch (err: any) {
      setUploadError(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // "Add more": keep the current file and attach this one as well
  async function addMoreFile(file: File) {
    setUploading(true); setUploadError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res  = await fetch("/api/uploads", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "Upload failed");
      const r = await addExtraResult(o.id, udid, json.url);
      if (r?.error) setUploadError(r.error);
      else setExtraFiles((prev) => [...prev, { ref: json.url, at: new Date().toISOString() }]);
    } catch (err: any) {
      setUploadError(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (addMoreRef.current) addMoreRef.current.value = "";
    }
  }

  function removeExtraFile(ref: string) {
    startRemove(async () => {
      const r = await removeExtraResult(o.id, udid, ref);
      if (r?.error) setUploadError(r.error);
      else setExtraFiles((prev) => prev.filter((x) => x.ref !== ref));
    });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void uploadFile(file);
  }

  function doRemoveResult() {
    startRemove(async () => {
      const r = await removeResult(o.id, udid);
      if (r?.error) { setUploadError(r.error); setConfirmRemove(false); return; }
      const [next, ...rest] = extraFiles;
      setLocalResultRef(next ? next.ref : null);
      setLocalUploadedAt(next ? next.at : null);
      setExtraFiles(rest);
      setConfirmRemove(false);
    });
  }

  const inViewOf = o.notes ? o.notes.replace(/^[•·]\s*/gm, "").split(/\r?\n/).filter(Boolean).join(", ") : "";
  const btn = "flex items-center gap-1 text-caption font-medium px-2 py-1 rounded-lg border transition-colors disabled:opacity-50";

  const fileInput = <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.docx" className="hidden" onChange={handleFileChange} />;
  const lateralityBadge = (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--color-primary-300)] bg-[var(--color-primary-50)] text-caption font-bold text-[var(--color-primary-700)]">
      {o.laterality ?? ""}
    </span>
  );
  const nameBox = <InvInfoBox className="font-semibold text-[var(--color-ink-900)]">{o.testName}</InvInfoBox>;
  const inViewOfBox = (
    <InvInfoBox className="border-dashed italic text-[var(--color-ink-600)]">
      <span className="text-[var(--color-ink-400)]">In view of: </span>{inViewOf}
    </InvInfoBox>
  );
  const urgency = o.priority ? (
    <span className={`text-caption font-medium px-2 py-0.5 rounded-full ${INV_PRIORITY_CLS[o.priority] ?? INV_PRIORITY_CLS.ROUTINE}`}>{o.priority}</span>
  ) : null;
  const orderedAtLabel = (
    <span className="inline-flex items-center gap-1 text-caption text-[var(--color-ink-500)] whitespace-nowrap">
      <Clock size={10} />Ordered {format(new Date(o.createdAt), "dd MMM yyyy, h:mm a")}
    </span>
  );
  const frozenNote = frozen && (
    <p className="mt-2 flex items-center gap-1 text-caption text-[var(--color-ink-400)]">
      <Lock size={10} /> Frozen: ordered more than {INV_FREEZE_MONTHS} months ago, no changes can be made.
    </p>
  );
  const cardCls = "rounded-xl border border-[var(--color-border)] bg-white px-3 py-2.5";

  // Report not uploaded: one bar
  if (!hasFile) {
    return (
      <div className={cardCls}>
        <div className="flex flex-wrap items-center gap-2">
          {lateralityBadge}
          <div className="min-w-[8rem] flex-1">{nameBox}</div>
          <div className="min-w-[8rem] flex-1">{inViewOfBox}</div>
          {urgency}
          {orderedAtLabel}
          <div className="ml-auto shrink-0">
            {fileInput}
            {canUpload && (
              <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()}
                className={`${btn} border-dashed border-[var(--color-primary-400)] text-[var(--color-primary-600)] hover:bg-[var(--color-primary-50)]`}>
                <Upload size={12} className={uploading ? "animate-pulse" : ""} />
                {uploading ? "Uploading…" : "Upload"}
              </button>
            )}
          </div>
        </div>
        {uploadError && <p className="text-caption text-red-600 mt-1">{uploadError}</p>}
        {frozenNote}
      </div>
    );
  }

  // Report uploaded: details on top, uploaded file below
  const isImage = /\.(jpg|jpeg|png|webp)$/i.test(localResultRef!);
  const isPdf = /\.pdf$/i.test(localResultRef!);
  return (
    <div className={cardCls}>
      <div className="flex flex-wrap items-start gap-2 lg:flex-nowrap">
        {lateralityBadge}
        <div className="flex min-w-[8rem] flex-1 flex-col items-start gap-1.5">
          <div className="w-full">{nameBox}</div>
          {urgency}
        </div>
        <div className="flex min-w-[8rem] flex-1 flex-col items-start gap-1.5">
          <div className="w-full">{inViewOfBox}</div>
          {orderedAtLabel}
        </div>
        <div className="flex min-w-[12rem] flex-[2] flex-col items-start gap-1.5">
          <div className="w-full">
            {canNote ? (
              <KeywordInput
                fieldKey={`inv_doctor_notes:${o.testName}`}
                value={doctorNotes}
                onChange={setDoctorNotes}
                builtIns={INV_DOCTOR_NOTE_DEFAULTS[o.testName]}
                placeholder="Doctor's notes"
              />
            ) : (
              <InvInfoBox className="text-[var(--color-ink-700)] whitespace-pre-wrap">
                <span className="text-[var(--color-ink-400)]">Doctor&apos;s notes: </span>{doctorNotes}
              </InvInfoBox>
            )}
          </div>
          {localUploadedAt && (
            <span className="inline-flex items-center gap-1 text-caption text-[var(--color-ink-500)] whitespace-nowrap">
              <Clock size={10} />Uploaded {format(new Date(localUploadedAt), "dd MMM yyyy, h:mm a")}
            </span>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {fileInput}
          <button onClick={() => onView(localResultRef!)}
            className={`${btn} border-[var(--color-primary-300)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)] hover:bg-[var(--color-primary-100)]`}>
            <Eye size={12} /> View
          </button>
          {(canUpload || canRemove) && (
            <div className="flex items-center gap-1">
              {canUpload && (
                <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()}
                  className={`${btn} border-dashed border-[var(--color-primary-400)] text-[var(--color-primary-600)] hover:bg-[var(--color-primary-50)]`}>
                  <Upload size={12} className={uploading ? "animate-pulse" : ""} />
                  {uploading ? "Uploading…" : "Re-upload"}
                </button>
              )}
              {canUpload && (
                <>
                  <input ref={addMoreRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.docx" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) void addMoreFile(f); }} />
                  <button type="button" disabled={uploading} onClick={() => addMoreRef.current?.click()}
                    className={`${btn} border-dashed border-[var(--color-primary-400)] text-[var(--color-primary-600)] hover:bg-[var(--color-primary-50)]`}>
                    <Upload size={12} /> Add more
                  </button>
                </>
              )}
              {canRemove && (confirmRemove ? (
                <>
                  <button onClick={doRemoveResult} disabled={removing}
                    className="text-caption font-semibold px-2 py-1 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors">
                    {removing ? "…" : "Remove"}
                  </button>
                  <button onClick={() => setConfirmRemove(false)}
                    className="text-caption font-semibold px-2 py-1 rounded-lg border border-[var(--color-border)] text-[var(--color-ink-500)] hover:bg-[var(--color-surface-sunken)] transition-colors">
                    Cancel
                  </button>
                </>
              ) : (
                <button onClick={() => setConfirmRemove(true)}
                  className={`${btn} border-[var(--color-border)] text-[var(--color-ink-400)] hover:border-red-300 hover:text-red-600 hover:bg-red-50`}>
                  <Trash2 size={12} /> Delete
                </button>
              ))}
            </div>
          )}
          {uploadError && <p className="text-caption text-red-600">{uploadError}</p>}
        </div>
      </div>

      {/* Uploaded file(s) */}
      <div className="mt-3 flex flex-wrap items-start gap-3 rounded-xl border border-[var(--color-border)] p-2">
        {isImage ? (
          <img
            src={fileHref(localResultRef)!}
            alt={`${o.testName} result`}
            className="max-h-52 rounded-lg cursor-pointer object-contain"
            onClick={() => onView(localResultRef!)}
          />
        ) : isPdf ? (
          <div className="relative h-52 w-40 overflow-hidden rounded-lg border border-[var(--color-border)]">
            <iframe src={`${fileHref(localResultRef)!}#toolbar=0&navpanes=0`} title={`${o.testName} result`} className="h-full w-full pointer-events-none" />
            <button type="button" onClick={() => onView(localResultRef!)} aria-label="View report" className="absolute inset-0 cursor-pointer" />
          </div>
        ) : (
          <button
            onClick={() => onView(localResultRef!)}
            className="flex items-center gap-2 text-xs text-[var(--color-primary-700)] bg-[var(--color-primary-50)] border border-[var(--color-primary-200)] px-3 py-2 rounded-lg hover:bg-[var(--color-primary-100)] transition-colors"
          >
            <Paperclip size={13} /> {o.testName} result file, click to view
          </button>
        )}
        {extraFiles.map((file) => (
          <ExtraResultPreview
            key={file.ref}
            file={file}
            label={`${o.testName} result`}
            onOpen={() => onView(file.ref)}
            onRemove={canRemove ? () => removeExtraFile(file.ref) : undefined}
          />
        ))}
      </div>
      {frozenNote}
    </div>
  );
}

function InvestigationsDrawer({
  patientId, udid, open, onClose, perms,
}: {
  patientId: string; udid: string; open: boolean; onClose: () => void; perms: InvPerms;
}) {
  const [data, setData] = useState<InvVisit[] | null>(null);
  const [isPending, start] = useTransition();
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (!open || data !== null || isPending) return;
    start(async () => setData(await getPatientInvestigations(patientId)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, data]);

  return (
    <>
      <Drawer open={open} onClose={onClose} title="Previous Investigation Orders" icon={<FlaskConical size={16} />} xwide>
        {isPending && (
          <div className="flex justify-center py-10">
            <Loader2 size={22} className="animate-spin text-[var(--color-primary-500)]" />
          </div>
        )}
        {!isPending && data?.length === 0 && <Empty label="investigation orders" />}
        {!isPending && data && data.map((v) => (
          <div key={v.visitId}>
            {/* Visit date header */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-caption font-semibold text-[var(--color-ink-700)]">
                {format(new Date(v.date), "dd MMM yyyy")}
              </span>
              {v.hospitalName && (
                <span className="text-caption text-[var(--color-ink-400)]">· {v.hospitalName}</span>
              )}
              <div className="flex-1 h-px bg-[var(--color-border)]" />
            </div>

            {/* Orders */}
            <div className="space-y-2">
              {v.orders.map((o, idx) => (
                <InvOrderRow
                  key={o.id}
                  o={o}
                  idx={idx}
                  udid={udid}
                  onView={(ref) => setLightbox(ref)}
                  perms={perms}
                />
              ))}
            </div>
          </div>
        ))}
      </Drawer>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80" onClick={() => setLightbox(null)}>
          {lightbox.match(/\.(jpg|jpeg|png|webp)$/i)
            ? <img src={fileHref(lightbox)!} alt="Result" className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
            : <iframe src={fileHref(lightbox)!} className="w-full max-w-3xl h-[80vh] rounded-xl bg-white" title="Result" onClick={(e) => e.stopPropagation()} />
          }
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 text-white p-2.5 rounded-xl">
            <X size={18} />
          </button>
        </div>
      )}
    </>
  );
}

export function InvestigationsButton({ patientId, udid, perms = ALL_INV_PERMS }: { patientId: string; udid: string; perms?: InvPerms }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] transition-colors"
      >
        <FlaskConical size={13} />
        Investigation Orders
      </button>
      <InvestigationsDrawer patientId={patientId} udid={udid} open={open} onClose={() => setOpen(false)} perms={perms} />
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   2. Treatment History
══════════════════════════════════════════════════════════════════════════ */
type TreatVisit = Awaited<ReturnType<typeof getPatientTreatmentHistory>>[number];

function TreatmentDrawer({
  patientId,
  open,
  onClose,
}: {
  patientId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [data, setData] = useState<TreatVisit[] | null>(null);
  const [isPending, start] = useTransition();

  useEffect(() => {
    if (!open || data !== null || isPending) return;
    start(async () => {
      const res = await getPatientTreatmentHistory(patientId);
      setData(res);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, data]);

  return (
    <Drawer open={open} onClose={onClose} title="Treatment History" icon={<Pill size={16} />} wide>
      {isPending && (
        <div className="flex justify-center py-10">
          <Loader2 size={22} className="animate-spin text-[var(--color-primary-500)]" />
        </div>
      )}
      {!isPending && data?.length === 0 && <Empty label="treatment records" />}
      {!isPending && data && data.map((v) => (
        <VisitGroup key={v.visitId} date={v.date} hospitalName={v.hospitalName}>
          {v.diagnoses.length > 0 && (
            <div className="mb-2">
              <p className="text-caption font-semibold uppercase tracking-wider text-[var(--color-ink-400)] mb-1.5">Diagnoses</p>
              <div className="flex flex-col gap-1">
                {v.diagnoses.map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <p className="clinical-diagnosis-text text-xs flex-1 min-w-0">
                      <span className="font-mono text-caption text-[var(--color-ink-400)] mr-1">{d.icd10Code}</span>
                      {d.status && d.status !== "BLANK" && <span className="text-[var(--color-ink-400)] font-normal mr-1">{d.status.charAt(0) + d.status.slice(1).toLowerCase()} ·</span>}
                      {d.laterality && <span className="clinical-laterality mr-1">{d.laterality}</span>}
                      {d.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {v.medications.length > 0 && (
            <div>
              <p className="text-caption font-semibold uppercase tracking-wider text-[var(--color-ink-400)] mb-1.5">Medications</p>
              <div className="flex flex-col gap-1.5">
                {v.medications.map((m, idx) => (
                  <div key={m.id} className="rounded-lg bg-[var(--color-surface-sunken)] px-3 py-2 flex items-start gap-2.5">
                    {/* Number */}
                    <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-[var(--color-primary-100)] text-[var(--color-primary-700)] text-caption font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        {/* Laterality badge */}
                        {medicationLaterality(m) && (
                          <span className="text-micro font-bold px-1.5 py-0.5 rounded-full bg-[var(--color-primary-600)] text-white shrink-0">
                            {medicationLaterality(m)}
                          </span>
                        )}
                        <p className="text-xs font-semibold text-[var(--color-ink-800)]">{m.drugName}</p>
                      </div>
                      <p className="text-caption text-[var(--color-ink-500)]">
                        {[m.dosage, m.frequency, m.duration].filter(Boolean).join(" · ")}
                      </p>
                      {m.instructions && (
                        <p className="text-caption text-[var(--color-ink-400)] mt-0.5 italic">{m.instructions}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </VisitGroup>
      ))}
    </Drawer>
  );
}

export function TreatmentHistoryButton({ patientId }: { patientId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] transition-colors"
      >
        <Pill size={13} />
        Treatment History
      </button>
      <TreatmentDrawer patientId={patientId} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   3. Previous Spectacle History
══════════════════════════════════════════════════════════════════════════ */
type SpectVisit = Awaited<ReturnType<typeof getPatientSpectacleHistory>>[number];

type RxFields = { sph: string; cyl: string; axis: string; nearSph: string; va: string; nearVa: string; method: string };
const emptyRx: RxFields = { sph: "", cyl: "", axis: "", nearSph: "", va: "", nearVa: "", method: "" };

function parseSignedVal(v: string): { sign: "+" | "-"; mag: string } {
  if (!v || v === "+") return { sign: "+", mag: "" };
  if (v === "-") return { sign: "-", mag: "" };
  return v.startsWith("-") ? { sign: "-", mag: v.slice(1) } : { sign: "+", mag: v.replace(/^\+/, "") };
}

const SPECT_LS_KEY = (udid: string) => `spect_pin_${udid}`;

function SpectEyeTable({ re, le }: { re: RxFields; le: RxFields }) {
  const fmt = (v: string) => { const { sign, mag } = parseSignedVal(v); return mag ? `${sign}${mag}` : ""; };
  const cell = (v: string) => (
    <td className="px-2 py-1 text-center text-caption font-semibold tabular-nums text-[var(--color-ink-800)]">{v || <span className="text-[var(--color-ink-300)]">—</span>}</td>
  );
  const cellGrey = (v: string) => (
    <td className="px-2 py-1 text-center text-caption font-semibold tabular-nums text-[var(--color-ink-800)] bg-[var(--color-surface-sunken)]">{v || <span className="text-[var(--color-ink-300)]">—</span>}</td>
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-caption">
        <thead>
          <tr className="bg-[var(--color-surface-sunken)]">
            <th className="px-2 py-1 text-left font-semibold text-[var(--color-ink-500)] w-[90px]"></th>
            <th className="px-2 py-1 text-center font-semibold text-[var(--color-ink-500)]">Sph</th>
            <th className="px-2 py-1 text-center font-semibold text-[var(--color-ink-500)]">Cyl</th>
            <th className="px-2 py-1 text-center font-semibold text-[var(--color-ink-500)]">Axis°</th>
            <th className="px-2 py-1 text-center font-semibold text-[var(--color-ink-500)] bg-[var(--color-surface-sunken)]">VA</th>
            <th className="px-2 py-1 text-center font-semibold text-[var(--color-ink-500)]">Add</th>
            <th className="px-2 py-1 text-center font-semibold text-[var(--color-ink-500)] bg-[var(--color-surface-sunken)]">NV</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-[var(--color-border)]">
            <td className="px-2 py-1 font-semibold text-[var(--color-primary-700)]">Right Eye</td>
            {cell(fmt(re.sph))}
            {cell(fmt(re.cyl))}
            {cell(parseSignedVal(re.axis).mag)}
            {cellGrey(re.va)}
            {cell(fmt(re.nearSph))}
            {cellGrey(re.nearVa)}
          </tr>
          <tr className="border-t border-[var(--color-border)] bg-[var(--color-surface-sunken)]/40">
            <td className="px-2 py-1 font-semibold text-[var(--color-primary-700)]">Left Eye</td>
            {cell(fmt(le.sph))}
            {cell(fmt(le.cyl))}
            {cell(parseSignedVal(le.axis).mag)}
            {cellGrey(le.va)}
            {cell(fmt(le.nearSph))}
            {cellGrey(le.nearVa)}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function SpectacleDrawer({
  patientId,
  udid,
  open,
  onClose,
}: {
  patientId: string;
  udid: string;
  open: boolean;
  onClose: () => void;
}) {
  const [data, setData] = useState<SpectVisit[] | null>(null);
  const [isPending, start] = useTransition();
  const [pinned, setPinned] = useState<string | null>(null);

  // Load data and initialise pin from localStorage
  useEffect(() => {
    if (!open || data !== null || isPending) return;
    start(async () => {
      const res = await getPatientSpectacleHistory(patientId);
      setData(res);
      const stored = typeof window !== "undefined" ? localStorage.getItem(SPECT_LS_KEY(udid)) : null;
      // Only restore an explicit user selection — never auto-pin
      setPinned(stored ?? null);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, data]);

  const togglePin = (visitId: string) => {
    const next = pinned === visitId ? null : visitId;
    setPinned(next);
    if (next) localStorage.setItem(SPECT_LS_KEY(udid), next);
    else localStorage.removeItem(SPECT_LS_KEY(udid));
  };

  return (
    <Drawer open={open} onClose={onClose} title="Previous Spectacle History" icon={<Glasses size={16} />}>
      {!isPending && data && data.length > 0 && (
        <p className="text-caption text-[var(--color-ink-400)] mb-3">
          Check a prescription to include it in the short summary.
        </p>
      )}
      {isPending && (
        <div className="flex justify-center py-10">
          <Loader2 size={22} className="animate-spin text-[var(--color-primary-500)]" />
        </div>
      )}
      {!isPending && data?.length === 0 && <Empty label="spectacle prescriptions" />}
      {!isPending && data && data.map((v) => {
        const re = parseJSON<RxFields>(v.re, emptyRx);
        const le = parseJSON<RxFields>(v.le, emptyRx);
        const isSelected = pinned === v.visitId;
        return (
          <div
            key={v.visitId}
            className={`rounded-xl border transition-colors ${isSelected ? "border-[var(--color-primary-400)] bg-[var(--color-primary-50)]/60" : "border-[var(--color-border)] bg-white"}`}
          >
            {/* Header row with checkbox */}
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-2 min-w-0 flex-nowrap whitespace-nowrap">
                <span className="shrink-0 text-caption font-bold text-[var(--color-ink-800)]">
                  {format(new Date(v.date), "EEE, dd MMM yyyy")}
                </span>
                {v.finalizedAt && (
                  <span className="shrink-0 text-micro text-[var(--color-ink-400)] font-medium">
                    {format(new Date(v.finalizedAt), "h:mm a")}
                  </span>
                )}
                {v.hospitalName && (
                  <span className="min-w-0 text-caption text-[var(--color-ink-400)] truncate" title={v.hospitalName}>{v.hospitalName}</span>
                )}
                {v.refractionByName && (
                  <span className="min-w-0 truncate text-micro text-emerald-700 font-medium" title={`Refraction by ${v.refractionByName}`}>· Refraction by {v.refractionByName}</span>
                )}
              </div>
            </div>

            {/* Refraction table */}
            <div className="p-3">
              <SpectEyeTable re={re} le={le} />
              {v.sentToOpticals && (
                <p className="text-caption text-emerald-600 font-semibold mt-2">✓ Sent to Opticals</p>
              )}
            </div>
          </div>
        );
      })}
    </Drawer>
  );
}

export function SpectacleHistoryButton({ patientId, udid }: { patientId: string; udid: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] transition-colors"
      >
        <Glasses size={13} />
        Spectacle History
      </button>
      <SpectacleDrawer patientId={patientId} udid={udid} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   4. No Show Registry
══════════════════════════════════════════════════════════════════════════ */
type NoShowEntry = Awaited<ReturnType<typeof getPatientNoShows>>[number];

function NoShowRegistryDrawer({
  patientId,
  open,
  onClose,
}: {
  patientId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [data, setData] = useState<NoShowEntry[] | null>(null);
  const [isPending, start] = useTransition();

  useEffect(() => {
    if (!open || data !== null || isPending) return;
    start(async () => setData(await getPatientNoShows(patientId)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, data]);

  return (
    <Drawer open={open} onClose={onClose} title="No Show Registry" icon={<UserX size={16} />} mid>
      {isPending && (
        <div className="flex justify-center py-10">
          <Loader2 size={22} className="animate-spin text-[var(--color-primary-500)]" />
        </div>
      )}
      {!isPending && data?.length === 0 && <Empty label="no-show records" />}
      {!isPending && data && data.length > 0 && (
        <div className="space-y-3">
          <p className="text-caption text-[var(--color-ink-400)]">
            {data.length} no-show record{data.length !== 1 ? "s" : ""} · newest first
          </p>
          {data.map((entry, idx) => (
            <div
              key={entry.id}
              className={`rounded-lg border px-3 py-2 ${idx === 0 ? "border-red-200 bg-red-50/50" : "border-[var(--color-border)] bg-white"}`}
            >
              {/* Line 1: count · date · hospital · visitType · Latest */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-micro font-bold shrink-0 ${idx === 0 ? "bg-red-500 text-white" : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]"}`}>
                  {data.length - idx}
                </span>
                <span className={`text-sm font-bold ${idx === 0 ? "text-red-700" : "text-[var(--color-ink-800)]"}`}>
                  {format(new Date(entry.dateTime), "dd MMM yyyy")}
                </span>
                {entry.hospitalName && (
                  <>
                    <span className="text-[var(--color-ink-300)] text-caption">·</span>
                    <span className="text-caption text-[var(--color-ink-500)]">{entry.hospitalName}</span>
                  </>
                )}
                {entry.visitType && (
                  <>
                    <span className="text-[var(--color-ink-300)] text-caption">·</span>
                    <span className="text-caption text-[var(--color-ink-500)]">{entry.visitType}</span>
                  </>
                )}
                <span className="text-caption font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                  {NO_SHOW_KIND_LABEL[entry.kind]}
                </span>
                {idx === 0 && (
                  <span className="text-caption font-semibold px-2 py-0.5 rounded-full bg-red-500 text-white shrink-0">
                    Latest
                  </span>
                )}
              </div>
              {/* Line 2: time */}
              <div className="pl-7 mt-0.5">
                <span className="text-caption text-[var(--color-ink-400)]">
                  {format(new Date(entry.dateTime), "h:mm a")}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Drawer>
  );
}

export function PatientActionsPanel({
  patientId,
  patientName,
  udid,
  totalVisits,
  firstVisitDate,
  lastVisitDate,
  noShowCount,
  layout = "row",
  invPerms = ALL_INV_PERMS,
  canViewTreatment = true,
  canViewSpectacles = true,
}: {
  patientId: string;
  patientName: string;
  udid: string;
  totalVisits: number;
  firstVisitDate?: string | null;
  lastVisitDate?: string | null;
  noShowCount: number;
  layout?: "row" | "column";
  invPerms?: InvPerms;
  /** emr.medications.view / refraction.view — hide those history buttons when off. */
  canViewTreatment?: boolean;
  canViewSpectacles?: boolean;
}) {
  const [showActions, setShowActions] = useState(true);
  const [noShowOpen, setNoShowOpen] = useState(false);
  return (
    <>
      <NoShowRegistryDrawer patientId={patientId} open={noShowOpen} onClose={() => setNoShowOpen(false)} />
      {/* Total Visits card — hamburger icon is the toggle */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowActions((v) => !v)}
              aria-label="Toggle action buttons"
              className="rounded-2xl bg-[var(--color-primary-50)] p-3 hover:bg-[var(--color-primary-100)] transition-colors"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className="text-[var(--color-primary-600)]">
                <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
              </svg>
            </button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">Total Visits</p>
              <p className="text-3xl font-bold text-[var(--color-primary-700)] mt-0.5">{totalVisits}</p>
            </div>
          </div>

          <div className="text-right text-xs text-[var(--color-ink-500)] space-y-1.5">
            {firstVisitDate ? (
              <p>
                <span className="text-[var(--color-ink-400)]">First </span>
                <span className="font-semibold text-[var(--color-ink-700)]">
                  {format(new Date(firstVisitDate), "dd MMM yyyy")}
                </span>
              </p>
            ) : (
              <p className="text-[var(--color-ink-300)]">No visits yet</p>
            )}
            {lastVisitDate && totalVisits > 1 && (
              <p>
                <span className="text-[var(--color-ink-400)]">Last </span>
                <span className="font-semibold text-[var(--color-ink-700)]">
                  {format(new Date(lastVisitDate), "dd MMM yyyy")}
                </span>
              </p>
            )}
            {noShowCount > 0 && (
              <button
                onClick={() => setNoShowOpen(true)}
                className="flex items-center justify-end gap-1 text-red-500 hover:text-red-700 transition-colors group"
                title="View No Show Registry"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" y1="8" x2="23" y2="14"/><line x1="23" y1="8" x2="17" y2="14"/></svg>
                <span className="font-semibold">{noShowCount}</span>
                <span className="text-red-400 group-hover:text-red-600 group-hover:underline underline-offset-2">No Show{noShowCount > 1 ? "s" : ""}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons — toggled by the hamburger icon above */}
      {showActions && (
        <div className={`grid gap-2 ${layout === "column" ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
          <TimeStampButton patientId={patientId} patientName={patientName} />
          {invPerms.view && <InvestigationsButton patientId={patientId} udid={udid} perms={invPerms} />}
          {canViewTreatment && <TreatmentHistoryButton patientId={patientId} />}
          {canViewSpectacles && <SpectacleHistoryButton patientId={patientId} udid={udid} />}
        </div>
      )}
    </>
  );
}
