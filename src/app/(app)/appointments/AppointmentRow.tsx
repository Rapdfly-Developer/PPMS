"use client";

import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Phone, Stethoscope, Tag, FileText, CalendarPlus, Printer, UserRound, Clock, Timer, LogIn, CheckCircle2, Calendar } from "lucide-react";
import { hospitalUpdateAppointmentStatus, doctorUpdateAppointmentStatus, doctorConfirmAppointment, doctorCancelAppointment } from "./actions";
import { formatComplaintDisplay } from "@/lib/appointment-cc";
import { ScheduleNextSlotModal } from "./ScheduleNextSlotModal";

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED:   "bg-[var(--color-primary-50)] text-[var(--color-primary-700)]",
  REQUESTED:   "bg-amber-100 text-amber-700",
  CONFIRMED:   "bg-blue-100 text-blue-700",
  RESCHEDULED: "bg-[var(--color-info-100)] text-[var(--color-info-600)]",
  DISPENSED:   "bg-emerald-100 text-emerald-700",
  CANCELLED:   "bg-red-100 text-red-700",
  NO_SHOW:     "bg-red-100 text-red-700",
};

export function AppointmentRow({ appt, role, token }: { appt: any; role: string; token: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showSlotModal, setShowSlotModal] = useState(false);
  const p = appt.patient;

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

  const hasActions = isCompleted || showScheduleNext || showCancelConfirmed;

  return (
    <div
      onClick={() => router.push(`/patients/${p.udid}?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`)}
      className="flex items-start gap-3 px-4 sm:px-5 py-4 rounded-xl border border-[var(--color-border)] bg-white hover:bg-[var(--color-primary-50)] hover:border-[var(--color-primary-200)] transition-colors cursor-pointer"
    >
      {/* Token badge */}
      <div className="flex items-center justify-center shrink-0 w-9 h-9 rounded-xl text-sm font-bold mt-0.5"
        style={{ background: "var(--color-primary-100)", color: "var(--color-primary-700)" }}>
        {token}
      </div>

      <div className="w-px self-stretch bg-[var(--color-border)]" />

      {/* Left: patient info stacked directly, no gap from right column */}
      <div className="flex-1 min-w-0">
        {/* Name + demographics */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <button
            onClick={(e) => { e.stopPropagation(); router.push(`/patients/${p.udid}?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`); }}
            className="text-sm font-semibold text-[var(--color-ink-900)] hover:text-[var(--color-primary-600)] transition-colors"
          >
            {p.name}
          </button>
          <span className="text-xs text-[var(--color-ink-400)]">
            {p.age}y · {p.sex.charAt(0).toUpperCase() + p.sex.slice(1).toLowerCase()}
          </span>
          <span className="font-mono text-[11px] bg-[var(--color-primary-50)] text-[var(--color-primary-700)] px-1.5 py-0.5 rounded">
            {p.udid}
          </span>
        </div>

        {/* Contact / meta — immediately below name */}
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-[var(--color-ink-500)] mt-1">
          {p.mobile && (
            <span className="flex items-center gap-1"><Phone size={11} /> {p.mobile}</span>
          )}
          {appt.doctor && (
            <span className="flex items-center gap-1"><UserRound size={11} /> Dr. {appt.doctor.name}</span>
          )}
          {appt.visitType && (
            <span className="flex items-center gap-1"><Tag size={11} /> {appt.visitType}</span>
          )}
        </div>

        {/* Chief complaint */}
        {(appt.notes || p.complaint) && (
          <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium max-w-full">
            <FileText size={11} className="shrink-0 text-amber-500" />
            <span className="truncate">{formatComplaintDisplay(appt.notes || p.complaint)}</span>
          </div>
        )}

        {/* Timestamp trail */}
        {(() => {
          const arrivedAt  = appt.arrivedAt         ? new Date(appt.arrivedAt)           : null;
          const seenAt     = appt.visit?.date        ? new Date(appt.visit.date)          : null;
          const finalizedAt = appt.visit?.finalizedAt ? new Date(appt.visit.finalizedAt)
                            : appt.completedAt       ? new Date(appt.completedAt)         : null;
          const waitMins   = arrivedAt && seenAt
            ? Math.max(0, Math.round((seenAt.getTime() - arrivedAt.getTime()) / 60000))
            : null;
          const fmtWait = (m: number) => m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
          if (!arrivedAt && !seenAt && !finalizedAt) return null;
          return (
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] mt-1.5">
              {arrivedAt && (
                <span className="flex items-center gap-1 text-blue-500" title="Patient arrived at clinic">
                  <LogIn size={10} /> Arrived: {format(arrivedAt, "h:mm a")}
                </span>
              )}
              {seenAt && (
                <span className="flex items-center gap-1 text-[var(--color-primary-600)]" title="Doctor started consultation">
                  <Stethoscope size={10} /> Seen: {format(seenAt, "h:mm a")}
                  {waitMins !== null && (
                    <span className="text-amber-500 ml-0.5" title="Wait time from arrival to being seen">
                      ({fmtWait(waitMins)} wait)
                    </span>
                  )}
                </span>
              )}
              {finalizedAt && (
                <span className="flex items-center gap-1 text-emerald-600" title="Consultation finalized / patient dispensed">
                  <CheckCircle2 size={10} /> Dispensed: {format(finalizedAt, "h:mm a")}
                  {arrivedAt && (
                    <span className="text-[var(--color-ink-400)] ml-0.5" title="Total time at clinic">
                      ({fmtWait(Math.max(0, Math.round((finalizedAt.getTime() - arrivedAt.getTime()) / 60000)))} total)
                    </span>
                  )}
                </span>
              )}
            </div>
          );
        })()}

        {/* Bottom actions: Prescription / Schedule / Cancel */}
        {hasActions && (
          <div className="flex flex-wrap items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
            {isCompleted && appt.visit && (
              <a
                href={`/api/prescription-pdf/${appt.visit.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
              >
                <Printer size={11} /> Prescription
              </a>
            )}
            {showScheduleNext && (
              <>
                <button
                  onClick={() => setShowSlotModal(true)}
                  className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg bg-[var(--color-primary-50)] border border-[var(--color-primary-200)] text-[var(--color-primary-700)] hover:bg-[var(--color-primary-100)] transition-colors"
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
                className="text-xs font-medium px-3 py-1 rounded-lg bg-white border border-[var(--color-border)] text-[var(--color-danger-600)] hover:bg-[var(--color-danger-50)] disabled:opacity-50"
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </div>

      {/* Right column: time → status → booked → confirm/reject */}
      <div className="flex flex-col items-end gap-1.5 shrink-0 self-start" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-[var(--color-ink-700)] whitespace-nowrap">
            {format(new Date(appt.dateTime), "h:mm a")}
          </p>
          <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap ${STATUS_STYLES[appt.status] ?? ""}`}>
            {appt.status.replace(/_/g, " ")}
          </span>
        </div>
        <span className="flex items-center gap-1 text-[11px] text-[var(--color-ink-400)]" title="Appointment booked at">
          <Clock size={10} /> Booked: {format(new Date(appt.createdAt), "d MMM, h:mm a")}
        </span>
        {showConfirmReject && (
          <div className="flex items-center gap-2 mt-0.5">
            <button
              disabled={pending}
              onClick={() => hospitalSetStatus("CONFIRMED")}
              className="text-xs font-medium px-3 py-1 rounded-lg bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] disabled:opacity-50"
            >
              {pending ? "…" : "Confirm"}
            </button>
            <button
              disabled={pending}
              onClick={() => hospitalSetStatus("CANCELLED")}
              className="text-xs font-medium px-3 py-1 rounded-lg bg-white border border-[var(--color-border)] text-[var(--color-danger-600)] hover:bg-[var(--color-danger-50)] disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
