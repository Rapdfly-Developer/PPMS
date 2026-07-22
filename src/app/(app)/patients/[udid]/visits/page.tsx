import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { format, startOfDay } from "date-fns";
import { Download } from "lucide-react";
import { EmrViewerButton, VisitDownloadButton } from "../EmrViewerModal";
import { VisitSummaryTabs } from "../VisitSummaryTabs";

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
          hospital: { select: { name: true } },
          doctor:   { select: { name: true } },
          generalExam: { select: { chiefComplaint: true } },
          diagnoses:   { select: { description: true } },
        },
      },
    },
  });

  if (!patient) notFound();

  // Previous visits = strictly before today; today's visit is not history yet.
  // Visit numbers stay based on the full record so they match the EMR viewer.
  const todayStart = startOfDay(new Date());
  const allCount = patient.visits.length;
  const pastVisits = patient.visits
    .map((v, i) => ({ ...v, visitNumber: allCount - i }))
    .filter((v) => v.date < todayStart);
  const totalVisits = pastVisits.length;

  return (
    <div className="fade-in pb-12 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-ink-900)]">Previous Visits</h1>
          <p className="text-sm text-[var(--color-ink-400)] mt-0.5">{totalVisits} visit{totalVisits !== 1 ? "s" : ""} on record</p>
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

      {totalVisits === 0 ? (
        <div className="text-center py-16 text-[var(--color-ink-400)]">
          <p className="text-base">No visits recorded yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {pastVisits.map((v) => {
            const visitNumber = v.visitNumber;
            const diagText = v.diagnoses.map((d) => d.description).filter(Boolean).join(", ");
            const isClosed = v.status === "CLOSED";
            return (
              <div key={v.id} className="rounded-xl border border-[var(--color-border)] bg-white p-4 flex flex-col gap-3">
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-[var(--color-primary-700)] bg-[var(--color-primary-50)] px-2 py-0.5 rounded-md">
                        Visit #{visitNumber}
                      </span>
                      {isClosed ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                          Completed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                          In Progress
                        </span>
                      )}
                      {v.visitType && (
                        <span className="text-[10px] text-[var(--color-ink-400)] font-medium">{v.visitType}</span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-[var(--color-ink-800)] mt-1.5">
                      {format(new Date(v.date), "dd MMM yyyy")}
                    </p>
                  </div>
                  {v.generalExam ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <EmrViewerButton visitId={v.id} visitNumber={visitNumber} udid={udid} />
                      <VisitDownloadButton visitId={v.id} />
                    </div>
                  ) : (
                    <span className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)] cursor-not-allowed">
                      No EMR
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-[var(--color-ink-600)]">
                  {v.hospital && (
                    <span className="flex items-center gap-1.5 col-span-2 sm:col-span-1">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-[var(--color-ink-400)]"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                      {v.hospital.name}
                    </span>
                  )}
                  {v.doctor && (
                    <span className="flex items-center gap-1.5 col-span-2 sm:col-span-1">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-[var(--color-ink-400)]"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                      Dr. {v.doctor.name}
                    </span>
                  )}
                </div>

                <VisitSummaryTabs
                  visitId={v.id}
                  complaint={v.generalExam?.chiefComplaint ?? null}
                  diagnoses={v.diagnoses.map((d) => d.description)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
