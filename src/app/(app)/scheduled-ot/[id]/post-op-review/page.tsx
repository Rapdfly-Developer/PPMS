import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { PostOpForm } from "./PostOpForm";

export default async function PostOpPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireRole("DOCTOR");

  const schedule = await prisma.surgerySchedule.findUnique({
    where: { id },
    include: {
      patient:     true,
      hospital:    true,
      postOpReview: true,
      otRecord:    true,
    },
  });

  if (!schedule) notFound();
  if (schedule.operatingSurgeonId !== user.profileId) redirect("/scheduled-ot");

  const e = schedule.postOpReview;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <PostOpForm
        scheduleId={id}
        surgeryName={schedule.surgeryName}
        patientName={schedule.patient.name}
        existing={
          e
            ? {
                reVaUnaided:      e.reVaUnaided      ?? "",
                leVaUnaided:      e.leVaUnaided      ?? "",
                reBcva:           e.reBcva           ?? "",
                leBcva:           e.leBcva           ?? "",
                iopRe:            e.iopRe            ?? "",
                iopLe:            e.iopLe            ?? "",
                woundStatus:      e.woundStatus      ?? "",
                iolPosition:      e.iolPosition      ?? "",
                anteriorChamber:  e.anteriorChamber  ?? "",
                fundusNotes:      e.fundusNotes      ?? "",
                complications:    e.complications    ?? "",
                postOpMedications: e.postOpMedications ?? "",
                instructions:     e.instructions     ?? "",
                followUpDate:     e.followUpDate?.toISOString().slice(0, 10) ?? "",
                reviewNotes:      e.reviewNotes      ?? "",
              }
            : null
        }
      />
    </div>
  );
}
