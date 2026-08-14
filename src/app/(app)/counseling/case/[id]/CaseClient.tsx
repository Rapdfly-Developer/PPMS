"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft, CheckCircle2, XCircle, AlertTriangle, Clock, Stethoscope,
  Building2, User, Eye, Scissors, CalendarClock, ShieldCheck, FlaskConical,
  FileText, History, Pencil, Check, CircleDot, Loader2, CalendarDays,
} from "lucide-react";
import {
  STAGE_RAIL, railIndex, stageLabel, stageTone,
  CLINICAL_DECISIONS, DECISION_LABEL, DECISION_REQUIRES_REASON,
  CONFIRMATION_SECTIONS, PAYMENT_MODES, INSURANCE_APPROVAL_STATES,
  PACKAGE_STATES, INVESTIGATION_STATES, CONSENT_STATES, LATERALITY_OPTIONS,
  OT_TIME_SLOTS, OT_REQUEST_LABEL,
  type ClinicalDecision,
} from "@/lib/counselling-workflow";
import {
  submitCounselling, submitClinicalDecision, submitConfirmationCounselling,
  requestOtSlot, respondToOtRequest,
  type CounsellingFormInput,
} from "../../workflow-actions";

/* ── Types ─────────────────────────────────────────────────────────────── */

type Capabilities = {
  view: boolean;
  counsel: boolean;
  decide: boolean;
  schedule: boolean;
  approveOt: boolean;
};

type WorkflowData = {
  id: string;
  stage: string;
  eyeLaterality: string | null;
  diagnosisText: string | null;
  procedureExplanation: string | null;
  benefits: string | null;
  risks: string | null;
  recoveryInfo: string | null;
  patientQuestions: string | null;
  estimatedCost: number | null;
  paymentMode: string | null;
  insuranceApproval: string | null;
  packageStatus: string | null;
  requiredInvestigations: string | null;
  investigationStatus: string | null;
  consentStatus: string | null;
  counsellingNotes: string | null;
  counselledByName: string | null;
  counselledAt: string | null;
  decision: string | null;
  decisionReason: string | null;
  decisionInvestigations: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  confirmedSections: string | null;
  confirmationNotes: string | null;
  patientReady: boolean;
  consentConfirmed: boolean;
  confirmedByName: string | null;
  confirmedAt: string | null;
};

type VersionRow = {
  id: string;
  stage: string;
  changeType: string;
  changedByName: string | null;
  note: string | null;
  createdAt: string;
};

type OtRequestRow = {
  id: string;
  otRoom: string | null;
  requestedDate: string;
  timeSlot: string | null;
  surgeryName: string;
  equipment: string | null;
  staff: string | null;
  notes: string | null;
  status: string;
  doctorNote: string | null;
  suggestedDateTime: string | null;
  requestedByName: string | null;
  createdAt: string;
};

type Props = {
  surgicalCounsellingId: string;
  udid: string;
  can: Capabilities;
  patient: { name: string; udid: string; uhid: string | null; age: number; sex: string };
  doctor: { id: string; name: string };
  hospital: { id: string; name: string };
  surgery: {
    surgeryName: string | null;
    surgeryType: string;
    rightEye: boolean;
    leftEye: boolean;
    anaesthesiaType: string;
    surgeryDate: string;
    insuranceType: string | null;
    advanceAmount: number | null;
  };
  diagnoses: string[];
  workflow: WorkflowData | null;
  versions: VersionRow[];
  otRequests: OtRequestRow[];
};

/* ── Small shared primitives ───────────────────────────────────────────── */

const LABEL =
  "text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-400)]";
const INPUT =
  "w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-ink-800)] placeholder:text-[var(--color-ink-300)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed";

function Field({
  label, children, hint, required,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={LABEL}>
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
      {hint && <span className="text-[11px] text-[var(--color-ink-400)]">{hint}</span>}
    </label>
  );
}

function Panel({
  title, icon, children, footer,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      <header className="flex items-center gap-2.5 px-5 py-3.5 border-b border-[var(--color-border)] bg-[var(--color-surface-sunken)]">
        <span className="text-[var(--color-primary-600)]">{icon}</span>
        <h2 className="text-sm font-bold text-[var(--color-ink-900)]">{title}</h2>
      </header>
      <div className="px-5 py-5">{children}</div>
      {footer && (
        <footer className="px-5 py-4 border-t border-[var(--color-border)] flex items-center justify-end gap-3 flex-wrap">
          {footer}
        </footer>
      )}
    </section>
  );
}

function Alert({ tone, children }: { tone: "error" | "success" | "info"; children: React.ReactNode }) {
  const cls =
    tone === "error"   ? "bg-red-50 border-red-200 text-red-700" :
    tone === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
                         "bg-sky-50 border-sky-200 text-sky-700";
  const Icon = tone === "error" ? AlertTriangle : tone === "success" ? CheckCircle2 : CircleDot;
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${cls}`} role={tone === "error" ? "alert" : undefined}>
      <Icon size={15} className="shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}

function SubmitButton({
  pending, children, tone = "primary", disabled,
}: {
  pending: boolean;
  children: React.ReactNode;
  tone?: "primary" | "emerald" | "amber" | "red";
  disabled?: boolean;
}) {
  const cls =
    tone === "emerald" ? "bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-400" :
    tone === "amber"   ? "bg-amber-500 hover:bg-amber-600 focus-visible:ring-amber-400" :
    tone === "red"     ? "bg-red-600 hover:bg-red-700 focus-visible:ring-red-400" :
                         "bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)] focus-visible:ring-[var(--color-primary-400)]";
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${cls}`}
    >
      {pending && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}

function ReadRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-[var(--color-border)] last:border-0">
      <span className="text-xs text-[var(--color-ink-500)] shrink-0">{label}</span>
      <span className="text-xs font-medium text-[var(--color-ink-800)] text-right break-words">
        {value || <span className="text-[var(--color-ink-300)]">—</span>}
      </span>
    </div>
  );
}

/* ── Progress rail ─────────────────────────────────────────────────────── */

function StageRail({ stage }: { stage: string }) {
  const current = railIndex(stage);
  const blocked = ["NOT_FIT", "DEFERRED", "ADDITIONAL_INVESTIGATIONS", "CANCELLED"].includes(stage);

  return (
    <ol className="flex items-center gap-1 overflow-x-auto pb-1">
      {STAGE_RAIL.map((step, i) => {
        const done    = i < current;
        const active  = i === current;
        const isFail  = active && blocked;
        return (
          <li key={step.stage} className="flex items-center gap-1 shrink-0">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                isFail
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : active
                  ? "bg-[var(--color-primary-600)] text-white"
                  : done
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)] border border-[var(--color-border)]"
              }`}
            >
              {done ? <Check size={11} /> : isFail ? <XCircle size={11} /> : <CircleDot size={11} />}
              {step.short}
            </div>
            {i < STAGE_RAIL.length - 1 && (
              <span className={`w-4 h-px ${done ? "bg-emerald-300" : "bg-[var(--color-border)]"}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ── Counselling form fields (shared by initial + confirmation) ────────── */

type FormState = CounsellingFormInput;

function blankForm(wf: WorkflowData | null, surgery: Props["surgery"], diagnoses: string[]): FormState {
  const laterality =
    wf?.eyeLaterality ??
    (surgery.rightEye && surgery.leftEye ? "OU" : surgery.rightEye ? "RE" : surgery.leftEye ? "LE" : "");
  return {
    eyeLaterality:          laterality,
    diagnosisText:          wf?.diagnosisText ?? diagnoses.join(", "),
    procedureExplanation:   wf?.procedureExplanation ?? "",
    benefits:               wf?.benefits ?? "",
    risks:                  wf?.risks ?? "",
    recoveryInfo:           wf?.recoveryInfo ?? "",
    patientQuestions:       wf?.patientQuestions ?? "",
    estimatedCost:          wf?.estimatedCost ?? null,
    paymentMode:            wf?.paymentMode ?? (surgery.insuranceType ? "INSURANCE" : ""),
    insuranceApproval:      wf?.insuranceApproval ?? "",
    packageStatus:          wf?.packageStatus ?? "",
    requiredInvestigations: wf?.requiredInvestigations ?? "",
    investigationStatus:    wf?.investigationStatus ?? "",
    consentStatus:          wf?.consentStatus ?? "",
    counsellingNotes:       wf?.counsellingNotes ?? "",
  };
}

function CounsellingFields({
  form, set, disabled, surgery, doctor, hospital,
}: {
  form: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  disabled: boolean;
  surgery: Props["surgery"];
  doctor: Props["doctor"];
  hospital: Props["hospital"];
}) {
  const isInsurance = form.paymentMode === "INSURANCE";

  return (
    <div className="flex flex-col gap-6">
      {/* Context — read-only, pulled from the existing surgery record */}
      <div className="grid gap-3 sm:grid-cols-3 rounded-xl bg-[var(--color-surface-sunken)] px-4 py-3.5">
        <div>
          <p className={LABEL}>Surgery type</p>
          <p className="text-sm font-semibold text-[var(--color-ink-800)] mt-0.5">
            {surgery.surgeryName || surgery.surgeryType}
          </p>
        </div>
        <div>
          <p className={LABEL}>Doctor</p>
          <p className="text-sm font-semibold text-[var(--color-ink-800)] mt-0.5">{doctor.name}</p>
        </div>
        <div>
          <p className={LABEL}>Hospital</p>
          <p className="text-sm font-semibold text-[var(--color-ink-800)] mt-0.5">{hospital.name}</p>
        </div>
      </div>

      {/* Clinical */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Eye / Laterality" required>
          <select
            className={INPUT}
            value={form.eyeLaterality}
            disabled={disabled}
            onChange={(e) => set("eyeLaterality", e.target.value)}
          >
            <option value="">Select…</option>
            {LATERALITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Diagnosis">
          <input
            className={INPUT}
            value={form.diagnosisText}
            disabled={disabled}
            placeholder="Confirmed diagnosis"
            onChange={(e) => set("diagnosisText", e.target.value)}
          />
        </Field>
      </div>

      <Field label="Procedure explanation" required hint="What was explained to the patient about the procedure itself.">
        <textarea
          className={`${INPUT} min-h-[84px] resize-y`}
          value={form.procedureExplanation}
          disabled={disabled}
          placeholder="Describe how the procedure was explained…"
          onChange={(e) => set("procedureExplanation", e.target.value)}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Benefits">
          <textarea
            className={`${INPUT} min-h-[72px] resize-y`}
            value={form.benefits}
            disabled={disabled}
            placeholder="Expected visual / functional benefit…"
            onChange={(e) => set("benefits", e.target.value)}
          />
        </Field>
        <Field label="Risks & complications" required>
          <textarea
            className={`${INPUT} min-h-[72px] resize-y`}
            value={form.risks}
            disabled={disabled}
            placeholder="Risks explained to the patient…"
            onChange={(e) => set("risks", e.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Recovery information">
          <textarea
            className={`${INPUT} min-h-[72px] resize-y`}
            value={form.recoveryInfo}
            disabled={disabled}
            placeholder="Post-op care, review schedule, restrictions…"
            onChange={(e) => set("recoveryInfo", e.target.value)}
          />
        </Field>
        <Field label="Patient questions">
          <textarea
            className={`${INPUT} min-h-[72px] resize-y`}
            value={form.patientQuestions}
            disabled={disabled}
            placeholder="Questions raised by the patient or attendant…"
            onChange={(e) => set("patientQuestions", e.target.value)}
          />
        </Field>
      </div>

      {/* Cost & payment */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Estimated cost (₹)">
          <input
            type="number"
            min={0}
            step="0.01"
            className={INPUT}
            value={form.estimatedCost ?? ""}
            disabled={disabled}
            placeholder="0.00"
            onChange={(e) => set("estimatedCost", e.target.value === "" ? null : Number(e.target.value))}
          />
        </Field>
        <Field label="Payment mode">
          <select
            className={INPUT}
            value={form.paymentMode}
            disabled={disabled}
            onChange={(e) => set("paymentMode", e.target.value)}
          >
            <option value="">Select…</option>
            {PAYMENT_MODES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Insurance approval">
          <select
            className={INPUT}
            value={form.insuranceApproval}
            disabled={disabled || !isInsurance}
            onChange={(e) => set("insuranceApproval", e.target.value)}
          >
            <option value="">Select…</option>
            {INSURANCE_APPROVAL_STATES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Package / payment status">
          <select
            className={INPUT}
            value={form.packageStatus}
            disabled={disabled}
            onChange={(e) => set("packageStatus", e.target.value)}
          >
            <option value="">Select…</option>
            {PACKAGE_STATES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
      </div>

      {/* Investigations & consent */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Required investigations">
          <textarea
            className={`${INPUT} min-h-[72px] resize-y`}
            value={form.requiredInvestigations}
            disabled={disabled}
            placeholder="Biometry, Pre-op labs, OCT…"
            onChange={(e) => set("requiredInvestigations", e.target.value)}
          />
        </Field>
        <div className="flex flex-col gap-4">
          <Field label="Investigation status">
            <select
              className={INPUT}
              value={form.investigationStatus}
              disabled={disabled}
              onChange={(e) => set("investigationStatus", e.target.value)}
            >
              <option value="">Select…</option>
              {INVESTIGATION_STATES.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Consent status" required>
            <select
              className={INPUT}
              value={form.consentStatus}
              disabled={disabled}
              onChange={(e) => set("consentStatus", e.target.value)}
            >
              <option value="">Select…</option>
              {CONSENT_STATES.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <Field label="Counseling notes">
        <textarea
          className={`${INPUT} min-h-[72px] resize-y`}
          value={form.counsellingNotes}
          disabled={disabled}
          placeholder="Anything else worth recording…"
          onChange={(e) => set("counsellingNotes", e.target.value)}
        />
      </Field>
    </div>
  );
}

/* ── Panel: initial counselling ────────────────────────────────────────── */

function CounsellingPanel({
  surgicalCounsellingId, udid, workflow, surgery, doctor, hospital, diagnoses, onDone,
}: {
  surgicalCounsellingId: string;
  udid: string;
  workflow: WorkflowData | null;
  surgery: Props["surgery"];
  doctor: Props["doctor"];
  hospital: Props["hospital"];
  diagnoses: string[];
  onDone: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => blankForm(workflow, surgery, diagnoses));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await submitCounselling(surgicalCounsellingId, udid, form);
      if (res.error) setError(res.error);
      else onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <Panel
        title="Surgical Counseling"
        icon={<FileText size={16} />}
        footer={
          <>
            {error && <div className="mr-auto"><Alert tone="error">{error}</Alert></div>}
            <SubmitButton pending={pending}>Complete Counseling & Send to Doctor</SubmitButton>
          </>
        }
      >
        <div className="mb-5">
          <Alert tone="info">
            On submit this case moves to <strong>Awaiting Doctor Decision</strong> and the doctor is notified.
          </Alert>
        </div>
        <CounsellingFields
          form={form}
          set={set}
          disabled={pending}
          surgery={surgery}
          doctor={doctor}
          hospital={hospital}
        />
      </Panel>
    </form>
  );
}

/* ── Panel: doctor clinical decision ───────────────────────────────────── */

function DecisionPanel({
  workflow, udid, onDone,
}: {
  workflow: WorkflowData;
  udid: string;
  onDone: () => void;
}) {
  const [decision, setDecision] = useState<ClinicalDecision | "">("");
  const [reason, setReason] = useState("");
  const [investigations, setInvestigations] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const needsReason = decision !== "" && DECISION_REQUIRES_REASON.includes(decision);
  const needsInvestigations = decision === "ADDITIONAL_INVESTIGATIONS";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!decision) { setError("Please select a clinical decision."); return; }
    setError(null);
    start(async () => {
      const res = await submitClinicalDecision(workflow.id, udid, decision, reason, investigations);
      if (res.error) setError(res.error);
      else onDone();
    });
  }

  const TONE: Record<ClinicalDecision, string> = {
    FIT:                       "peer-checked:border-emerald-500 peer-checked:bg-emerald-50",
    NOT_FIT:                   "peer-checked:border-red-500 peer-checked:bg-red-50",
    DEFERRED:                  "peer-checked:border-orange-500 peer-checked:bg-orange-50",
    ADDITIONAL_INVESTIGATIONS: "peer-checked:border-violet-500 peer-checked:bg-violet-50",
  };

  return (
    <form onSubmit={handleSubmit}>
      <Panel
        title="Clinical Decision"
        icon={<Stethoscope size={16} />}
        footer={
          <>
            {error && <div className="mr-auto"><Alert tone="error">{error}</Alert></div>}
            <SubmitButton pending={pending} tone="amber" disabled={!decision}>
              Submit Decision
            </SubmitButton>
          </>
        }
      >
        <fieldset className="flex flex-col gap-3">
          <legend className={`${LABEL} mb-2`}>Select one</legend>
          {CLINICAL_DECISIONS.map((d) => (
            <div key={d} className="relative">
              <input
                type="radio"
                id={`decision-${d}`}
                name="decision"
                value={d}
                checked={decision === d}
                disabled={pending}
                onChange={() => setDecision(d)}
                className="peer sr-only"
              />
              <label
                htmlFor={`decision-${d}`}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-[var(--color-border)] cursor-pointer transition-colors hover:bg-[var(--color-surface-sunken)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-primary-400)] ${TONE[d]}`}
              >
                <span className="w-4 h-4 rounded-full border-2 border-[var(--color-ink-300)] flex items-center justify-center shrink-0">
                  {decision === d && <span className="w-2 h-2 rounded-full bg-current" />}
                </span>
                <span className="text-sm font-semibold text-[var(--color-ink-800)]">
                  {DECISION_LABEL[d]}
                </span>
              </label>
            </div>
          ))}
        </fieldset>

        {needsInvestigations && (
          <div className="mt-5">
            <Field label="Required investigations" required hint="The case returns to the counselor, then comes back to you once these are done.">
              <textarea
                className={`${INPUT} min-h-[80px] resize-y`}
                value={investigations}
                disabled={pending}
                placeholder="e.g. Repeat biometry, cardiac clearance…"
                onChange={(e) => setInvestigations(e.target.value)}
              />
            </Field>
          </div>
        )}

        <div className="mt-5">
          <Field
            label={needsReason ? "Reason" : "Note (optional)"}
            required={needsReason}
          >
            <textarea
              className={`${INPUT} min-h-[80px] resize-y`}
              value={reason}
              disabled={pending}
              placeholder={needsReason ? "Why is the patient not fit / why defer?" : "Any note for the counseling team…"}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
        </div>
      </Panel>
    </form>
  );
}

/* ── Panel: confirmation counselling ───────────────────────────────────── */

function ConfirmationPanel({
  workflow, udid, surgery, doctor, hospital, diagnoses, onDone,
}: {
  workflow: WorkflowData;
  udid: string;
  surgery: Props["surgery"];
  doctor: Props["doctor"];
  hospital: Props["hospital"];
  diagnoses: string[];
  onDone: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => blankForm(workflow, surgery, diagnoses));
  const [verified, setVerified] = useState<string[]>(() => {
    try { return workflow.confirmedSections ? JSON.parse(workflow.confirmedSections) : []; }
    catch { return []; }
  });
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(workflow.confirmationNotes ?? "");
  const [patientReady, setPatientReady] = useState(workflow.patientReady);
  const [consentConfirmed, setConsentConfirmed] = useState(workflow.consentConfirmed);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggle(key: string) {
    setVerified((v) => (v.includes(key) ? v.filter((k) => k !== key) : [...v, key]));
  }

  const allVerified = CONFIRMATION_SECTIONS.every((s) => verified.includes(s.key));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await submitConfirmationCounselling(workflow.id, udid, {
        ...form,
        confirmedSections: verified,
        confirmationNotes: notes,
        patientReady,
        consentConfirmed,
      });
      if (res.error) setError(res.error);
      else onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <Panel
        title="Confirmation Counseling"
        icon={<ShieldCheck size={16} />}
        footer={
          <>
            {error && <div className="mr-auto"><Alert tone="error">{error}</Alert></div>}
            <span className="mr-auto text-xs text-[var(--color-ink-500)] tabular-nums">
              {verified.length} / {CONFIRMATION_SECTIONS.length} sections verified
            </span>
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-400)]"
            >
              <Pencil size={13} /> {editing ? "Done editing" : "Edit details"}
            </button>
            <SubmitButton pending={pending} tone="emerald" disabled={!allVerified}>
              Confirm & Mark Ready for OT
            </SubmitButton>
          </>
        }
      >
        <div className="mb-5">
          <Alert tone="info">
            Everything below is pre-filled from the counseling the doctor reviewed. Verify each
            section; use <strong>Edit details</strong> only if something must change.
          </Alert>
        </div>

        {/* Verification checklist */}
        <div className="grid gap-2 sm:grid-cols-2 mb-6">
          {CONFIRMATION_SECTIONS.map((s) => {
            const on = verified.includes(s.key);
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => toggle(s.key)}
                aria-pressed={on}
                disabled={pending}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-400)] ${
                  on
                    ? "bg-emerald-50 border-emerald-300"
                    : "bg-[var(--color-surface)] border-[var(--color-border)] hover:bg-[var(--color-surface-sunken)]"
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    on ? "bg-emerald-500 border-emerald-500 text-white" : "border-[var(--color-ink-300)]"
                  }`}
                >
                  {on && <Check size={12} strokeWidth={3} />}
                </span>
                <span className={`text-xs font-semibold ${on ? "text-emerald-800" : "text-[var(--color-ink-700)]"}`}>
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>

        <CounsellingFields
          form={form}
          set={set}
          disabled={!editing || pending}
          surgery={surgery}
          doctor={doctor}
          hospital={hospital}
        />

        {/* Final confirmations */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-surface-sunken)] transition-colors">
            <input
              type="checkbox"
              checked={consentConfirmed}
              disabled={pending}
              onChange={(e) => setConsentConfirmed(e.target.checked)}
              className="w-4 h-4 accent-emerald-600"
            />
            <span className="text-sm font-medium text-[var(--color-ink-800)]">Patient consent confirmed</span>
          </label>
          <label className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-surface-sunken)] transition-colors">
            <input
              type="checkbox"
              checked={patientReady}
              disabled={pending}
              onChange={(e) => setPatientReady(e.target.checked)}
              className="w-4 h-4 accent-emerald-600"
            />
            <span className="text-sm font-medium text-[var(--color-ink-800)]">Patient ready for surgery</span>
          </label>
        </div>

        <div className="mt-4">
          <Field label="Confirmation notes">
            <textarea
              className={`${INPUT} min-h-[72px] resize-y`}
              value={notes}
              disabled={pending}
              placeholder="Anything noted during confirmation counseling…"
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
        </div>
      </Panel>
    </form>
  );
}

/* ── Panel: OT slot request ────────────────────────────────────────────── */

function OtRequestPanel({
  workflow, udid, surgery, doctor, hospital, latest, onDone,
}: {
  workflow: WorkflowData;
  udid: string;
  surgery: Props["surgery"];
  doctor: Props["doctor"];
  hospital: Props["hospital"];
  latest: OtRequestRow | null;
  onDone: () => void;
}) {
  const suggested = latest?.suggestedDateTime ? new Date(latest.suggestedDateTime) : null;

  const [otRoom, setOtRoom]       = useState(latest?.otRoom ?? "");
  const [date, setDate]           = useState(
    suggested ? format(suggested, "yyyy-MM-dd") : format(new Date(surgery.surgeryDate), "yyyy-MM-dd"),
  );
  const [slot, setSlot]           = useState(suggested ? format(suggested, "HH:mm") : latest?.timeSlot ?? "09:00");
  const [surgeryName, setName]    = useState(latest?.surgeryName ?? surgery.surgeryName ?? surgery.surgeryType);
  const [equipment, setEquipment] = useState(latest?.equipment ?? "");
  const [staff, setStaff]         = useState(latest?.staff ?? "");
  const [notes, setNotes]         = useState("");
  const [error, setError]         = useState<string | null>(null);
  const [pending, start]          = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await requestOtSlot(workflow.id, udid, {
        hospitalId: hospital.id,
        otRoom,
        requestedDate: date,
        timeSlot: slot,
        doctorId: doctor.id,
        surgeryName,
        equipment,
        staff,
        notes,
      });
      if (res.error) setError(res.error);
      else onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <Panel
        title="Request OT Slot"
        icon={<CalendarClock size={16} />}
        footer={
          <>
            {error && <div className="mr-auto"><Alert tone="error">{error}</Alert></div>}
            <SubmitButton pending={pending} tone="emerald">Send Request to Doctor</SubmitButton>
          </>
        }
      >
        {latest?.status === "RESCHEDULE_SUGGESTED" && suggested && (
          <div className="mb-5">
            <Alert tone="info">
              The doctor suggested <strong>{format(suggested, "d MMM yyyy 'at' HH:mm")}</strong>
              {latest.doctorNote ? ` — ${latest.doctorNote}` : ""}. The form below is pre-filled with it.
            </Alert>
          </div>
        )}
        {latest?.status === "REJECTED" && (
          <div className="mb-5">
            <Alert tone="error">
              Previous request was rejected{latest.doctorNote ? `: ${latest.doctorNote}` : ""}. Please choose another slot.
            </Alert>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Hospital">
            <input className={INPUT} value={hospital.name} disabled readOnly />
          </Field>
          <Field label="Doctor / Surgeon">
            <input className={INPUT} value={doctor.name} disabled readOnly />
          </Field>
          <Field label="Surgery" required>
            <input
              className={INPUT}
              value={surgeryName}
              disabled={pending}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="OT room">
            <input
              className={INPUT}
              value={otRoom}
              disabled={pending}
              placeholder="e.g. OT-1"
              onChange={(e) => setOtRoom(e.target.value)}
            />
          </Field>
          <Field label="Date" required>
            <input
              type="date"
              className={INPUT}
              value={date}
              disabled={pending}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="Time slot" required>
            <select
              className={INPUT}
              value={slot}
              disabled={pending}
              onChange={(e) => setSlot(e.target.value)}
            >
              {OT_TIME_SLOTS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Required equipment">
            <textarea
              className={`${INPUT} min-h-[72px] resize-y`}
              value={equipment}
              disabled={pending}
              placeholder="Phaco machine, microscope, IOL set…"
              onChange={(e) => setEquipment(e.target.value)}
            />
          </Field>
          <Field label="Required staff">
            <textarea
              className={`${INPUT} min-h-[72px] resize-y`}
              value={staff}
              disabled={pending}
              placeholder="Scrub nurse, anesthetist…"
              onChange={(e) => setStaff(e.target.value)}
            />
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Notes for the doctor">
            <textarea
              className={`${INPUT} min-h-[64px] resize-y`}
              value={notes}
              disabled={pending}
              placeholder="Anything the doctor should know about this slot…"
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
        </div>
      </Panel>
    </form>
  );
}

/* ── Panel: doctor approves / reschedules / rejects the OT slot ────────── */

function OtApprovalPanel({
  request, udid, onDone,
}: {
  request: OtRequestRow;
  udid: string;
  onDone: () => void;
}) {
  const [response, setResponse] = useState<"APPROVE" | "SUGGEST" | "REJECT" | "">("");
  const [note, setNote] = useState("");
  const requested = new Date(request.requestedDate);
  const [sDate, setSDate] = useState(format(requested, "yyyy-MM-dd"));
  const [sTime, setSTime] = useState(format(requested, "HH:mm"));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!response) { setError("Please choose how to respond."); return; }
    setError(null);
    start(async () => {
      const res = await respondToOtRequest(request.id, udid, response, note, sDate, sTime);
      if (res.error) setError(res.error);
      else onDone();
    });
  }

  const OPTIONS = [
    { value: "APPROVE" as const, label: "Approve this slot",        tone: "peer-checked:border-emerald-500 peer-checked:bg-emerald-50" },
    { value: "SUGGEST" as const, label: "Suggest another date/time", tone: "peer-checked:border-amber-500 peer-checked:bg-amber-50" },
    { value: "REJECT"  as const, label: "Reject — request another slot", tone: "peer-checked:border-red-500 peer-checked:bg-red-50" },
  ];

  return (
    <form onSubmit={handleSubmit}>
      <Panel
        title="OT Slot Request"
        icon={<CalendarDays size={16} />}
        footer={
          <>
            {error && <div className="mr-auto"><Alert tone="error">{error}</Alert></div>}
            <SubmitButton
              pending={pending}
              tone={response === "APPROVE" ? "emerald" : response === "REJECT" ? "red" : "amber"}
              disabled={!response}
            >
              Submit Response
            </SubmitButton>
          </>
        }
      >
        {/* Requested slot */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-4 py-3 mb-5">
          <ReadRow label="Surgery"   value={request.surgeryName} />
          <ReadRow label="Date"      value={format(requested, "EEE, d MMM yyyy")} />
          <ReadRow label="Time slot" value={request.timeSlot} />
          <ReadRow label="OT room"   value={request.otRoom} />
          <ReadRow label="Equipment" value={request.equipment} />
          <ReadRow label="Staff"     value={request.staff} />
          <ReadRow label="Notes"     value={request.notes} />
          <ReadRow label="Requested by" value={request.requestedByName} />
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className={`${LABEL} mb-2`}>Your response</legend>
          {OPTIONS.map((o) => (
            <div key={o.value} className="relative">
              <input
                type="radio"
                id={`ot-${o.value}`}
                name="ot-response"
                value={o.value}
                checked={response === o.value}
                disabled={pending}
                onChange={() => setResponse(o.value)}
                className="peer sr-only"
              />
              <label
                htmlFor={`ot-${o.value}`}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-[var(--color-border)] cursor-pointer transition-colors hover:bg-[var(--color-surface-sunken)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-primary-400)] ${o.tone}`}
              >
                <span className="w-4 h-4 rounded-full border-2 border-[var(--color-ink-300)] flex items-center justify-center shrink-0">
                  {response === o.value && <span className="w-2 h-2 rounded-full bg-current" />}
                </span>
                <span className="text-sm font-semibold text-[var(--color-ink-800)]">{o.label}</span>
              </label>
            </div>
          ))}
        </fieldset>

        {response === "SUGGEST" && (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Suggested date" required>
              <input
                type="date"
                className={INPUT}
                value={sDate}
                disabled={pending}
                onChange={(e) => setSDate(e.target.value)}
              />
            </Field>
            <Field label="Suggested time" required>
              <select
                className={INPUT}
                value={sTime}
                disabled={pending}
                onChange={(e) => setSTime(e.target.value)}
              >
                {OT_TIME_SLOTS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
          </div>
        )}

        <div className="mt-5">
          <Field
            label={response === "REJECT" ? "Reason" : "Note (optional)"}
            required={response === "REJECT"}
          >
            <textarea
              className={`${INPUT} min-h-[72px] resize-y`}
              value={note}
              disabled={pending}
              placeholder={response === "REJECT" ? "Why is this slot not workable?" : "Any note for the scheduling team…"}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
        </div>
      </Panel>
    </form>
  );
}

/* ── Read-only summary of what has been recorded so far ────────────────── */

function CounsellingSummary({ wf }: { wf: WorkflowData }) {
  const cost = wf.estimatedCost != null ? `₹${wf.estimatedCost.toLocaleString("en-IN")}` : null;
  const lat = LATERALITY_OPTIONS.find((o) => o.value === wf.eyeLaterality)?.label ?? wf.eyeLaterality;
  const pay = PAYMENT_MODES.find((o) => o.value === wf.paymentMode)?.label ?? wf.paymentMode;

  return (
    <Panel title="Counseling Record" icon={<FileText size={16} />}>
      <div className="flex flex-col">
        <ReadRow label="Eye / Laterality"       value={lat} />
        <ReadRow label="Diagnosis"              value={wf.diagnosisText} />
        <ReadRow label="Procedure explanation"  value={wf.procedureExplanation} />
        <ReadRow label="Benefits"               value={wf.benefits} />
        <ReadRow label="Risks"                  value={wf.risks} />
        <ReadRow label="Recovery"               value={wf.recoveryInfo} />
        <ReadRow label="Patient questions"      value={wf.patientQuestions} />
        <ReadRow label="Estimated cost"         value={cost} />
        <ReadRow label="Payment mode"           value={pay} />
        <ReadRow label="Insurance approval"     value={wf.insuranceApproval} />
        <ReadRow label="Package status"         value={wf.packageStatus} />
        <ReadRow label="Required investigations" value={wf.requiredInvestigations} />
        <ReadRow label="Investigation status"   value={wf.investigationStatus} />
        <ReadRow label="Consent"                value={wf.consentStatus} />
        <ReadRow label="Notes"                  value={wf.counsellingNotes} />
        {wf.counselledByName && (
          <ReadRow
            label="Counselled by"
            value={`${wf.counselledByName}${wf.counselledAt ? ` · ${format(new Date(wf.counselledAt), "d MMM yyyy")}` : ""}`}
          />
        )}
      </div>
    </Panel>
  );
}

/* ── History timeline ──────────────────────────────────────────────────── */

const CHANGE_LABEL: Record<string, string> = {
  COUNSELING:   "Counseling",
  DECISION:     "Clinical decision",
  CONFIRMATION: "Confirmation counseling",
  OT_REQUEST:   "OT slot requested",
  OT_DECISION:  "OT response",
};

function HistoryPanel({ versions }: { versions: VersionRow[] }) {
  if (versions.length === 0) {
    return (
      <Panel title="History" icon={<History size={16} />}>
        <p className="text-sm text-[var(--color-ink-400)]">No changes recorded yet.</p>
      </Panel>
    );
  }
  return (
    <Panel title="History" icon={<History size={16} />}>
      <ol className="flex flex-col gap-3">
        {versions.map((v) => (
          <li key={v.id} className="flex gap-3">
            <div className="flex flex-col items-center shrink-0">
              <span className="w-2 h-2 rounded-full bg-[var(--color-primary-500)] mt-1.5" />
              <span className="flex-1 w-px bg-[var(--color-border)] mt-1" />
            </div>
            <div className="min-w-0 pb-1">
              <p className="text-xs font-semibold text-[var(--color-ink-800)]">
                {CHANGE_LABEL[v.changeType] ?? v.changeType}
                <span className="font-normal text-[var(--color-ink-400)]"> → {stageLabel(v.stage)}</span>
              </p>
              <p className="text-[11px] text-[var(--color-ink-400)] mt-0.5">
                {v.changedByName ?? "Unknown"} · {format(new Date(v.createdAt), "d MMM yyyy, HH:mm")}
              </p>
              {v.note && <p className="text-[11px] text-[var(--color-ink-600)] mt-1">{v.note}</p>}
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

/* ── Page shell ────────────────────────────────────────────────────────── */

const SEX_SHORT: Record<string, string> = { MALE: "M", FEMALE: "F", OTHER: "O" };

export function CaseClient(props: Props) {
  const {
    surgicalCounsellingId, udid, can, patient, doctor, hospital,
    surgery, diagnoses, workflow, versions, otRequests,
  } = props;

  const router = useRouter();
  const [flash, setFlash] = useState<string | null>(null);

  const stage = workflow?.stage ?? "PENDING_COUNSELING";
  const openRequest = otRequests.find((r) => r.status === "REQUESTED") ?? null;
  const latestRequest = otRequests[0] ?? null;

  function done(message: string) {
    setFlash(message);
    router.refresh();
  }

  /* Which action panel this user sees at this stage. */
  function renderPanel() {
    // Counselor: initial counselling (also when the doctor asks for more work)
    if ((stage === "PENDING_COUNSELING" || stage === "ADDITIONAL_INVESTIGATIONS") && can.counsel) {
      return (
        <CounsellingPanel
          surgicalCounsellingId={surgicalCounsellingId}
          udid={udid}
          workflow={workflow}
          surgery={surgery}
          doctor={doctor}
          hospital={hospital}
          diagnoses={diagnoses}
          onDone={() => done("Counseling submitted. The doctor has been notified.")}
        />
      );
    }

    // Doctor: clinical decision
    if ((stage === "COUNSELING_COMPLETED" || stage === "AWAITING_DOCTOR_REVIEW") && can.decide && workflow) {
      return <DecisionPanel workflow={workflow} udid={udid} onDone={() => done("Clinical decision recorded.")} />;
    }

    // Counselor: confirmation counselling
    if ((stage === "FIT_FOR_SURGERY" || stage === "CONFIRMATION_COUNSELING") && can.counsel && workflow) {
      return (
        <ConfirmationPanel
          workflow={workflow}
          udid={udid}
          surgery={surgery}
          doctor={doctor}
          hospital={hospital}
          diagnoses={diagnoses}
          onDone={() => done("Confirmation complete. This case is ready for OT scheduling.")}
        />
      );
    }

    // Manager / Hospital Admin: request an OT slot
    if ((stage === "READY_FOR_OT" || stage === "RESCHEDULING_REQUIRED") && can.schedule && workflow) {
      return (
        <OtRequestPanel
          workflow={workflow}
          udid={udid}
          surgery={surgery}
          doctor={doctor}
          hospital={hospital}
          latest={latestRequest}
          onDone={() => done("OT slot requested. The doctor has been notified.")}
        />
      );
    }

    // Doctor: respond to the OT slot request
    if (stage === "OT_SLOT_REQUESTED" && can.approveOt && openRequest) {
      return (
        <OtApprovalPanel
          request={openRequest}
          udid={udid}
          onDone={() => done("Response recorded.")}
        />
      );
    }

    /* ── Nothing for this user to do right now ── */
    return (
      <Panel title={stageLabel(stage)} icon={<Clock size={16} />}>
        <p className="text-sm text-[var(--color-ink-600)]">
          {stage === "SCHEDULED_OT" ? (
            <>
              This surgery is confirmed and now follows the standard OT flow.{" "}
              <Link href="/scheduled-ot" className="text-[var(--color-primary-700)] font-semibold hover:underline">
                Open Scheduled OT →
              </Link>
            </>
          ) : stage === "OT_SLOT_REQUESTED" ? (
            "An OT slot has been requested and is awaiting the doctor's approval."
          ) : stage === "NOT_FIT" ? (
            "The doctor marked this patient not fit for surgery."
          ) : stage === "DEFERRED" ? (
            "Surgery has been deferred by the doctor."
          ) : stage === "CANCELLED" ? (
            "This case was cancelled."
          ) : can.counsel || can.decide || can.schedule || can.approveOt ? (
            "There is nothing for you to action at this stage."
          ) : (
            "You have read-only access to this case."
          )}
        </p>
        {workflow?.decisionReason && (
          <div className="mt-3">
            <Alert tone="info">
              <strong>Doctor&rsquo;s note:</strong> {workflow.decisionReason}
            </Alert>
          </div>
        )}
        {workflow?.decisionInvestigations && (
          <div className="mt-3">
            <Alert tone="info">
              <strong>Investigations required:</strong> {workflow.decisionInvestigations}
            </Alert>
          </div>
        )}
      </Panel>
    );
  }

  const lat =
    surgery.rightEye && surgery.leftEye ? "Both Eyes" :
    surgery.rightEye ? "Right Eye" :
    surgery.leftEye ? "Left Eye" : "—";

  return (
    <div className="flex flex-col gap-5 fade-in">
      {/* Header */}
      <div className="flex items-start gap-3 flex-wrap">
        <Link
          href="/counseling"
          className="w-9 h-9 rounded-xl border border-[var(--color-border)] flex items-center justify-center text-[var(--color-ink-500)] hover:bg-[var(--color-surface-sunken)] transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-400)]"
          aria-label="Back to Counseling"
        >
          <ArrowLeft size={16} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold text-[var(--color-ink-900)] leading-tight">
              {patient.name}
            </h1>
            <span className="text-xs text-[var(--color-ink-400)] tabular-nums">
              {patient.age}{SEX_SHORT[patient.sex] ?? patient.sex}
            </span>
            {patient.uhid && (
              <span className="text-[10px] font-mono text-[var(--color-ink-400)]">{patient.uhid}</span>
            )}
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${stageTone(stage)}`}>
              {stageLabel(stage)}
            </span>
          </div>
          <p className="text-xs text-[var(--color-ink-500)] mt-0.5">
            {surgery.surgeryName || surgery.surgeryType} · {lat} · {surgery.anaesthesiaType}
          </p>
        </div>
        {patient.udid && (
          <Link
            href={`/patients/${patient.udid}`}
            className="text-xs font-semibold px-3 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-400)]"
          >
            Patient profile
          </Link>
        )}
      </div>

      {/* Progress rail */}
      <StageRail stage={stage} />

      {flash && <Alert tone="success">{flash}</Alert>}

      {/* Main + sidebar */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
        <div className="flex flex-col gap-5 min-w-0">
          {renderPanel()}

          {/* Once counselling is recorded, always show it for reference */}
          {workflow?.counselledAt &&
            !["PENDING_COUNSELING", "ADDITIONAL_INVESTIGATIONS"].includes(stage) && (
              <CounsellingSummary wf={workflow} />
            )}
        </div>

        {/* Sidebar */}
        <aside className="flex flex-col gap-5 min-w-0">
          <Panel title="Case" icon={<Scissors size={16} />}>
            <div className="flex flex-col">
              <ReadRow label="Doctor"   value={<span className="inline-flex items-center gap-1"><Stethoscope size={11} /> {doctor.name}</span>} />
              <ReadRow label="Hospital" value={<span className="inline-flex items-center gap-1"><Building2 size={11} /> {hospital.name}</span>} />
              <ReadRow label="Surgery"  value={surgery.surgeryName || surgery.surgeryType} />
              <ReadRow label="Eye"      value={<span className="inline-flex items-center gap-1"><Eye size={11} /> {lat}</span>} />
              <ReadRow label="Anaesthesia" value={surgery.anaesthesiaType} />
              <ReadRow label="Planned date" value={format(new Date(surgery.surgeryDate), "d MMM yyyy")} />
              {diagnoses.length > 0 && <ReadRow label="Diagnoses" value={diagnoses.join(", ")} />}
            </div>
          </Panel>

          {workflow?.decision && (
            <Panel title="Clinical Decision" icon={<Stethoscope size={16} />}>
              <div className="flex flex-col">
                <ReadRow
                  label="Decision"
                  value={DECISION_LABEL[workflow.decision as ClinicalDecision] ?? workflow.decision}
                />
                <ReadRow label="Reason" value={workflow.decisionReason} />
                <ReadRow label="Investigations" value={workflow.decisionInvestigations} />
                <ReadRow
                  label="Decided by"
                  value={
                    workflow.decidedByName
                      ? `${workflow.decidedByName}${workflow.decidedAt ? ` · ${format(new Date(workflow.decidedAt), "d MMM yyyy")}` : ""}`
                      : null
                  }
                />
              </div>
            </Panel>
          )}

          {otRequests.length > 0 && (
            <Panel title="OT Requests" icon={<CalendarClock size={16} />}>
              <ul className="flex flex-col gap-3">
                {otRequests.map((r) => (
                  <li key={r.id} className="rounded-xl border border-[var(--color-border)] px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-[var(--color-ink-800)] tabular-nums">
                        {format(new Date(r.requestedDate), "d MMM yyyy")} · {r.timeSlot ?? "—"}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)] border-[var(--color-border)]">
                        {OT_REQUEST_LABEL[r.status] ?? r.status}
                      </span>
                    </div>
                    {r.otRoom && (
                      <p className="text-[11px] text-[var(--color-ink-500)] mt-1">{r.otRoom}</p>
                    )}
                    {r.doctorNote && (
                      <p className="text-[11px] text-[var(--color-ink-600)] mt-1">{r.doctorNote}</p>
                    )}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <HistoryPanel versions={versions} />
        </aside>
      </div>
    </div>
  );
}
