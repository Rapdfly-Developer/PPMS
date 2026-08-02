"use client";

import { useState, useTransition } from "react";
import {
  X, User, Building2, Scissors, Calendar, Clock, AlertTriangle,
  CheckSquare, CreditCard, FileText, ChevronDown, Save, Loader2,
} from "lucide-react";
import { saveSurgerySchedule } from "./actions";

export interface OtRecordForForm {
  id:              string;        // surgicalCounselling id
  surgeryName:     string | null;
  surgeryType:     string;
  anaesthesiaType: string;
  patient: {
    name: string;
    udid: string;
    age:  number;
    sex:  string;
    id:   string;
  };
  hospital: { name: string; id: string };
  doctor:   { name: string; id: string };
}

const SEL =
  "w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-transparent appearance-none";
const INP =
  "w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-transparent";
const TEXTAREA =
  "w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-transparent resize-none";
const READONLY =
  "w-full rounded-lg border border-[var(--color-surface-sunken)] bg-[var(--color-surface-sunken)] px-3 py-2 text-sm text-[var(--color-ink-600)] cursor-default select-none";

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-[var(--color-surface-sunken)] border border-[var(--color-border)] mb-3">
      <span className="text-[var(--color-primary-600)]">{icon}</span>
      <span className="text-xs font-bold tracking-widest text-[var(--color-ink-500)] uppercase">{title}</span>
    </div>
  );
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold text-[var(--color-ink-600)] mb-1">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function Field({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={className ?? "flex flex-col"}>{children}</div>;
}

function CheckItem({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer group">
      <div
        onClick={() => onChange(!checked)}
        className={`w-4.5 h-4.5 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${
          checked
            ? "bg-[var(--color-primary-600)] border-[var(--color-primary-600)]"
            : "bg-white border-[var(--color-border)] group-hover:border-[var(--color-primary-400)]"
        }`}
        style={{ width: 18, height: 18 }}
      >
        {checked && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      <span className="text-sm text-[var(--color-ink-700)]">{label}</span>
    </label>
  );
}

const STATUS_OPTS   = ["PLANNED", "SCHEDULED", "RESCHEDULED", "CANCELLED"];
const CATEGORY_OPTS = ["MAJOR", "MINOR"];
const URGENCY_OPTS  = ["ELECTIVE", "EMERGENCY"];
const PRIORITY_OPTS = ["ROUTINE", "URGENT", "EMERGENCY"];
const PAYMENT_OPTS  = ["SELF_PAY", "INSURED", "CORPORATE", "GOVERNMENT", "SUBSIDISED", "FREE"];

export function SurgeryScheduleForm({
  record,
  onClose,
  onSaved,
}: {
  record: OtRecordForForm;
  onClose: () => void;
  onSaved: () => void;
}) {
  const defaultSurgeryName = record.surgeryName ?? record.surgeryType;

  const [department,         setDepartment]         = useState("");
  const [surgeryName,        setSurgeryName]         = useState(defaultSurgeryName);
  const [diagnosis,          setDiagnosis]           = useState("");
  const [procedure,          setProcedure]           = useState(defaultSurgeryName);
  const [surgeryCategory,    setSurgeryCategory]     = useState("MAJOR");
  const [urgencyType,        setUrgencyType]         = useState("ELECTIVE");
  const [priority,           setPriority]            = useState("ROUTINE");
  const [plannedDate,        setPlannedDate]         = useState("");
  const [plannedTime,        setPlannedTime]         = useState("08:00");
  const [otRoom,             setOtRoom]              = useState("");
  const [estimatedDuration,  setEstimatedDuration]   = useState("");
  const [anesthetistName,    setAnesthetistName]     = useState(record.anaesthesiaType ? `${record.anaesthesiaType} anesthesia` : "");
  const [nursingStaff,       setNursingStaff]        = useState("");
  const [admissionDate,      setAdmissionDate]       = useState("");
  const [paymentStatus,      setPaymentStatus]       = useState("SELF_PAY");
  const [consentReceived,    setConsentReceived]     = useState(false);
  const [reportsUploaded,    setReportsUploaded]     = useState(false);
  const [otAvailable,        setOtAvailable]         = useState(false);
  const [bloodArranged,      setBloodArranged]       = useState(false);
  const [patientInformed,    setPatientInformed]     = useState(false);
  const [status,             setStatus]              = useState("PLANNED");
  const [remarks,            setRemarks]             = useState("");

  const [errors,  setErrors]  = useState<Record<string, string>>({});
  const [saved,   setSaved]   = useState(false);
  const [pending, startTransition] = useTransition();

  function validate() {
    const e: Record<string, string> = {};
    if (!surgeryName.trim())  e.surgeryName    = "Required";
    if (!plannedDate)         e.plannedDate    = "Required";
    if (!plannedTime)         e.plannedTime    = "Required";
    if (!surgeryCategory)     e.surgeryCategory = "Required";
    if (!urgencyType)         e.urgencyType    = "Required";
    if (!priority)            e.priority       = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    startTransition(async () => {
      const plannedDateTime = new Date(`${plannedDate}T${plannedTime}`).toISOString();
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
        plannedDateTime,
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
      setTimeout(onSaved, 1200);
    });
  }

  const checklistAll = consentReceived && reportsUploaded && otAvailable && bloodArranged && patientInformed;
  const checklistCount = [consentReceived, reportsUploaded, otAvailable, bloodArranged, patientInformed].filter(Boolean).length;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-2xl z-50 flex flex-col bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--color-primary-100)] flex items-center justify-center shrink-0">
              <Scissors size={17} className="text-[var(--color-primary-700)]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--color-ink-900)]">Surgery Scheduling Form</h2>
              <p className="text-xs text-[var(--color-ink-400)] mt-0.5">{record.patient.name} · {record.hospital.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">

          {/* ── Patient Details ── */}
          <section>
            <SectionHeader icon={<User size={14} />} title="Patient Details" />
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <Label>Patient Name</Label>
                <div className={READONLY}>{record.patient.name}</div>
              </Field>
              <Field>
                <Label>Patient ID</Label>
                <div className={READONLY}>{record.patient.udid}</div>
              </Field>
              <Field>
                <Label>Age</Label>
                <div className={READONLY}>{record.patient.age} yrs</div>
              </Field>
              <Field>
                <Label>Sex</Label>
                <div className={READONLY}>{record.patient.sex}</div>
              </Field>
            </div>
          </section>

          {/* ── Hospital & Department ── */}
          <section>
            <SectionHeader icon={<Building2 size={14} />} title="Hospital & Department" />
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <Label>Hospital</Label>
                <div className={READONLY}>{record.hospital.name}</div>
              </Field>
              <Field>
                <Label>Department</Label>
                <input
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Ophthalmology"
                  className={INP}
                />
              </Field>
            </div>
          </section>

          {/* ── Operating Surgeon ── */}
          <section>
            <SectionHeader icon={<User size={14} />} title="Operating Surgeon" />
            <Field>
              <Label>Surgeon</Label>
              <div className={READONLY}>Dr. {record.doctor.name}</div>
            </Field>
          </section>

          {/* ── Surgery Details ── */}
          <section>
            <SectionHeader icon={<Scissors size={14} />} title="Surgery Details" />
            <div className="flex flex-col gap-3">
              <Field>
                <Label required>Surgery Name</Label>
                <input
                  value={surgeryName}
                  onChange={(e) => { setSurgeryName(e.target.value); setErrors((p) => ({ ...p, surgeryName: "" })); }}
                  placeholder="e.g. Phacoemulsification with IOL implantation"
                  className={`${INP} ${errors.surgeryName ? "border-red-400 focus:ring-red-400" : ""}`}
                />
                {errors.surgeryName && <span className="text-xs text-red-500 mt-0.5">{errors.surgeryName}</span>}
              </Field>
              <Field>
                <Label>Diagnosis</Label>
                <input
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="e.g. Senile cataract"
                  className={INP}
                />
              </Field>
              <Field>
                <Label>Procedure Description</Label>
                <textarea
                  value={procedure}
                  onChange={(e) => setProcedure(e.target.value)}
                  rows={2}
                  placeholder="Describe the surgical procedure..."
                  className={TEXTAREA}
                />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field>
                  <Label required>Category</Label>
                  <div className="relative">
                    <select
                      value={surgeryCategory}
                      onChange={(e) => setSurgeryCategory(e.target.value)}
                      className={SEL}
                    >
                      {CATEGORY_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]" />
                  </div>
                </Field>
                <Field>
                  <Label required>Elective / Emergency</Label>
                  <div className="relative">
                    <select
                      value={urgencyType}
                      onChange={(e) => setUrgencyType(e.target.value)}
                      className={SEL}
                    >
                      {URGENCY_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]" />
                  </div>
                </Field>
                <Field>
                  <Label required>Priority</Label>
                  <div className="relative">
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className={SEL}
                    >
                      {PRIORITY_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]" />
                  </div>
                </Field>
              </div>
            </div>
          </section>

          {/* ── Scheduling ── */}
          <section>
            <SectionHeader icon={<Calendar size={14} />} title="Planned Surgery Date & Time" />
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <Label required>Date</Label>
                <input
                  type="date"
                  value={plannedDate}
                  onChange={(e) => { setPlannedDate(e.target.value); setErrors((p) => ({ ...p, plannedDate: "" })); }}
                  className={`${INP} ${errors.plannedDate ? "border-red-400 focus:ring-red-400" : ""}`}
                />
                {errors.plannedDate && <span className="text-xs text-red-500 mt-0.5">{errors.plannedDate}</span>}
              </Field>
              <Field>
                <Label required>Time</Label>
                <input
                  type="time"
                  value={plannedTime}
                  onChange={(e) => setPlannedTime(e.target.value)}
                  className={INP}
                />
              </Field>
              <Field>
                <Label>Operation Theatre (OT)</Label>
                <input
                  value={otRoom}
                  onChange={(e) => setOtRoom(e.target.value)}
                  placeholder="e.g. OT-1, Main OT"
                  className={INP}
                />
              </Field>
              <Field>
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
              </Field>
            </div>
          </section>

          {/* ── Team ── */}
          <section>
            <SectionHeader icon={<User size={14} />} title="Surgical Team" />
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <Label>Anesthetist</Label>
                <input
                  value={anesthetistName}
                  onChange={(e) => setAnesthetistName(e.target.value)}
                  placeholder="Anesthetist name or type"
                  className={INP}
                />
              </Field>
              <Field>
                <Label>Nursing Staff</Label>
                <input
                  value={nursingStaff}
                  onChange={(e) => setNursingStaff(e.target.value)}
                  placeholder="Scrub nurse, circulating nurse..."
                  className={INP}
                />
              </Field>
            </div>
          </section>

          {/* ── Admin ── */}
          <section>
            <SectionHeader icon={<CreditCard size={14} />} title="Admission & Payment" />
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <Label>Admission Date</Label>
                <input
                  type="date"
                  value={admissionDate}
                  onChange={(e) => setAdmissionDate(e.target.value)}
                  className={INP}
                />
              </Field>
              <Field>
                <Label>Insurance / Payment Status</Label>
                <div className="relative">
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value)}
                    className={SEL}
                  >
                    {PAYMENT_OPTS.map((o) => (
                      <option key={o} value={o}>{o.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]" />
                </div>
              </Field>
            </div>
          </section>

          {/* ── Checklist ── */}
          <section>
            <SectionHeader icon={<CheckSquare size={14} />} title={`Administrative Checklist (${checklistCount}/5)`} />
            <div className="rounded-xl border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
              {[
                { label: "Consent Form Received",  val: consentReceived,  set: setConsentReceived  },
                { label: "Investigation Reports Uploaded", val: reportsUploaded, set: setReportsUploaded },
                { label: "OT Available & Confirmed", val: otAvailable,    set: setOtAvailable      },
                { label: "Blood Arranged (if required)", val: bloodArranged, set: setBloodArranged  },
                { label: "Patient Informed & Counselled", val: patientInformed, set: setPatientInformed },
              ].map(({ label, val, set }) => (
                <div key={label} className="flex items-center px-4 py-3">
                  <CheckItem label={label} checked={val} onChange={set} />
                  {val && (
                    <span className="ml-auto text-[10px] font-semibold text-[var(--color-primary-600)] bg-[var(--color-primary-50)] px-2 py-0.5 rounded-full">
                      Done
                    </span>
                  )}
                </div>
              ))}
            </div>
            {checklistAll && (
              <p className="mt-2 text-xs font-medium text-[var(--color-success-600)] flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-[var(--color-success-600)] flex items-center justify-center">
                  <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                    <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                All checklist items complete
              </p>
            )}
          </section>

          {/* ── Status & Remarks ── */}
          <section>
            <SectionHeader icon={<FileText size={14} />} title="Status & Remarks" />
            <div className="flex flex-col gap-3">
              <Field>
                <Label required>Status</Label>
                <div className="flex gap-2 flex-wrap">
                  {STATUS_OPTS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        status === s
                          ? s === "CANCELLED"
                            ? "bg-red-600 text-white border-red-600"
                            : s === "SCHEDULED"
                            ? "bg-[var(--color-primary-600)] text-white border-[var(--color-primary-600)]"
                            : s === "RESCHEDULED"
                            ? "bg-amber-500 text-white border-amber-500"
                            : "bg-[var(--color-ink-700)] text-white border-[var(--color-ink-700)]"
                          : "bg-white text-[var(--color-ink-600)] border-[var(--color-border)] hover:border-[var(--color-primary-400)]"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </Field>
              <Field>
                <Label>Remarks</Label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                  placeholder="Any additional notes or instructions..."
                  className={TEXTAREA}
                />
              </Field>
            </div>
          </section>

          {errors._general && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <AlertTriangle size={14} />
              {errors._general}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-[var(--color-border)] px-6 py-4 bg-white flex items-center justify-between gap-3">
          {saved ? (
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-success-600)]">
              <span className="w-5 h-5 rounded-full bg-[var(--color-success-600)] flex items-center justify-center">
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              Surgery scheduled — surgeon notified
            </div>
          ) : (
            <p className="text-xs text-[var(--color-ink-400)]">
              Fields marked <span className="text-red-500">*</span> are required
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={pending}
              className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={pending || saved}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[var(--color-primary-600)] text-white text-sm font-semibold hover:bg-[var(--color-primary-700)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {pending ? (
                <><Loader2 size={14} className="animate-spin" /> Saving…</>
              ) : saved ? (
                "Saved"
              ) : (
                <><Save size={14} /> Save Schedule</>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
