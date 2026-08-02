"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  User, Building2, Scissors, Calendar, AlertTriangle,
  CheckSquare, CreditCard, FileText, ChevronDown, Save,
  Loader2, ArrowLeft, Clock,
} from "lucide-react";
import { saveSurgerySchedule } from "./actions";

export interface OtRecordForForm {
  id:              string;
  surgeryName:     string | null;
  surgeryType:     string;
  anaesthesiaType: string;
  patient: { id: string; name: string; udid: string; age: number; sex: string };
  hospital: { id: string; name: string };
  doctor:   { id: string; name: string };
}

/* ── shared style tokens ─────────────────────────────────────────────────── */
const SEL =
  "w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-transparent appearance-none";
const INP =
  "w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-transparent";
const TEXTAREA =
  "w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-transparent resize-none";
const READONLY =
  "w-full rounded-lg border border-[var(--color-surface-sunken)] bg-[var(--color-surface-sunken)] px-3 py-2 text-sm text-[var(--color-ink-600)] cursor-default select-none";
const ERR_INP =
  "w-full rounded-lg border border-red-400 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent";

/* ── small primitives ────────────────────────────────────────────────────── */
function SectionCard({
  icon, title, children,
}: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-white overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3 bg-[var(--color-surface-sunken)] border-b border-[var(--color-border)]">
        <span className="text-[var(--color-primary-600)]">{icon}</span>
        <span className="text-xs font-bold tracking-widest text-[var(--color-ink-500)] uppercase">{title}</span>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold text-[var(--color-ink-600)] mb-1.5">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function SelectWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]" />
    </div>
  );
}

function CheckItem({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group py-2.5 px-4 hover:bg-[var(--color-surface-sunken)] transition-colors">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`shrink-0 w-[18px] h-[18px] rounded border-2 flex items-center justify-center transition-colors ${
          checked
            ? "bg-[var(--color-primary-600)] border-[var(--color-primary-600)]"
            : "bg-white border-[var(--color-border)] group-hover:border-[var(--color-primary-400)]"
        }`}
      >
        {checked && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>
      <span className="text-sm text-[var(--color-ink-700)]">{label}</span>
      {checked && (
        <span className="ml-auto text-[10px] font-semibold text-[var(--color-primary-600)] bg-[var(--color-primary-50)] px-2 py-0.5 rounded-full">
          Done
        </span>
      )}
    </label>
  );
}

const STATUS_OPTS   = ["PLANNED", "SCHEDULED", "RESCHEDULED", "CANCELLED"];
const CATEGORY_OPTS = ["MAJOR", "MINOR"];
const URGENCY_OPTS  = ["ELECTIVE", "EMERGENCY"];
const PRIORITY_OPTS = ["ROUTINE", "URGENT", "EMERGENCY"];
const PAYMENT_OPTS  = ["SELF_PAY", "INSURED", "CORPORATE", "GOVERNMENT", "SUBSIDISED", "FREE"];

const STATUS_STYLE: Record<string, string> = {
  PLANNED:     "bg-[var(--color-ink-700)] text-white border-[var(--color-ink-700)]",
  SCHEDULED:   "bg-[var(--color-primary-600)] text-white border-[var(--color-primary-600)]",
  RESCHEDULED: "bg-amber-500 text-white border-amber-500",
  CANCELLED:   "bg-red-600 text-white border-red-600",
};

/* ── main component ──────────────────────────────────────────────────────── */
export function SurgeryScheduleForm({ record }: { record: OtRecordForForm }) {
  const router = useRouter();
  const defaultName = record.surgeryName ?? record.surgeryType;

  const [department,        setDepartment]        = useState("");
  const [surgeryName,       setSurgeryName]        = useState(defaultName);
  const [diagnosis,         setDiagnosis]          = useState("");
  const [procedure,         setProcedure]          = useState(defaultName);
  const [surgeryCategory,   setSurgeryCategory]    = useState("MAJOR");
  const [urgencyType,       setUrgencyType]        = useState("ELECTIVE");
  const [priority,          setPriority]           = useState("ROUTINE");
  const [plannedDate,       setPlannedDate]        = useState("");
  const [plannedTime,       setPlannedTime]        = useState("08:00");
  const [otRoom,            setOtRoom]             = useState("");
  const [estimatedDuration, setEstimatedDuration]  = useState("");
  const [anesthetistName,   setAnesthetistName]    = useState("");
  const [nursingStaff,      setNursingStaff]       = useState("");
  const [admissionDate,     setAdmissionDate]      = useState("");
  const [paymentStatus,     setPaymentStatus]      = useState("SELF_PAY");
  const [consentReceived,   setConsentReceived]    = useState(false);
  const [reportsUploaded,   setReportsUploaded]    = useState(false);
  const [otAvailable,       setOtAvailable]        = useState(false);
  const [bloodArranged,     setBloodArranged]      = useState(false);
  const [patientInformed,   setPatientInformed]    = useState(false);
  const [status,            setStatus]             = useState("PLANNED");
  const [remarks,           setRemarks]            = useState("");

  const [errors,  setErrors]  = useState<Record<string, string>>({});
  const [saved,   setSaved]   = useState(false);
  const [pending, startTransition] = useTransition();

  function validate() {
    const e: Record<string, string> = {};
    if (!surgeryName.trim()) e.surgeryName    = "Required";
    if (!plannedDate)        e.plannedDate    = "Required";
    if (!plannedTime)        e.plannedTime    = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    startTransition(async () => {
      const result = await saveSurgerySchedule({
        surgicalCounsellingId: record.id,
        patientId:             record.patient.id,
        hospitalId:            record.hospital.id,
        operatingSurgeonId:    record.doctor.id,
        department,
        surgeryName,
        diagnosis,
        procedure,
        surgeryCategory,
        urgencyType,
        priority,
        plannedDateTime:      new Date(`${plannedDate}T${plannedTime}`).toISOString(),
        otRoom,
        estimatedDuration:    estimatedDuration ? parseInt(estimatedDuration, 10) : undefined,
        anesthetistName,
        nursingStaff,
        admissionDate:        admissionDate || undefined,
        paymentStatus,
        consentReceived,
        reportsUploaded,
        otAvailable,
        bloodArranged,
        patientInformed,
        status,
        remarks,
      });

      if (result.error) {
        setErrors({ _general: result.error });
        return;
      }
      setSaved(true);
      setTimeout(() => router.push("/scheduled-ot"), 1400);
    });
  }

  const checklistCount = [consentReceived, reportsUploaded, otAvailable, bloodArranged, patientInformed]
    .filter(Boolean).length;

  return (
    <div className="max-w-5xl mx-auto pb-16">

      {/* Page header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)] transition-colors"
        >
          <ArrowLeft size={15} /> Back
        </button>
        <div className="h-5 w-px bg-[var(--color-border)]" />
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--color-primary-100)] flex items-center justify-center shrink-0">
            <Scissors size={17} className="text-[var(--color-primary-700)]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[var(--color-ink-900)] leading-tight">
              Surgery Scheduling Form
            </h1>
            <p className="text-xs text-[var(--color-ink-400)]">
              {record.patient.name} · {record.hospital.name}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Left column (patient + surgeon + team + payment) ── */}
        <div className="flex flex-col gap-5">

          {/* Patient Details */}
          <SectionCard icon={<User size={14} />} title="Patient Details">
            <div className="flex flex-col gap-3">
              <div>
                <Label>Patient Name</Label>
                <div className={READONLY}>{record.patient.name}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Patient ID</Label>
                  <div className={`${READONLY} font-mono text-xs`}>{record.patient.udid}</div>
                </div>
                <div>
                  <Label>Age / Sex</Label>
                  <div className={READONLY}>{record.patient.age}y / {record.patient.sex}</div>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Hospital & Department */}
          <SectionCard icon={<Building2 size={14} />} title="Hospital & Department">
            <div className="flex flex-col gap-3">
              <div>
                <Label>Hospital</Label>
                <div className={READONLY}>{record.hospital.name}</div>
              </div>
              <div>
                <Label>Department</Label>
                <input
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Ophthalmology"
                  className={INP}
                />
              </div>
            </div>
          </SectionCard>

          {/* Operating Surgeon */}
          <SectionCard icon={<User size={14} />} title="Operating Surgeon">
            <div>
              <Label>Surgeon</Label>
              <div className={READONLY}>Dr. {record.doctor.name}</div>
            </div>
          </SectionCard>

          {/* Surgical Team */}
          <SectionCard icon={<User size={14} />} title="Surgical Team">
            <div className="flex flex-col gap-3">
              <div>
                <Label>Anesthetist</Label>
                <input
                  value={anesthetistName}
                  onChange={(e) => setAnesthetistName(e.target.value)}
                  placeholder="Name or type of anesthesia"
                  className={INP}
                />
              </div>
              <div>
                <Label>Nursing Staff</Label>
                <input
                  value={nursingStaff}
                  onChange={(e) => setNursingStaff(e.target.value)}
                  placeholder="Scrub nurse, circulating nurse…"
                  className={INP}
                />
              </div>
            </div>
          </SectionCard>

          {/* Admission & Payment */}
          <SectionCard icon={<CreditCard size={14} />} title="Admission & Payment">
            <div className="flex flex-col gap-3">
              <div>
                <Label>Admission Date</Label>
                <input
                  type="date"
                  value={admissionDate}
                  onChange={(e) => setAdmissionDate(e.target.value)}
                  className={INP}
                />
              </div>
              <div>
                <Label>Insurance / Payment Status</Label>
                <SelectWrapper>
                  <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className={SEL}>
                    {PAYMENT_OPTS.map((o) => (
                      <option key={o} value={o}>{o.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </SelectWrapper>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* ── Right column (surgery details + scheduling + checklist + status) ── */}
        <div className="lg:col-span-2 flex flex-col gap-5">

          {/* Surgery Details */}
          <SectionCard icon={<Scissors size={14} />} title="Surgery Details">
            <div className="flex flex-col gap-4">
              <div>
                <Label required>Surgery Name</Label>
                <input
                  value={surgeryName}
                  onChange={(e) => { setSurgeryName(e.target.value); setErrors((p) => ({ ...p, surgeryName: "" })); }}
                  placeholder="e.g. Phacoemulsification with IOL implantation"
                  className={errors.surgeryName ? ERR_INP : INP}
                />
                {errors.surgeryName && <p className="text-xs text-red-500 mt-1">{errors.surgeryName}</p>}
              </div>
              <div>
                <Label>Diagnosis</Label>
                <input
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="e.g. Senile cataract — right eye"
                  className={INP}
                />
              </div>
              <div>
                <Label>Procedure Description</Label>
                <textarea
                  value={procedure}
                  onChange={(e) => setProcedure(e.target.value)}
                  rows={3}
                  placeholder="Describe the surgical procedure in detail…"
                  className={TEXTAREA}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label required>Category</Label>
                  <SelectWrapper>
                    <select value={surgeryCategory} onChange={(e) => setSurgeryCategory(e.target.value)} className={SEL}>
                      {CATEGORY_OPTS.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </SelectWrapper>
                </div>
                <div>
                  <Label required>Elective / Emergency</Label>
                  <SelectWrapper>
                    <select value={urgencyType} onChange={(e) => setUrgencyType(e.target.value)} className={SEL}>
                      {URGENCY_OPTS.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </SelectWrapper>
                </div>
                <div>
                  <Label required>Priority</Label>
                  <SelectWrapper>
                    <select value={priority} onChange={(e) => setPriority(e.target.value)} className={SEL}>
                      {PRIORITY_OPTS.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </SelectWrapper>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Scheduling */}
          <SectionCard icon={<Calendar size={14} />} title="Planned Surgery Date & Time">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label required>Date</Label>
                <input
                  type="date"
                  value={plannedDate}
                  onChange={(e) => { setPlannedDate(e.target.value); setErrors((p) => ({ ...p, plannedDate: "" })); }}
                  className={errors.plannedDate ? ERR_INP : INP}
                />
                {errors.plannedDate && <p className="text-xs text-red-500 mt-1">{errors.plannedDate}</p>}
              </div>
              <div>
                <Label required>Time</Label>
                <input
                  type="time"
                  value={plannedTime}
                  onChange={(e) => setPlannedTime(e.target.value)}
                  className={INP}
                />
              </div>
              <div>
                <Label>Operation Theatre (OT)</Label>
                <input
                  value={otRoom}
                  onChange={(e) => setOtRoom(e.target.value)}
                  placeholder="e.g. OT-1, Main OT"
                  className={INP}
                />
              </div>
              <div>
                <Label>Estimated Duration (min)</Label>
                <input
                  type="number"
                  min={15}
                  step={15}
                  value={estimatedDuration}
                  onChange={(e) => setEstimatedDuration(e.target.value)}
                  placeholder="e.g. 60"
                  className={INP}
                />
              </div>
            </div>
          </SectionCard>

          {/* Administrative Checklist */}
          <SectionCard
            icon={<CheckSquare size={14} />}
            title={`Administrative Checklist (${checklistCount}/5)`}
          >
            <div className="divide-y divide-[var(--color-border)] -mx-5 -mb-4">
              {[
                { label: "Consent Form Received",            val: consentReceived,  set: setConsentReceived  },
                { label: "Investigation Reports Uploaded",   val: reportsUploaded,  set: setReportsUploaded  },
                { label: "OT Available & Confirmed",         val: otAvailable,      set: setOtAvailable      },
                { label: "Blood Arranged (if required)",     val: bloodArranged,    set: setBloodArranged    },
                { label: "Patient Informed & Counselled",    val: patientInformed,  set: setPatientInformed  },
              ].map(({ label, val, set }) => (
                <CheckItem key={label} label={label} checked={val} onChange={set} />
              ))}
            </div>
            {checklistCount === 5 && (
              <p className="mt-4 text-xs font-semibold text-[var(--color-primary-700)] flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-[var(--color-primary-600)] flex items-center justify-center shrink-0">
                  <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                    <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                All checklist items complete
              </p>
            )}
          </SectionCard>

          {/* Status & Remarks */}
          <SectionCard icon={<FileText size={14} />} title="Status & Remarks">
            <div className="flex flex-col gap-4">
              <div>
                <Label required>Status</Label>
                <div className="flex gap-2 flex-wrap mt-0.5">
                  {STATUS_OPTS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                        status === s
                          ? STATUS_STYLE[s]
                          : "bg-white text-[var(--color-ink-500)] border-[var(--color-border)] hover:border-[var(--color-primary-300)] hover:text-[var(--color-ink-800)]"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Remarks</Label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                  placeholder="Additional notes, special instructions, pre-op requirements…"
                  className={TEXTAREA}
                />
              </div>
            </div>
          </SectionCard>

          {/* Error */}
          {errors._general && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertTriangle size={15} className="shrink-0" />
              {errors._general}
            </div>
          )}

          {/* Save row */}
          <div className="flex items-center justify-between gap-4 pt-1">
            {saved ? (
              <span className="flex items-center gap-2 text-sm font-semibold text-[var(--color-primary-700)]">
                <span className="w-5 h-5 rounded-full bg-[var(--color-primary-600)] flex items-center justify-center shrink-0">
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                Saved — surgeon notified. Returning to Scheduled OT…
              </span>
            ) : (
              <p className="text-xs text-[var(--color-ink-400)]">
                Fields marked <span className="text-red-500 font-bold">*</span> are required
              </p>
            )}
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => router.back()}
                disabled={pending}
                className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={pending || saved}
                className="flex items-center gap-2 px-6 py-2 rounded-lg bg-[var(--color-primary-600)] text-white text-sm font-bold hover:bg-[var(--color-primary-700)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {pending ? (
                  <><Loader2 size={14} className="animate-spin" /> Saving…</>
                ) : saved ? "Saved" : (
                  <><Save size={14} /> Save Schedule</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
