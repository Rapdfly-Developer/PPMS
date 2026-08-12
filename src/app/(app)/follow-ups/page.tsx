import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { startOfDay, isToday, isBefore } from "date-fns";
import { FollowUpsClient, type FuVisit, type FollowUpStatus } from "./FollowUpsClient";

function computeStatus(
  followUpDate: Date,
  followUpCompleted: boolean,
  followUpCancelledAt: Date | null,
  today: Date,
): FollowUpStatus {
  if (followUpCancelledAt) return "CANCELLED";
  if (followUpCompleted) return "COMPLETED";
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
        select: { id: true, name: true, udid: true, uhid: true, age: true, sex: true },
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

  const visits: FuVisit[] = rawVisits.map((v) => ({
    id: v.id,
    date: v.date.toISOString(),
    visitType: v.visitType,
    followUpDate: v.followUpDate!.toISOString(),
    followUpCompleted: v.followUpCompleted,
    followUpCancelledAt: v.followUpCancelledAt?.toISOString() ?? null,
    inViewOf: v.inViewOf,
    patient: v.patient,
    doctor: v.doctor,
    hospital: v.hospital,
    diagnoses: v.diagnoses,
    status: computeStatus(v.followUpDate!, v.followUpCompleted, v.followUpCancelledAt, today),
  }));

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
