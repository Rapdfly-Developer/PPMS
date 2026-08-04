import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { OtRoomClient } from "./OtRoomClient";

export default async function OtRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireRole("DOCTOR");

  const schedule = await prisma.surgerySchedule.findUnique({
    where: { id },
    include: {
      patient:  true,
      hospital: true,
      surgeon:  true,
      otRecord: { include: { timeline: { orderBy: { performedAt: "asc" } } } },
    },
  });

  if (!schedule) notFound();
  if (schedule.operatingSurgeonId !== user.profileId) redirect("/scheduled-ot");

  const rec = schedule.otRecord;

  return (
    <OtRoomClient
      scheduleId={id}
      surgeryName={schedule.surgeryName}
      surgeryCategory={schedule.surgeryCategory}
      patient={{
        name: schedule.patient.name,
        uhid: (schedule.patient as any).uhid ?? null,
        udid: schedule.patient.udid ?? "",
        age:  schedule.patient.age,
        sex:  schedule.patient.sex,
      }}
      hospital={{ name: schedule.hospital.name }}
      otRoom={schedule.otRoom ?? null}
      plannedDateTime={schedule.plannedDateTime.toISOString()}
      anesthetistName={schedule.anesthetistName ?? null}
      existingRecord={
        rec
          ? {
              id:                          rec.id,
              status:                      rec.status,
              checkInTime:                 rec.checkInTime?.toISOString()    ?? null,
              identityVerified:            rec.identityVerified,
              correctEyeVerified:          rec.correctEyeVerified,
              surgeryTypeVerified:         rec.surgeryTypeVerified,
              consentFormsVerified:        rec.consentFormsVerified,
              implantAvailabilityVerified: rec.implantAvailabilityVerified,
              assistantSurgeon:            rec.assistantSurgeon    ?? "",
              anesthetist:                 rec.anesthetist         ?? "",
              scrubNurse:                  rec.scrubNurse          ?? "",
              circulatingNurse:            rec.circulatingNurse    ?? "",
              anesthesiaTypeRecorded:      rec.anesthesiaTypeRecorded ?? "",
              whoSignIn:                   rec.whoSignIn           ?? "{}",
              surgeryStartTime:            rec.surgeryStartTime?.toISOString() ?? null,
              procedurePerformed:          rec.procedurePerformed  ?? "",
              iolModel:                    rec.iolModel            ?? "",
              iolPower:                    rec.iolPower            ?? "",
              iolBatch:                    rec.iolBatch            ?? "",
              iolSerial:                   rec.iolSerial           ?? "",
              medicinesConsumed:           rec.medicinesConsumed   ?? "",
              intraopFindings:             rec.intraopFindings     ?? "",
              complications:               rec.complications       ?? "",
              intraopRemarks:              rec.intraopRemarks      ?? "",
              surgeryEndTime:              rec.surgeryEndTime?.toISOString()   ?? null,
              operativeNotes:              rec.operativeNotes      ?? "",
              patientConditionOnTransfer:  rec.patientConditionOnTransfer ?? "",
              transferTime:                rec.transferTime?.toISOString()  ?? null,
              timeline: rec.timeline.map((t) => ({
                step:        t.step,
                action:      t.action,
                performedBy: t.performedBy,
                performedAt: t.performedAt.toISOString(),
              })),
            }
          : null
      }
    />
  );
}
