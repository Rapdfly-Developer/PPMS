"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft, ArrowRight, Check, Scissors, User, CreditCard,
  Activity, Eye, Zap, ShieldCheck, Banknote, CalendarClock,
  ClipboardCheck, ChevronDown, AlertTriangle, CheckCircle2,
  Clock, Building2, ChevronLeft,
} from "lucide-react";
import { completeSurgicalCounselling, type SurgicalCounsellingInput } from "./actions";

/* ── Constants ─────────────────────────────────────────────────────────── */
const SURGERY_NAME_OPTIONS = [
  "Phacoemulsification with IOL Implantation",
  "Manual Small Incision Cataract Surgery (MSICS)",
  "Extracapsular Cataract Extraction (ECCE)",
  "Intracapsular Cataract Extraction (ICCE)",
  "Trabeculectomy",
  "Ahmed Glaucoma Valve Implantation",
  "Baerveldt Glaucoma Implant",
  "Pars Plana Vitrectomy (PPV)",
  "Scleral Buckle",
  "Retinal Detachment Surgery",
  "Intravitreal Injection",
  "Laser Photocoagulation",
  "Penetrating Keratoplasty (PKP)",
  "Deep Anterior Lamellar Keratoplasty (DALK)",
  "Descemet Membrane Endothelial Keratoplasty (DMEK)",
  "Descemet Stripping Automated Endothelial Keratoplasty (DSAEK)",
  "Pterygium Excision with Conjunctival Autograft",
  "Dacryocystorhinostomy (DCR)",
  "Squint Surgery",
  "Entropion Correction",
  "Ectropion Correction",
  "Lid Repair",
  "Orbital Decompression",
  "Enucleation / Evisceration",
];

const ANAESTHESIA_TYPES = ["Topical", "Local", "Peribulbar", "Retrobulbar", "General", "Sedation"];
const SURGERY_TYPES     = ["Minor", "Major"];
const URGENCY_TYPES     = ["Elective", "Emergency"];
const PRIORITY_TYPES    = ["Routine", "Urgent", "Emergency"];
const PAYMENT_MODES     = ["Cash", "Insurance", "Government Scheme", "Camp", "Other"];
const ADVANCE_MODES     = ["Cash", "Card / Swipe", "UPI", "NEFT / RTGS", "Cheque"];
const GOVT_SCHEMES      = [
  "Ayushman Bharat (PMJAY)", "CGHS", "ECHS", "ESI", "State Government Scheme",
  "Chief Minister's Health Scheme", "Rashtriya Swasthya Bima Yojana (RSBY)",
];
const INSURANCE_PROVIDERS = [
  "Star Health Insurance", "New India Assurance", "National Insurance",
  "United India Insurance", "Oriental Insurance", "HDFC ERGO", "ICICI Lombard",
  "Bajaj Allianz", "Reliance General", "Tata AIG", "Care Health Insurance",
  "Niva Bupa", "SBI General", "Corporate / TPA",
];

const STEPS = [
  { id: 1, label: "Payment",    icon: CreditCard },
  { id: 2, label: "Surgery",    icon: Activity },
  { id: 3, label: "Procedure",  icon: Eye },
  { id: 4, label: "Anesthesia", icon: Zap },
  { id: 5, label: "Fit Check",  icon: ShieldCheck },
  { id: 6, label: "Advance",    icon: Banknote },
  { id: 7, label: "Date & OT",  icon: CalendarClock },
  { id: 8, label: "Confirm",    icon: ClipboardCheck },
];

/* ── Helpers ──────────────────────────────────────────────────────────── */
type Counselling = {
  id: string;
  surgeryName: string | null;
  surgeryType: string;
  rightEye: boolean;
  leftEye: boolean;
  anaesthesiaType: string;
  surgeryDate: string;
  conflictFlag: boolean;
  insuranceType: string | null;
  counselingDone: boolean;
  investigationDone: boolean;
  fitForSurgery: boolean | null;
  advanceAmount: number | null;
  advanceReceipt: string | null;
  counsellingNotes: string | null;
  paymentNotes: string | null;
};

function Chip({
  label, selected, onClick,
}: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
        selected
          ? "bg-violet-600 text-white border-violet-600 shadow-sm"
          : "border-[var(--color-border)] text-[var(--color-ink-600)] hover:border-violet-300 hover:text-violet-700"
      }`}
    >
      {label}
    </button>
  );
}

function Field({ label, children, note }: { label: string; children: React.ReactNode; note?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--color-ink-400)]">{label}</label>
      {children}
      {note && <p className="text-[11px] text-[var(--color-ink-400)]">{note}</p>}
    </div>
  );
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-ink-800)] focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent placeholder:text-[var(--color-ink-300)] disabled:opacity-50 ${props.className ?? ""}`}
    />
  );
}

function Textarea({ ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-ink-800)] focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent placeholder:text-[var(--color-ink-300)] resize-none"
    />
  );
}

function Toggle({
  label, value, onChange, description,
}: { label: string; value: boolean; onChange: (v: boolean) => void; description?: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[var(--color-border)] last:border-0">
      <div>
        <p className="text-sm font-medium text-[var(--color-ink-800)]">{label}</p>
        {description && <p className="text-[11px] text-[var(--color-ink-400)] mt-0.5">{description}</p>}
      </div>
      <div className="flex rounded-xl overflow-hidden border border-[var(--color-border)] shrink-0 ml-3">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`px-4 py-1.5 text-sm font-semibold transition-colors ${
            value ? "bg-emerald-500 text-white" : "text-[var(--color-ink-400)] hover:bg-[var(--color-surface-sunken)]"
          }`}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`px-4 py-1.5 text-sm font-semibold transition-colors ${
            !value ? "bg-red-500 text-white" : "text-[var(--color-ink-400)] hover:bg-[var(--color-surface-sunken)]"
          }`}
        >
          No
        </button>
      </div>
    </div>
  );
}

function SearchCombobox({
  value, onChange, options, placeholder,
}: { value: string; onChange: (v: string) => void; options: string[]; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { setQuery(value); }, [value]);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  const filtered = options.filter((o) => o.toLowerCase().includes(query.toLowerCase()));
  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          placeholder={placeholder ?? "Search or type…"}
          className="w-full px-3.5 py-2.5 pr-9 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
          onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] pointer-events-none" />
      </div>
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl overflow-hidden max-h-52 overflow-y-auto">
          {filtered.map((opt) => (
            <li key={opt}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onChange(opt); setQuery(opt); setOpen(false); }}
                className={`w-full text-left px-3.5 py-2 text-sm transition-colors hover:bg-violet-50 hover:text-violet-700 ${value === opt ? "bg-violet-50 text-violet-700 font-semibold" : "text-[var(--color-ink-700)]"}`}
              >
                {opt}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── Review row for final confirmation ──────────────────────────────────── */
function ReviewRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-[var(--color-border)] last:border-0">
      <span className="text-xs text-[var(--color-ink-400)] w-40 shrink-0 mt-0.5">{label}</span>
      <span className="text-sm font-medium text-[var(--color-ink-800)] flex-1">{value || <span className="text-[var(--color-ink-300)]">—</span>}</span>
    </div>
  );
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
      <div className="px-4 py-2.5 bg-[var(--color-surface-sunken)] border-b border-[var(--color-border)]">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-400)]">{title}</p>
      </div>
      <div className="px-4">{children}</div>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */
export function SurgicalCounsellingForm({
  udid, patientName, patientUhid, patientAge, patientSex,
  counselling, diagnoses,
}: {
  udid: string;
  patientName: string;
  patientUhid: string;
  patientAge: number;
  patientSex: string;
  counselling: Counselling;
  diagnoses: string[];
}) {
  const router = useRouter();
  const [step, setStep]       = useState(1);
  const [pending, startTx]    = useTransition();
  const [error, setError]     = useState("");
  const [submitted, setSubmitted] = useState(false);

  const plannedDate = new Date(counselling.surgeryDate);
  const defaultDate = plannedDate.toISOString().slice(0, 10);
  const defaultTime = plannedDate.toTimeString().slice(0, 5);

  /* ── Form state ──────────────────────────────────────────────────────── */
  // Step 1 – Payment
  const [paymentMode,        setPaymentMode]        = useState(counselling.insuranceType ?? "Cash");
  const [insuranceProvider,  setInsuranceProvider]  = useState("");
  const [policyNumber,       setPolicyNumber]       = useState("");
  const [preAuthNumber,      setPreAuthNumber]      = useState("");
  const [govtScheme,         setGovtScheme]         = useState("");
  const [beneficiaryId,      setBeneficiaryId]      = useState("");
  const [campName,           setCampName]           = useState("");
  const [campOrganizer,      setCampOrganizer]      = useState("");
  const [campRef,            setCampRef]            = useState("");
  const [otherPaymentNote,   setOtherPaymentNote]   = useState("");

  // Step 2 – Surgery
  const [surgeryName,    setSurgeryName]    = useState(counselling.surgeryName ?? "");
  const [surgeryType,    setSurgeryType]    = useState(counselling.surgeryType ?? "Major");
  const [surgeryCategory,setSurgeryCategory]= useState("MAJOR");
  const [urgencyType,    setUrgencyType]    = useState("ELECTIVE");
  const [priority,       setPriority]       = useState("ROUTINE");

  // Step 3 – Procedure & Laterality
  const [rightEye,   setRightEye]   = useState(counselling.rightEye);
  const [leftEye,    setLeftEye]    = useState(counselling.leftEye);
  const [procedure,  setProcedure]  = useState("");
  const [diagnosis,  setDiagnosis]  = useState(diagnoses[0] ?? "");

  // Step 4 – Anesthesia
  const [anaesthesiaType, setAnaesthesiaType] = useState(counselling.anaesthesiaType ?? "Topical");
  const [anesthetistName, setAnesthetistName] = useState("");

  // Step 5 – Fit for Surgery
  const [counselingDone,    setCounselingDone]    = useState(counselling.counselingDone);
  const [investigationDone, setInvestigationDone] = useState(counselling.investigationDone);
  const [consentReceived,   setConsentReceived]   = useState(false);
  const [reportsUploaded,   setReportsUploaded]   = useState(false);
  const [bloodArranged,     setBloodArranged]     = useState(false);
  const [counsellingNotes,  setCounsellingNotes]  = useState(counselling.counsellingNotes ?? "");

  // Step 6 – Advance Payment
  const [advanceAmount,  setAdvanceAmount]  = useState(counselling.advanceAmount?.toString() ?? "");
  const [advanceReceipt, setAdvanceReceipt] = useState("");
  const [advanceMode,    setAdvanceMode]    = useState("Cash");

  // Step 7 – Surgery Date & Time
  const [surgeryDate, setSurgeryDate] = useState(defaultDate);
  const [surgeryTime, setSurgeryTime] = useState(defaultTime || "09:00");
  const [otRoom,      setOtRoom]      = useState("");
  const [estDuration, setEstDuration] = useState("60");

  /* ── Derived ─────────────────────────────────────────────────────────── */
  const fitForSurgery = counselingDone && investigationDone && consentReceived;

  function buildPaymentNotes(): string {
    switch (paymentMode) {
      case "Insurance":       return [insuranceProvider, policyNumber && `Policy: ${policyNumber}`, preAuthNumber && `Pre-auth: ${preAuthNumber}`].filter(Boolean).join(" | ");
      case "Government Scheme": return [govtScheme, beneficiaryId && `ID: ${beneficiaryId}`].filter(Boolean).join(" | ");
      case "Camp":            return [campName, campOrganizer && `By: ${campOrganizer}`, campRef && `Ref: ${campRef}`].filter(Boolean).join(" | ");
      case "Other":           return otherPaymentNote;
      default:                return "";
    }
  }

  /* ── Navigation ─────────────────────────────────────────────────────── */
  function next() { if (step < 8) setStep(step + 1); }
  function back() { if (step > 1) setStep(step - 1); else router.push(`/patients/${udid}`); }

  /* ── Submit ─────────────────────────────────────────────────────────── */
  function submit() {
    setError("");
    const input: SurgicalCounsellingInput = {
      paymentMode,
      paymentNotes: buildPaymentNotes(),
      surgeryName,
      surgeryType,
      surgeryCategory,
      urgencyType,
      priority,
      rightEye,
      leftEye,
      procedure,
      diagnosis,
      anaesthesiaType,
      anesthetistName,
      counselingDone,
      investigationDone,
      consentReceived,
      reportsUploaded,
      bloodArranged,
      counsellingNotes,
      advanceAmount: advanceAmount ? parseFloat(advanceAmount) : null,
      advanceReceipt,
      advanceMode,
      surgeryDate,
      surgeryTime,
      otRoom,
      estimatedDuration: estDuration ? parseInt(estDuration) : null,
    };
    startTx(async () => {
      const res = await completeSurgicalCounselling(counselling.id, udid, input);
      if (res.error) {
        setError(res.error);
      } else {
        setSubmitted(true);
        setTimeout(() => router.push(`/patients/${udid}`), 2000);
      }
    });
  }

  /* ── Success state ─────────────────────────────────────────────────── */
  if (submitted) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-5 text-center px-6">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
          <CheckCircle2 size={32} className="text-emerald-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[var(--color-ink-900)]">Counselling Complete</h2>
          <p className="text-sm text-[var(--color-ink-500)] mt-1">
            {fitForSurgery
              ? "Patient is fit for surgery. Doctor has been notified."
              : "Counselling details saved successfully."}
          </p>
        </div>
        <p className="text-xs text-[var(--color-ink-400)]">Returning to patient profile…</p>
      </div>
    );
  }

  /* ── Progress bar ─────────────────────────────────────────────────── */
  const StepBar = () => (
    <div className="w-full mb-8">
      {/* Mobile: step X of 8 */}
      <div className="sm:hidden flex items-center gap-2 mb-4">
        <div className="flex-1 bg-[var(--color-border)] rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-violet-600 rounded-full transition-all duration-300"
            style={{ width: `${(step / 8) * 100}%` }}
          />
        </div>
        <span className="text-xs font-semibold text-violet-700 shrink-0">
          {step} / 8 — {STEPS[step - 1].label}
        </span>
      </div>

      {/* Desktop: full step row */}
      <div className="hidden sm:flex items-center gap-0">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done    = step > s.id;
          const current = step === s.id;
          return (
            <div key={s.id} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center shrink-0">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${
                    done    ? "bg-violet-600 text-white" :
                    current ? "bg-violet-600 text-white ring-4 ring-violet-200" :
                              "bg-[var(--color-surface-sunken)] border border-[var(--color-border)] text-[var(--color-ink-400)]"
                  }`}
                >
                  {done ? <Check size={13} /> : <Icon size={13} />}
                </div>
                <span className={`text-[10px] mt-1 font-semibold leading-none text-center ${current ? "text-violet-700" : done ? "text-violet-500" : "text-[var(--color-ink-400)]"}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-px flex-1 mx-1 mt-[-10px] transition-colors ${done ? "bg-violet-400" : "bg-[var(--color-border)]"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  /* ── Step title ──────────────────────────────────────────────────────── */
  const STEP_TITLES = [
    "Payment & Insurance Details",
    "Surgery Type",
    "Procedure & Laterality",
    "Anesthesia",
    "Fit for Surgery",
    "Advance Payment",
    "Surgery Date & Time",
    "Final Confirmation",
  ];
  const STEP_SUBTITLES = [
    "How will the surgery be funded?",
    "What procedure is planned?",
    "Which eye(s) and what procedure?",
    "Anesthesia plan for the surgery",
    "Pre-operative readiness checklist",
    "Collect and record advance payment",
    "Schedule the operation theatre",
    "Review all details before submitting",
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
      {/* Back + patient header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={back}
          className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)] transition-colors"
        >
          <ChevronLeft size={16} /> Back
        </button>
        <div className="h-4 w-px bg-[var(--color-border)]" />
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
            <User size={13} className="text-violet-700" />
          </div>
          <span className="text-sm font-semibold text-[var(--color-ink-800)] truncate">{patientName}</span>
          <span className="text-xs text-[var(--color-ink-400)] shrink-0">· {patientUhid}</span>
        </div>
        <div className="ml-auto shrink-0">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-violet-100 text-violet-700">
            <Scissors size={11} /> Surgical Counselling
          </span>
        </div>
      </div>

      {/* Progress */}
      <StepBar />

      {/* Step card */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm overflow-hidden">
        {/* Card header */}
        <div className="px-6 py-5 border-b border-[var(--color-border)] bg-gradient-to-r from-violet-50 to-transparent">
          <p className="text-[11px] font-bold uppercase tracking-widest text-violet-500 mb-1">Step {step} of 8</p>
          <h2 className="text-lg font-bold text-[var(--color-ink-900)]">{STEP_TITLES[step - 1]}</h2>
          <p className="text-sm text-[var(--color-ink-500)] mt-0.5">{STEP_SUBTITLES[step - 1]}</p>
        </div>

        {/* Card body */}
        <div className="px-6 py-6 space-y-5">

          {/* ── Step 1: Payment ───────────────────────────────────────────── */}
          {step === 1 && (
            <>
              <Field label="Payment Mode">
                <div className="flex flex-wrap gap-2">
                  {PAYMENT_MODES.map((m) => (
                    <Chip key={m} label={m} selected={paymentMode === m} onClick={() => setPaymentMode(m)} />
                  ))}
                </div>
              </Field>

              {paymentMode === "Insurance" && (
                <div className="space-y-4 rounded-xl border border-[var(--color-border)] p-4 bg-blue-50/40">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Insurance Details</p>
                  <Field label="Insurance Provider">
                    <SearchCombobox value={insuranceProvider} onChange={setInsuranceProvider} options={INSURANCE_PROVIDERS} placeholder="Select or type provider…" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Policy Number">
                      <Input value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} placeholder="Policy / Member ID" />
                    </Field>
                    <Field label="Pre-auth Number">
                      <Input value={preAuthNumber} onChange={(e) => setPreAuthNumber(e.target.value)} placeholder="Pre-authorisation ref." />
                    </Field>
                  </div>
                </div>
              )}

              {paymentMode === "Government Scheme" && (
                <div className="space-y-4 rounded-xl border border-[var(--color-border)] p-4 bg-emerald-50/40">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">Government Scheme Details</p>
                  <Field label="Scheme Name">
                    <SearchCombobox value={govtScheme} onChange={setGovtScheme} options={GOVT_SCHEMES} placeholder="Select scheme…" />
                  </Field>
                  <Field label="Beneficiary / Card Number">
                    <Input value={beneficiaryId} onChange={(e) => setBeneficiaryId(e.target.value)} placeholder="Aadhaar / Card / Beneficiary ID" />
                  </Field>
                </div>
              )}

              {paymentMode === "Camp" && (
                <div className="space-y-4 rounded-xl border border-[var(--color-border)] p-4 bg-amber-50/40">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">Camp Details</p>
                  <Field label="Camp Name">
                    <Input value={campName} onChange={(e) => setCampName(e.target.value)} placeholder="e.g. Lions Club Eye Camp" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Organizer">
                      <Input value={campOrganizer} onChange={(e) => setCampOrganizer(e.target.value)} placeholder="Organized by…" />
                    </Field>
                    <Field label="Camp Reference">
                      <Input value={campRef} onChange={(e) => setCampRef(e.target.value)} placeholder="Reference / Coupon number" />
                    </Field>
                  </div>
                </div>
              )}

              {paymentMode === "Other" && (
                <Field label="Payment Description">
                  <Textarea rows={3} value={otherPaymentNote} onChange={(e) => setOtherPaymentNote(e.target.value)} placeholder="Describe the payment arrangement…" />
                </Field>
              )}
            </>
          )}

          {/* ── Step 2: Surgery Type ──────────────────────────────────────── */}
          {step === 2 && (
            <>
              <Field label="Name of Surgery">
                <SearchCombobox value={surgeryName} onChange={setSurgeryName} options={SURGERY_NAME_OPTIONS} placeholder="Search surgery name or type custom…" />
              </Field>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Surgery Type">
                  <div className="flex flex-col gap-2">
                    {SURGERY_TYPES.map((t) => (
                      <Chip key={t} label={t} selected={surgeryType === t} onClick={() => { setSurgeryType(t); setSurgeryCategory(t === "Major" ? "MAJOR" : "MINOR"); }} />
                    ))}
                  </div>
                </Field>
                <Field label="Urgency">
                  <div className="flex flex-col gap-2">
                    {URGENCY_TYPES.map((u) => (
                      <Chip key={u} label={u} selected={urgencyType === u.toUpperCase()} onClick={() => setUrgencyType(u.toUpperCase())} />
                    ))}
                  </div>
                </Field>
                <Field label="Priority">
                  <div className="flex flex-col gap-2">
                    {PRIORITY_TYPES.map((p) => (
                      <Chip key={p} label={p} selected={priority === p.toUpperCase()} onClick={() => setPriority(p.toUpperCase())} />
                    ))}
                  </div>
                </Field>
              </div>
              {counselling.conflictFlag && (
                <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-500" />
                  Doctor has other appointments on the planned date. Please verify availability before finalising.
                </div>
              )}
            </>
          )}

          {/* ── Step 3: Procedure & Laterality ───────────────────────────── */}
          {step === 3 && (
            <>
              <Field label="Eye / Laterality">
                <div className="flex gap-3">
                  {[
                    { key: "right", label: "Right Eye",  re: true,  le: false },
                    { key: "left",  label: "Left Eye",   re: false, le: true  },
                    { key: "both",  label: "Both Eyes",  re: true,  le: true  },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => { setRightEye(opt.re); setLeftEye(opt.le); }}
                      className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-all ${
                        rightEye === opt.re && leftEye === opt.le
                          ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                          : "border-[var(--color-border)] text-[var(--color-ink-600)] hover:border-violet-300"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Primary Diagnosis">
                {diagnoses.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {diagnoses.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDiagnosis(d)}
                        className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                          diagnosis === d
                            ? "bg-violet-600 text-white border-violet-600"
                            : "border-[var(--color-border)] text-[var(--color-ink-600)] hover:border-violet-300"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                ) : null}
                <Input
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="Enter or confirm diagnosis…"
                  className="mt-2"
                />
              </Field>
              <Field label="Procedure Details">
                <Textarea
                  rows={3}
                  value={procedure}
                  onChange={(e) => setProcedure(e.target.value)}
                  placeholder="Describe the planned procedure steps, special notes…"
                />
              </Field>
            </>
          )}

          {/* ── Step 4: Anesthesia ────────────────────────────────────────── */}
          {step === 4 && (
            <>
              <Field label="Type of Anesthesia">
                <div className="flex flex-wrap gap-2">
                  {ANAESTHESIA_TYPES.map((a) => (
                    <Chip key={a} label={a} selected={anaesthesiaType === a} onClick={() => setAnaesthesiaType(a)} />
                  ))}
                </div>
              </Field>
              <Field label="Anesthetist Name" note="Leave blank if not yet assigned">
                <Input
                  value={anesthetistName}
                  onChange={(e) => setAnesthetistName(e.target.value)}
                  placeholder="Dr. Name (optional)"
                />
              </Field>
            </>
          )}

          {/* ── Step 5: Fit for Surgery ───────────────────────────────────── */}
          {step === 5 && (
            <>
              <div className="rounded-xl border border-[var(--color-border)] divide-y divide-[var(--color-border)] px-4">
                <Toggle label="Counseling Done" value={counselingDone} onChange={setCounselingDone} description="Patient has been counselled about the procedure and risks" />
                <Toggle label="Investigation Done" value={investigationDone} onChange={setInvestigationDone} description="Pre-operative investigations completed and reviewed" />
                <Toggle label="Consent Received" value={consentReceived} onChange={setConsentReceived} description="Signed informed consent form obtained from patient / guardian" />
                <Toggle label="Reports Uploaded" value={reportsUploaded} onChange={setReportsUploaded} description="Lab reports, imaging scans uploaded to the system" />
                <Toggle label="Blood Arranged" value={bloodArranged} onChange={setBloodArranged} description="Blood and blood products arranged if required" />
              </div>

              <div
                className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 ${
                  fitForSurgery
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-[var(--color-border)] bg-[var(--color-surface-sunken)]"
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${fitForSurgery ? "bg-emerald-500" : "bg-[var(--color-border)]"}`}>
                  <CheckCircle2 size={16} className={fitForSurgery ? "text-white" : "text-[var(--color-ink-400)]"} />
                </div>
                <div>
                  <p className={`text-sm font-bold ${fitForSurgery ? "text-emerald-800" : "text-[var(--color-ink-600)]"}`}>
                    {fitForSurgery ? "Patient is Fit for Surgery" : "Not yet fit for surgery"}
                  </p>
                  <p className="text-[11px] text-[var(--color-ink-400)] mt-0.5">
                    {fitForSurgery
                      ? "All required checks complete. Doctor will be notified."
                      : "Counselling, investigation, and consent must all be confirmed."}
                  </p>
                </div>
              </div>

              <Field label="Clinical Notes">
                <Textarea
                  rows={3}
                  value={counsellingNotes}
                  onChange={(e) => setCounsellingNotes(e.target.value)}
                  placeholder="Any additional notes, precautions, or special instructions…"
                />
              </Field>
            </>
          )}

          {/* ── Step 6: Advance Payment ───────────────────────────────────── */}
          {step === 6 && (
            <>
              <Field label="Advance Collected (₹)" note="Leave blank if no advance collected">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value)}
                  placeholder="0.00"
                />
              </Field>
              <Field label="Payment Mode">
                <div className="flex flex-wrap gap-2">
                  {ADVANCE_MODES.map((m) => (
                    <Chip key={m} label={m} selected={advanceMode === m} onClick={() => setAdvanceMode(m)} />
                  ))}
                </div>
              </Field>
              <Field label="Receipt / Transaction Number">
                <Input
                  value={advanceReceipt}
                  onChange={(e) => setAdvanceReceipt(e.target.value)}
                  placeholder="Receipt no. / UTR / Transaction ref."
                />
              </Field>
            </>
          )}

          {/* ── Step 7: Surgery Date & Time ───────────────────────────────── */}
          {step === 7 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Surgery Date">
                  <Input
                    type="date"
                    value={surgeryDate}
                    onChange={(e) => setSurgeryDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                  />
                </Field>
                <Field label="Surgery Time">
                  <Input
                    type="time"
                    value={surgeryTime}
                    onChange={(e) => setSurgeryTime(e.target.value)}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="OT Room" note="Optional">
                  <Input
                    value={otRoom}
                    onChange={(e) => setOtRoom(e.target.value)}
                    placeholder="e.g. OT-1, Theatre A"
                  />
                </Field>
                <Field label="Est. Duration (minutes)">
                  <Input
                    type="number"
                    min="10"
                    step="5"
                    value={estDuration}
                    onChange={(e) => setEstDuration(e.target.value)}
                    placeholder="60"
                  />
                </Field>
              </div>
            </>
          )}

          {/* ── Step 8: Final Confirmation ────────────────────────────────── */}
          {step === 8 && (
            <div className="space-y-4">
              <ReviewSection title="Payment">
                <ReviewRow label="Payment Mode" value={paymentMode} />
                {buildPaymentNotes() && <ReviewRow label="Details" value={buildPaymentNotes()} />}
              </ReviewSection>

              <ReviewSection title="Surgery">
                <ReviewRow label="Name of Surgery" value={surgeryName || "—"} />
                <ReviewRow label="Type" value={`${surgeryType} · ${urgencyType} · ${priority}`} />
              </ReviewSection>

              <ReviewSection title="Procedure & Laterality">
                <ReviewRow
                  label="Eye"
                  value={rightEye && leftEye ? "Both Eyes" : rightEye ? "Right Eye" : leftEye ? "Left Eye" : "—"}
                />
                <ReviewRow label="Diagnosis" value={diagnosis} />
                {procedure && <ReviewRow label="Procedure Notes" value={procedure} />}
              </ReviewSection>

              <ReviewSection title="Anesthesia">
                <ReviewRow label="Type" value={anaesthesiaType} />
                <ReviewRow label="Anesthetist" value={anesthetistName || "Not yet assigned"} />
              </ReviewSection>

              <ReviewSection title="Pre-operative Checks">
                <ReviewRow label="Counseling Done"    value={counselingDone ? "✓ Yes" : "✗ No"} />
                <ReviewRow label="Investigation Done" value={investigationDone ? "✓ Yes" : "✗ No"} />
                <ReviewRow label="Consent Received"   value={consentReceived ? "✓ Yes" : "✗ No"} />
                <ReviewRow label="Reports Uploaded"   value={reportsUploaded ? "✓ Yes" : "✗ No"} />
                <ReviewRow label="Blood Arranged"     value={bloodArranged ? "✓ Yes" : "Not required / No"} />
                <ReviewRow label="Fit for Surgery"    value={fitForSurgery ? "✓ Yes — Doctor will be notified" : "Not yet"} />
              </ReviewSection>

              <ReviewSection title="Advance Payment">
                <ReviewRow label="Amount" value={advanceAmount ? `₹${parseFloat(advanceAmount).toLocaleString("en-IN")}` : "None"} />
                <ReviewRow label="Mode" value={advanceMode} />
                <ReviewRow label="Receipt" value={advanceReceipt || "—"} />
              </ReviewSection>

              <ReviewSection title="Surgery Schedule">
                <ReviewRow label="Date & Time" value={surgeryDate && surgeryTime ? `${format(new Date(`${surgeryDate}T${surgeryTime}`), "d MMM yyyy · h:mm a")}` : "—"} />
                <ReviewRow label="OT Room" value={otRoom || "Not assigned"} />
                <ReviewRow label="Est. Duration" value={estDuration ? `${estDuration} min` : "—"} />
              </ReviewSection>

              {counsellingNotes && (
                <ReviewSection title="Clinical Notes">
                  <ReviewRow label="Notes" value={counsellingNotes} />
                </ReviewSection>
              )}

              {fitForSurgery && (
                <div className="flex items-start gap-2.5 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
                  <CheckCircle2 size={15} className="shrink-0 mt-0.5 text-emerald-600" />
                  <span>Patient is fit for surgery. The doctor will be notified immediately after submission.</span>
                </div>
              )}

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Card footer */}
        <div className="px-6 py-4 border-t border-[var(--color-border)] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={back}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-sm font-semibold text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] transition-colors"
          >
            <ArrowLeft size={14} /> {step === 1 ? "Patient Profile" : "Back"}
          </button>

          {step < 8 ? (
            <button
              type="button"
              onClick={next}
              className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors shadow-sm"
            >
              Continue <ArrowRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {pending ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Saving…
                </>
              ) : (
                <>
                  <ClipboardCheck size={15} />
                  {fitForSurgery ? "Submit & Notify Doctor" : "Save Counselling"}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
