"use client";

import { useState, useMemo, useTransition } from "react";
import { format, isToday, isTomorrow, isPast, startOfDay } from "date-fns";
import Link from "next/link";
import {
  Scissors, User, Building2, Eye, AlertTriangle, ClipboardList,
  CheckCircle2, Clock, CalendarClock, XCircle, Search, ChevronDown,
  ChevronRight, Stethoscope, BedDouble, FileCheck, TriangleAlert,
  ThumbsUp, MessageSquare, Ban, Loader2, Lock, DoorOpen,
  ShieldCheck, FileSignature, Activity, BadgeCheck, CircleDashed,
  CircleX, HelpCircle,
} from "lucide-react";
import { approveSurgery, requestSurgeryChanges, cancelScheduledSurgery, updateSurgeryDate } from "./actions";
import { surgeryBookingWhatsApp } from "@/lib/whatsapp";

/* ── Types ─────────────────────────────────────────────────────────────── */
interface Patient { id: string; name: string; udid: string; uhid: string | null; age: number; sex: string; mobile: string | null }
interface Hospital { name: string; id: string }
interface Doctor  { name: string; id: string }

interface PreAuthInfo {
  status: string;
  approvedAmount: number | null;
  authCode: string | null;
  insuranceName: string;
}

interface WorkflowStep { id: string; doneAt?: string; status?: string }

interface ScheduleRecord {
  id: string; surgeryName: string; surgeryCategory: string; urgencyType: string;
  priority: string; plannedDateTime: string; otRoom: string | null;
  estimatedDuration: number | null; status: string; department: string | null;
  remarks: string | null; anesthetistName: string | null; nursingStaff: string | null;
  admissionDate: string | null; paymentStatus: string | null;
  consentReceived: boolean; reportsUploaded: boolean;
  otAvailable: boolean; bloodArranged: boolean; patientInformed: boolean;
  preAuth: PreAuthInfo | null;
  patient: Patient; hospital: Hospital; doctor: Doctor;
  workflow: {
    consent:  WorkflowStep | null;
    preOp:    WorkflowStep | null;
    otRecord: WorkflowStep | null;
    postOp:   WorkflowStep | null;
  };
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

const PREAUTH_CONFIG: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  PENDING:      { label: "Pre-Auth Pending",  icon: <CircleDashed size={9} />,  cls: "bg-amber-50 text-amber-700 border-amber-200" },
  APPROVED:     { label: "Pre-Auth Approved", icon: <BadgeCheck size={9} />,    cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  REJECTED:     { label: "Pre-Auth Rejected", icon: <CircleX size={9} />,       cls: "bg-red-50 text-red-600 border-red-200" },
  QUERY_RAISED: { label: "Query Raised",      icon: <HelpCircle size={9} />,    cls: "bg-orange-50 text-orange-700 border-orange-200" },
};

function PreAuthBadge({ p }: { p: PreAuthInfo }) {
  const cfg = PREAUTH_CONFIG[p.status] ?? PREAUTH_CONFIG["PENDING"];
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 rounded-lg border text-[10px] ${cfg.cls}`}>
      <span className="flex items-center gap-1 font-bold uppercase tracking-widest text-inherit opacity-70">
        <ShieldCheck size={9} /> {p.insuranceName}
      </span>
      <span className="flex items-center gap-1 font-semibold">
        {cfg.icon} {cfg.label}
      </span>
      {p.status === "APPROVED" && p.approvedAmount != null && (
        <span className="font-medium">₹{p.approvedAmount.toLocaleString("en-IN")}</span>
      )}
      {p.authCode && (
        <span className="font-mono opacity-80">Auth: {p.authCode}</span>
      )}
    </div>
  );
}

/* ── Workflow Details Panel ──────────────────────────────────────────────── */
function DetailsPanel({ rec }: { rec: ScheduleRecord }) {
  const wf = rec.workflow;
  const otDone = !!wf.otRecord && wf.otRecord.status === "COMPLETED";

  const steps = [
    { key: "consent",  label: "Consent Form",       icon: FileSignature, done: !!wf.consent,  doneAt: wf.consent?.doneAt,  href: `/scheduled-ot/${rec.id}/consent`,          color: "violet" },
    { key: "preOp",    label: "Pre-Op Assessment",   icon: Activity,      done: !!wf.preOp,    doneAt: wf.preOp?.doneAt,    href: `/scheduled-ot/${rec.id}/pre-op-assessment`, color: "amber"  },
    { key: "otRecord", label: "OT / Surgery",        icon: DoorOpen,      done: otDone,        doneAt: undefined,           href: `/scheduled-ot/${rec.id}/ot-room`,           color: "red", otStatus: wf.otRecord?.status },
    { key: "postOp",   label: "Post-Op Review",      icon: Stethoscope,   done: !!wf.postOp,   doneAt: wf.postOp?.doneAt,   href: `/scheduled-ot/${rec.id}/post-op-review`,    color: "teal"   },
  ] as const;

  const OT_STATUS_LABEL: Record<string, string> = {
    CHECKIN: "Check-in", PREP: "Prep", IN_PROGRESS: "In Progress",
    COMPLETED: "Completed", RECOVERY: "Recovery",
  };

  const COLOR: Record<string, { pill: string; dot: string }> = {
    violet: { pill: "bg-violet-50 text-violet-700 border-violet-200", dot: "bg-violet-500" },
    amber:  { pill: "bg-amber-50  text-amber-700  border-amber-200",  dot: "bg-amber-500"  },
    red:    { pill: "bg-red-50    text-red-700    border-red-200",    dot: "bg-red-500"    },
    teal:   { pill: "bg-teal-50   text-teal-700   border-teal-200",   dot: "bg-teal-500"   },
  };

  return (
    <div className="border-t border-[var(--color-border)] px-4 py-4 space-y-5">

      {/* ── Workflow steps ── */}
      <div>
        <p className="text-[10px] font-bold text-[var(--color-ink-400)] uppercase tracking-wide mb-3">Workflow Progress</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {steps.map((s) => {
            const Icon = s.icon;
            const c = COLOR[s.color];
            return (
              <div
                key={s.key}
                className={`rounded-xl border p-3 flex flex-col gap-1.5 ${
                  s.done ? c.pill : "bg-[var(--color-surface-sunken)] border-[var(--color-border)]"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${s.done ? c.dot : "bg-slate-300"}`} />
                  <Icon size={12} className={s.done ? "" : "text-[var(--color-ink-300)]"} />
                  <span className={`text-[10px] font-bold uppercase tracking-wide ${s.done ? "" : "text-[var(--color-ink-400)]"}`}>
                    {s.done ? "Done" : "Pending"}
                  </span>
                </div>
                <p className={`text-xs font-semibold leading-tight ${s.done ? "" : "text-[var(--color-ink-500)]"}`}>
                  {s.label}
                </p>
                {"otStatus" in s && s.otStatus && !s.done && (
                  <span className="text-[10px] text-[var(--color-ink-500)]">
                    {OT_STATUS_LABEL[s.otStatus] ?? s.otStatus}
                  </span>
                )}
                {s.doneAt && (
                  <span className="text-[10px] text-[var(--color-ink-400)]">
                    {format(new Date(s.doneAt), "d MMM, h:mm a")}
                  </span>
                )}
                <Link
                  href={s.href}
                  className={`mt-auto inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg border transition-colors ${
                    s.done
                      ? `${c.pill} hover:opacity-80`
                      : "border-[var(--color-border)] text-[var(--color-ink-500)] hover:bg-[var(--color-surface)] bg-white"
                  }`}
                >
                  {s.done ? "View" : "Open"}
                  <ChevronRight size={9} />
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Extra details ── */}
      <div>
        <p className="text-[10px] font-bold text-[var(--color-ink-400)] uppercase tracking-wide mb-3">Schedule Details</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-xs">
          {[
            { label: "Priority",       value: rec.priority },
            { label: "Department",     value: rec.department },
            { label: "Est. Duration",  value: rec.estimatedDuration ? `${rec.estimatedDuration} min` : null },
            { label: "OT Room",        value: rec.otRoom },
            { label: "Anesthetist",    value: rec.anesthetistName },
            { label: "Nursing Staff",  value: rec.nursingStaff },
            { label: "Admission Date", value: rec.admissionDate ? format(new Date(rec.admissionDate), "d MMM yyyy") : null },
            { label: "Payment",        value: rec.paymentStatus },
            { label: "Remarks",        value: rec.remarks },
          ].filter((f) => f.value).map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] font-semibold text-[var(--color-ink-400)] uppercase tracking-wide">{label}</p>
              <p className="text-[var(--color-ink-700)] font-medium mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </div>
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

          {/* Pre-auth badge */}
          {rec.preAuth && (
            <div className="mb-2.5">
              <PreAuthBadge p={rec.preAuth} />
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

            {rec.patient.mobile && (
              <a
                href={surgeryBookingWhatsApp({
                  mobile:       rec.patient.mobile,
                  patientName:  rec.patient.name,
                  surgeryName:  rec.surgeryName,
                  plannedDate:  format(new Date(rec.plannedDateTime), "d MMM yyyy"),
                  plannedTime:  format(new Date(rec.plannedDateTime), "h:mm a"),
                  hospitalName: rec.hospital.name,
                  doctorName:   rec.doctor.name,
                  otRoom:       rec.otRoom,
                })}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                WhatsApp
              </a>
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
      {open && <DetailsPanel rec={rec} />}
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

          {/* Pre-auth badge */}
          {rec.preAuth && (
            <div className="mb-2.5">
              <PreAuthBadge p={rec.preAuth} />
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
                <Link
                  href={`/scheduled-ot/${rec.id}/consent`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors"
                >
                  <FileSignature size={12} /> Consent
                  {rec.consentReceived && <CheckCircle2 size={10} className="text-emerald-500" />}
                </Link>
                <Link
                  href={`/scheduled-ot/${rec.id}/pre-op-assessment`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                >
                  <Activity size={12} /> Pre-Op
                </Link>
                <Link
                  href={`/scheduled-ot/${rec.id}/post-op-review`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors"
                >
                  <Stethoscope size={12} /> Post-Op Review
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
            {rec.patient.mobile && (
              <a
                href={surgeryBookingWhatsApp({
                  mobile:       rec.patient.mobile,
                  patientName:  rec.patient.name,
                  surgeryName:  rec.surgeryName,
                  plannedDate:  format(new Date(rec.plannedDateTime), "d MMM yyyy"),
                  plannedTime:  format(new Date(rec.plannedDateTime), "h:mm a"),
                  hospitalName: rec.hospital.name,
                  doctorName:   rec.doctor.name,
                  otRoom:       rec.otRoom,
                })}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                WhatsApp
              </a>
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

      {open && <DetailsPanel rec={rec} />}
    </div>
  );
}

/* ── Main client ────────────────────────────────────────────────────────── */
export function ScheduledOtClient({
  waiting, confirmed, completed, counts, role,
}: {
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

    </div>
  );
}
