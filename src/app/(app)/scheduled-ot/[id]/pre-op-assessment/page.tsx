import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { PreOpForm } from "./PreOpForm";

export default async function PreOpPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireRole("DOCTOR");

  const schedule = await prisma.surgerySchedule.findUnique({
    where: { id },
    include: {
      patient:        true,
      hospital:       true,
      preOpAssessment: true,
    },
  });

  if (!schedule) notFound();
  if (schedule.operatingSurgeonId !== user.profileId) redirect("/scheduled-ot");

  const e = schedule.preOpAssessment;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <PreOpForm
        scheduleId={id}
        surgeryName={schedule.surgeryName}
        patientName={schedule.patient.name}
        existing={
          e
            ? {
                hasDiabetes:       e.hasDiabetes,
                hasHypertension:   e.hasHypertension,
                hasCardiacDisease: e.hasCardiacDisease,
                hasAsthma:         e.hasAsthma,
                hasKidneyDisease:  e.hasKidneyDisease,
                otherConditions:   e.otherConditions  ?? "",
                currentMedications: e.currentMedications ?? "",
                allergies:         e.allergies         ?? "",
                nkda:              e.nkda,
                bloodSugarLevel:   e.bloodSugarLevel   ?? "",
                bpReading:         e.bpReading         ?? "",
                ecgNormal:         e.ecgNormal         ?? null,
                investigationNotes: e.investigationNotes ?? "",
                asaGrade:          e.asaGrade          ?? "",
                anesthesiaFitness: e.anesthesiaFitness,
                fitnessNotes:      e.fitnessNotes      ?? "",
                assessedBy:        e.assessedBy        ?? "",
              }
            : null
        }
      />
    </div>
  );
}
