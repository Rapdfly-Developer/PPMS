"use client";

import { format } from "date-fns";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, X, CalendarPlus, Eye, Calendar, MoreVertical } from "lucide-react";
import { hospitalUpdateAppointmentStatus } from "./actions";
import { ScheduleNextSlotModal } from "./ScheduleNextSlotModal";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  REQUESTED:   { label: "REQUESTED",   cls: "bg-amber-500 text-white"  },
  CONFIRMED:   { label: "CONFIRMED",   cls: "bg-blue-500 text-white"   },
  DISPENSED:   { label: "DISPENSED",   cls: "bg-emerald-500 text-white" },
  CANCELLED:   { label: "CANCELLED",   cls: "bg-red-500 text-white"    },
  NO_SHOW:     { label: "NO SHOW",     cls: "bg-red-400 text-white"    },
  RESCHEDULED: { label: "RESCHEDULED", cls: "bg-slate-400 text-white"  },
};

export function AppointmentTableRow({
  appt,
  role,
}: {
  appt:  any;
  role:  string;
  token: number;   // kept in signature so caller doesn't need to change
}) {
  const [pending, startTransition] = useTransition();
  const [showSlot,       setShowSlot]       = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);

  const p      = appt.patient;
  const badge  = STATUS_BADGE[appt.status] ?? { label: appt.status, cls: "bg-gray-400 text-white" };
  const dept   = appt.doctor?.specialty ?? "General OPD";
  const type   = appt.visitType ?? "Consultation";
  const isComp = appt.status === "DISPENSED";

  function hospitalSet(s: "CONFIRMED" | "CANCELLED") {
    startTransition(() => hospitalUpdateAppointmentStatus(appt.id, s));
  }

  return (
    <tr className={`hover:bg-[var(--color-ink-50)] transition-colors ${isComp ? "opacity-60" : ""}`}>
      {/* Time */}
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="text-sm font-medium text-[var(--color-ink-700)]">
          {format(new Date(appt.dateTime), "h:mm a")}
        </span>
      </td>

      {/* UHID */}
      <td className="px-4 py-3 whitespace-nowrap">
        <Link
          href={`/patients/${p.udid}?returnTo=/appointments`}
          className="font-mono text-xs text-[var(--color-primary-600)] hover:underline"
        >
          {p.udid}
        </Link>
      </td>

      {/* Patient Name */}
      <td className="px-4 py-3">
        {appt.visit ? (
          <Link
            href={`/emr/${p.udid}?visit=${appt.visit.id}&returnTo=/appointments`}
            className="text-sm font-semibold text-[var(--color-ink-900)] hover:text-[var(--color-primary-600)] transition-colors"
          >
            {p.name}
          </Link>
        ) : (
          <Link
            href={`/patients/${p.udid}?returnTo=/appointments`}
            className="text-sm font-semibold text-[var(--color-ink-900)] hover:text-[var(--color-primary-600)] transition-colors"
          >
            {p.name}
          </Link>
        )}
      </td>

      {/* Age / Gender */}
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="text-sm text-[var(--color-ink-600)]">
          {p.age}y / {p.sex.charAt(0).toUpperCase() + p.sex.slice(1).toLowerCase()}
        </span>
      </td>

      {/* Doctor */}
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="text-sm text-[var(--color-ink-600)]">
          {appt.doctor ? `Dr. ${appt.doctor.name}` : "—"}
        </span>
      </td>

      {/* Department */}
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="text-sm text-[var(--color-ink-600)]">{dept}</span>
      </td>

      {/* Type */}
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="text-sm text-[var(--color-ink-600)]">{type}</span>
      </td>

      {/* Status badge */}
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide ${badge.cls}`}>
          {badge.label}
        </span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-1.5">

          {/* CONFIRMED non-walk-in → View + Reschedule */}
          {role === "HOSPITAL" && appt.status === "CONFIRMED" && !appt.isWalkIn && (
            <>
              <Link
                href={`/patients/${p.udid}?returnTo=/appointments`}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)] transition-colors"
              >
                <Eye size={12} /> View
              </Link>
              <button
                onClick={() => setShowReschedule(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)] transition-colors"
              >
                <Calendar size={12} /> Reschedule
              </button>
            </>
          )}

          {/* REQUESTED → Confirm + Reject */}
          {role === "HOSPITAL" && appt.status === "REQUESTED" && !appt.isWalkIn && (
            <>
              <button
                disabled={pending}
                onClick={() => hospitalSet("CONFIRMED")}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
              >
                <Check size={12} /> Confirm
              </button>
              <button
                disabled={pending}
                onClick={() => hospitalSet("CANCELLED")}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-300 text-red-600 bg-white hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                <X size={12} /> Reject
              </button>
            </>
          )}

          {/* Walk-in CONFIRMED → Schedule Next Slot */}
          {role === "HOSPITAL" && appt.status === "CONFIRMED" && appt.isWalkIn && (
            <button
              onClick={() => setShowSlot(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-[var(--color-primary-300)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)] hover:bg-[var(--color-primary-100)] transition-colors"
            >
              <CalendarPlus size={12} /> Schedule Next Slot
            </button>
          )}


          {/* 3-dot menu */}
          {role === "HOSPITAL" && (
            <button className="p-1.5 rounded-lg text-[var(--color-ink-400)] hover:bg-[var(--color-ink-100)] hover:text-[var(--color-ink-700)] transition-colors">
              <MoreVertical size={14} />
            </button>
          )}
        </div>

        {/* Modals */}
        {showSlot && (
          <ScheduleNextSlotModal
            appointmentId={appt.id}
            patientName={p.name}
            doctorName={appt.doctor?.name ?? ""}
            onClose={() => setShowSlot(false)}
          />
        )}
        {showReschedule && (
          <ScheduleNextSlotModal
            appointmentId={appt.id}
            patientName={p.name}
            doctorName={appt.doctor?.name ?? ""}
            onClose={() => setShowReschedule(false)}
          />
        )}
      </td>
    </tr>
  );
}
