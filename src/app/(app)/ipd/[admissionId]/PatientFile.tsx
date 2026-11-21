"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  BedDouble, Check, CheckCircle2, Circle, Lock, Camera, Plus, X, AlertTriangle, FileText,
  Scissors, LogOut, Loader2, Pencil, History, Stethoscope, ShieldCheck, ChevronRight, Printer, Hash, Phone, Upload, ExternalLink,
} from "lucide-react";
import { ComplaintChips } from "@/components/ui/ComplaintChips";
import { PatientPhoto } from "../../emr/[udid]/PatientPhoto";
import { NoteEditor, type ChartDrug } from "./EmrCopyTabs";
import { ActivityPanel } from "@/components/ui/ActivityTimeline";
import { NoteSummary } from "./NoteSummary";
import { isEmrCopy, type EmrCopy } from "@/lib/ipd-emr-copy";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { fileHref } from "@/lib/file-href";
import { printInPlace } from "@/lib/print-in-place";
import {
  ADMISSION_TYPE_LABEL, ALWAYS_TABS, FREEZABLE_KEYS, IPD_FORMS, IPD_STATUS_LABEL, admissionTypeText, attachOpen, canDischargeNow, canGoToOt, formEditable,
  tabChoices, tabsFor, isCustomKey, isDischargeData, logsOpen, normalizeDischarge, type DischargeData, type IpdStatus, type LogEntry, WARD_TYPE_LABEL, wardTypeText } from "@/lib/ipd";
import {
  IMPLANT_VERIFY, isV2, type ChecklistData, type ConsentsData, type EducationData, type FormContext, type ImplantData, type NurseData,
  type OtNotesData, type PostOpData, type TreatmentData,
} from "@/lib/ipd-forms";
import { SaveIndicator, useAutoSave } from "@/lib/useAutoSave";
import { ChipRow, SuggestField } from "./customOptions";
import { FIELD_OPTIONS } from "@/lib/ipd-field-options";
import {
  ChecklistForm, ConsentsForm, DoctorNoteText, EducationForm, ImplantForm, InvestigationsForm, NurseForm,
  OtNotesForm, PostOpForm, TreatmentForm, type EducationPart, type FileInfo, type NewLog,
} from "./IpdForms";
import {
  addCustomForm, getNoteSeed, addFileTabs, addFormAttachment, addFormLog, removeDoseLog,changeAdmissionType, confirmDischarge, createIpdFile,
  freezeForm, unfreezeForm, noteDrugStopped, removeFileTab, requestDischargeOtp, saveForm, shiftToOt, updateAdmissionDetails,
} from "../actions";
import { FileTabsDialog, summaryTitle } from "./FileTabsDialog";
export { summaryTitle };
import { CounsellingOverview } from "../../counselling/[visitId]/CounsellingPrintOverview";
import { CounsellingDetail, type CounsellingDetailData } from "../../counselling/[visitId]/CounsellingDetail";
import type { CounsellingImplant } from "@/lib/counselling-sheets";
import type { PaymentDoc } from "@/lib/counselling";
import { useVisitSummaryState, VisitSummaryTabBody } from "../../patients/[udid]/VisitSummaryTabs";
import { DischargeEditor, type DischargeContext } from "./DischargeEditor";
import { DischargeDocument, type DischargeHeader } from "./DischargeDocument";
import { OtNotesView } from "./OtNotesView";
import type { OtNotesCopy } from "@/lib/ot";

/* ── Types ─────────────────────────────────────────────────────────────── */

interface Attachment { ref: string; name: string; at: string; by: string }
// Form JSON: the shape depends on the form (see the data shapes in lib/ipd)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FormJson = Record<string, any>;
export interface FormRow {
  key: string; title: string; data: FormJson; attachments: Attachment[];
  frozen: boolean; frozenAt: string | null; frozenBy: string | null;
}

export interface FileData {
  id: string;
  visitId: string;
  /** The admitting visit can still be edited in the EMR (not closed, or finalized today). */
  visitOpen: boolean;
  udid: string;
  returnTo: string;
  patient: { name: string; age: number; sex: string; id: string; mobile?: string | null; photoUrl: string | null };
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
  wardType: string | null;
  floor: string | null;
  fileNo: string | null;
  status: string;
  /** Tabs chosen for the file (with the two it always has); empty until the file is created. */
  fileTabs: string[];
  fileCreated: boolean;
  /** Date of the admitting visit (the long summary's day). */
  visitDate: string;
  /** The Counselling module's sheet, for the Counselling Sheet tab. */
  counsellingSheet: CounsellingSheet | null;
  /** The admitting counselling visit (its sheet is edited in the Counselling Sheet tab). */
  counsellingVisitId: string | null;
  /** The Counselling module's sheet itself, editable here; set by the page. */
  counsellingDetail?: { data: CounsellingDetailData; canEdit: boolean } | null;
  shiftedToOtAt: string | null;
  returnedFromOtAt: string | null;
  dischargedAt: string | null;
  dischargedBy: string | null;
  dischargeNotes: string | null;
  payment: { type: string | null; mode: string | null; scheme: string | null; policy: string | null; eligibleBy: string | null; eligibleAt: string | null } | null;
  forms: FormRow[];
  defaults: Record<string, unknown>;
  orders: FileInfo["orders"];
  /** The patient's latest EMR drug allergy (Counselling edits included). */
  drugAllergy: { text: string; nkda: boolean };
  doctorNotes: { id: string; text: string; by: string; at: string; editedAt?: string | null; data?: unknown }[];
  activity: { at: string; by: string; text: string; detail: string; kind: "admission" | "form" | "update" | "ot" | "discharge" }[];
  me: string;
  templates: FileInfo["templates"];
  ctx: FormContext;
  emrMeds: FileInfo["emrMeds"];
  /** Post-op medicines from the Patient Education sheet (shown in the notes copy of the EMR). */
  postOpMeds: string[];
}

export interface CounsellingSheet {
  surgery: string; laterality: string | null; anaesthesia: string | null; surgeryNotes: string | null;
  implant: string; dateOfSurgery: string; implantInfo: CounsellingImplant;
  payment: string; payerLabel: string; payer: string; idLabel: string; payerId: string; docs: PaymentDoc[];
  estimate: string; advance: string;
  fit: boolean; fitBy: string | null; fitAt: string | null;
}


export interface Can { edit: boolean; admit: boolean; shiftOt: boolean; discharge: boolean; doctorNotes: boolean; profile: boolean; ot?: boolean }

const SEX_SHORT: Record<string, string> = { MALE: "M", FEMALE: "F", OTHER: "O" };
const fmtDay = (iso: string | null) => (iso ? format(new Date(iso), "d MMM yyyy, EEE") : "-");
const fmtTime = (iso: string) => format(new Date(iso), "d MMM yyyy, EEE, h:mm a");
const istInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10) : "");

const inputCls = "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-2.5 py-1.5 text-sm text-[var(--color-ink-800)] placeholder:text-[var(--color-ink-300)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-transparent disabled:opacity-75 disabled:cursor-not-allowed";
const labelCls = "text-[10.5px] font-bold tracking-wider text-[var(--color-ink-500)] uppercase block mb-1";
const btnPrimary = "inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-lg bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] disabled:opacity-60 transition-colors";
const btnGhost = "inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] disabled:opacity-60 transition-colors";

/* ── Small pieces ──────────────────────────────────────────────────────── */

export function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div className={`relative w-full ${wide ? "max-w-3xl" : "max-w-md"} max-h-[90vh] overflow-y-auto rounded-xl p-5 shadow-2xl bg-white`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <p className="text-base font-bold text-[var(--color-ink-900)]">{title}</p>
          <button onClick={onClose} className="p-1 rounded-lg text-[var(--color-ink-400)] hover:bg-[var(--color-surface-sunken)]" aria-label="Close"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ErrorLine({ text }: { text: string }) {
  if (!text) return null;
  return <p className="text-sm text-red-600 flex items-center gap-1.5"><AlertTriangle size={14} className="shrink-0" /> {text}</p>;
}

/* ── Form bodies ───────────────────────────────────────────────────────── */

export function LongSummary({ visitId, complaint, diagnoses }: { visitId: string; complaint: string | null; diagnoses: FileData["diagnoses"] }) {
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

export function FormPanel({ d, keyName, title, display, row, freezeRow, can, onRefresh, part }: {
  d: FileData; keyName: string; title: string; display?: boolean; row: FormRow | undefined; can: Can; onRefresh: () => void;
  /** The row that holds the freeze state when it is not the form's own (Diet Chart). */
  freezeRow?: FormRow;
  /** Education form: which of its two tabs (Patient Education or Diet Chart) is shown. */
  part?: EducationPart;
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
  const [editSummary, setEditSummary] = useState(false);
  const [emrPrompt, setEmrPrompt] = useState(false);
  const router = useRouter();
  const emrHref = (edit: boolean) => {
    const back = encodeURIComponent(`/ipd/${d.id}`);
    return `/emr/${d.udid}?visit=${d.visitId}${edit ? "" : "&source=view-only"}&returnTo=${back}`;
  };
  const [pending, start] = useTransition();
  // The Diet Chart is frozen on its own, apart from Patient Education
  const freezeKey = part === "diet" ? "diet" : keyName;
  const fr = part === "diet" ? freezeRow : row;
  const frozen = !!fr?.frozen;
  // Education and the Diet Chart stay editable after OT, but while in the ward a frozen one is locked
  const lockedByFreeze = keyName === "education" && frozen && d.status === "ADMITTED";
  const editable = can.edit && formEditable(keyName, frozen, d.status) && !display && !lockedByFreeze;
  const freezable = FREEZABLE_KEYS.includes(freezeKey);
  const canFreeze = freezable && can.edit && !frozen && d.status === "ADMITTED";
  const canUnfreeze = freezable && can.edit && frozen && d.status === "ADMITTED";
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
    printInPlace(`/ipd-print/${d.id}`);
  });
  const freeze = () => start(async () => {
    setConfirmFreeze(false);
    const r = await freezeForm(d.id, freezeKey, display ? undefined : value);
    if (r.error) setError(r.error); else onRefresh();
  });
  const unfreeze = () => start(async () => {
    const r = await unfreezeForm(d.id, freezeKey);
    if (r.error) setError(r.error); else onRefresh();
  });
  const noteStop = async (label: string) => {
    const r = await noteDrugStopped(d.id, label);
    if (r.error) return r.error;
    onRefresh();
    return undefined;
  };
  const addLog = async (e: NewLog) => {
    const r = await addFormLog(d.id, keyName, e);
    if (r.error) return r.error;
    onRefresh();
    return undefined;
  };
  const removeDose = async (drugId: string, slot: string, date: string) => {
    const r = await removeDoseLog(d.id, drugId, slot, date);
    if (r.error) return r.error;
    onRefresh();
    return undefined;
  };
  const log: LogEntry[] = Array.isArray(row?.data?.log) ? row!.data.log : [];
  const info: FileInfo = d;
  const props = { value, change, saveNow, editable, canLog, addLog, removeDose, noteStop, log, f: info };

  let body: React.ReactNode;
  switch (keyName) {
    case "otFinal": body = <OtNotesView value={row?.data as OtNotesCopy} f={info} />; break;
    case "summary": body = <LongSummary visitId={d.visitId} complaint={d.complaint} diagnoses={d.diagnoses} />; break;
    case "investigations": body = <InvestigationsForm f={info} />; break;
    case "counselling": body = <CounsellingSheetForm sheet={d.counsellingSheet} detail={d.counsellingDetail ?? null} value={value} change={change} editable={editable} me={d.me} />; break;
    case "implant": body = <ImplantForm {...props} value={value as ImplantData} change={change} saveNow={saveNow} />; break;
    case "consents": body = <ConsentsForm {...props} value={value as ConsentsData} change={change} saveNow={saveNow} />; break;
    case "checklist": body = <ChecklistForm {...props} value={value as ChecklistData} change={change} saveNow={saveNow} />; break;
    case "education": body = <EducationForm {...props} value={value as EducationData} change={change} saveNow={saveNow} part={part} />; break;
    case "treatment": body = <TreatmentForm {...props} value={value as TreatmentData} change={change} saveNow={saveNow} />; break;
    case "nurse": {
      // The treatment and diet charts as they stand (saved data over the defaults), for the doctor's-orders check
      const chart = (key: string) => {
        const data = d.forms.find((x) => x.key === key)?.data;
        const base = (d.defaults[key] ?? {}) as FormJson;
        return data && Object.keys(data).length ? (isV2(data) ? { ...base, ...data } : { ...base, log: data.log ?? [] }) : base;
      };
      body = <NurseForm {...props} value={value as NurseData} change={change} saveNow={saveNow} treatment={chart("treatment") as unknown as TreatmentData} education={chart("education") as unknown as EducationData} />;
      break;
    }
    case "otNotes": body = <OtNotesForm {...props} value={value as OtNotesData} change={change} saveNow={saveNow} template={(d.defaults.otNotes as OtNotesData).steps} />; break;
    case "postOpNotes": body = <PostOpForm {...props} value={value as PostOpData} change={change} saveNow={saveNow} />; break;
    case "discharge":
      // A summary signed before the structured layout keeps its signed text
      body = frozen && typeof row?.data?.text === "string" && !isDischargeData(row.data)
        ? <TextForm value={row.data.text} editable={false} onChange={() => {}} mono rows={22} />
        : isDischargeData(value) && !editSummary
        // The standard discharge summary document, filled from the file; Edit opens the form
        ? (
          <div className="space-y-2">
            <FitPage><DischargeDocument s={value as DischargeData} h={dischargeHeader(d)} /></FitPage>
          </div>
        )
        : (
          <div className="space-y-2">
            <DischargeEditor value={value as DischargeData} onChange={(v) => change(v as unknown as FormJson)} editable={editable} ctx={dischargeCtx(d)} />
          </div>
        );
      break;
    default:
      body = <TextForm value={value.text ?? ""} editable={editable} onChange={(t) => change({ text: t })} rows={12} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm sm:text-base font-bold text-[var(--color-ink-900)]">{title}</h2>
        <div className="flex flex-wrap items-center gap-2 ml-auto">
          {keyName === "checklist" && (
            <div className="flex items-center gap-2">
              <label className="shrink-0 whitespace-nowrap text-[10.5px] font-bold uppercase tracking-wider text-[var(--color-ink-500)]">Handed over to OT by</label>
              <input value={value.handedOverBy ?? ""} disabled={!editable} onChange={(e) => change({ ...value, handedOverBy: e.target.value })} placeholder={editable ? "Nurse name" : "-"}
                className="w-44 rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-sm text-[var(--color-ink-800)] placeholder:text-[var(--color-ink-300)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-transparent disabled:bg-[var(--color-surface-sunken)]/50 disabled:cursor-default" />
              {editable && !value.handedOverBy && <button type="button" onClick={() => change({ ...value, handedOverBy: d.me })} className={btnGhost}>Me</button>}
            </div>
          )}
          {editable && touched && <SaveIndicator state={saveState} />}
          {keyName === "otFinal" && (
            <button type="button" onClick={() => printInPlace(`/ipd-print/${d.id}/ot-notes`)} className={btnGhost}><Printer size={14} /> Print</button>
          )}
          {keyName === "discharge" && isDischargeData(value) && (editSummary
            ? <button type="button" onClick={() => setEditSummary(false)} className={btnPrimary}><Check size={14} /> Done, view summary</button>
            : editable && <button type="button" onClick={() => setEditSummary(true)} className={btnGhost}><Pencil size={14} /> Edit summary</button>)}
          {keyName === "discharge" && (
            <button type="button" disabled={pending} onClick={printSummary} className={btnGhost}><Printer size={14} /> Print</button>
          )}
          {keyName === "summary" ? (
            // The long summary is the EMR itself: open the visit (an open visit asks edit or view)
            <button type="button" onClick={() => (d.visitOpen ? setEmrPrompt(true) : router.push(emrHref(false)))} className={btnPrimary}>
              <ExternalLink size={14} /> Open EMR
            </button>
          ) : keyName === "otFinal" ? (
            <span className="inline-flex items-center gap-1.5 text-caption font-semibold px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
              <Scissors size={12} /> From OT · saved by {row?.frozenBy} · {row?.frozenAt ? fmtTime(row.frozenAt) : ""}
            </span>
          ) : !freezable ? null : canUnfreeze ? (
            <button type="button" disabled={pending} onClick={unfreeze} title="Click to unfreeze"
              className="inline-flex items-center gap-1.5 text-caption font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-60">
              <Lock size={12} /> Frozen by {fr?.frozenBy} · {fr?.frozenAt ? fmtTime(fr.frozenAt) : ""} · Unfreeze
            </button>
          ) : frozen ? (
            <span className="inline-flex items-center gap-1.5 text-caption font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Lock size={12} /> Frozen by {fr?.frozenBy} · {fr?.frozenAt ? fmtTime(fr.frozenAt) : ""}
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
      {frozen && editable && freezable && (
        <p className="text-caption text-emerald-700">Confirmed · stays editable until discharge.</p>
      )}
      {emrPrompt && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={() => setEmrPrompt(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setEmrPrompt(false)} aria-label="Close" className="absolute top-3 right-3 p-1.5 rounded-lg text-[var(--color-ink-400)] hover:bg-[var(--color-surface-sunken)]"><X size={16} /></button>
            <p className="text-base font-bold text-[var(--color-ink-900)]">Open EMR</p>
            <p className="mt-1 text-sm text-[var(--color-ink-500)]">This visit is still open. Open it to edit or only to view?</p>
            <div className="mt-4 flex gap-3">
              <button type="button" onClick={() => router.push(emrHref(false))}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border border-[var(--color-border)] text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]">View Only</button>
              <button type="button" onClick={() => router.push(emrHref(true))}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[var(--color-primary-700)] text-white hover:bg-[var(--color-primary-800)]">Edit</button>
            </div>
          </div>
        </div>
      )}

      {body}

      <ErrorLine text={error} />
      {keyName !== "otFinal" && keyName !== "investigations" && <Photos d={d} keyName={keyName} list={row?.attachments ?? []} canAdd={can.edit && attachOpen(d.status)} onRefresh={onRefresh} />}

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
  const picker = canAdd && (
    <>
      <input ref={ref} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      <button disabled={busy} onClick={() => ref.current?.click()} className="inline-flex items-center gap-1.5 text-caption font-semibold text-[var(--color-primary-700)] hover:underline disabled:opacity-60">
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Upload file
      </button>
    </>
  );
  // Nothing attached yet: one slim line instead of an empty box
  if (list.length === 0) {
    return (
      <div className="flex items-center justify-between gap-2 border-t border-dashed border-[var(--color-border)] pt-2.5">
        <span className="text-caption text-[var(--color-ink-400)]">Photos of documents · none</span>
        {picker}
        <ErrorLine text={error} />
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-border)] p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className={labelCls + " mb-0"}>Photos of documents</p>
        {picker}
      </div>
      <ErrorLine text={error} />
      <div className="flex flex-wrap gap-2">
        {list.map((a, i) => (
          <a key={i} href={fileHref(a.ref)!} target="_blank" rel="noreferrer" title={`${a.name} · ${a.by} · ${fmtTime(a.at)}`}
            className="inline-flex items-center gap-1.5 max-w-[220px] rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-caption text-[var(--color-ink-700)] hover:border-[var(--color-primary-300)] hover:bg-[var(--color-primary-50)]">
            <FileText size={13} className="shrink-0 text-[var(--color-primary-600)]" /><span className="truncate">{a.name}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

/* ── Doctor's notes and activity ───────────────────────────────────────── */

function DoctorNotes({ d, can, onRefresh }: { d: FileData; can: Can; onRefresh: () => void }) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [editor, setEditor] = useState<{ noteId: string | null; seed: EmrCopy } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const canAdd = can.doctorNotes && logsOpen(d.status);
  const chart = d.forms.find((f) => f.key === "treatment");
  const chartDrugs = (Array.isArray(chart?.data?.drugs) ? chart!.data.drugs : (d.defaults.treatment as { drugs?: unknown[] } | undefined)?.drugs ?? []) as { id?: string; name: string; dose?: string; route?: string; eye?: string; frequency?: string; instructions?: string; start?: string; stopped?: boolean }[];
  const activeDrugs: ChartDrug[] = chartDrugs
    .map((x, i) => ({ id: x.id ?? `d${i}`, name: x.name, dose: x.dose ?? "", route: x.route ?? "", eye: x.eye ?? "", frequency: x.frequency ?? "", instructions: x.instructions ?? "", start: x.start ?? "", stopped: !!x.stopped }))
    .filter((x) => !x.stopped);

  // Only the signed notes are listed (the EMR-style notes); plain text entries are not shown
  const notes = d.doctorNotes.filter((n) => isEmrCopy(n.data));
  const addNote = () => start(async () => {
    const r = await getNoteSeed(d.id, d.postOpMeds);
    if (r.error || !r.copy) { setError(r.error ?? "Could not start the note."); return; }
    setError("");
    setEditor({ noteId: null, seed: r.copy });
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {canAdd && !editor && (
          <button type="button" disabled={pending} onClick={addNote} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary-600)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-primary-700)] disabled:opacity-60">
            {pending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Add Note
          </button>
        )}
        <h2 className="text-sm sm:text-base font-bold text-[var(--color-ink-900)]">Doctor&apos;s Notes</h2>
      </div>
      <ErrorLine text={error} />

      {editor && (
        <NoteEditor key={editor.noteId ?? "new"} admissionId={d.id} udid={d.udid} patient={{ age: d.patient.age, sex: d.patient.sex }}
          seed={editor.seed} noteId={editor.noteId} drugs={activeDrugs} onDone={() => { setEditor(null); onRefresh(); }} />
      )}

      {notes.length === 0 ? (
        !editor && <p className="text-sm italic text-[var(--color-ink-400)]">No notes yet.</p>
      ) : (
        <ol className="space-y-1.5">
          {notes.map((n) => {
            const copy = isEmrCopy(n.data) ? n.data : null;
            const isOpen = open === n.id;
            const who = n.by.replace(/^Dr\.?\s*/i, "");
            return (
              <li key={n.id} className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white">
                <div className="flex items-center gap-2 px-3 py-2">
                  <button type="button" onClick={() => setOpen(isOpen ? null : n.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left" aria-expanded={isOpen}>
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--color-surface-sunken)] text-[10px] font-bold uppercase text-[var(--color-ink-600)]">{who.split(" ").map((w) => w[0]).slice(0, 2).join("")}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold leading-tight text-[var(--color-ink-900)]">{format(new Date(n.at), "d MMMM yyyy, EEEE")} <span className="font-normal text-[var(--color-ink-400)]">· {format(new Date(n.at), "h:mm a")}</span></span>
                      <span className="block truncate text-[11px] leading-tight text-[var(--color-ink-400)]">Dr. {who}{n.editedAt ? ` · edited ${format(new Date(n.editedAt), "h:mm a")}` : ""}</span>
                    </span>
                    <ChevronRight size={14} className={`ml-auto shrink-0 text-[var(--color-ink-300)] transition-transform ${isOpen ? "rotate-90" : ""}`} />
                  </button>
                  {canAdd && copy && !editor && (
                    <button type="button" onClick={() => setEditor({ noteId: n.id, seed: copy })} className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-[var(--color-ink-500)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink-800)]">
                      <Pencil size={11} /> Edit
                    </button>
                  )}
                </div>
                {isOpen && (
                  <div className="border-t border-[var(--color-border)] px-4 py-3">
                    {copy ? <NoteSummary copy={copy} /> : <DoctorNoteText text={n.text} />}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/* Activity: one line per event; the calendar is a floating window */
const ACTIVITY_KINDS: Record<FileData["activity"][number]["kind"], { label: string; hex: string }> = {
  admission: { label: "Admission", hex: "#0EA5E9" },
  form: { label: "Form", hex: "#14B8A6" },
  update: { label: "Update", hex: "#F59E0B" },
  ot: { label: "OT", hex: "#8B5CF6" },
  discharge: { label: "Discharge", hex: "#10B981" },
};

/* ── Header dialogs ────────────────────────────────────────────────────── */

function DetailsDialog({ d, onClose, onDone }: { d: FileData; onClose: () => void; onDone: () => void }) {
  const [ward, setWard] = useState(d.ward ?? "");
  const [wardType, setWardType] = useState(d.wardType ?? "");
  const [floor, setFloor] = useState(d.floor ?? "");
  const [fileNo, setFileNo] = useState(d.fileNo ?? "");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const save = () => start(async () => {
    const r = await updateAdmissionDetails(d.id, { ward, wardType, floor, fileNo, expectedDischarge: istInput(d.expectedDischarge) });
    if (r.error) setError(r.error); else onDone();
  });
  return (
    <Modal title="Ward, floor & file details" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={labelCls}>Ward No.</label><input value={ward} onChange={(e) => setWard(e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>Floor No.</label><input value={floor} onChange={(e) => setFloor(e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>File No.</label><input value={fileNo} onChange={(e) => setFileNo(e.target.value)} className={inputCls} /></div>
        <div className="col-span-2">
          <label className={labelCls}>Ward Type</label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(WARD_TYPE_LABEL).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setWardType(wardType === k ? "" : k)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${wardType === k ? "bg-[var(--color-primary-600)] border-[var(--color-primary-600)] text-white" : "border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-primary-50)]"}`}>{l}</button>
            ))}
          </div>
        </div>
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
          {/* Keyword chips with "+ Custom" and a type-ahead list */}
          <div className="mb-1.5"><ChipRow storeKey={FIELD_OPTIONS.billingRemarks.storeKey} builtIns={FIELD_OPTIONS.billingRemarks.builtIns} prefix="+ " isOn={(x) => notes.includes(x)} onPick={(x) => setNotes(notes.includes(x) ? notes : (notes.trim() ? `${notes.trim()}, ${x}` : x))} /></div>
          <SuggestField storeKey={FIELD_OPTIONS.billingRemarks.storeKey} builtIns={FIELD_OPTIONS.billingRemarks.builtIns} value={notes} onChange={setNotes}>
            {(sp) => <textarea {...sp} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="e.g. insurance, billing remarks…" className={inputCls} />}
          </SuggestField>
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
/** An A4 sheet that shrinks to fit narrow screens (never wider than the space it has). */
function FitPage({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => setZoom(Math.max(0.3, Math.min(1, (el.clientWidth - 40) / 794)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="rounded-2xl border border-[var(--color-border)] bg-gray-100 p-3 sm:p-5">
      <div className="mx-auto w-fit bg-white shadow-md" style={{ zoom }}>{children}</div>
    </div>
  );
}

export function dischargeHeader(d: FileData): DischargeHeader {
  const discharge = d.forms.find((f) => f.key === "discharge");
  return {
    ...d.letterhead, specialty: null, email: null,
    patient: d.patient,
    fileNo: d.fileNo, ward: d.ward, wardType: d.wardType, floor: d.floor,
    type: d.type, typeOther: d.typeOther,
    admittedOn: d.admittedOn,
    signed: d.status === "DISCHARGED" && d.dischargedBy && d.dischargedAt ? { by: d.dischargedBy, at: discharge?.frozenAt ?? d.dischargedAt } : null,
  };
}

export function dischargeCtx(d: FileData): DischargeContext {
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

/* ── Counselling Sheet: the Counselling module's sheet + implant verification ── */

type VerifyKey = (typeof IMPLANT_VERIFY)[number]["key"];

function CounsellingSheetForm({ sheet, detail, value, change, editable, me }: {
  sheet: CounsellingSheet | null; detail: { data: CounsellingDetailData; canEdit: boolean } | null;
  value: FormJson; change: (v: FormJson) => void; editable: boolean; me: string;
}) {
  if (!sheet) return <p className="text-sm text-[var(--color-ink-500)]">No counselling record for this admission.</p>;
  const verify = (value.verify ?? {}) as Record<VerifyKey, { by: string; at: string } | null>;
  const done = IMPLANT_VERIFY.filter((i) => verify[i.key]).length;
  return (
    <div className="space-y-4">
      {detail
        ? <CounsellingDetail data={detail.data} embed canEdit={detail.canEdit && editable} canFit={false} canAddInvestigations={false} canUpload={false} canViewProfile={false} />
        : <CounsellingOverview sheet="sheet" {...sheet} orders={[]} consents={[]} education={{} as EducationData} />}
      <div className={`rounded-xl border p-3 sm:p-4 ${done === IMPLANT_VERIFY.length ? "border-emerald-200 bg-emerald-50/40" : "border-[var(--color-border)]"}`}>
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-sm font-bold text-[var(--color-ink-900)]">Implant verification</p>
          <span className="text-caption font-semibold text-[var(--color-ink-500)] tabular-nums">{done} of {IMPLANT_VERIFY.length} checked</span>
        </div>
        <ul className="divide-y divide-[var(--color-border)]">
          {IMPLANT_VERIFY.map((i) => {
            const t = verify[i.key];
            return (
              <li key={i.key} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-sm text-[var(--color-ink-800)]">{i.label}</span>
                <span className="flex items-center gap-2">
                  {t && <span className="text-caption text-[var(--color-ink-400)]">{t.by} · {fmtTime(t.at)}</span>}
                  <button type="button" disabled={!editable}
                    onClick={() => change({ ...value, v: 1, verify: { ...verify, [i.key]: t ? null : { by: me, at: new Date().toISOString() } } })}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors disabled:cursor-default ${t ? "bg-emerald-600 border-emerald-600 text-white" : "border-[var(--color-border)] text-[var(--color-ink-600)] enabled:hover:bg-[var(--color-surface-sunken)]"}`}>
                    <CheckCircle2 size={12} /> {t ? "Verified" : "Verify"}
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────── */

export function PatientFile({ data: d, can }: { data: FileData; can: Can }) {
  const router = useRouter();
  const refresh = () => router.refresh();
  const fixed = tabsFor(d.type, d.fileTabs);
  const custom = d.forms.filter((f) => isCustomKey(f.key));
  const rowOf = (key: string) => d.forms.find((f) => f.key === key);
  // Patient education and diet are two tabs (as in Counselling) over the one education form
  type Item = { key: string; form: string; title: string; display: boolean; preOp: boolean; part?: EducationPart };
  const items = useMemo<Item[]>(() => [
    ...fixed.flatMap((f): Item[] => f.key === "education"
      ? [{ key: "education", form: "education", title: "Patient Education", display: false, preOp: !!f.preOpOnly, part: "education" },
         { key: "diet", form: "education", title: "Diet Chart", display: false, preOp: !!f.preOpOnly, part: "diet" }]
      : [{ key: f.key, form: f.key, title: f.key === "summary" ? summaryTitle(d.visitDate) : f.title, display: !!f.display, preOp: !!f.preOpOnly }]),
    ...custom.map((f) => ({ key: f.key, form: f.key, title: f.title, display: false, preOp: false })),
  ], [fixed, custom, d.visitDate]);
  const freezeKeyOf = (i: { form: string; part?: EducationPart }) => (i.part === "diet" ? "diet" : i.form);
  const required = [...new Set(items.map(freezeKeyOf))].filter((k) => FREEZABLE_KEYS.includes(k));
  const frozenCount = required.filter((k) => rowOf(k)?.frozen).length;
  const allFrozen = frozenCount === required.length;

  const [picked, setSel] = useState<string>(items[0]?.key ?? "summary");
  // A form hidden by a type change falls back to the first form
  const otFinal = rowOf("otFinal");
  const sel = items.some((i) => i.key === picked) || picked === "doctorNotes" || (picked === "otFinal" && !!otFinal) ? picked : (items[0]?.key ?? "summary");
  const [dialog, setDialog] = useState<null | "details" | "type" | "ot" | "discharge" | "addForm">(null);
  const [removing, setRemoving] = useState<{ key: string; title: string } | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const status = d.status as IpdStatus;
  const showOt = canGoToOt(d.type) && status === "ADMITTED" && can.shiftOt;
  const showDischarge = can.discharge && canDischargeNow(d.type, status);
  const savedSummary = rowOf("discharge")?.data;
  const summaryNow = isDischargeData(savedSummary) ? normalizeDischarge(savedSummary, d.orders) : (d.defaults.discharge as DischargeData);

  const doShift = () => start(async () => {
    setDialog(null);
    const r = await shiftToOt(d.id);
    if (r.error) setError(r.error); else refresh();
  });
  // Tabs: picked when the file is created, added or removed later
  const choices = tabChoices(d.type, !!d.counsellingSheet).map((f) => ({ key: f.key as string, title: f.title, preOp: !!f.preOpOnly }));
  const always = ALWAYS_TABS.map((k) => ({ key: k, title: k === "summary" ? summaryTitle(d.visitDate) : IPD_FORMS.find((f) => f.key === k)?.title ?? k }));
  const tabsOpen = can.edit && (status === "ADMITTED" || status === "POST_OP");
  const createFile = async (tabs: string[]) => {
    const r = await createIpdFile(d.id, tabs);
    if (r.error) return r.error;
    refresh();
  };
  const addTabs = async (tabs: string[], name: string) => {
    if (tabs.length) { const r = await addFileTabs(d.id, tabs); if (r.error) return r.error; }
    let key: string | undefined;
    if (name) {
      if (status !== "ADMITTED") return "Custom forms can only be added before OT.";
      const r = await addCustomForm(d.id, name);
      if (r.error) return r.error;
      key = r.key;
    }
    setDialog(null);
    setSel(key ?? tabs[0] ?? sel);
    refresh();
  };
  const doRemove = () => start(async () => {
    if (!removing) return;
    const r = await removeFileTab(d.id, removing.key);
    setRemoving(null);
    if (r.error) setError(r.error); else { setSel(items[0]?.key ?? "summary"); refresh(); }
  });

  // Chrome-style tabs: the selected tab joins the form panel below it
  const tabBtn = (key: string, label: React.ReactNode, icon: React.ReactNode, extra?: React.ReactNode) => {
    const on = sel === key;
    return (
      <button key={key} type="button" role="tab" aria-selected={on} data-tab={key} onClick={() => setSel(key)}
        style={on ? undefined : { borderColor: "transparent" }}
        className={`shrink-0 inline-flex items-center gap-2 h-10 pl-3 pr-3.5 rounded-t-xl border border-b-0 text-xs font-semibold whitespace-nowrap transition-colors ${
          on
            ? "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-ink-900)] shadow-[0_-1px_4px_rgba(15,23,42,0.05)]"
            : "bg-transparent text-[var(--color-ink-500)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink-700)]"
        }`}>
        {icon}<span>{label}</span>{extra}
      </button>
    );
  };

  const selItem = items.find((i) => i.key === sel);

  return (
    <div className="fade-in pb-24">
      {/* Patient banner (same style as the Counselling and EMR banners) */}
      <section
        className="relative rounded-2xl overflow-hidden mb-3"
        style={{
          background: "linear-gradient(135deg, #0E8282 0%, #0C7676 55%, #0A6C6C 100%)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.10)",
          border: "1px solid rgba(255,255,255,0.10)",
        }}
      >
        <svg aria-hidden="true" className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.055 }} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="ipd-dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.2" fill="#38BDF8" />
            </pattern>
            <pattern id="ipd-cross" x="4" y="4" width="64" height="64" patternUnits="userSpaceOnUse">
              <rect x="29" y="22" width="6" height="20" rx="1" fill="#2DD4BF" />
              <rect x="22" y="29" width="20" height="6" rx="1" fill="#2DD4BF" />
            </pattern>
            <pattern id="ipd-ecg" x="0" y="0" width="160" height="48" patternUnits="userSpaceOnUse">
              <polyline points="0,24 20,24 28,8 36,40 44,16 52,32 60,24 80,24 88,8 96,40 104,16 112,32 120,24 160,24"
                fill="none" stroke="#38BDF8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#ipd-dots)" />
          <rect x="60%" width="40%" height="100%" fill="url(#ipd-cross)" />
          <rect y="60%" width="100%" height="40%" fill="url(#ipd-ecg)" />
        </svg>

        <div className="relative z-10 p-3 sm:p-4">
          <div className="flex flex-col lg:flex-row lg:items-stretch gap-3 lg:gap-5">
            {/* Left: photo + patient details */}
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="shrink-0">
                <PatientPhoto src={d.patient.photoUrl ? fileHref(d.patient.photoUrl)! : null} alt={d.patient.name} statusDot={null} />
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h2 className="text-base sm:text-lg font-bold text-white leading-tight tracking-tight">{d.patient.name}</h2>
                  <span className="text-xs font-medium text-white/60">{d.patient.age}y · {SEX_SHORT[d.patient.sex] ?? d.patient.sex}</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 ring-1 ring-white/20 px-2 py-0.5 text-micro font-semibold text-white">
                    <span className={`w-1.5 h-1.5 rounded-full ${status === "IN_OT" ? "bg-violet-300" : status === "POST_OP" ? "bg-emerald-300" : status === "DISCHARGED" ? "bg-slate-300" : "bg-sky-300"}`} />
                    {IPD_STATUS_LABEL[status] ?? status}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-white/65">
                  <span className="inline-flex items-center gap-1 text-teal-100 font-mono font-semibold tracking-wide">
                    <Hash size={10} />{d.patient.id}
                  </span>
                  {d.patient.mobile && (
                    <span className="inline-flex items-center gap-1"><Phone size={10} />{d.patient.mobile}</span>
                  )}
                  {/* Drug allergy, as in the EMR banner */}
                  {d.drugAllergy.nkda ? (
                    <span className="inline-flex items-center gap-1 text-caption px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-300 border border-emerald-400/25">
                      <CheckCircle2 size={10} />NKDA
                    </span>
                  ) : d.drugAllergy.text ? (
                    <span className="inline-flex items-center gap-1 text-caption px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/25">
                      <AlertTriangle size={10} />{d.drugAllergy.text.replace(/•\s*/g, "").split("\n").map((x) => x.trim()).filter(Boolean).join(", ")}
                    </span>
                  ) : null}
                </div>
                {(d.complaint || d.diagnoses.length > 0) && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {d.complaint && <ComplaintChips value={d.complaint} tone="dark" />}
                    {d.diagnoses.map((x, i) => (
                      <span key={i} className="clinical-diagnosis-chip-dark inline-flex items-center gap-1 text-caption px-2.5 py-0.5 rounded-full border">
                        {x.laterality && <span className="clinical-laterality">{x.laterality}</span>}{x.description}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right: surgery (or admission) | dates, in one glass panel */}
            <div className="lg:w-[52%] shrink-0 rounded-2xl bg-white/[0.08] ring-1 ring-white/15 backdrop-blur-sm grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">{d.surgery ? "Surgery" : "Admission"}</p>
                <p className="mt-1 text-base sm:text-lg font-bold text-white leading-snug">
                  {d.surgery ? (
                    <>
                      {d.laterality && (
                        <span className="mr-2 inline-flex items-center rounded-md bg-white px-1.5 py-px align-[3px] text-xs font-extrabold text-[#0A6C6C]">{d.laterality}</span>
                      )}
                      {d.surgery}
                      {d.implant && !/^(none|nil|na|-)$/i.test(d.implant.trim()) && <span className="font-medium text-white/80"> + {d.implant}</span>}
                      {d.anaesthesia && (
                        <span className="font-medium italic text-white/70">
                          <span className="mx-2 not-italic text-white/40">·</span>{d.anaesthesia}
                        </span>
                      )}
                    </>
                  ) : admissionTypeText(d.type, d.typeOther)}
                </p>
                <p className="mt-1 text-caption text-white/70">
                  {admissionTypeText(d.type, d.typeOther)}
                  {can.admit && status === "ADMITTED" && (
                    <button onClick={() => setDialog("type")} className="ml-1.5 font-semibold text-teal-100 underline-offset-2 hover:underline">Change</button>
                  )}
                  {d.reason && <span className="text-white/60"> · {d.reason}</span>}
                </p>
              </div>
              {/* Soft separator: a line that fades out at both ends */}
              <div className="relative px-4 py-3 flex flex-col justify-center gap-0.5 sm:min-w-[11rem] text-caption text-white/60 before:absolute before:pointer-events-none before:top-0 before:left-4 before:right-4 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent sm:before:left-0 sm:before:right-auto sm:before:top-3 sm:before:bottom-3 sm:before:h-auto sm:before:w-px sm:before:bg-gradient-to-b">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50 mb-0.5">Dates</p>
                <span className="whitespace-nowrap"><span className="inline-block w-10 font-semibold">DOA</span><b className="text-white">{fmtDay(d.admittedOn)}</b></span>
                {d.type === "PRE_OP" && <span className="whitespace-nowrap"><span className="inline-block w-10 font-semibold">DOS</span><b className="text-white">{fmtDay(d.surgeryDate)}</b></span>}
                {d.dischargedAt && <span className="whitespace-nowrap"><span className="inline-block w-10 font-semibold">DOD</span><b className="text-white">{fmtDay(d.dischargedAt)}</b></span>}
              </div>
            </div>
          </div>

          {/* Ward / file / floor, forms frozen, and the actions */}
          <div className="mt-3 pt-3 border-t border-white/15 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/65">
            <span><BedDouble size={12} className="inline -mt-0.5 mr-1 text-teal-200" />Ward <b className="text-white">{d.ward || "-"}</b>{d.wardType ? ` (${wardTypeText(d.wardType)})` : ""}</span>
            <span>File <b className="text-white">{d.fileNo || "-"}</b></span>
            <span>Floor <b className="text-white">{d.floor || "-"}</b></span>
            {can.edit && status !== "DISCHARGED" && (
              <button onClick={() => setDialog("details")} className="inline-flex items-center gap-1 font-semibold text-teal-100 hover:underline"><Pencil size={11} /> Edit</button>
            )}
            {status === "DISCHARGED" && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-2.5 py-0.5 font-semibold text-emerald-100"><Lock size={11} /> File frozen after discharge</span>}
            <span className="tabular-nums">Forms frozen <b className="text-white">{frozenCount}/{required.length}</b></span>
            <div className="ml-auto flex flex-wrap justify-end gap-2">
              {showOt && (
                <button
                  disabled={!allFrozen || pending}
                  onClick={() => setDialog("ot")}
                  title={allFrozen ? "Shift the file to OT" : "Freeze every form to unlock"}
                  className={`inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors ${allFrozen ? "bg-emerald-500 text-white hover:bg-emerald-600" : "bg-white/10 text-white/50 ring-1 ring-white/15 cursor-not-allowed"}`}
                >
                  {allFrozen ? <Scissors size={14} /> : <Lock size={14} />} Shift to OT
                </button>
              )}
              {showDischarge && (
                <button onClick={() => setDialog("discharge")} className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-lg bg-white text-[#0A6C6C] hover:bg-teal-50">
                  <LogOut size={14} /> Discharge
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {status === "IN_OT" && (
        <div className="mb-3 rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface-sunken)]/60 px-3 py-2 text-sm text-[var(--color-ink-700)]">
          In OT since {d.shiftedToOtAt ? fmtTime(d.shiftedToOtAt) : "-"}. The file returns to the post-op ward from the OT module.
          {can.ot && <Link href={`/ot/${d.id}`} className="ml-2 font-semibold underline">Open in OT</Link>}
        </div>
      )}
      {status === "DISCHARGED" && (
        <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Discharged by {d.dischargedBy} on {d.dischargedAt ? fmtTime(d.dischargedAt) : "-"} · summary signed with OTP. The file is read-only.
          {d.dischargeNotes && <span className="block mt-1 text-slate-600">Notes: {d.dischargeNotes}</span>}
        </div>
      )}
      {error && <div className="mb-3"><ErrorLine text={error} /></div>}

      {/* Forms as tabs | selected form */}
      <div>
        <div role="tablist" aria-label="Patient file forms" className="sticky top-0 z-20 flex flex-wrap items-end gap-x-1 gap-y-0.5 px-1 pt-1 -mb-px bg-[var(--color-bg)]">
          {items.map((i) => {
            const r = rowOf(i.form);
            const fz = rowOf(freezeKeyOf(i));
            const formTitle = i.part ? "Patient Education & Diet Chart" : i.title;
            return tabBtn(
              i.key,
              <>{i.title}{i.preOp && <span className="ml-1.5 text-micro font-bold rounded px-1 py-px bg-amber-50 text-amber-700 border border-amber-200">Pre-op</span>}</>,
              i.key === "summary" || !FREEZABLE_KEYS.includes(freezeKeyOf(i)) ? <FileText size={14} className="shrink-0 text-[var(--color-ink-400)]" />
                : fz?.frozen ? <CheckCircle2 size={14} className="shrink-0 text-emerald-600" /> : <Circle size={14} className="shrink-0 text-[var(--color-ink-300)]" />,
              <>
                {(r?.attachments?.length ?? 0) > 0 && <Camera size={12} className="shrink-0 text-[var(--color-ink-400)]" />}
                {tabsOpen && sel === i.key && !ALWAYS_TABS.includes(i.key) && !fz?.frozen && (
                  <span role="button" tabIndex={0} aria-label={`Remove ${i.title}`} title="Remove this tab"
                    onClick={(e) => { e.stopPropagation(); setRemoving({ key: i.form, title: formTitle }); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setRemoving({ key: i.form, title: formTitle }); } }}
                    className="-mr-1 grid h-5 w-5 place-items-center rounded-full text-[var(--color-ink-400)] hover:bg-red-50 hover:text-red-600">
                    <X size={12} />
                  </span>
                )}
              </>,
            );
          })}
          {tabsOpen && d.fileCreated && (
            <button type="button" onClick={() => { setDialog("addForm"); setError(""); }} title="Add tabs" aria-label="Add tabs"
              className="shrink-0 mb-1 w-8 h-8 rounded-full flex items-center justify-center text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)]">
              <Plus size={16} />
            </button>
          )}
          <span className="shrink-0 self-center mx-1 h-5 w-px bg-[var(--color-border)]" />
          {otFinal && tabBtn("otFinal", "OT Notes", <Scissors size={14} className="shrink-0 text-violet-600" />,
            <span className="text-micro font-bold rounded px-1 py-px bg-violet-50 text-violet-700 border border-violet-200">OT</span>)}
          {tabBtn("doctorNotes", "Doctor's Notes", <Stethoscope size={14} className="shrink-0 text-[var(--color-primary-600)]" />,
            d.doctorNotes.some((n) => isEmrCopy(n.data)) ? <span className="text-micro font-bold rounded-full px-1.5 bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]">{d.doctorNotes.filter((n) => isEmrCopy(n.data)).length}</span> : undefined)}
          <button type="button" onClick={() => setActivityOpen(true)} title="Activity" aria-label="Open the activity timeline"
            className="shrink-0 mb-1 grid h-8 w-8 place-items-center rounded-full text-[var(--color-ink-500)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-primary-700)]">
            <History size={16} />
          </button>
        </div>
        {activityOpen && (
          <ActivityPanel kicker="Activity" title={d.patient.name} onClose={() => setActivityOpen(false)} kinds={ACTIVITY_KINDS}
            events={d.activity.map((e) => ({ at: e.at, title: e.text, detail: e.detail, by: e.by, kind: e.kind }))} />
        )}

        <section className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 sm:p-4 min-w-0 ${sel === items[0]?.key ? "rounded-tl-none" : ""}`}>
          {sel === "doctorNotes" ? <DoctorNotes d={d} can={can} onRefresh={refresh} />
            : sel === "otFinal" && otFinal ? (
              <FormPanel key="otFinal" d={d} keyName="otFinal" title="OT Notes" row={otFinal} can={can} onRefresh={refresh} />
            ) : selItem ? (
              <FormPanel key={`${selItem.key}-${rowOf(freezeKeyOf(selItem))?.frozen ? "f" : "o"}-${d.status}`} d={d} keyName={selItem.form} title={selItem.title} display={selItem.display} row={rowOf(selItem.form)} freezeRow={rowOf(freezeKeyOf(selItem))} can={can} onRefresh={refresh} part={selItem.part} />
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
        <FileTabsDialog
          title="Add tabs"
          sub="Tick the tabs to add. They are filled with the details already recorded."
          always={[]}
          choices={choices.filter((c) => !d.fileTabs.includes(c.key))}
          initial={[]}
          confirmLabel="Add"
          custom={status === "ADMITTED"}
          onConfirm={addTabs}
          onClose={() => setDialog(null)}
        />
      )}
      {/* First time: create the file with the chosen tabs */}
      {!d.fileCreated && can.edit && (
        <FileTabsDialog
          title="Create Patient File"
          sub="Choose the tabs for this file. They are filled with the details already recorded. Tabs can be added or removed later."
          always={always}
          choices={choices}
          initial={choices.map((c) => c.key)}
          confirmLabel="Create file"
          onConfirm={(tabs) => createFile(tabs)}
          onClose={() => router.push(d.returnTo)}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={`Remove ${removing.title}?`}
          message={isCustomKey(removing.key)
            ? "The tab and what is written in it are removed."
            : "The tab is removed from the file. What was entered is kept and comes back if the tab is added again."}
          confirmLabel="Remove"
          onConfirm={doRemove}
          onCancel={() => setRemoving(null)}
        />
      )}
    </div>
  );
}
