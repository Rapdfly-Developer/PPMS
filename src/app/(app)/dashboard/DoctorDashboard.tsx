import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
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
  // Runs on every dashboard load (including post-login) so it cannot be bypassed.
  if (linkedHospitals.length === 0) {
    redirect("/settings?section=add-hospital");
  }

  const activeAdmissions = await prisma.admission.findMany({
    where: { discharged: false, visit: { doctorId } },
    select: {
      id: true, ward: true, createdAt: true, reason: true,
      visit: {
        select: {
          patient:  { select: { name: true, udid: true, uhid: true } },
          hospital: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 5,
  });

  const todayAvailability = await prisma.doctorAvailability.findMany({
    where: { doctorId, weekday: todayWeekday, status: "ACTIVE" },
    include: { hospital: { select: { id: true, name: true } } },
    orderBy: { startTime: "asc" },
  });

  const weeklyAvailability = await prisma.doctorAvailability.findMany({
    where: { doctorId, status: "ACTIVE" },
    include: { hospital: { select: { id: true, name: true } } },
    orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
  });

  // Derive monthly count from already-fetched data to avoid an extra query
  const monthlyCount = todayAppts.length;

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

  const admissions = activeAdmissions.map((a) => ({
    id:          a.id,
    ward:        a.ward,
    reason:      a.reason,
    createdAt:   a.createdAt.toISOString(),
    patient:     a.visit.patient,
    hospital:    a.visit.hospital,
  }));

  // Today's schedule: each session with live appointment count
  const todaySchedule = todayAvailability.map((a) => {
    const apptCount = todayAppts.filter((ap) => ap.hospital.id === a.hospitalId).length;
    return {
      id:          a.id,
      hospitalId:  a.hospitalId,
      hospitalName: a.hospital.name,
      startTime:   a.startTime,
      endTime:     a.endTime,
      slotMins:    a.slotMins,
      maxPatients: a.maxPatients,
      apptCount,
    };
  });

  // Upcoming schedules: next 7 days (skip today, sort by next occurrence)
  const upcoming: { weekday: number; hospitalName: string; startTime: string; endTime: string; daysAway: number }[] = [];
  for (let d = 1; d <= 7; d++) {
    const wd = (todayWeekday + d) % 7;
    const sessions = weeklyAvailability.filter((a) => a.weekday === wd);
    for (const s of sessions) {
      upcoming.push({ weekday: wd, hospitalName: s.hospital.name, startTime: s.startTime, endTime: s.endTime, daysAway: d });
    }
    if (upcoming.length >= 6) break;
  }

  return (
    <DashboardClient
      role="DOCTOR"
      displayName={doctorProfile?.name ?? user.name}
      todayLabel={format(toISTWall(now), "EEEE, d MMM yyyy")}
      appts={appts}
      surgeries={[]}
      filterOptions={hospitals}
      newEncounterHref="/appointments/new"
      newEncounterLabel="New Encounter"
    />
  );
}
