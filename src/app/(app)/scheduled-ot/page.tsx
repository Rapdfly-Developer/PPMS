import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { ScheduledOtClient } from "./ScheduledOtClient";

export default async function ScheduledOtPage() {
  const user = await requirePermission("appointments.view");

  /* ── access scoping ── */
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

  /* ── fetch ── */
  const [counsellingRecords, scheduleRecords] = await Promise.all([
    /* SurgicalCounselling — doctor EMR recommendations (for hospital "fill form" CTA) */
    prisma.surgicalCounselling.findMany({
      where: counsellingWhere,
      include: { visit: { include: { patient: true, hospital: true, doctor: true } } },
      orderBy: { surgeryDate: "asc" },
    }),
    /* SurgerySchedule — all non-cancelled workflow records */
    prisma.surgerySchedule.findMany({
      where: { ...scheduleWhere, status: { not: "CANCELLED" } },
      include: { patient: true, hospital: true, surgeon: true },
      orderBy: { plannedDateTime: "asc" },
    }),
  ]);

  /* ── counts (including cancelled) ── */
  const allSchedules = await prisma.surgerySchedule.findMany({
    where: scheduleWhere,
    select: { status: true },
  });

  const counts = {
    waiting:   allSchedules.filter((s) => ["WAITING_DOCTOR_CONFIRMATION", "CHANGES_REQUESTED"].includes(s.status)).length,
    scheduled: allSchedules.filter((s) => s.status === "SURGERY_CONFIRMED").length,
    completed: allSchedules.filter((s) => s.status === "OT_COMPLETED").length,
    cancelled: allSchedules.filter((s) => s.status === "CANCELLED").length,
  };

  /* ── shape unscheduled counselling records (for "needs form" section) ── */
  const scheduledCounsellingIds = new Set(
    scheduleRecords.map((s) => s.surgicalCounsellingId).filter(Boolean)
  );

  const unscheduled = counsellingRecords
    .filter((r) => !scheduledCounsellingIds.has(r.id))
    .map((r) => ({
      id:              r.id,
      surgeryName:     r.surgeryName ?? null,
      surgeryType:     r.surgeryType,
      surgeryDate:     r.surgeryDate.toISOString(),
      anaesthesiaType: r.anaesthesiaType,
      rightEye:        r.rightEye,
      leftEye:         r.leftEye,
      conflictFlag:    r.conflictFlag,
      patient:  { id: r.visit.patient.id, name: r.visit.patient.name, udid: r.visit.patient.udid ?? "", uhid: (r.visit.patient as any).uhid ?? null, age: r.visit.patient.age, sex: r.visit.patient.sex },
      hospital: { name: r.visit.hospital.name, id: r.visit.hospital.id },
      doctor:   { name: r.visit.doctor.name,   id: r.visit.doctor.id   },
    }));

  /* ── shape schedule records by status group ── */
  const shapeSchedule = (r: any) => ({
    id:                r.id,
    surgeryName:       r.surgeryName,
    surgeryCategory:   r.surgeryCategory,
    urgencyType:       r.urgencyType,
    priority:          r.priority,
    plannedDateTime:   r.plannedDateTime.toISOString(),
    otRoom:            r.otRoom ?? null,
    estimatedDuration: r.estimatedDuration ?? null,
    status:            r.status,
    department:        r.department ?? null,
    remarks:           r.remarks ?? null,
    consentReceived:   r.consentReceived,
    reportsUploaded:   r.reportsUploaded,
    otAvailable:       r.otAvailable,
    bloodArranged:     r.bloodArranged,
    patientInformed:   r.patientInformed,
    patient:  { id: r.patient.id, name: r.patient.name, udid: r.patient.udid ?? "", uhid: (r.patient as any).uhid ?? null, age: r.patient.age, sex: r.patient.sex },
    hospital: { name: r.hospital.name, id: r.hospital.id },
    doctor:   { name: r.surgeon.name,  id: r.surgeon.id  },
  });

  const waiting   = scheduleRecords.filter((r) => ["WAITING_DOCTOR_CONFIRMATION", "CHANGES_REQUESTED"].includes(r.status)).map(shapeSchedule);
  const confirmed = scheduleRecords.filter((r) => r.status === "SURGERY_CONFIRMED").map(shapeSchedule);
  const completed = scheduleRecords.filter((r) => r.status === "OT_COMPLETED").map(shapeSchedule);

  return (
    <ScheduledOtClient
      unscheduled={unscheduled}
      waiting={waiting}
      confirmed={confirmed}
      completed={completed}
      counts={counts}
      role={user.role as "DOCTOR" | "HOSPITAL"}
    />
  );
}
