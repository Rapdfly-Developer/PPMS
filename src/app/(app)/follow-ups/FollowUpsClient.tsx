"use client";

import { useState, useTransition, useMemo } from "react";
import { format, differenceInDays, isToday, isBefore, startOfDay } from "date-fns";
import Link from "next/link";
import {
  CalendarClock, Search, AlertCircle, CheckCircle2, Clock, CalendarDays,
  XCircle, User, ChevronRight, Filter, RotateCcw, Stethoscope,
  FileText, FlaskConical, Scissors, RefreshCw, Ban, Eye,
  Bell, ArrowRight, X, Building2,
} from "lucide-react";
import { rescheduleFollowUp, cancelFollowUp, completeFollowUp } from "./actions";

/* ── Types ─────────────────────────────────────────────────────────────── */
export type FollowUpStatus = "DUE_TODAY" | "UPCOMING" | "OVERDUE" | "COMPLETED" | "CANCELLED" | "SCHEDULED";

export interface FuVisit {
  id: string;
  date: string;
  visitType: string;
  followUpDate: string;
  followUpCompleted: boolean;
  followUpCancelledAt: string | null;
  inViewOf: string | null;
  patient: { id: string; name: string; udid: string; uhid: string | null; age: number; sex: string };
  doctor: { id: string; name: string };
  hospital: { id: string; name: string };
  diagnoses: { description: string; icd10Code: string }[];
  status: FollowUpStatus;
}

/* ── Constants ─────────────────────────────────────────────────────────── */
const STATUS_META: Record<FollowUpStatus, { label: string; pill: string; dot: string }> = {
  DUE_TODAY: { label: "Due Today",  pill: "bg-amber-100 text-amber-700 border border-amber-200",  dot: "bg-amber-500" },
  UPCOMING:  { label: "Upcoming",   pill: "bg-blue-100 text-blue-700 border border-blue-200",     dot: "bg-blue-500" },
  OVERDUE:   { label: "Overdue",    pill: "bg-red-100 text-red-700 border border-red-200",         dot: "bg-red-500" },
  COMPLETED: { label: "Completed",  pill: "bg-emerald-100 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500" },
  CANCELLED: { label: "Cancelled",  pill: "bg-slate-100 text-slate-500 border border-slate-200",  dot: "bg-slate-400" },
  SCHEDULED: { label: "Scheduled",  pill: "bg-teal-100 text-teal-700 border border-teal-200",     dot: "bg-teal-500" },
};

const OUTCOMES = [
  { id: "CONTINUE",      label: "Continue Treatment",      icon: RefreshCw,  color: "text-emerald-600" },
  { id: "MODIFY",        label: "Modify Treatment",        icon: FileText,   color: "text-blue-600" },
  { id: "INVESTIGATION", label: "Investigation Required",   icon: FlaskConical, color: "text-purple-600" },
  { id: "PROCEDURE",     label: "Procedure Required",      icon: Scissors,   color: "text-orange-600" },
  { id: "NO_FURTHER",    label: "No Further Follow-up",    icon: CheckCircle2, color: "text-slate-600" },
  { id: "SCHEDULE_NEXT", label: "Schedule Next Follow-up", icon: CalendarClock, color: "text-[var(--color-primary-600)]" },
];

const FOLLOW_UP_TYPES = [
  "Routine Review",
  "Post-operative Review",
  "Treatment Review",
  "IOP Check",
  "OCT Review",
  "Visual Field Assessment",
  "Medication Adjustment",
  "Disease Monitoring",
  "Wound Healing Assessment",
  "Suture Removal",
  "Post-injection Review",
];

const SEX_SHORT: Record<string, string> = { MALE: "M", FEMALE: "F", OTHER: "O" };

/* ── Helpers ────────────────────────────────────────────────────────────── */
function followUpLabel(v: FuVisit): string {
  if (v.inViewOf) return v.inViewOf.length > 40 ? v.inViewOf.slice(0, 38) + "…" : v.inViewOf;
  return "General Follow-up";
}

function overdueText(fuDate: string): string {
  const days = differenceInDays(new Date(), new Date(fuDate));
  if (days === 0) return "Today";
  if (days === 1) return "1 day overdue";
  return `${days} days overdue`;
}

/* ── Sub-components ─────────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: FollowUpStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${m.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${m.dot}`} />
      {m.label}
    </span>
  );
}

function StatCard({
  label, count, icon, accent, iconBg, onClick, active,
}: {
  label: string; count: number; icon: React.ReactNode;
  accent: string; iconBg: string; onClick: () => void; active: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-4 rounded-xl border bg-[var(--color-surface)] transition-all text-left w-full
        ${active ? "border-[var(--color-primary-400)] shadow-md ring-1 ring-[var(--color-primary-300)]" : "border-[var(--color-border)] hover:border-[var(--color-primary-300)] hover:shadow-sm hover:-translate-y-0.5"}`}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div>
        <p className={`text-2xl font-bold leading-none tabular-nums ${count > 0 ? accent : "text-[var(--color-ink-300)]"}`}>
          {count}
        </p>
        <p className="text-xs text-[var(--color-ink-500)] mt-0.5">{label}</p>
      </div>
    </button>
  );
}

/* ── Reschedule panel ───────────────────────────────────────────────────── */
function ReschedulePanel({
  visitId, currentDate, onDone, onClose,
}: { visitId: string; currentDate: string; onDone: () => void; onClose: () => void }) {
  const [date, setDate] = useState(new Date(currentDate).toISOString().slice(0, 10));
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");

  function save() {
    if (!date) return;
    start(async () => {
      const res = await rescheduleFollowUp(visitId, date);
      if (res.error) setErr(res.error);
      else onDone();
    });
  }

  return (
    <div className="mt-2 p-3 rounded-xl border border-[var(--color-primary-200)] bg-[var(--color-primary-50)]">
      <p className="text-xs font-semibold text-[var(--color-primary-800)] mb-2">Reschedule Follow-up</p>
      <div className="flex items-end gap-2 flex-wrap">
        <div>
          <label className="text-[10px] font-semibold text-[var(--color-ink-500)] uppercase tracking-wide block mb-1">New Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            min={new Date().toISOString().slice(0, 10)}
            className="text-xs rounded-lg border border-[var(--color-primary-200)] bg-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)]"
          />
        </div>
        <button
          onClick={save}
          disabled={pending || !date}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] disabled:opacity-50 transition-colors"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          onClick={onClose}
          className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-ink-500)] hover:bg-white transition-colors"
        >
          Cancel
        </button>
      </div>
      {err && <p className="text-xs text-red-600 mt-1.5">{err}</p>}
    </div>
  );
}

/* ── Cancel panel ───────────────────────────────────────────────────────── */
function CancelPanel({
  visitId, onDone, onClose,
}: { visitId: string; onDone: () => void; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");

  function save() {
    start(async () => {
      const res = await cancelFollowUp(visitId, reason);
      if (res.error) setErr(res.error);
      else onDone();
    });
  }

  return (
    <div className="mt-2 p-3 rounded-xl border border-red-200 bg-red-50">
      <p className="text-xs font-semibold text-red-800 mb-2">Cancel Follow-up</p>
      <textarea
        rows={2}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason for cancellation (optional)…"
        className="w-full text-xs rounded-lg border border-red-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
      />
      <div className="flex gap-2 mt-2">
        <button
          onClick={save}
          disabled={pending}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          {pending ? "Cancelling…" : "Confirm Cancel"}
        </button>
        <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-ink-500)] hover:bg-white transition-colors">
          Back
        </button>
      </div>
      {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
    </div>
  );
}

/* ── Complete modal ─────────────────────────────────────────────────────── */
function CompleteModal({ v, onDone, onClose }: { v: FuVisit; onDone: () => void; onClose: () => void }) {
  const [outcome, setOutcome] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [nextType, setNextType] = useState(FOLLOW_UP_TYPES[0]);
  const [nextNotes, setNextNotes] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");

  const showNext = outcome === "SCHEDULE_NEXT";
  const canSave = !!outcome && (outcome !== "SCHEDULE_NEXT" || !!nextDate);

  function save() {
    start(async () => {
      const res = await completeFollowUp({
        visitId: v.id,
        outcome,
        nextDate: showNext ? nextDate : undefined,
        nextType: showNext ? nextType : undefined,
        nextNotes: showNext ? nextNotes : undefined,
      });
      if (res.error) setErr(res.error);
      else onDone();
    });
  }

  const overdueDays = isBefore(new Date(v.followUpDate), new Date())
    ? differenceInDays(new Date(), new Date(v.followUpDate))
    : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl bg-[var(--color-surface)] shadow-2xl overflow-hidden max-h-[90dvh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[var(--color-primary-100)] flex items-center justify-center">
              <CheckCircle2 size={16} className="text-[var(--color-primary-700)]" />
            </div>
            <div>
              <p className="text-sm font-bold text-[var(--color-ink-900)]">Complete Follow-up</p>
              <p className="text-[11px] text-[var(--color-ink-400)]">{v.patient.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)] transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* Visit summary */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] p-3.5">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-400)]">Previous Visit Summary</p>
              <Link
                href={`/emr/${v.patient.udid}`}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--color-primary-600)] hover:text-[var(--color-primary-800)] transition-colors"
              >
                Open EMR <ArrowRight size={10} />
              </Link>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-start gap-2 text-xs">
                <span className="text-[var(--color-ink-400)] shrink-0 w-24">Visit Date</span>
                <span className="font-medium text-[var(--color-ink-700)]">
                  {format(new Date(v.date), "dd MMM yyyy")}
                  {overdueDays > 0 && (
                    <span className="ml-1.5 text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                      {overdueDays}d overdue
                    </span>
                  )}
                </span>
              </div>
              {v.inViewOf && (
                <div className="flex items-start gap-2 text-xs">
                  <span className="text-[var(--color-ink-400)] shrink-0 w-24">Follow-up For</span>
                  <span className="font-medium text-[var(--color-ink-700)]">{v.inViewOf}</span>
                </div>
              )}
              {v.diagnoses.length > 0 && (
                <div className="flex items-start gap-2 text-xs">
                  <span className="text-[var(--color-ink-400)] shrink-0 w-24">Diagnoses</span>
                  <span className="font-medium text-[var(--color-ink-700)]">
                    {v.diagnoses.map((d) => d.description).join(", ")}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Outcome selection */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-400)] mb-2">Outcome</p>
            <div className="grid grid-cols-1 gap-1.5">
              {OUTCOMES.map((o) => {
                const Icon = o.icon;
                const selected = outcome === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setOutcome(o.id)}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-colors text-left
                      ${selected
                        ? "border-[var(--color-primary-400)] bg-[var(--color-primary-50)] text-[var(--color-ink-900)]"
                        : "border-[var(--color-border)] hover:border-[var(--color-primary-300)] text-[var(--color-ink-700)]"
                      }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${selected ? "border-[var(--color-primary-600)]" : "border-[var(--color-border)]"}`}>
                      {selected && <div className="w-2 h-2 rounded-full bg-[var(--color-primary-600)]" />}
                    </div>
                    <Icon size={14} className={`shrink-0 ${o.color}`} />
                    <span>{o.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Next follow-up form */}
          {showNext && (
            <div className="rounded-xl border border-[var(--color-primary-200)] bg-[var(--color-primary-50)] p-3.5 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-primary-700)]">Schedule Next Follow-up</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-[var(--color-ink-500)] uppercase tracking-wide block mb-1">Date <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={nextDate}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setNextDate(e.target.value)}
                    className="w-full text-xs rounded-lg border border-[var(--color-primary-200)] bg-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-[var(--color-ink-500)] uppercase tracking-wide block mb-1">Type</label>
                  <select
                    value={nextType}
                    onChange={(e) => setNextType(e.target.value)}
                    className="w-full text-xs rounded-lg border border-[var(--color-primary-200)] bg-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)]"
                  >
                    {FOLLOW_UP_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-[var(--color-ink-500)] uppercase tracking-wide block mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={nextNotes}
                  onChange={(e) => setNextNotes(e.target.value)}
                  placeholder="Any special instructions or reason for next visit…"
                  className="w-full text-xs rounded-lg border border-[var(--color-primary-200)] bg-white px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)]"
                />
              </div>
            </div>
          )}

          {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[var(--color-border)] flex items-center justify-end gap-2.5 shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] transition-colors">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!canSave || pending}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[var(--color-primary-600)] text-white text-sm font-semibold hover:bg-[var(--color-primary-700)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <CheckCircle2 size={14} />
            {pending ? "Saving…" : "Save & Update Record"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Row actions ────────────────────────────────────────────────────────── */
function ActionButton({
  icon, label, onClick, variant = "default", disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  variant?: "default" | "primary" | "danger";
  disabled?: boolean;
}) {
  const styles = {
    default: "border border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)]",
    primary: "border border-[var(--color-primary-300)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)] hover:bg-[var(--color-primary-100)]",
    danger:  "border border-red-200 bg-red-50 text-red-600 hover:bg-red-100",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${styles[variant]}`}
    >
      {icon}
      {label}
    </button>
  );
}

/* ── Desktop row ────────────────────────────────────────────────────────── */
function FollowUpRow({
  v, role, onReschedule, onCancel, onComplete, activeReschedule, activeCancel, onClosePanel,
}: {
  v: FuVisit;
  role: string;
  onReschedule: (id: string) => void;
  onCancel: (id: string) => void;
  onComplete: (v: FuVisit) => void;
  activeReschedule: string | null;
  activeCancel: string | null;
  onClosePanel: () => void;
}) {
  const isDone = v.status === "COMPLETED" || v.status === "CANCELLED" || v.status === "SCHEDULED";

  return (
    <>
      <tr className={`border-b border-[var(--color-border)] transition-colors ${isDone ? "opacity-60" : "hover:bg-[var(--color-surface-sunken)]"}`}>
        {/* Patient */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[var(--color-primary-100)] flex items-center justify-center shrink-0">
              <User size={13} className="text-[var(--color-primary-700)]" />
            </div>
            <div className="min-w-0">
              <Link
                href={`/patients/${v.patient.udid}`}
                className="text-sm font-semibold text-[var(--color-ink-900)] hover:text-[var(--color-primary-700)] hover:underline truncate block"
              >
                {v.patient.name}
              </Link>
              <p className="text-[11px] text-[var(--color-ink-400)]">
                {v.patient.uhid ?? v.patient.udid} · {v.patient.age}y/{SEX_SHORT[v.patient.sex] ?? v.patient.sex}
              </p>
            </div>
          </div>
        </td>
        {/* Doctor (hospital role only) */}
        {role === "HOSPITAL" && (
          <td className="px-4 py-3 text-xs text-[var(--color-ink-600)]">Dr. {v.doctor.name}</td>
        )}
        {/* Type */}
        <td className="px-4 py-3">
          <span className="text-xs text-[var(--color-ink-700)] max-w-[160px] block truncate">{followUpLabel(v)}</span>
          {v.diagnoses[0] && (
            <span className="text-[11px] text-[var(--color-ink-400)] block truncate">{v.diagnoses[0].description}</span>
          )}
        </td>
        {/* Prev visit */}
        <td className="px-4 py-3 text-xs text-[var(--color-ink-500)]">
          {format(new Date(v.date), "d MMM yyyy")}
        </td>
        {/* Follow-up date */}
        <td className="px-4 py-3">
          <p className="text-sm font-semibold text-[var(--color-ink-800)]">
            {format(new Date(v.followUpDate), "d MMM yyyy")}
          </p>
          {(v.status === "OVERDUE" || v.status === "DUE_TODAY") && (
            <p className="text-[11px] text-red-600 font-medium flex items-center gap-0.5 mt-0.5">
              <Bell size={9} /> {overdueText(v.followUpDate)}
            </p>
          )}
        </td>
        {/* Status */}
        <td className="px-4 py-3"><StatusBadge status={v.status} /></td>
        {/* Actions */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {!isDone && (
              <>
                <ActionButton
                  icon={<RotateCcw size={11} />}
                  label="Reschedule"
                  onClick={() => activeReschedule === v.id ? onClosePanel() : onReschedule(v.id)}
                />
                <ActionButton
                  icon={<Ban size={11} />}
                  label="Cancel"
                  variant="danger"
                  onClick={() => activeCancel === v.id ? onClosePanel() : onCancel(v.id)}
                />
              </>
            )}
          </div>
        </td>
      </tr>
      {/* Inline panels */}
      {(activeReschedule === v.id || activeCancel === v.id) && (
        <tr className="border-b border-[var(--color-border)]">
          <td colSpan={role === "HOSPITAL" ? 7 : 6} className="px-4 pb-3">
            {activeReschedule === v.id && (
              <ReschedulePanel visitId={v.id} currentDate={v.followUpDate} onDone={onClosePanel} onClose={onClosePanel} />
            )}
            {activeCancel === v.id && (
              <CancelPanel visitId={v.id} onDone={onClosePanel} onClose={onClosePanel} />
            )}
          </td>
        </tr>
      )}
    </>
  );
}

/* ── Mobile card ────────────────────────────────────────────────────────── */
function FollowUpCard({
  v, role, onReschedule, onCancel, onComplete, activeReschedule, activeCancel, onClosePanel,
}: {
  v: FuVisit;
  role: string;
  onReschedule: (id: string) => void;
  onCancel: (id: string) => void;
  onComplete: (v: FuVisit) => void;
  activeReschedule: string | null;
  activeCancel: string | null;
  onClosePanel: () => void;
}) {
  const isDone = v.status === "COMPLETED" || v.status === "CANCELLED" || v.status === "SCHEDULED";

  return (
    <div className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3 ${isDone ? "opacity-60" : ""}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[var(--color-primary-100)] flex items-center justify-center shrink-0">
            <User size={14} className="text-[var(--color-primary-700)]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--color-ink-900)] truncate">{v.patient.name}</p>
            <p className="text-[11px] text-[var(--color-ink-400)]">
              {v.patient.uhid ?? v.patient.udid} · {v.patient.age}y/{SEX_SHORT[v.patient.sex] ?? v.patient.sex}
            </p>
          </div>
        </div>
        <StatusBadge status={v.status} />
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {role === "HOSPITAL" && (
          <>
            <span className="text-[var(--color-ink-400)]">Doctor</span>
            <span className="font-medium text-[var(--color-ink-700)]">Dr. {v.doctor.name}</span>
          </>
        )}
        <span className="text-[var(--color-ink-400)]">Reason</span>
        <span className="font-medium text-[var(--color-ink-700)] truncate">{followUpLabel(v)}</span>
        {v.diagnoses[0] && (
          <>
            <span className="text-[var(--color-ink-400)]">Diagnosis</span>
            <span className="font-medium text-[var(--color-ink-700)] truncate">{v.diagnoses[0].description}</span>
          </>
        )}
        <span className="text-[var(--color-ink-400)]">Prev Visit</span>
        <span className="font-medium text-[var(--color-ink-700)]">{format(new Date(v.date), "d MMM yyyy")}</span>
        <span className="text-[var(--color-ink-400)]">Follow-up</span>
        <span className={`font-semibold ${v.status === "OVERDUE" ? "text-red-600" : v.status === "DUE_TODAY" ? "text-amber-700" : "text-[var(--color-ink-700)]"}`}>
          {format(new Date(v.followUpDate), "d MMM yyyy")}
          {v.status === "OVERDUE" && (
            <span className="ml-1 text-[10px] text-red-500 font-medium">{overdueText(v.followUpDate)}</span>
          )}
        </span>
      </div>

      {/* Actions */}
      {!isDone && (
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-[var(--color-border)]">
          <ActionButton
            icon={<RotateCcw size={11} />}
            label="Reschedule"
            onClick={() => activeReschedule === v.id ? onClosePanel() : onReschedule(v.id)}
          />
          <ActionButton
            icon={<Ban size={11} />}
            label="Cancel"
            variant="danger"
            onClick={() => activeCancel === v.id ? onClosePanel() : onCancel(v.id)}
          />
        </div>
      )}

      {/* Inline panels */}
      {activeReschedule === v.id && (
        <ReschedulePanel visitId={v.id} currentDate={v.followUpDate} onDone={onClosePanel} onClose={onClosePanel} />
      )}
      {activeCancel === v.id && (
        <CancelPanel visitId={v.id} onDone={onClosePanel} onClose={onClosePanel} />
      )}
    </div>
  );
}

/* ── Main export ────────────────────────────────────────────────────────── */
export function FollowUpsClient({
  visits,
  role,
  doctorOptions,
}: {
  visits: FuVisit[];
  role: "DOCTOR" | "HOSPITAL";
  doctorOptions: { id: string; name: string }[];
}) {
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState<FollowUpStatus | "ALL">("DUE_TODAY");
  const [doctorFilter, setDoctorFilter] = useState("ALL");
  const [showFilters, setShowFilters]   = useState(false);
  const [activeReschedule, setActiveReschedule] = useState<string | null>(null);
  const [activeCancel, setActiveCancel]         = useState<string | null>(null);
  const [completeVisit, setCompleteVisit]       = useState<FuVisit | null>(null);

  /* Counts for stat cards */
  const counts = useMemo(() => ({
    DUE_TODAY: visits.filter((v) => v.status === "DUE_TODAY").length,
    UPCOMING:  visits.filter((v) => v.status === "UPCOMING").length,
    OVERDUE:   visits.filter((v) => v.status === "OVERDUE").length,
    SCHEDULED: visits.filter((v) => v.status === "SCHEDULED").length,
    COMPLETED: visits.filter((v) => v.status === "COMPLETED").length,
    CANCELLED: visits.filter((v) => v.status === "CANCELLED").length,
  }), [visits]);

  /* Filtered list */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return visits.filter((v) => {
      if (statusFilter !== "ALL" && v.status !== statusFilter) return false;
      if (doctorFilter !== "ALL" && v.doctor.id !== doctorFilter) return false;
      if (q) {
        const hay = [v.patient.name, v.patient.udid, v.patient.uhid ?? "", v.doctor.name, v.inViewOf ?? ""]
          .join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [visits, search, statusFilter, doctorFilter]);

  function closePanel() {
    setActiveReschedule(null);
    setActiveCancel(null);
  }

  const colCount = role === "HOSPITAL" ? 7 : 6;

  return (
    <div className="fade-in pb-24">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-100)] flex items-center justify-center shrink-0">
            <CalendarClock size={20} className="text-[var(--color-primary-700)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--color-ink-900)]">Follow-up Management</h1>
            <p className="text-xs text-[var(--color-ink-400)] mt-0.5">
              {visits.length} total · {format(new Date(), "EEEE, d MMMM yyyy")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {(counts.OVERDUE > 0 || counts.DUE_TODAY > 0) && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 bg-red-50 text-xs font-semibold text-red-700">
              <Bell size={13} className="animate-pulse" />
              {counts.OVERDUE + counts.DUE_TODAY} need attention
            </div>
          )}
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`relative inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-sm font-medium transition-colors
              ${showFilters
                ? "border-[var(--color-primary-400)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)]"
                : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)]"}`}
          >
            <Filter size={14} />
            Filters
            {(search || statusFilter !== "ALL" || doctorFilter !== "ALL") && (
              <span className="w-2 h-2 rounded-full bg-[var(--color-primary-500)] absolute -top-0.5 -right-0.5" />
            )}
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <StatCard
          label="Due Today"
          count={counts.DUE_TODAY}
          icon={<Clock size={17} className="text-amber-600" />}
          accent="text-amber-700" iconBg="bg-amber-50"
          onClick={() => setStatusFilter(statusFilter === "DUE_TODAY" ? "ALL" : "DUE_TODAY")}
          active={statusFilter === "DUE_TODAY"}
        />
        <StatCard
          label="Upcoming"
          count={counts.UPCOMING}
          icon={<CalendarDays size={17} className="text-blue-600" />}
          accent="text-blue-700" iconBg="bg-blue-50"
          onClick={() => setStatusFilter(statusFilter === "UPCOMING" ? "ALL" : "UPCOMING")}
          active={statusFilter === "UPCOMING"}
        />
        <StatCard
          label="Overdue"
          count={counts.OVERDUE}
          icon={<AlertCircle size={17} className="text-red-600" />}
          accent="text-red-700" iconBg="bg-red-50"
          onClick={() => setStatusFilter(statusFilter === "OVERDUE" ? "DUE_TODAY" : "OVERDUE")}
          active={statusFilter === "OVERDUE"}
        />
        <StatCard
          label="Scheduled"
          count={counts.SCHEDULED}
          icon={<CalendarClock size={17} className="text-teal-600" />}
          accent="text-teal-700" iconBg="bg-teal-50"
          onClick={() => setStatusFilter(statusFilter === "SCHEDULED" ? "ALL" : "SCHEDULED")}
          active={statusFilter === "SCHEDULED"}
        />
        <StatCard
          label="Completed"
          count={counts.COMPLETED}
          icon={<CheckCircle2 size={17} className="text-emerald-600" />}
          accent="text-emerald-700" iconBg="bg-emerald-50"
          onClick={() => setStatusFilter(statusFilter === "COMPLETED" ? "ALL" : "COMPLETED")}
          active={statusFilter === "COMPLETED"}
        />
        <StatCard
          label="Cancelled"
          count={counts.CANCELLED}
          icon={<XCircle size={17} className="text-slate-500" />}
          accent="text-slate-600" iconBg="bg-slate-100"
          onClick={() => setStatusFilter(statusFilter === "CANCELLED" ? "ALL" : "CANCELLED")}
          active={statusFilter === "CANCELLED"}
        />
      </div>

      {/* Collapsible filter panel */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 items-center mb-2 p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)]">
          {/* Search */}
          <div className="relative flex-1 min-w-40">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by patient name, ID, doctor…"
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-transparent"
            />
          </div>
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as FollowUpStatus | "ALL")}
            className="text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] text-[var(--color-ink-700)]"
          >
            <option value="ALL">All Statuses</option>
            <option value="DUE_TODAY">Due Today</option>
            <option value="UPCOMING">Upcoming</option>
            <option value="OVERDUE">Overdue</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          {/* Doctor filter (hospital role) */}
          {role === "HOSPITAL" && doctorOptions.length > 1 && (
            <select
              value={doctorFilter}
              onChange={(e) => setDoctorFilter(e.target.value)}
              className="text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] text-[var(--color-ink-700)]"
            >
              <option value="ALL">All Doctors</option>
              {doctorOptions.map((d) => (
                <option key={d.id} value={d.id}>Dr. {d.name}</option>
              ))}
            </select>
          )}

          {(search || statusFilter !== "ALL" || doctorFilter !== "ALL") && (
            <button
              onClick={() => { setSearch(""); setStatusFilter("DUE_TODAY"); setDoctorFilter("ALL"); }}
              className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-500)] hover:bg-white transition-colors"
            >
              <X size={12} /> Reset
            </button>
          )}
        </div>
      )}

      {/* Result count */}
      <p className="text-xs text-[var(--color-ink-400)] mb-3 mt-2">
        Showing {filtered.length} of {visits.length} follow-ups
        {statusFilter !== "ALL" && ` · ${STATUS_META[statusFilter].label}`}
      </p>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col items-center gap-3 py-16 text-center">
          <CalendarClock size={36} className="text-[var(--color-ink-200)]" />
          <p className="text-sm font-semibold text-[var(--color-ink-500)]">
            {visits.length === 0
              ? "No follow-ups scheduled"
              : statusFilter === "DUE_TODAY"
              ? "No follow-ups due today"
              : "No results match your filters"}
          </p>
          <p className="text-xs text-[var(--color-ink-400)]">
            {visits.length === 0
              ? "Set a follow-up date in the EMR to see patients here."
              : statusFilter === "DUE_TODAY"
              ? "Check the Overdue or Upcoming cards to see other follow-ups."
              : "Try adjusting your search or filter criteria."}
          </p>
        </div>
      )}

      {/* Desktop table */}
      {filtered.length > 0 && (
        <>
          <div className="hidden lg:block rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[var(--color-surface-sunken)] border-b border-[var(--color-border)]">
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-400)]">Patient</th>
                    {role === "HOSPITAL" && (
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-400)]">Doctor</th>
                    )}
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-400)]">Reason / Diagnosis</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-400)]">Prev Visit</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-400)]">Follow-up Date</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-400)]">Status</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-400)]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v) => (
                    <FollowUpRow
                      key={v.id}
                      v={v}
                      role={role}
                      onReschedule={(id) => { setActiveReschedule(id); setActiveCancel(null); }}
                      onCancel={(id) => { setActiveCancel(id); setActiveReschedule(null); }}
                      onComplete={setCompleteVisit}
                      activeReschedule={activeReschedule}
                      activeCancel={activeCancel}
                      onClosePanel={closePanel}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden space-y-3">
            {filtered.map((v) => (
              <FollowUpCard
                key={v.id}
                v={v}
                role={role}
                onReschedule={(id) => { setActiveReschedule(id); setActiveCancel(null); }}
                onCancel={(id) => { setActiveCancel(id); setActiveReschedule(null); }}
                onComplete={setCompleteVisit}
                activeReschedule={activeReschedule}
                activeCancel={activeCancel}
                onClosePanel={closePanel}
              />
            ))}
          </div>
        </>
      )}

      {/* Complete modal */}
      {completeVisit && (
        <CompleteModal
          v={completeVisit}
          onDone={() => setCompleteVisit(null)}
          onClose={() => setCompleteVisit(null)}
        />
      )}
    </div>
  );
}
