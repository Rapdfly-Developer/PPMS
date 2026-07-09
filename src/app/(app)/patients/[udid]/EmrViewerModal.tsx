"use client";

import { useState, useTransition, useRef } from "react";
import { X, FileText, Building2, Stethoscope, Calendar, Loader2, Paperclip, Camera, Printer, Download, CheckCircle2 } from "lucide-react";
import { attachResult } from "@/app/(app)/emr/[udid]/actions";
import { format } from "date-fns";
import { getVisitEmrData } from "./emr-viewer-action";

function Section({ title, badge, children }: { title: string; badge?: number; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2 pb-1 border-b border-[var(--color-border)]">
        <p className="text-[10px] font-semibold tracking-widest text-[var(--color-ink-400)] uppercase">
          {title}
        </p>
        {badge !== undefined && badge > 0 && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600">
            {badge} result pending
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 text-sm py-1">
      <span className="text-[var(--color-ink-400)] text-xs">{label}</span>
      <span className="text-[var(--color-ink-800)]">{value}</span>
    </div>
  );
}

function parseJ(val: any) {
  if (!val) return null;
  try { return typeof val === "string" ? JSON.parse(val) : val; } catch { return null; }
}

function EyeRow({ label, re, le }: { label: string; re?: string | null; le?: string | null }) {
  if (!re && !le) return null;
  return (
    <div className="grid grid-cols-[140px_1fr_1fr] gap-2 text-sm py-1">
      <span className="text-[var(--color-ink-400)] text-xs">{label}</span>
      <span className="text-[var(--color-ink-700)]">{re || "-"}</span>
      <span className="text-[var(--color-ink-700)]">{le || "-"}</span>
    </div>
  );
}

function InvUploadButton({ orderId, udid, onDone }: { orderId: string; udid: string; onDone: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "Upload failed");
      startTransition(async () => {
        const result = await attachResult(orderId, udid, json.url);
        if (result?.error) setError(result.error);
        else onDone(json.url);
      });
    } catch (err: any) {
      setError(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  };

  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleFile} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
      <span className="inline-flex items-center gap-1">
        <button
          type="button"
          title="Upload result file"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="p-1 rounded text-[var(--color-ink-400)] hover:text-[var(--color-primary-600)] hover:bg-[var(--color-primary-50)] disabled:opacity-40 transition-colors"
        >
          {uploading ? <Loader2 size={13} className="animate-spin" /> : <Paperclip size={13} />}
        </button>
        <button
          type="button"
          title="Capture from camera"
          disabled={uploading}
          onClick={() => cameraRef.current?.click()}
          className="p-1 rounded text-[var(--color-ink-400)] hover:text-[var(--color-accent-600)] hover:bg-[var(--color-accent-50)] disabled:opacity-40 transition-colors"
        >
          <Camera size={13} />
        </button>
      </span>
      {error && <span className="text-[10px] text-red-500">{error}</span>}
    </span>
  );
}

function EmrContent({ visit, udid, localResults, onAttach }: {
  visit: any;
  udid: string;
  localResults: Record<string, string>;
  onAttach: (orderId: string, url: string) => void;
}) {
  const ge  = visit.generalExam;
  const va  = visit.visualAcuity;
  const ref = visit.refraction;
  const ant = visit.anteriorSegment;
  const pos = visit.posteriorSegment;
  const iop = visit.iopReadings ?? [];
  const diag = visit.diagnoses ?? [];
  const meds = visit.medications ?? [];
  const inv  = visit.investigationOrders ?? [];

  const reVA = parseJ(va?.re);
  const leVA = parseJ(va?.le);
  const reRef = parseJ(ref?.re);
  const leRef = parseJ(ref?.le);
  const reAnt = parseJ(ant?.re);
  const leAnt = parseJ(ant?.le);
  const rePos = parseJ(pos?.re);
  const lePos = parseJ(pos?.le);

  return (
    <div className="text-sm">
      {/* Visit meta */}
      <div className="flex flex-wrap gap-4 text-xs text-[var(--color-ink-500)] mb-5 pb-4 border-b border-[var(--color-border)]">
        <span className="flex items-center gap-1.5"><Calendar size={12} />{format(new Date(visit.date), "dd MMM yyyy")}</span>
        {visit.hospital && <span className="flex items-center gap-1.5"><Building2 size={12} />{visit.hospital.name}</span>}
        {visit.doctor   && <span className="flex items-center gap-1.5"><Stethoscope size={12} />Dr. {visit.doctor.name}</span>}
        <span className="px-2 py-0.5 rounded-full bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]">{visit.visitType}</span>
      </div>

      {/* General Exam */}
      {ge && (
        <Section title="General Examination">
          <Row label="Chief Complaint" value={ge.chiefComplaint} />
          <Row label="History" value={ge.hpi} />
          <Row label="Medications" value={ge.medications} />
          <Row label="Allergies" value={ge.allergies || (ge.nkda ? "NKDA" : null)} />
          {(ge.bp || ge.pulse || ge.temperature || ge.weight) && (
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ge.bp && <div className="bg-[var(--color-surface-sunken)] rounded-lg px-3 py-2 text-center"><p className="text-[10px] text-[var(--color-ink-400)]">BP</p><p className="font-medium text-[var(--color-ink-800)]">{ge.bp}</p></div>}
              {ge.pulse && <div className="bg-[var(--color-surface-sunken)] rounded-lg px-3 py-2 text-center"><p className="text-[10px] text-[var(--color-ink-400)]">Pulse</p><p className="font-medium text-[var(--color-ink-800)]">{ge.pulse}</p></div>}
              {ge.temperature && <div className="bg-[var(--color-surface-sunken)] rounded-lg px-3 py-2 text-center"><p className="text-[10px] text-[var(--color-ink-400)]">Temp</p><p className="font-medium text-[var(--color-ink-800)]">{ge.temperature}°C</p></div>}
              {ge.weight && <div className="bg-[var(--color-surface-sunken)] rounded-lg px-3 py-2 text-center"><p className="text-[10px] text-[var(--color-ink-400)]">Weight</p><p className="font-medium text-[var(--color-ink-800)]">{ge.weight} kg</p></div>}
            </div>
          )}
        </Section>
      )}

      {/* Visual Acuity */}
      {va && (reVA || leVA) && (
        <Section title="Visual Acuity">
          <div className="grid grid-cols-[140px_1fr_1fr] gap-2 text-xs text-[var(--color-ink-400)] mb-1">
            <span />
            <span className="font-semibold">Right Eye</span>
            <span className="font-semibold">Left Eye</span>
          </div>
          <EyeRow label="Unaided" re={reVA?.unaided} le={leVA?.unaided} />
          <EyeRow label="Pinhole" re={reVA?.pinhole} le={leVA?.pinhole} />
          <EyeRow label="Aided" re={reVA?.aided} le={leVA?.aided} />
          <EyeRow label="Near" re={reVA?.near} le={leVA?.near} />
        </Section>
      )}

      {/* Refraction */}
      {ref && (reRef || leRef) && (
        <Section title="Refractive Correction">
          <div className="grid grid-cols-[140px_1fr_1fr] gap-2 text-xs text-[var(--color-ink-400)] mb-1">
            <span />
            <span className="font-semibold">Right Eye</span>
            <span className="font-semibold">Left Eye</span>
          </div>
          <EyeRow label="Sphere" re={reRef?.sph} le={leRef?.sph} />
          <EyeRow label="Cylinder" re={reRef?.cyl} le={leRef?.cyl} />
          <EyeRow label="Axis" re={reRef?.axis} le={leRef?.axis} />
          <EyeRow label="Resulting VA" re={reRef?.resultingVA} le={leRef?.resultingVA} />
          <EyeRow label="Near Sphere" re={reRef?.nearSph} le={leRef?.nearSph} />
        </Section>
      )}

      {/* IOP */}
      {iop.length > 0 && (
        <Section title="IOP">
          <div className="flex flex-wrap gap-2">
            {iop.map((r: any) => (
              <div key={r.id} className="bg-[var(--color-surface-sunken)] rounded-lg px-3 py-2 text-center min-w-[80px]">
                <p className="text-[10px] text-[var(--color-ink-400)]">{r.eye} · {r.method}</p>
                <p className="font-semibold text-[var(--color-ink-800)]">{r.value} mmHg</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Anterior Segment */}
      {ant && (reAnt || leAnt) && (
        <Section title="Anterior Segment">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {reAnt && <div><p className="text-xs font-semibold text-[var(--color-ink-500)] mb-1">Right Eye</p>{Object.entries(reAnt).map(([k, v]: any) => v ? <Row key={k} label={k} value={v} /> : null)}</div>}
            {leAnt && <div><p className="text-xs font-semibold text-[var(--color-ink-500)] mb-1">Left Eye</p>{Object.entries(leAnt).map(([k, v]: any) => v ? <Row key={k} label={k} value={v} /> : null)}</div>}
          </div>
        </Section>
      )}

      {/* Posterior Segment */}
      {pos && (rePos || lePos) && (
        <Section title="Posterior Segment">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {rePos && <div><p className="text-xs font-semibold text-[var(--color-ink-500)] mb-1">Right Eye</p>{Object.entries(rePos).map(([k, v]: any) => v ? <Row key={k} label={k} value={v} /> : null)}</div>}
            {lePos && <div><p className="text-xs font-semibold text-[var(--color-ink-500)] mb-1">Left Eye</p>{Object.entries(lePos).map(([k, v]: any) => v ? <Row key={k} label={k} value={v} /> : null)}</div>}
          </div>
        </Section>
      )}

      {/* Diagnoses */}
      {diag.length > 0 && (
        <Section title="Diagnoses">
          <ul className="flex flex-col gap-1.5">
            {diag.map((d: any) => (
              <li key={d.id} className="flex items-center gap-2 text-sm">
                <span className="font-medium text-[var(--color-ink-800)]">{d.description}</span>
                {d.icd10Code && <span className="text-xs text-[var(--color-ink-400)]">{d.icd10Code}</span>}
                {d.laterality && <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]">{d.laterality}</span>}
                {d.status !== "ACTIVE" && <span className="text-xs text-[var(--color-ink-400)]">({d.status})</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Medications */}
      {meds.length > 0 && (
        <Section title="Prescription / Medications">
          <ul className="flex flex-col gap-1.5">
            {meds.map((m: any) => (
              <li key={m.id} className="flex items-start gap-2 text-sm rounded-lg border border-[var(--color-border)] px-3 py-2">
                <span className="font-medium text-[var(--color-ink-900)]">{m.drugName}</span>
                {(m.dosage || m.frequency || m.duration) && (
                  <span className="text-xs text-[var(--color-ink-400)] mt-0.5">
                    {[m.dosage, m.frequency, m.duration].filter(Boolean).join(" · ")}
                  </span>
                )}
                {m.instructions && <span className="text-xs text-[var(--color-ink-400)] mt-0.5 ml-auto">{m.instructions}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Investigations */}
      {inv.length > 0 && (
        <Section title="Investigations" badge={inv.filter((o: any) => o.status === "ORDERED").length}>
          <ul className="flex flex-col gap-2">
            {inv.map((o: any) => {
              const resultUrl = localResults[o.id] ?? o.resultRef ?? null;
              const isImage = resultUrl && /\.(jpg|jpeg|png|webp)$/i.test(resultUrl);
              return (
                <li key={o.id} className="flex flex-col gap-1.5">
                  {/* Row: name + category + upload icons + status */}
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-[var(--color-ink-800)] font-medium">{o.testName}</span>
                    <span className="text-xs text-[var(--color-ink-400)]">{o.category}</span>
                    <span className="ml-auto flex items-center gap-1.5">
                      {resultUrl ? (
                        <>
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[var(--color-success-100)] text-[var(--color-success-600)]">
                            <CheckCircle2 size={10} /> Result Uploaded
                          </span>
                          <a
                            href={resultUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 rounded text-[var(--color-ink-400)] hover:text-[var(--color-primary-600)] hover:bg-[var(--color-primary-50)] transition-colors"
                            title="Download result"
                          >
                            <Download size={13} />
                          </a>
                        </>
                      ) : (
                        <>
                          <InvUploadButton orderId={o.id} udid={udid} onDone={(url) => onAttach(o.id, url)} />
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]">
                            {o.status.replace(/_/g, " ")}
                          </span>
                        </>
                      )}
                    </span>
                  </div>

                  {/* Inline result preview */}
                  {resultUrl && (
                    <div className="ml-1 pl-3 border-l-2 border-[var(--color-primary-200)]">
                      <p className="text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-wide mb-1">
                        {o.testName} Result
                      </p>
                      {isImage ? (
                        <a href={resultUrl} target="_blank" rel="noreferrer">
                          <img
                            src={resultUrl}
                            alt={`${o.testName} result`}
                            className="max-h-40 rounded-lg object-contain border border-[var(--color-border)] cursor-pointer hover:opacity-90 transition-opacity"
                          />
                        </a>
                      ) : (
                        <a
                          href={resultUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-xs text-[var(--color-primary-700)] bg-[var(--color-primary-50)] border border-[var(--color-primary-200)] px-3 py-1.5 rounded-lg hover:bg-[var(--color-primary-100)] transition-colors"
                        >
                          <Paperclip size={12} /> {o.testName} result — click to open
                        </a>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {!ge && diag.length === 0 && meds.length === 0 && (
        <p className="text-sm text-[var(--color-ink-400)] text-center py-8">No clinical data recorded for this visit.</p>
      )}
    </div>
  );
}

export function VisitDownloadButton({ visitId }: { visitId: string }) {
  return (
    <button
      onClick={() => window.open(`/api/visit-summary-pdf/${visitId}`, "_blank")}
      title="Print Visit Summary"
      className="shrink-0 inline-flex items-center justify-center w-[30px] h-[30px] rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-500 hover:text-white transition-colors"
    >
      <Printer size={13} />
    </button>
  );
}

export function EmrViewerButton({ visitId, visitNumber, udid }: { visitId: string; visitNumber: number; udid: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<any>(null);
  const [pending, start] = useTransition();
  const [localResults, setLocalResults] = useState<Record<string, string>>({});

  const handleOpen = () => {
    if (data) { setOpen(true); return; }
    start(async () => {
      const result = await getVisitEmrData(visitId);
      setData(result);
      setOpen(true);
    });
  };

  const handleAttach = (orderId: string, url: string) => {
    setLocalResults((prev) => ({ ...prev, [orderId]: url }));
  };

  return (
    <>
      <button
        onClick={handleOpen}
        disabled={pending}
        className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-orange-100 text-orange-700 hover:bg-orange-500 hover:text-white transition-colors disabled:opacity-60"
      >
        {pending ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
        Visit Summary
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 p-4 overflow-y-auto" onClick={() => setOpen(false)}>
          <div
            className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl my-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="sticky top-0 flex items-center justify-between px-5 py-4 bg-[var(--color-primary-800)] text-white rounded-t-2xl z-10">
              <p className="font-semibold text-sm">Visit #{visitNumber} Summary</p>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-white/15 transition-colors">
                <X size={15} />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-5 py-5 max-h-[80vh] overflow-y-auto">
              {data ? (
                <EmrContent visit={data} udid={udid} localResults={localResults} onAttach={handleAttach} />
              ) : (
                <div className="flex items-center justify-center py-16">
                  <Loader2 size={24} className="animate-spin text-[var(--color-primary-600)]" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
