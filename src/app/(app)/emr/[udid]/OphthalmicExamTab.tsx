"use client";

import { useState, useEffect, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { ChipGroup, SingleChipSelect } from "@/components/ui/Chip";
import { useAutoSave, SaveIndicator } from "@/lib/useAutoSave";
import { parseJSON } from "@/lib/json";
import { DiplopiaGrid, HessGrid } from "@/components/emr/Grid9Position";
import {
  VA_TEST_METHODS,
  VA_SNELLEN_VALUES,
  COLOUR_VISION_TESTS,
  CONTRAST_SENSITIVITY_TESTS,
  IOP_METHODS,
  ANTERIOR_SEGMENT_STRUCTURES,
  POSTERIOR_SEGMENT_OPTIONS,
  LACRIMAL_SAC_CHIPS,
} from "@/lib/constants";
import {
  saveVisualAcuity,
  saveRefraction,
  sendToOpticals,
  saveColourVision,
  addIOPReading,
  removeIOPReading,
  saveAnteriorSegment,
  savePosteriorSegment,
  saveDiplopia,
  saveHess,
  saveRetinoscopy,
  saveTearFilm,
  saveLacrimalSac,
  markOphthalmicReviewed,
} from "./actions";
import { format } from "date-fns";

type Role = "DOCTOR" | "HOSPITAL" | "REFRACTIONIST";

export function OphthalmicExamTab({ visit, priorVisits, udid, role }: { visit: any; priorVisits: any[]; udid: string; role: Role }) {
  const refractionistCanEdit = role === "REFRACTIONIST" || role === "DOCTOR";
  const doctorOnly = role === "DOCTOR";

  useEffect(() => {
    if (role === "DOCTOR") {
      markOphthalmicReviewed(visit.id).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Tabs
      defaultTab="va"
      tabs={[
        { id: "va", label: "Visual Acuity", content: <VisualAcuityCard visit={visit} udid={udid} editable={refractionistCanEdit} /> },
        { id: "refraction", label: "Refraction", content: <RefractionCard visit={visit} udid={udid} editable={refractionistCanEdit} /> },
        { id: "cv", label: "Colour Vision / CS", content: <ColourVisionCard visit={visit} udid={udid} editable={refractionistCanEdit} /> },
        { id: "iop", label: "IOP", content: <IOPCard visit={visit} udid={udid} editable={refractionistCanEdit} priorVisits={priorVisits} /> },
        { id: "anterior", label: "Anterior Segment", content: <AnteriorSegmentCard visit={visit} udid={udid} editable={doctorOnly} /> },
        { id: "posterior", label: "Posterior Segment", content: <PosteriorSegmentCard visit={visit} udid={udid} editable={doctorOnly} /> },
        { id: "diplopia", label: "Diplopia Chart", content: <DiplopiaCard visit={visit} udid={udid} editable={doctorOnly} /> },
        { id: "hess", label: "Hess Chart", content: <HessCard visit={visit} udid={udid} editable={doctorOnly} /> },
        { id: "retino", label: "Retinoscopy", content: <RetinoscopyCard visit={visit} udid={udid} editable={doctorOnly} /> },
        { id: "tear", label: "Tear Film", content: <TearFilmCard visit={visit} udid={udid} editable={doctorOnly} /> },
        { id: "lacrimal", label: "Lacrimal Sac", content: <LacrimalSacCard visit={visit} udid={udid} editable={doctorOnly} /> },
      ]}
    />
  );
}

function EyeColumns({ children }: { children: [React.ReactNode, React.ReactNode] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div>
        <p className="text-xs font-semibold text-[var(--color-primary-700)] uppercase tracking-wide mb-2">Right Eye (RE)</p>
        {children[0]}
      </div>
      <div>
        <p className="text-xs font-semibold text-[var(--color-primary-700)] uppercase tracking-wide mb-2">Left Eye (LE)</p>
        {children[1]}
      </div>
    </div>
  );
}

const VA_ROWS: { key: string; label: string; section: "dist" | "near" }[] = [
  { key: "unaided",        label: "Unaided",        section: "dist" },
  { key: "pinhole",        label: "Pinhole",        section: "dist" },
  { key: "bestCorrected",  label: "Best Corrected", section: "dist" },
  { key: "nearUnaided",    label: "Unaided",        section: "near" },
  { key: "nearPinhole",    label: "Pinhole",        section: "near" },
  { key: "nearBestCorrected", label: "Best Corrected", section: "near" },
];

function VisualAcuityCard({ visit, udid, editable }: { visit: any; udid: string; editable: boolean }) {
  const va = visit.visualAcuity;
  const [testMethod, setTestMethod] = useState(va?.testMethod ?? "Snellen");
  const [re, setRe] = useState(
    parseJSON(va?.re, { unaided: "", pinhole: "", bestCorrected: "", nearUnaided: "", nearPinhole: "", nearBestCorrected: "", nearN: "" })
  );
  const [le, setLe] = useState(
    parseJSON(va?.le, { unaided: "", pinhole: "", bestCorrected: "", nearUnaided: "", nearPinhole: "", nearBestCorrected: "", nearN: "" })
  );

  const state = useAutoSave({ testMethod, re: JSON.stringify(re), le: JSON.stringify(le) }, async (d) => {
    if (!editable) return;
    await saveVisualAcuity(visit.id, udid, d);
  });

  const sel = (eye: typeof re, setEye: typeof setRe, key: string) => (
    <select
      disabled={!editable}
      value={(eye as any)[key] ?? "-"}
      onChange={(e) => setEye({ ...eye, [key]: e.target.value })}
      className="w-full rounded border border-[var(--color-border)] bg-white px-1.5 py-1 text-xs disabled:bg-[var(--color-surface-sunken)]"
    >
      {VA_SNELLEN_VALUES.map((v) => <option key={v} value={v}>{v}</option>)}
    </select>
  );

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-[var(--color-ink-700)]">Method</p>
        <SaveIndicator state={state} />
      </div>
      <SingleChipSelect options={VA_TEST_METHODS} value={testMethod} onChange={editable ? setTestMethod : () => {}} />

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs min-w-[320px]">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className="py-1.5 pr-2 text-left text-[var(--color-ink-400)] font-medium w-28"></th>
              <th className="py-1.5 px-1 text-center text-[var(--color-primary-700)] font-semibold">RE</th>
              <th className="py-1.5 px-1 text-center text-[var(--color-primary-700)] font-semibold">LE</th>
            </tr>
          </thead>
          <tbody>
            <tr><td colSpan={3} className="pt-2 pb-0.5 text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-widest">Distance</td></tr>
            {VA_ROWS.filter(r => r.section === "dist").map(row => (
              <tr key={row.key} className="border-b border-[var(--color-border)] last:border-0">
                <td className="py-1 pr-2 font-medium text-[var(--color-ink-600)] whitespace-nowrap">{row.label}</td>
                <td className="py-1 px-1">{sel(re, setRe, row.key)}</td>
                <td className="py-1 px-1">{sel(le, setLe, row.key)}</td>
              </tr>
            ))}
            <tr><td colSpan={3} className="pt-3 pb-0.5 text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-widest">Near</td></tr>
            {VA_ROWS.filter(r => r.section === "near").map(row => (
              <tr key={row.key} className="border-b border-[var(--color-border)] last:border-0">
                <td className="py-1 pr-2 font-medium text-[var(--color-ink-600)] whitespace-nowrap">{row.label}</td>
                <td className="py-1 px-1">{sel(re, setRe, row.key)}</td>
                <td className="py-1 px-1">{sel(le, setLe, row.key)}</td>
              </tr>
            ))}
            <tr className="border-b border-[var(--color-border)]">
              <td className="py-1 pr-2 font-medium text-[var(--color-ink-600)] whitespace-nowrap">Near (N)</td>
              <td className="py-1 px-1">
                <input disabled={!editable} value={(re as any).nearN ?? ""} onChange={(e) => setRe({ ...re, nearN: e.target.value })}
                  placeholder="N5" className="w-full rounded border border-[var(--color-border)] bg-white px-1.5 py-1 text-xs disabled:bg-[var(--color-surface-sunken)]" />
              </td>
              <td className="py-1 px-1">
                <input disabled={!editable} value={(le as any).nearN ?? ""} onChange={(e) => setLe({ ...le, nearN: e.target.value })}
                  placeholder="N5" className="w-full rounded border border-[var(--color-border)] bg-white px-1.5 py-1 text-xs disabled:bg-[var(--color-surface-sunken)]" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function RefractionCard({ visit, udid, editable }: { visit: any; udid: string; editable: boolean }) {
  const rc = visit.refraction;
  const [re, setRe] = useState(parseJSON(rc?.re, { sph: "", cyl: "", axis: "", va: "", nearSph: "", nearCyl: "", nearAxis: "" }));
  const [le, setLe] = useState(parseJSON(rc?.le, { sph: "", cyl: "", axis: "", va: "", nearSph: "", nearCyl: "", nearAxis: "" }));

  const state = useAutoSave({ re: JSON.stringify(re), le: JSON.stringify(le) }, async (d) => {
    if (!editable) return;
    await saveRefraction(visit.id, udid, d);
  });

  const eyeFields = (val: typeof re, setVal: typeof setRe) => (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-[var(--color-ink-400)] font-medium">Distance</p>
      <div className="grid grid-cols-3 gap-1.5">
        <LabeledInput label="Sph" value={val.sph} onChange={(v) => setVal({ ...val, sph: v })} disabled={!editable} />
        <LabeledInput label="Cyl" value={val.cyl} onChange={(v) => setVal({ ...val, cyl: v })} disabled={!editable} />
        <LabeledInput label="Axis 0-180°" value={val.axis} onChange={(v) => setVal({ ...val, axis: v })} disabled={!editable} />
      </div>
      <LabeledInput label="Resulting VA" value={val.va} onChange={(v) => setVal({ ...val, va: v })} disabled={!editable} />
      <p className="text-xs text-[var(--color-ink-400)] font-medium mt-2">Near</p>
      <div className="grid grid-cols-3 gap-1.5">
        <LabeledInput label="Sph" value={val.nearSph} onChange={(v) => setVal({ ...val, nearSph: v })} disabled={!editable} />
        <LabeledInput label="Cyl" value={val.nearCyl} onChange={(v) => setVal({ ...val, nearCyl: v })} disabled={!editable} />
        <LabeledInput label="Axis" value={val.nearAxis} onChange={(v) => setVal({ ...val, nearAxis: v })} disabled={!editable} />
      </div>
    </div>
  );

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-[var(--color-ink-700)]">Refractive Correction</p>
        <div className="flex items-center gap-3">
          <SaveIndicator state={state} />
          {editable && (
            <button
              onClick={() => sendToOpticals(visit.id, udid)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[var(--color-primary-100)] text-[var(--color-primary-700)] hover:bg-[var(--color-primary-600)] hover:text-white transition-colors"
            >
              {rc?.sentToOpticals ? "Resend to Opticals" : "Send to Opticals"}
            </button>
          )}
        </div>
      </div>
      <EyeColumns>
        {eyeFields(re, setRe)}
        {eyeFields(le, setLe)}
      </EyeColumns>
    </Card>
  );
}

const CV_OPTIONS = ["Normal", "Defective", "Not Tested"] as const;
type CVResult = typeof CV_OPTIONS[number] | "";

function ColourVisionCard({ visit, udid, editable }: { visit: any; udid: string; editable: boolean }) {
  const cv = visit.colourVisionCS;
  const storedRe = parseJSON(cv?.re, {});
  const storedLe = parseJSON(cv?.le, {});
  const [reResult, setReResult] = useState<CVResult>((storedRe as any).result ?? "");
  const [leResult, setLeResult] = useState<CVResult>((storedLe as any).result ?? "");
  const [reNotes, setReNotes]   = useState<string>((storedRe as any).notes ?? "");
  const [leNotes, setLeNotes]   = useState<string>((storedLe as any).notes ?? "");

  const state = useAutoSave(
    { re: JSON.stringify({ result: reResult, notes: reNotes }), le: JSON.stringify({ result: leResult, notes: leNotes }) },
    async (d) => { if (!editable) return; await saveColourVision(visit.id, udid, d); }
  );

  const eyePanel = (label: string, result: CVResult, setResult: (v: CVResult) => void, notes: string, setNotes: (v: string) => void) => (
    <div>
      <p className="text-xs font-semibold text-[var(--color-primary-700)] uppercase tracking-wide mb-2">{label}</p>
      <div className="flex gap-2 flex-wrap mb-3">
        {CV_OPTIONS.map((opt) => (
          <button
            key={opt}
            disabled={!editable}
            onClick={() => setResult(result === opt ? "" : opt)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              result === opt
                ? opt === "Normal"     ? "bg-emerald-100 border-emerald-400 text-emerald-700"
                : opt === "Defective"  ? "bg-red-100 border-red-400 text-red-700"
                :                        "bg-[var(--color-surface-sunken)] border-[var(--color-ink-300)] text-[var(--color-ink-500)]"
                : "bg-white border-[var(--color-border)] text-[var(--color-ink-600)] hover:border-[var(--color-primary-400)]"
            } disabled:cursor-default`}
          >
            {opt}
          </button>
        ))}
      </div>
      <input
        disabled={!editable}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (e.g. Ishihara 10/38)..."
        className="w-full rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs disabled:bg-[var(--color-surface-sunken)]"
      />
    </div>
  );

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-[var(--color-ink-700)]">Colour Vision</p>
        <SaveIndicator state={state} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {eyePanel("Right Eye (RE)", reResult, setReResult, reNotes, setReNotes)}
        {eyePanel("Left Eye (LE)", leResult, setLeResult, leNotes, setLeNotes)}
      </div>
    </Card>
  );
}

function IOPCard({ visit, udid, editable, priorVisits }: { visit: any; udid: string; editable: boolean; priorVisits: any[] }) {
  const [re, setRe] = useState("");
  const [le, setLe] = useState("");
  const [method, setMethod] = useState<string>(IOP_METHODS[0]);
  const [deletePending, startDelete] = useTransition();
  const [showHistory, setShowHistory] = useState(false);
  const readings: any[] = visit.iopReadings ?? [];

  const priorIOPRows = priorVisits
    .filter((v) => v.iopReadings?.length > 0)
    .flatMap((v) =>
      (v.iopReadings as any[]).map((r: any) => ({
        date: v.date,
        hospitalName: v.hospital?.name,
        re: r.re,
        le: r.le,
        method: r.method,
      }))
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const add = async () => {
    if (!re && !le) return;
    await addIOPReading(visit.id, udid, { re: re ? parseFloat(re) : undefined, le: le ? parseFloat(le) : undefined, method });
    setRe("");
    setLe("");
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-[var(--color-ink-700)]">Intra-Ocular Pressure (mmHg)</p>
        {priorIOPRows.length > 0 && (
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 font-medium px-2.5 py-0.5 rounded-full border border-amber-200 transition-colors"
          >
            History ({priorIOPRows.length} prior readings)
          </button>
        )}
      </div>
      {editable && (
        <div className="flex items-end gap-2 mb-4 flex-wrap">
          <LabeledInput label="RE" value={re} onChange={setRe} compact />
          <LabeledInput label="LE" value={le} onChange={setLe} compact />
          <div>
            <label className="text-xs text-[var(--color-ink-400)]">Method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="mt-1 block rounded-lg border border-[var(--color-border)] text-sm px-2 py-1.5 bg-white">
              {IOP_METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>
          <button onClick={add} className="rounded-lg bg-[var(--color-primary-600)] text-white text-xs font-medium px-3 py-1.5 hover:bg-[var(--color-primary-700)]">
            Add Reading
          </button>
        </div>
      )}
      <div className="overflow-x-auto"><table className="w-full text-sm min-w-[320px]">
        <thead>
          <tr className="text-left text-xs text-[var(--color-ink-400)] uppercase border-b border-[var(--color-border)]">
            <th className="py-1.5">Time</th><th>RE</th><th>LE</th><th>Method</th><th>Source</th><th></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {readings.map((r) => (
            <tr key={r.id}>
              <td className="py-1.5">{format(new Date(r.takenAt), "h:mm a, dd MMM")}</td>
              <td>{r.re ?? "—"}</td>
              <td>{r.le ?? "—"}</td>
              <td>{r.method}</td>
              <td className="text-xs text-[var(--color-ink-400)]">{r.source}</td>
              <td className="py-1.5 pl-2">
                {editable && (
                  <button
                    disabled={deletePending}
                    onClick={() => startDelete(() => removeIOPReading(r.id, udid))}
                    className="text-[var(--color-ink-300)] hover:text-[var(--color-danger-600)] disabled:opacity-40"
                    title="Delete reading"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </td>
            </tr>
          ))}
          {readings.length === 0 && (
            <tr><td colSpan={5} className="py-4 text-center text-[var(--color-ink-400)]">No readings yet.</td></tr>
          )}
        </tbody>
      </table></div>
      {showHistory && priorIOPRows.length > 0 && (
        <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-amber-50 p-3">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Prior IOP Readings</p>
          <div className="overflow-x-auto"><table className="w-full text-sm min-w-[320px]">
            <thead>
              <tr className="text-left text-xs text-[var(--color-ink-400)] uppercase border-b border-amber-200">
                <th className="py-1.5">Visit date</th><th>RE</th><th>LE</th><th>Method</th><th>Hospital</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100">
              {priorIOPRows.map((r, i) => (
                <tr key={i}>
                  <td className="py-1.5">{format(new Date(r.date), "dd MMM yyyy")}</td>
                  <td>{r.re ?? "—"}</td>
                  <td>{r.le ?? "—"}</td>
                  <td>{r.method}</td>
                  <td className="text-xs text-[var(--color-ink-400)]">{r.hospitalName ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </Card>
  );
}

function SegmentTable({
  structures, re, le, setRe, setLe, editable,
}: {
  structures: Record<string, string[]>;
  re: Record<string, string[]>; le: Record<string, string[]>;
  setRe: (v: Record<string, string[]>) => void;
  setLe: (v: Record<string, string[]>) => void;
  editable: boolean;
}) {
  return (
    <div>
      <div className="grid grid-cols-[110px_1fr_1fr] gap-x-3 mb-1.5 px-1">
        <div />
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-primary-700)]">Right Eye (RE)</p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-primary-700)]">Left Eye (LE)</p>
      </div>
      {Object.entries(structures).map(([key, opts]) => (
        <div key={key} className="grid grid-cols-[110px_1fr_1fr] gap-x-3 py-2 border-t border-[var(--color-border)] items-start">
          <p className="text-xs font-medium text-[var(--color-ink-600)] capitalize pt-1">
            {key.replace(/([A-Z])/g, " $1")}
          </p>
          <ChipGroup options={opts} value={re[key] ?? []} onChange={(next) => editable && setRe({ ...re, [key]: next })} />
          <ChipGroup options={opts} value={le[key] ?? []} onChange={(next) => editable && setLe({ ...le, [key]: next })} />
        </div>
      ))}
    </div>
  );
}

function AnteriorSegmentCard({ visit, udid, editable }: { visit: any; udid: string; editable: boolean }) {
  const as = visit.anteriorSegment;
  const [re, setRe] = useState<Record<string, string[]>>(parseJSON(as?.re, {}));
  const [le, setLe] = useState<Record<string, string[]>>(parseJSON(as?.le, {}));

  const state = useAutoSave({ re: JSON.stringify(re), le: JSON.stringify(le) }, async (d) => {
    if (!editable) return;
    await saveAnteriorSegment(visit.id, udid, d);
  });

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-[var(--color-ink-700)]">Anterior Segment</p>
        <SaveIndicator state={state} />
      </div>
      <SegmentTable structures={ANTERIOR_SEGMENT_STRUCTURES} re={re} le={le} setRe={setRe} setLe={setLe} editable={editable} />
    </Card>
  );
}

function PosteriorSegmentCard({ visit, udid, editable }: { visit: any; udid: string; editable: boolean }) {
  const ps = visit.posteriorSegment;
  const [re, setRe] = useState<Record<string, string[]>>(parseJSON(ps?.re, {}));
  const [le, setLe] = useState<Record<string, string[]>>(parseJSON(ps?.le, {}));
  const [notes, setNotes] = useState(ps?.notes ?? "");

  const state = useAutoSave({ re: JSON.stringify(re), le: JSON.stringify(le), notes }, async (d) => {
    if (!editable) return;
    await savePosteriorSegment(visit.id, udid, d);
  });

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-[var(--color-ink-700)]">Posterior Segment</p>
        <SaveIndicator state={state} />
      </div>
      <SegmentTable structures={POSTERIOR_SEGMENT_OPTIONS} re={re} le={le} setRe={setRe} setLe={setLe} editable={editable} />

      {/* CDR row */}
      <div className="grid grid-cols-[110px_1fr_1fr] gap-x-3 py-2 border-t border-[var(--color-border)] items-center">
        <p className="text-xs font-medium text-[var(--color-ink-600)]">CDR</p>
        <LabeledInput label="" value={re["cdr"]?.[0] ?? ""} onChange={(v) => setRe({ ...re, cdr: [v] })} disabled={!editable} compact />
        <LabeledInput label="" value={le["cdr"]?.[0] ?? ""} onChange={(v) => setLe({ ...le, cdr: [v] })} disabled={!editable} compact />
      </div>

      <div className="mt-3">
        <label className="text-xs font-medium text-[var(--color-ink-500)]">Additional Notes</label>
        <textarea disabled={!editable} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
          className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm" />
      </div>
    </Card>
  );
}

function DiplopiaCard({ visit, udid, editable }: { visit: any; udid: string; editable: boolean }) {
  const dc = visit.diplopiaChart;
  const [grid, setGrid] = useState<Record<string, { status: string; notes?: string }>>(parseJSON(dc?.grid, {}));

  const state = useAutoSave(grid, async (g) => {
    if (!editable) return;
    await saveDiplopia(visit.id, udid, JSON.stringify(g));
  });

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-[var(--color-ink-700)]">Diplopia Charting</p>
        <SaveIndicator state={state} />
      </div>
      <p className="text-xs text-[var(--color-ink-400)] mb-3">Click a position to cycle: Not tested -&gt; No diplopia -&gt; Diplopia present</p>
      <DiplopiaGrid
        grid={grid}
        onChange={(pos, status) => editable && setGrid({ ...grid, [pos]: { ...(grid[pos] ?? {}), status } })}
      />
    </Card>
  );
}

function HessCard({ visit, udid, editable }: { visit: any; udid: string; editable: boolean }) {
  const hc = visit.hessChart;
  const [grid, setGrid] = useState<Record<string, any>>(parseJSON(hc?.grid, {}));
  const [interpretation, setInterpretation] = useState(hc?.interpretation ?? "");

  const state = useAutoSave({ grid, interpretation }, async (d) => {
    if (!editable) return;
    await saveHess(visit.id, udid, JSON.stringify(d.grid), d.interpretation);
  });

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-[var(--color-ink-700)]">Hess Charting</p>
        <SaveIndicator state={state} />
      </div>
      <p className="text-xs text-[var(--color-ink-400)] mb-3">
        H: (+) Esotropia / (–) Exotropia · V: (+) Hypertropia / (–) Hypotropia, in Prism Diopters
      </p>
      <HessGrid
        grid={grid}
        onChange={(pos, field, value) =>
          editable && setGrid({ ...grid, [pos]: { ...(grid[pos] ?? {}), [field]: value } })
        }
      />
      <div className="mt-4 max-w-md">
        <label className="text-xs font-medium text-[var(--color-ink-500)]">Interpretation</label>
        <textarea disabled={!editable} value={interpretation} onChange={(e) => setInterpretation(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm" />
      </div>
    </Card>
  );
}

function RetinoscopyCard({ visit, udid, editable }: { visit: any; udid: string; editable: boolean }) {
  const r = visit.retinoscopy;
  const [re, setRe] = useState(r?.re ?? "");
  const [le, setLe] = useState(r?.le ?? "");

  const state = useAutoSave({ re, le }, async (d) => {
    if (!editable) return;
    await saveRetinoscopy(visit.id, udid, d);
  });

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-[var(--color-ink-700)]">Retinoscopy</p>
        <SaveIndicator state={state} />
      </div>
      <EyeColumns>
        <input disabled={!editable} value={re} onChange={(e) => setRe(e.target.value)} placeholder="e.g. +1.50 / -0.50 x 90" className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm" />
        <input disabled={!editable} value={le} onChange={(e) => setLe(e.target.value)} placeholder="e.g. +1.50 / -0.50 x 90" className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm" />
      </EyeColumns>
    </Card>
  );
}

function TearFilmCard({ visit, udid, editable }: { visit: any; udid: string; editable: boolean }) {
  const tf = visit.tearFilm;
  const [data, setData] = useState({
    tbutRe: tf?.tbutRe ?? "",
    tbutLe: tf?.tbutLe ?? "",
    schirmer1Re: tf?.schirmer1Re ?? "",
    schirmer1Le: tf?.schirmer1Le ?? "",
    schirmer2Re: tf?.schirmer2Re ?? "",
    schirmer2Le: tf?.schirmer2Le ?? "",
  });

  const state = useAutoSave(data, async (d) => {
    if (!editable) return;
    const numeric = Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v === "" ? undefined : parseFloat(v as string)]));
    await saveTearFilm(visit.id, udid, numeric);
  });

  const upd = (k: keyof typeof data) => (v: string) => setData({ ...data, [k]: v });

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-[var(--color-ink-700)]">Tear Film - TBUT & Schirmer&apos;s</p>
        <SaveIndicator state={state} />
      </div>
      <EyeColumns>
        <div className="flex flex-col gap-2">
          <LabeledInput label="TBUT (seconds)" value={data.tbutRe} onChange={upd("tbutRe")} disabled={!editable} />
          <LabeledInput label="Schirmer's 1 - no anaesthetic (mm)" value={data.schirmer1Re} onChange={upd("schirmer1Re")} disabled={!editable} />
          <LabeledInput label="Schirmer's 2 - with anaesthetic (mm)" value={data.schirmer2Re} onChange={upd("schirmer2Re")} disabled={!editable} />
        </div>
        <div className="flex flex-col gap-2">
          <LabeledInput label="TBUT (seconds)" value={data.tbutLe} onChange={upd("tbutLe")} disabled={!editable} />
          <LabeledInput label="Schirmer's 1 - no anaesthetic (mm)" value={data.schirmer1Le} onChange={upd("schirmer1Le")} disabled={!editable} />
          <LabeledInput label="Schirmer's 2 - with anaesthetic (mm)" value={data.schirmer2Le} onChange={upd("schirmer2Le")} disabled={!editable} />
        </div>
      </EyeColumns>
    </Card>
  );
}

function LacrimalSacCard({ visit, udid, editable }: { visit: any; udid: string; editable: boolean }) {
  const ls = visit.lacrimalSac;
  const [re, setRe] = useState<string[]>(parseJSON(ls?.re, []));
  const [le, setLe] = useState<string[]>(parseJSON(ls?.le, []));

  const state = useAutoSave({ re: JSON.stringify(re), le: JSON.stringify(le) }, async (d) => {
    if (!editable) return;
    await saveLacrimalSac(visit.id, udid, d);
  });

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-[var(--color-ink-700)]">Lacrimal Sac Syringing</p>
        <SaveIndicator state={state} />
      </div>
      <EyeColumns>
        <ChipGroup options={LACRIMAL_SAC_CHIPS} value={re} onChange={editable ? setRe : () => {}} />
        <ChipGroup options={LACRIMAL_SAC_CHIPS} value={le} onChange={editable ? setLe : () => {}} />
      </EyeColumns>
    </Card>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  disabled,
  compact,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "flex items-center gap-2" : ""}>
      <label className="text-xs text-[var(--color-ink-400)] block">{label}</label>
      <input
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] disabled:bg-[var(--color-surface-sunken)]"
      />
    </div>
  );
}
