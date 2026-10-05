"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search, Stethoscope, UserPlus, Users,
  User, Phone, FileText, CalendarDays,
  Building2, AlertCircle, Download, Loader2, ListOrdered,
  Plus, X,
} from "lucide-react";
import { BackButton } from "@/components/ui/BackButton";
import { SmartUploadBox, type UploadedFile } from "@/components/ui/SmartUploadBox";
import { createWalkInEncounter } from "./actions";
import { getLastVisitCC } from "@/app/(app)/appointments/book/actions";
import { ComplaintCombobox } from "@/components/ui/ComplaintCombobox";
import { keywordEntries } from "@/components/emr/KeywordField";
import { CHIEF_COMPLAINT_FIELD_KEY } from "@/lib/constants";
import { ComplaintChips } from "@/components/ui/ComplaintChips";

function sinceToDays(sinceStr: string): number {
  const m = sinceStr.match(/(\d+)\s*(days?|weeks?|months?|years?)/i);
  if (!m) return 0;
  const n = parseInt(m[1]);
  const u = m[2].toLowerCase();
  if (u.startsWith("day")) return n;
  if (u.startsWith("week")) return n * 7;
  if (u.startsWith("month")) return n * 30;
  if (u.startsWith("year")) return n * 365;
  return 0;
}

function daysToParts(days: number): { num: string; unit: string } {
  if (days <= 30) return { num: String(days), unit: "days" };
  const weeks = Math.round(days / 7);
  if (weeks <= 30) return { num: String(weeks), unit: "weeks" };
  const months = Math.round(days / 30);
  if (months <= 30) return { num: String(months), unit: "months" };
  return { num: String(Math.min(30, Math.round(days / 365))), unit: "years" };
}

type ComplaintEntry = { lat: string; text: string; sinceNum: string; sinceUnit: string };

function isDuplicateEntry(entry: ComplaintEntry, list: ComplaintEntry[], excludeIndex?: number): boolean {
  return list.some(
    (b, i) =>
      i !== excludeIndex &&
      b.lat.toLowerCase() === entry.lat.toLowerCase() &&
      b.text.toLowerCase() === entry.text.toLowerCase() &&
      b.sinceNum === entry.sinceNum &&
      b.sinceUnit === entry.sinceUnit,
  );
}

function serializeEntries(entries: ComplaintEntry[]): string {
  return entries
    .filter((e) => e.text.trim())
    .map((e) =>
      [e.lat ? `[${e.lat}]` : "", e.sinceNum ? `[${e.sinceNum} ${e.sinceUnit}]` : "", e.text.trim()]
        .filter(Boolean)
        .join(" ")
    )
    .join(" | ");
}

function parseImportedCC(notes: string): ComplaintEntry[] {
  const segments = notes.split(" | ").map((s) => s.trim()).filter(Boolean);
  if (segments.length === 0) return [];
  // New canonical: [RE] [3 days] text | ...
  if (/^\[(RE|LE|OU)\]/.test(segments[0])) {
    return segments.map((seg) => {
      const latM = seg.match(/^\[(RE|LE|OU)\]\s*/);
      const lat = latM ? latM[1] : "";
      let rest = latM ? seg.slice(latM[0].length) : seg;
      const sinceM = rest.match(/^\[(\d+)\s+(days|weeks|months|years)\]\s*/);
      const sinceNum = sinceM ? sinceM[1] : "";
      const sinceUnit = sinceM ? sinceM[2] : "days";
      if (sinceM) rest = rest.slice(sinceM[0].length);
      return { lat, text: rest.trim(), sinceNum, sinceUnit };
    }).filter((e) => e.text);
  }
  // Old format: RE | Since: 3 days | text
  if (segments.length >= 3 && ["RE", "LE", "OU"].includes(segments[0])) {
    const lat = segments[0];
    const sinceMatch = segments[1].match(/Since:\s*(.+)/i);
    const prevSinceDays = sinceMatch ? sinceToDays(sinceMatch[1].trim()) : 0;
    const text = segments.slice(2).join(" | ").trim();
    const { num, unit } = prevSinceDays > 0 ? daysToParts(prevSinceDays) : { num: "", unit: "days" };
    return text ? [{ lat, text, sinceNum: num, sinceUnit: unit }] : [];
  }
  const t = notes.trim();
  return t ? [{ lat: "", text: t, sinceNum: "", sinceUnit: "days" }] : [];
}

const VISIT_TYPES = [
  "General OPD",
  "Emergency",
  "Follow-up",
  "Pre-op",
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
  autoHospital,
  currentTimeIST,
  role,
}: {
  patients: Patient[];
  autoHospital: { id: string; name: string } | null;
  currentTimeIST: string;
  role: string;
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
  const [occupation, setOccupation] = useState("");
  const [notes, setNotes] = useState("");
  // referral
  const [referredBy, setReferredBy] = useState("");
  const [referralPatient, setReferralPatient] = useState<Patient | null>(null);
  const [referralRelationship, setReferralRelationship] = useState("");
  const [refSearch, setRefSearch] = useState("");
  const [showRefPatient, setShowRefPatient] = useState(false);
  const [composerLat, setComposerLat] = useState("");
  const [composerText, setComposerText] = useState("");
  const [composerSinceNum, setComposerSinceNum] = useState("");
  const [composerSinceUnit, setComposerSinceUnit] = useState("days");
  const [bullets, setBullets] = useState<ComplaintEntry[]>([]);
  const [composerError, setComposerError] = useState("");
  const [kwTick, setKwTick] = useState(0);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [aadhaarPhoto, setAadhaarPhoto] = useState<UploadedFile | null>(null);
  const [patientPhoto, setPatientPhoto] = useState<UploadedFile | null>(null);

  // ── shared ───────────────────────────────────────────────────────────────
  const [visitType, setVisitType] = useState("General OPD");
  const hospitalId = autoHospital?.id ?? "";
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);

  async function handleImportPrevCC() {
    if (!selectedPatient) return;
    setImporting(true);
    try {
      const data = await getLastVisitCC(selectedPatient.id);
      if (!data) return;
      const elapsed = Math.max(0, Math.round((Date.now() - new Date(data.visitDate).getTime()) / 86_400_000));
      const imported = parseImportedCC(data.notes)
        .map((e) => {
          if (!e.sinceNum) return e;
          const prevDays = sinceToDays(`${e.sinceNum} ${e.sinceUnit}`);
          const { num, unit } = daysToParts(prevDays + elapsed);
          return { ...e, sinceNum: num, sinceUnit: unit };
        })
        .filter((e) => e.text.trim());
      if (imported.length === 0) return;
      setBullets(imported);
      setComposerLat(""); setComposerText(""); setComposerSinceNum(""); setComposerSinceUnit("days");
      setComposerError("");
    } catch {
      // silently ignore — fields remain as-is
    } finally {
      setImporting(false);
    }
  }

  function handleAddComplaint() {
    setComposerError("");
    const text = composerText.trim();
    if (!text) return;
    if (visitType === "General OPD") {
      if (!composerLat) { setComposerError("Please select laterality (RE, LE, or OU)."); return; }
      if (!composerSinceNum) { setComposerError("Please enter the duration."); return; }
    }
    const entry: ComplaintEntry = { lat: composerLat, text, sinceNum: composerSinceNum, sinceUnit: composerSinceUnit };
    if (isDuplicateEntry(entry, bullets, editingIndex ?? undefined)) {
      setComposerError("This complaint is already in the list.");
      return;
    }
    if (editingIndex !== null) {
      setBullets((prev) => prev.map((b, i) => (i === editingIndex ? entry : b)));
      setEditingIndex(null);
    } else {
      setBullets((prev) => [...prev, entry]);
    }
    setComposerLat(""); setComposerText(""); setComposerSinceNum(""); setComposerSinceUnit("days");
  }

  function editBullet(i: number) {
    const b = bullets[i];
    setComposerLat(b.lat); setComposerText(b.text);
    setComposerSinceNum(b.sinceNum); setComposerSinceUnit(b.sinceUnit);
    setComposerError("");
    setEditingIndex(i);
  }

  function cancelEdit() {
    setEditingIndex(null);
    setComposerLat(""); setComposerText(""); setComposerSinceNum(""); setComposerSinceUnit("days");
    setComposerError("");
  }

  function saveComposerAsKeyword() {
    const text = (keywordEntries(composerText).at(-1) ?? "").trim();
    if (!text) return;
    try {
      const key = `kw_${CHIEF_COMPLAINT_FIELD_KEY}`;
      const existing: string[] = JSON.parse(localStorage.getItem(key) ?? "[]");
      if (!existing.some((k) => k.toLowerCase() === text.toLowerCase())) {
        localStorage.setItem(key, JSON.stringify([...existing, text]));
        setKwTick((t) => t + 1);
      }
    } catch {}
  }

  const filtered = search.trim()
    ? patients.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.udid.toLowerCase().includes(search.toLowerCase())
      )
    : patients.slice(0, 8);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const intent = submitter?.dataset.intent ?? "startEncounter";

    if (!hospitalId) { setError("No hospital detected for the current time. Please check your schedule."); return; }

    const fd = new FormData();
    fd.set("mode", patientMode);
    fd.set("visitType", visitType);
    fd.set("hospitalId", hospitalId);
    fd.set("intent", intent);
    // date and time are intentionally omitted — the server action defaults to now()

    const isGeneralOPD = visitType === "General OPD";
    let finalEntries = [...bullets];
    if (composerText.trim()) {
      if (isGeneralOPD) {
        if (!composerLat) { setError("Please select laterality, RE, LE, or OU."); return; }
        if (!composerSinceNum) { setError("Please select the 'Since' duration."); return; }
      }
      const composerEntry: ComplaintEntry = {
        lat: composerLat, text: composerText.trim(),
        sinceNum: composerSinceNum, sinceUnit: composerSinceUnit,
      };
      if (!isDuplicateEntry(composerEntry, finalEntries, editingIndex ?? undefined)) {
        if (editingIndex !== null) {
          finalEntries = finalEntries.map((e, i) => (i === editingIndex ? composerEntry : e));
        } else {
          finalEntries = [...finalEntries, composerEntry];
        }
      }
    }
    if (finalEntries.length === 0) {
      setError(isGeneralOPD ? "Please add at least one chief complaint." : "Please describe the chief complaint.");
      return;
    }
    const fullComplaint = serializeEntries(finalEntries);
    fd.set("complaint", fullComplaint);

    if (patientMode === "existing") {
      if (!selectedPatient) { setError("Please select a patient."); return; }
      fd.set("patientId", selectedPatient.id);
    } else {
      if (!name.trim())        { setError("Patient name is required."); return; }
      if (!dob)                { setError("Date of birth is required."); return; }
      if (!mobile.trim())      { setError("Phone number is required."); return; }
      if (!occupation.trim())  { setError("Occupation is required."); return; }

      const dobAge = Math.floor(
        (Date.now() - new Date(dob).getTime()) / (365.25 * 86_400_000)
      );
      fd.set("name", name.trim());
      fd.set("age", String(dobAge));
      fd.set("dob", dob);
      fd.set("sex", sex);
      fd.set("mobile", mobile.trim());
      fd.set("category", category);
      fd.set("occupation", occupation.trim());
      if (notes.trim()) fd.set("notes", notes.trim());
      if (referredBy.trim()) fd.set("referredBy", referredBy.trim());
      if (referralPatient) {
        fd.set("referralPatientId", referralPatient.id);
        if (referralRelationship.trim()) fd.set("referralRelationship", referralRelationship.trim());
      }
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
      <h1 className="text-lg sm:text-xl font-semibold text-[var(--color-ink-900)] mb-1">New Encounter</h1>
      <p className="text-sm text-[var(--color-ink-500)] mb-6">
        {role === "DOCTOR"
          ? "Start a walk-in visit and open the patient’s EMR, or add them to the queue."
          : "Add a walk-in patient to the queue."}
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

              {/* DOB + Sex + Occupation */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                <div>
                  <FieldLabel icon={<Building2 size={12} />}>Occupation *</FieldLabel>
                  <input
                    type="text"
                    placeholder="e.g. Farmer, Teacher"
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    className={inputCls}
                  />
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

              {/* Notes / Instructions */}
              <div>
                <FieldLabel icon={<FileText size={12} />}>Notes / Instructions</FieldLabel>
                <textarea
                  rows={3}
                  placeholder="Any additional notes or instructions for this patient…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={`${inputCls} resize-none`}
                />
              </div>

              {/* Referral */}
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] p-4 flex flex-col gap-3">
                <p className="text-xs font-semibold text-[var(--color-ink-700)] uppercase tracking-widest">Referral (optional)</p>

                {/* Free-text source */}
                <div>
                  <FieldLabel>Referred By</FieldLabel>
                  <input
                    type="text"
                    placeholder="e.g. Dr. Sharma, City Hospital, Friend, Advertisement…"
                    value={referredBy}
                    onChange={(e) => setReferredBy(e.target.value)}
                    className={inputCls}
                  />
                </div>

                {/* Link to existing patient */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <FieldLabel>Existing Patient / Relative</FieldLabel>
                    <button
                      type="button"
                      onClick={() => { setShowRefPatient(!showRefPatient); setReferralPatient(null); setRefSearch(""); setReferralRelationship(""); }}
                      className="text-caption font-semibold text-[var(--color-primary-700)] hover:underline"
                    >
                      {showRefPatient ? "Cancel" : "Link patient"}
                    </button>
                  </div>

                  {showRefPatient && (
                    referralPatient ? (
                      <div className="flex items-center justify-between p-3 rounded-xl border-2 border-[var(--color-primary-500)] bg-[var(--color-primary-50)]">
                        <div>
                          <p className="text-sm font-semibold text-[var(--color-ink-900)]">{referralPatient.name}</p>
                          <p className="text-xs text-[var(--color-ink-400)]">{referralPatient.udid} · {referralPatient.age ?? "?"}y {referralPatient.sex.charAt(0)}</p>
                        </div>
                        <button type="button" onClick={() => { setReferralPatient(null); setRefSearch(""); }} className="text-xs text-[var(--color-ink-400)] hover:text-[var(--color-danger-600)]">Change</button>
                      </div>
                    ) : (
                      <>
                        <input
                          type="text"
                          placeholder="Search by name or UDID…"
                          value={refSearch}
                          onChange={(e) => setRefSearch(e.target.value)}
                          className={inputCls}
                        />
                        {refSearch.trim() && (
                          <ul className="mt-1 divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)] overflow-hidden max-h-40 overflow-y-auto">
                            {patients.filter((p) =>
                              p.name.toLowerCase().includes(refSearch.toLowerCase()) ||
                              p.udid.toLowerCase().includes(refSearch.toLowerCase())
                            ).slice(0, 6).map((p) => (
                              <li key={p.id}>
                                <button type="button" onClick={() => { setReferralPatient(p); setRefSearch(""); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[var(--color-primary-50)] transition-colors">
                                  <div className="size-7 rounded-full bg-[var(--color-surface-sunken)] flex items-center justify-center text-[var(--color-ink-500)] text-xs font-bold shrink-0">{p.name.charAt(0)}</div>
                                  <div>
                                    <p className="text-sm font-medium text-[var(--color-ink-900)]">{p.name}</p>
                                    <p className="text-xs text-[var(--color-ink-400)]">{p.udid} · {p.age ?? "?"}y {p.sex.charAt(0)}</p>
                                  </div>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )
                  )}

                  {/* Relationship selector — shown once a patient is linked */}
                  {showRefPatient && referralPatient && (
                    <div className="mt-3">
                      <FieldLabel>Relationship</FieldLabel>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {["Brother", "Sister", "Parent", "Child", "Spouse", "Relative", "Friend", "Other"].map((rel) => (
                          <button
                            key={rel}
                            type="button"
                            onClick={() => setReferralRelationship(referralRelationship === rel ? "" : rel)}
                            className="px-3 py-1 rounded-full text-xs font-medium border transition-colors"
                            style={referralRelationship === rel ? {
                              background: "var(--color-primary-700)", color: "#fff", borderColor: "var(--color-primary-700)",
                            } : {
                              background: "#fff", color: "var(--color-ink-600)", borderColor: "var(--color-border)",
                            }}
                          >
                            {rel}
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        placeholder="Or type a custom relationship…"
                        value={referralRelationship}
                        onChange={(e) => setReferralRelationship(e.target.value)}
                        className={`${inputCls} mt-2`}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Photos */}
              <div>
                <FieldLabel>Photos</FieldLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-0.5">
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
        </div>

        {/* ── Appointment Details ────────────────────────────────────────── */}
        <div className="surface-card p-5">
          <div className="flex items-center gap-2.5 mb-5">
            <span className="size-6 rounded-full bg-[var(--color-primary-700)] text-white text-xs font-bold flex items-center justify-center shrink-0">
              2
            </span>
            <span className="text-sm font-semibold text-[var(--color-ink-800)]">Appointment Details</span>
          </div>

          <div className="flex flex-col gap-5">

            {/* No-schedule warning — shown only when auto-detection fails */}
            {!autoHospital && (
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50">
                <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">No schedule found for {currentTimeIST}</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    The doctor is not currently scheduled at any hospital. Please check your availability settings or contact the administrator.
                  </p>
                </div>
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

            {/* Chief Complaint */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <FieldLabel icon={<FileText size={12} />}>Chief Complaint *</FieldLabel>
                {visitType === "Follow-up" && patientMode === "existing" && selectedPatient && (
                  <button
                    type="button"
                    onClick={handleImportPrevCC}
                    disabled={importing}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-caption font-semibold border border-[var(--color-primary-200)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)] hover:bg-[var(--color-primary-100)] disabled:opacity-60 transition-colors"
                  >
                    {importing ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                    {importing ? "Importing…" : "Import from last visit"}
                  </button>
                )}
              </div>

              {/* Composer row: lat | text | since */}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap sm:flex-nowrap">
                <div className="flex gap-1 shrink-0">
                  {(["RE", "LE", "OU"] as const).map((lat) => (
                    <button
                      key={lat}
                      type="button"
                      onClick={() => { setComposerLat(composerLat === lat ? "" : lat); setComposerError(""); }}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors"
                      style={composerLat === lat ? {
                        background: "var(--color-primary-700)", color: "#fff", borderColor: "var(--color-primary-700)",
                      } : {
                        background: "#fff", color: "var(--color-ink-600)", borderColor: "var(--color-border)",
                      }}
                    >
                      {lat}
                    </button>
                  ))}
                </div>
                <textarea
                  value={composerText}
                  onChange={(e) => { setComposerText(e.target.value); setComposerError(""); }}
                  placeholder="Chief complaint…"
                  rows={Math.max(1, Math.min(5, composerText.split("\n").length))}
                  className="flex-1 min-w-0 resize-none rounded-xl border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm leading-5 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] transition-shadow"
                />
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs text-[var(--color-ink-500)]">Since</span>
                  <select
                    value={composerSinceNum}
                    onChange={(e) => setComposerSinceNum(e.target.value)}
                    className="rounded-md border border-[var(--color-border)] bg-white px-1.5 py-1 text-xs text-[var(--color-ink-700)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-500)] transition-shadow w-14"
                  >
                    <option value="">—</option>
                    {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  <select
                    value={composerSinceUnit}
                    onChange={(e) => setComposerSinceUnit(e.target.value)}
                    className="rounded-md border border-[var(--color-border)] bg-white px-1.5 py-1 text-xs text-[var(--color-ink-700)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-500)] transition-shadow w-20"
                  >
                    <option value="days">days</option>
                    <option value="weeks">weeks</option>
                    <option value="months">months</option>
                    <option value="years">years</option>
                  </select>
                </div>
                {editingIndex !== null && (
                  <>
                    <button
                      type="button"
                      onClick={handleAddComplaint}
                      disabled={!composerText.trim()}
                      className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] disabled:opacity-40 transition-colors"
                    >
                      Update
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[var(--color-border)] bg-white text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>

              {/* Composer error */}
              {composerError && (
                <p className="mt-1.5 text-xs text-[var(--color-danger-600)]">{composerError}</p>
              )}

              {/* Keywords row */}
              <div className="mt-2 flex flex-col gap-1.5">
                <ComplaintCombobox
                  key={kwTick}
                  value={composerText}
                  onChange={(v) => { setComposerText(v); setComposerError(""); }}
                  hideInput
                  keywordMode="bullet"
                />
                {composerText.trim() && (
                  <button
                    type="button"
                    onClick={saveComposerAsKeyword}
                    className="self-start inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-[var(--color-primary-300)] bg-[var(--color-primary-50)] text-caption font-medium text-[var(--color-primary-700)] hover:bg-[var(--color-primary-100)] transition-colors whitespace-nowrap"
                  >
                    <Plus size={11} strokeWidth={2.5} /> Save as keyword
                  </button>
                )}
              </div>

              {/* Saved complaint bullets */}
              {bullets.length > 0 && (
                <ul className="mt-3 flex flex-col gap-1.5">
                  {bullets.map((b, i) => (
                    <li key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--color-surface-sunken)] border border-[var(--color-border)] text-sm">
                      <span className="flex-1 min-w-0">
                        <ComplaintChips value={serializeEntries([b])} wrap />
                      </span>
                      <button
                        type="button"
                        onClick={() => editBullet(i)}
                        aria-label={`Edit complaint: ${b.text}`}
                        title={`Edit complaint: ${b.text}`}
                        className="text-caption text-[var(--color-primary-600)] hover:underline shrink-0"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setBullets((prev) => prev.filter((_, idx) => idx !== i))}
                        aria-label={`Remove complaint: ${b.text}`}
                        title={`Remove complaint: ${b.text}`}
                        className="p-0.5 rounded text-[var(--color-ink-400)] hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                      >
                        <X size={13} strokeWidth={2.5} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {error && (
          <p className="text-sm text-[var(--color-danger-600)] bg-[var(--color-danger-50)] border border-[var(--color-danger-200)] px-4 py-2.5 rounded-xl">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          {role === "DOCTOR" && (
            <button
              type="submit"
              data-intent="startEncounter"
              disabled={pending || !autoHospital || (patientMode === "existing" && !selectedPatient)}
              className="flex-1 flex items-center justify-center gap-2 bg-[var(--color-primary-900)] text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-[var(--color-primary-700)] disabled:opacity-50 transition-colors"
            >
              <Stethoscope size={16} />
              {pending ? "Opening EMR..." : "Start Encounter"}
            </button>
          )}
          <button
            type="submit"
            data-intent="addToQ"
            disabled={pending || !autoHospital || (patientMode === "existing" && !selectedPatient)}
            className="flex-1 flex items-center justify-center gap-2 bg-white border border-[var(--color-primary-700)] text-[var(--color-primary-700)] text-sm font-semibold px-6 py-3 rounded-xl hover:bg-[var(--color-primary-50)] disabled:opacity-50 transition-colors"
          >
            <ListOrdered size={16} />
            {pending ? "Adding…" : "Add to Queue"}
          </button>
        </div>
      </form>
    </div>
  );
}
