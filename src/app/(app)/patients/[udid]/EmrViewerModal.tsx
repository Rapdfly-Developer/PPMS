"use client";

import { useState, useTransition } from "react";
import { X, FileText, Building2, Stethoscope, Calendar, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { getVisitEmrData } from "./emr-viewer-action";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="text-[10px] font-semibold tracking-widest text-[var(--color-ink-400)] uppercase mb-2 pb-1 border-b border-[var(--color-border)]">
        {title}
      </p>
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
      <span className="text-[var(--color-ink-700)]">{re || "—"}</span>
      <span className="text-[var(--color-ink-700)]">{le || "—"}</span>
    </div>
  );
}

function EmrContent({ visit }: { visit: any }) {
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
        <Section title="Investigations">
          <ul className="flex flex-col gap-1.5">
            {inv.map((o: any) => (
              <li key={o.id} className="flex items-center gap-2 text-sm">
                <span className="text-[var(--color-ink-800)]">{o.testName}</span>
                <span className="text-xs text-[var(--color-ink-400)]">{o.category}</span>
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]">{o.status.replace(/_/g, " ")}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {!ge && diag.length === 0 && meds.length === 0 && (
        <p className="text-sm text-[var(--color-ink-400)] text-center py-8">No clinical data recorded for this visit.</p>
      )}
    </div>
  );
}

export function EmrViewerButton({ visitId, visitNumber }: { visitId: string; visitNumber: number }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<any>(null);
  const [pending, start] = useTransition();

  const handleOpen = () => {
    if (data) { setOpen(true); return; }
    start(async () => {
      const result = await getVisitEmrData(visitId);
      setData(result);
      setOpen(true);
    });
  };

  return (
    <>
      <button
        onClick={handleOpen}
        disabled={pending}
        className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-orange-100 text-orange-700 hover:bg-orange-500 hover:text-white transition-colors disabled:opacity-60"
      >
        {pending ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
        View Summary
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 p-4 overflow-y-auto" onClick={() => setOpen(false)}>
          <div
            className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl my-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="sticky top-0 flex items-center justify-between px-5 py-4 bg-[var(--color-primary-800)] text-white rounded-t-2xl z-10">
              <p className="font-semibold text-sm">EMR — Visit #{visitNumber}</p>
              <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-white/15 transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-5 py-5 max-h-[80vh] overflow-y-auto">
              {data ? <EmrContent visit={data} /> : (
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
