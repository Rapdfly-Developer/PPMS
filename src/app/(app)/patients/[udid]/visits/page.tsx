import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { startOfDay } from "date-fns";
import { Download } from "lucide-react";
import { VisitsListClient } from "./VisitsListClient";

export default async function PatientVisitsPage({
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
      visits: {
        orderBy: { date: "desc" },
        include: {
          hospital:    { select: { name: true } },
          doctor:      { select: { name: true } },
          generalExam: { select: { chiefComplaint: true } },
          diagnoses:   { select: { description: true } },
        },
      },
    },
  });

  if (!patient) notFound();

  const todayStart = startOfDay(new Date());
  const allCount   = patient.visits.length;

  const pastVisits = patient.visits
    .map((v, i) => ({
      id:          v.id,
      visitNumber: allCount - i,
      date:        v.date.toISOString(),
      status:      v.status,
      visitType:   v.visitType ?? null,
      hospital:    v.hospital ?? null,
      doctor:      v.doctor   ?? null,
      generalExam: v.generalExam ?? null,
      diagnoses:   v.diagnoses,
    }))
    .filter((v) => new Date(v.date) < todayStart);

  const totalVisits = pastVisits.length;

  return (
    <div className="fade-in pb-12 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-ink-900)]">Previous Visits</h1>
          <p className="text-sm text-[var(--color-ink-400)] mt-0.5">
            {totalVisits} visit{totalVisits !== 1 ? "s" : ""} on record
          </p>
        </div>
        {totalVisits > 0 && (
          <a
            href={`/api/visit-summary-pdf/patient/${udid}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl border border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] transition-colors"
          >
            <Download size={14} /> Download All
          </a>
        )}
      </div>

      <VisitsListClient visits={pastVisits} udid={udid} />
    </div>
  );
}
