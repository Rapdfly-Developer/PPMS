"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft, User, FolderOpen, CheckCircle2, Circle, ShieldCheck, Play, Syringe, Square, BedDouble, OctagonX, Lock,
  ChevronDown, ChevronUp, AlertTriangle, Loader2, Save, LogOut, Clock, Printer,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { fileHref } from "@/lib/file-href";
import { printInPlace } from "@/lib/print-in-place";
import { normalizeDischarge, isDischargeData, wardTypeText, type DischargeData } from "@/lib/ipd";
import { defaultPostOp, isV2, type OtNotesData, type PostOpData } from "@/lib/ipd-forms";
import {
  ABORT_REASON_KEYWORDS, ANAESTHESIA_DELAY_KEYWORDS, ANAESTHESIA_DELAY_MIN, EVENT_REASON_KEYWORDS, INTRAOP_KEYWORDS,
  OT_STAGE_LABEL, POSTOP_KEYWORDS, SHIFT_DELAY_KEYWORDS, SHIFT_DELAY_MIN, buildOtNotesCopy, eventText,
  minutesBetween, otNotesOpen, otStage, stepKeywords, type OtNotesCopy, type OtOutcome, type VerifyMap,
} from "@/lib/ot";
import { ErrorLine, FormPanel, LongSummary, Modal, dischargeCtx, type Can, type FileData } from "../../ipd/[admissionId]/PatientFile";
import { OtNotesView } from "../../ipd/[admissionId]/OtNotesView";
import { PostOpForm, Seg } from "../../ipd/[admissionId]/IpdForms";
import { DischargeEditor } from "../../ipd/[admissionId]/DischargeEditor";
import { ChipRow, SuggestField, replaceTail, useCustomOptions } from "../../ipd/[admissionId]/customOptions";
import { useSuggest } from "@/components/ui/Suggest";
import {
  abortOperation, anaesthesiaAdministered, beginOperation, confirmOtVerified, dischargeFromOt, endOperation,
  requestOtDischargeOtp, saveOtNotes, saveOtOutcome, saveOtWardForm, shiftToWard, verifyOtForm,
} from "../actions";

/* ── Types ─────────────────────────────────────────────────────────────── */

export interface OtCaseData {
  verified: VerifyMap;
  confirmedAt: string | null; confirmedBy: string | null;
  begunAt: string | null; begunBy: string | null;
  anaesthesiaAt: string | null; anaesthesiaBy: string | null; anaesthesiaDelayReason: string | null;
  endedAt: string | null; endedBy: string | null;
  abortedAt: string | null; abortedBy: string | null; abortReason: string | null; abortStep: string | null;
  outcomeSavedAt: string | null;
  eventful: boolean; eventReason: string; eventStep: string; intraOp: string; postOp: string;
  otNotesChoice: string | null; wardNotesChoice: string | null;
  otNotes: OtNotesCopy | null; otNotesSavedAt: string | null; otNotesSavedBy: string | null;
  shiftedToWardAt: string | null; shiftedToWardBy: string | null; shiftDelayReason: string | null;
  dischargedFromOt: boolean;
  dischargeSavedInOt: boolean;
}

interface OtCan { verify: boolean; operate: boolean; notes: boolean; shiftWard: boolean; discharge: boolean; ipd: boolean; profile: boolean }
type Item = { key: string; title: string; display: boolean };

const SEX_LONG: Record<string, string> = { MALE: "Male", FEMALE: "Female", OTHER: "Other" };
const fmtTime = (iso: string | null) => (iso ? format(new Date(iso), "h:mm a") : "-");
const fmtFull = (iso: string | null) => (iso ? format(new Date(iso), "d MMM yyyy, h:mm a") : "-");
const fmtDay = (iso: string | null) => (iso ? format(new Date(iso), "d MMM yyyy") : "-");
const istDay = (iso: string) => new Date(new Date(iso).getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 10);

const inputCls = "w-full rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-sm text-[var(--color-ink-800)] placeholder:text-[var(--color-ink-300)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-transparent";
const labelCls = "text-[10.5px] font-bold tracking-wider text-[var(--color-ink-500)] uppercase block mb-1";
const btnPrimary = "inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-lg bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] disabled:opacity-60 transition-colors";
const btnGhost = "inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] disabled:opacity-60 transition-colors";
const btnDanger = "inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-lg border border-red-300 bg-white text-red-700 hover:bg-red-50 disabled:opacity-60 transition-colors";
/** Stage badge: neutral, red only when aborted. */
const stagePill = (aborted: boolean) => aborted ? "bg-red-50 text-red-700 border border-red-200" : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-700)] border border-[var(--color-border)]";

const READ_ONLY: Can = { edit: false, admit: false, shiftOt: false, discharge: false, doctorNotes: false, profile: false };

/* ── Small pieces ──────────────────────────────────────────────────────── */

/**
 * A keyword box with type-ahead: suggestions as you type (most used first),
 * Enter or a click picks, "Save as a keyword" keeps new text for next time.
 * Only the top 5 quick picks show under it. `single` (the step) lists the
 * surgery's steps in order, numbered, as soon as the box is focused.
 */
function KeywordBox({ label, value, onChange, keywords, storeKey, rows = 2, placeholder, single, inline }: {
  label: string; value: string; onChange: (v: string) => void; keywords: readonly string[]; storeKey: string; rows?: number; placeholder?: string; single?: boolean;
  /** Show the list in the page flow (inside dialogs, so it is not cut off). */
  inline?: boolean;
}) {
  const o = useCustomOptions(storeKey, keywords);
  const has = (k: string) => value.split(/[,;\n]\s*/).map((x) => x.trim()).includes(k);
  const toggle = (k: string) => {
    if (has(k)) onChange(value.split(/,\s*/).filter((x) => x.trim() !== k).join(", "));
    else onChange(value.trim() ? `${value.trim().replace(/[,;]$/, "")}, ${k}` : k);
  };
  const stepSuggest = useSuggest({
    ns: `ipd_${storeKey}`, term: single ? value : "", options: o.all, keepOrder: true, openOnFocus: true, numbered: true, max: 40, inline,
    onPick: (x) => onChange(x),
    onAddNew: (x) => { const t = o.add(x); if (t) onChange(t); },
  });
  if (single) {
    return (
      <div>
        <label className={labelCls}>{label}</label>
        <div className="relative">
          <input {...stepSuggest.inputProps} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ? `${placeholder} · or pick from the list` : "Pick from the list or type"} className={inputCls} />
          {stepSuggest.menu}
        </div>
      </div>
    );
  }
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <SuggestField storeKey={storeKey} builtIns={keywords} value={value} onChange={onChange} apply={(v, pick) => replaceTail(v, pick)}>
        {(sp) => <textarea {...sp} value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder ?? "Type to search keywords, or write freely"} className={`${inputCls} resize-y`} />}
      </SuggestField>
      <div className="mt-1.5"><ChipRow storeKey={storeKey} builtIns={keywords} isOn={has} onPick={toggle} limit={5} /></div>
    </div>
  );
}

function ReasonDialog({ title, message, keywords, storeKey, confirmLabel, pending, error, onConfirm, onClose }: {
  title: string; message: string; keywords: readonly string[]; storeKey: string; confirmLabel: string; pending: boolean; error: string;
  onConfirm: (reason: string) => void; onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-sm text-[var(--color-ink-600)] mb-3">{message}</p>
      <KeywordBox label="Reason" value={reason} onChange={setReason} keywords={keywords} storeKey={storeKey} rows={2} />
      <div className="mt-4 space-y-3">
        <ErrorLine text={error} />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className={btnGhost}>Cancel</button>
          <button disabled={pending || !reason.trim()} onClick={() => onConfirm(reason)} className={btnPrimary}>{confirmLabel}</button>
        </div>
      </div>
    </Modal>
  );
}

/** One step of the time line: dot, label, time (and who), on a single line. */
function Stamp({ label, at, by, done, tone = "ok" }: { label: string; at: string | null; by?: string | null; done: boolean; tone?: "ok" | "bad" }) {
  const dot = !done ? "bg-white border-[var(--color-ink-300)]" : tone === "bad" ? "bg-red-600 border-red-600" : "bg-[var(--color-primary-600)] border-[var(--color-primary-600)]";
  return (
    <li className="flex items-center gap-1.5 min-w-0 whitespace-nowrap" title={done && by ? `${label} · ${by}` : label}>
      <span className={`w-2 h-2 rounded-full border shrink-0 ${dot}`} />
      <span className={`text-xs ${done ? "text-[var(--color-ink-600)]" : "text-[var(--color-ink-400)]"}`}>{label}</span>
      <span className={`text-xs font-semibold tabular-nums ${!done ? "text-[var(--color-ink-300)]" : tone === "bad" ? "text-red-700" : "text-[var(--color-ink-900)]"}`}>{done ? fmtTime(at) : "--:--"}</span>
      {done && by && <span className="text-micro text-[var(--color-ink-400)] hidden xl:inline">{by}</span>}
    </li>
  );
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

const elapsed = (from: string, now: number) => {
  const m = Math.max(0, Math.floor((now - new Date(from).getTime()) / 60000));
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
};

/* ── Page ──────────────────────────────────────────────────────────────── */

export function OtFile({ d, oc, items, draft, can }: { d: FileData; oc: OtCaseData; items: Item[]; draft: OtNotesData; can: OtCan }) {
  const router = useRouter();
  const refresh = () => router.refresh();
  const required = items.map((i) => i.key);
  const stage = otStage(oc, required);
  const operating = stage === "OPERATING" || stage === "ANAESTHESIA";
  const now = useNow(operating || stage === "ENDED");
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<null | "confirm" | "begin" | "anaesthesia" | "anaesthesiaReason" | "end" | "abort" | "shift" | "shiftReason" | "dischargeAsk" | "discharge">(null);
  const [showSummary, setShowSummary] = useState(true);
  const [picked, setPicked] = useState(items[0]?.key ?? "summary");
  const pinRef = useRef<HTMLDivElement>(null);
  const [pinH, setPinH] = useState(0);
  useEffect(() => {
    const el = pinRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setPinH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const tabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    tabsRef.current?.querySelector<HTMLElement>(`[data-tab="${picked}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [picked]);
  const sel = items.find((i) => i.key === picked) ?? items[0];
  const verifiedCount = required.filter((k) => oc.verified[k]).length;
  const rowOf = (key: string) => d.forms.find((f) => f.key === key);
  const steps = useMemo(() => stepKeywords(draft.steps ?? []), [draft.steps]);
  const leftOt = stage === "DONE" || stage === "ABORTED";
  const verifying = stage === "VERIFY" || stage === "CONFIRM";

  const run = (fn: () => Promise<{ error?: string; needReason?: boolean }>, onNeedReason?: () => void, after?: () => void) => start(async () => {
    setError("");
    const r = await fn();
    if (r.needReason) { onNeedReason?.(); return; }
    if (r.error) { setError(r.error); return; }
    setDialog(null);
    after?.();
    refresh();
  });

  // "None" means no implant for this surgery: leave it out of the title
  const hasImplant = !!d.implant && !/^(none|nil|na|-)$/i.test(d.implant.trim());
  const surgeryLine = [d.laterality, d.surgery].filter(Boolean).join(" ") || "Surgery not recorded";

  /* Header: patient demographics, surgery and implant large and bold */
  const header = (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-[var(--color-primary-100)] flex items-center justify-center shrink-0 overflow-hidden">
            {d.patient.photoUrl ? <img src={fileHref(d.patient.photoUrl)!} alt={d.patient.name} className="w-full h-full object-cover" /> : <User size={16} className="text-[var(--color-primary-700)]" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm text-[var(--color-ink-600)]">
              <span className="text-sm font-bold text-[var(--color-ink-900)]">{d.patient.name}</span> · {d.patient.age}y / {SEX_LONG[d.patient.sex] ?? d.patient.sex} · {d.patient.id}
            </p>
            <p className="text-sm font-bold text-[var(--color-ink-900)] mt-0.5">
              {surgeryLine}
              {hasImplant && <span> + {d.implant}</span>}
              <span className="font-semibold text-[var(--color-ink-600)]"> · {d.anaesthesia || "Anaesthesia -"}</span>
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5 text-xs text-[var(--color-ink-500)]">
              <span>Ward <b className="text-[var(--color-ink-800)]">{d.ward || "-"}</b>{d.wardType ? ` (${wardTypeText(d.wardType)})` : ""}</span>
              <span>File <b className="text-[var(--color-ink-800)]">{d.fileNo || "-"}</b></span>
              <span>Floor <b className="text-[var(--color-ink-800)]">{d.floor || "-"}</b></span>
              <span>DOS <b className="text-[var(--color-ink-800)]">{fmtDay(d.surgeryDate)}</b></span>
              <span>Surgeon <b className="text-[var(--color-ink-800)]">{d.doctor}</b></span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${stagePill(stage === "ABORTED")}`}>
            {stage === "DONE" && oc.dischargedFromOt ? "Discharged" : OT_STAGE_LABEL[stage]}
          </span>
          {operating && oc.begunAt && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-ink-500)] tabular-nums"><Clock size={12} /> {elapsed(oc.begunAt, now)} since begin</span>
          )}
        </div>
      </div>

      {/* Time stamp at every stage */}
      <ol className="mt-2.5 pt-2.5 border-t border-[var(--color-border)] flex flex-wrap items-center gap-x-5 gap-y-1.5">
        <Stamp label="Shifted to OT" at={d.shiftedToOtAt} done={!!d.shiftedToOtAt} />
        <Stamp label="Verified" at={oc.confirmedAt} by={oc.confirmedBy} done={!!oc.confirmedAt} />
        <Stamp label="Begun" at={oc.begunAt} by={oc.begunBy} done={!!oc.begunAt} />
        <Stamp label="Anaesthesia" at={oc.anaesthesiaAt} by={oc.anaesthesiaBy} done={!!oc.anaesthesiaAt} />
        {oc.abortedAt
          ? <Stamp label="Aborted" at={oc.abortedAt} by={oc.abortedBy} done tone="bad" />
          : <Stamp label="Ended" at={oc.endedAt} by={oc.endedBy} done={!!oc.endedAt} />}
        <Stamp label={oc.dischargedFromOt ? "Discharged" : "Shifted to ward"} at={oc.shiftedToWardAt} by={oc.shiftedToWardBy} done={!!oc.shiftedToWardAt} />
      </ol>
      {(oc.anaesthesiaDelayReason || oc.shiftDelayReason) && (
        <div className="mt-1.5 flex flex-wrap gap-x-6 gap-y-1 text-caption text-amber-800">
          {oc.anaesthesiaDelayReason && <span><AlertTriangle size={11} className="inline mr-1" />Anaesthesia delay: {oc.anaesthesiaDelayReason}</span>}
          {oc.shiftDelayReason && <span><AlertTriangle size={11} className="inline mr-1" />Shift delay: {oc.shiftDelayReason}</span>}
        </div>
      )}
    </div>
  );

  const topBar = (
    <div className="flex items-center justify-between gap-3 mb-3">
      <Link href="/ot" className="inline-flex items-center gap-1.5 text-label sm:text-sm font-medium text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)]"><ArrowLeft size={15} /> OT Schedule</Link>
      <div className="flex flex-wrap justify-end gap-2">
        {can.ipd && <Link href={`/ipd/${d.id}?returnTo=${encodeURIComponent(`/ot/${d.id}`)}`} className={btnGhost}><FolderOpen size={14} /> Patient File</Link>}
        {can.profile && <Link href={`/patients/${d.udid}?source=ot&returnTo=${encodeURIComponent(`/ot/${d.id}`)}`} className={btnGhost}><User size={14} /> Patient Profile</Link>}
      </div>
    </div>
  );

  /* After the file is shifted to the ward: only the OT notes stay here */
  if (leftOt) {
    return (
      <div className="fade-in pb-24">
        {topBar}
        <div className="mb-3">{header}</div>
        <div className={`rounded-lg px-3.5 py-2 mb-3 text-sm ${stage === "ABORTED" ? "border border-red-200 bg-red-50 text-red-800" : "border border-slate-200 bg-slate-50 text-slate-700"}`}>
          {stage === "ABORTED"
            ? <>Operation aborted at {fmtFull(oc.abortedAt)} at step <b>{oc.abortStep}</b>. Reason: {oc.abortReason}. The file was shifted back to IPD.</>
            : oc.dischargedFromOt
              ? <>Discharged from OT by {oc.shiftedToWardBy} on {fmtFull(oc.shiftedToWardAt)}. The file is in the Patient Library.</>
              : <>Shifted to ward by {oc.shiftedToWardBy} on {fmtFull(oc.shiftedToWardAt)}. The file is in IPD; only the OT notes stay in this module.</>}
        </div>
        <OtNotesPanel d={d} oc={oc} draft={draft} canEdit={can.notes} onSaved={refresh} />
      </div>
    );
  }

  /* Action bar: the next step only */
  const outcome: OtOutcome = { eventful: oc.eventful, reason: oc.eventReason, step: oc.eventStep, intraOp: oc.intraOp, postOp: oc.postOp };
  const anaesthesiaLate = !!oc.begunAt && minutesBetween(oc.begunAt, new Date(now)) > ANAESTHESIA_DELAY_MIN;
  const shiftLate = !!oc.endedAt && minutesBetween(oc.endedAt, new Date(now)) > SHIFT_DELAY_MIN;
  const later = oc.otNotesChoice === "LATER" || oc.wardNotesChoice === "LATER";

  const msg = "text-sm text-[var(--color-ink-700)]";
  const actionBar = (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 mt-2 mb-3 flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0">
        {stage === "VERIFY" && <p className={msg}>Verify and freeze each form again in OT · <b className="tabular-nums">{verifiedCount}/{required.length}</b></p>}
        {stage === "CONFIRM" && <p className={msg}>Every form is verified. Confirm once again to unlock Begin operation.</p>}
        {stage === "READY" && <p className={msg}>Everything confirmed by {oc.confirmedBy} at {fmtTime(oc.confirmedAt)}.</p>}
        {stage === "OPERATING" && <p className={msg}>Operation begun at {fmtTime(oc.begunAt)}. Record when anaesthesia is administered.{anaesthesiaLate && <span className="text-amber-700"> More than {ANAESTHESIA_DELAY_MIN} min: a reason will be asked.</span>}</p>}
        {stage === "ANAESTHESIA" && <p className={msg}>Anaesthesia administered at {fmtTime(oc.anaesthesiaAt)}.</p>}
        {stage === "ENDED" && <p className={msg}>Operation ended at {fmtTime(oc.endedAt)}. Complete the decisions below, then shift to ward.{shiftLate && oc.outcomeSavedAt && <span className="text-amber-700"> More than {SHIFT_DELAY_MIN} min: a reason will be asked.</span>}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {operating && can.operate && (
          <button disabled={pending} onClick={() => { setError(""); setDialog("abort"); }} className={btnDanger}><OctagonX size={14} /> Abort operation</button>
        )}
        {stage === "CONFIRM" && can.verify && (
          <button disabled={pending} onClick={() => setDialog("confirm")} className={btnPrimary}><ShieldCheck size={14} /> Confirm everything</button>
        )}
        {stage === "READY" && can.operate && (
          <button disabled={pending} onClick={() => setDialog("begin")} className={btnPrimary}><Play size={14} /> Begin operation</button>
        )}
        {stage === "OPERATING" && can.operate && (
          <button disabled={pending} onClick={() => setDialog(anaesthesiaLate ? "anaesthesiaReason" : "anaesthesia")} className={btnPrimary}><Syringe size={14} /> Anaesthesia administered</button>
        )}
        {stage === "ANAESTHESIA" && can.operate && (
          <button disabled={pending} onClick={() => setDialog("end")} className={btnPrimary}><Square size={14} /> End operation</button>
        )}
        {stage === "ENDED" && can.shiftWard && (
          <button disabled={pending || !oc.outcomeSavedAt} title={oc.outcomeSavedAt ? undefined : "Record the status first"}
            onClick={() => setDialog(shiftLate ? "shiftReason" : "shift")}
            className={`${btnPrimary} ${later && oc.outcomeSavedAt ? "ring-2 ring-offset-1 ring-[var(--color-primary-300)]" : ""}`}>
            <BedDouble size={14} /> Shift to ward
          </button>
        )}
      </div>
      {error && <div className="w-full"><ErrorLine text={error} /></div>}
    </div>
  );

  const twoCol = stage === "ENDED";
  const summaryCard = (
    <div className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden ${twoCol ? "lg:sticky lg:flex lg:flex-col" : ""}`}
      style={twoCol ? { top: pinH + 8, maxHeight: `calc(100dvh - var(--rf-header-h, 56px) - ${pinH + 24}px)` } : undefined}>
      <button onClick={() => setShowSummary((v) => !v)} className="w-full flex items-center justify-between gap-2 px-4 py-2 text-left hover:bg-[var(--color-surface-sunken)]/60 shrink-0">
        <span className="text-sm font-bold text-[var(--color-ink-900)]">Patient Long Summary</span>
        {showSummary ? <ChevronUp size={16} className="text-[var(--color-ink-400)]" /> : <ChevronDown size={16} className="text-[var(--color-ink-400)]" />}
      </button>
      {showSummary && <div className={`px-4 pb-3 overflow-y-auto ${twoCol ? "max-h-[380px] lg:max-h-none lg:flex-1 lg:min-h-0" : ""}`}><LongSummary visitId={d.visitId} complaint={d.complaint} diagnoses={d.diagnoses} /></div>}
    </div>
  );

  // Verify & next: verify this form, then open the next one still to verify
  const nextToVerify = (after: string) => {
    const i = items.findIndex((x) => x.key === after);
    const rest = [...items.slice(i + 1), ...items.slice(0, i)];
    return rest.find((x) => !oc.verified[x.key])?.key ?? after;
  };
  const tabBtn = (key: string, title: string, done: boolean) => {
    const on = sel?.key === key;
    return (
      <button key={key} type="button" role="tab" aria-selected={on} data-tab={key} onClick={() => setPicked(key)}
        style={on ? undefined : { borderColor: "transparent" }}
        className={`shrink-0 inline-flex items-center gap-1.5 h-9 pl-2.5 pr-3 rounded-t-xl border border-b-0 text-xs font-semibold whitespace-nowrap transition-colors ${
          on ? "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-ink-900)] shadow-[0_-1px_4px_rgba(15,23,42,0.05)]"
            : "bg-transparent text-[var(--color-ink-500)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink-700)]"}`}>
        {done ? <ShieldCheck size={13} className="shrink-0 text-[var(--color-primary-600)]" /> : <Circle size={13} className="shrink-0 text-[var(--color-ink-300)]" />}
        {title}
      </button>
    );
  };

  return (
    <div className="fade-in pb-24">
      {topBar}
      {/* Patient header and the next action stay pinned while the page scrolls */}
      <div ref={pinRef} className="sticky top-0 z-30 bg-[var(--color-bg)] pt-1 -mt-1">
        {header}
        {actionBar}
      </div>

      {/* While verifying: only the forms (Today's Long Summary is the first one). After Confirm: the summary; after End: summary | decisions side by side */}
      {stage === "ENDED" ? (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 items-start">
          {summaryCard}
          <Decisions d={d} oc={oc} draft={draft} can={can} steps={steps} outcome={outcome}
            onRefresh={refresh}
            onDischarge={() => setDialog("dischargeAsk")} />
        </div>
      ) : !verifying ? summaryCard : (
        <div>
          <div ref={tabsRef} role="tablist" aria-label="Forms to verify" className="flex items-end gap-1 overflow-x-auto px-1 -mb-px relative z-[1] [scrollbar-width:thin]">
            {items.map((i) => tabBtn(i.key, i.title, !!oc.verified[i.key]))}
          </div>
          <section className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 sm:p-4 min-w-0 space-y-3 ${sel?.key === items[0]?.key ? "rounded-tl-none" : ""}`}>
            {sel && (
              <>
                <div className="sticky z-20 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3 py-1.5" style={{ top: pinH + 4 }}>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-500)]">Verify in OT · <span className="tabular-nums">{verifiedCount}/{required.length}</span></span>
                  {oc.verified[sel.key] ? (
                    <span className="inline-flex items-center gap-2 text-caption font-semibold text-[var(--color-ink-600)]">
                      <span className="inline-flex items-center gap-1.5"><Lock size={12} /> Verified by {oc.verified[sel.key].by} · {fmtFull(oc.verified[sel.key].at)}</span>
                      {verifiedCount < required.length && (
                        <button type="button" onClick={() => setPicked(nextToVerify(sel.key))} className={btnGhost}>Next form</button>
                      )}
                    </span>
                  ) : can.verify && !oc.confirmedAt ? (
                    <button disabled={pending} onClick={() => run(() => verifyOtForm(d.id, sel.key), undefined, () => setPicked(nextToVerify(sel.key)))} className={btnPrimary}>
                      {pending ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />} {verifiedCount + 1 < required.length ? "Verify & next" : "Verify & freeze"}
                    </button>
                  ) : <span className="text-caption font-semibold text-[var(--color-ink-400)]">Not verified</span>}
                </div>
                <FormPanel key={sel.key} d={d} keyName={sel.key} title={sel.title} display={sel.display} row={rowOf(sel.key)} can={READ_ONLY} onRefresh={refresh} />
              </>
            )}
          </section>
        </div>
      )}

      {dialog === "confirm" && (
        <ConfirmDialog title="Everything confirmed and verified?"
          message="Has everything been confirmed and verified once again? Begin operation appears only after this."
          confirmLabel="Yes, confirmed" onConfirm={() => run(() => confirmOtVerified(d.id))} onCancel={() => setDialog(null)} />
      )}
      {dialog === "begin" && (
        <ConfirmDialog title="Begin operation?" message={`${surgeryLine}${hasImplant ? ` + ${d.implant}` : ""} for ${d.patient.name}. The time is recorded now.`}
          confirmLabel="Begin operation" onConfirm={() => run(() => beginOperation(d.id))} onCancel={() => setDialog(null)} />
      )}
      {dialog === "anaesthesia" && (
        <ConfirmDialog title="Anaesthesia administered?" message="The time is recorded now."
          confirmLabel="Anaesthesia administered" onConfirm={() => run(() => anaesthesiaAdministered(d.id), () => setDialog("anaesthesiaReason"))} onCancel={() => setDialog(null)} />
      )}
      {dialog === "anaesthesiaReason" && (
        <ReasonDialog title="Reason for the delay" storeKey="ot_anaesthesia_delay" keywords={ANAESTHESIA_DELAY_KEYWORDS}
          message={`More than ${ANAESTHESIA_DELAY_MIN} minutes passed between Begin operation and Anaesthesia administered.`}
          confirmLabel="Anaesthesia administered" pending={pending} error={error}
          onConfirm={(r) => run(() => anaesthesiaAdministered(d.id, r))} onClose={() => setDialog(null)} />
      )}
      {dialog === "end" && (
        <ConfirmDialog title="End operation?" message="The time is recorded now. Then record the status, and complete the notes now or later."
          confirmLabel="End operation" onConfirm={() => run(() => endOperation(d.id))} onCancel={() => setDialog(null)} />
      )}
      {dialog === "abort" && <AbortDialog d={d} steps={steps} pending={pending} error={error} onClose={() => setDialog(null)} onAbort={(reason, step) => run(() => abortOperation(d.id, reason, step))} />}
      {dialog === "shift" && (
        <ConfirmDialog title="Shift to ward?" message="The file goes back to IPD (post-op ward). Only the OT notes stay in this module; they can be edited until the end of today."
          confirmLabel="Shift to ward" onConfirm={() => run(() => shiftToWard(d.id), () => setDialog("shiftReason"))} onCancel={() => setDialog(null)} />
      )}
      {dialog === "shiftReason" && (
        <ReasonDialog title="Reason for the delay" storeKey="ot_shift_delay" keywords={SHIFT_DELAY_KEYWORDS}
          message={`More than ${SHIFT_DELAY_MIN} minutes passed between End operation and Shift to ward.`}
          confirmLabel="Shift to ward" pending={pending} error={error}
          onConfirm={(r) => run(() => shiftToWard(d.id, r))} onClose={() => setDialog(null)} />
      )}
      {dialog === "dischargeAsk" && (
        <ConfirmDialog title="Discharge the patient now?"
          message="Confirm once again. The discharge summary opens for a final review and is signed with an OTP; the patient is discharged and the file goes to the Patient Library."
          confirmLabel="Yes, discharge" onConfirm={() => setDialog("discharge")} onCancel={() => setDialog(null)} />
      )}
      {dialog === "discharge" && <DischargeFromOt d={d} onClose={() => setDialog(null)} onDone={(udid) => router.push(`/patients/${udid}`)} />}
    </div>
  );
}

/* ── Abort ─────────────────────────────────────────────────────────────── */

function AbortDialog({ d, steps, pending, error, onClose, onAbort }: {
  d: FileData; steps: string[]; pending: boolean; error: string; onClose: () => void; onAbort: (reason: string, step: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [step, setStep] = useState("");
  const [sure, setSure] = useState(false);
  return (
    <Modal title="Abort operation" onClose={onClose} wide>
      <p className="text-sm text-[var(--color-ink-600)] mb-3">The time of abortion is recorded now. The OT notes will say the operation was aborted, with the time and the step, and the file goes back to IPD.</p>
      <div className="space-y-3">
        <KeywordBox label="Reason" value={reason} onChange={setReason} keywords={ABORT_REASON_KEYWORDS} storeKey="ot_abort_reason" rows={2} />
        <KeywordBox label="At what step" value={step} onChange={setStep} keywords={steps} storeKey={`ot_steps_${(d.surgery ?? "").toLowerCase().slice(0, 30)}`} single inline placeholder="e.g. Capsulorhexis" />
      </div>
      <div className="mt-4 space-y-3">
        <ErrorLine text={error} />
        {sure ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-red-800">Abort the operation now? This can&apos;t be undone.</span>
            <div className="flex gap-2">
              <button onClick={() => setSure(false)} className={btnGhost}>Back</button>
              <button disabled={pending} onClick={() => onAbort(reason, step)} className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"><OctagonX size={14} /> Abort now</button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className={btnGhost}>Cancel</button>
            <button disabled={!reason.trim() || !step.trim()} onClick={() => setSure(true)} className={btnDanger}><OctagonX size={14} /> Abort operation</button>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ── After End operation ───────────────────────────────────────────────── */

function NowLater({ value, onPick, disabled }: { value: string | null; onPick: (v: "NOW" | "LATER") => void; disabled?: boolean }) {
  const b = (v: "NOW" | "LATER", label: string) => (
    <button type="button" disabled={disabled} onClick={() => onPick(v)}
      className={`px-3 py-1 rounded-md border text-xs font-semibold transition-colors disabled:opacity-60 ${value === v ? "bg-[var(--color-primary-600)] border-[var(--color-primary-600)] text-white" : "border-[var(--color-border)] text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]"}`}>{label}</button>
  );
  return <div className="flex gap-2">{b("NOW", "Now")}{b("LATER", "Later")}</div>;
}

function Decisions({ d, oc, draft, can, steps, outcome, onRefresh, onDischarge }: {
  d: FileData; oc: OtCaseData; draft: OtNotesData; can: OtCan; steps: string[]; outcome: OtOutcome;
  onRefresh: () => void; onDischarge: () => void;
}) {
  const [o, setO] = useState<OtOutcome>(outcome);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const canDecide = can.operate || can.notes;
  const statusSaved = !!oc.outcomeSavedAt;
  const changed = JSON.stringify(o) !== JSON.stringify(outcome);

  const choose = (kind: "otNotesChoice" | "wardNotesChoice", v: "NOW" | "LATER") => start(async () => {
    const r = await saveOtOutcome(d.id, { ...outcome, [kind]: v });
    if (r.error) setError(r.error); else { setError(""); setPickedStep(null); onRefresh(); }
  });

  const notesDone = oc.otNotesChoice === "NOW" && !!oc.otNotes;
  const wardDone = oc.wardNotesChoice === "NOW" && oc.dischargeSavedInOt;
  const allNow = notesDone && wardDone;
  const s1 = statusSaved && !changed;

  // Steps in a row; only the current one is open. Saving moves on to the next.
  const STEPS = [
    { n: 1, label: "Status", open: true, done: s1 },
    { n: 2, label: "OT notes", open: s1, done: notesDone || oc.otNotesChoice === "LATER" },
    { n: 3, label: "Post-op & discharge", open: s1, done: wardDone || oc.wardNotesChoice === "LATER" },
    { n: 4, label: "Discharge?", open: allNow, done: false },
  ];
  const current = STEPS.find((x) => x.open && !x.done)?.n ?? [...STEPS].reverse().find((x) => x.open)?.n ?? 1;
  const [pickedStep, setPickedStep] = useState<number | null>(null);
  const step = pickedStep && STEPS[pickedStep - 1].open ? pickedStep : current;
  const advance = () => { setPickedStep(null); onRefresh(); };

  const title = ["Status of the operation", "Complete OT notes now or later?", "Complete post-op notes and / or discharge summary now or later?", "Can the patient be discharged now?"][step - 1];

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] min-w-0">
      <ol className="flex flex-wrap items-center gap-1 px-2 py-2 border-b border-[var(--color-border)]">
        {STEPS.map((x) => {
          const on = x.n === step;
          return (
            <li key={x.n}>
              <button type="button" disabled={!x.open} onClick={() => setPickedStep(x.n)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${on ? "bg-[var(--color-primary-50)] text-[var(--color-primary-800)] ring-1 ring-[var(--color-primary-200)]" : "text-[var(--color-ink-600)] enabled:hover:bg-[var(--color-surface-sunken)]"}`}>
                <span className={`w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center ${x.done ? "bg-[var(--color-primary-600)] text-white" : "border border-[var(--color-ink-300)] text-[var(--color-ink-500)]"}`}>{x.done ? <CheckCircle2 size={10} /> : x.n}</span>
                {x.label}
              </button>
            </li>
          );
        })}
      </ol>
      <div className="px-4 py-3">
        <h2 className="text-sm font-semibold text-[var(--color-ink-900)] mb-2.5">{title}</h2>

        {step === 1 && (
          <>
            <Seg options={[{ value: "UNEVENTFUL", label: "Uneventful" }, { value: "EVENTFUL", label: "Eventful" }]}
              value={o.eventful ? "EVENTFUL" : "UNEVENTFUL"} disabled={!canDecide}
              tone={(v) => (v === "EVENTFUL" ? "bg-amber-600 text-white" : "bg-[var(--color-primary-600)] text-white")}
              onChange={(v) => setO({ ...o, eventful: v === "EVENTFUL" })} />
            {o.eventful && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 mt-3">
                <KeywordBox label="Reason" value={o.reason} onChange={(x) => setO({ ...o, reason: x })} keywords={EVENT_REASON_KEYWORDS} storeKey="ot_event_reason" />
                <KeywordBox label="At what step" value={o.step} onChange={(x) => setO({ ...o, step: x })} keywords={steps} storeKey={`ot_steps_${(d.surgery ?? "").toLowerCase().slice(0, 30)}`} single placeholder="e.g. Nucleus removal" />
                <KeywordBox label="Intra-op management" value={o.intraOp} onChange={(x) => setO({ ...o, intraOp: x })} keywords={INTRAOP_KEYWORDS} storeKey="ot_intraop" />
                <KeywordBox label="Post-op management" value={o.postOp} onChange={(x) => setO({ ...o, postOp: x })} keywords={POSTOP_KEYWORDS} storeKey="ot_postop" />
              </div>
            )}
            {canDecide && (!statusSaved || changed) && (
              <div className="mt-3 flex justify-end">
                <button disabled={pending} onClick={() => start(async () => {
                  const r = await saveOtOutcome(d.id, o);
                  if (r.error) setError(r.error); else { setError(""); advance(); }
                })} className={btnPrimary}>{pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save status</button>
              </div>
            )}
            {s1 && <p className="mt-2 text-caption text-[var(--color-ink-500)]">Saved · {eventText(outcome)}</p>}
          </>
        )}

        {step === 2 && (
          <>
            <NowLater value={oc.otNotesChoice} onPick={(v) => choose("otNotesChoice", v)} disabled={pending || !can.notes} />
            {oc.otNotesChoice === "LATER" && <LaterNote what="the OT notes (until the end of today, here in OT)" />}
            {oc.otNotesChoice === "NOW" && <div className="mt-3"><OtNotesPanel d={d} oc={oc} draft={draft} canEdit={can.notes} onSaved={advance} embedded /></div>}
          </>
        )}

        {step === 3 && (
          <>
            <NowLater value={oc.wardNotesChoice} onPick={(v) => choose("wardNotesChoice", v)} disabled={pending || !can.notes} />
            {oc.wardNotesChoice === "LATER" && <LaterNote what="the post-op notes and discharge summary from the IPD file" />}
            {oc.wardNotesChoice === "NOW" && <div className="mt-3"><WardNotes d={d} oc={oc} outcome={outcome} canEdit={can.notes} onSaved={advance} /></div>}
          </>
        )}

        {step === 4 && (
          <>
            {can.discharge && <button onClick={onDischarge} className={btnPrimary}><LogOut size={14} /> Yes, discharge</button>}
            <p className="mt-2 text-caption text-[var(--color-ink-500)]">If not, use <b>Shift to ward</b> at the top.</p>
            {!can.discharge && <p className="mt-2 text-caption text-[var(--color-ink-400)]">Discharging needs the IPD Discharge permission.</p>}
          </>
        )}

        <div className="mt-2"><ErrorLine text={error} /></div>
      </div>
    </section>
  );
}

function LaterNote({ what }: { what: string }) {
  return (
    <p className="mt-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-sunken)]/60 px-3 py-2 text-sm text-[var(--color-ink-700)]">
      Later: complete {what}. Next, use <b>Shift to ward</b> at the top.
    </p>
  );
}

/* ── OT notes (one copy in OT, one in the IPD file) ────────────────────── */

function OtNotesPanel({ d, oc, draft, canEdit, onSaved, embedded }: { d: FileData; oc: OtCaseData; draft: OtNotesData; canEdit: boolean; onSaved: () => void; embedded?: boolean }) {
  const initial: OtNotesCopy = oc.otNotes ?? buildOtNotesCopy(draft, {
    outcome: { eventful: oc.eventful, reason: oc.eventReason, step: oc.eventStep, intraOp: oc.intraOp, postOp: oc.postOp },
    times: { shiftedToOt: d.shiftedToOtAt, begun: oc.begunAt, anaesthesia: oc.anaesthesiaAt, ended: oc.endedAt, aborted: oc.abortedAt },
    abort: oc.abortedAt ? { at: oc.abortedAt, step: oc.abortStep ?? "", reason: oc.abortReason ?? "", by: oc.abortedBy ?? "" } : null,
  });
  const [value, setValue] = useState<OtNotesCopy>(initial);
  const [dirty, setDirty] = useState(!oc.otNotes);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const open = otNotesOpen(oc);
  const editable = canEdit && open;
  const save = () => start(async () => {
    const r = await saveOtNotes(d.id, value);
    if (r.error) setError(r.error); else { setError(""); setDirty(false); onSaved(); }
  });
  return (
    <div className={embedded ? "space-y-3" : "rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 sm:p-4 space-y-3"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {!embedded && <h2 className="text-sm font-bold text-[var(--color-ink-900)]">OT Notes</h2>}
        <span className="text-caption text-[var(--color-ink-500)]">
          {oc.otNotes ? `Saved by ${oc.otNotesSavedBy} · ${fmtFull(oc.otNotesSavedAt)}` : "Not saved yet"}
          {" · "}{open ? "editable until the end of today" : "locked (end of the day of surgery)"} · a copy is kept in the patient file
        </span>
        {oc.otNotes && (
          <button type="button" disabled={pending || dirty} title={dirty ? "Save the changes first" : "Print or save as PDF"}
            onClick={() => printInPlace(`/ipd-print/${d.id}/ot-notes`)} className={`${btnGhost} ml-auto`}>
            <Printer size={14} /> Print
          </button>
        )}
        {editable && (
          <button disabled={pending || !dirty} onClick={save} className={`${btnPrimary} ${oc.otNotes ? "" : "ml-auto"}`}>
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save OT notes
          </button>
        )}
      </div>
      <OtNotesView value={value} f={d} editable={editable} onChange={(v) => { setValue(v); setDirty(true); }} template={(d.defaults.otNotes as OtNotesData).steps} />
      <ErrorLine text={error} />
    </div>
  );
}

/* ── Post-op notes / discharge summary, completed from OT ──────────────── */

function WardNotes({ d, oc, outcome, canEdit, onSaved }: { d: FileData; oc: OtCaseData; outcome: OtOutcome; canEdit: boolean; onSaved: () => void }) {
  const [tab, setTab] = useState<"postOp" | "discharge">("postOp");
  const savedPostOp = d.forms.find((f) => f.key === "postOpNotes")?.data;
  const savedDischarge = d.forms.find((f) => f.key === "discharge")?.data;
  const events = eventText(outcome);

  // Import the eventful details and the surgery day into the drafts
  const [postOp, setPostOp] = useState<PostOpData>(() => {
    const base = isV2(savedPostOp) ? (savedPostOp as PostOpData) : defaultPostOp();
    if ((base.reviews ?? []).length || !oc.endedAt) return base;
    const date = istDay(oc.endedAt);
    return {
      ...base,
      reviews: [{
        id: uid(), date, pod: "POD 0", vaRe: "", vaLe: "", iopRe: "", iopLe: "",
        lids: "", conjunctiva: "", cornea: "", ac: "", pupil: "", lens: "", fundus: "",
        complaints: "", plan: [outcome.eventful && outcome.postOp ? `Post-op management: ${outcome.postOp}` : "", "Continue post-op treatment as charted"].filter(Boolean).join("\n"),
        by: d.me,
      }],
    };
  });
  const [discharge, setDischarge] = useState<DischargeData>(() => {
    const base = isDischargeData(savedDischarge) ? normalizeDischarge(savedDischarge, d.orders) : (d.defaults.discharge as DischargeData);
    if (oc.dischargeSavedInOt) return base;
    return {
      ...base,
      procedure: {
        ...base.procedure,
        name: base.procedure.name || d.surgery || "",
        eye: base.procedure.eye || d.laterality || "",
        implant: base.procedure.implant || d.implant || "",
        anaesthesia: base.procedure.anaesthesia || d.anaesthesia || "",
        date: oc.endedAt ? istDay(oc.endedAt) : base.procedure.date,
        events,
      },
    };
  });
  const [dirty, setDirty] = useState({ postOp: !isV2(savedPostOp), discharge: !oc.dischargeSavedInOt });
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const save = (key: "postOpNotes" | "discharge") => start(async () => {
    const r = await saveOtWardForm(d.id, key, key === "discharge" ? discharge : postOp);
    if (r.error) { setError(r.error); return; }
    setError("");
    setDirty((x) => ({ ...x, [key === "discharge" ? "discharge" : "postOp"]: false }));
    onSaved();
  });

  const tabBtn = (k: "postOp" | "discharge", label: string, saved: boolean) => (
    <button key={k} onClick={() => setTab(k)}
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold border transition-colors ${tab === k ? "bg-[var(--color-primary-600)] border-[var(--color-primary-600)] text-white" : "border-[var(--color-border)] text-[var(--color-ink-700)] hover:bg-[var(--color-primary-50)]"}`}>
      {saved && <CheckCircle2 size={14} />}{label}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {tabBtn("postOp", "Post-op notes", !dirty.postOp)}
        {tabBtn("discharge", "Discharge summary", oc.dischargeSavedInOt && !dirty.discharge)}
        {canEdit && (
          <button disabled={pending || !(tab === "postOp" ? dirty.postOp : dirty.discharge)} onClick={() => save(tab === "postOp" ? "postOpNotes" : "discharge")} className={`${btnPrimary} ml-auto`}>
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save {tab === "postOp" ? "post-op notes" : "discharge summary"}
          </button>
        )}
      </div>
      <p className="text-caption text-[var(--color-ink-400)]">Saved into the patient file. They stay editable in IPD until discharge.</p>
      {tab === "postOp" ? (
        <PostOpForm value={postOp} change={(v) => { setPostOp(v); setDirty((x) => ({ ...x, postOp: true })); }} saveNow={async () => undefined}
          editable={canEdit} canLog={false} addLog={async () => undefined} log={[]} f={d} />
      ) : (
        <div className="rounded-xl bg-[var(--color-surface-sunken)]/50 p-2">
          <DischargeEditor value={discharge} onChange={(v) => { setDischarge(v); setDirty((x) => ({ ...x, discharge: true })); }} editable={canEdit} ctx={dischargeCtx(d)} />
        </div>
      )}
      <ErrorLine text={error} />
    </div>
  );
}

/* ── Discharge now (summary signed with OTP) ───────────────────────────── */

function DischargeFromOt({ d, onClose, onDone }: { d: FileData; onClose: () => void; onDone: (udid: string) => void }) {
  const saved = d.forms.find((f) => f.key === "discharge")?.data;
  const [text, setText] = useState<DischargeData>(() => (isDischargeData(saved) ? normalizeDischarge(saved, d.orders) : (d.defaults.discharge as DischargeData)));
  const [notes, setNotes] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const sendOtp = () => start(async () => {
    setError("");
    const r = await requestOtDischargeOtp(d.id);
    if (r.error) setError(r.error); else setSentTo(r.email ?? "your email");
  });
  const sign = () => start(async () => {
    const r = await dischargeFromOt(d.id, code, text, notes);
    if (r.error) setError(r.error); else onDone(r.udid ?? d.udid);
  });
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
          {sentTo ? (
            <>
              <p className="text-caption text-[var(--color-ink-500)]">A 6-digit code was sent to {sentTo}. It expires in 5 minutes.</p>
              <div className="flex flex-wrap gap-2">
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
