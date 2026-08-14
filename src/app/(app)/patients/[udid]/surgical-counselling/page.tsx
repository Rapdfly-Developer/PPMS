import { notFound, redirect } from "next/navigation";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { SurgicalCounsellingForm } from "./SurgicalCounsellingForm";

export default async function SurgicalCounsellingPage({
  params,
}: {
  params: Promise<{ udid: string }>;
}) {
  const { udid } = await params;

  const user = await requirePermission("patients.view");
  if (user.role !== "HOSPITAL") redirect(`/patients/${udid}`);

  const patient = await prisma.patient.findUnique({
    where: { udid },
    select: {
      id: true, name: true, udid: true, uhid: true, age: true, sex: true,
      visits: {
        orderBy: { date: "desc" },
        take: 1,
        select: {
          id: true,
          surgicalCounselling: true,
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

  const latestVisit = patient.visits[0];
  const counselling = latestVisit?.surgicalCounselling;

  if (!counselling) redirect(`/patients/${udid}`);

  const diagnoses = latestVisit?.diagnoses.map((d) => d.description) ?? [];

  return (
    <SurgicalCounsellingForm
      udid={udid}
      patientName={patient.name}
      patientUhid={patient.uhid ?? patient.udid ?? patient.id}
      patientAge={patient.age}
      patientSex={patient.sex}
      counselling={{
        id: counselling.id,
        surgeryName: counselling.surgeryName,
        surgeryType: counselling.surgeryType,
        rightEye: counselling.rightEye,
        leftEye: counselling.leftEye,
        anaesthesiaType: counselling.anaesthesiaType,
        surgeryDate: counselling.surgeryDate.toISOString(),
        conflictFlag: counselling.conflictFlag,
        insuranceType: counselling.insuranceType,
        counselingDone: counselling.counselingDone,
        investigationDone: counselling.investigationDone,
        fitForSurgery: counselling.fitForSurgery,
        advanceAmount: counselling.advanceAmount,
        advanceReceipt: counselling.advanceReceipt,
        counsellingNotes: counselling.counsellingNotes,
        paymentNotes: counselling.paymentNotes,
      }}
      diagnoses={diagnoses}
    />
  );
}
