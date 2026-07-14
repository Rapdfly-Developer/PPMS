"use client";

import { useState, useTransition, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search, UserPlus, Stethoscope,
  Calendar, Clock, FileText, ChevronRight,
  User, Phone, AlertCircle, CheckCircle2, Info, Building2,
} from "lucide-react";
import { bookAppointment, getBookedSlots } from "./actions";
import { BackButton } from "@/components/ui/BackButton";
import { SmartUploadBox, type UploadedFile } from "@/components/ui/SmartUploadBox";

const VISIT_TYPES = ["General OPD", "Emergency", "Follow-up", "Post-op Review"];
const SEXES = ["MALE", "FEMALE", "OTHER"];

const FALLBACK_SLOTS = [
  "08:00","08:15","08:30","08:45",
  "09:00","09:15","09:30","09:45",
  "10:00","10:15","10:30","10:45",
  "11:00","11:15","11:30","11:45",
  "14:00","14:15","14:30","14:45",
  "15:00","15:15","15:30","15:45",
  "16:00","16:15","16:30","16:45",
  "17:00","17:15","17:30","17:45",
];

type AvailSlot = { weekday: number; startTime: string; endTime: string; slotMins: number; hospitalId: string };
type Doctor  = { id: string; name: string; specialty: string };
type Patient = { id: string; name: string; udid: string; uhid: string; age: number | null; sex: string; mobile: string; registeredAtId: string | null };
type Hospital = { id: string; name: string };

function to12h(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function generateSlots(start: string, end: string, mins: number): string[] {
  const slots: string[] = [];
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let cur = sh * 60 + sm;
  const endMins = eh * 60 + em;
  while (cur < endMins) {
    const h = Math.floor(cur / 60);
    const m = cur % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    cur += mins;
  }
  return slots;
}

export function BookAppointmentForm({
  doctors,
  patients,
  hospitalId,
  availabilityByDoctor = {},
  hospitalsByDoctor = {},
}: {
  doctors: Doctor[];
  patients: Patient[];
  hospitalId: string | null;
  availabilityByDoctor?: Record<string, AvailSlot[]>;
  hospitalsByDoctor?: Record<string, Hospital[]>;
}) {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? "/appointments";
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  /* ── Step 0: encounter type ── */
  const [encounterType, setEncounterType] = useState<"walkin" | "appointment">("appointment");

  /* ── Step 1: patient ── */
  const [patientMode, setPatientMode] = useState<"existing" | "new">("existing");
  const [search, setSearch]               = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // new patient fields
  const [npName,      setNpName]      = useState("");
  const [npDob,       setNpDob]       = useState("");
  const [npSex,       setNpSex]       = useState("MALE");
  const [npMobile,    setNpMobile]    = useState("");
  const [npComplaint, setNpComplaint] = useState("");
  const [npCategory,  setNpCategory]  = useState("GENERAL");
  const [aadhaarPhoto, setAadhaarPhoto] = useState<UploadedFile | null>(null);
  const [patientPhoto, setPatientPhoto] = useState<UploadedFile | null>(null);

  /* ── Step 2: appointment details ── */
  const [doctorId,   setDoctorId]   = useState(doctors[0]?.id ?? "");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [time, setTime] = useState("09:00");
  const [visitType,  setVisitType]  = useState("General OPD");
  const [notes,      setNotes]      = useState("");
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);

  // For DOCTOR role: selected hospital (since hospitalId is null)
  const doctorHospitals = hospitalsByDoctor[doctorId] ?? [];
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>(() => doctorHospitals[0]?.id ?? "");
  // Effective hospital for slot checking / booking
  const effectiveHospitalId = hospitalId ?? selectedHospitalId;

  // Reset selected hospital when doctor changes
  function handleDoctorChange(id: string) {
    setDoctorId(id);
    setTime("09:00");
    const firstHosp = (hospitalsByDoctor[id] ?? [])[0]?.id ?? "";
    setSelectedHospitalId(firstHosp);
  }

  // Selecting a patient auto-picks the hospital where they are registered
  // (doctor bookings only — hospital logins are already scoped to one hospital).
  function selectPatient(p: Patient) {
    setSelectedPatient(p);
    if (!hospitalId && p.registeredAtId) {
      const canUse = (hospitalsByDoctor[doctorId] ?? []).some((h) => h.id === p.registeredAtId);
      if (canUse) setSelectedHospitalId(p.registeredAtId);
    }
  }

  const todayStr = new Date().toISOString().split("T")[0];

  // Compute slots: filter by selected hospital + weekday
  const doctorAvail = availabilityByDoctor[doctorId] ?? [];
  const weekday = new Date(date + "T12:00:00").getDay(); // noon to avoid DST edge
  // Match on both weekday AND hospital (a doctor may visit multiple hospitals same day)
  const todayAvail = doctorAvail.find(
    (a) => a.weekday === weekday && (!effectiveHospitalId || a.hospitalId === effectiveHospitalId)
  );
  const usingAvailability = !!todayAvail;

  const baseSlots = todayAvail
    ? generateSlots(todayAvail.startTime, todayAvail.endTime, todayAvail.slotMins)
    : FALLBACK_SLOTS;

  const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
  const availableSlots = baseSlots.filter((t) => {
    const [h, m] = t.split(":").map(Number);
    if (date === todayStr && h * 60 + m <= nowMins) return false;
    if (bookedTimes.includes(t)) return false;
    return true;
  });

  // Fetch booked slots whenever doctor, date or hospital changes
  useEffect(() => {
    if (!doctorId || !date || !effectiveHospitalId) return;
    getBookedSlots(doctorId, date, effectiveHospitalId).then(setBookedTimes).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorId, date, effectiveHospitalId]);

  // Keep selected time valid when slots change
  useEffect(() => {
    if (availableSlots.length > 0 && !availableSlots.includes(time)) {
      setTime(availableSlots[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableSlots.join(",")]);

  function handleDateChange(newDate: string) {
    setDate(newDate);
  }

  const filtered = search.trim()
    ? patients.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.udid.toLowerCase().includes(search.toLowerCase()) ||
          p.uhid.toLowerCase().includes(search.toLowerCase()) ||
          p.mobile.includes(search)
      )
    : patients.slice(0, 8);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (patientMode === "existing" && !selectedPatient) { setError("Please select a patient."); return; }
    if (!doctorId) { setError("Please select a doctor."); return; }
    if (!effectiveHospitalId) { setError("Please select a hospital."); return; }
    if (!notes.trim()) { setError("Chief complaint is required."); return; }
    setError("");

    const fd = new FormData();
    fd.set("mode",         patientMode);
    fd.set("doctorId",     doctorId);
    fd.set("visitType",    visitType);
    fd.set("notes",        notes);
    fd.set("encounterType", encounterType);
    fd.set("hospitalId", effectiveHospitalId);

    // For walk-in, allocate the next available time slot after current time (skip already booked)
    if (encounterType === "walkin") {
      const now = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const slots = baseSlots.length > 0 ? baseSlots : FALLBACK_SLOTS;
      const nextSlot = slots.find((t) => {
        const [h, m] = t.split(":").map(Number);
        return h * 60 + m > nowMins && !bookedTimes.includes(t);
      }) ?? slots.find((t) => {
        const [h, m] = t.split(":").map(Number);
        return h * 60 + m > nowMins;
      });
      if (!nextSlot) { setError("No available time slots left for today. Please book a scheduled appointment."); return; }
      const pad = (n: number) => String(n).padStart(2, "0");
      fd.set("date", `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
      fd.set("time", nextSlot);
    } else {
      fd.set("date", date);
      fd.set("time", time);
    }

    if (patientMode === "existing") {
      fd.set("patientId", selectedPatient!.id);
    } else {
      fd.set("name",      npName);
      const dobAge = npDob
        ? Math.floor((Date.now() - new Date(npDob).getTime()) / (365.25 * 86_400_000))
        : 0;
      fd.set("age", String(dobAge));
      fd.set("sex",       npSex);
      fd.set("mobile",    npMobile);
      fd.set("complaint", npComplaint);
      fd.set("category",  npCategory);
      // Photos uploaded to blob storage; savedNames passed for future DB linking
      if (aadhaarPhoto) fd.set("aadhaarPhotoFile", aadhaarPhoto.savedName);
      if (patientPhoto) fd.set("patientPhotoFile",  patientPhoto.savedName);
    }

    startTransition(async () => {
      const result = await bookAppointment(fd);
      if (result?.error) setError(result.error);
    });
  };

  const patientReady = patientMode === "new" ? npName.trim().length > 0 : !!selectedPatient;

  return (
    <div className="max-w-3xl mx-auto fade-in">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <BackButton href={returnTo} label="Back to Appointments" />
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--color-ink-900)]">Book Appointment</h1>
        <p className="text-sm text-[var(--color-ink-500)] mt-0.5">
          Fill in patient, doctor and slot details to book a new appointment.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">

        {/* ── STEP 0: Encounter type ── */}
        <section className="surface-card p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-400)] mb-3">
            Appointment Type
          </p>
          <div className="grid grid-cols-2 gap-3">
            {/* Walk-in */}
            <button
              type="button"
              onClick={() => setEncounterType("walkin")}
              className="relative flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all"
              style={encounterType === "walkin" ? {
                borderColor: "var(--color-primary-500)",
                background: "var(--color-primary-50)",
              } : {
                borderColor: "var(--color-border)",
                background: "var(--color-surface)",
              }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={encounterType === "walkin"
                  ? { background: "var(--color-primary-100)" }
                  : { background: "var(--color-surface-sunken)" }}
              >
                <User size={20} style={{ color: encounterType === "walkin" ? "var(--color-primary-700)" : "var(--color-ink-400)" }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: encounterType === "walkin" ? "var(--color-primary-800)" : "var(--color-ink-900)" }}>
                  Walk-in
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-ink-400)" }}>
                  Patient is present now
                </p>
              </div>
              {encounterType === "walkin" && (
                <CheckCircle2 size={16} className="absolute top-3 right-3" style={{ color: "var(--color-primary-600)" }} />
              )}
            </button>

            {/* Appointment */}
            <button
              type="button"
              onClick={() => setEncounterType("appointment")}
              className="relative flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all"
              style={encounterType === "appointment" ? {
                borderColor: "var(--color-primary-500)",
                background: "var(--color-primary-50)",
              } : {
                borderColor: "var(--color-border)",
                background: "var(--color-surface)",
              }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={encounterType === "appointment"
                  ? { background: "var(--color-primary-100)" }
                  : { background: "var(--color-surface-sunken)" }}
              >
                <Calendar size={20} style={{ color: encounterType === "appointment" ? "var(--color-primary-700)" : "var(--color-ink-400)" }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: encounterType === "appointment" ? "var(--color-primary-800)" : "var(--color-ink-900)" }}>
                  Appointment
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-ink-400)" }}>
                  Schedule a future slot
                </p>
              </div>
              {encounterType === "appointment" && (
                <CheckCircle2 size={16} className="absolute top-3 right-3" style={{ color: "var(--color-primary-600)" }} />
              )}
            </button>
          </div>
        </section>

        {/* ── STEP 1: Patient ── */}
        <section className="surface-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="size-6 rounded-full bg-[var(--color-primary-700)] text-white text-xs font-bold flex items-center justify-center">1</span>
              <h2 className="text-sm font-semibold text-[var(--color-ink-900)]">Patient Details</h2>
            </div>
            {/* Toggle */}
            <div className="flex gap-1 p-1 bg-[var(--color-surface-sunken)] rounded-xl">
              <button
                type="button"
                onClick={() => { setPatientMode("existing"); setSelectedPatient(null); setSearch(""); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  patientMode === "existing"
                    ? "bg-white shadow-sm text-[var(--color-primary-700)]"
                    : "text-[var(--color-ink-500)] hover:text-[var(--color-ink-700)]"
                }`}
              >
                <Search size={12} /> Existing
              </button>
              <button
                type="button"
                onClick={() => { setPatientMode("new"); setSelectedPatient(null); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  patientMode === "new"
                    ? "bg-white shadow-sm text-[var(--color-primary-700)]"
                    : "text-[var(--color-ink-500)] hover:text-[var(--color-ink-700)]"
                }`}
              >
                <UserPlus size={12} /> New
              </button>
            </div>
          </div>

          {patientMode === "existing" ? (
            selectedPatient ? (
              /* Selected patient chip */
              <div className="flex items-center justify-between p-4 rounded-2xl border-2 border-[var(--color-primary-500)] bg-[var(--color-primary-50)]">
                <div className="flex items-center gap-3">
                  <div className="size-11 rounded-full bg-[var(--color-primary-700)] flex items-center justify-center text-white font-bold">
                    {selectedPatient.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-ink-900)]">{selectedPatient.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span title="UDID (Doctor ID)" className="font-mono text-[10px] text-[#115E59] bg-[#F0F8F6] px-1.5 py-0.5 rounded">
                        {selectedPatient.udid}
                      </span>
                      {selectedPatient.uhid && (
                        <span title="UHID (Hospital ID)" className="font-mono text-[10px] text-[#1E4B8F] bg-[#F0F4FA] px-1.5 py-0.5 rounded">
                          {selectedPatient.uhid}
                        </span>
                      )}
                      <span className="text-xs text-[var(--color-ink-400)]">
                        {selectedPatient.age ?? "?"}y · {selectedPatient.sex.charAt(0)}
                      </span>
                      <span className="text-xs text-[var(--color-ink-400)]">{selectedPatient.mobile}</span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedPatient(null); setSearch(""); }}
                  className="text-xs text-[var(--color-ink-400)] hover:text-[var(--color-danger-600)] font-medium px-3 py-1.5 rounded-lg hover:bg-white transition-colors"
                >
                  Change
                </button>
              </div>
            ) : (
              /* Search list */
              <div>
                <div className="relative mb-3">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]" />
                  <input
                    type="text"
                    placeholder="Search by name, UHID or phone..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] bg-[var(--color-surface-sunken)]"
                  />
                </div>
                {filtered.length === 0 ? (
                  <div className="py-8 text-center border border-dashed border-[var(--color-border)] rounded-2xl">
                    <p className="text-sm text-[var(--color-ink-400)]">No patients found.</p>
                    <button
                      type="button"
                      onClick={() => setPatientMode("new")}
                      className="mt-2 text-sm text-[var(--color-primary-600)] hover:underline font-medium"
                    >
                      Register as new patient →
                    </button>
                  </div>
                ) : (
                  <ul className="divide-y divide-[var(--color-border)] rounded-2xl border border-[var(--color-border)] overflow-hidden max-h-56 overflow-y-auto scrollbar-thin">
                    {filtered.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => selectPatient(p)}
                          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--color-primary-50)] transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="size-9 rounded-full bg-[var(--color-surface-sunken)] flex items-center justify-center text-[var(--color-ink-500)] text-sm font-bold shrink-0">
                              {p.name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-[var(--color-ink-900)]">{p.name}</p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <span title="UDID (Doctor ID)" className="font-mono text-[10px] text-[#115E59] bg-[#F0F8F6] px-1.5 py-0.5 rounded">{p.udid}</span>
                                {p.uhid && (
                                  <span title="UHID (Hospital ID)" className="font-mono text-[10px] text-[#1E4B8F] bg-[#F0F4FA] px-1.5 py-0.5 rounded">{p.uhid}</span>
                                )}
                                <span className="text-xs text-[var(--color-ink-400)]">{p.age ?? "?"}y {p.sex.charAt(0)}</span>
                                <span className="text-[var(--color-ink-300)] text-xs">·</span>
                                <span className="text-xs text-[var(--color-ink-400)]">{p.mobile}</span>
                              </div>
                            </div>
                          </div>
                          <ChevronRight size={14} className="text-[var(--color-ink-300)] shrink-0" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          ) : (
            /* New patient form */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Name */}
              <div className="sm:col-span-2">
                <FieldLabel icon={<User size={12} />}>Full Name *</FieldLabel>
                <input
                  required
                  value={npName}
                  onChange={(e) => setNpName(e.target.value)}
                  placeholder="Patient full name"
                  className={inputCls}
                />
              </div>

              {/* DOB + Sex */}
              <div>
                <FieldLabel>Date of Birth *</FieldLabel>
                <input
                  required
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  value={npDob}
                  onChange={(e) => setNpDob(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <FieldLabel>Sex *</FieldLabel>
                <select
                  required
                  value={npSex}
                  onChange={(e) => setNpSex(e.target.value)}
                  className={inputCls}
                >
                  {SEXES.map((s) => (
                    <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
                  ))}
                </select>
              </div>

              {/* Phone + Aadhaar */}
              <div>
                <FieldLabel icon={<Phone size={12} />}>Phone *</FieldLabel>
                <input
                  required
                  type="tel"
                  value={npMobile}
                  onChange={(e) => setNpMobile(e.target.value)}
                  placeholder="10-digit mobile"
                  className={inputCls}
                />
              </div>
              {/* Category */}
              <div className="sm:col-span-2">
                <FieldLabel>Category</FieldLabel>
                <div className="flex flex-wrap gap-2 mt-0.5">
                  {[
                    { value: "GENERAL",   label: "General" },
                    { value: "BPL",       label: "BPL" },
                    { value: "ECHS",      label: "ECHS" },
                    { value: "INSURANCE", label: "Insurance" },
                  ].map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setNpCategory(c.value)}
                      className="px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors"
                      style={npCategory === c.value ? {
                        background: "var(--color-primary-700)", color: "#fff",
                        borderColor: "var(--color-primary-700)",
                      } : {
                        background: "#fff", color: "var(--color-ink-700)",
                        borderColor: "var(--color-border)",
                      }}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chief Complaint */}
              <div className="sm:col-span-2">
                <FieldLabel icon={<FileText size={12} />}>Notes/Instructions</FieldLabel>
                <textarea
                  value={npComplaint}
                  onChange={(e) => setNpComplaint(e.target.value)}
                  rows={2}
                  placeholder="Reason for visit, referral details..."
                  className={inputCls}
                />
              </div>

              {/* Photos & Documents */}
              <div className="sm:col-span-2">
                <FieldLabel>Photos</FieldLabel>
                <div className="grid grid-cols-2 gap-3 mt-0.5">
                  <SmartUploadBox
                    label="Aadhaar Photocopy"
                    uploadLabel="Upload Aadhaar"
                    subtitle="Image or PDF"
                    accept="image/*,application/pdf"
                    value={aadhaarPhoto}
                    onChange={setAadhaarPhoto}
                  />
                  <SmartUploadBox
                    label="Patient Photo"
                    uploadLabel="Upload Photo"
                    subtitle="JPG / PNG"
                    accept="image/jpeg,image/jpg,image/png"
                    value={patientPhoto}
                    onChange={setPatientPhoto}
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── STEP 2: Appointment Details ── */}
        <section className="surface-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="size-6 rounded-full bg-[var(--color-primary-700)] text-white text-xs font-bold flex items-center justify-center">2</span>
            <h2 className="text-sm font-semibold text-[var(--color-ink-900)]">Appointment Details</h2>
          </div>

          <div className="flex flex-col gap-5">
            {/* Hospital selector — DOCTOR role only (hospital role has fixed hospitalId) */}
            {!hospitalId && doctorHospitals.length >= 1 && (
              <div>
                <FieldLabel icon={<Building2 size={12} />}>Hospital *</FieldLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {doctorHospitals.map((h) => (
                    <label key={h.id} className={`flex items-center gap-2 px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                      selectedHospitalId === h.id
                        ? "border-[var(--color-primary-600)] bg-[var(--color-primary-50)]"
                        : "border-[var(--color-border)] bg-white hover:bg-[var(--color-surface-sunken)]"
                    }`}>
                      <input
                        type="radio"
                        name="hospital"
                        value={h.id}
                        checked={selectedHospitalId === h.id}
                        onChange={() => { setSelectedHospitalId(h.id); setTime("09:00"); }}
                        className="accent-[var(--color-primary-600)]"
                      />
                      <span className="text-sm font-medium text-[var(--color-ink-900)]">{h.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Date + Time — only for scheduled appointment */}
            {encounterType === "appointment" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <FieldLabel icon={<Calendar size={12} />}>Date *</FieldLabel>
                  <input
                    required
                    type="date"
                    value={date}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <FieldLabel icon={<Clock size={12} />}>Time *</FieldLabel>
                    {usingAvailability ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-primary-100)] text-[var(--color-primary-700)] font-medium">
                        From availability
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] text-[var(--color-ink-400)]">
                        <Info size={10} /> No schedule set — showing all slots
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto scrollbar-thin pr-1">
                    {availableSlots.length === 0 && (
                      <p className="text-xs text-[var(--color-ink-400)] italic py-1">
                        {usingAvailability
                          ? "No slots available — all slots are booked or the session has passed."
                          : "No slots available for today. Please select a future date."}
                      </p>
                    )}
                    {availableSlots.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTime(t)}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors"
                        style={time === t ? {
                          background: "var(--color-primary-700)",
                          color: "#fff",
                          borderColor: "var(--color-primary-700)",
                        } : {
                          background: "#fff",
                          color: "var(--color-ink-700)",
                          borderColor: "var(--color-border)",
                        }}
                      >
                        {to12h(t)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm" style={{ background: "var(--color-primary-50)", color: "var(--color-primary-700)" }}>
                <Clock size={14} />
                Walk-in will be recorded at the current date & time automatically.
              </div>
            )}

            {/* Visit Type */}
            <div>
              <FieldLabel>Visit Type</FieldLabel>
              <div className="flex flex-wrap gap-2 mt-1">
                {VISIT_TYPES.map((vt) => (
                  <button
                    key={vt}
                    type="button"
                    onClick={() => setVisitType(vt)}
                    className="px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors"
                    style={visitType === vt ? {
                      background: "var(--color-primary-700)",
                      color: "#fff",
                      borderColor: "var(--color-primary-700)",
                    } : {
                      background: "#fff",
                      color: "var(--color-ink-700)",
                      borderColor: "var(--color-border)",
                    }}
                  >
                    {vt}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <FieldLabel icon={<FileText size={12} />}>Chief Complaint *</FieldLabel>
              <textarea
                required
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Describe the patient's chief complaint..."
                className={inputCls}
              />
            </div>
          </div>
        </section>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-[var(--color-danger-600)] bg-[var(--color-danger-100)] px-4 py-2.5 rounded-xl">
            <AlertCircle size={15} /> {error}
          </div>
        )}

        {/* Summary + submit */}
        <div className="surface-card p-4 flex items-center justify-between gap-4">
          <div className="text-sm text-[var(--color-ink-500)]">
            {patientReady ? (
              <span>
                <span className="font-medium text-[var(--color-ink-900)]">
                  {patientMode === "new" ? (npName || "New Patient") : selectedPatient?.name}
                </span>
                {" · "}{visitType}
                {encounterType === "appointment" && ` · ${date} at ${time}`}
                {encounterType === "walkin" && (
                  <span className="ml-1.5 text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: "var(--color-primary-100)", color: "var(--color-primary-700)" }}>
                    Walk-in
                  </span>
                )}
              </span>
            ) : (
              <span className="italic">Select or register a patient to continue</span>
            )}
          </div>
          <button
            type="submit"
            disabled={pending || !patientReady}
            className="flex items-center gap-2 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors shrink-0 disabled:opacity-50"
            style={{ background: "var(--color-primary-700)" }}
          >
            <Calendar size={15} />
            {pending ? "Booking…" : encounterType === "walkin" ? "Register Walk-in" : "Book Appointment"}
          </button>
        </div>
      </form>
    </div>
  );
}

function FieldLabel({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <label className="flex items-center gap-1.5 text-xs font-semibold tracking-widest text-[var(--color-ink-500)] uppercase mb-1.5">
      {icon && <span className="text-[var(--color-ink-400)]">{icon}</span>}
      {children}
    </label>
  );
}

const inputCls =
  "mt-0.5 w-full rounded-xl border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] transition-shadow";
