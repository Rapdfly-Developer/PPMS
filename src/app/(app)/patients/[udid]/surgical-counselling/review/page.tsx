import { notFound, redirect } from "next/navigation";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { DoctorReviewClient } from "./DoctorReviewClient";

export default async function SurgicalCounsellingReviewPage({
  params,
}: {
  params: { udid: string };
}) {
  const user = await requirePermission("patients.view");
  if (user.role !== "DOCTOR") redirect(`/patients/${params.udid}`);

  const patient = await prisma.patient.findUnique({
    where: { udid: params.udid },
    select: {
      id: true, name: true, udid: true, uhid: true, age: true, sex: true,
      visits: {
        orderBy: { date: "desc" },
        where: { surgicalCounselling: { isNot: null } },
        take: 1,
        select: {
          id: true,
          surgicalCounselling: {
            select: {
              id: true,
              surgeryName: true,
              surgeryType: true,
              rightEye: true,
              leftEye: true,
              anaesthesiaType: true,
              surgeryDate: true,
              conflictFlag: true,
              insuranceType: true,
              paymentNotes: true,
              counselingDone: true,
              investigationDone: true,
              fitForSurgery: true,
              advanceAmount: true,
              advanceReceipt: true,
              counsellingNotes: true,
              reviewStatus: true,
              doctorReviewNote: true,
              doctorReviewedAt: true,
              confirmedFitAt: true,
            },
          },
          diagnoses: {
            where: { confirmedAt: { not: null } },
            select: { description: true },
            take: 3,
            orderBy: { confirmedAt: "desc" },
          },
        },
      },
    },
  });

  if (!patient) notFound();

  const visit = patient.visits[0];
  const sc = visit?.surgicalCounselling;
  if (!sc) redirect(`/patients/${params.udid}`);

  // Load the associated schedule for OT details
  const schedule = await prisma.surgerySchedule.findFirst({
    where: { surgicalCounsellingId: sc.id },
    select: {
      id: true,
      surgeryCategory: true,
      urgencyType: true,
      priority: true,
      otRoom: true,
      estimatedDuration: true,
      anesthetistName: true,
      procedure: true,
      diagnosis: true,
      consentReceived: true,
      reportsUploaded: true,
      bloodArranged: true,
      patientInformed: true,
      plannedDateTime: true,
    },
  });

  const diagnoses = visit.diagnoses.map((d) => d.description);

  return (
    <DoctorReviewClient
      udid={params.udid}
      patient={{
        name: patient.name,
        udid: patient.udid ?? patient.id,
        uhid: patient.uhid ?? patient.udid ?? patient.id,
        age: patient.age,
        sex: patient.sex,
      }}
      counselling={{
        id: sc.id,
        surgeryName: sc.surgeryName,
        surgeryType: sc.surgeryType,
        rightEye: sc.rightEye,
        leftEye: sc.leftEye,
        anaesthesiaType: sc.anaesthesiaType,
        surgeryDate: sc.surgeryDate.toISOString(),
        conflictFlag: sc.conflictFlag,
        paymentMode: sc.insuranceType,
        paymentNotes: sc.paymentNotes,
        counselingDone: sc.counselingDone,
        investigationDone: sc.investigationDone,
        advanceAmount: sc.advanceAmount,
        advanceReceipt: sc.advanceReceipt,
        counsellingNotes: sc.counsellingNotes,
        reviewStatus: sc.reviewStatus,
        doctorReviewNote: sc.doctorReviewNote,
        confirmedFitAt: sc.confirmedFitAt?.toISOString() ?? null,
      }}
      schedule={
        schedule
          ? {
              surgeryCategory: schedule.surgeryCategory,
              urgencyType: schedule.urgencyType,
              priority: schedule.priority,
              otRoom: schedule.otRoom,
              estimatedDuration: schedule.estimatedDuration,
              anesthetistName: schedule.anesthetistName,
              procedure: schedule.procedure,
              diagnosis: schedule.diagnosis,
              consentReceived: schedule.consentReceived,
              reportsUploaded: schedule.reportsUploaded,
              bloodArranged: schedule.bloodArranged,
              plannedTime: schedule.plannedDateTime
                ? schedule.plannedDateTime.toTimeString().slice(0, 5)
                : "09:00",
            }
          : null
      }
      diagnoses={diagnoses}
    />
  );
}
