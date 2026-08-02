import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { ScheduledOtClient } from "./ScheduledOtClient";

export default async function ScheduledOtPage() {
  const user = await requirePermission("appointments.view");

  let counsellingWhere: any;
  let scheduleWhere: any;

  if (user.role === "DOCTOR") {
    counsellingWhere = { visit: { doctorId: user.profileId } };
    scheduleWhere    = { operatingSurgeonId: user.profileId };
  } else {
    const linkedDoctors = await prisma.doctorHospitalLink.findMany({
      where: { hospitalId: user.hospitalId, active: true },
      select: { doctorId: true },
    });
    const doctorIds = linkedDoctors.map((l) => l.doctorId);

    counsellingWhere = {
      OR: [
        { visit: { hospitalId: user.hospitalId } },
        ...(doctorIds.length > 0 ? [{ visit: { doctorId: { in: doctorIds } } }] : []),
      ],
    };
    scheduleWhere = { hospitalId: user.hospitalId };
  }

  const [counsellingRecords, scheduleRecords] = await Promise.all([
    prisma.surgicalCounselling.findMany({
      where: counsellingWhere,
      include: { visit: { include: { patient: true, hospital: true, doctor: true } } },
      orderBy: { surgeryDate: "asc" },
    }),
    prisma.surgerySchedule.findMany({
      where: scheduleWhere,
      include: { patient: true, hospital: true, surgeon: true },
      orderBy: { plannedDateTime: "asc" },
    }),
  ]);

  const planned = counsellingRecords.map((r) => ({
    id:              r.id,
    surgeryName:     r.surgeryName ?? null,
    surgeryType:     r.surgeryType,
    surgeryDate:     r.surgeryDate.toISOString(),
    anaesthesiaType: r.anaesthesiaType,
    rightEye:        r.rightEye,
    leftEye:         r.leftEye,
    conflictFlag:    r.conflictFlag,
    patient:  { id: r.visit.patient.id, name: r.visit.patient.name, udid: r.visit.patient.udid ?? "", age: r.visit.patient.age, sex: r.visit.patient.sex },
    hospital: { name: r.visit.hospital.name, id: r.visit.hospital.id },
    doctor:   { name: r.visit.doctor.name,   id: r.visit.doctor.id   },
  }));

  const confirmed = scheduleRecords.map((r) => ({
    id:               r.id,
    surgeryName:      r.surgeryName,
    surgeryCategory:  r.surgeryCategory,
    urgencyType:      r.urgencyType,
    priority:         r.priority,
    plannedDateTime:  r.plannedDateTime.toISOString(),
    otRoom:           r.otRoom ?? null,
    estimatedDuration: r.estimatedDuration ?? null,
    status:           r.status,
    department:       r.department ?? null,
    patient:  { id: r.patient.id, name: r.patient.name, udid: r.patient.udid ?? "", age: r.patient.age, sex: r.patient.sex },
    hospital: { name: r.hospital.name },
    doctor:   { name: r.surgeon.name  },
  }));

  return (
    <ScheduledOtClient
      planned={planned}
      confirmed={confirmed}
      role={user.role as "DOCTOR" | "HOSPITAL"}
    />
  );
}
