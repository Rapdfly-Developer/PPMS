import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { startOfDay } from "date-fns";
import { VisitsListClient } from "./VisitsListClient";
import { DownloadAllButton } from "./DownloadAllButton";

export default async function PatientVisitsPage({
  params,
  searchParams,
}: {
  params: Promise<{ udid: string }>;
  searchParams: Promise<{ visitId?: string }>;
}) {
  const { udid } = await params;
  const { visitId } = await searchParams;
  await requirePermission("patients.view");

  const patient = await prisma.patient.findUnique({
    where: { udid },
    select: {
      id: true,
      name: true,
      udid: true,
      visits: {
        where: { appointment: { is: { status: "DISPENSED" } } },
        orderBy: { date: "desc" },
        include: {
          hospital:             { select: { name: true } },
          doctor:               { select: { name: true } },
          generalExam:          { select: { chiefComplaint: true } },
          diagnoses:            { select: { description: true, laterality: true, status: true } },
          appointment:          { select: { createdAt: true, dateTime: true, arrivedAt: true, partialDispenseAt: true, completedAt: true, isWalkIn: true } },
          investigationOrders:  { select: { createdAt: true, updatedAt: true, resultRef: true }, orderBy: { createdAt: "asc" } },
        },
      },
    },
  });

  if (!patient) notFound();

  const todayStart = startOfDay(new Date());

  const [noShowAppointments, futureAppointments] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        patientId: patient.id,
        visit:     null,
        dateTime:  { lt: todayStart },
        status:    { notIn: ["CANCELLED", "RESCHEDULED", "DISPENSED"] },
      },
      select: { dateTime: true },
    }),
    prisma.appointment.findMany({
      where: {
        patientId: patient.id,
        dateTime:  { gte: todayStart },
        status:    { notIn: ["CANCELLED", "RESCHEDULED", "DISPENSED"] },
      },
      select: { dateTime: true },
    }),
  ]);

  const noShowDates    = noShowAppointments.map((a) => a.dateTime.toISOString());
  const futureApptDates = futureAppointments.map((a) => a.dateTime.toISOString());

  const allCount = patient.visits.length;

  const pastVisits = patient.visits.map((v, i) => ({
    id:          v.id,
    visitNumber: allCount - i,
    date:        v.date.toISOString(),
    status:      v.status,
    visitType:   v.visitType ?? null,
    isWalkIn:    v.appointment?.isWalkIn ?? false,
    hospital:    v.hospital ?? null,
    doctor:      v.doctor   ?? null,
    generalExam: v.generalExam ?? null,
    diagnoses:   v.diagnoses,
    timestamps: {
      bookedAt:                v.appointment?.createdAt?.toISOString()                      ?? null,
      scheduledAt:             v.appointment?.dateTime?.toISOString()                       ?? null,
      arrivedAt:               v.appointment?.arrivedAt?.toISOString()                      ?? null,
      seenAt:                  (v as any).consultationStartedAt?.toISOString()              ?? null,
      consultationCompletedAt: (v as any).consultationCompletedAt?.toISOString()            ?? null,
      investigationOrderedAt:  v.investigationOrders?.[0]?.createdAt?.toISOString()         ?? null,
      reportUploadedAt:        v.investigationOrders
                                 ?.filter((o) => o.resultRef)
                                 ?.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())?.[0]
                                 ?.updatedAt?.toISOString()                                 ?? null,
      refractionStartedAt:     (v as any).refractionStartedAt?.toISOString()                ?? null,
      refractionCompletedAt:   (v as any).refractionCompletedAt?.toISOString()              ?? null,
      refractionPassedOverAt:  (v as any).refractionPassedOverAt?.toISOString()             ?? null,
      partialDispenseAt:       v.appointment?.partialDispenseAt?.toISOString()              ?? null,
      dispensedAt:             v.appointment?.completedAt?.toISOString()                   ?? null,
      finalizedAt:             (v as any).finalizedAt?.toISOString()                        ?? null,
    },
  }));

  const totalVisits = pastVisits.length;

  return (
    <div className="fade-in pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-ink-900)]">Previous Visits</h1>
          <p className="text-sm text-[var(--color-ink-400)] mt-0.5">
            {totalVisits} visit{totalVisits !== 1 ? "s" : ""} on record
          </p>
        </div>
        {totalVisits > 0 && (
          <DownloadAllButton udid={udid} />
        )}
      </div>

      <VisitsListClient
        visits={pastVisits}
        udid={udid}
        initialVisitId={visitId}
        noShowDates={noShowDates}
        futureApptDates={futureApptDates}
      />
    </div>
  );
}
