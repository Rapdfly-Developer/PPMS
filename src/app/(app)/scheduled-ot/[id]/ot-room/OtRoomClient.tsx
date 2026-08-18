"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import Link from "next/link";
import {
  ArrowLeft, CheckCircle2, Clock, User, Building2, Scissors,
  ShieldCheck, ClipboardList, PlayCircle, Activity, CheckSquare,
  HeartPulse, Loader2, ChevronRight, AlertCircle, Pill, FileText,
  Eye, XCircle,
} from "lucide-react";
import {
  initOtRecord, saveCheckIn, saveOtPrep, startSurgery,
  saveIntraOp, completeSurgery, transferToRecovery,
} from "./actions";

/* ── Types ─────────────────────────────────────────────────────────────── */
interface Patient { name: string; uhid: string | null; udid: string; age: number; sex: string }
interface Hospital { name: string }

interface TimelineEntry {
  step: string; action: string; performedBy: string; performedAt: string;
}

interface ExistingRecord {
  id: string; status: string;
  checkInTime: string | null;
  identityVerified: boolean; correctEyeVerified: boolean;
  surgeryTypeVerified: boolean; consentFormsVerified: boolean;
  implantAvailabilityVerified: boolean;
  assistantSurgeon: string; anesthetist: string;
  scrubNurse: string; circulatingNurse: string;
  anesthesiaTypeRecorded: string; whoSignIn: string;
  surgeryStartTime: string | null;
  procedurePerformed: string; iolModel: string; iolPower: string;
  iolBatch: string; iolSerial: string; medicinesConsumed: string;
  intraopFindings: string; complications: string; intraopRemarks: string;
  surgeryEndTime: string | null; operativeNotes: string;
  patientConditionOnTransfer: string; transferTime: string | null;
  timeline: TimelineEntry[];
}

interface Props {
  scheduleId: string; surgeryName: string; surgeryCategory: string;
  counselling: null;
  patient: Patient; hospital: Hospital;
  otRoom: string | null; plannedDateTime: string;
  anesthetistName: string | null;
  existingRecord: ExistingRecord | null;
}

/* ── Step metadata ──────────────────────────────────────────────────────── */
const STEPS = [
  { id: "checkin",  label: "Patient Check-in",       icon: User          },
  { id: "prep",     label: "OT Preparation",          icon: ClipboardList },
  { id: "start",    label: "Surgery Start",           icon: PlayCircle    },
  { id: "intraop",  label: "Intra-Operative",         icon: Activity      },
  { id: "complete", label: "Surgery Completion",      icon: CheckSquare   },
  { id: "recovery", label: "Transfer to Recovery",    icon: HeartPulse    },
];

function statusToStep(status: string): number {
  switch (status) {
    case "CHECKIN":     return 0;
    case "PREP":        return 1;
    case "IN_PROGRESS": return 3;
    case "COMPLETED":   return 4;
    case "RECOVERY":    return 5;
    default:            return 0;
  }
}

/* ── WHO Sign-In checklist items ────────────────────────────────────────── */
const WHO_ITEMS = [
  { key: "identity",       label: "Patient has confirmed identity, site, procedure, and consent" },
  { key: "siteMarked",     label: "Site is marked / not applicable" },
  { key: "anaesthesia",    label: "Anaesthesia safety check completed" },
  { key: "pulseOx",        label: "Pulse oximeter on patient and functioning" },
  { key: "allergy",        label: "Known allergy? (checked and documented)" },
  { key: "airwayRisk",     label: "Difficult airway / aspiration risk? (assessed)" },
  { key: "bloodLossRisk",  label: "Risk of >500 ml blood loss assessed and planned" },
] as const;

const SEX_SHORT: Record<string, string> = { MALE: "M", FEMALE: "F", OTHER: "O" };

/* ── Small helpers ──────────────────────────────────────────────────────── */
function Field({
  label, value, onChange, multiline = false, placeholder = "",
  disabled = false,
}: {
  label: string; value: string; onChange: (v: string) => void;
  multiline?: boolean; placeholder?: string; disabled?: boolean;
}) {
  const base =
    "w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] disabled:bg-[var(--color-surface-sunken)] disabled:text-[var(--color-ink-400)]";
  return (
    <div>
      <label className="block text-xs font-semibold text-[var(--color-ink-600)] mb-1">{label}</label>
      {multiline ? (
        <textarea
          value={value} onChange={(e) => onChange(e.target.value)}
          rows={3} placeholder={placeholder} disabled={disabled}
          className={`${base} resize-none`}
        />
      ) : (
        <input
          type="text" value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} disabled={disabled}
          className={base}
        />
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-ink-400)] mb-3">
      {children}
    </p>
  );
}

function CheckRow({
  label, checked, onChange, disabled = false,
}: {
  label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
      checked
        ? "border-emerald-300 bg-emerald-50"
        : "border-[var(--color-border)] hover:bg-[var(--color-surface-sunken)]"
    } ${disabled ? "opacity-60 cursor-default" : ""}`}>
      <input
        type="checkbox" checked={checked} disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 accent-emerald-600 shrink-0"
      />
      <span className={`text-sm ${checked ? "text-emerald-800 font-medium" : "text-[var(--color-ink-700)]"}`}>
        {label}
      </span>
    </label>
  );
}

function ErrMsg({ msg }: { msg: string }) {
  return msg ? (
    <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
      <AlertCircle size={13} /> {msg}
    </div>
  ) : null;
}

function SaveBtn({ pending, label, disabled = false }: { pending: boolean; label: string; disabled?: boolean }) {
  return (
    <button
      type="submit" disabled={pending || disabled}
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary-600)] text-white text-sm font-semibold hover:bg-[var(--color-primary-700)] disabled:opacity-50 transition-colors"
    >
      {pending ? <Loader2 size={15} className="animate-spin" /> : <ChevronRight size={15} />}
      {pending ? "Saving…" : label}
    </button>
  );
}

/* ── Step 1 — Patient Check-in ──────────────────────────────────────────── */
function StepCheckIn({
  rec, patient, surgeryName, done, onDone,
}: {
  rec: ExistingRecord | null;
  patient: Patient; surgeryName: string;
  done: boolean;
  onDone: () => void;
}) {
  const [identity,  setIdentity]  = useState(rec?.identityVerified            ?? false);
  const [eye,       setEye]       = useState(rec?.correctEyeVerified           ?? false);
  const [surgType,  setSurgType]  = useState(rec?.surgeryTypeVerified          ?? false);
  const [consent,   setConsent]   = useState(rec?.consentFormsVerified         ?? false);
  const [implant,   setImplant]   = useState(rec?.implantAvailabilityVerified  ?? false);
  const [err, setErr]             = useState("");
  const [pending, start]          = useTransition();

  const allChecked = identity && eye && surgType && consent && implant;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allChecked) { setErr("Please verify all 5 items before proceeding."); return; }
    start(async () => {
      let otId = rec?.id ?? "";
      if (!otId) {
        const init = await initOtRecord((document.getElementById("scheduleId") as HTMLInputElement).value);
        if (init.error) { setErr(init.error); return; }
        otId = init.id;
      }
      const res = await saveCheckIn(otId, {
        identityVerified: identity, correctEyeVerified: eye,
        surgeryTypeVerified: surgType, consentFormsVerified: consent,
        implantAvailabilityVerified: implant,
      });
      if (res.error) setErr(res.error);
      else onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <SectionTitle>Verify before admitting patient to OT</SectionTitle>
      <div className="space-y-2">
        <CheckRow label={`Patient identity: ${patient.name}, ${patient.age}y/${SEX_SHORT[patient.sex] ?? patient.sex}${patient.uhid ? `, UHID: ${patient.uhid}` : ""}`}
          checked={identity} onChange={setIdentity} disabled={done} />
        <CheckRow label="Correct eye confirmed (RE / LE / OU)"
          checked={eye} onChange={setEye} disabled={done} />
        <CheckRow label={`Surgery type confirmed: ${surgeryName}`}
          checked={surgType} onChange={setSurgType} disabled={done} />
        <CheckRow label="Consent forms reviewed and signed"
          checked={consent} onChange={setConsent} disabled={done} />
        <CheckRow label="Implant / IOL availability verified"
          checked={implant} onChange={setImplant} disabled={done} />
      </div>
      {!done && (
        <>
          <ErrMsg msg={err} />
          <SaveBtn pending={pending} label="Confirm Check-in → Proceed to OT Prep" disabled={!allChecked} />
        </>
      )}
      {done && rec?.checkInTime && (
        <p className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
          <CheckCircle2 size={13} /> Check-in completed at {format(new Date(rec.checkInTime), "h:mm a, d MMM yyyy")}
        </p>
      )}
    </form>
  );
}

/* ── Step 2 — OT Preparation ────────────────────────────────────────────── */
function StepOtPrep({
  rec, defaultAnesthetist, done, onDone,
}: {
  rec: ExistingRecord | null;
  defaultAnesthetist: string | null;
  done: boolean; onDone: () => void;
}) {
  const [assistant,    setAssistant]    = useState(rec?.assistantSurgeon        ?? "");
  const [anesthetist,  setAnesthetist]  = useState(rec?.anesthetist             ?? defaultAnesthetist ?? "");
  const [scrub,        setScrub]        = useState(rec?.scrubNurse              ?? "");
  const [circulating,  setCirculating]  = useState(rec?.circulatingNurse        ?? "");
  const [anesthesia,   setAnesthesia]   = useState(rec?.anesthesiaTypeRecorded  ?? "");
  const [who, setWho] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(rec?.whoSignIn ?? "{}"); } catch { return {}; }
  });
  const [err, setErr]   = useState("");
  const [pending, start] = useTransition();

  const whoAllChecked = WHO_ITEMS.every((item) => !!who[item.key]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!whoAllChecked) { setErr("Complete the entire WHO Sign-In checklist before proceeding."); return; }
    start(async () => {
      const res = await saveOtPrep(rec!.id, {
        assistantSurgeon: assistant, anesthetist, scrubNurse: scrub,
        circulatingNurse: circulating, anesthesiaTypeRecorded: anesthesia,
        whoSignIn: JSON.stringify(who),
      });
      if (res.error) setErr(res.error);
      else onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <SectionTitle>OT Team</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Assistant Surgeon" value={assistant} onChange={setAssistant} placeholder="Dr. Name" disabled={done} />
          <Field label="Anesthetist" value={anesthetist} onChange={setAnesthetist} placeholder="Dr. Name" disabled={done} />
          <Field label="Scrub Nurse" value={scrub} onChange={setScrub} placeholder="Nurse name" disabled={done} />
          <Field label="Circulating Nurse" value={circulating} onChange={setCirculating} placeholder="Nurse name" disabled={done} />
          <Field label="Anaesthesia Type" value={anesthesia} onChange={setAnesthesia} placeholder="e.g. Topical, Peribulbar, GA" disabled={done} />
        </div>
      </div>

      <div>
        <SectionTitle>WHO Surgical Safety Checklist — Sign In</SectionTitle>
        <div className="space-y-2">
          {WHO_ITEMS.map((item) => (
            <CheckRow
              key={item.key}
              label={item.label}
              checked={!!who[item.key]}
              onChange={(v) => setWho((prev) => ({ ...prev, [item.key]: v }))}
              disabled={done}
            />
          ))}
        </div>
      </div>

      {!done && (
        <>
          <ErrMsg msg={err} />
          <SaveBtn pending={pending} label="Complete Preparation → Proceed to Surgery Start" disabled={!whoAllChecked} />
        </>
      )}
      {done && (
        <p className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
          <CheckCircle2 size={13} /> OT preparation and WHO Sign-In completed.
        </p>
      )}
    </form>
  );
}

/* ── Step 3 — Surgery Start ──────────────────────────────────────────────── */
function StepSurgeryStart({
  rec, scheduleId, done, onDone,
}: {
  rec: ExistingRecord | null; scheduleId: string;
  done: boolean; onDone: () => void;
}) {
  const [err, setErr]   = useState("");
  const [pending, start] = useTransition();

  async function handleStart() {
    start(async () => {
      const res = await startSurgery(rec!.id, scheduleId);
      if (res.error) setErr(res.error);
      else onDone();
    });
  }

  return (
    <div className="space-y-5">
      {done && rec?.surgeryStartTime ? (
        <div className="flex flex-col items-center gap-3 py-8">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
            <PlayCircle size={32} className="text-emerald-600" />
          </div>
          <p className="text-lg font-bold text-[var(--color-ink-900)]">Surgery In Progress</p>
          <p className="text-sm text-[var(--color-ink-500)] flex items-center gap-1.5">
            <Clock size={13} /> Started at {format(new Date(rec.surgeryStartTime), "h:mm a, d MMM yyyy")}
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-5 py-8">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
            <PlayCircle size={32} className="text-amber-600" />
          </div>
          <div className="text-center">
            <p className="text-base font-bold text-[var(--color-ink-900)] mb-1">Ready to begin?</p>
            <p className="text-sm text-[var(--color-ink-500)]">Click to record surgery start time and mark patient as In OT.</p>
          </div>
          <ErrMsg msg={err} />
          <button
            onClick={handleStart} disabled={pending}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-emerald-600 text-white text-base font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {pending ? <Loader2 size={18} className="animate-spin" /> : <PlayCircle size={18} />}
            {pending ? "Recording…" : "Start Surgery"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Step 4 — Intra-Operative Recording ─────────────────────────────────── */
function StepIntraOp({
  rec, done, onDone,
}: {
  rec: ExistingRecord | null; done: boolean; onDone: () => void;
}) {
  const [procedure,  setProcedure]  = useState(rec?.procedurePerformed ?? "");
  const [iolModel,   setIolModel]   = useState(rec?.iolModel            ?? "");
  const [iolPower,   setIolPower]   = useState(rec?.iolPower            ?? "");
  const [iolBatch,   setIolBatch]   = useState(rec?.iolBatch            ?? "");
  const [iolSerial,  setIolSerial]  = useState(rec?.iolSerial           ?? "");
  const [medicines,  setMedicines]  = useState(rec?.medicinesConsumed   ?? "");
  const [findings,   setFindings]   = useState(rec?.intraopFindings     ?? "");
  const [complications, setComplications] = useState(rec?.complications  ?? "");
  const [remarks,    setRemarks]    = useState(rec?.intraopRemarks       ?? "");
  const [err, setErr]   = useState("");
  const [pending, start] = useTransition();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await saveIntraOp(rec!.id, {
        procedurePerformed: procedure, iolModel, iolPower, iolBatch, iolSerial,
        medicinesConsumed: medicines, intraopFindings: findings,
        complications, intraopRemarks: remarks,
      });
      if (res.error) setErr(res.error);
      else onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <SectionTitle>Procedure</SectionTitle>
        <Field
          label="Procedure Performed"
          value={procedure} onChange={setProcedure}
          multiline placeholder="Describe the procedure performed…" disabled={done}
        />
      </div>

      <div>
        <SectionTitle>Implant / IOL Details</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="IOL Model"  value={iolModel}  onChange={setIolModel}  placeholder="e.g. SN60WF"  disabled={done} />
          <Field label="IOL Power"  value={iolPower}  onChange={setIolPower}  placeholder="e.g. +20.0 D" disabled={done} />
          <Field label="Batch No."  value={iolBatch}  onChange={setIolBatch}  placeholder="Batch"        disabled={done} />
          <Field label="Serial No." value={iolSerial} onChange={setIolSerial} placeholder="Serial"       disabled={done} />
        </div>
      </div>

      <div>
        <SectionTitle>Medicines & Consumables Used</SectionTitle>
        <Field
          label="Medicines and Consumables"
          value={medicines} onChange={setMedicines}
          multiline placeholder="List drugs and consumables used during surgery…" disabled={done}
        />
      </div>

      <div>
        <SectionTitle>Findings & Complications</SectionTitle>
        <div className="space-y-3">
          <Field
            label="Intra-operative Findings"
            value={findings} onChange={setFindings}
            multiline placeholder="e.g. Dense cataract, IFIS, posterior polar…" disabled={done}
          />
          <Field
            label="Complications (if any)"
            value={complications} onChange={setComplications}
            multiline placeholder="e.g. Posterior capsule rent, vitreous loss — write None if no complications" disabled={done}
          />
          <Field
            label="Additional Remarks"
            value={remarks} onChange={setRemarks}
            multiline placeholder="Any additional intra-operative remarks…" disabled={done}
          />
        </div>
      </div>

      {!done && (
        <>
          <ErrMsg msg={err} />
          <SaveBtn pending={pending} label="Save Intra-operative Data → Proceed to Completion" />
        </>
      )}
      {done && (
        <p className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
          <CheckCircle2 size={13} /> Intra-operative data saved.
        </p>
      )}
    </form>
  );
}

/* ── Step 5 — Surgery Completion ─────────────────────────────────────────── */
function StepCompletion({
  rec, scheduleId, done, onDone,
}: {
  rec: ExistingRecord | null; scheduleId: string;
  done: boolean; onDone: () => void;
}) {
  const [notes, setNotes]   = useState(rec?.operativeNotes ?? "");
  const [err, setErr]       = useState("");
  const [pending, start]    = useTransition();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await completeSurgery(rec!.id, scheduleId, notes);
      if (res.error) setErr(res.error);
      else onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <SectionTitle>Operative Notes</SectionTitle>
      <Field
        label="Operative Notes"
        value={notes} onChange={setNotes}
        multiline placeholder="Summarise the procedure, key steps, and outcomes…"
        disabled={done}
      />
      {!done && (
        <>
          <ErrMsg msg={err} />
          <button
            type="submit" disabled={pending}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {pending ? <Loader2 size={15} className="animate-spin" /> : <CheckSquare size={15} />}
            {pending ? "Completing…" : "Mark Surgery as Completed"}
          </button>
        </>
      )}
      {done && rec?.surgeryEndTime && (
        <p className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
          <CheckCircle2 size={13} /> Surgery completed at {format(new Date(rec.surgeryEndTime), "h:mm a, d MMM yyyy")}
        </p>
      )}
    </form>
  );
}

/* ── Step 6 — Transfer to Recovery ──────────────────────────────────────── */
function StepRecovery({
  rec, done, onDone,
}: {
  rec: ExistingRecord | null; done: boolean; onDone: () => void;
}) {
  const [condition, setCondition] = useState(rec?.patientConditionOnTransfer ?? "");
  const [err, setErr]             = useState("");
  const [pending, start]          = useTransition();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!condition.trim()) { setErr("Please record patient condition before transfer."); return; }
    start(async () => {
      const res = await transferToRecovery(rec!.id, condition);
      if (res.error) setErr(res.error);
      else onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <SectionTitle>Patient Condition on Transfer</SectionTitle>
      <Field
        label="Patient Condition"
        value={condition} onChange={setCondition}
        multiline
        placeholder="e.g. Stable, conscious, comfortable — vitals normal. Patch applied."
        disabled={done}
      />
      {!done && (
        <>
          <ErrMsg msg={err} />
          <button
            type="submit" disabled={pending}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary-600)] text-white text-sm font-bold hover:bg-[var(--color-primary-700)] disabled:opacity-50 transition-colors"
          >
            {pending ? <Loader2 size={15} className="animate-spin" /> : <HeartPulse size={15} />}
            {pending ? "Transferring…" : "Transfer to Recovery Room"}
          </button>
        </>
      )}
      {done && rec?.transferTime && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
            <CheckCircle2 size={13} /> Transferred to recovery at {format(new Date(rec.transferTime), "h:mm a, d MMM yyyy")}
          </p>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-center space-y-2">
            <CheckCircle2 size={32} className="text-emerald-600 mx-auto" />
            <p className="text-base font-bold text-emerald-800">OT Workflow Complete</p>
            <p className="text-sm text-emerald-700">Surgery record, operative notes, and audit timeline have been saved.</p>
            <Link href="/scheduled-ot"
              className="inline-flex items-center gap-1.5 mt-2 text-sm font-semibold text-[var(--color-primary-700)] hover:underline">
              <ArrowLeft size={14} /> Back to Scheduled OT
            </Link>
          </div>
        </div>
      )}
    </form>
  );
}

/* ── Timeline sidebar ───────────────────────────────────────────────────── */
function TimelineSidebar({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-white p-4">
      <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-ink-400)] mb-4 flex items-center gap-1.5">
        <Clock size={11} /> Surgery Timeline
      </p>
      <ol className="relative border-l border-[var(--color-border)] ml-1.5 space-y-4">
        {entries.map((entry, i) => (
          <li key={i} className="pl-4">
            <div className="absolute -left-1.5 mt-1 w-3 h-3 rounded-full bg-[var(--color-primary-400)] border-2 border-white" />
            <p className="text-[11px] text-[var(--color-ink-400)]">
              {format(new Date(entry.performedAt), "h:mm a, d MMM")}
            </p>
            <p className="text-xs font-medium text-[var(--color-ink-800)]">{entry.action}</p>
            <p className="text-[10px] text-[var(--color-ink-400)]">by {entry.performedBy}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */
export function OtRoomClient({
  scheduleId, surgeryName, surgeryCategory,
  counselling, patient, hospital, otRoom, plannedDateTime,
  anesthetistName, existingRecord,
}: Props) {
  const initialStep = existingRecord ? statusToStep(existingRecord.status) : 0;
  const [activeStep, setActiveStep] = useState(initialStep);
  const [rec, setRec]               = useState<ExistingRecord | null>(existingRecord);
  const [timeline, setTimeline]     = useState<TimelineEntry[]>(existingRecord?.timeline ?? []);
  const [pending, start]            = useTransition();

  // Called when a step is completed to advance
  function advance() {
    setActiveStep((s) => Math.min(s + 1, STEPS.length - 1));
    // Refresh timeline from server (handled by revalidatePath) — trigger re-fetch
    window.location.reload();
  }

  function stepDone(idx: number): boolean {
    if (!rec) return false;
    switch (idx) {
      case 0: return !!rec.checkInTime;
      case 1: return !!rec.whoSignIn && rec.whoSignIn !== "{}";
      case 2: return !!rec.surgeryStartTime;
      case 3: return !!rec.procedurePerformed;
      case 4: return !!rec.surgeryEndTime;
      case 5: return !!rec.transferTime;
      default: return false;
    }
  }

  // Ensure OtRecord exists on first render for step 0
  async function ensureRecord() {
    if (rec) return;
    start(async () => {
      const init = await initOtRecord(scheduleId);
      if (!init.error && init.id) {
        setRec({
          id: init.id, status: "CHECKIN",
          checkInTime: null,
          identityVerified: false, correctEyeVerified: false,
          surgeryTypeVerified: false, consentFormsVerified: false,
          implantAvailabilityVerified: false,
          assistantSurgeon: "", anesthetist: anesthetistName ?? "",
          scrubNurse: "", circulatingNurse: "",
          anesthesiaTypeRecorded: "", whoSignIn: "{}",
          surgeryStartTime: null,
          procedurePerformed: "", iolModel: "", iolPower: "",
          iolBatch: "", iolSerial: "", medicinesConsumed: "",
          intraopFindings: "", complications: "", intraopRemarks: "",
          surgeryEndTime: null, operativeNotes: "",
          patientConditionOnTransfer: "", transferTime: null,
          timeline: [],
        });
      }
    });
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Hidden field for scheduleId (used by step 1 initOtRecord) */}
      <input type="hidden" id="scheduleId" value={scheduleId} />

      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/scheduled-ot"
          className="mt-0.5 p-1.5 rounded-lg hover:bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)] transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 uppercase tracking-wide">
              OT Room
            </span>
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]">
              {surgeryCategory}
            </span>
          </div>
          <h1 className="text-xl font-bold text-[var(--color-ink-900)] leading-tight">{surgeryName}</h1>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-[var(--color-ink-500)]">
            <span className="flex items-center gap-1"><User size={11} /> {patient.name}, {patient.age}y</span>
            {patient.uhid && <span className="font-mono text-teal-700">{patient.uhid}</span>}
            <span className="flex items-center gap-1"><Building2 size={11} /> {hospital.name}</span>
            {otRoom && <span className="flex items-center gap-1"><Scissors size={11} /> {otRoom}</span>}
            <span className="flex items-center gap-1">
              <Clock size={11} /> {format(new Date(plannedDateTime), "h:mm a, d MMM yyyy")}
            </span>
          </div>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-0 overflow-x-auto pb-1">
        {STEPS.map((step, i) => {
          const isDone   = stepDone(i);
          const isActive = i === activeStep;
          const Icon     = step.icon;
          return (
            <div key={step.id} className="flex items-center shrink-0">
              <button
                onClick={() => { if (isDone || i <= activeStep) setActiveStep(i); }}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-center transition-all ${
                  isActive
                    ? "bg-[var(--color-primary-50)] border border-[var(--color-primary-200)]"
                    : isDone
                    ? "hover:bg-emerald-50 cursor-pointer"
                    : "opacity-50 cursor-default"
                }`}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                  isDone ? "bg-emerald-500 text-white" : isActive ? "bg-[var(--color-primary-600)] text-white" : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)]"
                }`}>
                  {isDone ? <CheckCircle2 size={14} /> : <Icon size={14} />}
                </div>
                <span className={`text-[9px] font-semibold leading-tight max-w-[70px] ${
                  isActive ? "text-[var(--color-primary-700)]" : isDone ? "text-emerald-700" : "text-[var(--color-ink-400)]"
                }`}>
                  {step.label}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`h-px w-4 shrink-0 ${isDone ? "bg-emerald-400" : "bg-[var(--color-border)]"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Main content + timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Step content */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-[var(--color-border)] bg-white p-5">
            <div className="flex items-center gap-2 mb-5 pb-4 border-b border-[var(--color-border)]">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                stepDone(activeStep)
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-[var(--color-primary-100)] text-[var(--color-primary-700)]"
              }`}>
                {(() => { const Icon = STEPS[activeStep].icon; return <Icon size={16} />; })()}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-400)]">Step {activeStep + 1} of {STEPS.length}</p>
                <h2 className="text-base font-bold text-[var(--color-ink-900)]">{STEPS[activeStep].label}</h2>
              </div>
            </div>

            {/* Render active step */}
            {activeStep === 0 && (
              <StepCheckIn
                rec={rec} patient={patient} surgeryName={surgeryName}
                done={stepDone(0)}
                onDone={() => { ensureRecord(); advance(); }}
              />
            )}
            {activeStep === 1 && (
              <StepOtPrep
                rec={rec} defaultAnesthetist={anesthetistName}
                done={stepDone(1)} onDone={advance}
              />
            )}
            {activeStep === 2 && (
              <StepSurgeryStart
                rec={rec} scheduleId={scheduleId}
                done={stepDone(2)} onDone={advance}
              />
            )}
            {activeStep === 3 && (
              <StepIntraOp
                rec={rec} done={stepDone(3)} onDone={advance}
              />
            )}
            {activeStep === 4 && (
              <StepCompletion
                rec={rec} scheduleId={scheduleId}
                done={stepDone(4)} onDone={advance}
              />
            )}
            {activeStep === 5 && (
              <StepRecovery
                rec={rec} done={stepDone(5)} onDone={advance}
              />
            )}

            {/* Navigation between completed steps */}
            {stepDone(activeStep) && activeStep < STEPS.length - 1 && (
              <div className="mt-5 pt-4 border-t border-[var(--color-border)]">
                <button
                  onClick={() => setActiveStep((s) => s + 1)}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-primary-700)] hover:underline"
                >
                  Continue to {STEPS[activeStep + 1].label} <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="lg:col-span-1 space-y-4">
          {/* Surgery summary card */}
          <div className="rounded-xl border border-[var(--color-border)] bg-white p-4 space-y-3 text-xs">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-ink-400)] flex items-center gap-1.5">
              <FileText size={11} /> Surgery Summary
            </p>
            {[
              { label: "Start Time", value: rec?.surgeryStartTime ? format(new Date(rec.surgeryStartTime), "h:mm a") : "—" },
              { label: "End Time",   value: rec?.surgeryEndTime   ? format(new Date(rec.surgeryEndTime),   "h:mm a") : "—" },
              {
                label: "Duration",
                value: rec?.surgeryStartTime && rec?.surgeryEndTime
                  ? `${Math.round((new Date(rec.surgeryEndTime).getTime() - new Date(rec.surgeryStartTime).getTime()) / 60000)} min`
                  : "—",
              },
              { label: "IOL Power",  value: rec?.iolPower       || "—" },
              { label: "IOL Model",  value: rec?.iolModel        || "—" },
              { label: "Anesthesia", value: rec?.anesthesiaTypeRecorded || "—" },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between gap-2">
                <span className="text-[var(--color-ink-400)]">{label}</span>
                <span className="font-medium text-[var(--color-ink-700)] text-right">{value}</span>
              </div>
            ))}
          </div>

          <TimelineSidebar entries={timeline} />
        </div>
      </div>
    </div>
  );
}
