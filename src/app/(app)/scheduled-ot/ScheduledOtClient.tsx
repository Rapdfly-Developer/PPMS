"use client";

import { useState, useMemo, useTransition } from "react";
import { format, isToday, isTomorrow, isPast, startOfDay } from "date-fns";
import Link from "next/link";
import {
  Scissors, User, Building2, Eye, AlertTriangle, ClipboardList,
  CheckCircle2, Clock, CalendarClock, XCircle, Search, ChevronDown,
  ChevronRight, Stethoscope, BedDouble, FileCheck, TriangleAlert,
  ThumbsUp, MessageSquare, Ban, Loader2, Lock, DoorOpen,
  ShieldCheck,
} from "lucide-react";
import { approveSurgery, requestSurgeryChanges, cancelScheduledSurgery, updateSurgeryDate } from "./actions";

/* ── Types ─────────────────────────────────────────────────────────────── */
interface Patient { id: string; name: string; udid: string; uhid: string | null; age: number; sex: string }
interface Hospital { name: string; id: string }
interface Doctor  { name: string; id: string }

interface UnscheduledRecord {
  id: string; surgeryName: string | null; surgeryType: string; surgeryDate: string;
  anaesthesiaType: string; rightEye: boolean; leftEye: boolean; conflictFlag: boolean;
  patient: Patient; hospital: Hospital; doctor: Doctor;
}

interface CounsellingInfo {
  insuranceType: string | null;
  counselingDone: boolean;
  investigationDone: boolean;
  fitForSurgery: boolean | null;
  anaesthesiaType: string;
  rightEye: boolean;
  leftEye: boolean;
}

interface ScheduleRecord {
  id: string; surgeryName: string; surgeryCategory: string; urgencyType: string;
  priority: string; plannedDateTime: string; otRoom: string | null;
  estimatedDuration: number | null; status: string; department: string | null;
  remarks: string | null; consentReceived: boolean; reportsUploaded: boolean;
  otAvailable: boolean; bloodArranged: boolean; patientInformed: boolean;
  patient: Patient; hospital: Hospital; doctor: Doctor;
  counselling: CounsellingInfo | null;
}

interface Counts { waiting: number; scheduled: number; completed: number; cancelled: number }

/* ── Helpers ────────────────────────────────────────────────────────────── */
const SEX_SHORT: Record<string, string> = { MALE: "M", FEMALE: "F", OTHER: "O" };

function lateralityLabel(re: boolean, le: boolean) {
  if (re && le) return "OU";
  if (re) return "RE";
  if (le) return "LE";
  return "";
}

function dateLabel(iso: string) {
  const d = new Date(iso);
  if (isToday(d))    return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "EEE, d MMM yyyy");
}

function groupByDate<T>(items: T[], getDate: (item: T) => string) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = format(new Date(getDate(item)), "yyyy-MM-dd");
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return Array.from(map.entries()).map(([key, items]) => ({ key, items }));
}

/* ── Sub-components ─────────────────────────────────────────────────────── */
function StatCard({ icon, label, value, color, active, onClick }: {
  icon: React.ReactNode; label: string; value: number;
  color: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-[130px] flex items-center gap-3 px-4 py-4 rounded-xl border transition-all text-left ${
        active ? `${color} shadow-sm` : "bg-white border-[var(--color-border)] hover:border-[var(--color-primary-200)] hover:bg-[var(--color-surface-sunken)]"
      }`}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${active ? "bg-white/50" : "bg-[var(--color-surface-sunken)]"}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold leading-none mb-0.5">{value}</p>
        <p className="text-[11px] font-medium opacity-80">{label}</p>
      </div>
    </button>
  );
}

function DateHeader({ iso, count }: { iso: string; count: number }) {
  const label = dateLabel(iso);
  const isNow = isToday(new Date(iso));
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${isNow ? "bg-[var(--color-primary-100)] text-[var(--color-primary-700)]" : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]"}`}>
        {label}
      </span>
      <span className="text-[11px] text-[var(--color-ink-400)]">
        {format(new Date(iso), "d MMM yyyy")} · {count} procedure{count !== 1 ? "s" : ""}
      </span>
      <div className="flex-1 h-px bg-[var(--color-border)]" />
    </div>
  );
}

function EmptySection({ icon, label, sub }: { icon: React.ReactNode; label: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <div className="w-12 h-12 rounded-xl bg-[var(--color-surface-sunken)] flex items-center justify-center">{icon}</div>
      <p className="text-sm font-medium text-[var(--color-ink-500)]">{label}</p>
      {sub && <p className="text-xs text-[var(--color-ink-400)] max-w-xs">{sub}</p>}
    </div>
  );
}

function ChecklistDot({ ok }: { ok: boolean }) {
  return <span className={`w-1.5 h-1.5 rounded-full inline-block ${ok ? "bg-emerald-500" : "bg-slate-300"}`} />;
}

/* ── Counselling strip ───────────────────────────────────────────────────── */
function CounsellingStrip({ c }: { c: CounsellingInfo }) {
  const lat = c.rightEye && c.leftEye ? "OU" : c.rightEye ? "RE" : c.leftEye ? "LE" : null;
  const fit = c.fitForSurgery ?? (c.counselingDone && c.investigationDone);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2 rounded-lg bg-violet-50 border border-violet-100 text-[10px]">
      <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400 shrink-0">Counselling</span>
      <span className={`inline-flex items-center gap-1 font-semibold px-1.5 py-0.5 rounded-full border ${c.counselingDone ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)] border-[var(--color-border)]"}`}>
        {c.counselingDone ? <CheckCircle2 size={9} /> : <XCircle size={9} />} Counseling
      </span>
      <span className={`inline-flex items-center gap-1 font-semibold px-1.5 py-0.5 rounded-full border ${c.investigationDone ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)] border-[var(--color-border)]"}`}>
        {c.investigationDone ? <CheckCircle2 size={9} /> : <XCircle size={9} />} Investigations
      </span>
      <span className={`inline-flex items-center gap-1 font-bold px-1.5 py-0.5 rounded-full border ${fit ? "bg-violet-100 text-violet-700 border-violet-200" : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)] border-[var(--color-border)]"}`}>
        {fit ? <CheckCircle2 size={9} /> : <XCircle size={9} />} Fit for Surgery
      </span>
      {c.insuranceType && (
        <span className="inline-flex items-center gap-1 text-[var(--color-ink-500)]">
          <ShieldCheck size={9} className="text-violet-400" /> {c.insuranceType}
        </span>
      )}
      {lat && (
        <span className="inline-flex items-center gap-1 text-[var(--color-ink-500)]">
          <Eye size={9} className="text-violet-400" /> {lat}
        </span>
      )}
      <span className="text-[var(--color-ink-400)]">{c.anaesthesiaType}</span>
    </div>
  );
}

/* ── Waiting Card ────────────────────────────────────────────────────────── */
function WaitingCard({ rec, role, idx }: { rec: ScheduleRecord; role: "DOCTOR" | "HOSPITAL"; idx: number }) {
  const [open, setOpen]         = useState(false);
  const [showCancel, setCancel] = useState(false);
  const [showChanges, setChanges] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [notes, setNotes]       = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [newDate, setNewDate]   = useState(new Date(rec.plannedDateTime).toISOString().slice(0, 10));
  const [newTime, setNewTime]   = useState(new Date(rec.plannedDateTime).toTimeString().slice(0, 5));
  const [pending, start]        = useTransition();
  const [err, setErr]           = useState("");

  const isChangesRequested = rec.status === "CHANGES_REQUESTED";

  async function handleUpdateDate() {
    if (!newDate || !newTime) return;
    start(async () => {
      const res = await updateSurgeryDate(rec.id, new Date(`${newDate}T${newTime}`).toISOString());
      if (res.error) setErr(res.error);
      else setShowEdit(false);
    });
  }

  async function handleApprove() {
    start(async () => {
      const res = await approveSurgery(rec.id);
      if (res.error) setErr(res.error);
    });
  }

  async function handleChanges() {
    start(async () => {
      const res = await requestSurgeryChanges(rec.id, notes);
      if (res.error) setErr(res.error);
      else setChanges(false);
    });
  }

  async function handleCancel() {
    start(async () => {
      const res = await cancelScheduledSurgery(rec.id, cancelReason);
      if (res.error) setErr(res.error);
      else setCancel(false);
    });
  }

  return (
    <div className={`rounded-xl border bg-white transition-shadow ${isChangesRequested ? "border-amber-200 bg-amber-50/30" : "border-[var(--color-border)]"}`}>
      {/* Main row */}
      <div className="flex items-start gap-3 px-4 py-3.5">
        {/* Serial */}
        <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-[10px] font-bold text-amber-700">{idx + 1}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          {/* Patient row */}
          <div className="flex items-start justify-between gap-2 flex-wrap mb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Link href={`/patients/${rec.patient.udid}`} className="text-sm font-bold text-[var(--color-ink-900)] hover:text-[var(--color-primary-700)] hover:underline">
                {rec.patient.name}
              </Link>
              <span className="text-xs text-[var(--color-ink-400)]">{rec.patient.age}y / {SEX_SHORT[rec.patient.sex] ?? rec.patient.sex}</span>
              {rec.patient.uhid && <span className="font-mono text-[10px] bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded">{rec.patient.uhid}</span>}
              <span className="font-mono text-[10px] bg-[var(--color-primary-50)] text-[var(--color-primary-700)] px-1.5 py-0.5 rounded">{rec.patient.udid}</span>
              {rec.urgencyType === "EMERGENCY" && (
                <span className="flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                  <AlertTriangle size={9} /> EMERGENCY
                </span>
              )}
            </div>
            {/* Status badge */}
            {isChangesRequested ? (
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200 whitespace-nowrap">
                Changes Requested
              </span>
            ) : (
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-200 whitespace-nowrap">
                Awaiting Doctor Confirmation
              </span>
            )}
          </div>

          {/* Surgery detail row */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-ink-600)] mb-2.5">
            <span className="flex items-center gap-1 font-semibold text-[var(--color-ink-800)]">
              <Scissors size={11} className="text-[var(--color-primary-500)]" />
              {rec.surgeryName}
              <span className="ml-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]">
                {rec.surgeryCategory}
              </span>
            </span>
            <span className="flex items-center gap-1 text-[var(--color-ink-400)]">
              <Clock size={11} /> {format(new Date(rec.plannedDateTime), "h:mm a")}
              {rec.estimatedDuration ? ` · ${rec.estimatedDuration} min` : ""}
            </span>
            {rec.otRoom && <span className="font-medium text-[var(--color-ink-500)]">OT: {rec.otRoom}</span>}
            {role === "HOSPITAL" && <span className="flex items-center gap-1 text-[var(--color-ink-400)]"><User size={11} /> Dr. {rec.doctor.name}</span>}
            {role === "DOCTOR"   && <span className="flex items-center gap-1 text-[var(--color-ink-400)]"><Building2 size={11} /> {rec.hospital.name}</span>}
          </div>

          {/* Counselling strip */}
          {rec.counselling && (
            <div className="mb-2.5">
              <CounsellingStrip c={rec.counselling} />
            </div>
          )}

          {/* Checklist dots */}
          <div className="flex items-center gap-3 mb-2.5 flex-wrap">
            {[
              { label: "Consent",  ok: rec.consentReceived },
              { label: "Reports",  ok: rec.reportsUploaded },
              { label: "OT Ready", ok: rec.otAvailable },
              { label: "Blood",    ok: rec.bloodArranged },
              { label: "Informed", ok: rec.patientInformed },
            ].map(({ label, ok }) => (
              <span key={label} className="flex items-center gap-1 text-[10px] text-[var(--color-ink-400)]">
                <ChecklistDot ok={ok} /> {label}
              </span>
            ))}
          </div>

          {/* Remarks if changes requested */}
          {isChangesRequested && rec.remarks && (
            <div className="mb-2.5 px-3 py-2 rounded-lg bg-amber-100 border border-amber-200 text-xs text-amber-800">
              <span className="font-semibold">Change note: </span>{rec.remarks}
            </div>
          )}

          {err && <p className="text-xs text-red-600 mb-2">{err}</p>}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {/* View details toggle */}
            <button
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] transition-colors"
            >
              <FileCheck size={12} />
              {open ? "Hide Details" : "View Details"}
              {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </button>

            {role === "DOCTOR" && (
              <>
                <button
                  onClick={handleApprove}
                  disabled={pending}
                  className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {pending ? <Loader2 size={12} className="animate-spin" /> : <ThumbsUp size={12} />}
                  Approve Surgery
                </button>
                <button
                  onClick={() => { setShowEdit(true); setChanges(false); setCancel(false); }}
                  disabled={pending}
                  className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--color-primary-300)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)] hover:bg-[var(--color-primary-100)] transition-colors disabled:opacity-50"
                >
                  <CalendarClock size={12} /> Update Date &amp; Time
                </button>
                <button
                  onClick={() => { setChanges(true); setCancel(false); setShowEdit(false); }}
                  disabled={pending}
                  className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
                >
                  <MessageSquare size={12} /> Request Changes
                </button>
              </>
            )}

            {role === "HOSPITAL" && isChangesRequested && (
              <button
                onClick={() => { setShowEdit(true); setCancel(false); setChanges(false); }}
                disabled={pending}
                className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--color-primary-300)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)] hover:bg-[var(--color-primary-100)] transition-colors disabled:opacity-50"
              >
                <CalendarClock size={12} /> Update Date &amp; Time
              </button>
            )}

            <button
              onClick={() => { setCancel(true); setChanges(false); setShowEdit(false); }}
              disabled={pending}
              className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              <Ban size={12} /> Cancel Surgery
            </button>
          </div>

          {/* Request Changes panel */}
          {showChanges && (
            <div className="mt-3 p-3 rounded-xl border border-amber-200 bg-amber-50">
              <p className="text-xs font-semibold text-amber-800 mb-2">Describe the changes needed:</p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="e.g. Change OT room, update anaesthesia type…"
                className="w-full text-xs rounded-lg border border-amber-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
              />
              <div className="flex gap-2 mt-2">
                <button onClick={handleChanges} disabled={pending}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition-colors">
                  {pending ? "Sending…" : "Send Request"}
                </button>
                <button onClick={() => setChanges(false)} className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-ink-500)] hover:bg-white transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Cancel panel */}
          {showCancel && (
            <div className="mt-3 p-3 rounded-xl border border-red-200 bg-red-50">
              <p className="text-xs font-semibold text-red-800 mb-2">Reason for cancellation (optional):</p>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={2}
                placeholder="e.g. Patient not fit for surgery…"
                className="w-full text-xs rounded-lg border border-red-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
              />
              <div className="flex gap-2 mt-2">
                <button onClick={handleCancel} disabled={pending}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
                  {pending ? "Cancelling…" : "Confirm Cancel"}
                </button>
                <button onClick={() => setCancel(false)} className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-ink-500)] hover:bg-white transition-colors">
                  Back
                </button>
              </div>
            </div>
          )}

          {/* Update date panel (hospital, changes requested) */}
          {showEdit && (
            <div className="mt-3 p-3 rounded-xl border border-[var(--color-primary-200)] bg-[var(--color-primary-50)]">
              <p className="text-xs font-semibold text-[var(--color-primary-800)] mb-2.5">Update Surgery Date &amp; Time</p>
              <div className="flex gap-3 flex-wrap">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-[var(--color-ink-500)] uppercase tracking-wide">Date</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="text-xs rounded-lg border border-[var(--color-primary-200)] bg-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-[var(--color-ink-500)] uppercase tracking-wide">Time</label>
                  <input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="text-xs rounded-lg border border-[var(--color-primary-200)] bg-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)]"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleUpdateDate}
                  disabled={pending || !newDate || !newTime}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] disabled:opacity-50 transition-colors"
                >
                  {pending ? "Saving…" : "Save & Notify Doctor"}
                </button>
                <button onClick={() => setShowEdit(false)} className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-ink-500)] hover:bg-white transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Expandable details */}
      {open && (
        <div className="border-t border-[var(--color-border)] px-4 py-3 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-xs">
          {[
            { label: "Department",   value: rec.department },
            { label: "Priority",     value: rec.priority },
            { label: "Est. Duration",value: rec.estimatedDuration ? `${rec.estimatedDuration} min` : null },
            { label: "OT Room",      value: rec.otRoom },
          ].filter((f) => f.value).map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-wide">{label}</p>
              <p className="text-[var(--color-ink-700)] font-medium mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Confirmed Card ──────────────────────────────────────────────────────── */
function ConfirmedCard({ rec, role, idx }: { rec: ScheduleRecord; role: "DOCTOR" | "HOSPITAL"; idx: number }) {
  const [open, setOpen]       = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [newDate, setNewDate] = useState(new Date(rec.plannedDateTime).toISOString().slice(0, 10));
  const [newTime, setNewTime] = useState(new Date(rec.plannedDateTime).toTimeString().slice(0, 5));
  const [pending, start]      = useTransition();
  const [err, setErr]         = useState("");

  function handleUpdateDate() {
    if (!newDate || !newTime) return;
    start(async () => {
      const res = await updateSurgeryDate(rec.id, new Date(`${newDate}T${newTime}`).toISOString());
      if (res.error) setErr(res.error);
      else setShowEdit(false);
    });
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-white">
      <div className="flex items-start gap-3 px-4 py-3.5">
        <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-[10px] font-bold text-emerald-700">{idx + 1}</span>
        </div>

        <div className="flex-1 min-w-0">
          {/* Patient row */}
          <div className="flex items-start justify-between gap-2 flex-wrap mb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Link href={`/patients/${rec.patient.udid}`} className="text-sm font-bold text-[var(--color-ink-900)] hover:text-[var(--color-primary-700)] hover:underline">
                {rec.patient.name}
              </Link>
              <span className="text-xs text-[var(--color-ink-400)]">{rec.patient.age}y / {SEX_SHORT[rec.patient.sex] ?? rec.patient.sex}</span>
              {rec.patient.uhid && <span className="font-mono text-[10px] bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded">{rec.patient.uhid}</span>}
              <span className="font-mono text-[10px] bg-[var(--color-primary-50)] text-[var(--color-primary-700)] px-1.5 py-0.5 rounded">{rec.patient.udid}</span>
              {rec.urgencyType === "EMERGENCY" && (
                <span className="flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                  <AlertTriangle size={9} /> EMERGENCY
                </span>
              )}
            </div>
            <span className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
              <CheckCircle2 size={11} /> Surgery Confirmed
            </span>
          </div>

          {/* Surgery details */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-ink-600)] mb-2.5">
            <span className="flex items-center gap-1 font-semibold text-[var(--color-ink-800)]">
              <Scissors size={11} className="text-emerald-500" />
              {rec.surgeryName}
              <span className="ml-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">{rec.surgeryCategory}</span>
            </span>
            <span className="flex items-center gap-1 text-[var(--color-ink-400)]">
              <Clock size={11} /> {format(new Date(rec.plannedDateTime), "h:mm a")}
              {rec.estimatedDuration ? ` · ${rec.estimatedDuration} min` : ""}
            </span>
            {rec.otRoom && <span className="font-medium text-[var(--color-ink-500)]">OT: {rec.otRoom}</span>}
            {role === "HOSPITAL" && <span className="flex items-center gap-1 text-[var(--color-ink-400)]"><User size={11} /> Dr. {rec.doctor.name}</span>}
            {role === "DOCTOR"   && <span className="flex items-center gap-1 text-[var(--color-ink-400)]"><Building2 size={11} /> {rec.hospital.name}</span>}
          </div>

          {/* Counselling strip */}
          {rec.counselling && (
            <div className="mb-2.5">
              <CounsellingStrip c={rec.counselling} />
            </div>
          )}

          {/* Checklist */}
          <div className="flex items-center gap-3 mb-2.5 flex-wrap">
            {[
              { label: "Consent",  ok: rec.consentReceived },
              { label: "Reports",  ok: rec.reportsUploaded },
              { label: "OT Ready", ok: rec.otAvailable },
              { label: "Blood",    ok: rec.bloodArranged },
              { label: "Informed", ok: rec.patientInformed },
            ].map(({ label, ok }) => (
              <span key={label} className="flex items-center gap-1 text-[10px] text-[var(--color-ink-400)]">
                <ChecklistDot ok={ok} /> {label}
              </span>
            ))}
          </div>

          {err && <p className="text-xs text-red-600 mb-2">{err}</p>}

          <div className="flex items-center gap-2 flex-wrap">
            {role === "DOCTOR" && (
              <>
                <Link
                  href={`/scheduled-ot/${rec.id}/ot-room`}
                  className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                >
                  <DoorOpen size={13} /> Enter Surgery Room
                </Link>
                <button
                  onClick={() => setShowEdit((v) => !v)}
                  disabled={pending}
                  className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--color-primary-300)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)] hover:bg-[var(--color-primary-100)] transition-colors disabled:opacity-50"
                >
                  <CalendarClock size={12} /> Update Date &amp; Time
                </button>
              </>
            )}
            <button
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] transition-colors"
            >
              <FileCheck size={12} />
              {open ? "Hide Details" : "View Details"}
              {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </button>
            {role !== "DOCTOR" && (
              <span className="flex items-center gap-1 text-[10px] text-[var(--color-ink-400)]">
                <Lock size={10} /> Schedule locked
              </span>
            )}
          </div>

          {/* Inline date editor (doctor only) */}
          {showEdit && (
            <div className="mt-3 p-3 rounded-xl border border-[var(--color-primary-200)] bg-[var(--color-primary-50)]">
              <p className="text-xs font-semibold text-[var(--color-primary-800)] mb-2.5">Update Surgery Date &amp; Time</p>
              <div className="flex gap-3 flex-wrap">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-[var(--color-ink-500)] uppercase tracking-wide">Date</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="text-xs rounded-lg border border-[var(--color-primary-200)] bg-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-[var(--color-ink-500)] uppercase tracking-wide">Time</label>
                  <input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="text-xs rounded-lg border border-[var(--color-primary-200)] bg-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)]"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleUpdateDate}
                  disabled={pending || !newDate || !newTime}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] disabled:opacity-50 transition-colors"
                >
                  {pending ? "Saving…" : "Save & Notify Admin"}
                </button>
                <button onClick={() => setShowEdit(false)} className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-ink-500)] hover:bg-white transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {open && (
        <div className="border-t border-[var(--color-border)] px-4 py-3 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-xs">
          {[
            { label: "Department",    value: rec.department },
            { label: "Priority",      value: rec.priority },
            { label: "Est. Duration", value: rec.estimatedDuration ? `${rec.estimatedDuration} min` : null },
            { label: "OT Room",       value: rec.otRoom },
          ].filter((f) => f.value).map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-wide">{label}</p>
              <p className="text-[var(--color-ink-700)] font-medium mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main client ────────────────────────────────────────────────────────── */
export function ScheduledOtClient({
  unscheduled, waiting, confirmed, completed, counts, role,
}: {
  unscheduled: UnscheduledRecord[];
  waiting:     ScheduleRecord[];
  confirmed:   ScheduleRecord[];
  completed:   ScheduleRecord[];
  counts:      Counts;
  role: "DOCTOR" | "HOSPITAL";
}) {
  const [search, setSearch] = useState("");
  const [view, setView]     = useState<"main" | "completed">("main");

  function filterSchedule(list: ScheduleRecord[]) {
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(
      (r) =>
        r.patient.name.toLowerCase().includes(q) ||
        r.patient.udid.toLowerCase().includes(q) ||
        (r.patient.uhid?.toLowerCase() ?? "").includes(q) ||
        r.surgeryName.toLowerCase().includes(q),
    );
  }

  const filteredWaiting   = useMemo(() => filterSchedule(waiting),   [waiting, search]);
  const filteredConfirmed = useMemo(() => filterSchedule(confirmed),  [confirmed, search]);
  const filteredCompleted = useMemo(() => filterSchedule(completed),  [completed, search]);

  const waitingGroups   = useMemo(() => groupByDate(filteredWaiting,   (r) => r.plannedDateTime), [filteredWaiting]);
  const confirmedGroups = useMemo(() => groupByDate(filteredConfirmed, (r) => r.plannedDateTime), [filteredConfirmed]);
  const completedGroups = useMemo(() => groupByDate(filteredCompleted, (r) => r.plannedDateTime), [filteredCompleted]);

  const totalToday = [...waiting, ...confirmed].filter((r) => isToday(new Date(r.plannedDateTime))).length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--color-primary-100)] flex items-center justify-center shrink-0">
            <Scissors size={18} className="text-[var(--color-primary-700)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--color-ink-900)] leading-tight">Scheduled OT</h1>
            <p className="text-xs text-[var(--color-ink-400)]">
              {totalToday > 0 ? `${totalToday} procedure${totalToday !== 1 ? "s" : ""} today` : "No procedures today"}
            </p>
          </div>
        </div>
        {role === "HOSPITAL" && unscheduled.length > 0 && (
          <Link href="#unscheduled"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-[var(--color-primary-300)] text-[var(--color-primary-700)] bg-[var(--color-primary-50)] hover:bg-[var(--color-primary-100)] transition-colors">
            <ClipboardList size={13} /> {unscheduled.length} Pending Form{unscheduled.length !== 1 ? "s" : ""}
          </Link>
        )}
      </div>

      {/* Stat cards */}
      <div className="flex gap-3 flex-wrap">
        <StatCard
          icon={<CheckCircle2 size={17} className={view === "main" ? "text-emerald-600" : "text-[var(--color-ink-400)]"} />}
          label="Scheduled OT" value={counts.scheduled}
          color="bg-emerald-50 border-emerald-300 text-emerald-800"
          active={view === "main"} onClick={() => setView("main")}
        />
        <StatCard
          icon={<CalendarClock size={17} className={view === "main" ? "text-amber-600" : "text-[var(--color-ink-400)]"} />}
          label="Waiting Confirmation" value={counts.waiting}
          color="bg-amber-50 border-amber-300 text-amber-800"
          active={view === "main"} onClick={() => setView("main")}
        />
        <StatCard
          icon={<BedDouble size={17} className={view === "completed" ? "text-[var(--color-primary-600)]" : "text-[var(--color-ink-400)]"} />}
          label="Completed OT" value={counts.completed}
          color="bg-[var(--color-primary-50)] border-[var(--color-primary-300)] text-[var(--color-primary-700)]"
          active={view === "completed"} onClick={() => setView("completed")}
        />
        <StatCard
          icon={<XCircle size={17} className="text-[var(--color-ink-400)]" />}
          label="Cancelled OT" value={counts.cancelled}
          color="bg-red-50 border-red-200 text-red-700"
          active={false} onClick={() => {}}
        />
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-300)] pointer-events-none" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search patient name, UHID, or surgery…"
          className="w-full rounded-xl border border-[var(--color-border)] bg-white pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)]"
        />
      </div>

      {/* ── Main view: Scheduled OT + Waiting (always together) ── */}
      {view === "main" && (
        <>
          {/* Section 1: Scheduled OT */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-6 rounded-full bg-emerald-500" />
              <h2 className="text-base font-bold text-[var(--color-ink-900)]">Scheduled OT</h2>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                {filteredConfirmed.length}
              </span>
            </div>

            {confirmedGroups.length === 0 ? (
              <EmptySection
                icon={<CheckCircle2 size={22} className="text-[var(--color-ink-300)]" />}
                label={search ? "No results found." : "No confirmed surgeries yet."}
                sub={!search ? "Approved surgeries appear here automatically." : undefined}
              />
            ) : (
              <div className="space-y-6">
                {confirmedGroups.map(({ key, items }) => (
                  <div key={key}>
                    <DateHeader iso={items[0].plannedDateTime} count={items.length} />
                    <div className="space-y-2">
                      {items.map((r, idx) => <ConfirmedCard key={r.id} rec={r} role={role} idx={idx} />)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Section 2: Waiting for Doctor Confirmation */}
          <section className="pt-2 border-t border-[var(--color-border)]">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-6 rounded-full bg-amber-400" />
              <h2 className="text-base font-bold text-[var(--color-ink-900)]">Waiting for Doctor Confirmation</h2>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                {filteredWaiting.length}
              </span>
            </div>

            {waitingGroups.length === 0 ? (
              <EmptySection
                icon={<CalendarClock size={22} className="text-[var(--color-ink-300)]" />}
                label={search ? "No results found." : "No surgeries awaiting confirmation."}
                sub={!search ? "Once hospital admin fills the Surgery Scheduling Form, surgeries appear here for your approval." : undefined}
              />
            ) : (
              <div className="space-y-6">
                {waitingGroups.map(({ key, items }) => (
                  <div key={key}>
                    <DateHeader iso={items[0].plannedDateTime} count={items.length} />
                    <div className="space-y-2">
                      {items.map((r, idx) => <WaitingCard key={r.id} rec={r} role={role} idx={idx} />)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* ── Completed OT ── */}
      {view === "completed" && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-6 rounded-full bg-[var(--color-primary-500)]" />
            <h2 className="text-base font-bold text-[var(--color-ink-900)]">Completed OT</h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[var(--color-primary-100)] text-[var(--color-primary-700)] border border-[var(--color-primary-200)]">
              {filteredCompleted.length}
            </span>
          </div>

          {completedGroups.length === 0 ? (
            <EmptySection
              icon={<BedDouble size={22} className="text-[var(--color-ink-300)]" />}
              label={search ? "No results found." : "No completed OT records."}
            />
          ) : (
            <div className="space-y-6">
              {completedGroups.map(({ key, items }) => (
                <div key={key}>
                  <DateHeader iso={items[0].plannedDateTime} count={items.length} />
                  <div className="space-y-2">
                    {items.map((r, idx) => <ConfirmedCard key={r.id} rec={r} role={role} idx={idx} />)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Unscheduled (Hospital admin only — "fill form" CTA) ── */}
      {role === "HOSPITAL" && unscheduled.length > 0 && (
        <section id="unscheduled" className="pt-4 border-t border-[var(--color-border)]">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-6 rounded-full bg-slate-400" />
            <h2 className="text-base font-bold text-[var(--color-ink-900)]">Pending Scheduling Form</h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              {unscheduled.length}
            </span>
          </div>
          <p className="text-xs text-[var(--color-ink-400)] mb-3">Doctor has recommended surgery. Fill the Scheduling Form to proceed.</p>
          <div className="space-y-2">
            {unscheduled.map((r) => {
              const lat = lateralityLabel(r.rightEye, r.leftEye);
              return (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--color-border)] bg-white">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-sm font-semibold text-[var(--color-ink-800)]">{r.patient.name}</span>
                      <span className="text-xs text-[var(--color-ink-400)]">{r.patient.age}y / {SEX_SHORT[r.patient.sex] ?? r.patient.sex}</span>
                      {r.patient.uhid && <span className="font-mono text-[10px] bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded">{r.patient.uhid}</span>}
                      {r.conflictFlag && <span className="flex items-center gap-0.5 text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200"><AlertTriangle size={9} /> Conflict</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[var(--color-ink-500)]">
                      <span className="flex items-center gap-1"><Scissors size={10} /> {r.surgeryName ?? r.surgeryType}{lat && ` · ${lat}`}</span>
                      <span><User size={10} className="inline mr-0.5" />Dr. {r.doctor.name}</span>
                      <span>{format(new Date(r.surgeryDate), "d MMM yyyy")}</span>
                    </div>
                  </div>
                  <Link href={`/scheduled-ot/${r.id}`}
                    className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--color-primary-300)] text-[var(--color-primary-700)] bg-[var(--color-primary-50)] hover:bg-[var(--color-primary-100)] transition-colors">
                    <ClipboardList size={12} /> Fill Form
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
