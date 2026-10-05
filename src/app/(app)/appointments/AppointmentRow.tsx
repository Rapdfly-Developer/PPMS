"use client";

import { format } from "date-fns";
import { openPdfNative } from "@/lib/open-pdf";
import { useRouter } from "next/navigation";
import { useState, useTransition, useRef } from "react";
import { Phone, Tag, CalendarPlus, Printer, Clock, Timer, LogIn, CheckCircle2, Calendar, UserX, Undo2 } from "lucide-react";
import {
  confirmAppointmentOnly,
  rejectAppointment,
  addToQueue,
  undoConfirmAppointment,
  hospitalUpdateAppointmentStatus,
  doctorUpdateAppointmentStatus,
  doctorCancelAppointment,
} from "./actions";
import { ScheduleNextSlotModal } from "./ScheduleNextSlotModal";
import { ComplaintChips } from "@/components/ui/ComplaintChips";

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED:        "bg-[var(--color-primary-50)] text-[var(--color-primary-700)]",
  REQUESTED:        "bg-amber-100 text-amber-700",
  CONFIRMED:        "bg-blue-100 text-blue-700",
  RESCHEDULED:      "bg-[var(--color-info-100)] text-[var(--color-info-600)]",
  DISPENSED:        "bg-emerald-100 text-emerald-700",
  CANCELLED:        "bg-red-100 text-red-700",
  NO_SHOW:          "bg-red-100 text-red-700",
  PARTIAL_DISPENSE: "bg-orange-100 text-orange-700",
};

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED:        "Scheduled",
  REQUESTED:        "Requested",
  CONFIRMED:        "Confirmed",
  RESCHEDULED:      "Rescheduled",
  DISPENSED:        "Dispensed",
  CANCELLED:        "Cancelled",
  NO_SHOW:          "No Show",
  PARTIAL_DISPENSE: "Partial Dispense",
};

type ProvisionalDx = {
  description: string;
  laterality: string | null;
  provisional: boolean;
};

/** Hospital-side actions this user may take (see staffAppointmentPerms). */
export type ApptPerms = { confirm: boolean; cancel: boolean; schedule: boolean };

export function AppointmentRow({ appt, role, perms, token }: { appt: any; role: string; perms: ApptPerms; token: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [confirmToast, setConfirmToast] = useState(false);
  const [rejectToast, setRejectToast] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const p = appt.patient;
  const provisionalDx: ProvisionalDx[] = (appt.visit?.diagnoses ?? []).filter(
    (d: ProvisionalDx) => d.provisional,
  );

  // ── Cancel Confirmed (existing flow, no notification change) ─────────────
  function cancelConfirmedAppt() {
    if (role === "DOCTOR") {
      startTransition(() => doctorCancelAppointment(appt.id));
    } else {
      startTransition(() => hospitalUpdateAppointmentStatus(appt.id, "CANCELLED"));
    }
  }

  // ── New 3-button handlers ─────────────────────────────────────────────────
  function handleConfirm() {
    setConfirmToast(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setConfirmToast(false), 5000);
    startTransition(() => confirmAppointmentOnly(appt.id));
  }

  function handleReject() {
    startTransition(() => rejectAppointment(appt.id));
    setRejectToast(true);
    setTimeout(() => setRejectToast(false), 3000);
  }

  function handleAddToQueue() {
    startTransition(() => addToQueue(appt.id));
  }

  function handleUndo() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setConfirmToast(false);
    startTransition(() => undoConfirmAppointment(appt.id));
  }

  function doctorSetStatus(status: "DISPENSED" | "NO_SHOW" | "RESCHEDULED") {
    startTransition(() => doctorUpdateAppointmentStatus(appt.id, status));
  }

  const isCompleted = appt.status === "DISPENSED";
  const isDoctor = role === "DOCTOR";

  // REQUESTED or SCHEDULED (not walk-in): show 3-button confirm/add-to-q/reject
  const awaitingConfirmation =
    !isCompleted && (appt.status === "REQUESTED" || appt.status === "SCHEDULED") && !appt.isWalkIn;
  const showConfirmActions = awaitingConfirmation && (isDoctor || perms.confirm || perms.cancel);

  // CONFIRMED + no arrivedAt (not walk-in): show Add to Q
  const showAddToQForConfirmed =
    !isCompleted && !appt.isWalkIn && appt.status === "CONFIRMED" && !appt.arrivedAt &&
    (isDoctor || perms.confirm);

  const showScheduleNext =
    perms.schedule && !isCompleted && appt.isWalkIn && appt.status === "CONFIRMED";

  const showCancelConfirmed =
    perms.cancel && !isCompleted && appt.status === "CONFIRMED" && !appt.isWalkIn;

  const showNoShow =
    role === "DOCTOR" &&
    appt.status === "CONFIRMED" &&
    !appt.arrivedAt;

  // Timestamp data
  const arrivedAt   = appt.arrivedAt          ? new Date(appt.arrivedAt)          : null;
  const finalizedAt = appt.visit?.finalizedAt  ? new Date(appt.visit.finalizedAt)
                    : appt.completedAt         ? new Date(appt.completedAt)        : null;
  const fmtDuration = (m: number) => m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
  const totalMins = arrivedAt && finalizedAt
    ? Math.max(0, Math.round((finalizedAt.getTime() - arrivedAt.getTime()) / 60000))
    : null;

  // Dynamic label: "In Queue" only once arrivedAt is set
  const statusLabel =
    appt.status === "CONFIRMED"
      ? (arrivedAt ? "In Queue" : "Confirmed")
      : (STATUS_LABELS[appt.status] ?? appt.status.replace(/_/g, " "));

  const patientUrl = `/patients/${p.udid}?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}&source=appointments`;

  return (
    <div
      onClick={() => router.push(patientUrl)}
      className="flex items-start gap-3 px-4 sm:px-5 py-4 rounded-xl border border-[var(--color-border)] bg-white hover:bg-[var(--color-primary-50)] hover:border-[var(--color-primary-200)] transition-colors cursor-pointer"
    >
      <div
        className="flex items-center justify-center shrink-0 w-9 h-9 rounded-xl text-label sm:text-sm font-bold mt-0.5"
        style={{ background: "var(--color-primary-100)", color: "var(--color-primary-700)" }}
      >
        {token}
      </div>

      <div className="w-px self-stretch bg-[var(--color-border)] hidden sm:block" />

      <div className="flex-1 min-w-0 flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(180px,260px)_220px] lg:items-start lg:gap-5">
        {/* Left: patient identity and diagnosis */}
        <div className="min-w-0 flex-1">
          <button
            onClick={(e) => { e.stopPropagation(); router.push(patientUrl); }}
            className="text-label sm:text-sm font-semibold text-[var(--color-ink-900)] hover:text-[var(--color-primary-600)] transition-colors text-left leading-snug"
          >
            {p.name}
          </button>
          <p className="mt-0.5 text-caption sm:text-xs text-[var(--color-ink-400)]">
            {p.age}y · {p.sex.charAt(0).toUpperCase() + p.sex.slice(1).toLowerCase()}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono text-caption bg-[var(--color-primary-50)] text-[var(--color-primary-700)] px-1.5 py-0.5 rounded">
              {p.udid}
            </span>
            {p.mobile && (
              <span className="inline-flex items-center gap-1 text-caption sm:text-xs text-[var(--color-ink-500)]">
                <Phone size={11} className="shrink-0" /> {p.mobile}
              </span>
            )}
            {appt.visitType && (
              <span className="inline-flex items-center gap-1 text-caption sm:text-xs text-[var(--color-ink-500)]">
                <Tag size={11} className="shrink-0" /> {appt.visitType}
              </span>
            )}
          </div>
          {provisionalDx.length > 0 && (
            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="text-micro sm:text-caption font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">Provisional</span>
              {provisionalDx.slice(0, 2).map((d, i) => (
                <span key={i} className="clinical-diagnosis-chip inline-flex min-w-0 max-w-full items-center gap-1 px-2.5 py-1 rounded-lg border text-caption sm:text-xs">
                  {d.laterality && <span className="clinical-laterality shrink-0">{d.laterality}</span>}
                  <span className="truncate">{d.description}</span>
                </span>
              ))}
              {provisionalDx.length > 2 && <span className="text-caption sm:text-caption text-[var(--color-ink-400)]">+{provisionalDx.length - 2} more</span>}
            </div>
          )}
        </div>

        {/* Middle: chief complaint */}
        <div className="flex min-w-0 items-center lg:self-center lg:justify-center">
          {(appt.notes || p.complaint) && (
            <ComplaintChips value={appt.notes || p.complaint} />
          )}
        </div>

        {/* Right: status, appointment metadata and visit timestamps */}
        <div className="w-full lg:w-[220px] lg:shrink-0" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between gap-3">
            <span className={`text-caption sm:text-caption font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_STYLES[appt.status] ?? ""}`}>
              {statusLabel}
            </span>
            <span className="inline-flex items-center gap-1 text-caption sm:text-sm font-semibold text-[var(--color-ink-700)] whitespace-nowrap tabular-nums">
              <Calendar size={12} className="shrink-0 text-[var(--color-ink-400)]" />
              {format(new Date(appt.dateTime), "h:mm a")}
            </span>
          </div>
          <div className="mt-1 flex justify-end">
            <span className="inline-flex items-center gap-1 text-caption sm:text-caption text-[var(--color-ink-400)] whitespace-nowrap tabular-nums">
              <Clock size={10} /> Booked: {format(new Date(appt.createdAt), "d MMM, h:mm a")}
            </span>
          </div>
          <div className="mt-1.5 flex flex-col items-end gap-1 text-caption sm:text-caption">
            {arrivedAt && appt.status !== "NO_SHOW" && (
              <span className="inline-flex items-center gap-1 text-blue-500 whitespace-nowrap tabular-nums">
                <LogIn size={10} /> Arrived: {format(arrivedAt, "h:mm a")}
              </span>
            )}
            {finalizedAt && appt.status !== "NO_SHOW" && (
              <span className="inline-flex items-center gap-1 text-emerald-600 whitespace-nowrap tabular-nums">
                <CheckCircle2 size={10} /> Dispensed: {format(finalizedAt, "h:mm a")}
              </span>
            )}
            {totalMins !== null && (
              <span className="inline-flex items-center gap-1 text-[var(--color-ink-400)] whitespace-nowrap">
                <Timer size={10} /> Total: {fmtDuration(totalMins)}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2 mt-2">

            {/* ── REQUESTED: Confirm / Add to Q / Reject ── */}
            {showConfirmActions && !confirmToast && (
              <div className="flex flex-wrap justify-end gap-2">
                {(isDoctor || perms.confirm) && (
                  <button
                    disabled={pending}
                    onClick={handleConfirm}
                    className="text-caption sm:text-xs font-medium px-3 py-1.5 rounded-lg bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] disabled:opacity-50 transition-colors"
                  >
                    {pending ? "…" : "Confirm"}
                  </button>
                )}
                {(isDoctor || perms.confirm) && (
                  <button
                    disabled={pending}
                    onClick={handleAddToQueue}
                    className="text-caption sm:text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                  >
                    {pending ? "…" : "Add to Q"}
                  </button>
                )}
                {(isDoctor || perms.cancel) && (
                  <button
                    disabled={pending}
                    onClick={handleReject}
                    className="text-caption sm:text-xs font-medium px-3 py-1.5 rounded-lg bg-white border border-[var(--color-border)] text-[var(--color-danger-600)] hover:bg-[var(--color-danger-50)] disabled:opacity-50 transition-colors"
                  >
                    Reject
                  </button>
                )}
              </div>
            )}

            {/* ── Confirm toast with Undo (5 s) ── */}
            {confirmToast && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-caption sm:text-xs text-emerald-700">
                <CheckCircle2 size={13} className="shrink-0 text-emerald-600" />
                <span className="flex-1">Appointment confirmed</span>
                <button
                  onClick={handleUndo}
                  disabled={pending}
                  className="inline-flex items-center gap-1 font-semibold text-emerald-800 hover:underline disabled:opacity-50"
                >
                  <Undo2 size={11} /> Undo
                </button>
              </div>
            )}

            {/* ── Reject toast (auto-dismisses) ── */}
            {rejectToast && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-caption sm:text-xs text-red-700">
                Appointment rejected
              </div>
            )}

            {/* ── CONFIRMED + not yet queued: Add to Q ── */}
            {showAddToQForConfirmed && (
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  disabled={pending}
                  onClick={handleAddToQueue}
                  className="text-caption sm:text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {pending ? "…" : "Add to Q"}
                </button>
              </div>
            )}

            {/* ── Prescription (completed) ── */}
            {isCompleted && appt.visit && (
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { void openPdfNative(`/api/prescription-pdf/${appt.visit!.id}`); }}
                  className="flex items-center gap-1 text-caption sm:text-xs font-medium px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                >
                  <Printer size={11} /> Prescription
                </button>
              </div>
            )}

            {/* ── Walk-in confirmed: schedule next slot ── */}
            {showScheduleNext && (
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  onClick={() => setShowSlotModal(true)}
                  className="flex items-center gap-1.5 text-caption sm:text-xs font-medium px-2.5 py-1 rounded-lg bg-[var(--color-primary-50)] border border-[var(--color-primary-200)] text-[var(--color-primary-700)] hover:bg-[var(--color-primary-100)] transition-colors"
                >
                  <CalendarPlus size={12} /> Schedule Next Slot
                </button>
                {showSlotModal && (
                  <span className="contents">
                    <ScheduleNextSlotModal
                      appointmentId={appt.id}
                      patientName={p.name}
                      doctorName={appt.doctor?.name ?? ""}
                      onClose={() => setShowSlotModal(false)}
                    />
                  </span>
                )}
              </div>
            )}

            {/* ── Cancel Confirmed / No Show ── */}
            {(showCancelConfirmed || showNoShow) && (
              <div className="flex flex-wrap justify-end gap-2">
                {showCancelConfirmed && (
                  <button
                    disabled={pending}
                    onClick={cancelConfirmedAppt}
                    className="text-caption sm:text-xs font-medium px-3 py-1 rounded-lg bg-white border border-[var(--color-border)] text-[var(--color-danger-600)] hover:bg-[var(--color-danger-50)] disabled:opacity-50"
                  >
                    Cancel
                  </button>
                )}
                {showNoShow && (
                  <button
                    disabled={pending}
                    onClick={() => doctorSetStatus("NO_SHOW")}
                    className="flex items-center gap-1 text-caption sm:text-xs font-medium px-3 py-1 rounded-lg bg-white border border-[var(--color-border)] text-red-500 hover:bg-red-50 hover:border-red-200 disabled:opacity-50 transition-colors"
                  >
                    <UserX size={11} /> No Show
                  </button>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
