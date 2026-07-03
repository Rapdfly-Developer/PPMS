"use client";

import { format } from "date-fns";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Phone, Stethoscope, Tag, FileText, CalendarPlus, Printer, UserRound } from "lucide-react";
import { hospitalUpdateAppointmentStatus, doctorUpdateAppointmentStatus, doctorConfirmAppointment, doctorCancelAppointment } from "./actions";
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

  return (
    <div className="flex items-center gap-3 px-5 py-4 rounded-xl border border-[var(--color-border)] bg-white hover:bg-[var(--color-primary-50)] hover:border-[var(--color-primary-200)] transition-colors">

      {/* Token badge */}
      <div className="flex items-center justify-center shrink-0 w-9 h-9 rounded-xl text-sm font-bold"
        style={{ background: "var(--color-primary-100)", color: "var(--color-primary-700)" }}>
        {token}
      </div>

      <div className="w-px self-stretch bg-[var(--color-border)]" />

      {/* Patient info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <Link
            href={`/patients/${p.udid}`}
            className="text-sm font-semibold text-[var(--color-ink-900)] hover:text-[var(--color-primary-600)] transition-colors"
          >
            {p.name}
          </Link>
          <span className="text-xs text-[var(--color-ink-400)]">
            {p.age}y · {p.sex.charAt(0).toUpperCase() + p.sex.slice(1).toLowerCase()}
          </span>
          <span className="font-mono text-[11px] bg-[var(--color-primary-50)] text-[var(--color-primary-700)] px-1.5 py-0.5 rounded">
            {p.udid}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-ink-500)]">
          {p.mobile && (
            <span className="flex items-center gap-1"><Phone size={11} /> {p.mobile}</span>
          )}
          {appt.doctor && (
            <span className="flex items-center gap-1"><UserRound size={11} /> Dr. {appt.doctor.name}</span>
          )}
          {appt.visitType && (
            <span className="flex items-center gap-1"><Tag size={11} /> {appt.visitType}</span>
          )}
          {(appt.notes || p.complaint) && (
            <span className="flex items-center gap-1 italic"><FileText size={11} /> {appt.notes || p.complaint}</span>
          )}
        </div>
      </div>

      {/* Right column — time, status, action buttons */}
      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
        <p className="text-sm font-medium text-[var(--color-ink-700)]">
          {format(new Date(appt.dateTime), "h:mm a")}
        </p>
        <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${STATUS_STYLES[appt.status] ?? ""}`}>
          {appt.status.replace(/_/g, " ")}
        </span>


        {/* View Prescription — for completed with a visit (both roles) */}
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

        {/* Hospital / Doctor: Confirm / Reject — for both REQUESTED and SCHEDULED */}
        {(role === "HOSPITAL" || role === "DOCTOR") && !isCompleted && (appt.status === "REQUESTED" || appt.status === "SCHEDULED") && !appt.isWalkIn && (
          <>
            <button
              disabled={pending}
              onClick={() => hospitalSetStatus("CONFIRMED")}
              className="text-xs font-medium px-2.5 py-1 rounded-lg bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] disabled:opacity-50"
            >
              {pending ? "…" : "Confirm"}
            </button>
            <button
              disabled={pending}
              onClick={() => hospitalSetStatus("CANCELLED")}
              className="text-xs font-medium px-2.5 py-1 rounded-lg bg-white border border-[var(--color-border)] text-[var(--color-danger-600)] hover:bg-[var(--color-danger-50)] disabled:opacity-50"
            >
              Reject
            </button>
          </>
        )}

        {/* Hospital: Walk-in confirmed — Schedule Next Slot */}
        {role === "HOSPITAL" && !isCompleted && appt.isWalkIn && appt.status === "CONFIRMED" && (
          <>
            <button
              onClick={() => setShowSlotModal(true)}
              className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg bg-[var(--color-primary-50)] border border-[var(--color-primary-200)] text-[var(--color-primary-700)] hover:bg-[var(--color-primary-100)] transition-colors"
            >
              <CalendarPlus size={12} /> Schedule Next Slot
            </button>
            {showSlotModal && (
              <ScheduleNextSlotModal
                appointmentId={appt.id}
                patientName={p.name}
                doctorName={appt.doctor?.name ?? ""}
                onClose={() => setShowSlotModal(false)}
              />
            )}
          </>
        )}

        {/* Hospital: Cancel confirmed non-walk-in */}
        {role === "HOSPITAL" && !isCompleted && appt.status === "CONFIRMED" && !appt.isWalkIn && (
          <button
            disabled={pending}
            onClick={() => hospitalSetStatus("CANCELLED")}
            className="text-xs font-medium px-2.5 py-1 rounded-lg bg-white border border-[var(--color-border)] text-[var(--color-danger-600)] hover:bg-[var(--color-danger-50)] disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
