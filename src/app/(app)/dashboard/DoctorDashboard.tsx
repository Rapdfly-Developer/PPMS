import { prisma } from "@/lib/prisma";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { redirect } from "next/navigation";
import type { SessionUser } from "@/lib/rbac";
import { istTodayRange, istParts, toISTWall } from "@/lib/ist";
import { DashboardClient } from "./DashboardClient";

export async function DoctorDashboard({
  user, doctorId,
}: {
  user: SessionUser; doctorId: string; tab?: string;
}) {
  const now        = new Date();
  const { dayStart, dayEnd } = istTodayRange();
  const todayWeekday = istParts(now).weekday;

  const doctorProfile = await prisma.doctor.findUnique({
    where: { id: doctorId },
    select: { name: true },
  });

  // Run sequentially to avoid exhausting Neon pgbouncer's connection pool
  const todayAppts = await prisma.appointment.findMany({
    where: { doctorId, dateTime: { gte: dayStart, lte: dayEnd } },
    include: {
      patient:  { select: { name: true, udid: true, uhid: true, age: true, sex: true, mobile: true, complaint: true } },
      hospital: { select: { id: true, name: true, logoUrl: true } },
      visit:    { select: { id: true, date: true, finalizedAt: true } },
    },
    orderBy: { dateTime: "asc" },
  });

  const linkedHospitals = await prisma.doctorHospitalLink.findMany({
    where: { doctorId, active: true },
    select: { hospital: { select: { id: true, name: true, logoUrl: true } } },
  });

  // Guard: doctor with no linked hospitals must complete setup first.
  if (linkedHospitals.length === 0) {
    redirect("/settings?section=add-hospital");
  }

  // Week / month ranges for analytics
  const weekStart  = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd    = endOfWeek(now,   { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const monthEnd   = endOfMonth(now);

  // Yesterday range for KPI trend %
  const yesterdayStart = new Date(dayStart.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayEnd   = new Date(dayEnd.getTime()   - 24 * 60 * 60 * 1000);

  const [
    weekApptCount, monthApptCount,
    weekCompletedCount, monthCompletedCount,
    weekNoShowCount, monthNoShowCount,
    upcomingFollowUps,
    yTotal, yWaiting, yCompleted, yNoShow, yNewPats,
  ] = await Promise.all([
    prisma.appointment.count({ where: { doctorId, dateTime: { gte: weekStart,  lte: weekEnd  }, status: { notIn: ["CANCELLED","RESCHEDULED"] } } }),
    prisma.appointment.count({ where: { doctorId, dateTime: { gte: monthStart, lte: monthEnd }, status: { notIn: ["CANCELLED","RESCHEDULED"] } } }),
    prisma.appointment.count({ where: { doctorId, dateTime: { gte: weekStart,  lte: weekEnd  }, status: "DISPENSED" } }),
    prisma.appointment.count({ where: { doctorId, dateTime: { gte: monthStart, lte: monthEnd }, status: "DISPENSED" } }),
    prisma.appointment.count({ where: { doctorId, dateTime: { gte: weekStart,  lte: weekEnd  }, status: "NO_SHOW" } }),
    prisma.appointment.count({ where: { doctorId, dateTime: { gte: monthStart, lte: monthEnd }, status: "NO_SHOW" } }),
    prisma.appointment.findMany({
      where: {
        doctorId,
        visitType: "Follow-up",
        dateTime: { gte: dayStart, lte: new Date(dayEnd.getTime() + 7 * 24 * 60 * 60 * 1000) },
        status: { notIn: ["CANCELLED","NO_SHOW","RESCHEDULED"] },
      },
      select: {
        id: true, dateTime: true, visitType: true,
        patient:  { select: { name: true, udid: true, age: true, sex: true } },
        hospital: { select: { id: true, name: true } },
      },
      orderBy: { dateTime: "asc" },
      take: 8,
    }),
    prisma.appointment.count({ where: { doctorId, dateTime: { gte: yesterdayStart, lte: yesterdayEnd }, status: { notIn: ["CANCELLED","RESCHEDULED"] } } }),
    prisma.appointment.count({ where: { doctorId, dateTime: { gte: yesterdayStart, lte: yesterdayEnd }, status: "CONFIRMED" } }),
    prisma.appointment.count({ where: { doctorId, dateTime: { gte: yesterdayStart, lte: yesterdayEnd }, status: "DISPENSED" } }),
    prisma.appointment.count({ where: { doctorId, dateTime: { gte: yesterdayStart, lte: yesterdayEnd }, status: "NO_SHOW" } }),
    prisma.appointment.count({ where: { doctorId, dateTime: { gte: yesterdayStart, lte: yesterdayEnd }, isWalkIn: true } }),
  ]);

  // Serialise
  const appts = todayAppts.map((a) => ({
    id:          a.id,
    dateTime:    a.dateTime.toISOString(),
    createdAt:   a.createdAt.toISOString(),
    arrivedAt:   a.arrivedAt ? a.arrivedAt.toISOString() : null,
    status:      a.status,
    isWalkIn:    a.isWalkIn,
    visitType:   a.visitType ?? null,
    complaint:              a.patient.complaint ?? null,
    partialDispenseReason:  a.partialDispenseReason ?? null,
    partialDispenseAt:      (a as any).partialDispenseAt ? (a as any).partialDispenseAt.toISOString() : null,
    patient:     { name: a.patient.name, udid: a.patient.udid ?? "", uhid: a.patient.uhid ?? "", age: a.patient.age, sex: a.patient.sex, mobile: a.patient.mobile },
    hospital:    { id: a.hospital.id, name: a.hospital.name, logoUrl: (a.hospital as any).logoUrl ?? null },
    visitId:          a.visit?.id ?? null,
    visitStartedAt:   a.visit?.date?.toISOString() ?? null,
    visitFinalizedAt: a.visit?.finalizedAt?.toISOString() ?? null,
  }));

  const hospitals = linkedHospitals.map((l) => ({ id: l.hospital.id, name: l.hospital.name, logoUrl: l.hospital.logoUrl ?? null }));

  const followUps = upcomingFollowUps.map((f) => ({
    id:        f.id,
    dateTime:  f.dateTime.toISOString(),
    visitType: f.visitType ?? "Follow-up",
    patient:   { name: f.patient.name, udid: f.patient.udid ?? "", age: f.patient.age, sex: f.patient.sex },
    hospital:  { id: f.hospital.id, name: f.hospital.name },
  }));

  return (
    <DashboardClient
      scope="DOCTOR"
      permissions={user.permissions ?? []}
      displayName={doctorProfile?.name ?? user.name}
      bannerTitle={`Dr. ${doctorProfile?.name ?? user.name}`}
      todayLabel={format(toISTWall(now), "EEE, d MMM yyyy")}
      appts={appts}
      filterOptions={hospitals}
      newEncounterHref="/appointments/new"
      newEncounterLabel="New Encounter"
      followUps={followUps}
      analytics={{
        today: {
          scheduled: todayAppts.filter(a => !["CANCELLED","NO_SHOW","RESCHEDULED"].includes(a.status)).length,
          completed: todayAppts.filter(a => a.status === "DISPENSED").length,
          noShow:    todayAppts.filter(a => a.status === "NO_SHOW").length,
        },
        week:  { scheduled: weekApptCount,  completed: weekCompletedCount,  noShow: weekNoShowCount  },
        month: { scheduled: monthApptCount, completed: monthCompletedCount, noShow: monthNoShowCount },
      }}
      yesterdayCounts={{ total: yTotal, waiting: yWaiting, completed: yCompleted, noShow: yNoShow, newPats: yNewPats }}
    />
  );
}
