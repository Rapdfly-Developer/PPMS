import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import DischargeSummaryForm from "./DischargeSummaryForm";

export default async function DischargeSummaryPage({
  params,
}: {
  params: Promise<{ admissionId: string }>;
}) {
  const { admissionId } = await params;
  const user = await requireRole("DOCTOR");

  const admission = await prisma.admission.findUnique({
    where: { id: admissionId },
    include: {
      visit: {
        include: {
          patient: true,
          hospital: true,
          doctor: true,
          medications: { orderBy: { createdAt: "asc" } },
          diagnoses: { orderBy: { createdAt: "asc" } },
        },
      },
      dischargeSummary: true,
    },
  });

  if (!admission) notFound();
  if (admission.visit.doctorId !== user.profileId) redirect("/ipd");

  return (
    <DischargeSummaryForm
      admission={{
        id: admission.id,
        discharged: admission.discharged,
        dischargedAt: admission.dischargedAt?.toISOString() ?? null,
        createdAt: admission.createdAt.toISOString(),
        ward: admission.ward,
        reason: admission.reason,
      }}
      patient={{
        name: admission.visit.patient.name,
        udid: admission.visit.patient.udid ?? "",
        age: admission.visit.patient.age,
        sex: admission.visit.patient.sex,
        mobile: (admission.visit.patient as any).mobile ?? null,
      }}
      visit={{
        date: admission.visit.date.toISOString(),
        doctorName: admission.visit.doctor?.name ?? "",
        hospitalName: admission.visit.hospital.name,
      }}
      otRecord={null}
      medications={admission.visit.medications.map((m: any) => ({
        drugName: m.drugName,
        dosage: m.dosage ?? "",
        frequency: m.frequency ?? "",
        duration: m.duration ?? "",
        instructions: m.instructions ?? "",
      }))}
      diagnoses={admission.visit.diagnoses.map((d: any) => ({
        description: d.description,
        laterality: d.laterality ?? null,
      }))}
      existing={
        admission.dischargeSummary
          ? {
              id: admission.dischargeSummary.id,
              surgeryPerformed: admission.dischargeSummary.surgeryPerformed ?? "",
              operatingEye: admission.dischargeSummary.operatingEye ?? "",
              anesthesiaUsed: admission.dischargeSummary.anesthesiaUsed ?? "",
              iolDetails: admission.dischargeSummary.iolDetails ?? "",
              postOpDiagnosis: admission.dischargeSummary.postOpDiagnosis ?? "",
              intraopComplications: admission.dischargeSummary.intraopComplications ?? "",
              postOpCourse: admission.dischargeSummary.postOpCourse ?? "",
              conditionAtDischarge: admission.dischargeSummary.conditionAtDischarge,
              dischargeMedications: admission.dischargeSummary.dischargeMedications ?? "",
              dischargeInstructions: admission.dischargeSummary.dischargeInstructions ?? "",
              activityRestrictions: admission.dischargeSummary.activityRestrictions ?? "",
              dietAdvice: admission.dischargeSummary.dietAdvice ?? "",
              woundCareInstructions: admission.dischargeSummary.woundCareInstructions ?? "",
              followUpDate: admission.dischargeSummary.followUpDate
                ? admission.dischargeSummary.followUpDate.toISOString().slice(0, 10)
                : "",
              followUpInstructions: admission.dischargeSummary.followUpInstructions ?? "",
            }
          : null
      }
    />
  );
}
