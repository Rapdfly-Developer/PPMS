"use client";

import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Phone, Tag, FileText, CalendarPlus, Printer, UserRound, Clock, Timer, LogIn, CheckCircle2, Calendar, UserX } from "lucide-react";
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

  const patientUrl = `/patients/${p.udid}?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`;

  return (
    <div
      onClick={() => router.push(patientUrl)}
      className="flex items-start gap-3 px-4 sm:px-5 py-4 rounded-xl border border-[var(--color-border)] bg-white hover:bg-[var(--color-primary-50)] hover:border-[var(--color-primary-200)] transition-colors cursor-pointer"
    >
      {/* Token badge */}
      <div className="flex items-center justify-center shrink-0 w-9 h-9 rounded-xl text-sm font-bold mt-0.5"
        style={{ background: "var(--color-primary-100)", color: "var(--color-primary-700)" }}>
        {token}
      </div>

      <div className="w-px self-stretch bg-[var(--color-border)] hidden sm:block" />

      {/* Content */}
      <div className="flex-1 min-w-0">

        {/* Row 1: Name + Status badge */}
        <div className="flex items-start justify-between gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); router.push(patientUrl); }}
            className="text-sm font-semibold text-[var(--color-ink-900)] hover:text-[var(--color-primary-600)] transition-colors text-left leading-snug"
          >
            {p.name}
          </button>
          <span className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_STYLES[appt.status] ?? ""}`}>
            {STATUS_LABELS[appt.status] ?? appt.status.replace(/_/g, " ")}
          </span>
        </div>

        {/* Row 2: Age · Sex on left, Time on right */}
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span className="text-xs text-[var(--color-ink-400)]">
            {p.age}y · {p.sex.charAt(0).toUpperCase() + p.sex.slice(1).toLowerCase()}
          </span>
          <span className="text-xs font-semibold text-[var(--color-ink-700)] whitespace-nowrap sm:hidden">
            {format(new Date(appt.dateTime), "h:mm a")}
          </span>
        </div>

        {/* Row 3: UDID + Phone + Visit type in one compact row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
          <span className="font-mono text-[11px] bg-[var(--color-primary-50)] text-[var(--color-primary-700)] px-1.5 py-0.5 rounded">
            {p.udid}
          </span>
          {p.mobile && (
            <span className="flex items-center gap-1 text-xs text-[var(--color-ink-500)]">
              <Phone size={11} className="shrink-0" /> {p.mobile}
            </span>
          )}
          {appt.visitType && (
            <span className="flex items-center gap-1 text-xs text-[var(--color-ink-500)]">
              <Tag size={11} className="shrink-0" /> {appt.visitType}
            </span>
          )}
        </div>

        {/* Chief complaint */}
        {(appt.notes || p.complaint) && (
          <div className="mt-1.5 inline-flex max-w-full items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
            <FileText size={11} className="shrink-0 text-amber-500" />
            <span className="truncate">{formatComplaintDisplay(appt.notes || p.complaint)}</span>
          </div>
        )}

        {/* Provisional diagnosis */}
        {provisionalDx.length > 0 && (
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap max-w-full sm:max-w-md">
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">
              Provisional
            </span>
            {provisionalDx.slice(0, 2).map((d, i) => (
              <span
                key={i}
                className="inline-flex min-w-0 max-w-full items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 text-xs font-medium"
              >
                {d.laterality && <span className="font-bold shrink-0">{d.laterality}</span>}
                <span className="truncate">{d.description}</span>
              </span>
            ))}
            {provisionalDx.length > 2 && (
              <span className="shrink-0 text-[11px] text-[var(--color-ink-400)]">
                +{provisionalDx.length - 2} more
              </span>
            )}
          </div>
        )}

        {/* Timestamp trail */}
        {(() => {
          const arrivedAt   = appt.arrivedAt          ? new Date(appt.arrivedAt)          : null;
          const finalizedAt = appt.visit?.finalizedAt  ? new Date(appt.visit.finalizedAt)
                            : appt.completedAt         ? new Date(appt.completedAt)        : null;
          const fmtWait = (m: number) => m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
          if (!arrivedAt && !finalizedAt) return null;
          return (
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] mt-1.5">
              {arrivedAt && (
                <span className="flex items-center gap-1 text-blue-500">
                  <LogIn size={10} /> Arrived: {format(arrivedAt, "h:mm a")}
                </span>
              )}
              {finalizedAt && (
                <span className="flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 size={10} /> Dispensed: {format(finalizedAt, "h:mm a")}
                  {arrivedAt && (
                    <span className="text-[var(--color-ink-400)] ml-0.5">
                      ({fmtWait(Math.max(0, Math.round((finalizedAt.getTime() - arrivedAt.getTime()) / 60000)))} total)
                    </span>
                  )}
                </span>
              )}
            </div>
          );
        })()}

        {/* Confirm / Reject — mobile */}
        {showConfirmReject && (
          <div className="flex sm:hidden items-center gap-2 mt-2.5" onClick={(e) => e.stopPropagation()}>
            <button
              disabled={pending}
              onClick={() => hospitalSetStatus("CONFIRMED")}
              className="flex-1 text-xs font-semibold py-1.5 rounded-lg bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] disabled:opacity-50 transition-colors"
            >
              {pending ? "…" : "Add to Queue"}
            </button>
            <button
              disabled={pending}
              onClick={() => hospitalSetStatus("CANCELLED")}
              className="flex-1 text-xs font-semibold py-1.5 rounded-lg bg-white border border-[var(--color-border)] text-[var(--color-danger-600)] hover:bg-[var(--color-danger-50)] disabled:opacity-50 transition-colors"
            >
              Reject
            </button>
          </div>
        )}

        {/* Bottom actions */}
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
            {showNoShow && (
              <button
                disabled={pending}
                onClick={() => doctorSetStatus("NO_SHOW")}
                className="flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-lg bg-white border border-[var(--color-border)] text-red-500 hover:bg-red-50 hover:border-red-200 disabled:opacity-50 transition-colors"
              >
                <UserX size={11} /> No Show
              </button>
            )}
          </div>
        )}
      </div>

      {/* Right column — desktop only (sm+) */}
      <div className="hidden sm:flex flex-col items-end gap-1.5 shrink-0 self-start" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-medium text-[var(--color-ink-700)] whitespace-nowrap">
          {format(new Date(appt.dateTime), "h:mm a")}
        </p>
        <span className="flex items-center gap-1 text-[11px] text-[var(--color-ink-400)]">
          <Clock size={10} /> Booked: {format(new Date(appt.createdAt), "d MMM, h:mm a")}
        </span>
        {showConfirmReject && (
          <div className="flex items-center gap-2 mt-0.5">
            <button
              disabled={pending}
              onClick={() => hospitalSetStatus("CONFIRMED")}
              className="text-xs font-medium px-3 py-1 rounded-lg bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] disabled:opacity-50"
            >
              {pending ? "…" : "Add to Queue"}
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
