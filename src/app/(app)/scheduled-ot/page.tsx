import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { ScheduledOtClient } from "./ScheduledOtClient";
import { getSurgeryScope } from "@/lib/surgery-scope";

export default async function ScheduledOtPage() {
  const user = await requirePermission("appointments.view");

  const { scheduleWhere } = await getSurgeryScope(user);

  /* ── fetch ── */
  const scheduleRecords = await prisma.surgerySchedule.findMany({
    where: { ...scheduleWhere, status: { not: "CANCELLED" } },
    include: {
      patient:  true,
      hospital: true,
      surgeon:  true,
      preAuth:  { include: { insuranceCompany: true } },
    },
    orderBy: { plannedDateTime: "asc" },
  });

  /* ── counts (including cancelled) ── */
  const allSchedules = await prisma.surgerySchedule.findMany({
    where: scheduleWhere,
    select: { status: true },
  });

  // Legacy statuses (PLANNED/SCHEDULED/RESCHEDULED) count as "waiting" — not yet doctor-confirmed
  const WAITING_STATUSES  = ["WAITING_DOCTOR_CONFIRMATION", "CHANGES_REQUESTED", "PLANNED", "SCHEDULED", "RESCHEDULED"];

  const counts = {
    waiting:   allSchedules.filter((s) => WAITING_STATUSES.includes(s.status)).length,
    scheduled: allSchedules.filter((s) => s.status === "SURGERY_CONFIRMED").length,
    completed: allSchedules.filter((s) => s.status === "OT_COMPLETED").length,
    cancelled: allSchedules.filter((s) => s.status === "CANCELLED").length,
  };

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
    preAuth: r.preAuth ? {
      status:        r.preAuth.status,
      approvedAmount: r.preAuth.approvedAmount ?? null,
      authCode:      r.preAuth.authCode ?? null,
      insuranceName: r.preAuth.insuranceCompany.name,
    } : null,
    patient:  { id: r.patient.id, name: r.patient.name, udid: r.patient.udid ?? "", uhid: (r.patient as any).uhid ?? null, age: r.patient.age, sex: r.patient.sex },
    hospital: { name: r.hospital.name, id: r.hospital.id },
    doctor:   { name: r.surgeon.name,  id: r.surgeon.id  },
  });

  const waiting   = scheduleRecords.filter((r) => WAITING_STATUSES.includes(r.status)).map(shapeSchedule);
  const confirmed = scheduleRecords.filter((r) => r.status === "SURGERY_CONFIRMED").map(shapeSchedule);
  const completed = scheduleRecords.filter((r) => r.status === "OT_COMPLETED").map(shapeSchedule);

  return (
    <ScheduledOtClient
      waiting={waiting}
      confirmed={confirmed}
      completed={completed}
      counts={counts}
      role={user.role as "DOCTOR" | "HOSPITAL"}
    />
  );
}
