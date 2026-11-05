"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addMonths, eachDayOfInterval, endOfMonth, format, getDay, isSameDay, startOfMonth, subMonths } from "date-fns";
import {
  ArrowLeft, BedDouble, CheckCircle2, Circle, Lock, Camera, Plus, X, AlertTriangle, User, FileText,
  Scissors, LogOut, Loader2, Pencil, History, Stethoscope, ShieldCheck, ChevronLeft, ChevronRight, CalendarDays, Printer,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { fileHref } from "@/lib/file-href";
import {
  ADMISSION_TYPE_LABEL, IPD_FORMS, IPD_STATUS_LABEL, admissionTypeText, attachOpen, canDischargeNow, canGoToOt, formEditable,
  formsFor, isCustomKey, isDischargeData, logsOpen, normalizeDischarge, type DischargeData, type IpdStatus, type LogEntry,
} from "@/lib/ipd";
import {
  isV2, type ChecklistData, type ConsentsData, type EducationData, type FormContext, type ImplantData, type NurseData,
  type OtNotesData, type PostOpData, type TreatmentData,
} from "@/lib/ipd-forms";
import { SaveIndicator, useAutoSave } from "@/lib/useAutoSave";
import {
  ChecklistForm, ConsentsForm, DoctorNoteComposer, DoctorNoteText, EducationForm, ImplantForm, InvestigationsForm, NurseForm,
  OtNotesForm, PostOpForm, TreatmentForm, type FileInfo, type NewLog,
} from "./IpdForms";
import {
  addCustomForm, addDoctorNote, addFormAttachment, addFormLog, changeAdmissionType, confirmDischarge,
  freezeForm, requestDischargeOtp, saveForm, shiftToOt, updateAdmissionDetails,
} from "../actions";
import { useVisitSummaryState, VisitSummaryTabBody } from "../../patients/[udid]/VisitSummaryTabs";
import { DischargeEditor, type DischargeContext } from "./DischargeEditor";

/* ── Types ─────────────────────────────────────────────────────────────── */

interface Attachment { ref: string; name: string; at: string; by: string }
// Form JSON: the shape depends on the form (see the data shapes in lib/ipd)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FormJson = Record<string, any>;
interface FormRow {
  key: string; title: string; data: FormJson; attachments: Attachment[];
  frozen: boolean; frozenAt: string | null; frozenBy: string | null;
}

export interface FileData {
  id: string;
  visitId: string;
  udid: string;
  returnTo: string;
  patient: { name: string; age: number; sex: string; id: string; photoUrl: string | null };
  doctor: string;
  hospital: string;
  letterhead: { hospital: string; address: string | null; contact: string | null; logoUrl: string | null; doctor: string; qualifications: string | null; regNo: string | null };
  complaint: string | null;
  diagnoses: { description: string; laterality: string | null }[];
  type: string;
  typeOther: string | null;
  reason: string | null;
  surgery: string | null;
  laterality: string | null;
  implant: string | null;
  anaesthesia: string | null;
  surgeryDate: string | null;
  admittedOn: string;
  expectedDischarge: string | null;
  ward: string | null;
  floor: string | null;
  fileNo: string | null;
  status: string;
  shiftedToOtAt: string | null;
  returnedFromOtAt: string | null;
  dischargedAt: string | null;
  dischargedBy: string | null;
  dischargeNotes: string | null;
  payment: { type: string | null; mode: string | null; scheme: string | null; policy: string | null; eligibleBy: string | null; eligibleAt: string | null } | null;
  forms: FormRow[];
  defaults: Record<string, unknown>;
  orders: { id: string; testName: string; laterality: string | null; notes: string | null; resultRef: string | null; resultAt: string | null; createdAt: string }[];
  doctorNotes: { id: string; text: string; by: string; at: string }[];
  activity: { at: string; by: string; text: string; detail: string; kind: "admission" | "form" | "update" | "ot" | "discharge" }[];
  me: string;
  templates: FileInfo["templates"];
  ctx: FormContext;
  emrMeds: FileInfo["emrMeds"];
}

interface Can { edit: boolean; admit: boolean; shiftOt: boolean; discharge: boolean; doctorNotes: boolean; profile: boolean }

const SEX_SHORT: Record<string, string> = { MALE: "M", FEMALE: "F", OTHER: "O" };
const fmtDay = (iso: string | null) => (iso ? format(new Date(iso), "d MMM yyyy") : "—");
const fmtTime = (iso: string) => format(new Date(iso), "d MMM yyyy, h:mm a");
const istInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10) : "");

const inputCls = "w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3 py-2 text-sm text-[var(--color-ink-800)] placeholder:text-[var(--color-ink-300)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-transparent disabled:opacity-75 disabled:cursor-not-allowed";
const labelCls = "text-caption font-semibold tracking-widest text-[var(--color-ink-400)] uppercase block mb-1.5";
const btnPrimary = "inline-flex items-center gap-1.5 text-label sm:text-sm font-medium px-4 py-2 rounded-lg bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] disabled:opacity-60 transition-colors";
const btnGhost = "inline-flex items-center gap-1.5 text-label sm:text-sm font-medium px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] disabled:opacity-60 transition-colors";

/* ── Small pieces ──────────────────────────────────────────────────────── */

function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div className={`relative w-full ${wide ? "max-w-3xl" : "max-w-md"} max-h-[90vh] overflow-y-auto rounded-2xl p-6 shadow-2xl bg-white`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <p className="text-base font-bold text-[var(--color-ink-900)]">{title}</p>
          <button onClick={onClose} className="p-1 rounded-lg text-[var(--color-ink-400)] hover:bg-[var(--color-surface-sunken)]" aria-label="Close"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ErrorLine({ text }: { text: string }) {
  if (!text) return null;
  return <p className="text-sm text-red-600 flex items-center gap-1.5"><AlertTriangle size={14} className="shrink-0" /> {text}</p>;
}

/* ── Form bodies ───────────────────────────────────────────────────────── */

function LongSummary({ visitId, complaint, diagnoses }: { visitId: string; complaint: string | null; diagnoses: FileData["diagnoses"] }) {
  const s = useVisitSummaryState(visitId, { autoGenerateAI: false });
  return (
    <VisitSummaryTabBody
      tab="long" loading={!s.emrData} shortData={s.shortData} emrData={s.emrData}
      aiText={null} aiSource="local" aiNotice={null} aiError={null}
      complaint={complaint} diagnoses={diagnoses} emptyNote="Nothing recorded in the admitting visit."
    />
  );
}

function TextForm({ value, editable, onChange, rows = 18, mono }: { value: string; editable: boolean; onChange: (v: string) => void; rows?: number; mono?: boolean }) {
  return (
    <textarea value={value} disabled={!editable} onChange={(e) => onChange(e.target.value)} rows={rows}
      className={`${inputCls} ${mono ? "font-mono text-[13px] leading-relaxed" : ""} disabled:opacity-100 disabled:text-[var(--color-ink-800)]`} />
  );
}

/* ── Form shell: patient band + form + photos, auto-saved, freeze ──────── */

const STRUCTURED = new Set(["implant", "consents", "checklist", "education", "treatment", "nurse", "otNotes", "postOpNotes"]);

/** Patient band printed on every hospital chart. */
function PatientBand({ d }: { d: FileData }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-sunken)]/60 px-3 py-1.5 text-xs text-[var(--color-ink-600)]">
      <span><b className="text-[var(--color-ink-900)]">{d.patient.name}</b> · {d.patient.age}/{SEX_SHORT[d.patient.sex] ?? d.patient.sex}</span>
      <span>ID <b className="text-[var(--color-ink-800)]">{d.patient.id}</b></span>
      <span>IP <b className="text-[var(--color-ink-800)]">{d.fileNo || "—"}</b></span>
      <span>Ward <b className="text-[var(--color-ink-800)]">{[d.ward, d.floor && `Fl ${d.floor}`].filter(Boolean).join(" · ") || "—"}</b></span>
      <span>DOA <b className="text-[var(--color-ink-800)]">{fmtDay(d.admittedOn)}</b></span>
      <span>Consultant <b className="text-[var(--color-ink-800)]">Dr. {d.doctor}</b></span>
    </div>
  );
}

function FormPanel({ d, keyName, title, display, row, can, onRefresh }: {
  d: FileData; keyName: string; title: string; display?: boolean; row: FormRow | undefined; can: Can; onRefresh: () => void;
}) {
  const defaults = (d.defaults[keyName] ?? { text: "" }) as FormJson;
  const initial: FormJson = (() => {
    if (!row || !Object.keys(row.data ?? {}).length) return defaults;
    if (keyName === "discharge") return isDischargeData(row.data) ? normalizeDischarge(row.data, d.orders) : defaults;
    if (STRUCTURED.has(keyName)) return isV2(row.data) ? { ...defaults, ...row.data } : { ...defaults, log: row.data.log ?? [] };
    return row.data;
  })();
  const [value, setValue] = useState<FormJson>(initial);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState("");
  const [confirmFreeze, setConfirmFreeze] = useState(false);
  const [pending, start] = useTransition();
  const frozen = !!row?.frozen;
  const editable = can.edit && formEditable(keyName, frozen, d.status) && !display;
  const canFreeze = can.edit && !frozen && d.status === "ADMITTED";
  const canLog = can.edit && logsOpen(d.status);

  // Auto-save while editing (no Save button), like the Counselling screen
  const saveState = useAutoSave(value, async (val) => {
    const r = await saveForm(d.id, keyName, val);
    if (r.error) { setError(r.error); throw new Error(r.error); }
    setError("");
  }, 30000, { paused: !editable || !touched, flushOnUnmount: true });

  const change = (v: FormJson) => { setValue(v); setTouched(true); };
  const saveNow = async (v: FormJson) => {
    const r = await saveForm(d.id, keyName, v);
    if (r.error) return r.error;
    onRefresh();
    return undefined;
  };
  // Print opens the saved summary, so the latest edits are saved first
  const printSummary = () => start(async () => {
    if (editable) { const err = await saveNow(value); if (err) { setError(err); return; } }
    window.open(`/ipd-print/${d.id}`, "_blank");
  });
  const freeze = () => start(async () => {
    setConfirmFreeze(false);
    const r = await freezeForm(d.id, keyName, display ? undefined : value);
    if (r.error) setError(r.error); else onRefresh();
  });
  const addLog = async (e: NewLog) => {
    const r = await addFormLog(d.id, keyName, e);
    if (r.error) return r.error;
    onRefresh();
    return undefined;
  };
  const log: LogEntry[] = Array.isArray(row?.data?.log) ? row!.data.log : [];
  const info: FileInfo = d;
  const props = { value, change, saveNow, editable, canLog, addLog, log, f: info };

  let body: React.ReactNode;
  switch (keyName) {
    case "summary": body = <LongSummary visitId={d.visitId} complaint={d.complaint} diagnoses={d.diagnoses} />; break;
    case "investigations": body = <InvestigationsForm f={info} />; break;
    case "implant": body = <ImplantForm {...props} value={value as ImplantData} change={change} saveNow={saveNow} />; break;
    case "consents": body = <ConsentsForm {...props} value={value as ConsentsData} change={change} saveNow={saveNow} />; break;
    case "checklist": body = <ChecklistForm {...props} value={value as ChecklistData} change={change} saveNow={saveNow} />; break;
    case "education": body = <EducationForm {...props} value={value as EducationData} change={change} saveNow={saveNow} />; break;
    case "treatment": body = <TreatmentForm {...props} value={value as TreatmentData} change={change} saveNow={saveNow} />; break;
    case "nurse": body = <NurseForm {...props} value={value as NurseData} change={change} saveNow={saveNow} />; break;
    case "otNotes": body = <OtNotesForm {...props} value={value as OtNotesData} change={change} saveNow={saveNow} template={(d.defaults.otNotes as OtNotesData).steps} />; break;
    case "postOpNotes": body = <PostOpForm {...props} value={value as PostOpData} change={change} saveNow={saveNow} />; break;
    case "discharge":
      // A summary signed before the structured layout keeps its signed text
      body = frozen && typeof row?.data?.text === "string" && !isDischargeData(row.data)
        ? <TextForm value={row.data.text} editable={false} onChange={() => {}} mono rows={22} />
        : <DischargeEditor value={value as DischargeData} onChange={(v) => change(v as unknown as FormJson)} editable={editable} ctx={dischargeCtx(d)} />;
      break;
    default:
      body = <TextForm value={value.text ?? ""} editable={editable} onChange={(t) => change({ text: t })} rows={12} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base sm:text-lg font-bold text-[var(--color-ink-900)]">{title}</h2>
        <div className="flex flex-wrap items-center gap-2 ml-auto">
          {editable && touched && <SaveIndicator state={saveState} />}
          {keyName === "discharge" && (
            <button type="button" disabled={pending} onClick={printSummary} className={btnGhost}><Printer size={14} /> Print / PDF</button>
          )}
          {frozen ? (
            <span className="inline-flex items-center gap-1.5 text-caption font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Lock size={12} /> Frozen by {row?.frozenBy} · {row?.frozenAt ? fmtTime(row.frozenAt) : ""}
            </span>
          ) : canFreeze ? (
            <button disabled={pending} onClick={() => setConfirmFreeze(true)} className={btnPrimary}>
              <Lock size={14} /> {display ? "Confirm & Freeze" : "Freeze"}
            </button>
          ) : (
            <span className="text-caption font-semibold text-[var(--color-ink-400)]">Not frozen</span>
          )}
        </div>
      </div>
      <PatientBand d={d} />
      {frozen && editable && (
        <p className="text-caption text-emerald-700">Confirmed · stays editable until discharge.</p>
      )}

      {body}

      <ErrorLine text={error} />
      <Photos d={d} keyName={keyName} list={row?.attachments ?? []} canAdd={can.edit && attachOpen(d.status)} onRefresh={onRefresh} />

      {confirmFreeze && (
        <ConfirmDialog
          title={`Freeze ${title}?`}
          message={IPD_FORMS.some((f) => f.key === keyName && f.postOp)
            ? "Confirm the entries are verified. This form stays editable until discharge (as the document asks), but it now counts as confirmed for Shift to OT."
            : "Confirm the entries are verified and final. A frozen form can't be edited again."}
          confirmLabel="Freeze"
          onConfirm={freeze}
          onCancel={() => setConfirmFreeze(false)}
        />
      )}
    </div>
  );
}

function Photos({ d, keyName, list, canAdd, onRefresh }: { d: FileData; keyName: string; list: Attachment[]; canAdd: boolean; onRefresh: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "Upload failed");
      const r = await addFormAttachment(d.id, keyName, json.url, file.name);
      if (r.error) throw new Error(r.error);
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };
  if (!canAdd && list.length === 0) return null;
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-border)] p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className={labelCls + " mb-0"}>Photos of documents</p>
        {canAdd && (
          <>
            <input ref={ref} type="file" accept="image/*,.pdf" capture="environment" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
            <button disabled={busy} onClick={() => ref.current?.click()} className="inline-flex items-center gap-1.5 text-caption font-semibold text-[var(--color-primary-700)] hover:underline disabled:opacity-60">
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />} Add photo
            </button>
          </>
        )}
      </div>
      <ErrorLine text={error} />
      {list.length === 0 ? (
        <p className="text-caption italic text-[var(--color-ink-300)]">No photos attached.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {list.map((a, i) => (
            <a key={i} href={fileHref(a.ref)!} target="_blank" rel="noreferrer" title={`${a.name} · ${a.by} · ${fmtTime(a.at)}`}
              className="inline-flex items-center gap-1.5 max-w-[220px] rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-caption text-[var(--color-ink-700)] hover:border-[var(--color-primary-300)] hover:bg-[var(--color-primary-50)]">
              <FileText size={13} className="shrink-0 text-[var(--color-primary-600)]" /><span className="truncate">{a.name}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Doctor's notes and activity ───────────────────────────────────────── */

function DoctorNotes({ d, can, onRefresh }: { d: FileData; can: Can; onRefresh: () => void }) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const canAdd = can.doctorNotes && logsOpen(d.status);
  const add = (text: string) => start(async () => {
    const r = await addDoctorNote(d.id, text);
    if (r.error) setError(r.error); else { setError(""); onRefresh(); }
  });
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-base sm:text-lg font-bold text-[var(--color-ink-900)]">Doctor&apos;s Notes</h2>
        <p className="text-caption text-[var(--color-ink-400)]">Ward rounds until the patient is fit for discharge. Each note is labelled with its time.</p>
      </div>
      <PatientBand d={d} />
      {canAdd && <DoctorNoteComposer onAdd={add} pending={pending} />}
      <ErrorLine text={error} />
      {d.doctorNotes.length === 0 ? (
        <p className="text-sm italic text-[var(--color-ink-400)]">No notes yet.</p>
      ) : (
        <ol className="space-y-2">
          {d.doctorNotes.map((n) => (
            <li key={n.id} className="rounded-xl border border-[var(--color-border)] bg-white overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-1.5 bg-[var(--color-surface-sunken)]/70 border-b border-[var(--color-border)]">
                <span className="text-xs font-bold text-[var(--color-ink-800)]">{fmtTime(n.at)}</span>
                <span className="text-xs text-[var(--color-ink-500)]">Dr. {n.by.replace(/^Dr\.?\s*/i, "")}</span>
              </div>
              <div className="px-3.5 py-2.5"><DoctorNoteText text={n.text} /></div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* Activity: calendar + day timeline, same layout as the patient Time Stamp */
type ActivityKind = FileData["activity"][number]["kind"];
const KIND_CFG: Record<ActivityKind, { label: string; hex: string; dot: string; border: string; badge: string; card: string }> = {
  admission: { label: "Admission", hex: "#0EA5E9", dot: "bg-sky-500",                    border: "border-l-sky-400",                    badge: "bg-sky-100 text-sky-700",                                    card: "bg-sky-50/40" },
  form:      { label: "Form",      hex: "#14B8A6", dot: "bg-[var(--color-primary-500)]", border: "border-l-[var(--color-primary-400)]", badge: "bg-[var(--color-primary-100)] text-[var(--color-primary-700)]", card: "bg-[var(--color-primary-50)]/40" },
  update:    { label: "Update",    hex: "#F59E0B", dot: "bg-amber-500",                  border: "border-l-amber-400",                  badge: "bg-amber-100 text-amber-700",                                card: "bg-amber-50/40" },
  ot:        { label: "OT",        hex: "#8B5CF6", dot: "bg-violet-500",                 border: "border-l-violet-400",                 badge: "bg-violet-100 text-violet-700",                              card: "bg-violet-50/40" },
  discharge: { label: "Discharge", hex: "#10B981", dot: "bg-emerald-500",                border: "border-l-emerald-400",                badge: "bg-emerald-100 text-emerald-700",                            card: "bg-emerald-50/40" },
};
const ACT_DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const dayKeyOf = (iso: string) => format(new Date(iso), "yyyy-MM-dd");

function ActivityLog({ d }: { d: FileData }) {
  const events = d.activity;
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const latestKey = events.length ? dayKeyOf(events[0].at) : todayKey;
  const [selectedKey, setSelectedKey] = useState(latestKey);
  const [month, setMonth] = useState(() => startOfMonth(new Date(latestKey)));

  const byDay = useMemo(() => {
    const map: Record<string, FileData["activity"]> = {};
    for (const e of events) (map[dayKeyOf(e.at)] ??= []).push(e);
    for (const k in map) map[k].sort((a, b) => a.at.localeCompare(b.at));
    return map;
  }, [events]);

  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const legend = [...new Set(events.map((e) => e.kind))];
  const dayEvents = byDay[selectedKey] ?? [];
  const select = (key: string) => {
    setSelectedKey(key);
    const dt = new Date(key);
    if (dt.getMonth() !== month.getMonth() || dt.getFullYear() !== month.getFullYear()) setMonth(startOfMonth(dt));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base sm:text-lg font-bold text-[var(--color-ink-900)]">Activity</h2>
        <span className="text-caption font-semibold px-2 py-0.5 rounded-full bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]">{events.length} event{events.length === 1 ? "" : "s"}</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)] gap-4 items-start">
        {/* Calendar */}
        <div className="rounded-xl border border-[var(--color-border)] px-4 pt-2.5 pb-2" style={{ background: "linear-gradient(160deg, var(--color-primary-50) 0%, #fff 60%)" }}>
          <div className="flex items-center justify-between mb-1.5">
            <button onClick={() => setMonth((m) => subMonths(m, 1))} className="size-7 flex items-center justify-center rounded-full bg-white border border-[var(--color-border)] shadow-sm hover:shadow text-[var(--color-ink-500)] hover:text-[var(--color-primary-600)] transition-all" aria-label="Previous month">
              <ChevronLeft size={13} />
            </button>
            <h3 className="text-[13px] font-bold tracking-tight text-[var(--color-ink-800)]">{format(month, "MMMM yyyy")}</h3>
            <button onClick={() => setMonth((m) => addMonths(m, 1))} className="size-7 flex items-center justify-center rounded-full bg-white border border-[var(--color-border)] shadow-sm hover:shadow text-[var(--color-ink-500)] hover:text-[var(--color-primary-600)] transition-all" aria-label="Next month">
              <ChevronRight size={13} />
            </button>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {ACT_DAY_LABELS.map((x) => <span key={x} className="text-center text-[9px] font-bold text-[var(--color-ink-300)] uppercase tracking-widest">{x}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: getDay(days[0]) }).map((_, i) => <div key={`b-${i}`} />)}
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const list = byDay[key] ?? [];
              const has = list.length > 0;
              const isSel = key === selectedKey;
              const isToday = isSameDay(day, new Date());
              const kinds = [...new Set(list.map((e) => e.kind))];
              return (
                <button key={key} disabled={!has} onClick={() => select(key)}
                  className={[
                    "relative flex flex-col items-center justify-center w-full h-9 rounded-xl transition-all duration-150",
                    isSel ? "bg-[var(--color-primary-600)] text-white shadow-sm"
                      : has ? "bg-[var(--color-primary-50)] text-[var(--color-primary-700)] hover:bg-[var(--color-primary-100)] cursor-pointer"
                      : "text-[var(--color-ink-300)] cursor-default",
                    isToday && !isSel ? "ring-2 ring-[var(--color-primary-400)] ring-offset-1" : "",
                  ].join(" ")}>
                  <span className="text-[11px] font-bold leading-none">{format(day, "d")}</span>
                  {has && (
                    <div className="flex gap-[3px] mt-[3px]">
                      {kinds.slice(0, 3).map((k) => (
                        <span key={k} className="w-[4px] h-[4px] rounded-full shrink-0" style={{ background: isSel ? "rgba(255,255,255,0.8)" : KIND_CFG[k].hex }} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-[var(--color-border)]/60">
            <button onClick={() => select(todayKey)} className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-white border border-[var(--color-primary-200)] text-[var(--color-primary-600)] hover:bg-[var(--color-primary-50)] shadow-sm transition-all">
              Today
            </button>
            <div className="flex flex-wrap gap-x-2 gap-y-1 justify-end">
              {legend.map((k) => (
                <span key={k} className="flex items-center gap-1 text-[9px] font-medium text-[var(--color-ink-400)]">
                  <span className="size-1.5 rounded-full inline-block shrink-0" style={{ background: KIND_CFG[k].hex }} />
                  {KIND_CFG[k].label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Selected day's events */}
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[var(--color-ink-600)] mb-3">{format(new Date(selectedKey), "EEEE, d MMMM yyyy")}</p>
          {dayEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 rounded-xl border border-dashed border-[var(--color-border)]">
              <CalendarDays size={28} className="text-[var(--color-ink-300)]" />
              <p className="text-xs text-[var(--color-ink-400)]">No activity on this date</p>
            </div>
          ) : (
            <div className="pl-1">
              {dayEvents.map((e, i) => {
                const cfg = KIND_CFG[e.kind];
                return (
                  <div key={i} className="relative flex gap-3">
                    <div className="flex flex-col items-center shrink-0">
                      <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot} ring-2 ring-white shadow-sm mt-1.5 shrink-0`} />
                      {i < dayEvents.length - 1 && <div className="w-px flex-1 bg-[var(--color-border)] mt-1" />}
                    </div>
                    <div className={`flex-1 min-w-0 mb-3 rounded-xl border border-[var(--color-border)] border-l-4 ${cfg.border} ${cfg.card} px-3 py-2.5`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-micro sm:text-caption font-bold uppercase tracking-wide mb-0.5 ${cfg.badge}`}>{cfg.label}</span>
                          <p className="text-label sm:text-sm font-semibold text-[var(--color-ink-800)] leading-tight">{e.text}</p>
                        </div>
                        <span className="text-caption font-medium text-[var(--color-ink-400)] shrink-0 tabular-nums">{format(new Date(e.at), "h:mm a")}</span>
                      </div>
                      {e.detail && <p className="mt-1 text-caption text-[var(--color-ink-600)] break-words">{e.detail}</p>}
                      {e.by && <p className="mt-1 text-caption text-[var(--color-ink-400)]">{e.by}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Header dialogs ────────────────────────────────────────────────────── */

function DetailsDialog({ d, onClose, onDone }: { d: FileData; onClose: () => void; onDone: () => void }) {
  const [ward, setWard] = useState(d.ward ?? "");
  const [floor, setFloor] = useState(d.floor ?? "");
  const [fileNo, setFileNo] = useState(d.fileNo ?? "");
  const [edd, setEdd] = useState(istInput(d.expectedDischarge));
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const save = () => start(async () => {
    const r = await updateAdmissionDetails(d.id, { ward, floor, fileNo, expectedDischarge: edd });
    if (r.error) setError(r.error); else onDone();
  });
  return (
    <Modal title="Ward, floor & file details" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={labelCls}>Ward No.</label><input value={ward} onChange={(e) => setWard(e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>Floor No.</label><input value={floor} onChange={(e) => setFloor(e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>File No.</label><input value={fileNo} onChange={(e) => setFileNo(e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>Expected Discharge</label><input type="date" value={edd} min={istInput(d.admittedOn)} onChange={(e) => setEdd(e.target.value)} className={inputCls} /></div>
      </div>
      <div className="mt-4 space-y-3">
        <ErrorLine text={error} />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className={btnGhost}>Cancel</button>
          <button disabled={pending} onClick={save} className={btnPrimary}>Save</button>
        </div>
      </div>
    </Modal>
  );
}

function TypeDialog({ d, onClose, onDone }: { d: FileData; onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState(d.type);
  const [other, setOther] = useState(d.typeOther ?? "");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const save = () => start(async () => {
    const r = await changeAdmissionType(d.id, type, other);
    if (r.error) setError(r.error); else onDone();
  });
  return (
    <Modal title="Change type of admission" onClose={onClose}>
      <div className="flex flex-wrap gap-2">
        {Object.entries(ADMISSION_TYPE_LABEL).map(([value, label]) => (
          <button key={value} onClick={() => setType(value)}
            className={`px-3.5 py-2 rounded-lg border text-xs font-semibold transition-colors ${type === value ? "bg-[var(--color-primary-600)] border-[var(--color-primary-600)] text-white" : "border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-primary-50)]"}`}>
            {label}
          </button>
        ))}
      </div>
      {type === "OTHERS" && <input value={other} onChange={(e) => setOther(e.target.value)} placeholder="Describe…" className={`${inputCls} mt-3`} />}
      <p className="mt-3 text-caption text-[var(--color-ink-400)]">Switching to Pre-op imports the counselling sheet if the patient has one and none was imported yet. Forms that apply only to Pre-op are shown or hidden accordingly.</p>
      <div className="mt-4 space-y-3">
        <ErrorLine text={error} />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className={btnGhost}>Cancel</button>
          <button disabled={pending || type === d.type && (type !== "OTHERS" || other === (d.typeOther ?? ""))} onClick={save} className={btnPrimary}>Change</button>
        </div>
      </div>
    </Modal>
  );
}

function DischargeDialog({ d, summary, onClose, onDone }: { d: FileData; summary: DischargeData; onClose: () => void; onDone: () => void }) {
  const [step, setStep] = useState<"confirm" | "review">("confirm");
  const [text, setText] = useState<DischargeData>(summary);
  const [notes, setNotes] = useState("");
  const [otpSentTo, setOtpSentTo] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const sendOtp = () => start(async () => {
    setError("");
    const r = await requestDischargeOtp(d.id);
    if (r.error) setError(r.error); else setOtpSentTo(r.email ?? "your email");
  });
  const sign = () => start(async () => {
    const r = await confirmDischarge(d.id, code, text, notes);
    if (r.error) setError(r.error); else onDone();
  });
  if (step === "confirm") {
    return (
      <ConfirmDialog
        title="Discharge this patient?"
        message="The discharge summary opens for a final review. After you sign it with the OTP, the file becomes read-only."
        confirmLabel="Review summary"
        onConfirm={() => setStep("review")}
        onCancel={onClose}
      />
    );
  }
  return (
    <Modal title="Discharge summary · review & sign" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="rounded-xl bg-[var(--color-surface-sunken)]/50 p-2 max-h-[55vh] overflow-y-auto">
          <DischargeEditor value={text} onChange={setText} editable ctx={dischargeCtx(d)} />
        </div>
        <div>
          <label className={labelCls}>Additional notes (optional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="e.g. insurance, billing remarks…" className={inputCls} />
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)]/50 p-3 space-y-2">
          <p className="text-sm font-semibold text-[var(--color-ink-800)]">Sign with OTP</p>
          {otpSentTo ? (
            <>
              <p className="text-caption text-[var(--color-ink-500)]">A 6-digit code was sent to {otpSentTo}. It expires in 5 minutes.</p>
              <div className="flex gap-2">
                <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="Enter OTP" className={`${inputCls} max-w-[160px] tracking-[0.3em] font-semibold`} />
                <button disabled={pending || code.length !== 6} onClick={sign} className={btnPrimary}><ShieldCheck size={14} /> Sign & Discharge</button>
                <button disabled={pending} onClick={sendOtp} className={btnGhost}>Resend</button>
              </div>
            </>
          ) : (
            <button disabled={pending || !text.diagnosis.trim()} onClick={sendOtp} title={text.diagnosis.trim() ? undefined : "Add the diagnosis first"} className={btnPrimary}>Send OTP to my email</button>
          )}
          <ErrorLine text={error} />
        </div>
      </div>
    </Modal>
  );
}

/** What the discharge editor shows besides the summary itself. */
function dischargeCtx(d: FileData): DischargeContext {
  const t = d.forms.find((f) => f.key === "treatment")?.data;
  const discharge = d.forms.find((f) => f.key === "discharge");
  return {
    patient: d.patient,
    fileNo: d.fileNo, ward: d.ward, floor: d.floor,
    admittedOn: d.admittedOn,
    typeText: admissionTypeText(d.type, d.typeOther),
    surgical: d.type === "PRE_OP" || !!d.surgery,
    orders: d.orders,
    doctorNotes: d.doctorNotes.map((n) => ({ text: n.text, at: n.at })),
    drugs: Array.isArray(t?.drugs) ? t.drugs.filter((dr: { stopped?: boolean }) => !dr.stopped) : [],
    signed: d.status === "DISCHARGED" && d.dischargedBy && d.dischargedAt ? { by: d.dischargedBy, at: discharge?.frozenAt ?? d.dischargedAt } : null,
  };
}

/* ── Page ──────────────────────────────────────────────────────────────── */

export function PatientFile({ data: d, can }: { data: FileData; can: Can }) {
  const router = useRouter();
  const refresh = () => router.refresh();
  const fixed = formsFor(d.type);
  const custom = d.forms.filter((f) => isCustomKey(f.key));
  const rowOf = (key: string) => d.forms.find((f) => f.key === key);
  const items = useMemo(() => [
    ...fixed.map((f) => ({ key: f.key as string, title: f.title, display: !!f.display, preOp: !!f.preOpOnly })),
    ...custom.map((f) => ({ key: f.key, title: f.title, display: false, preOp: false })),
  ], [fixed, custom]);
  const required = items.map((i) => i.key);
  const frozenCount = required.filter((k) => rowOf(k)?.frozen).length;
  const allFrozen = frozenCount === required.length;

  const [picked, setSel] = useState<string>(items[0]?.key ?? "summary");
  // A form hidden by a type change falls back to the first form
  const sel = items.some((i) => i.key === picked) || picked === "doctorNotes" || picked === "activity" ? picked : (items[0]?.key ?? "summary");
  const [dialog, setDialog] = useState<null | "details" | "type" | "ot" | "discharge" | "addForm">(null);
  const [newForm, setNewForm] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const status = d.status as IpdStatus;
  const title = d.surgery
    ? [d.laterality, d.surgery].filter(Boolean).join(" ") + (d.implant ? ` + ${d.implant}` : "") + (d.anaesthesia ? ` · ${d.anaesthesia}` : "")
    : admissionTypeText(d.type, d.typeOther);
  const showOt = canGoToOt(d.type) && status === "ADMITTED" && can.shiftOt;
  const showDischarge = can.discharge && canDischargeNow(d.type, status);
  const savedSummary = rowOf("discharge")?.data;
  const summaryNow = isDischargeData(savedSummary) ? normalizeDischarge(savedSummary, d.orders) : (d.defaults.discharge as DischargeData);

  const doShift = () => start(async () => {
    setDialog(null);
    const r = await shiftToOt(d.id);
    if (r.error) setError(r.error); else refresh();
  });
  const addForm = () => start(async () => {
    const r = await addCustomForm(d.id, newForm);
    if (r.error) { setError(r.error); return; }
    setDialog(null); setNewForm("");
    if (r.key) setSel(r.key);
    refresh();
  });

  const listBtn = (key: string, label: React.ReactNode, icon: React.ReactNode, extra?: React.ReactNode) => (
    <button key={key} onClick={() => setSel(key)}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left text-label sm:text-sm transition-colors ${sel === key ? "bg-[var(--color-primary-50)] text-[var(--color-primary-800)] font-semibold ring-1 ring-[var(--color-primary-200)]" : "text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]"}`}>
      {icon}<span className="flex-1 min-w-0">{label}</span>{extra}
    </button>
  );

  const selItem = items.find((i) => i.key === sel);

  return (
    <div className="fade-in pb-24">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <Link href={d.returnTo} className="inline-flex items-center gap-1.5 text-label sm:text-sm font-medium text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)]"><ArrowLeft size={15} /> Back</Link>
        {can.profile && (
          <Link href={`/patients/${d.udid}?source=ipd&returnTo=${encodeURIComponent("/ipd")}`} className={btnGhost}><User size={14} /> Patient Profile</Link>
        )}
      </div>

      {/* Header: laterality + surgery + implant + anaesthesia, ward / file / floor */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-12 h-12 rounded-full bg-[var(--color-primary-100)] flex items-center justify-center shrink-0 overflow-hidden">
              {d.patient.photoUrl ? <img src={fileHref(d.patient.photoUrl)!} alt={d.patient.name} className="w-full h-full object-cover" /> : <User size={20} className="text-[var(--color-primary-700)]" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--color-ink-900)]">{title}</p>
              <p className="text-sm text-[var(--color-ink-600)] mt-0.5">
                <span className="font-semibold text-[var(--color-ink-800)]">{d.patient.name}</span> · {d.patient.age}y/{SEX_SHORT[d.patient.sex] ?? d.patient.sex} · {d.patient.id}
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-0.5 text-sm text-[var(--color-ink-500)]">
                <span>Ward <b className="text-[var(--color-ink-800)]">{d.ward || "—"}</b></span>
                <span>File <b className="text-[var(--color-ink-800)]">{d.fileNo || "—"}</b></span>
                <span>Floor <b className="text-[var(--color-ink-800)]">{d.floor || "—"}</b></span>
                {can.edit && status !== "DISCHARGED" && (
                  <button onClick={() => setDialog("details")} className="inline-flex items-center gap-1 font-semibold text-[var(--color-primary-700)] hover:underline"><Pencil size={11} /> Edit</button>
                )}
              </div>
              {d.reason && <p className="mt-0.5 text-sm text-[var(--color-ink-500)]">Reason <b className="text-[var(--color-ink-800)] font-semibold">{d.reason}</b></p>}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-0.5 text-sm text-[var(--color-ink-500)]">
                <span>DOA <b className="text-[var(--color-ink-800)]">{fmtDay(d.admittedOn)}</b></span>
                {d.type === "PRE_OP" && <span>DOS <b className="text-[var(--color-ink-800)]">{fmtDay(d.surgeryDate)}</b></span>}
                {d.dischargedAt
                  ? <span>DOD <b className="text-[var(--color-ink-800)]">{fmtDay(d.dischargedAt)}</b></span>
                  : <span>Expected DOD <b className="text-[var(--color-ink-800)]">{fmtDay(d.expectedDischarge)}</b></span>}
                <span>
                  {admissionTypeText(d.type, d.typeOther)}
                  {can.admit && status === "ADMITTED" && (
                    <button onClick={() => setDialog("type")} className="ml-1.5 font-semibold text-[var(--color-primary-700)] hover:underline">Change</button>
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <span className={`inline-flex items-center gap-1.5 text-sm font-semibold px-2.5 py-0.5 rounded-full ${
              status === "IN_OT" ? "bg-violet-50 text-violet-700 border border-violet-200"
                : status === "POST_OP" ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : status === "DISCHARGED" ? "bg-slate-100 text-slate-600 border border-slate-200"
                : "bg-sky-50 text-sky-700 border border-sky-200"}`}>
              <BedDouble size={12} /> {IPD_STATUS_LABEL[status] ?? status}
            </span>
            <span className="text-sm font-semibold text-[var(--color-ink-500)] tabular-nums">Forms frozen {frozenCount}/{required.length}</span>
            <div className="flex flex-wrap justify-end gap-2">
              {showOt && (
                <button
                  disabled={!allFrozen || pending}
                  onClick={() => setDialog("ot")}
                  title={allFrozen ? "Shift the file to OT" : "Freeze every form to unlock"}
                  className={`inline-flex items-center gap-1.5 text-label sm:text-sm font-semibold px-4 py-2 rounded-lg transition-colors ${allFrozen ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)] border border-[var(--color-border)] cursor-not-allowed"}`}
                >
                  {allFrozen ? <Scissors size={14} /> : <Lock size={14} />} Shift to OT
                </button>
              )}
              {showDischarge && (
                <button onClick={() => setDialog("discharge")} className="inline-flex items-center gap-1.5 text-label sm:text-sm font-semibold px-4 py-2 rounded-lg bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)]">
                  <LogOut size={14} /> Discharge
                </button>
              )}
            </div>
          </div>
        </div>
        {status === "IN_OT" && (
          <div className="mt-4 rounded-xl border-2 border-dashed border-violet-200 bg-violet-50/40 px-4 py-3 text-sm text-violet-800">
            In OT since {d.shiftedToOtAt ? fmtTime(d.shiftedToOtAt) : "—"}. The file returns to the post-op ward from the OT module.
          </div>
        )}
        {status === "DISCHARGED" && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Discharged by {d.dischargedBy} on {d.dischargedAt ? fmtTime(d.dischargedAt) : "—"} · summary signed with OTP. The file is read-only.
            {d.dischargeNotes && <span className="block mt-1 text-slate-600">Notes: {d.dischargeNotes}</span>}
          </div>
        )}
        {error && <div className="mt-3"><ErrorLine text={error} /></div>}
      </div>

      {/* Forms list | selected form */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-4 items-start">
        <nav className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 lg:sticky lg:top-4 space-y-0.5">
          {items.map((i) => {
            const r = rowOf(i.key);
            return listBtn(
              i.key,
              <>{i.title}{i.preOp && <span className="ml-1.5 text-micro font-bold rounded px-1 py-px bg-amber-50 text-amber-700 border border-amber-200">Pre-op</span>}</>,
              r?.frozen ? <CheckCircle2 size={16} className="shrink-0 text-emerald-600" /> : <Circle size={16} className="shrink-0 text-[var(--color-ink-300)]" />,
              (r?.attachments?.length ?? 0) > 0 ? <Camera size={12} className="shrink-0 text-[var(--color-ink-400)]" /> : undefined,
            );
          })}
          {can.edit && status === "ADMITTED" && (
            <button onClick={() => { setDialog("addForm"); setError(""); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-label sm:text-sm font-semibold text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)]">
              <Plus size={16} /> Add custom form
            </button>
          )}
          <div className="my-1.5 border-t border-[var(--color-border)]" />
          {listBtn("doctorNotes", "Doctor's Notes", <Stethoscope size={16} className="shrink-0 text-[var(--color-primary-600)]" />,
            d.doctorNotes.length ? <span className="text-micro font-bold rounded-full px-1.5 bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]">{d.doctorNotes.length}</span> : undefined)}
          {listBtn("activity", "Activity", <History size={16} className="shrink-0 text-[var(--color-ink-400)]" />)}
        </nav>

        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5 min-w-0">
          {sel === "doctorNotes" ? <DoctorNotes d={d} can={can} onRefresh={refresh} />
            : sel === "activity" ? <ActivityLog d={d} />
            : selItem ? (
              <FormPanel key={`${selItem.key}-${rowOf(selItem.key)?.frozen ? "f" : "o"}-${d.status}`} d={d} keyName={selItem.key} title={selItem.title} display={selItem.display} row={rowOf(selItem.key)} can={can} onRefresh={refresh} />
            ) : null}
        </section>
      </div>

      {dialog === "details" && <DetailsDialog d={d} onClose={() => setDialog(null)} onDone={() => { setDialog(null); refresh(); }} />}
      {dialog === "type" && <TypeDialog d={d} onClose={() => setDialog(null)} onDone={() => { setDialog(null); refresh(); }} />}
      {dialog === "ot" && (
        <ConfirmDialog
          title="Shift the file to OT?"
          message="The file moves to the OT module. The frozen forms are locked permanently and can't be changed in IPD. It comes back to the post-op ward after the operation."
          confirmLabel="Shift to OT"
          onConfirm={doShift}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog === "discharge" && <DischargeDialog d={d} summary={summaryNow} onClose={() => setDialog(null)} onDone={() => { setDialog(null); refresh(); }} />}
      {dialog === "addForm" && (
        <Modal title="Add a custom form" onClose={() => setDialog(null)}>
          <input autoFocus value={newForm} onChange={(e) => setNewForm(e.target.value)} placeholder="Form name, e.g. Physician fitness" className={inputCls} />
          <div className="mt-4 space-y-3">
            <ErrorLine text={error} />
            <div className="flex justify-end gap-2">
              <button onClick={() => setDialog(null)} className={btnGhost}>Cancel</button>
              <button disabled={pending || !newForm.trim()} onClick={addForm} className={btnPrimary}>Add</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
