"use client";

import { useState, useEffect, useTransition } from "react";
import { Trash2, Plus, X } from "lucide-react";
import { KeywordInput, KeywordTextarea } from "@/components/emr/KeywordField";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { SingleChipSelect } from "@/components/ui/Chip";
import { useAutoSave, SaveIndicator } from "@/lib/useAutoSave";
import { parseJSON } from "@/lib/json";
import { DiplopiaGrid, HessGrid } from "@/components/emr/Grid9Position";
import {
  VA_TEST_METHODS,
  VA_SNELLEN_VALUES,
  IOP_METHODS,
  ANTERIOR_SEGMENT_STRUCTURES,
  POSTERIOR_SEGMENT_OPTIONS,
  LACRIMAL_SAC_CHIPS,
} from "@/lib/constants";
import {
  saveVisualAcuity,
  saveRefraction,
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
import { ChipGroup } from "@/components/ui/Chip";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Toast } from "@/components/ui/Toast";
import { FieldWithHistory, type HistoryEntry } from "@/components/ui/HistoryToggle";

export function OphthalmicExamTab({ visit, priorVisits, udid, role }: { visit: any; priorVisits: any[]; udid: string; role: string }) {
  const refractionistCanEdit = role === "DOCTOR";
  const doctorOnly = role === "DOCTOR";

  useEffect(() => {
    if (role === "DOCTOR") {
      markOphthalmicReviewed(visit.id).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Tabs
      variant="sub"
      defaultTab="va"
      tabs={[
        { id: "va",        label: "Visual Acuity",    content: <VisualAcuityCard visit={visit} udid={udid} editable={refractionistCanEdit} /> },
        { id: "refraction",label: "Refraction",        content: <RefractionCard visit={visit} udid={udid} editable={refractionistCanEdit} priorVisits={priorVisits} /> },
        { id: "cv",        label: "Colour / Contrast", content: <ColourContrastTab visit={visit} udid={udid} editable={refractionistCanEdit} priorVisits={priorVisits} /> },
        { id: "iop",       label: "IOP",               content: <IOPCard visit={visit} udid={udid} editable={refractionistCanEdit} priorVisits={priorVisits} /> },
        { id: "anterior",  label: "Anterior Segment",  content: <AnteriorSegmentCard visit={visit} udid={udid} editable={doctorOnly} priorVisits={priorVisits} /> },
        { id: "posterior", label: "Posterior Segment", content: <PosteriorSegmentCard visit={visit} udid={udid} editable={doctorOnly} priorVisits={priorVisits} /> },
        { id: "tear",      label: "Tear Film",          content: <TearFilmCard visit={visit} udid={udid} editable={doctorOnly} priorVisits={priorVisits} /> },
        { id: "lacrimal",  label: "Lacrimal Sac",       content: <LacrimalSacCard visit={visit} udid={udid} editable={doctorOnly} /> },
        { id: "retino",    label: "Retinoscopy",        content: <RetinoscopyCard visit={visit} udid={udid} editable={doctorOnly} /> },
        { id: "diplopia",  label: "Diplopia Chart",    content: <DiplopiaCard visit={visit} udid={udid} editable={doctorOnly} /> },
        { id: "hess",      label: "Hess Chart",        content: <HessCard visit={visit} udid={udid} editable={doctorOnly} /> },
      ]}
    />
  );
}

function EyeColumns({ children }: { children: [React.ReactNode, React.ReactNode] }) {
  return (
    <div className="flex flex-wrap gap-x-16 gap-y-8">
      <div className="min-w-[220px]">
        <p className="text-xs font-semibold text-[var(--color-primary-700)] uppercase tracking-wide mb-3">Right Eye</p>
        {children[0]}
      </div>
      <div className="min-w-[220px]">
        <p className="text-xs font-semibold text-[var(--color-primary-700)] uppercase tracking-wide mb-3">Left Eye</p>
        {children[1]}
      </div>
    </div>
  );
}

/* ── Visual Acuity ─────────────────────────────────────────────────────── */

const VA_NEAR_VALUES = ["-", "N6", "N8", "N10", "N12", "N18", "N24", "N36", "CF", "HM", "PL", "NPL"];

const DIST_COLS = [
  { key: "unaided",       label: "Unaided"  },
  { key: "pinhole",       label: "Pinhole"  },
  { key: "bestCorrected", label: "Aided"    },
];
const NEAR_COLS = [
  { key: "nearUnaided",       label: "Unaided" },
  { key: "nearBestCorrected", label: "Aided"   },
];

function VisualAcuityCard({ visit, udid, editable }: { visit: any; udid: string; editable: boolean }) {
  const va = visit.visualAcuity;
  const [testMethod, setTestMethod] = useState(va?.testMethod ?? "Snellen");
  const [re, setRe] = useState(
    parseJSON(va?.re, { unaided: "", pinhole: "", bestCorrected: "", nearUnaided: "", nearPinhole: "", nearBestCorrected: "" })
  );
  const [le, setLe] = useState(
    parseJSON(va?.le, { unaided: "", pinhole: "", bestCorrected: "", nearUnaided: "", nearPinhole: "", nearBestCorrected: "" })
  );

  const state = useAutoSave({ testMethod, re: JSON.stringify(re), le: JSON.stringify(le) }, async (d) => {
    if (!editable) return;
    await saveVisualAcuity(visit.id, udid, d);
  });

  const distSel = (eye: any, setEye: any, key: string) => (
    <select
      disabled={!editable}
      value={eye[key] ?? "-"}
      onChange={(e) => setEye({ ...eye, [key]: e.target.value })}
      className="rounded border border-[var(--color-border)] bg-white px-1.5 py-1 text-xs disabled:bg-[var(--color-surface-sunken)] w-20"
    >
      {VA_SNELLEN_VALUES.map((v) => <option key={v} value={v}>{v}</option>)}
    </select>
  );

  const nearSel = (eye: any, setEye: any, key: string) => (
    <select
      disabled={!editable}
      value={eye[key] ?? "-"}
      onChange={(e) => setEye({ ...eye, [key]: e.target.value })}
      className="rounded border border-[var(--color-border)] bg-white px-1.5 py-1 text-xs disabled:bg-[var(--color-surface-sunken)] w-20"
    >
      {VA_NEAR_VALUES.map((v) => <option key={v} value={v}>{v}</option>)}
    </select>
  );

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-[var(--color-ink-700)]">Method:</span>
          <SingleChipSelect options={VA_TEST_METHODS} value={testMethod} onChange={editable ? setTestMethod : () => {}} />
        </div>
        <SaveIndicator state={state} />
      </div>

      {/* Distance VA — measurements as rows, RE/LE as columns */}
      <p className="text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-widest mb-3">Distance</p>
      <div className="overflow-x-auto mb-8">
        <table className="text-xs table-fixed" style={{ width: "auto" }}>
          <colgroup>
            <col style={{ width: 110 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 130 }} />
          </colgroup>
          <thead>
            <tr>
              <th className="pb-3 text-left text-[var(--color-ink-400)] font-medium" />
              <th className="pb-3 text-center text-[var(--color-primary-700)] font-semibold">RE</th>
              <th className="pb-3 text-center text-[var(--color-primary-700)] font-semibold">LE</th>
            </tr>
          </thead>
          <tbody>
            {DIST_COLS.map((c) => (
              <tr key={c.key}>
                <td className="py-3 pr-8 text-left text-[var(--color-ink-500)] font-medium">{c.label}</td>
                <td className="py-3 px-8 text-center">{distSel(re, setRe, c.key)}</td>
                <td className="py-3 px-8 text-center">{distSel(le, setLe, c.key)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Near VA — measurements as rows, RE/LE as columns */}
      <p className="text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-widest mb-3">Near</p>
      <div className="overflow-x-auto">
        <table className="text-xs table-fixed" style={{ width: "auto" }}>
          <colgroup>
            <col style={{ width: 110 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 130 }} />
          </colgroup>
          <thead>
            <tr>
              <th className="pb-3 text-left text-[var(--color-ink-400)] font-medium" />
              <th className="pb-3 text-center text-[var(--color-primary-700)] font-semibold">RE</th>
              <th className="pb-3 text-center text-[var(--color-primary-700)] font-semibold">LE</th>
            </tr>
          </thead>
          <tbody>
            {NEAR_COLS.map((c) => (
              <tr key={c.key}>
                <td className="py-3 pr-8 text-left text-[var(--color-ink-500)] font-medium">{c.label}</td>
                <td className="py-3 px-8 text-center">{nearSel(re, setRe, c.key)}</td>
                <td className="py-3 px-8 text-center">{nearSel(le, setLe, c.key)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ── Refraction value option lists ─────────────────────────────────────── */
const SPH_MAGS  = ["", ...Array.from({ length: 81 }, (_, i) => (i * 0.25).toFixed(2))];
const CYL_MAGS  = ["", ...Array.from({ length: 41 }, (_, i) => (i * 0.25).toFixed(2))];
const ADD_MAGS  = ["", ...Array.from({ length: 16 }, (_, i) => ((i + 1) * 0.25).toFixed(2))];
const AXIS_OPTS = ["", ...Array.from({ length: 180 }, (_, i) => String(i + 1))];

function parseSignedVal(v: string): { sign: "+" | "-"; mag: string } {
  if (!v || v === "+") return { sign: "+", mag: "" };
  if (v === "-") return { sign: "-", mag: "" };
  return v.startsWith("-") ? { sign: "-", mag: v.slice(1) } : { sign: "+", mag: v.replace(/^\+/, "") };
}

/* ── Refraction ────────────────────────────────────────────────────────── */

function RefractionCard({ visit, udid, editable, priorVisits = [] }: { visit: any; udid: string; editable: boolean; priorVisits?: any[] }) {
  const rc = visit.refraction;
  const [re, setRe] = useState(parseJSON(rc?.re, { sph: "", cyl: "", axis: "", va: "", nearSph: "", nearVa: "" }));
  const [le, setLe] = useState(parseJSON(rc?.le, { sph: "", cyl: "", axis: "", va: "", nearSph: "", nearVa: "" }));
  const [showHistory, setShowHistory] = useState(false);
  const [confirmRx, setConfirmRx] = useState<typeof priorRefractions[0] | null>(null);
  const [rxToast, setRxToast] = useState(false);

  type RxFields = { sph: string; cyl: string; axis: string; nearSph: string; va: string; nearVa: string };
  const emptyRx: RxFields = { sph: "", cyl: "", axis: "", nearSph: "", va: "", nearVa: "" };
  const priorRefractions = priorVisits
    .filter((v) => v.refraction)
    .map((v) => ({
      date: v.date,
      re: parseJSON<RxFields>(v.refraction?.re, emptyRx),
      le: parseJSON<RxFields>(v.refraction?.le, emptyRx),
    }));

  const state = useAutoSave({ re: JSON.stringify(re), le: JSON.stringify(le) }, async (d) => {
    if (!editable) return;
    await saveRefraction(visit.id, udid, d);
  });

  const SEL = "rounded border border-[var(--color-border)] bg-white px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-400)] disabled:bg-[var(--color-surface-sunken)]";

  const signedSelect = (label: string, value: string, onChange: (v: string) => void, mags: string[]) => {
    const { sign, mag } = parseSignedVal(value);
    const toggle = () => {
      const ns = sign === "+" ? "-" : "+";
      // Always persist the new sign, even when no magnitude selected yet
      onChange(mag ? `${ns}${mag}` : ns);
    };
    return (
      <div className="flex flex-col gap-0.5">
        <label className="text-[10px] text-[var(--color-ink-400)] font-medium">{label}</label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!editable}
            onClick={toggle}
            className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold border transition-colors disabled:opacity-40"
            style={sign === "-"
              ? { background: "var(--color-primary-600)", color: "#fff", borderColor: "var(--color-primary-600)" }
              : { background: "#fff", color: "var(--color-ink-600)", borderColor: "var(--color-border)" }}
          >
            {sign}
          </button>
          <select
            disabled={!editable}
            value={mag}
            onChange={(e) => onChange(e.target.value ? `${sign}${e.target.value}` : sign)}
            className={`w-20 ${SEL}`}
          >
            {mags.map((m) => <option key={m} value={m}>{m || "—"}</option>)}
          </select>
        </div>
      </div>
    );
  };

  const vaSelect = (label: string, value: string, onChange: (v: string) => void, options: readonly string[] = VA_SNELLEN_VALUES) => (
    <div className="flex flex-col gap-0.5">
      <label className="text-[10px] text-[var(--color-ink-400)] font-medium">{label}</label>
      <select disabled={!editable} value={value || "-"} onChange={(e) => onChange(e.target.value)} className={`w-28 ${SEL}`}>
        {options.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
    </div>
  );

  const eyeFields = (val: typeof re, setVal: typeof setRe) => (
    <div className="flex gap-12 flex-wrap">
      {/* Left — refraction fields */}
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-widest mb-3">Distance</p>
          <div className="flex gap-4 flex-wrap items-end">
            {signedSelect("Sph",   val.sph,  (v) => setVal({ ...val, sph: v }),  SPH_MAGS)}
            {signedSelect("Cyl",   val.cyl,  (v) => setVal({ ...val, cyl: v }),  CYL_MAGS)}
            {signedSelect("Axis°", val.axis, (v) => setVal({ ...val, axis: v }), AXIS_OPTS)}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-widest mb-3">Near</p>
          <div className="flex gap-4 flex-wrap items-end">
            {signedSelect("Sph (Add)", val.nearSph, (v) => setVal({ ...val, nearSph: v }), ADD_MAGS)}
          </div>
        </div>
      </div>

      {/* Right — VA / NV column */}
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-widest mb-3 opacity-0 select-none">VA</p>
          {vaSelect("Resulting VA", val.va, (v) => setVal({ ...val, va: v }))}
        </div>
        <div>
          <p className="text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-widest mb-3 opacity-0 select-none">NV</p>
          {vaSelect("Resulting NV", val.nearVa, (v) => setVal({ ...val, nearVa: v }), VA_NEAR_VALUES)}
        </div>
      </div>
    </div>
  );

  const hasRxData = (rx: typeof re) => Object.values(rx).some(Boolean);

  const loadRx = (pr: typeof priorRefractions[0]) => {
    setRe(pr.re);
    setLe(pr.le);
    setShowHistory(false);
    setRxToast(true);
  };

  const handleHistoryDoubleClick = (pr: typeof priorRefractions[0]) => {
    if (hasRxData(re) || hasRxData(le)) {
      setConfirmRx(pr);
    } else {
      loadRx(pr);
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-[var(--color-ink-700)]">Refractive Correction</p>
        <div className="flex items-center gap-2">
          {priorRefractions.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 font-medium px-2.5 py-0.5 rounded-full border border-amber-200 transition-colors"
            >
              History ({priorRefractions.length})
            </button>
          )}
          <SaveIndicator state={state} />
        </div>
      </div>
      <EyeColumns>
        {eyeFields(re, setRe)}
        {eyeFields(le, setLe)}
      </EyeColumns>

      {showHistory && priorRefractions.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Previous Spectacles</p>
            <p className="text-[10px] text-amber-600">Double-click a record to load it</p>
          </div>
          {priorRefractions.map((pr, i) => (
            <div
              key={i}
              onDoubleClick={() => handleHistoryDoubleClick(pr)}
              title="Double-click to load this prescription"
              className="cursor-pointer rounded-xl p-2 -mx-2 hover:bg-amber-100 transition-colors select-none"
            >
              <p className="text-[11px] font-bold text-amber-800 mb-2">{format(new Date(pr.date), "dd-MMM-yyyy")}</p>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="text-left text-[var(--color-ink-400)] font-medium pb-1.5 w-28" />
                    <th className="text-center text-[var(--color-primary-700)] font-semibold pb-1.5 w-28">RE</th>
                    <th className="text-center text-[var(--color-primary-700)] font-semibold pb-1.5 w-28">LE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100">
                  {[
                    { label: "Sph",          re: pr.re.sph,    le: pr.le.sph },
                    { label: "Cyl",          re: pr.re.cyl,    le: pr.le.cyl },
                    { label: "Axis°",        re: pr.re.axis,   le: pr.le.axis },
                    { label: "Resulting VA", re: pr.re.va,     le: pr.le.va },
                    { label: "Add",          re: pr.re.nearSph,le: pr.le.nearSph },
                    { label: "Resulting NV", re: pr.re.nearVa, le: pr.le.nearVa },
                  ].map(({ label, re, le }) => (
                    <tr key={label}>
                      <td className="py-1 text-[var(--color-ink-500)] font-medium">{label}</td>
                      <td className="py-1 text-center text-[var(--color-ink-800)]">{re || "—"}</td>
                      <td className="py-1 text-center text-[var(--color-ink-800)]">{le || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {i < priorRefractions.length - 1 && <div className="mt-3 border-t border-amber-200" />}
            </div>
          ))}
        </div>
      )}

      {confirmRx && (
        <ConfirmDialog
          title="Load Previous Record?"
          message="Loading this history will replace the current unsaved values. Do you want to continue?"
          onConfirm={() => { loadRx(confirmRx); setConfirmRx(null); }}
          onCancel={() => setConfirmRx(null)}
        />
      )}
      {rxToast && (
        <Toast message="Previous record loaded successfully." onDone={() => setRxToast(false)} />
      )}
    </Card>
  );
}

/* ── Colour Vision + Contrast Vision (combined tab) ─────────────────────── */

const CV_OPTIONS = ["Normal", "Defective", "Not Tested"] as const;
type CVResult = typeof CV_OPTIONS[number] | "";

const CV_METHODS = ["Ishihara", "D-15 Farnsworth", "Lanthony D-15", "HRR", "City University"] as const;
const CS_METHODS = ["Pelli-Robson", "Mars Letter CS", "Vistech", "FACT"] as const;

function ColourContrastTab({ visit, udid, editable, priorVisits = [] }: { visit: any; udid: string; editable: boolean; priorVisits?: any[] }) {
  const cv = visit.colourVisionCS;
  const storedRe = parseJSON(cv?.re, {}) as any;
  const storedLe = parseJSON(cv?.le, {}) as any;

  // Single method for both eyes
  const [cvMethod, setCvMethod] = useState<string>(storedRe.cvMethod ?? "Ishihara");
  const [reResult, setReResult] = useState<CVResult>(storedRe.result ?? "");
  const [leResult, setLeResult] = useState<CVResult>(storedLe.result ?? "");
  const [reNotes, setReNotes]   = useState<string>(storedRe.notes ?? "");
  const [leNotes, setLeNotes]   = useState<string>(storedLe.notes ?? "");

  const [csMethod, setCsMethod] = useState<string>(storedRe.csMethod ?? "Pelli-Robson");
  const [csReResult, setCsReResult] = useState<CVResult>(storedRe.csResult ?? "");
  const [csLeResult, setCsLeResult] = useState<CVResult>(storedLe.csResult ?? "");
  const [csReNotes, setCsReNotes]   = useState<string>(storedRe.csNotes ?? "");
  const [csLeNotes, setCsLeNotes]   = useState<string>(storedLe.csNotes ?? "");

  const state = useAutoSave(
    {
      re: JSON.stringify({ cvMethod, result: reResult, notes: reNotes, csMethod, csResult: csReResult, csNotes: csReNotes }),
      le: JSON.stringify({ cvMethod, result: leResult, notes: leNotes, csMethod, csResult: csLeResult, csNotes: csLeNotes }),
    },
    async (d) => { if (!editable) return; await saveColourVision(visit.id, udid, d); }
  );

  const priorCv = priorVisits
    .filter((v) => v.colourVisionCS)
    .map((v) => ({
      date: v.date,
      re: parseJSON(v.colourVisionCS?.re, {}) as any,
      le: parseJSON(v.colourVisionCS?.le, {}) as any,
    }));

  const resultBtns = (result: CVResult, setResult: (v: CVResult) => void) => CV_OPTIONS.map((opt) => (
    <button
      key={opt}
      disabled={!editable}
      onClick={() => setResult(result === opt ? "" : opt)}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
        result === opt
          ? opt === "Normal"    ? "bg-emerald-100 border-emerald-400 text-emerald-700"
          : opt === "Defective" ? "bg-red-100 border-red-400 text-red-700"
          :                       "bg-[var(--color-surface-sunken)] border-[var(--color-ink-300)] text-[var(--color-ink-500)]"
          : "bg-white border-[var(--color-border)] text-[var(--color-ink-600)] hover:border-[var(--color-primary-400)]"
      } disabled:cursor-default`}
    >
      {opt}
    </button>
  ));

  return (
    <div className="flex flex-col gap-4">
      <SaveIndicator state={state} />

      {/* Colour Vision */}
      <Card>
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <p className="text-sm font-medium text-[var(--color-ink-700)]">Colour Vision</p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-ink-400)]">Method:</span>
            <select
              disabled={!editable}
              value={cvMethod}
              onChange={(e) => setCvMethod(e.target.value)}
              className="rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1 text-xs disabled:bg-[var(--color-surface-sunken)]"
            >
              {CV_METHODS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-28 gap-y-8 mt-3">
          {[
            { label: "Right Eye", result: reResult, setResult: setReResult, notes: reNotes, setNotes: setReNotes },
            { label: "Left Eye",  result: leResult, setResult: setLeResult, notes: leNotes, setNotes: setLeNotes },
          ].map(({ label, result, setResult, notes, setNotes }) => (
            <div key={label} className="flex flex-col gap-4 min-w-[220px]">
              <p className="text-xs font-semibold text-[var(--color-primary-700)] uppercase tracking-wide">{label}</p>
              <div className="flex gap-2 flex-wrap">{resultBtns(result, setResult)}</div>
              <KeywordInput fieldKey={`cv_${label}`} value={notes} onChange={setNotes} disabled={!editable} placeholder="Notes..." className="w-56 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs disabled:bg-[var(--color-surface-sunken)]" />
            </div>
          ))}
        </div>
        {priorCv.length > 0 && (
          <div className="mt-5">
            <p className="text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-wide mb-1.5">Previous</p>
            {priorCv.slice(0, 3).map((p, i) => (
              <p key={i} className="text-xs text-[var(--color-ink-400)]">
                {format(new Date(p.date), "dd-MMM-yyyy")} – RE: {p.re.result || "—"} · LE: {p.le.result || "—"} ({p.re.cvMethod || cvMethod})
              </p>
            ))}
          </div>
        )}
      </Card>

      {/* Contrast Vision */}
      <Card>
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <p className="text-sm font-medium text-[var(--color-ink-700)]">Contrast Vision</p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-ink-400)]">Method:</span>
            <select
              disabled={!editable}
              value={csMethod}
              onChange={(e) => setCsMethod(e.target.value)}
              className="rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1 text-xs disabled:bg-[var(--color-surface-sunken)]"
            >
              {CS_METHODS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-28 gap-y-8 mt-3">
          {[
            { label: "Right Eye", result: csReResult, setResult: setCsReResult, notes: csReNotes, setNotes: setCsReNotes },
            { label: "Left Eye",  result: csLeResult, setResult: setCsLeResult, notes: csLeNotes, setNotes: setCsLeNotes },
          ].map(({ label, result, setResult, notes, setNotes }) => (
            <div key={label} className="flex flex-col gap-4 min-w-[220px]">
              <p className="text-xs font-semibold text-[var(--color-primary-700)] uppercase tracking-wide">{label}</p>
              <div className="flex gap-2 flex-wrap">{resultBtns(result, setResult)}</div>
              <KeywordInput fieldKey={`cs_${label}`} value={notes} onChange={setNotes} disabled={!editable} placeholder="Notes..." className="w-56 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs disabled:bg-[var(--color-surface-sunken)]" />
            </div>
          ))}
        </div>
        {priorCv.length > 0 && (
          <div className="mt-5">
            <p className="text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-wide mb-1.5">Previous</p>
            {priorCv.slice(0, 3).map((p, i) => (
              <p key={i} className="text-xs text-[var(--color-ink-400)]">
                {format(new Date(p.date), "dd-MMM-yyyy")} – RE: {p.re.csResult || "—"} · LE: {p.le.csResult || "—"} ({p.re.csMethod || csMethod})
              </p>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ── IOP ──────────────────────────────────────────────────────────────── */

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
        re: r.re, le: r.le, method: r.method,
      }))
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const add = async () => {
    if (!re && !le) return;
    await addIOPReading(visit.id, udid, { re: re ? parseFloat(re) : undefined, le: le ? parseFloat(le) : undefined, method });
    setRe(""); setLe("");
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
        <div className="flex items-end gap-3 mb-4 flex-wrap">
          {/* Method first */}
          <div>
            <label className="text-xs text-[var(--color-ink-400)] block mb-1">Method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)}
              className="rounded-lg border border-[var(--color-border)] text-sm px-2.5 py-1.5 bg-white">
              {IOP_METHODS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <LabeledInput label="RE" value={re} onChange={setRe} compact />
          <LabeledInput label="LE" value={le} onChange={setLe} compact />
          <button onClick={add}
            className="rounded-lg bg-[var(--color-primary-600)] text-white text-xs font-medium px-3 py-1.5 hover:bg-[var(--color-primary-700)]">
            Add Reading
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[320px]">
          <thead>
            <tr className="text-left text-xs text-[var(--color-ink-400)] uppercase border-b border-[var(--color-border)]">
              <th className="py-1.5 pr-3">Eye</th>
              <th className="pr-3">Method</th>
              <th className="pr-3">Value (mmHg)</th>
              <th className="pr-3">Time</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {readings.flatMap((r) => {
              const rows = [];
              if (r.re != null) rows.push({ id: r.id, eye: "RE", value: r.re, method: r.method, takenAt: r.takenAt, isFirst: true, r });
              if (r.le != null) rows.push({ id: r.id + "_le", eye: "LE", value: r.le, method: r.method, takenAt: r.takenAt, isFirst: r.re == null, r });
              return rows;
            }).map((row) => (
              <tr key={row.id}>
                <td className="py-1.5 pr-3 font-semibold text-[var(--color-primary-700)]">{row.eye}</td>
                <td className="pr-3">{row.method}</td>
                <td className="pr-3 font-medium">{row.value}</td>
                <td className="text-xs text-[var(--color-ink-400)] pr-3">{format(new Date(row.takenAt), "h:mm a, dd MMM")}</td>
                <td className="py-1.5">
                  {editable && row.isFirst && (
                    <button disabled={deletePending}
                      onClick={() => startDelete(() => removeIOPReading(row.r.id, udid))}
                      className="text-[var(--color-ink-300)] hover:text-[var(--color-danger-600)] disabled:opacity-40"
                      title="Delete reading">
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
        </table>
      </div>

      {showHistory && priorIOPRows.length > 0 && (
        <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-amber-50 p-3">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Prior IOP Readings</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[320px]">
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
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ── Anterior Segment — text input + predefined keyword chips ─────────────── */

const AS_KEYS = Object.keys(ANTERIOR_SEGMENT_STRUCTURES) as (keyof typeof ANTERIOR_SEGMENT_STRUCTURES)[];

function toLabel(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

const CUSTOM_KW_KEY = (structureKey: string, eye: string) => `seg_custom_${structureKey}_${eye}`;

function SegmentEyeInput({
  structureKey,
  options,
  eye,
  placeholder,
  value,
  onChange,
  disabled,
  history,
}: {
  structureKey: string;
  options: string[];
  eye: "RE" | "LE";
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  history?: HistoryEntry[];
}) {
  const lsKey = CUSTOM_KW_KEY(structureKey, eye);
  const [customKws, setCustomKws] = useState<string[]>([]);
  useEffect(() => {
    try { setCustomKws(JSON.parse(localStorage.getItem(lsKey) ?? "[]")); } catch { setCustomKws([]); }
  }, [lsKey]);

  const saveCustomKws = (kws: string[]) => {
    setCustomKws(kws);
    localStorage.setItem(lsKey, JSON.stringify(kws));
  };

  const append = (kw: string) => {
    onChange(value ? `${value}, ${kw}` : kw);
  };

  const addKeyword = () => {
    const typed = value.split(",").map((s) => s.trim()).filter(Boolean).pop() ?? "";
    if (!typed || options.includes(typed) || customKws.includes(typed)) return;
    saveCustomKws([...customKws, typed]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") addKeyword();
  };

  const removeCustomKw = (kw: string) => {
    saveCustomKws(customKws.filter((k) => k !== kw));
  };

  const ph = placeholder ?? `${toLabel(structureKey)} ${eye}...`;

  const content = (
    <div className="flex flex-col gap-1.5">
      <input
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={ph}
        className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] disabled:bg-[var(--color-surface-sunken)]"
      />
      {!disabled && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={addKeyword}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-[var(--color-primary-300)] bg-[var(--color-primary-50)] text-[10px] font-medium text-[var(--color-primary-700)] hover:bg-[var(--color-primary-100)] transition-colors whitespace-nowrap"
          >
            <Plus size={11} strokeWidth={2.5} />
            Keyword
          </button>
          {customKws.map((kw) => (
            <span key={kw} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-[var(--color-primary-300)] bg-[var(--color-primary-50)] text-[11px] text-[var(--color-primary-700)]">
              <button type="button" onClick={() => append(kw)} className="hover:underline">{kw}</button>
              <button type="button" onClick={() => removeCustomKw(kw)} className="ml-0.5 text-[var(--color-ink-400)] hover:text-red-500 transition-colors">
                <X size={9} strokeWidth={2.5} />
              </button>
            </span>
          ))}
        </div>
      )}
      {!disabled && options.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => append(opt)}
              className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full border border-[var(--color-border)] bg-white text-[11px] text-[var(--color-ink-500)] hover:bg-[var(--color-primary-50)] hover:border-[var(--color-primary-300)] hover:text-[var(--color-primary-700)] transition-colors"
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  if (history) {
    return (
      <FieldWithHistory
        history={history}
        currentValue={value}
        onLoad={disabled ? undefined : onChange}
      >
        {content}
      </FieldWithHistory>
    );
  }

  return content;
}

function SegmentHistory({ priorVisits, dataKey }: { priorVisits: any[]; dataKey: "anteriorSegment" | "posteriorSegment" }) {
  const [open, setOpen] = useState(false);
  const rows = priorVisits.filter((v) => {
    const d = v[dataKey];
    if (!d) return false;
    const re = parseJSON<Record<string, string>>(d.re, {});
    const le = parseJSON<Record<string, string>>(d.le, {});
    return Object.values(re).some(Boolean) || Object.values(le).some(Boolean);
  });
  if (!rows.length) return null;
  return (
    <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 font-medium px-2.5 py-0.5 rounded-full border border-amber-200 transition-colors mb-2"
      >
        <span>History ({rows.length})</span>
      </button>
      {open && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-3 max-h-64 overflow-y-auto scrollbar-thin">
          {rows.map((v, i) => {
            const d = v[dataKey];
            const re = parseJSON<Record<string, string>>(d.re, {});
            const le = parseJSON<Record<string, string>>(d.le, {});
            return (
              <div key={i}>
                <p className="text-[10px] font-bold text-amber-700 mb-1">{format(new Date(v.date), "d MMM yyyy")}{v.hospital?.name ? ` · ${v.hospital.name}` : ""}</p>
                {Object.entries(re).filter(([, val]) => val).map(([k, val]) => (
                  <p key={`re-${k}`} className="text-xs text-[var(--color-ink-700)] border-l-2 border-amber-400 pl-2 mb-0.5">
                    <span className="font-medium text-[var(--color-ink-500)]">RE {toLabel(k)}: </span>{val}
                  </p>
                ))}
                {Object.entries(le).filter(([, val]) => val).map(([k, val]) => (
                  <p key={`le-${k}`} className="text-xs text-[var(--color-ink-700)] border-l-2 border-amber-300 pl-2 mb-0.5">
                    <span className="font-medium text-[var(--color-ink-500)]">LE {toLabel(k)}: </span>{val}
                  </p>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AnteriorSegmentCard({ visit, udid, editable, priorVisits = [] }: { visit: any; udid: string; editable: boolean; priorVisits?: any[] }) {
  const as_ = visit.anteriorSegment;
  const [re, setRe] = useState<Record<string, string>>(parseJSON(as_?.re, {}));
  const [le, setLe] = useState<Record<string, string>>(parseJSON(as_?.le, {}));

  const state = useAutoSave({ re: JSON.stringify(re), le: JSON.stringify(le) }, async (d) => {
    if (!editable) return;
    await saveAnteriorSegment(visit.id, udid, d);
  });

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-[var(--color-ink-700)]">Anterior Segment</p>
        <SaveIndicator state={state} />
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[140px_1fr_1fr] gap-x-4 mb-3 px-1 border-b border-[var(--color-border)] pb-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-400)]">Structure</p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-primary-700)]">Right Eye</p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-primary-700)]">Left Eye</p>
      </div>

      <div className="flex flex-col gap-5">
        {AS_KEYS.map((key) => (
          <div key={key} className="grid grid-cols-[140px_1fr_1fr] gap-x-6 items-start">
            <p className="text-sm font-medium text-[var(--color-ink-700)] pt-2">{toLabel(key)}</p>
            <SegmentEyeInput structureKey={key} options={ANTERIOR_SEGMENT_STRUCTURES[key] ?? []} eye="RE" value={re[key] ?? ""} onChange={(v) => setRe({ ...re, [key]: v })} disabled={!editable} />
            <SegmentEyeInput structureKey={key} options={ANTERIOR_SEGMENT_STRUCTURES[key] ?? []} eye="LE" value={le[key] ?? ""} onChange={(v) => setLe({ ...le, [key]: v })} disabled={!editable} />
          </div>
        ))}
      </div>

      {/* Per-eye notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 pt-4 border-t border-[var(--color-border)]">
        <div>
          <label className="text-xs font-medium text-[var(--color-ink-500)] block mb-1">RE Notes</label>
          <textarea
            disabled={!editable}
            value={re._notes ?? ""}
            onChange={(e) => setRe({ ...re, _notes: e.target.value })}
            rows={2}
            placeholder="Any additional RE observations..."
            className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm disabled:bg-[var(--color-surface-sunken)]"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-[var(--color-ink-500)] block mb-1">LE Notes</label>
          <textarea
            disabled={!editable}
            value={le._notes ?? ""}
            onChange={(e) => setLe({ ...le, _notes: e.target.value })}
            rows={2}
            placeholder="Any additional LE observations..."
            className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm disabled:bg-[var(--color-surface-sunken)]"
          />
        </div>
      </div>

      <SegmentHistory priorVisits={priorVisits} dataKey="anteriorSegment" />
    </Card>
  );
}

/* ── Posterior Segment ───────────────────────────────────────────────────── */

const PS_KEYS = Object.keys(POSTERIOR_SEGMENT_OPTIONS) as (keyof typeof POSTERIOR_SEGMENT_OPTIONS)[];

const PS_LABELS: Record<string, string> = {
  media:          "Media",
  discSize:       "Disc Size",
  discShape:      "Disc Shape",
  discColour:     "Disc Colour",
  discVessels:    "Disc Vessels",
  discMargin:     "Disc Margin",
  cdr:            "CDR",
  nrr:            "NRR",
  macula:         "Macula",
  retinalVessels: "Retinal Vessels",
  background:     "Background",
};

const PS_PLACEHOLDERS: Record<string, string> = {
  media:          "Media clarity",
  discSize:       "Normal / Small / Large",
  discShape:      "Round / Oval",
  discColour:     "Pink / Pale / Hyperaemic",
  discVessels:    "Normal / NVD",
  discMargin:     "Disc margin findings",
  cdr:            "e.g. 0.4",
  nrr:            "Intact / Notched / Thinned",
  macula:         "Macular findings",
  retinalVessels: "Vascular findings",
  background:     "Background retina",
};

function PosteriorSegmentCard({ visit, udid, editable, priorVisits = [] }: { visit: any; udid: string; editable: boolean; priorVisits?: any[] }) {
  const ps = visit.posteriorSegment;
  const [re, setRe] = useState<Record<string, string>>(parseJSON(ps?.re, {}));
  const [le, setLe] = useState<Record<string, string>>(parseJSON(ps?.le, {}));

  const state = useAutoSave({ re: JSON.stringify(re), le: JSON.stringify(le) }, async (d) => {
    if (!editable) return;
    await savePosteriorSegment(visit.id, udid, d);
  });

  const histFor = (key: string, eyeKey: "re" | "le"): HistoryEntry[] =>
    priorVisits
      .filter((v) => v.posteriorSegment)
      .map((v) => ({
        date: v.date,
        value: parseJSON<Record<string, string>>(v.posteriorSegment?.[eyeKey], {})[key] ?? "",
        hospitalName: v.hospital?.name,
      }))
      .filter((h) => h.value);

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-[var(--color-ink-700)]">Posterior Segment</p>
        <SaveIndicator state={state} />
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[140px_1fr_1fr] gap-x-4 mb-3 px-1 border-b border-[var(--color-border)] pb-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-400)]">Structure</p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-primary-700)]">Right Eye</p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-primary-700)]">Left Eye</p>
      </div>

      <div className="flex flex-col gap-5">
        {PS_KEYS.map((key) => (
          <div key={key} className="grid grid-cols-[140px_1fr_1fr] gap-x-6 items-start">
            <p className="text-sm font-medium text-[var(--color-ink-700)] pt-2 whitespace-pre-line">
              {PS_LABELS[key] ?? toLabel(key)}
            </p>
            <SegmentEyeInput
              structureKey={key}
              options={POSTERIOR_SEGMENT_OPTIONS[key] ?? []}
              eye="RE"
              placeholder={`${PS_PLACEHOLDERS[key] ?? toLabel(key)} RE...`}
              value={re[key] ?? ""}
              onChange={(v) => setRe({ ...re, [key]: v })}
              disabled={!editable}
              history={histFor(key, "re")}
            />
            <SegmentEyeInput
              structureKey={key}
              options={POSTERIOR_SEGMENT_OPTIONS[key] ?? []}
              eye="LE"
              placeholder={`${PS_PLACEHOLDERS[key] ?? toLabel(key)} LE...`}
              value={le[key] ?? ""}
              onChange={(v) => setLe({ ...le, [key]: v })}
              disabled={!editable}
              history={histFor(key, "le")}
            />
          </div>
        ))}
      </div>

      {/* Per-eye notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 pt-4 border-t border-[var(--color-border)]">
        <div>
          <label className="text-xs font-medium text-[var(--color-ink-500)] block mb-1">RE Notes</label>
          <textarea
            disabled={!editable}
            value={re._notes ?? ""}
            onChange={(e) => setRe({ ...re, _notes: e.target.value })}
            rows={2}
            placeholder="Any additional RE observations..."
            className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm disabled:bg-[var(--color-surface-sunken)]"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-[var(--color-ink-500)] block mb-1">LE Notes</label>
          <textarea
            disabled={!editable}
            value={le._notes ?? ""}
            onChange={(e) => setLe({ ...le, _notes: e.target.value })}
            rows={2}
            placeholder="Any additional LE observations..."
            className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm disabled:bg-[var(--color-surface-sunken)]"
          />
        </div>
      </div>

      <SegmentHistory priorVisits={priorVisits} dataKey="posteriorSegment" />
    </Card>
  );
}

/* ── Diplopia / Hess / Retinoscopy / Tear Film ───────────────────────────── */

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
      <p className="text-xs text-[var(--color-ink-400)] mb-3">Click a position to cycle: Not tested → No diplopia → Diplopia present</p>
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
        <textarea disabled={!editable} value={interpretation} onChange={(e) => setInterpretation(e.target.value)} rows={2}
          className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm" />
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
        <input disabled={!editable} value={re} onChange={(e) => setRe(e.target.value)} placeholder="e.g. +1.50 / -0.50 x 90"
          className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm" />
        <input disabled={!editable} value={le} onChange={(e) => setLe(e.target.value)} placeholder="e.g. +1.50 / -0.50 x 90"
          className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm" />
      </EyeColumns>
    </Card>
  );
}

function TearFilmCard({ visit, udid, editable, priorVisits = [] }: { visit: any; udid: string; editable: boolean; priorVisits?: any[] }) {
  const tf = visit.tearFilm;
  const [data, setData] = useState({
    tbutRe: tf?.tbutRe ?? "", tbutLe: tf?.tbutLe ?? "",
    schirmer1Re: tf?.schirmer1Re ?? "", schirmer1Le: tf?.schirmer1Le ?? "",
    schirmer2Re: tf?.schirmer2Re ?? "", schirmer2Le: tf?.schirmer2Le ?? "",
  });
  const [showHistory, setShowHistory] = useState(false);

  const priorTf = priorVisits.filter((v) => v.tearFilm);

  const state = useAutoSave(data, async (d) => {
    if (!editable) return;
    const numeric = Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v === "" ? undefined : parseFloat(v as string)]));
    await saveTearFilm(visit.id, udid, numeric);
  });

  const upd = (k: keyof typeof data) => (v: string) => setData({ ...data, [k]: v });

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-[var(--color-ink-700)]">Tear Film — TBUT &amp; Schirmer&apos;s</p>
        <div className="flex items-center gap-2">
          {priorTf.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 font-medium px-2.5 py-0.5 rounded-full border border-amber-200 transition-colors"
            >
              History ({priorTf.length})
            </button>
          )}
          <SaveIndicator state={state} />
        </div>
      </div>
      <EyeColumns>
        <div className="flex flex-col gap-2">
          <LabeledInput label="TBUT (seconds)" value={data.tbutRe} onChange={upd("tbutRe")} disabled={!editable} numeric />
          <LabeledInput label="Schirmer's 1 – no anaesthetic (mm)" value={data.schirmer1Re} onChange={upd("schirmer1Re")} disabled={!editable} numeric />
          <LabeledInput label="Schirmer's 2 – with anaesthetic (mm)" value={data.schirmer2Re} onChange={upd("schirmer2Re")} disabled={!editable} numeric />
        </div>
        <div className="flex flex-col gap-2">
          <LabeledInput label="TBUT (seconds)" value={data.tbutLe} onChange={upd("tbutLe")} disabled={!editable} numeric />
          <LabeledInput label="Schirmer's 1 – no anaesthetic (mm)" value={data.schirmer1Le} onChange={upd("schirmer1Le")} disabled={!editable} numeric />
          <LabeledInput label="Schirmer's 2 – with anaesthetic (mm)" value={data.schirmer2Le} onChange={upd("schirmer2Le")} disabled={!editable} numeric />
        </div>
      </EyeColumns>

      {showHistory && priorTf.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Previous Tear Film</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[360px]">
              <thead>
                <tr className="text-left text-[var(--color-ink-400)] border-b border-amber-200">
                  <th className="pb-1.5">Date</th>
                  <th>TBUT RE</th><th>TBUT LE</th>
                  <th>Sch1 RE</th><th>Sch1 LE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100">
                {priorTf.map((v, i) => (
                  <tr key={i}>
                    <td className="py-1.5">{format(new Date(v.date), "dd-MMM-yyyy")}</td>
                    <td>{v.tearFilm.tbutRe ?? "—"}</td>
                    <td>{v.tearFilm.tbutLe ?? "—"}</td>
                    <td>{v.tearFilm.schirmer1Re ?? "—"}</td>
                    <td>{v.tearFilm.schirmer1Le ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ── Lacrimal Sac ─────────────────────────────────────────────────────────── */

function LacrimalSacCard({ visit, udid, editable }: { visit: any; udid: string; editable: boolean }) {
  const ls = visit.lacrimalSac;
  const storedRe = parseJSON(ls?.re, {}) as any;
  const storedLe = parseJSON(ls?.le, {}) as any;

  const [reChips, setReChips]     = useState<string[]>(Array.isArray(storedRe) ? storedRe : (storedRe.chips ?? []));
  const [leChips, setLeChips]     = useState<string[]>(Array.isArray(storedLe) ? storedLe : (storedLe.chips ?? []));
  const [reFindings, setReFindings] = useState<string>(Array.isArray(storedRe) ? "" : (storedRe.findings ?? ""));
  const [leFindings, setLeFindings] = useState<string>(Array.isArray(storedLe) ? "" : (storedLe.findings ?? ""));

  const state = useAutoSave(
    {
      re: JSON.stringify({ chips: reChips, findings: reFindings }),
      le: JSON.stringify({ chips: leChips, findings: leFindings }),
    },
    async (d) => { if (!editable) return; await saveLacrimalSac(visit.id, udid, d); }
  );

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-[var(--color-ink-700)]">Lacrimal Sac Syringing</p>
        <SaveIndicator state={state} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-[var(--color-primary-700)] uppercase tracking-wide">Right Eye</p>
          <KeywordInput fieldKey="lacrimal_re_findings" value={reFindings} onChange={setReFindings} disabled={!editable} placeholder="Enter findings..." />
          <ChipGroup options={LACRIMAL_SAC_CHIPS} value={reChips} onChange={editable ? setReChips : () => {}} chipClassName="chip-sm" />
        </div>
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-[var(--color-primary-700)] uppercase tracking-wide">Left Eye</p>
          <KeywordInput fieldKey="lacrimal_le_findings" value={leFindings} onChange={setLeFindings} disabled={!editable} placeholder="Enter findings..." />
          <ChipGroup options={LACRIMAL_SAC_CHIPS} value={leChips} onChange={editable ? setLeChips : () => {}} chipClassName="chip-sm" />
        </div>
      </div>
    </Card>
  );
}

/* ── Shared helpers ──────────────────────────────────────────────────────── */

function LabeledInput({
  label, value, onChange, disabled, compact, numeric,
}: {
  label: string; value: string; onChange: (v: string) => void; disabled?: boolean; compact?: boolean; numeric?: boolean;
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (numeric && v !== "" && !/^\d*\.?\d*$/.test(v)) return;
    onChange(v);
  };

  return (
    <div className={compact ? "flex items-center gap-2" : ""}>
      <label className="text-xs text-[var(--color-ink-400)] block">{label}</label>
      <input
        disabled={disabled}
        value={value}
        onChange={handleChange}
        inputMode={numeric ? "decimal" : undefined}
        className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] disabled:bg-[var(--color-surface-sunken)]"
      />
    </div>
  );
}
