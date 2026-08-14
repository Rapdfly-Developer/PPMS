"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  CheckCircle2, XCircle, Clock, FlaskConical, ChevronLeft,
  User, Scissors, CreditCard, Activity, Eye, Zap, ShieldCheck,
  Banknote, CalendarClock, ChevronDown, ChevronUp, Circle,
  AlertTriangle, ArrowRight, Pencil, Check,
} from "lucide-react";
import { setDoctorReviewStatus, confirmFitForSurgery, type ConfirmFitInput } from "../actions";

/* ── Constants ─────────────────────────────────────────────────────────── */
const SURGERY_NAME_OPTIONS = [
  "Phacoemulsification with IOL Implantation",
  "Manual Small Incision Cataract Surgery (MSICS)",
  "Extracapsular Cataract Extraction (ECCE)",
  "Intracapsular Cataract Extraction (ICCE)",
  "Trabeculectomy", "Ahmed Glaucoma Valve Implantation", "Baerveldt Glaucoma Implant",
  "Pars Plana Vitrectomy (PPV)", "Scleral Buckle", "Retinal Detachment Surgery",
  "Intravitreal Injection", "Laser Photocoagulation",
  "Penetrating Keratoplasty (PKP)", "Deep Anterior Lamellar Keratoplasty (DALK)",
  "Descemet Membrane Endothelial Keratoplasty (DMEK)",
  "Descemet Stripping Automated Endothelial Keratoplasty (DSAEK)",
  "Pterygium Excision with Conjunctival Autograft", "Dacryocystorhinostomy (DCR)",
  "Squint Surgery", "Entropion Correction", "Ectropion Correction",
  "Lid Repair", "Orbital Decompression", "Enucleation / Evisceration",
];
const ANAESTHESIA_TYPES = ["Topical", "Local", "Peribulbar", "Retrobulbar", "General", "Sedation"];

const REVIEW_OPTIONS = [
  {
    id: "FIT_FOR_SURGERY",
    label: "Fit for Surgery",
    description: "Patient is cleared and ready to proceed",
    icon: CheckCircle2,
    color: "text-emerald-600",
    bg: "bg-emerald-50 border-emerald-300",
    activeBg: "bg-emerald-600 text-white border-emerald-600",
  },
  {
    id: "NOT_FIT",
    label: "Not Fit for Surgery",
    description: "Patient cannot undergo surgery at this time",
    icon: XCircle,
    color: "text-red-600",
    bg: "bg-red-50 border-red-300",
    activeBg: "bg-red-600 text-white border-red-600",
  },
  {
    id: "DEFERRED",
    label: "Surgery Deferred",
    description: "Surgery postponed — reschedule required",
    icon: Clock,
    color: "text-amber-600",
    bg: "bg-amber-50 border-amber-300",
    activeBg: "bg-amber-500 text-white border-amber-500",
  },
  {
    id: "ADDITIONAL_INVESTIGATIONS",
    label: "Additional Investigations Required",
    description: "Further tests needed before proceeding",
    icon: FlaskConical,
    color: "text-blue-600",
    bg: "bg-blue-50 border-blue-300",
    activeBg: "bg-blue-600 text-white border-blue-600",
  },
] as const;

type ReviewStatus = (typeof REVIEW_OPTIONS)[number]["id"];
const SEX_SHORT: Record<string, string> = { MALE: "M", FEMALE: "F", OTHER: "O" };

/* ── Prop types ─────────────────────────────────────────────────────────── */
type PatientInfo = {
  name: string; udid: string; uhid: string; age: number; sex: string;
};
type CounsellingInfo = {
  id: string;
  surgeryName: string | null;
  surgeryType: string;
  rightEye: boolean;
  leftEye: boolean;
  anaesthesiaType: string;
  surgeryDate: string;
  conflictFlag: boolean;
  paymentMode: string | null;
  paymentNotes: string | null;
  counselingDone: boolean;
  investigationDone: boolean;
  advanceAmount: number | null;
  advanceReceipt: string | null;
  counsellingNotes: string | null;
  reviewStatus: string | null;
  doctorReviewNote: string | null;
  confirmedFitAt: string | null;
};
type ScheduleInfo = {
  surgeryCategory: string;
  urgencyType: string;
  priority: string;
  otRoom: string | null;
  estimatedDuration: number | null;
  anesthetistName: string | null;
  procedure: string | null;
  diagnosis: string | null;
  consentReceived: boolean;
  reportsUploaded: boolean;
  bloodArranged: boolean;
  plannedTime: string;
} | null;

/* ── Small helpers ─────────────────────────────────────────────────────── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-400)]">{label}</label>
      {children}
    </div>
  );
}

function FInput({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent ${props.className ?? ""}`}
    />
  );
}

function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${selected ? "bg-violet-600 text-white border-violet-600" : "border-[var(--color-border)] text-[var(--color-ink-600)] hover:border-violet-300"}`}
    >
      {label}
    </button>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[var(--color-border)] last:border-0">
      <span className="text-sm text-[var(--color-ink-700)]">{label}</span>
      <div className="flex rounded-lg overflow-hidden border border-[var(--color-border)] text-xs font-bold">
        <button type="button" onClick={() => onChange(true)}
          className={`px-3 py-1 transition-colors ${value ? "bg-emerald-500 text-white" : "text-[var(--color-ink-400)] hover:bg-[var(--color-surface-sunken)]"}`}>Yes</button>
        <button type="button" onClick={() => onChange(false)}
          className={`px-3 py-1 transition-colors ${!value ? "bg-red-500 text-white" : "text-[var(--color-ink-400)] hover:bg-[var(--color-surface-sunken)]"}`}>No</button>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-[var(--color-border)] last:border-0">
      <span className="text-xs text-[var(--color-ink-400)] w-36 shrink-0 mt-0.5">{label}</span>
      <span className="text-sm font-medium text-[var(--color-ink-800)] flex-1">{value || <span className="text-[var(--color-ink-300)]">—</span>}</span>
    </div>
  );
}

/* ── VerifySection ─────────────────────────────────────────────────────── */
function VerifySection({
  icon: Icon, title, summary, verified, onVerify, editing, onEditToggle, children,
}: {
  icon: React.ElementType;
  title: string;
  summary: string;
  verified: boolean;
  onVerify: () => void;
  editing: boolean;
  onEditToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border transition-colors ${verified ? "border-emerald-200 bg-emerald-50/30" : "border-[var(--color-border)] bg-[var(--color-surface)]"}`}>
      <div className="flex items-start gap-3 px-4 py-3.5">
        {/* Verify checkbox */}
        <button
          type="button"
          onClick={onVerify}
          className={`mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
            verified ? "border-emerald-500 bg-emerald-500" : "border-[var(--color-border)] hover:border-violet-400"
          }`}
          title={verified ? "Verified" : "Click to verify"}
        >
          {verified && <Check size={11} className="text-white" strokeWidth={3} />}
        </button>

        {/* Icon + title + summary */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Icon size={13} className={verified ? "text-emerald-600" : "text-violet-500"} />
            <p className={`text-sm font-bold ${verified ? "text-emerald-800" : "text-[var(--color-ink-800)]"}`}>{title}</p>
          </div>
          <p className="text-xs text-[var(--color-ink-500)] mt-0.5 truncate">{summary}</p>
        </div>

        {/* Edit toggle */}
        <button
          type="button"
          onClick={onEditToggle}
          className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-[var(--color-ink-500)] hover:text-violet-700 px-2 py-1 rounded-lg hover:bg-violet-50 transition-colors"
        >
          <Pencil size={10} />
          {editing ? "Close" : "Edit"}
          {editing ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>
      </div>

      {/* Edit panel */}
      {editing && (
        <div className="px-4 pb-4 pt-2 border-t border-[var(--color-border)] space-y-3 bg-white/50">
          {children}
        </div>
      )}
    </div>
  );
}

/* ── Summary card (for already-reviewed) ──────────────────────────────── */
function AlreadyReviewedBanner({
  reviewStatus, note, confirmedFitAt,
}: { reviewStatus: string; note: string | null; confirmedFitAt: string | null }) {
  const meta: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
    CONFIRMED: { label: "Confirmed Fit for Surgery", color: "text-emerald-800", bg: "bg-emerald-50 border-emerald-200", icon: CheckCircle2 },
    NOT_FIT: { label: "Not Fit for Surgery", color: "text-red-800", bg: "bg-red-50 border-red-200", icon: XCircle },
    DEFERRED: { label: "Surgery Deferred", color: "text-amber-800", bg: "bg-amber-50 border-amber-200", icon: Clock },
    ADDITIONAL_INVESTIGATIONS: { label: "Additional Investigations Required", color: "text-blue-800", bg: "bg-blue-50 border-blue-200", icon: FlaskConical },
    FIT_FOR_SURGERY: { label: "Fit for Surgery (Confirmation Pending)", color: "text-violet-800", bg: "bg-violet-50 border-violet-200", icon: CheckCircle2 },
    PENDING_REVIEW: { label: "Pending Doctor Review", color: "text-[var(--color-ink-700)]", bg: "bg-[var(--color-surface-sunken)] border-[var(--color-border)]", icon: Clock },
  };
  const m = meta[reviewStatus] ?? meta.PENDING_REVIEW;
  const Icon = m.icon;
  return (
    <div className={`rounded-xl border px-4 py-4 flex items-start gap-3 ${m.bg}`}>
      <Icon size={18} className={m.color} />
      <div>
        <p className={`text-sm font-bold ${m.color}`}>{m.label}</p>
        {confirmedFitAt && (
          <p className="text-xs text-[var(--color-ink-500)] mt-0.5">
            Confirmed on {format(new Date(confirmedFitAt), "d MMM yyyy 'at' h:mm a")}
          </p>
        )}
        {note && <p className="text-xs text-[var(--color-ink-600)] mt-1 italic">"{note}"</p>}
      </div>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */
export function DoctorReviewClient({
  udid, patient, counselling, schedule, diagnoses,
}: {
  udid: string;
  patient: PatientInfo;
  counselling: CounsellingInfo;
  schedule: ScheduleInfo;
  diagnoses: string[];
}) {
  const router = useRouter();
  const [pending, startTx] = useTransition();
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<"status" | "confirm" | "done">(
    counselling.reviewStatus === "FIT_FOR_SURGERY" ? "confirm" :
    counselling.reviewStatus === "CONFIRMED" ? "done" : "status"
  );

  /* ── Status selection state ──────────────────────────────────────────── */
  const [selectedStatus, setSelectedStatus] = useState<ReviewStatus | "">(
    (counselling.reviewStatus as ReviewStatus) ?? ""
  );
  const [reviewNote, setReviewNote] = useState(counselling.doctorReviewNote ?? "");

  /* ── Confirmation form state ─────────────────────────────────────────── */
  const plannedDate = new Date(counselling.surgeryDate);
  const defaultDate = plannedDate.toISOString().slice(0, 10);
  const defaultTime = schedule?.plannedTime ?? plannedDate.toTimeString().slice(0, 5);

  // Section edit toggles
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  // Section verified checkboxes
  const [verified, setVerified] = useState<Record<string, boolean>>({});

  function toggleEdit(key: string) {
    setEditing((prev) => ({ ...prev, [key]: !prev[key] }));
  }
  function toggleVerify(key: string) {
    setVerified((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const SECTIONS = ["payment", "surgery", "procedure", "anesthesia", "preop", "advance", "datetime"];
  const allVerified = SECTIONS.every((s) => verified[s]);

  // Editable confirmation fields
  const [paymentMode,    setPaymentMode]    = useState(counselling.paymentMode ?? "Cash");
  const [surgeryName,    setSurgeryName]    = useState(counselling.surgeryName ?? "");
  const [surgeryType,    setSurgeryType]    = useState(counselling.surgeryType ?? "Major");
  const [surgeryCategory,setSurgeryCategory]= useState(schedule?.surgeryCategory ?? "MAJOR");
  const [urgencyType,    setUrgencyType]    = useState(schedule?.urgencyType ?? "ELECTIVE");
  const [priority,       setPriority]       = useState(schedule?.priority ?? "ROUTINE");
  const [rightEye,       setRightEye]       = useState(counselling.rightEye);
  const [leftEye,        setLeftEye]        = useState(counselling.leftEye);
  const [procedure,      setProcedure]      = useState(schedule?.procedure ?? "");
  const [diagnosis,      setDiagnosis]      = useState(schedule?.diagnosis ?? diagnoses[0] ?? "");
  const [anaesthesiaType,setAnaesthesiaType]= useState(counselling.anaesthesiaType ?? "Topical");
  const [anesthetistName,setAnesthetistName]= useState(schedule?.anesthetistName ?? "");
  const [counselingDone,  setCounselingDone]  = useState(counselling.counselingDone);
  const [investigationDone,setInvestigationDone]= useState(counselling.investigationDone);
  const [consentReceived, setConsentReceived] = useState(schedule?.consentReceived ?? false);
  const [reportsUploaded, setReportsUploaded] = useState(schedule?.reportsUploaded ?? false);
  const [bloodArranged,   setBloodArranged]   = useState(schedule?.bloodArranged ?? false);
  const [advanceAmount,   setAdvanceAmount]   = useState(counselling.advanceAmount?.toString() ?? "");
  const [advanceReceipt,  setAdvanceReceipt]  = useState(counselling.advanceReceipt ?? "");
  const [surgeryDate,     setSurgeryDate]     = useState(defaultDate);
  const [surgeryTime,     setSurgeryTime]     = useState(defaultTime);
  const [otRoom,          setOtRoom]          = useState(schedule?.otRoom ?? "");
  const [estDuration,     setEstDuration]     = useState(schedule?.estimatedDuration?.toString() ?? "60");
  const [doctorNote,      setDoctorNote]      = useState(counselling.doctorReviewNote ?? "");

  /* ── Submit status decision ─────────────────────────────────────────── */
  function submitStatus() {
    if (!selectedStatus) return;
    setError("");
    startTx(async () => {
      const res = await setDoctorReviewStatus(counselling.id, udid, selectedStatus as ReviewStatus, reviewNote);
      if (res.error) { setError(res.error); return; }
      if (selectedStatus === "FIT_FOR_SURGERY") {
        setPhase("confirm");
      } else {
        setPhase("done");
      }
    });
  }

  /* ── Submit final confirmation ──────────────────────────────────────── */
  function submitConfirmation() {
    setError("");
    const input: ConfirmFitInput = {
      surgeryName, surgeryType, surgeryCategory, urgencyType, priority,
      rightEye, leftEye, procedure, diagnosis, anaesthesiaType, anesthetistName,
      counselingDone, investigationDone, consentReceived, reportsUploaded, bloodArranged,
      paymentMode, advanceAmount: advanceAmount ? parseFloat(advanceAmount) : null,
      advanceReceipt, surgeryDate, surgeryTime, otRoom,
      estimatedDuration: estDuration ? parseInt(estDuration) : null,
      doctorNote,
    };
    startTx(async () => {
      const res = await confirmFitForSurgery(counselling.id, udid, input);
      if (res.error) { setError(res.error); return; }
      setPhase("done");
      setTimeout(() => router.push(`/patients/${udid}`), 2500);
    });
  }

  const lateralityLabel = rightEye && leftEye ? "Both Eyes" : rightEye ? "Right Eye" : leftEye ? "Left Eye" : "—";

  /* ── DONE state ─────────────────────────────────────────────────────── */
  if (phase === "done" && counselling.reviewStatus !== "FIT_FOR_SURGERY") {
    const wasConfirm = selectedStatus === "FIT_FOR_SURGERY" || counselling.reviewStatus === "CONFIRMED";
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
        <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${wasConfirm ? "bg-emerald-100" : "bg-[var(--color-surface-sunken)]"}`}>
          {wasConfirm
            ? <CheckCircle2 size={32} className="text-emerald-600" />
            : <Check size={32} className="text-[var(--color-ink-500)]" />}
        </div>
        <h2 className="text-xl font-bold text-[var(--color-ink-900)]">
          {wasConfirm ? "Patient Confirmed Fit for Surgery" : "Decision Recorded"}
        </h2>
        <p className="text-sm text-[var(--color-ink-500)]">
          {wasConfirm
            ? "Hospital staff have been notified. The surgery schedule is now active."
            : "Hospital staff have been notified of your decision."}
        </p>
        <button
          onClick={() => router.push(`/patients/${udid}`)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary-600)] text-white text-sm font-semibold hover:bg-[var(--color-primary-700)] transition-colors mt-2"
        >
          Back to Patient <ArrowRight size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
      {/* Back + patient header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push(`/patients/${udid}`)}
          className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)] transition-colors"
        >
          <ChevronLeft size={16} /> Back
        </button>
        <div className="h-4 w-px bg-[var(--color-border)]" />
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
            <User size={13} className="text-violet-700" />
          </div>
          <span className="text-sm font-semibold text-[var(--color-ink-800)] truncate">{patient.name}</span>
          <span className="text-xs text-[var(--color-ink-400)] shrink-0">· {patient.uhid} · {patient.age}y/{SEX_SHORT[patient.sex] ?? patient.sex}</span>
        </div>
        <div className="ml-auto shrink-0">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-violet-100 text-violet-700">
            <Scissors size={11} /> Surgical Review
          </span>
        </div>
      </div>

      {/* Already reviewed & confirmed */}
      {counselling.reviewStatus === "CONFIRMED" && (
        <AlreadyReviewedBanner
          reviewStatus="CONFIRMED"
          note={counselling.doctorReviewNote}
          confirmedFitAt={counselling.confirmedFitAt}
        />
      )}

      {counselling.conflictFlag && (
        <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 mb-4">
          <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-500" />
          Schedule conflict detected on the planned date. Please verify OT availability.
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          PHASE 1 — Status selection
      ════════════════════════════════════════════════════════════════ */}
      {phase === "status" && (
        <>
          {/* Counselling summary card */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm mb-6 overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--color-border)] bg-gradient-to-r from-violet-50 to-transparent">
              <p className="text-[11px] font-bold uppercase tracking-widest text-violet-500 mb-0.5">Counselling Summary</p>
              <p className="text-base font-bold text-[var(--color-ink-900)]">
                {counselling.surgeryName ?? counselling.surgeryType}
              </p>
            </div>
            <div className="px-5 py-1">
              <InfoRow label="Eye / Laterality" value={lateralityLabel} />
              <InfoRow label="Anesthesia" value={counselling.anaesthesiaType} />
              <InfoRow label="Payment Mode" value={counselling.paymentMode} />
              {counselling.paymentNotes && <InfoRow label="Payment Details" value={counselling.paymentNotes} />}
              <InfoRow label="Counseling Done" value={counselling.counselingDone ? "Yes" : "No"} />
              <InfoRow label="Investigation Done" value={counselling.investigationDone ? "Yes" : "No"} />
              {counselling.advanceAmount && (
                <InfoRow label="Advance Paid" value={`₹${counselling.advanceAmount.toLocaleString("en-IN")}`} />
              )}
              <InfoRow
                label="Planned Date"
                value={format(new Date(counselling.surgeryDate), "d MMM yyyy 'at' h:mm a")}
              />
              {schedule?.otRoom && <InfoRow label="OT Room" value={schedule.otRoom} />}
              {schedule?.estimatedDuration && (
                <InfoRow label="Est. Duration" value={`${schedule.estimatedDuration} min`} />
              )}
              {counselling.counsellingNotes && (
                <InfoRow label="Hospital Notes" value={counselling.counsellingNotes} />
              )}
            </div>
          </div>

          {/* Decision */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--color-border)]">
              <p className="text-sm font-bold text-[var(--color-ink-900)]">Your Decision</p>
              <p className="text-xs text-[var(--color-ink-500)] mt-0.5">Select one of the following outcomes for this patient</p>
            </div>
            <div className="px-5 py-4 space-y-2.5">
              {REVIEW_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = selectedStatus === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedStatus(opt.id)}
                    className={`w-full flex items-start gap-3 px-4 py-3.5 rounded-xl border text-left transition-all ${
                      active ? opt.activeBg : `${opt.bg} hover:opacity-90`
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center ${active ? "border-white" : opt.color.replace("text-", "border-")}`}>
                      {active && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Icon size={14} className={active ? "text-white" : opt.color} />
                        <p className={`text-sm font-bold ${active ? "text-white" : opt.color.replace("-600", "-800").replace("-500", "-700")}`}>
                          {opt.label}
                        </p>
                      </div>
                      <p className={`text-xs mt-0.5 ${active ? "text-white/80" : "text-[var(--color-ink-500)]"}`}>
                        {opt.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Doctor note */}
            <div className="px-5 pb-4">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-400)] mb-1.5">
                Clinical Notes / Instructions {selectedStatus !== "FIT_FOR_SURGERY" ? "(required for non-fit decisions)" : "(optional)"}
              </label>
              <textarea
                rows={3}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder={
                  selectedStatus === "NOT_FIT" ? "Reason why patient is not fit for surgery…" :
                  selectedStatus === "DEFERRED" ? "Reason for deferral, suggested new date…" :
                  selectedStatus === "ADDITIONAL_INVESTIGATIONS" ? "Specify which investigations are needed…" :
                  "Any notes for the hospital team…"
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
              />
            </div>

            {error && (
              <div className="mx-5 mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">{error}</div>
            )}

            {/* Footer */}
            <div className="px-5 py-4 border-t border-[var(--color-border)] flex items-center justify-between">
              <button
                onClick={() => router.push(`/patients/${udid}`)}
                className="px-4 py-2 rounded-xl border border-[var(--color-border)] text-sm font-medium text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitStatus}
                disabled={!selectedStatus || pending || (selectedStatus !== "FIT_FOR_SURGERY" && !reviewNote.trim())}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pending && (
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
                {selectedStatus === "FIT_FOR_SURGERY" ? "Continue to Confirmation →" : "Submit Decision"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════
          PHASE 2 — Confirmation counselling form
      ════════════════════════════════════════════════════════════════ */}
      {phase === "confirm" && (
        <>
          {/* Header banner */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 mb-5 flex items-start gap-3">
            <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-emerald-800">Confirmation Counselling Form</p>
              <p className="text-xs text-emerald-700 mt-0.5">
                Review and verify each section. You may edit any field before confirming. All sections must be checked before final confirmation.
              </p>
            </div>
          </div>

          {/* Progress indicator */}
          <div className="flex items-center gap-2 mb-4">
            <div className="flex-1 bg-[var(--color-border)] rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${(SECTIONS.filter((s) => verified[s]).length / SECTIONS.length) * 100}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-emerald-700 shrink-0">
              {SECTIONS.filter((s) => verified[s]).length} / {SECTIONS.length} verified
            </span>
          </div>

          <div className="space-y-3">

            {/* ── Section 1: Patient Details (read-only, auto-pass) ─────── */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-4 py-3 flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                <Check size={11} className="text-white" strokeWidth={3} />
              </div>
              <User size={13} className="text-emerald-600" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-emerald-800">Patient Details</p>
                <p className="text-xs text-[var(--color-ink-500)]">
                  {patient.name} · {patient.uhid} · {patient.age}y / {SEX_SHORT[patient.sex] ?? patient.sex}
                </p>
              </div>
              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded">Auto-verified</span>
            </div>

            {/* ── Section 2: Payment ─────────────────────────────────────── */}
            <VerifySection
              icon={CreditCard}
              title="Payment & Insurance"
              summary={[counselling.paymentMode, counselling.paymentNotes].filter(Boolean).join(" · ") || "Not specified"}
              verified={!!verified.payment}
              onVerify={() => toggleVerify("payment")}
              editing={!!editing.payment}
              onEditToggle={() => toggleEdit("payment")}
            >
              <Field label="Payment Mode">
                <div className="flex flex-wrap gap-1.5">
                  {["Cash", "Insurance", "Government Scheme", "Camp", "Other"].map((m) => (
                    <Chip key={m} label={m} selected={paymentMode === m} onClick={() => setPaymentMode(m)} />
                  ))}
                </div>
              </Field>
            </VerifySection>

            {/* ── Section 3: Surgery Type ───────────────────────────────── */}
            <VerifySection
              icon={Activity}
              title="Surgery Type"
              summary={`${surgeryName || counselling.surgeryType} · ${surgeryType} · ${urgencyType}`}
              verified={!!verified.surgery}
              onVerify={() => toggleVerify("surgery")}
              editing={!!editing.surgery}
              onEditToggle={() => toggleEdit("surgery")}
            >
              <Field label="Name of Surgery">
                <input
                  type="text"
                  value={surgeryName}
                  onChange={(e) => setSurgeryName(e.target.value)}
                  list="surgery-names"
                  placeholder="Surgery name…"
                  className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
                <datalist id="surgery-names">
                  {SURGERY_NAME_OPTIONS.map((n) => <option key={n} value={n} />)}
                </datalist>
              </Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Type">
                  <div className="flex flex-col gap-1">
                    {["Minor", "Major"].map((t) => (
                      <Chip key={t} label={t} selected={surgeryType === t} onClick={() => { setSurgeryType(t); setSurgeryCategory(t === "Major" ? "MAJOR" : "MINOR"); }} />
                    ))}
                  </div>
                </Field>
                <Field label="Urgency">
                  <div className="flex flex-col gap-1">
                    {["Elective", "Emergency"].map((u) => (
                      <Chip key={u} label={u} selected={urgencyType === u.toUpperCase()} onClick={() => setUrgencyType(u.toUpperCase())} />
                    ))}
                  </div>
                </Field>
                <Field label="Priority">
                  <div className="flex flex-col gap-1">
                    {["Routine", "Urgent", "Emergency"].map((p) => (
                      <Chip key={p} label={p} selected={priority === p.toUpperCase()} onClick={() => setPriority(p.toUpperCase())} />
                    ))}
                  </div>
                </Field>
              </div>
            </VerifySection>

            {/* ── Section 4: Procedure & Laterality ────────────────────── */}
            <VerifySection
              icon={Eye}
              title="Procedure & Laterality"
              summary={`${lateralityLabel} · ${diagnosis || "—"}`}
              verified={!!verified.procedure}
              onVerify={() => toggleVerify("procedure")}
              editing={!!editing.procedure}
              onEditToggle={() => toggleEdit("procedure")}
            >
              <Field label="Eye / Laterality">
                <div className="flex gap-2">
                  {[
                    { label: "Right Eye", re: true,  le: false },
                    { label: "Left Eye",  re: false, le: true  },
                    { label: "Both Eyes", re: true,  le: true  },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => { setRightEye(opt.re); setLeftEye(opt.le); }}
                      className={`flex-1 py-2 rounded-lg border text-xs font-semibold transition-all ${
                        rightEye === opt.re && leftEye === opt.le
                          ? "bg-violet-600 text-white border-violet-600"
                          : "border-[var(--color-border)] text-[var(--color-ink-600)]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Diagnosis">
                <FInput value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="Primary diagnosis…" />
              </Field>
              <Field label="Procedure Notes">
                <textarea
                  rows={2}
                  value={procedure}
                  onChange={(e) => setProcedure(e.target.value)}
                  placeholder="Procedure details…"
                  className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
                />
              </Field>
            </VerifySection>

            {/* ── Section 5: Anesthesia ──────────────────────────────────── */}
            <VerifySection
              icon={Zap}
              title="Anesthesia"
              summary={`${anaesthesiaType}${anesthetistName ? " · Dr. " + anesthetistName : ""}`}
              verified={!!verified.anesthesia}
              onVerify={() => toggleVerify("anesthesia")}
              editing={!!editing.anesthesia}
              onEditToggle={() => toggleEdit("anesthesia")}
            >
              <Field label="Type of Anesthesia">
                <div className="flex flex-wrap gap-1.5">
                  {ANAESTHESIA_TYPES.map((a) => (
                    <Chip key={a} label={a} selected={anaesthesiaType === a} onClick={() => setAnaesthesiaType(a)} />
                  ))}
                </div>
              </Field>
              <Field label="Anesthetist Name">
                <FInput value={anesthetistName} onChange={(e) => setAnesthetistName(e.target.value)} placeholder="Dr. Name (optional)" />
              </Field>
            </VerifySection>

            {/* ── Section 6: Pre-op Checks ───────────────────────────────── */}
            <VerifySection
              icon={ShieldCheck}
              title="Pre-operative Checks"
              summary={[
                counselingDone && "Counseled",
                investigationDone && "Investigated",
                consentReceived && "Consent",
                reportsUploaded && "Reports",
                bloodArranged && "Blood",
              ].filter(Boolean).join(" · ") || "None confirmed"}
              verified={!!verified.preop}
              onVerify={() => toggleVerify("preop")}
              editing={!!editing.preop}
              onEditToggle={() => toggleEdit("preop")}
            >
              <div className="rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)] px-3">
                <Toggle label="Counseling Done" value={counselingDone} onChange={setCounselingDone} />
                <Toggle label="Investigation Done" value={investigationDone} onChange={setInvestigationDone} />
                <Toggle label="Consent Received" value={consentReceived} onChange={setConsentReceived} />
                <Toggle label="Reports Uploaded" value={reportsUploaded} onChange={setReportsUploaded} />
                <Toggle label="Blood Arranged" value={bloodArranged} onChange={setBloodArranged} />
              </div>
            </VerifySection>

            {/* ── Section 7: Advance Payment ────────────────────────────── */}
            <VerifySection
              icon={Banknote}
              title="Advance Payment"
              summary={counselling.advanceAmount ? `₹${counselling.advanceAmount.toLocaleString("en-IN")} · ${counselling.advanceReceipt ?? ""}` : "No advance recorded"}
              verified={!!verified.advance}
              onVerify={() => toggleVerify("advance")}
              editing={!!editing.advance}
              onEditToggle={() => toggleEdit("advance")}
            >
              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount (₹)">
                  <FInput type="number" min="0" value={advanceAmount} onChange={(e) => setAdvanceAmount(e.target.value)} placeholder="0.00" />
                </Field>
                <Field label="Receipt / UTR">
                  <FInput value={advanceReceipt} onChange={(e) => setAdvanceReceipt(e.target.value)} placeholder="Receipt number" />
                </Field>
              </div>
            </VerifySection>

            {/* ── Section 8: Date & Time ─────────────────────────────────── */}
            <VerifySection
              icon={CalendarClock}
              title="Surgery Date & Time"
              summary={`${format(new Date(`${surgeryDate}T${surgeryTime}`), "d MMM yyyy · h:mm a")}${otRoom ? " · " + otRoom : ""}`}
              verified={!!verified.datetime}
              onVerify={() => toggleVerify("datetime")}
              editing={!!editing.datetime}
              onEditToggle={() => toggleEdit("datetime")}
            >
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date">
                  <FInput type="date" value={surgeryDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setSurgeryDate(e.target.value)} />
                </Field>
                <Field label="Time">
                  <FInput type="time" value={surgeryTime} onChange={(e) => setSurgeryTime(e.target.value)} />
                </Field>
                <Field label="OT Room">
                  <FInput value={otRoom} onChange={(e) => setOtRoom(e.target.value)} placeholder="e.g. OT-1" />
                </Field>
                <Field label="Duration (min)">
                  <FInput type="number" min="10" step="5" value={estDuration} onChange={(e) => setEstDuration(e.target.value)} placeholder="60" />
                </Field>
              </div>
            </VerifySection>

            {/* ── Doctor note for confirmation ───────────────────────────── */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-400)] mb-2">
                Doctor's Confirmation Note (optional)
              </label>
              <textarea
                rows={2}
                value={doctorNote}
                onChange={(e) => setDoctorNote(e.target.value)}
                placeholder="Any final instructions or remarks before confirmation…"
                className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
              />
            </div>
          </div>

          {/* All verified banner */}
          {allVerified && (
            <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              All sections verified. You can now confirm this patient as Fit for Surgery.
            </div>
          )}

          {error && (
            <div className="mt-3 rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">{error}</div>
          )}

          {/* Sticky footer */}
          <div className="fixed bottom-0 left-0 right-0 z-30 px-4 pb-4 pt-3 bg-[var(--color-surface)] border-t border-[var(--color-border)] shadow-xl sm:static sm:bg-transparent sm:border-0 sm:shadow-none sm:mt-5 sm:px-0 sm:pb-0">
            <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
              <button
                onClick={() => setPhase("status")}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-sm font-medium text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] transition-colors"
              >
                <ChevronLeft size={14} /> Back
              </button>
              <div className="flex-1 text-center hidden sm:block">
                <p className="text-xs text-[var(--color-ink-400)]">
                  {SECTIONS.filter((s) => verified[s]).length} of {SECTIONS.length} sections verified
                </p>
              </div>
              <button
                onClick={submitConfirmation}
                disabled={!allVerified || pending}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {pending ? (
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                ) : <CheckCircle2 size={15} />}
                {pending ? "Confirming…" : "Confirm Fit for Surgery"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
