"use client";

import Link from "next/link";
import { CalendarDays, Stethoscope, UserRound } from "lucide-react";

export function AppointmentsHub() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 px-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[var(--color-ink-900)]">Appointments</h1>
        <p className="text-sm text-[var(--color-ink-400)] mt-1">What would you like to do?</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full max-w-xl">
        {/* Doctor Appointment */}
        <Link
          href="/appointments/availability"
          className="group flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-[var(--color-border)] bg-white hover:border-[var(--color-primary-400)] hover:shadow-lg transition-all duration-200"
        >
          <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary-50)] flex items-center justify-center group-hover:bg-[var(--color-primary-100)] transition-colors">
            <Stethoscope size={28} className="text-[var(--color-primary-600)]" />
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-[var(--color-ink-800)]">Doctor Appointment</p>
            <p className="text-xs text-[var(--color-ink-400)] mt-1">Manage your hospital schedules & availability</p>
          </div>
        </Link>

        {/* Patient Appointment */}
        <Link
          href="/appointments/book"
          className="group flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-[var(--color-border)] bg-white hover:border-[var(--color-primary-400)] hover:shadow-lg transition-all duration-200"
        >
          <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary-50)] flex items-center justify-center group-hover:bg-[var(--color-primary-100)] transition-colors">
            <UserRound size={28} className="text-[var(--color-primary-600)]" />
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-[var(--color-ink-800)]">Patient Appointment</p>
            <p className="text-xs text-[var(--color-ink-400)] mt-1">Book an appointment for a patient</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
