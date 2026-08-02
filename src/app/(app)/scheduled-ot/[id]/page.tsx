import { notFound, redirect } from "next/navigation";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { SurgeryScheduleForm } from "../SurgeryScheduleForm";

export default async function SurgerySchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requirePermission("appointments.view");

  const sc = await prisma.surgicalCounselling.findUnique({
    where: { id },
    include: {
      visit: {
        include: {
          patient:  true,
          hospital: true,
          doctor:   true,
        },
      },
    },
  });

  if (!sc) notFound();

  // Hospital admin: ensure the record belongs to their hospital
  if (user.role !== "DOCTOR" && sc.visit.hospitalId !== user.hospitalId) {
    redirect("/scheduled-ot");
  }

  const record = {
    id:              sc.id,
    surgeryName:     sc.surgeryName ?? null,
    surgeryType:     sc.surgeryType,
    anaesthesiaType: sc.anaesthesiaType,
    patient: {
      id:   sc.visit.patient.id,
      name: sc.visit.patient.name,
      udid: sc.visit.patient.udid ?? "",
      age:  sc.visit.patient.age,
      sex:  sc.visit.patient.sex,
    },
    hospital: { id: sc.visit.hospital.id, name: sc.visit.hospital.name },
    doctor:   { id: sc.visit.doctor.id,   name: sc.visit.doctor.name   },
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <SurgeryScheduleForm record={record} />
    </div>
  );
}
