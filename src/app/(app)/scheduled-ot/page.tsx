import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { ScheduledOtClient } from "./ScheduledOtClient";
import { format } from "date-fns";

export default async function ScheduledOtPage() {
  const user = await requirePermission("appointments.view");

  const whereClause =
    user.role === "DOCTOR"
      ? { visit: { doctorId: user.profileId } }
      : { visit: { hospitalId: user.hospitalId } };

  const records = await prisma.surgicalCounselling.findMany({
    where: whereClause,
    include: {
      visit: {
        include: {
          patient: true,
          hospital: true,
          doctor:   true,
        },
      },
    },
    orderBy: { surgeryDate: "asc" },
  });

  const serialized = records.map((r) => ({
    id:              r.id,
    surgeryName:     r.surgeryName ?? null,
    surgeryType:     r.surgeryType,
    surgeryDate:     r.surgeryDate.toISOString(),
    anaesthesiaType: r.anaesthesiaType,
    rightEye:        r.rightEye,
    leftEye:         r.leftEye,
    conflictFlag:    r.conflictFlag,
    patient: {
      name: r.visit.patient.name,
      udid: r.visit.patient.udid ?? "",
      age:  r.visit.patient.age,
      sex:  r.visit.patient.sex,
    },
    hospital: { name: r.visit.hospital.name },
    doctor:   { name: r.visit.doctor.name },
  }));

  return <ScheduledOtClient records={serialized} role={user.role as "DOCTOR" | "HOSPITAL"} />;
}
