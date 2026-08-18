import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import Link from "next/link";
import { Scissors, ChevronLeft, User } from "lucide-react";
import CounsellingForm, { ExistingRecord } from "./CounsellingForm";

export default async function CounselingPatientPage({
  params,
}: {
  params: Promise<{ udid: string }>;
}) {
  const { udid } = await params;
  await requirePermission("patients.view");

  const patient = await prisma.patient.findUnique({
    where: { udid },
    select: {
      id: true,
      name: true,
      udid: true,
      age: true,
      sex: true,
      visits: {
        where: { surgeryAdvised: true },
        orderBy: { date: "desc" },
        take: 1,
        select: {
          id: true,
          date: true,
          advisedSurgeryName:  true,
          advisedSurgeryEye:   true,
          advisedSurgeryNotes: true,
          counsellingRecord: true,
          doctor:   { select: { name: true } },
        },
      },
    },
  });

  if (!patient) notFound();

  const visit = patient.visits[0] ?? null;
  if (!visit) {
    return (
      <div className="fade-in max-w-2xl mx-auto">
        <Link
          href="/counseling"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)] mb-5 transition-colors"
        >
          <ChevronLeft size={15} /> Back to Counseling
        </Link>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] flex flex-col items-center py-16 gap-2">
          <Scissors size={24} className="text-[var(--color-ink-300)]" />
          <p className="text-sm text-[var(--color-ink-400)]">No surgical counselling recorded for this patient.</p>
        </div>
      </div>
    );
  }

  const rec = visit.counsellingRecord;
  const existing: ExistingRecord | null = rec
    ? {
        paymentType:  rec.paymentType,
        paymentMode:  rec.paymentMode,
        schemeName:   rec.schemeName,
        schemeType:   rec.schemeType,
        outOfPocket:  rec.outOfPocket,
        iolType:      rec.iolType,
        iolLensName:  rec.iolLensName,
        iolPower:     rec.iolPower,
        iolBrand:     rec.iolBrand,
        iolToric:     rec.iolToric,
        laterality:   rec.laterality,
        procedure:    rec.procedure,
        anaesthesia:  rec.anaesthesia,
        estimateAmount: rec.estimateAmount ? String(rec.estimateAmount) : null,
        estimateVague:  rec.estimateVague,
        fitForSurgery:  rec.fitForSurgery,
        advancePaid:  rec.advancePaid ? String(rec.advancePaid) : null,
        dateOfSurgery: rec.dateOfSurgery
          ? rec.dateOfSurgery.toISOString().slice(0, 10)
          : null,
        eligibleForSurgery: rec.eligibleForSurgery,
      }
    : null;

  const EYE_LABEL: Record<string, string> = { RE: "Right Eye", LE: "Left Eye", OU: "Both Eyes" };

  return (
    <div className="fade-in max-w-2xl mx-auto">
      {/* Back */}
      <Link
        href="/counseling"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)] mb-5 transition-colors"
      >
        <ChevronLeft size={15} /> Back to Counseling
      </Link>

      {/* Patient header */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 mb-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <User size={20} className="text-amber-700" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-[var(--color-ink-900)]">{patient.name}</h1>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
              {patient.age && (
                <span className="text-sm text-[var(--color-ink-500)]">{patient.age} yrs</span>
              )}
              {patient.sex && (
                <span className="text-sm text-[var(--color-ink-500)]">
                  · {patient.sex === "MALE" ? "Male" : patient.sex === "FEMALE" ? "Female" : patient.sex}
                </span>
              )}
              <span className="text-xs text-[var(--color-ink-400)] font-mono">{patient.udid}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Visit summary strip */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-5 flex flex-wrap gap-x-5 gap-y-1 items-center">
        <div className="flex items-center gap-1.5">
          <Scissors size={13} className="text-amber-600 shrink-0" />
          <span className="text-sm font-semibold text-amber-900">
            {visit.advisedSurgeryName ?? "Surgery advised"}
          </span>
        </div>
        {visit.advisedSurgeryEye && (
          <span className="text-xs text-amber-700">
            {EYE_LABEL[visit.advisedSurgeryEye] ?? visit.advisedSurgeryEye}
          </span>
        )}
        <span className="text-xs text-amber-600 ml-auto">
          {format(new Date(visit.date), "dd MMM yyyy")}
          {visit.doctor?.name && ` · Dr. ${visit.doctor.name}`}
        </span>
      </div>

      {/* Counselling form */}
      <CounsellingForm visitId={visit.id} udid={udid} existing={existing} />
    </div>
  );
}
