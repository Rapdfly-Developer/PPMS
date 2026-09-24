"use client";

import { useState, useTransition, useRef } from "react";
import { X, FileText, Building2, Stethoscope, Calendar, Loader2, Paperclip, Camera, Printer, Download, CheckCircle2, Activity, FlaskConical, Pill, ClipboardList, CalendarClock, Scissors, BookOpen, AlertCircle } from "lucide-react";
import { openPdfNative } from "@/lib/open-pdf";
import { attachResult } from "@/app/(app)/emr/[udid]/actions";
import { format } from "date-fns";
import { getVisitEmrData } from "./emr-viewer-action";

function Section({ title, icon, badge, accent, children }: {
  title: string;
  icon?: React.ReactNode;
  badge?: number;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5 rounded-lg border border-[var(--color-border)] overflow-hidden">
      <div className={`flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)] ${accent ?? "bg-[var(--color-surface-sunken)]"}`}>
        {icon && <span className="text-[var(--color-ink-400)] shrink-0">{icon}</span>}
        <p className="text-[10px] font-black tracking-[0.15em] text-[var(--color-ink-500)] uppercase flex-1">
          {title}
        </p>
        {badge !== undefined && badge > 0 && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600">
            {badge} pending
          </span>
        )}
      </div>
      <div className="px-3 py-3 bg-white">
        {children}
      </div>
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
  const ge   = visit.generalExam;
  const va   = visit.visualAcuity;
  const ref  = visit.refraction;
  const ant  = visit.anteriorSegment;
  const pos  = visit.posteriorSegment;
  const iop  = visit.iopReadings ?? [];
  const diag = visit.diagnoses ?? [];
  const meds = visit.medications ?? [];
  const inv  = visit.investigationOrders ?? [];

  const reVA  = parseJ(va?.re);
  const leVA  = parseJ(va?.le);
  const reRef = parseJ(ref?.re);
  const leRef = parseJ(ref?.le);
  const reAnt = parseJ(ant?.re);
  const leAnt = parseJ(ant?.le);
  const rePos = parseJ(pos?.re);
  const lePos = parseJ(pos?.le);

  const isClosed = visit.status === "CLOSED";
  const hasProcedure = !!(visit.procedureName || visit.procedureNotes || visit.anesthesiaType || visit.surgeryAdvised);
  const hasFollowUp  = !!(visit.followUpDate || visit.referralEnabled || visit.adviseNotes || visit.gonioNotes);

  return (
    <div className="text-sm">

      {/* ── Visit Details strip ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-ink-500)] mb-4 pb-4 border-b border-[var(--color-border)]">
        <span className="flex items-center gap-1.5 font-medium text-[var(--color-ink-700)]">
          <Calendar size={12} className="text-[var(--color-primary-600)]" />
          {format(new Date(visit.date), "dd MMM yyyy")}
        </span>
        {visit.hospital && (
          <span className="flex items-center gap-1.5">
            <Building2 size={12} />{visit.hospital.name}
          </span>
        )}
        {visit.doctor && (
          <span className="flex items-center gap-1.5">
            <Stethoscope size={12} />Dr. {visit.doctor.name}
          </span>
        )}
        {visit.visitType && (
          <span className="px-2 py-0.5 rounded-full bg-[var(--color-primary-50)] text-[var(--color-primary-700)] font-medium">
            {visit.visitType}
          </span>
        )}
        <span className={`ml-auto px-2 py-0.5 rounded-full text-[11px] font-bold uppercase ${
          isClosed
            ? "bg-emerald-50 text-emerald-700"
            : "bg-blue-50 text-blue-700"
        }`}>
          {isClosed ? "Completed" : "In Progress"}
        </span>
      </div>

      {/* ── 1. Chief Complaint & Symptoms ─────────────────────────────── */}
      {ge && (
        <Section title="Chief Complaint &amp; Symptoms" icon={<FileText size={12} />}>
          <Row label="Chief Complaint" value={ge.chiefComplaint} />
          <Row label="History of Illness" value={ge.hpi} />
          <Row label="Known Medications" value={ge.medications} />
          <Row label="Allergies" value={ge.allergies || (ge.nkda ? "NKDA (No Known Drug Allergies)" : null)} />
        </Section>
      )}

      {/* ── 2. Vitals ─────────────────────────────────────────────────── */}
      {ge && (ge.bp || ge.pulse || ge.temperature || ge.weight) && (
        <Section title="Vitals" icon={<Activity size={12} />}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {ge.bp          && <VitalCard label="Blood Pressure" value={ge.bp} unit="" />}
            {ge.pulse       && <VitalCard label="Pulse" value={ge.pulse} unit="bpm" />}
            {ge.temperature && <VitalCard label="Temperature" value={ge.temperature} unit="°C" />}
            {ge.weight      && <VitalCard label="Weight" value={ge.weight} unit="kg" />}
          </div>
        </Section>
      )}

      {/* ── 3. Examination Findings ───────────────────────────────────── */}
      {(va || ref || iop.length > 0 || ant || pos) && (
        <Section title="Examination Findings" icon={<Stethoscope size={12} />}>

          {/* Visual Acuity */}
          {va && (reVA || leVA) && (
            <div className="mb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-400)] mb-1.5">Visual Acuity{va.testMethod ? ` · ${va.testMethod}` : ""}</p>
              <div className="grid grid-cols-[140px_1fr_1fr] gap-2 text-xs text-[var(--color-ink-400)] mb-1">
                <span /><span className="font-semibold">Right Eye</span><span className="font-semibold">Left Eye</span>
              </div>
              <EyeRow label="Distance Unaided"        re={reVA?.distanceUnaided}       le={leVA?.distanceUnaided} />
              <EyeRow label="Distance Pinhole"        re={reVA?.distancePinhole}       le={leVA?.distancePinhole} />
              <EyeRow label="Distance Best Corrected" re={reVA?.distanceBestCorrected} le={leVA?.distanceBestCorrected} />
              <EyeRow label="Near Unaided"            re={reVA?.nearUnaided}           le={leVA?.nearUnaided} />
              <EyeRow label="Near Best Corrected"     re={reVA?.nearBestCorrected}     le={leVA?.nearBestCorrected} />
            </div>
          )}

          {/* Refractive Correction */}
          {ref && (reRef || leRef) && (
            <div className="mb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-400)] mb-1.5">Refractive Correction</p>
              <div className="grid grid-cols-[140px_1fr_1fr] gap-2 text-xs text-[var(--color-ink-400)] mb-1">
                <span /><span className="font-semibold">Right Eye</span><span className="font-semibold">Left Eye</span>
              </div>
              <EyeRow label="Sphere" re={reRef?.sph} le={leRef?.sph} />
              <EyeRow label="Cylinder" re={reRef?.cyl} le={leRef?.cyl} />
              <EyeRow label="Axis" re={reRef?.axis} le={leRef?.axis} />
              <EyeRow label="Resulting VA" re={reRef?.resultingVA} le={leRef?.resultingVA} />
              <EyeRow label="Near Sphere" re={reRef?.nearSph} le={leRef?.nearSph} />
            </div>
          )}

          {/* IOP */}
          {iop.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-400)] mb-1.5">Intraocular Pressure (mmHg)</p>
              <div className="flex flex-wrap gap-2">
                {iop.map((r: any) => (
                  <div key={r.id} className="bg-[var(--color-surface-sunken)] rounded-lg px-3 py-2 text-center min-w-[80px]">
                    <p className="text-[10px] text-[var(--color-ink-400)]">{r.eye} · {r.method}</p>
                    <p className="font-semibold text-[var(--color-ink-800)]">{r.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Anterior Segment */}
          {ant && (reAnt || leAnt) && (
            <div className="mb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-400)] mb-1.5">Anterior Segment</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {reAnt && <div><p className="text-xs font-semibold text-[var(--color-ink-500)] mb-1">Right Eye</p>{Object.entries(reAnt).map(([k, v]: any) => v ? <Row key={k} label={k} value={v} /> : null)}</div>}
                {leAnt && <div><p className="text-xs font-semibold text-[var(--color-ink-500)] mb-1">Left Eye</p>{Object.entries(leAnt).map(([k, v]: any) => v ? <Row key={k} label={k} value={v} /> : null)}</div>}
              </div>
            </div>
          )}

          {/* Posterior Segment */}
          {pos && (rePos || lePos) && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-400)] mb-1.5">Posterior Segment</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {rePos && <div><p className="text-xs font-semibold text-[var(--color-ink-500)] mb-1">Right Eye</p>{Object.entries(rePos).map(([k, v]: any) => v ? <Row key={k} label={k} value={v} /> : null)}</div>}
                {lePos && <div><p className="text-xs font-semibold text-[var(--color-ink-500)] mb-1">Left Eye</p>{Object.entries(lePos).map(([k, v]: any) => v ? <Row key={k} label={k} value={v} /> : null)}</div>}
              </div>
            </div>
          )}

        </Section>
      )}

      {/* ── 4. Investigations & Results ───────────────────────────────── */}
      {inv.length > 0 && (
        <Section title="Investigations &amp; Results" icon={<FlaskConical size={12} />} badge={inv.filter((o: any) => !localResults[o.id] && !o.resultRef).length}>
          <ul className="flex flex-col gap-2">
            {inv.map((o: any) => {
              const resultUrl = localResults[o.id] ?? o.resultRef ?? null;
              const isImage = resultUrl && /\.(jpg|jpeg|png|webp)$/i.test(resultUrl);
              return (
                <li key={o.id} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    {o.laterality && <span className="text-xs font-semibold text-[var(--color-primary-700)] shrink-0">{o.laterality}</span>}
                    <span className="text-[var(--color-ink-800)] font-medium">{o.testName}</span>
                    {o.category && <span className="text-xs text-[var(--color-ink-400)]">{o.category}</span>}
                    <span className="ml-auto flex items-center gap-1.5">
                      {resultUrl ? (
                        <>
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                            <CheckCircle2 size={10} /> Result Uploaded
                          </span>
                          <a href={resultUrl} target="_blank" rel="noreferrer"
                            className="p-1 rounded text-[var(--color-ink-400)] hover:text-[var(--color-primary-600)] hover:bg-[var(--color-primary-50)] transition-colors"
                            title="Download result">
                            <Download size={13} />
                          </a>
                        </>
                      ) : (
                        <>
                          <InvUploadButton orderId={o.id} udid={udid} onDone={(url) => onAttach(o.id, url)} />
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                            o.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700"
                            : o.status === "ORDERED" ? "bg-blue-50 text-blue-700"
                            : "bg-amber-50 text-amber-700"
                          }`}>
                            {o.status.replace(/_/g, " ")}
                          </span>
                        </>
                      )}
                    </span>
                  </div>
                  {resultUrl && (
                    <div className="ml-1 pl-3 border-l-2 border-[var(--color-primary-200)]">
                      <p className="text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-wide mb-1">{o.testName} Result</p>
                      {isImage ? (
                        <a href={resultUrl} target="_blank" rel="noreferrer">
                          <img src={resultUrl} alt={`${o.testName} result`}
                            className="max-h-40 rounded-lg object-contain border border-[var(--color-border)] cursor-pointer hover:opacity-90 transition-opacity" />
                        </a>
                      ) : (
                        <a href={resultUrl} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-2 text-xs text-[var(--color-primary-700)] bg-[var(--color-primary-50)] border border-[var(--color-primary-200)] px-3 py-1.5 rounded-lg hover:bg-[var(--color-primary-100)] transition-colors">
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

      {/* ── 5. Diagnosis ──────────────────────────────────────────────── */}
      {diag.length > 0 && (
        <Section title="Diagnosis" icon={<ClipboardList size={12} />}>
          <ul className="flex flex-col gap-1.5">
            {diag.map((d: any) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2 py-1.5 border-b border-[var(--color-border)] last:border-0">
                <span className={`text-[9px] font-bold uppercase shrink-0 w-16 ${
                  d.status === "RESOLVED" ? "text-emerald-600"
                  : d.status === "CHRONIC" ? "text-amber-600"
                  : "text-red-500"
                }`}>{d.status}</span>
                {d.laterality && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)] shrink-0">{d.laterality}</span>}
                <span className="font-medium text-[var(--color-ink-800)] flex-1">{d.description}</span>
                {d.icd10Code && <span className="font-mono text-[10px] text-[var(--color-ink-400)]">{d.icd10Code}</span>}
                {d.provisional && <span className="text-[10px] text-amber-600 italic">Provisional</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* ── 6. Procedures / Treatment Provided ───────────────────────── */}
      {hasProcedure && (
        <Section title="Procedures &amp; Treatment Provided" icon={<Scissors size={12} />}>
          {visit.procedureName && (
            <div className="mb-2">
              <Row label="Procedure" value={`${visit.procedureLaterality ? `[${visit.procedureLaterality}] ` : ""}${visit.procedureName}`} />
              <Row label="Anaesthesia" value={visit.anesthesiaType} />
            </div>
          )}
          {visit.procedureNotes && (
            <div className="bg-[var(--color-surface-sunken)] rounded-lg p-2.5 mt-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-400)] mb-1">Procedure Notes</p>
              <p className="text-xs leading-relaxed text-[var(--color-ink-700)]">{visit.procedureNotes}</p>
            </div>
          )}
          {visit.surgeryAdvised && (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 mb-1">Surgery Advised</p>
              {visit.advisedSurgeryName && <Row label="Procedure" value={`${visit.advisedSurgeryEye ? `[${visit.advisedSurgeryEye}] ` : ""}${visit.advisedSurgeryName}`} />}
              {visit.advisedSurgeryDate && <Row label="Target Date" value={format(new Date(visit.advisedSurgeryDate), "dd MMM yyyy")} />}
              {visit.advisedSurgeryNotes && <Row label="Notes" value={visit.advisedSurgeryNotes} />}
            </div>
          )}
        </Section>
      )}

      {/* ── 7. Medications Prescribed ────────────────────────────────── */}
      {meds.length > 0 && (
        <Section title="Medications Prescribed" icon={<Pill size={12} />}>
          <ul className="flex flex-col divide-y divide-[var(--color-border)]">
            {meds.map((m: any, i: number) => (
              <li key={m.id} className="flex items-start gap-2.5 py-2 first:pt-0 last:pb-0">
                <span className="text-[10px] text-[var(--color-ink-400)] tabular-nums w-5 shrink-0 mt-0.5">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[var(--color-ink-900)] text-sm leading-snug">
                    {m.laterality && <span className="font-bold text-[var(--color-primary-700)] mr-1.5">{m.laterality}</span>}
                    {m.drugName}
                  </p>
                  {(m.dosage || m.frequency || m.duration) && (
                    <p className="text-xs text-[var(--color-ink-500)] mt-0.5">
                      {[m.dosage, m.frequency, m.duration].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {m.instructions && <p className="text-xs text-[var(--color-ink-400)] mt-0.5 italic">{m.instructions}</p>}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* ── 8. Clinical Notes & Advice ───────────────────────────────── */}
      {(visit.adviseNotes || visit.gonioNotes) && (
        <Section title="Clinical Notes &amp; Doctor's Advice" icon={<BookOpen size={12} />}>
          {visit.adviseNotes && (
            <div className="mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-400)] mb-1">Advice / Instructions</p>
              <p className="text-xs leading-relaxed text-[var(--color-ink-700)]">{visit.adviseNotes}</p>
            </div>
          )}
          {visit.gonioNotes && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-400)] mb-1">Gonioscopy Notes</p>
              <p className="text-xs leading-relaxed text-[var(--color-ink-700)]">{visit.gonioNotes}</p>
            </div>
          )}
        </Section>
      )}

      {/* ── 9. Follow-Up Plan & Next Appointment ─────────────────────── */}
      {hasFollowUp && (
        <Section title="Follow-Up Plan &amp; Next Appointment" icon={<CalendarClock size={12} />}>
          {visit.followUpDate && (
            <div className="flex items-center gap-2 mb-2 rounded-lg bg-[var(--color-primary-50)] border border-[var(--color-primary-100)] px-3 py-2">
              <Calendar size={13} className="shrink-0 text-[var(--color-primary-600)]" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-primary-700)]">Next Appointment</p>
                <p className="text-sm font-semibold text-[var(--color-primary-800)]">
                  {format(new Date(visit.followUpDate), "dd MMM yyyy")}
                  {visit.followUpCompleted && <span className="ml-2 text-[10px] font-bold text-emerald-600">· Completed</span>}
                </p>
              </div>
            </div>
          )}
          {visit.referralEnabled && visit.referralNote && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-700 mb-1">Referral</p>
              <p className="text-xs leading-relaxed text-blue-800">{visit.referralNote}</p>
            </div>
          )}
        </Section>
      )}

      {/* ── 10. Visit Outcome / Status ───────────────────────────────── */}
      {(visit.finalizedAt || visit.finalizedBy) && (
        <Section title="Visit Outcome" icon={<CheckCircle2 size={12} />}>
          <Row label="Status" value={isClosed ? "Completed / Closed" : "In Progress"} />
          {visit.finalizedAt && <Row label="Finalized On" value={format(new Date(visit.finalizedAt), "dd MMM yyyy, hh:mm a")} />}
          {visit.finalizedBy && <Row label="Finalized By" value={visit.finalizedBy} />}
        </Section>
      )}

      {!ge && diag.length === 0 && meds.length === 0 && inv.length === 0 && (
        <div className="flex items-start gap-2.5 py-3 px-3 rounded-xl bg-[var(--color-surface-sunken)]">
          <AlertCircle size={14} className="shrink-0 mt-0.5 text-[var(--color-ink-300)]" />
          <p className="text-sm text-[var(--color-ink-400)]">No clinical data recorded for this visit.</p>
        </div>
      )}
    </div>
  );
}

function VitalCard({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="bg-[var(--color-surface-sunken)] rounded-lg px-3 py-2 text-center">
      <p className="text-[10px] text-[var(--color-ink-400)] mb-0.5">{label}</p>
      <p className="font-semibold text-[var(--color-ink-800)] text-sm">{value}{unit ? <span className="text-[10px] font-normal text-[var(--color-ink-400)] ml-0.5">{unit}</span> : null}</p>
    </div>
  );
}

export function VisitDownloadButton({ visitId }: { visitId: string }) {
  return (
    <button
      onClick={() => { void openPdfNative(`/api/visit-summary-pdf/${visitId}`); }}
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
