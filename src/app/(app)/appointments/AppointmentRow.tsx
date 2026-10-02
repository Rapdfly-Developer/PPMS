"use client";

import { format } from "date-fns";
import { openPdfNative } from "@/lib/open-pdf";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Phone, Tag, FileText, CalendarPlus, Printer, Clock, Timer, LogIn, CheckCircle2, Calendar, UserX } from "lucide-react";
import { hospitalUpdateAppointmentStatus, doctorUpdateAppointmentStatus, doctorConfirmAppointment, doctorCancelAppointment } from "./actions";
import { formatComplaintDisplay } from "@/lib/appointment-cc";
import { ScheduleNextSlotModal } from "./ScheduleNextSlotModal";

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
  CONFIRMED:        "In Queue",
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

export function AppointmentRow({ appt, role, token }: { appt: any; role: string; token: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showSlotModal, setShowSlotModal] = useState(false);
  const p = appt.patient;
  const provisionalDx: ProvisionalDx[] = (appt.visit?.diagnoses ?? []).filter(
    (d: ProvisionalDx) => d.provisional,
  );

  function hospitalSetStatus(status: "CONFIRMED" | "CANCELLED") {
    if (role === "DOCTOR") {
      startTransition(() =>
        status === "CONFIRMED"
          ? doctorConfirmAppointment(appt.id)
          : doctorCancelAppointment(appt.id)
      );
    } else {
      startTransition(() => hospitalUpdateAppointmentStatus(appt.id, status));
    }
  }

  function doctorSetStatus(status: "DISPENSED" | "NO_SHOW" | "RESCHEDULED") {
    startTransition(() => doctorUpdateAppointmentStatus(appt.id, status));
  }

  const isCompleted = appt.status === "DISPENSED";

  const showConfirmReject =
    (role === "HOSPITAL" || role === "DOCTOR") &&
    !isCompleted &&
    (appt.status === "REQUESTED" || appt.status === "SCHEDULED") &&
    !appt.isWalkIn;

  const showScheduleNext =
    role === "HOSPITAL" && !isCompleted && appt.isWalkIn && appt.status === "CONFIRMED";

  const showCancelConfirmed =
    role === "HOSPITAL" && !isCompleted && appt.status === "CONFIRMED" && !appt.isWalkIn;

  const showNoShow =
    role === "DOCTOR" &&
    appt.status === "CONFIRMED" &&
    !appt.arrivedAt;

  const hasActions = isCompleted || showScheduleNext || showCancelConfirmed || showNoShow;

  // Timestamp data
  const arrivedAt   = appt.arrivedAt          ? new Date(appt.arrivedAt)          : null;
  const finalizedAt = appt.visit?.finalizedAt  ? new Date(appt.visit.finalizedAt)
                    : appt.completedAt         ? new Date(appt.completedAt)        : null;
  const fmtDuration = (m: number) => m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
  const totalMins = arrivedAt && finalizedAt
    ? Math.max(0, Math.round((finalizedAt.getTime() - arrivedAt.getTime()) / 60000))
    : null;

  const patientUrl = `/patients/${p.udid}?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}&source=appointments`;

  return (
    <div
      onClick={() => router.push(patientUrl)}
      className="flex items-start gap-3 px-4 sm:px-5 py-4 rounded-xl border border-[var(--color-border)] bg-white hover:bg-[var(--color-primary-50)] hover:border-[var(--color-primary-200)] transition-colors cursor-pointer"
    >
      {/* Token badge */}
      <div
        className="flex items-center justify-center shrink-0 w-9 h-9 rounded-xl text-[13px] sm:text-sm font-bold mt-0.5"
        style={{ background: "var(--color-primary-100)", color: "var(--color-primary-700)" }}
      >
        {token}
      </div>

      <div className="w-px self-stretch bg-[var(--color-border)] hidden sm:block" />

      {/* Body: patient block + right block */}
      <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:gap-4 gap-2">

        {/* ── Patient block ─────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">

          {/* Name */}
          <button
            onClick={(e) => { e.stopPropagation(); router.push(patientUrl); }}
            className="text-[13px] sm:text-sm font-semibold text-[var(--color-ink-900)] hover:text-[var(--color-primary-600)] transition-colors text-left leading-snug"
          >
            {p.name}
          </button>

          {/* Age · Sex */}
          <div className="mt-0.5 text-[11px] sm:text-xs text-[var(--color-ink-400)]">
            {p.age}y · {p.sex.charAt(0).toUpperCase() + p.sex.slice(1).toLowerCase()}
          </div>

          {/* UDID + Phone + Visit type */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
            <span className="font-mono text-[11px] bg-[var(--color-primary-50)] text-[var(--color-primary-700)] px-1.5 py-0.5 rounded">
              {p.udid}
            </span>
            {p.mobile && (
              <span className="flex items-center gap-1 text-[11px] sm:text-xs text-[var(--color-ink-500)]">
                <Phone size={11} className="shrink-0" /> {p.mobile}
              </span>
            )}
            {appt.visitType && (
              <span className="flex items-center gap-1 text-[11px] sm:text-xs text-[var(--color-ink-500)]">
                <Tag size={11} className="shrink-0" /> {appt.visitType}
              </span>
            )}
          </div>

          {/* Chief complaint */}
          {(appt.notes || p.complaint) && (
            <div className="clinical-complaint-chip mt-1.5 inline-flex max-w-full items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] sm:text-xs">
              <FileText size={11} className="shrink-0 text-amber-500" />
              <span className="truncate">{formatComplaintDisplay(appt.notes || p.complaint)}</span>
            </div>
          )}

          {/* Provisional diagnosis */}
          {provisionalDx.length > 0 && (
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap max-w-full">
              <span className="shrink-0 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">
                Provisional
              </span>
              {provisionalDx.slice(0, 2).map((d, i) => (
                <span
                  key={i}
                  className="clinical-diagnosis-chip inline-flex min-w-0 max-w-full items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] sm:text-xs"
                >
                  {d.laterality && <span className="clinical-laterality shrink-0">{d.laterality}</span>}
                  <span className="truncate">{d.description}</span>
                </span>
              ))}
              {provisionalDx.length > 2 && (
                <span className="shrink-0 text-[10px] sm:text-[11px] text-[var(--color-ink-400)]">
                  +{provisionalDx.length - 2} more
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Right block: status, times, actions ───────────────────── */}
        <div
          className="flex flex-col gap-1 sm:items-end sm:shrink-0 sm:min-w-[160px] sm:max-w-[240px]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Status badge */}
          <span className={`self-start sm:self-auto text-[10px] sm:text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_STYLES[appt.status] ?? ""}`}>
            {STATUS_LABELS[appt.status] ?? appt.status.replace(/_/g, " ")}
          </span>

          {/* Appointment time */}
          <p className="flex items-center gap-1 text-[13px] sm:text-sm font-semibold text-[var(--color-ink-700)] whitespace-nowrap mt-0.5">
            <Calendar size={12} className="shrink-0 text-[var(--color-ink-400)]" />
            {format(new Date(appt.dateTime), "h:mm a")}
          </p>

          {/* Booked time */}
          <span className="flex items-center gap-1 text-[10px] sm:text-[11px] text-[var(--color-ink-400)]">
            <Clock size={10} className="shrink-0" /> Booked: {format(new Date(appt.createdAt), "d MMM, h:mm a")}
          </span>

          {/* Arrived */}
          {arrivedAt && (
            <span className="flex items-center gap-1 text-[10px] sm:text-[11px] text-blue-500">
              <LogIn size={10} className="shrink-0" /> Arrived: {format(arrivedAt, "h:mm a")}
            </span>
          )}

          {/* Dispensed */}
          {finalizedAt && (
            <span className="flex items-center gap-1 text-[10px] sm:text-[11px] text-emerald-600">
              <CheckCircle2 size={10} className="shrink-0" /> Dispensed: {format(finalizedAt, "h:mm a")}
            </span>
          )}

          {/* Total duration */}
          {totalMins !== null && (
            <span className="flex items-center gap-1 text-[10px] sm:text-[11px] text-[var(--color-ink-400)]">
              <Timer size={10} className="shrink-0" /> Total: {fmtDuration(totalMins)}
            </span>
          )}

          {/* Confirm / Reject */}
          {showConfirmReject && (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <button
                disabled={pending}
                onClick={() => hospitalSetStatus("CONFIRMED")}
                className="text-[11px] sm:text-xs font-medium px-3 py-1.5 rounded-lg bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] disabled:opacity-50 transition-colors"
              >
                {pending ? "…" : "Confirm / Add to Queue"}
              </button>
              <button
                disabled={pending}
                onClick={() => hospitalSetStatus("CANCELLED")}
                className="text-[11px] sm:text-xs font-medium px-3 py-1.5 rounded-lg bg-white border border-[var(--color-border)] text-[var(--color-danger-600)] hover:bg-[var(--color-danger-50)] disabled:opacity-50 transition-colors"
              >
                Reject
              </button>
            </div>
          )}

          {/* Other actions */}
          {hasActions && (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {isCompleted && appt.visit && (
                <button
                  type="button"
                  onClick={() => { void openPdfNative(`/api/prescription-pdf/${appt.visit!.id}`); }}
                  className="flex items-center gap-1 text-[11px] sm:text-xs font-medium px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                >
                  <Printer size={11} /> Prescription
                </button>
              )}
              {showScheduleNext && (
                <>
                  <button
                    onClick={() => setShowSlotModal(true)}
                    className="flex items-center gap-1.5 text-[11px] sm:text-xs font-medium px-2.5 py-1 rounded-lg bg-[var(--color-primary-50)] border border-[var(--color-primary-200)] text-[var(--color-primary-700)] hover:bg-[var(--color-primary-100)] transition-colors"
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
                </>
              )}
              {showCancelConfirmed && (
                <button
                  disabled={pending}
                  onClick={() => hospitalSetStatus("CANCELLED")}
                  className="text-[11px] sm:text-xs font-medium px-3 py-1 rounded-lg bg-white border border-[var(--color-border)] text-[var(--color-danger-600)] hover:bg-[var(--color-danger-50)] disabled:opacity-50"
                >
                  Cancel
                </button>
              )}
              {showNoShow && (
                <button
                  disabled={pending}
                  onClick={() => doctorSetStatus("NO_SHOW")}
                  className="flex items-center gap-1 text-[11px] sm:text-xs font-medium px-3 py-1 rounded-lg bg-white border border-[var(--color-border)] text-red-500 hover:bg-red-50 hover:border-red-200 disabled:opacity-50 transition-colors"
                >
                  <UserX size={11} /> No Show
                </button>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
