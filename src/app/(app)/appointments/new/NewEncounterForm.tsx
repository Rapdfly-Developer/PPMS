"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search, Stethoscope, UserPlus, Users,
  User, Phone, FileText, CalendarDays,
} from "lucide-react";
import { BackButton } from "@/components/ui/BackButton";
import { SmartUploadBox, type UploadedFile } from "@/components/ui/SmartUploadBox";
import { createWalkInEncounter } from "./actions";

const VISIT_TYPES = [
  "General OPD",
  "Specialist OPD",
  "Emergency",
  "Follow-up",
  "Post-op Review",
];

const CATEGORIES = [
  { value: "GENERAL",   label: "General" },
  { value: "BPL",       label: "BPL" },
  { value: "ECHS",      label: "ECHS" },
  { value: "INSURANCE", label: "Insurance" },
];

type Patient = { id: string; name: string; udid: string; age: number | null; sex: string };

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

export function NewEncounterForm({
  patients,
  hospitals,
}: {
  patients: Patient[];
  hospitals: { id: string; name: string }[];
}) {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? "/dashboard";
  const [pending, startTransition] = useTransition();

  // ── mode toggle ──────────────────────────────────────────────────────────
  const [patientMode, setPatientMode] = useState<"existing" | "new">("existing");

  // ── existing patient ─────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // ── new patient fields ───────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [sex, setSex] = useState("Male");
  const [mobile, setMobile] = useState("");
  const [category, setCategory] = useState("GENERAL");
  const [complaint, setComplaint] = useState("");
  const [aadhaarPhoto, setAadhaarPhoto] = useState<UploadedFile | null>(null);
  const [patientPhoto, setPatientPhoto] = useState<UploadedFile | null>(null);

  // ── shared ───────────────────────────────────────────────────────────────
  const [visitType, setVisitType] = useState("General OPD");
  const [hospitalId, setHospitalId] = useState(hospitals[0]?.id ?? "");
  const [error, setError] = useState("");

  const filtered = search.trim()
    ? patients.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.udid.toLowerCase().includes(search.toLowerCase())
      )
    : patients.slice(0, 8);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!hospitalId) { setError("Please select a hospital."); return; }

    const fd = new FormData();
    fd.set("mode", patientMode);
    fd.set("visitType", visitType);
    fd.set("hospitalId", hospitalId);

    if (patientMode === "existing") {
      if (!selectedPatient) { setError("Please select a patient."); return; }
      fd.set("patientId", selectedPatient.id);
    } else {
      if (!name.trim())      { setError("Patient name is required."); return; }
      if (!dob)              { setError("Date of birth is required."); return; }
      if (!mobile.trim())    { setError("Phone number is required."); return; }
      if (!complaint.trim()) { setError("Chief complaint is required."); return; }
      if (!patientPhoto)    { setError("Patient photo is required."); return; }

      const dobAge = Math.floor(
        (Date.now() - new Date(dob).getTime()) / (365.25 * 86_400_000)
      );
      fd.set("name", name.trim());
      fd.set("age", String(dobAge));
      fd.set("sex", sex);
      fd.set("mobile", mobile.trim());
      fd.set("category", category);
      fd.set("complaint", complaint.trim());
      if (patientPhoto) fd.set("patientPhoto", patientPhoto.savedName);
      if (aadhaarPhoto) fd.set("aadhaarPhoto", aadhaarPhoto.savedName);
    }

    startTransition(async () => {
      const result = await createWalkInEncounter(fd);
      if (result?.error) setError(result.error);
    });
  };

  return (
    <div className="max-w-2xl mx-auto fade-in">
      <h1 className="text-xl font-semibold text-[var(--color-ink-900)] mb-1">New Encounter</h1>
      <p className="text-sm text-[var(--color-ink-500)] mb-6">
        Start a walk-in visit and open the patient&apos;s EMR immediately.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">

        {/* ── Patient card ───────────────────────────────────────────────── */}
        <div className="surface-card p-5">
          {/* Section header with numbered badge */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <span className="size-6 rounded-full bg-[var(--color-primary-700)] text-white text-xs font-bold flex items-center justify-center shrink-0">
                1
              </span>
              <span className="text-sm font-semibold text-[var(--color-ink-800)]">Patient Details</span>
            </div>
            {/* Existing / New toggle */}
            <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden text-xs font-semibold">
              <button
                type="button"
                onClick={() => { setPatientMode("existing"); setError(""); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${
                  patientMode === "existing"
                    ? "bg-[var(--color-primary-700)] text-white"
                    : "bg-white text-[var(--color-ink-500)] hover:bg-[var(--color-surface-hover)]"
                }`}
              >
                <Users size={13} /> Existing
              </button>
              <button
                type="button"
                onClick={() => { setPatientMode("new"); setSelectedPatient(null); setSearch(""); setError(""); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${
                  patientMode === "new"
                    ? "bg-[var(--color-primary-700)] text-white"
                    : "bg-white text-[var(--color-ink-500)] hover:bg-[var(--color-surface-hover)]"
                }`}
              >
                <UserPlus size={13} /> New
              </button>
            </div>
          </div>

          {/* ── Existing patient search ─────────────────────────────────── */}
          {patientMode === "existing" && (
            <>
              <div className="relative mb-3">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]" />
                <input
                  type="text"
                  placeholder="Search by name or UHID..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setSelectedPatient(null); }}
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
                />
              </div>

              {selectedPatient ? (
                <div className="flex items-center justify-between p-3 rounded-xl border-2 border-[var(--color-primary-500)] bg-[var(--color-primary-50)]">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-full bg-[var(--color-primary-700)] flex items-center justify-center text-white text-xs font-bold">
                      {selectedPatient.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--color-ink-900)]">{selectedPatient.name}</p>
                      <p className="text-xs text-[var(--color-ink-400)]">
                        {selectedPatient.udid} · {selectedPatient.age ?? "?"}y {selectedPatient.sex.charAt(0)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedPatient(null); setSearch(""); }}
                    className="text-xs text-[var(--color-ink-400)] hover:text-[var(--color-danger-600)]"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <ul className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)] overflow-hidden max-h-64 overflow-y-auto">
                  {filtered.length === 0 ? (
                    <li className="py-6 text-center text-sm text-[var(--color-ink-400)]">No patients found.</li>
                  ) : (
                    filtered.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => { setSelectedPatient(p); setSearch(""); }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--color-primary-50)] transition-colors"
                        >
                          <div className="size-8 rounded-full bg-[var(--color-surface-sunken)] flex items-center justify-center text-[var(--color-ink-500)] text-xs font-bold shrink-0">
                            {p.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[var(--color-ink-900)]">{p.name}</p>
                            <p className="text-xs text-[var(--color-ink-400)]">{p.udid} · {p.age ?? "?"}y {p.sex.charAt(0)}</p>
                          </div>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </>
          )}

          {/* ── New patient form ────────────────────────────────────────── */}
          {patientMode === "new" && (
            <div className="flex flex-col gap-5">

              {/* Full Name */}
              <div>
                <FieldLabel icon={<User size={12} />}>Full Name *</FieldLabel>
                <input
                  type="text"
                  placeholder="Patient full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputCls}
                />
              </div>

              {/* DOB + Sex */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel icon={<CalendarDays size={12} />}>Date of Birth *</FieldLabel>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                    className={inputCls}
                  />
                </div>
                <div>
                  <FieldLabel>Sex *</FieldLabel>
                  <select
                    value={sex}
                    onChange={(e) => setSex(e.target.value)}
                    className={inputCls}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Phone */}
              <div>
                <FieldLabel icon={<Phone size={12} />}>Phone *</FieldLabel>
                <input
                  type="tel"
                  placeholder="10-digit mobile number"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  maxLength={10}
                  className={inputCls}
                />
              </div>

              {/* Category */}
              <div>
                <FieldLabel>Category</FieldLabel>
                <div className="flex flex-wrap gap-2 mt-0.5">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCategory(c.value)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                        category === c.value
                          ? "bg-[var(--color-primary-700)] text-white border-[var(--color-primary-700)]"
                          : "bg-white text-[var(--color-ink-600)] border-[var(--color-border)] hover:border-[var(--color-primary-400)]"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chief Complaint */}
              <div>
                <FieldLabel icon={<FileText size={12} />}>Chief Complaint *</FieldLabel>
                <textarea
                  placeholder="Presenting complaint or reason for visit..."
                  value={complaint}
                  onChange={(e) => setComplaint(e.target.value)}
                  rows={2}
                  className={`${inputCls} resize-none`}
                />
              </div>

              {/* Photos */}
              <div>
                <FieldLabel>Photos *</FieldLabel>
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
                    label="Patient Photo *"
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
        </div>

        {/* ── Visit type ─────────────────────────────────────────────────── */}
        <div className="surface-card p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <span className="size-6 rounded-full bg-[var(--color-primary-700)] text-white text-xs font-bold flex items-center justify-center shrink-0">
              2
            </span>
            <span className="text-sm font-semibold text-[var(--color-ink-800)]">Visit Type</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {VISIT_TYPES.map((vt) => (
              <button
                key={vt}
                type="button"
                onClick={() => setVisitType(vt)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                  visitType === vt
                    ? "bg-[var(--color-primary-700)] text-white border-[var(--color-primary-700)]"
                    : "bg-white text-[var(--color-ink-700)] border-[var(--color-border)] hover:border-[var(--color-primary-400)]"
                }`}
              >
                {vt}
              </button>
            ))}
          </div>
        </div>

        {/* ── Hospital ───────────────────────────────────────────────────── */}
        {hospitals.length >= 1 && (
          <div className="surface-card p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="size-6 rounded-full bg-[var(--color-primary-700)] text-white text-xs font-bold flex items-center justify-center shrink-0">
                3
              </span>
              <span className="text-sm font-semibold text-[var(--color-ink-800)]">Hospital</span>
            </div>
            <select
              value={hospitalId}
              onChange={(e) => setHospitalId(e.target.value)}
              className={inputCls}
            >
              {hospitals.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>
        )}

        {error && (
          <p className="text-sm text-[var(--color-danger-600)] bg-[var(--color-danger-50)] border border-[var(--color-danger-200)] px-4 py-2.5 rounded-xl">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending || (patientMode === "existing" && !selectedPatient)}
          className="flex items-center justify-center gap-2 bg-[var(--color-primary-900)] text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-[var(--color-primary-700)] disabled:opacity-50 transition-colors"
        >
          <Stethoscope size={16} />
          {pending ? "Opening EMR..." : "Start Encounter"}
        </button>
      </form>
    </div>
  );
}
