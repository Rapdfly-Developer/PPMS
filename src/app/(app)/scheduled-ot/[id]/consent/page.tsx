import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { ConsentForm } from "./ConsentForm";

export default async function ConsentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireRole("DOCTOR");

  const schedule = await prisma.surgerySchedule.findUnique({
    where: { id },
    include: {
      patient:       true,
      hospital:      true,
      surgeryConsent: true,
    },
  });

  if (!schedule) notFound();
  if (schedule.operatingSurgeonId !== user.profileId) redirect("/scheduled-ot");

  const existing = schedule.surgeryConsent;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <ConsentForm
        scheduleId={id}
        surgeryName={schedule.surgeryName}
        patientName={schedule.patient.name}
        existing={
          existing
            ? {
                patientName:           existing.patientName,
                attendantName:         existing.attendantName ?? "",
                relationship:          existing.relationship ?? "",
                surgeryExplained:      existing.surgeryExplained,
                risksExplained:        existing.risksExplained,
                alternativesExplained: existing.alternativesExplained,
                questionsAnswered:     existing.questionsAnswered,
                consentGiven:          existing.consentGiven,
                notes:                 existing.notes ?? "",
              }
            : null
        }
      />
    </div>
  );
}
