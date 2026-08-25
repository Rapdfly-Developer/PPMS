"use client";

import { useState, useTransition, useRef } from "react";
import { format } from "date-fns";
import { X, FlaskConical, Pill, Glasses, Loader2, ChevronDown, ChevronUp, Upload, Camera, Eye, AlignJustify } from "lucide-react";
import { parseJSON } from "@/lib/json";
import {
  getPatientInvestigations,
  getPatientTreatmentHistory,
  getPatientSpectacleHistory,
} from "../actions";
import { attachResult } from "@/app/(app)/emr/[udid]/actions";
import { TimeStampButton } from "./PatientTimeline";

/* ── Shared drawer shell ──────────────────────────────────────────────────── */
function Drawer({
  open,
  onClose,
  title,
  icon,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`bg-white w-full sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] rounded-t-2xl ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"}`}>
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
            <span className="ml-2 text-[10px] text-[var(--color-ink-400)]">{hospitalName}</span>
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

function InvUploadButton({ orderId, udid }: { orderId: string; udid: string }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [, startTx] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef  = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res  = await fetch("/api/uploads", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "Upload failed");
      startTx(async () => {
        const r = await attachResult(orderId, udid, json.url);
        if (r?.error) setError(r.error);
      });
    } catch (err: any) {
      setError(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      if (camRef.current)  camRef.current.value  = "";
    }
  };

  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.docx" className="hidden" onChange={handleFile} />
      <input ref={camRef}  type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
      <div className="flex items-center gap-1">
        <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1 text-[11px] font-medium px-2 py-1.5 rounded-lg border border-dashed border-[var(--color-primary-400)] text-[var(--color-primary-600)] hover:bg-[var(--color-primary-50)] disabled:opacity-50 transition-colors">
          {uploading ? <Upload size={12} className="animate-pulse" /> : <Upload size={12} />}
          {uploading ? "Uploading…" : "Add File"}
        </button>
        <button type="button" disabled={uploading} onClick={() => camRef.current?.click()}
          className="flex items-center gap-1 text-[11px] font-medium px-2 py-1.5 rounded-lg border border-dashed border-amber-400 text-amber-600 hover:bg-amber-50 disabled:opacity-50 transition-colors">
          <Camera size={12} /> Camera
        </button>
      </div>
      {error && <p className="text-[10px] text-red-600">{error}</p>}
    </div>
  );
}

function InvestigationsDrawer({
  patientId, udid, open, onClose,
}: {
  patientId: string; udid: string; open: boolean; onClose: () => void;
}) {
  const [data, setData] = useState<InvVisit[] | null>(null);
  const [isPending, start] = useTransition();
  const [lightbox, setLightbox] = useState<string | null>(null);

  if (open && data === null && !isPending) {
    start(async () => setData(await getPatientInvestigations(patientId)));
  }

  const catPalette = (category: string) => {
    const k = (category ?? "").toLowerCase();
    if (k.includes("imag"))  return { dot: "bg-violet-100", icon: "text-violet-600", badge: "bg-violet-100 text-violet-700" };
    if (k.includes("lab") || k.includes("pre-op")) return { dot: "bg-cyan-100", icon: "text-cyan-600", badge: "bg-cyan-100 text-cyan-700" };
    if (k.includes("path"))  return { dot: "bg-rose-100",   icon: "text-rose-600",   badge: "bg-rose-100 text-rose-700"   };
    if (k.includes("proc"))  return { dot: "bg-amber-100",  icon: "text-amber-600",  badge: "bg-amber-100 text-amber-700" };
    return { dot: "bg-teal-100", icon: "text-teal-600", badge: "bg-teal-100 text-teal-700" };
  };

  return (
    <>
      <Drawer open={open} onClose={onClose} title="Previous Investigation Orders" icon={<FlaskConical size={16} />}>
        {isPending && (
          <div className="flex justify-center py-10">
            <Loader2 size={22} className="animate-spin text-[var(--color-primary-500)]" />
          </div>
        )}
        {!isPending && data?.length === 0 && <Empty label="investigation orders" />}
        {!isPending && data && data.map((v) => (
          <div key={v.visitId} className="flex flex-col gap-1">
            {/* Visit date header */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-semibold text-[var(--color-ink-400)]">
                {format(new Date(v.date), "dd MMM yyyy")}
              </span>
              {v.hospitalName && <span className="text-[10px] text-[var(--color-ink-300)]">· {v.hospitalName}</span>}
              <div className="flex-1 h-px bg-[var(--color-border)]" />
            </div>
            {/* Orders timeline — show only the most recent order per date */}
            <ul className="space-y-0">
              {v.orders.slice(-1).map((o, idx) => {
                const p = catPalette(o.category);
                const isLast = true;
                return (
                  <li key={o.id} className="flex gap-3">
                    <div className="flex flex-col items-center shrink-0">
                      <div className={`w-8 h-8 rounded-full ${p.dot} flex items-center justify-center z-10`}>
                        <FlaskConical size={13} className={p.icon} />
                      </div>
                      {!isLast && <div className="w-0.5 flex-1 my-1 bg-slate-100" />}
                    </div>
                    <div className={`flex-1 min-w-0 bg-slate-50 rounded-xl border border-slate-100 px-3 py-2.5 flex items-center gap-3 ${isLast ? "mb-0" : "mb-2"}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${p.badge}`}>
                            {o.category || "Test"}
                          </span>
                          <p className="text-sm font-semibold text-[var(--color-ink-800)]">{o.testName}</p>
                        </div>
                        <p className="text-[11px] text-[var(--color-ink-400)] mt-0.5">
                          {[o.laterality, o.priority, o.status.replace(/_/g, " ")].filter(Boolean).join(" · ")}
                          {o.notes && <span className="italic"> · {o.notes}</span>}
                        </p>
                      </div>
                      <p className="shrink-0 text-[10px] text-[var(--color-ink-400)]">
                        {format(new Date(o.createdAt), "h:mm a")}
                      </p>
                      {o.resultRef ? (
                        <button
                          onClick={() => setLightbox(o.resultRef)}
                          className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors"
                        >
                          <Eye size={12} /> View
                        </button>
                      ) : (
                        <InvUploadButton orderId={o.id} udid={udid} />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </Drawer>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80" onClick={() => setLightbox(null)}>
          {lightbox.match(/\.(jpg|jpeg|png|webp)$/i)
            ? <img src={lightbox} alt="Result" className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
            : <iframe src={lightbox} className="w-full max-w-3xl h-[80vh] rounded-xl bg-white" title="Result" onClick={(e) => e.stopPropagation()} />
          }
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 text-white p-2.5 rounded-xl">
            <X size={18} />
          </button>
        </div>
      )}
    </>
  );
}

export function InvestigationsButton({ patientId, udid }: { patientId: string; udid: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] transition-colors"
      >
        <FlaskConical size={13} />
        Investigation Orders
      </button>
      <InvestigationsDrawer patientId={patientId} udid={udid} open={open} onClose={() => setOpen(false)} />
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

  if (open && data === null && !isPending) {
    start(async () => {
      const res = await getPatientTreatmentHistory(patientId);
      setData(res);
    });
  }

  const DIAG_STATUS: Record<string, string> = {
    ACTIVE: "bg-red-100 text-red-700",
    CHRONIC: "bg-amber-100 text-amber-700",
    RESOLVED: "bg-emerald-100 text-emerald-700",
  };

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
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)] mb-1.5">Diagnoses</p>
              <div className="flex flex-col gap-1">
                {v.diagnoses.map((d, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <p className="text-xs text-[var(--color-ink-800)] flex-1 min-w-0">
                      <span className="font-mono text-[10px] text-[var(--color-ink-400)] mr-1">{d.icd10Code}</span>
                      {d.description}
                      {d.laterality && <span className="text-[var(--color-ink-400)]"> · {d.laterality}</span>}
                    </p>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${DIAG_STATUS[d.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {d.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {v.medications.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)] mb-1.5">Medications</p>
              <div className="flex flex-col gap-1.5">
                {v.medications.map((m, idx) => (
                  <div key={m.id} className="rounded-lg bg-[var(--color-surface-sunken)] px-3 py-2 flex items-start gap-2.5">
                    {/* Number */}
                    <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-[var(--color-primary-100)] text-[var(--color-primary-700)] text-[10px] font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        {/* Laterality badge */}
                        {m.laterality && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--color-primary-600)] text-white shrink-0">
                            {m.laterality}
                          </span>
                        )}
                        <p className="text-xs font-semibold text-[var(--color-ink-800)]">{m.drugName}</p>
                      </div>
                      <p className="text-[10px] text-[var(--color-ink-500)]">
                        {[m.dosage, m.frequency, m.duration].filter(Boolean).join(" · ")}
                      </p>
                      {m.instructions && (
                        <p className="text-[10px] text-[var(--color-ink-400)] mt-0.5 italic">{m.instructions}</p>
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
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] transition-colors"
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
    <td className="px-2 py-1 text-center text-[11px] font-semibold tabular-nums text-[var(--color-ink-800)]">{v || <span className="text-[var(--color-ink-300)]">—</span>}</td>
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr className="bg-[var(--color-surface-sunken)]">
            <th className="px-2 py-1 text-left font-semibold text-[var(--color-ink-500)] w-[90px]"></th>
            <th className="px-2 py-1 text-center font-semibold text-[var(--color-ink-500)]">Sph</th>
            <th className="px-2 py-1 text-center font-semibold text-[var(--color-ink-500)]">Cyl</th>
            <th className="px-2 py-1 text-center font-semibold text-[var(--color-ink-500)]">Axis°</th>
            <th className="px-2 py-1 text-center font-semibold text-[var(--color-ink-500)]">VA</th>
            <th className="px-2 py-1 text-center font-semibold text-[var(--color-ink-500)]">Add</th>
            <th className="px-2 py-1 text-center font-semibold text-[var(--color-ink-500)]">NV</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-[var(--color-border)]">
            <td className="px-2 py-1 font-semibold text-[var(--color-primary-700)]">Right Eye</td>
            {cell(fmt(re.sph))}
            {cell(fmt(re.cyl))}
            {cell(parseSignedVal(re.axis).mag)}
            {cell(re.va)}
            {cell(fmt(re.nearSph))}
            {cell(re.nearVa)}
          </tr>
          <tr className="border-t border-[var(--color-border)] bg-[var(--color-surface-sunken)]/40">
            <td className="px-2 py-1 font-semibold text-[var(--color-primary-700)]">Left Eye</td>
            {cell(fmt(le.sph))}
            {cell(fmt(le.cyl))}
            {cell(parseSignedVal(le.axis).mag)}
            {cell(le.va)}
            {cell(fmt(le.nearSph))}
            {cell(le.nearVa)}
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
  if (open && data === null && !isPending) {
    start(async () => {
      const res = await getPatientSpectacleHistory(patientId);
      setData(res);
      const stored = typeof window !== "undefined" ? localStorage.getItem(SPECT_LS_KEY(udid)) : null;
      // Only restore an explicit user selection — never auto-pin
      setPinned(stored ?? null);
    });
  }

  const togglePin = (visitId: string) => {
    const next = pinned === visitId ? null : visitId;
    setPinned(next);
    if (next) localStorage.setItem(SPECT_LS_KEY(udid), next);
    else localStorage.removeItem(SPECT_LS_KEY(udid));
  };

  return (
    <Drawer open={open} onClose={onClose} title="Previous Spectacle History" icon={<Glasses size={16} />}>
      {!isPending && data && data.length > 0 && (
        <p className="text-[10px] text-[var(--color-ink-400)] mb-3">
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
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[11px] font-bold text-[var(--color-ink-800)]">
                  {format(new Date(v.date), "dd MMM yyyy")}
                </span>
                {v.hospitalName && (
                  <span className="text-[10px] text-[var(--color-ink-400)] truncate">{v.hospitalName}</span>
                )}
                {re.method && (
                  <span className="text-[9px] bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)] px-1.5 py-0.5 rounded-full border border-[var(--color-border)]">
                    {re.method}
                  </span>
                )}
              </div>
            </div>

            {/* Refraction table */}
            <div className="p-3">
              <SpectEyeTable re={re} le={le} />
              {v.sentToOpticals && (
                <p className="text-[10px] text-emerald-600 font-semibold mt-2">✓ Sent to Opticals</p>
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
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] transition-colors"
      >
        <Glasses size={13} />
        Spectacle History
      </button>
      <SpectacleDrawer patientId={patientId} udid={udid} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function PatientActionsPanel({
  patientId,
  patientName,
  udid,
}: {
  patientId: string;
  patientName: string;
  udid: string;
}) {
  const [showActions, setShowActions] = useState(true);
  return (
    <div className="mb-4">
      <button
        onClick={() => setShowActions((v) => !v)}
        className="flex items-center justify-center w-9 h-9 rounded-lg bg-teal-500 hover:bg-teal-600 text-white transition-colors mb-2"
        aria-label="Toggle action buttons"
      >
        <AlignJustify size={18} />
      </button>
      {showActions && (
        <div className="flex flex-wrap items-center gap-2">
          <TimeStampButton patientId={patientId} patientName={patientName} />
          <InvestigationsButton patientId={patientId} udid={udid} />
          <TreatmentHistoryButton patientId={patientId} />
          <SpectacleHistoryButton patientId={patientId} udid={udid} />
        </div>
      )}
    </div>
  );
}
