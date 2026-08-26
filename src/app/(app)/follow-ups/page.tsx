import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { startOfDay, isBefore, format } from "date-fns";
import { FollowUpsClient, type FuVisit, type FollowUpStatus } from "./FollowUpsClient";

function computeStatus(
  followUpDate: Date,
  followUpCompleted: boolean,
  followUpCancelledAt: Date | null,
  hasAppointment: boolean,
  hasConsulted: boolean,
  today: Date,
): FollowUpStatus {
  if (followUpCancelledAt) return "CANCELLED";
  // Auto-complete when the patient actually attended a visit on the follow-up date,
  // or when the doctor manually marked it complete.
  if (hasConsulted || followUpCompleted) return "COMPLETED";
  if (hasAppointment) return "SCHEDULED";
  const fuDay = startOfDay(followUpDate);
  const todayDay = startOfDay(today);
  if (fuDay.getTime() === todayDay.getTime()) return "DUE_TODAY";
  if (isBefore(fuDay, todayDay)) return "OVERDUE";
  return "UPCOMING";
}

export default async function FollowUpsPage() {
  const user = await requirePermission("patients.view");
  const today = new Date();

  const whereClause =
    user.role === "DOCTOR"
      ? { doctorId: user.profileId }
      : user.role === "HOSPITAL"
      ? { hospitalId: user.hospitalId }
      : {};

  const rawVisits = await prisma.visit.findMany({
    where: { ...whereClause, followUpDate: { not: null } },
    orderBy: { followUpDate: "asc" },
    select: {
      id: true,
      date: true,
      visitType: true,
      followUpDate: true,
      followUpCompleted: true,
      followUpCancelledAt: true,
      inViewOf: true,
      patient: {
        select: { id: true, name: true, udid: true, uhid: true, age: true, sex: true, photoUrl: true },
      },
      doctor: { select: { id: true, name: true } },
      hospital: { select: { id: true, name: true } },
      diagnoses: {
        where: { confirmedAt: { not: null } },
        select: { description: true, icd10Code: true },
        orderBy: { confirmedAt: "desc" },
        take: 3,
      },
    },
  });

  // Batch-check whether each patient has an appointment booked on their follow-up date,
  // and whether they actually attended a visit on that date (successful consultation).
  // Only for pending (non-completed, non-cancelled) visits to keep the queries tight.
  const pendingVisits = rawVisits.filter(v => !v.followUpCompleted && !v.followUpCancelledAt);
  const apptSet = new Set<string>();    // "patientId_YYYY-MM-DD"
  const consultSet = new Set<string>(); // "patientId_YYYY-MM-DD"

  if (pendingVisits.length > 0) {
    const patientIds = [...new Set(pendingVisits.map(v => v.patient.id))];
    const originIds  = new Set(pendingVisits.map(v => v.id));
    const fuDates    = pendingVisits.map(v => v.followUpDate!);
    const minDate    = new Date(Math.min(...fuDates.map(d => d.getTime())));
    const maxDate    = new Date(Math.max(...fuDates.map(d => d.getTime())));
    minDate.setHours(0, 0, 0, 0);
    maxDate.setHours(23, 59, 59, 999);

    const [appts, consultVisits] = await Promise.all([
      prisma.appointment.findMany({
        where: {
          patientId: { in: patientIds },
          status: { not: "CANCELLED" },
          dateTime: { gte: minDate, lte: maxDate },
        },
        select: { patientId: true, dateTime: true },
      }),
      // A "successful consultation" is any visit for the patient on the follow-up
      // date that is NOT the original visit that set the follow-up date.
      prisma.visit.findMany({
        where: {
          patientId: { in: patientIds },
          id: { notIn: [...originIds] },
          date: { gte: minDate, lte: maxDate },
        },
        select: { patientId: true, date: true },
      }),
    ]);

    for (const a of appts) {
      apptSet.add(`${a.patientId}_${format(a.dateTime, "yyyy-MM-dd")}`);
    }
    for (const c of consultVisits) {
      consultSet.add(`${c.patientId}_${format(c.date, "yyyy-MM-dd")}`);
    }
  }

  const visits: FuVisit[] = rawVisits.map((v) => {
    const fuDateKey    = format(v.followUpDate!, "yyyy-MM-dd");
    const hasAppointment = apptSet.has(`${v.patient.id}_${fuDateKey}`);
    const hasConsulted   = consultSet.has(`${v.patient.id}_${fuDateKey}`);
    return {
      id: v.id,
      date: v.date.toISOString(),
      visitType: v.visitType,
      followUpDate: v.followUpDate!.toISOString(),
      followUpCompleted: v.followUpCompleted,
      followUpCancelledAt: v.followUpCancelledAt?.toISOString() ?? null,
      inViewOf: v.inViewOf,
      patient: { ...v.patient, udid: v.patient.udid ?? v.patient.id },
      doctor: v.doctor,
      hospital: v.hospital,
      diagnoses: v.diagnoses,
      status: computeStatus(v.followUpDate!, v.followUpCompleted, v.followUpCancelledAt, hasAppointment, hasConsulted, today),
    };
  });

  // Unique doctors for filter (hospital role)
  const doctorOptions =
    user.role === "HOSPITAL"
      ? Array.from(
          new Map(visits.map((v) => [v.doctor.id, v.doctor.name])).entries(),
        ).map(([id, name]) => ({ id, name }))
      : [];

  return (
    <FollowUpsClient
      visits={visits}
      role={user.role as "DOCTOR" | "HOSPITAL"}
      doctorOptions={doctorOptions}
    />
  );
}
