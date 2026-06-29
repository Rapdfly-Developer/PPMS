import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import Link from "next/link";
import { CopyUhidButton } from "./CopyUhidButton";
import { PrintButton } from "./PrintButton";
import { UserPlus, Users, CalendarDays, CheckCircle2 } from "lucide-react";

export default async function RegistrationSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ udid: string }>;
  searchParams: Promise<{ fromBooking?: string }>;
}) {
  await requireUser();
  const { udid } = await params;
  const { fromBooking } = await searchParams;
  const isFromBooking = fromBooking === "1";

  const patient = await prisma.patient.findUnique({
    where: { udid },
    include: { registeredAt: true },
  });
  if (!patient) notFound();

  return (
    <div className="min-h-full flex flex-col items-center justify-center py-16 px-4 fade-in">
      <div className="w-full max-w-lg space-y-6">

        {/* Success header */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-8 w-8 text-green-600" strokeWidth={1.75} />
          </div>
          <h1 className="text-2xl font-semibold text-[var(--color-ink-900)]">Registration Complete</h1>
          <p className="text-sm text-[var(--color-ink-500)] mt-1">Patient has been successfully registered in HMIS</p>
        </div>

        {/* Appointment booked notice */}
        {isFromBooking && (
          <div className="rounded-xl bg-[var(--color-primary-50)] border border-[var(--color-primary-200)] px-4 py-3 text-sm text-[var(--color-primary-700)] flex items-center gap-2">
            <CalendarDays size={15} className="shrink-0" />
            Appointment has been booked and is pending hospital confirmation.
          </div>
        )}

        {/* UHID card */}
        <div className="rounded-2xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface-sunken)] p-8 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-ink-400)] mb-3">
            Unique Health ID (UHID)
          </p>
          <p className="font-mono text-3xl font-bold tracking-widest text-[var(--color-ink-900)] mb-4">
            {patient.udid}
          </p>
          <CopyUhidButton udid={patient.udid} />
        </div>

        {/* Patient details */}
        <div className="rounded-2xl border border-[var(--color-border)] bg-white p-6">
          <div className="grid grid-cols-2 gap-y-4 text-sm">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)] mb-0.5">Patient</p>
              <p className="font-semibold text-[var(--color-ink-900)]">{patient.name}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)] mb-0.5">Age</p>
              <p className="font-semibold text-[var(--color-ink-900)]">{patient.age} years</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)] mb-0.5">Gender</p>
              <p className="font-semibold text-[var(--color-ink-900)]">{patient.sex}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)] mb-0.5">Mobile</p>
              <p className="font-semibold text-[var(--color-ink-900)]">{patient.mobile}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)] mb-0.5">Category</p>
              <p className="font-semibold text-[var(--color-ink-900)]">{patient.category}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)] mb-0.5">Registered</p>
              <p className="font-semibold text-[var(--color-ink-900)]">{format(new Date(patient.createdAt), "yyyy-MM-dd")}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-3 gap-3">
          <PrintButton />
          {isFromBooking ? (
            <Link
              href="/appointments"
              className="flex flex-col items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-white text-[var(--color-ink-700)] px-3 py-4 text-sm font-medium hover:bg-[var(--color-surface-sunken)] transition-colors text-center"
            >
              <CalendarDays size={18} />
              <span className="text-xs leading-tight">View Appointments</span>
            </Link>
          ) : (
            <Link
              href="/patients/new"
              className="flex flex-col items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-white text-[var(--color-ink-700)] px-3 py-4 text-sm font-medium hover:bg-[var(--color-surface-sunken)] transition-colors text-center"
            >
              <UserPlus size={18} />
              <span className="text-xs leading-tight">Register Another Patient</span>
            </Link>
          )}
          <Link
            href="/patients"
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-white text-[var(--color-ink-400)] px-3 py-4 text-sm font-medium hover:bg-[var(--color-surface-sunken)] transition-colors text-center"
          >
            <Users size={18} />
            <span className="text-xs leading-tight">Back to Patient Directory</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
