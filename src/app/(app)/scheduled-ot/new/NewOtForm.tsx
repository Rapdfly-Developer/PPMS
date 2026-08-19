"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSurgerySchedule } from "../actions";
import { User, Scissors, Stethoscope, CalendarCheck, ClipboardCheck, AlertCircle } from "lucide-react";

export interface OtPrefill {
  patientId:          string;
  hospitalId:         string;
  operatingSurgeonId: string;
  patientName:        string;
  patientAge?:        number;
  patientSex?:        string;
  doctorName?:        string;
  hospitalName:       string;
  surgeryName:        string;
  surgeryEye?:        string;
  procedure?:         string;
  laterality?:        string;
  anaesthesia?:       string;
  dateOfSurgery?:     string;   // YYYY-MM-DD
  iolSummary?:        string;
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function SectionHeading({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={14} className="text-[var(--color-ink-400)]" />
      <p className="text-[11px] font-bold text-[var(--color-ink-400)] uppercase tracking-wide">{label}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-[var(--color-ink-600)]">{label}</label>
      {children}
    </div>
  );
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-ink-900)] focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:bg-[var(--color-surface-sunken)] disabled:text-[var(--color-ink-400)]"
    />
  );
}

function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-ink-900)] focus:outline-none focus:ring-2 focus:ring-teal-400"
    >
      {children}
    </select>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-[var(--color-ink-400)] w-24 shrink-0 pt-px">{label}</span>
      <span className="text-xs font-semibold text-[var(--color-ink-800)]">{value}</span>
    </div>
  );
}

function CheckboxRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-teal-600 cursor-pointer"
      />
      <span className="text-sm text-[var(--color-ink-700)]">{label}</span>
    </label>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function NewOtForm({ prefill }: { prefill: OtPrefill }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Required selects
  const [surgeryCategory, setSurgeryCategory] = useState("");
  const [urgencyType,     setUrgencyType]     = useState("ELECTIVE");
  const [priority,        setPriority]        = useState("ROUTINE");

  // OT details — pre-filled where possible
  const [surgeryName,  setSurgeryName]  = useState(prefill.surgeryName);
  const [procedure,    setProcedure]    = useState(prefill.procedure ?? "");
  const [plannedDate,  setPlannedDate]  = useState(prefill.dateOfSurgery ?? "");
  const [plannedTime,  setPlannedTime]  = useState("08:00");
  const [otRoom,       setOtRoom]       = useState("");
  const [duration,     setDuration]     = useState("");
  const [anesthetist,  setAnesthetist]  = useState("");
  const [nursingStaff, setNursingStaff] = useState("");
  const [admissionDate, setAdmissionDate] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [remarks,      setRemarks]      = useState("");

  // Checklists
  const [consentReceived,  setConsent]     = useState(false);
  const [reportsUploaded,  setReports]     = useState(false);
  const [otAvailable,      setOtAvail]     = useState(false);
  const [bloodArranged,    setBlood]       = useState(false);
  const [patientInformed,  setPatientInfo] = useState(false);

  function handleSubmit() {
    if (!surgeryName.trim())   { setError("Surgery name is required."); return; }
    if (!surgeryCategory)      { setError("Surgery category is required."); return; }
    if (!urgencyType)          { setError("Urgency type is required."); return; }
    if (!priority)             { setError("Priority is required."); return; }
    if (!plannedDate || !plannedTime) { setError("Planned date & time is required."); return; }

    setError(null);

    const plannedDateTime = `${plannedDate}T${plannedTime}:00`;

    start(async () => {
      const res = await saveSurgerySchedule({
        patientId:          prefill.patientId,
        hospitalId:         prefill.hospitalId,
        operatingSurgeonId: prefill.operatingSurgeonId,
        surgeryName:        surgeryName.trim(),
        procedure:          procedure.trim() || undefined,
        surgeryCategory,
        urgencyType,
        priority,
        plannedDateTime,
        otRoom:             otRoom.trim() || undefined,
        estimatedDuration:  duration ? parseInt(duration, 10) : undefined,
        anesthetistName:    anesthetist.trim() || undefined,
        nursingStaff:       nursingStaff.trim() || undefined,
        admissionDate:      admissionDate || undefined,
        paymentStatus:      paymentStatus || undefined,
        remarks:            remarks.trim() || undefined,
        consentReceived,
        reportsUploaded,
        otAvailable,
        bloodArranged,
        patientInformed,
        status:             "PLANNED",
      });

      if (res.error) {
        setError(res.error);
      } else {
        router.push("/scheduled-ot");
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">

      {/* ── Patient & Surgery Summary (read-only) ── */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <SectionHeading icon={User} label="Patient & Surgery" />
        <div className="flex flex-col gap-1.5">
          <InfoRow label="Patient"   value={prefill.patientName + (prefill.patientAge ? `, ${prefill.patientAge} yrs` : "") + (prefill.patientSex ? ` · ${prefill.patientSex === "MALE" ? "M" : prefill.patientSex === "FEMALE" ? "F" : prefill.patientSex}` : "")} />
          <InfoRow label="Hospital"  value={prefill.hospitalName} />
          <InfoRow label="Surgeon"   value={prefill.doctorName ? `Dr. ${prefill.doctorName}` : undefined} />
          <InfoRow label="Eye"       value={prefill.surgeryEye} />
          <InfoRow label="Laterality" value={prefill.laterality} />
          <InfoRow label="IOL"       value={prefill.iolSummary} />
          <InfoRow label="Anaesthesia" value={prefill.anaesthesia} />
        </div>
      </div>

      {/* ── Surgery Details ── */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <SectionHeading icon={Scissors} label="Surgery Details" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Field label="Surgery Name *">
              <Input
                value={surgeryName}
                onChange={(e) => setSurgeryName(e.target.value)}
                placeholder="e.g. Phacoemulsification with IOL"
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Procedure">
              <Input
                value={procedure}
                onChange={(e) => setProcedure(e.target.value)}
                placeholder="e.g. SICS, LASIK"
              />
            </Field>
          </div>
          <Field label="Category *">
            <Select value={surgeryCategory} onChange={(e) => setSurgeryCategory(e.target.value)}>
              <option value="">Select…</option>
              <option value="MINOR">Minor</option>
              <option value="MAJOR">Major</option>
            </Select>
          </Field>
          <Field label="Urgency *">
            <Select value={urgencyType} onChange={(e) => setUrgencyType(e.target.value)}>
              <option value="ELECTIVE">Elective</option>
              <option value="EMERGENCY">Emergency</option>
            </Select>
          </Field>
          <Field label="Priority *">
            <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="ROUTINE">Routine</option>
              <option value="URGENT">Urgent</option>
              <option value="EMERGENCY">Emergency</option>
            </Select>
          </Field>
        </div>
      </div>

      {/* ── OT Scheduling ── */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <SectionHeading icon={CalendarCheck} label="OT Scheduling" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Date *">
            <Input
              type="date"
              value={plannedDate}
              onChange={(e) => setPlannedDate(e.target.value)}
            />
          </Field>
          <Field label="Time *">
            <Input
              type="time"
              value={plannedTime}
              onChange={(e) => setPlannedTime(e.target.value)}
            />
          </Field>
          <Field label="OT Room">
            <Input
              value={otRoom}
              onChange={(e) => setOtRoom(e.target.value)}
              placeholder="e.g. OT-1"
            />
          </Field>
          <Field label="Est. Duration (mins)">
            <Input
              type="number"
              min={0}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="e.g. 60"
            />
          </Field>
          <Field label="Anesthetist">
            <Input
              value={anesthetist}
              onChange={(e) => setAnesthetist(e.target.value)}
              placeholder="Anesthetist name"
            />
          </Field>
          <Field label="Nursing Staff">
            <Input
              value={nursingStaff}
              onChange={(e) => setNursingStaff(e.target.value)}
              placeholder="Staff names"
            />
          </Field>
        </div>
      </div>

      {/* ── Admission & Payment ── */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <SectionHeading icon={Stethoscope} label="Admission & Payment" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Admission Date">
            <Input
              type="date"
              value={admissionDate}
              onChange={(e) => setAdmissionDate(e.target.value)}
            />
          </Field>
          <Field label="Payment Status">
            <Select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
              <option value="">Not set</option>
              <option value="PAID">Paid</option>
              <option value="PARTIAL">Partial</option>
              <option value="PENDING">Pending</option>
              <option value="INSURANCE">Insurance</option>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Remarks">
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
                placeholder="Any additional notes…"
                className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-ink-900)] focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
              />
            </Field>
          </div>
        </div>
      </div>

      {/* ── Pre-op Checklist ── */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <SectionHeading icon={ClipboardCheck} label="Pre-op Checklist" />
        <div className="flex flex-col gap-3">
          <CheckboxRow label="Consent received"         checked={consentReceived}  onChange={setConsent} />
          <CheckboxRow label="Reports uploaded"         checked={reportsUploaded}  onChange={setReports} />
          <CheckboxRow label="OT slot confirmed"        checked={otAvailable}      onChange={setOtAvail} />
          <CheckboxRow label="Blood arranged (if needed)" checked={bloodArranged}  onChange={setBlood} />
          <CheckboxRow label="Patient informed"         checked={patientInformed}  onChange={setPatientInfo} />
        </div>
      </div>

      {/* ── Error & Submit ── */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle size={15} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          disabled={pending}
          className="px-5 py-2 rounded-xl border border-[var(--color-border)] text-sm font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending}
          className="flex items-center gap-2 px-6 py-2 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 transition-colors"
        >
          <CalendarCheck size={14} />
          {pending ? "Scheduling…" : "Schedule OT"}
        </button>
      </div>
    </div>
  );
}
