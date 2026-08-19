import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, CalendarCheck } from "lucide-react";
import NewOtForm, { OtPrefill } from "./NewOtForm";

export const metadata = { title: "Schedule OT" };

export default async function NewOtPage({
  searchParams,
}: {
  searchParams: Promise<{ visitId?: string }>;
}) {
  await requirePermission("patients.view");
  const { visitId } = await searchParams;

  if (!visitId) redirect("/scheduled-ot");

  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    select: {
      id: true,
      patientId: true,
      doctorId: true,
      hospitalId: true,
      advisedSurgeryName: true,
      advisedSurgeryEye: true,
      patient:   { select: { id: true, name: true, udid: true, age: true, sex: true } },
      doctor:    { select: { id: true, name: true } },
      hospital:  { select: { id: true, name: true } },
      counsellingRecord: true,
    },
  });

  if (!visit) notFound();

  // Only proceed if counselling is CONFIRMED
  const status = (visit.counsellingRecord as any)?.status ?? "";
  if (status !== "CONFIRMED") redirect(`/counseling/${visit.patient.udid}`);

  const rec = visit.counsellingRecord as any;

  const EYE_LABEL: Record<string, string> = { RE: "Right Eye", LE: "Left Eye", OU: "Both Eyes" };

  const prefill: OtPrefill = {
    patientId:         visit.patient.id,
    hospitalId:        visit.hospitalId,
    operatingSurgeonId: visit.doctorId,
    patientName:       visit.patient.name,
    patientAge:        visit.patient.age ?? undefined,
    patientSex:        visit.patient.sex ?? undefined,
    doctorName:        visit.doctor?.name ?? undefined,
    hospitalName:      visit.hospital.name,
    surgeryName:       visit.advisedSurgeryName ?? "",
    surgeryEye:        visit.advisedSurgeryEye ? (EYE_LABEL[visit.advisedSurgeryEye] ?? visit.advisedSurgeryEye) : undefined,
    procedure:         rec?.procedure ?? undefined,
    laterality:        rec?.laterality ?? undefined,
    anaesthesia:       rec?.anaesthesia ?? undefined,
    dateOfSurgery:     rec?.dateOfSurgery ? new Date(rec.dateOfSurgery).toISOString().slice(0, 10) : undefined,
    iolSummary:        rec?.iolType
      ? [rec.iolType, rec.iolLensName, rec.iolPower, rec.iolBrand].filter(Boolean).join(" · ")
      : undefined,
  };

  return (
    <div className="fade-in max-w-2xl mx-auto">
      <Link
        href={`/counseling/${visit.patient.udid}`}
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)] mb-5 transition-colors"
      >
        <ChevronLeft size={15} /> Back to Counseling
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center">
          <CalendarCheck size={17} className="text-teal-700" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--color-ink-900)]">Schedule OT</h1>
          <p className="text-xs text-[var(--color-ink-400)] mt-0.5">Pre-filled from confirmed counselling</p>
        </div>
      </div>

      <NewOtForm prefill={prefill} />
    </div>
  );
}
