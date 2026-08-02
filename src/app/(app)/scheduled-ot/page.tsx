import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { ScheduledOtClient } from "./ScheduledOtClient";

export default async function ScheduledOtPage() {
  const user = await requirePermission("appointments.view");

  let whereClause: any;

  if (user.role === "DOCTOR") {
    whereClause = { visit: { doctorId: user.profileId } };
  } else {
    // Hospital admin: show all surgeries at this hospital.
    // Use OR so we catch visits recorded via direct hospitalId link AND
    // visits whose doctor is linked to this hospital (covers legacy records
    // where visit.hospitalId may not have been set).
    const linkedDoctors = await prisma.doctorHospitalLink.findMany({
      where: { hospitalId: user.hospitalId, active: true },
      select: { doctorId: true },
    });
    const doctorIds = linkedDoctors.map((l) => l.doctorId);

    whereClause = {
      OR: [
        { visit: { hospitalId: user.hospitalId } },
        ...(doctorIds.length > 0 ? [{ visit: { doctorId: { in: doctorIds } } }] : []),
      ],
    };
  }

  const records = await prisma.surgicalCounselling.findMany({
    where: whereClause,
    include: {
      visit: {
        include: {
          patient:  true,
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
      id:   r.visit.patient.id,
      name: r.visit.patient.name,
      udid: r.visit.patient.udid ?? "",
      age:  r.visit.patient.age,
      sex:  r.visit.patient.sex,
    },
    hospital: { name: r.visit.hospital.name, id: r.visit.hospital.id },
    doctor:   { name: r.visit.doctor.name,  id: r.visit.doctor.id  },
  }));

  return <ScheduledOtClient records={serialized} role={user.role as "DOCTOR" | "HOSPITAL"} />;
}
