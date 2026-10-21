import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { startOfDay } from "date-fns";
import { VisitsListClient } from "./VisitsListClient";
import { DownloadAllButton } from "./DownloadAllButton";
import { getNoShowRegistry, noShowScopeFor } from "@/lib/noShowRegistry";

// Fields each visit row needs (completed and incomplete visits alike)
const VISIT_INCLUDE = {
  hospital:             { select: { name: true } },
  doctor:               { select: { name: true } },
  generalExam:          { select: { chiefComplaint: true } },
  diagnoses:            { select: { description: true, laterality: true, status: true } },
  appointment:          { select: { createdAt: true, dateTime: true, arrivedAt: true, partialDispenseAt: true, completedAt: true, isWalkIn: true } },
  investigationOrders:  { select: { createdAt: true, updatedAt: true, resultRef: true }, orderBy: { createdAt: "asc" as const } },
} as const;

export default async function PatientVisitsPage({
  params,
  searchParams,
}: {
  params: Promise<{ udid: string }>;
  searchParams: Promise<{ visitId?: string }>;
}) {
  const { udid } = await params;
  const { visitId } = await searchParams;
  const user = await requirePermission("patients.view");

  const patient = await prisma.patient.findUnique({
    where: { udid },
    select: {
      id: true,
      name: true,
      udid: true,
      visits: {
        // Completed visits only — the doctor clicked Finalize & Sign
        where: { appointment: { is: { status: "DISPENSED", consultationStatus: "FINALIZED" } } },
        orderBy: { date: "desc" },
        include: VISIT_INCLUDE,
      },
    },
  });

  if (!patient) notFound();

  const todayStart = startOfDay(new Date());

  const [noShowRecords, futureAppointments] = await Promise.all([
    // Same records (and scope) as the profile No Shows counter and the Patient Library
    noShowScopeFor(user).then((scope) => getNoShowRegistry(scope, patient.id)),
    prisma.appointment.findMany({
      where: {
        patientId: patient.id,
        dateTime:  { gte: todayStart },
        status:    { notIn: ["CANCELLED", "RESCHEDULED", "DISPENSED"] },
      },
      select: { dateTime: true },
    }),
  ]);

  // Numbered oldest first — the same numbering as the profile No Show drawer
  const noShows = [...noShowRecords]
    .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime())
    .map((r, i) => ({ number: i + 1, date: r.dateTime.toISOString(), kind: r.kind, visitId: r.visitId }));
  const futureApptDates = futureAppointments.map((a) => a.dateTime.toISOString());

  // Incomplete visits (saved EMR data, never finalized) — selectable from the calendar
  const incompleteIds = noShows.map((n) => n.visitId).filter((id): id is string => !!id);
  const incompleteRaw = incompleteIds.length
    ? await prisma.visit.findMany({ where: { id: { in: incompleteIds } }, include: VISIT_INCLUDE })
    : [];

  type RawVisit = (typeof patient.visits)[number];
  const toRow = (v: RawVisit, visitNumber: number) => ({
    id:          v.id,
    visitNumber,
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
  });

  const allCount = patient.visits.length;
  const pastVisits = patient.visits.map((v, i) => toRow(v, allCount - i));
  const incompleteVisits = incompleteRaw.map((v) => ({
    ...toRow(v, 0),
    noShowNumber: noShows.find((n) => n.visitId === v.id)!.number,
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
        incompleteVisits={incompleteVisits}
        noShows={noShows}
        futureApptDates={futureApptDates}
      />
    </div>
  );
}
