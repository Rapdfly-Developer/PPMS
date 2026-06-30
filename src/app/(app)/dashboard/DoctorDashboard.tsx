import { prisma } from "@/lib/prisma";
import { format, startOfDay, endOfDay, startOfMonth } from "date-fns";
import type { SessionUser } from "@/lib/rbac";
import { DoctorDashboardClient } from "./DoctorDashboardClient";

export async function DoctorDashboard({
  user, doctorId,
}: {
  user: SessionUser; doctorId: string; tab?: string;
}) {
  const now        = new Date();
  const dayStart   = startOfDay(now);
  const dayEnd     = endOfDay(now);
  const monthStart = startOfMonth(now);
  const todayWeekday = now.getDay();

  const [todayAppts, upcomingSurgeries, monthlyCount, linkedHospitals, activeAdmissions, todayAvailability, weeklyAvailability] = await Promise.all([
    // Today's appointments across all hospitals
    prisma.appointment.findMany({
      where: { doctorId, dateTime: { gte: dayStart, lte: dayEnd } },
      include: {
        patient:  { select: { name: true, udid: true, age: true, sex: true, mobile: true } },
        hospital: { select: { id: true, name: true } },
        visit:    { select: { id: true } },
      },
      orderBy: { dateTime: "asc" },
    }),

    // Upcoming surgeries (today onwards)
    prisma.surgicalCounselling.findMany({
      where: { surgeryDate: { gte: dayStart }, visit: { doctorId } },
      select: {
        id: true, surgeryType: true, surgeryDate: true, rightEye: true, leftEye: true,
        visit: {
          select: {
            patient:  { select: { name: true, udid: true } },
            hospital: { select: { name: true } },
          },
        },
      },
      orderBy: { surgeryDate: "asc" },
      take: 20,
    }),

    // Monthly appointment count
    prisma.appointment.count({
      where: { doctorId, dateTime: { gte: monthStart, lte: dayEnd } },
    }),

    // Hospitals this doctor is linked to
    prisma.doctorHospitalLink.findMany({
      where: { doctorId, active: true },
      select: { hospital: { select: { id: true, name: true } } },
    }),

    // Active IPD admissions
    prisma.admission.findMany({
      where: { discharged: false, visit: { doctorId } },
      select: {
        id: true, ward: true, createdAt: true, reason: true,
        visit: {
          select: {
            patient:  { select: { name: true, udid: true } },
            hospital: { select: { name: true } },
            surgicalCounselling: { select: { surgeryType: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 5,
    }),

    // Today's scheduled sessions (by weekday)
    prisma.doctorAvailability.findMany({
      where: { doctorId, weekday: todayWeekday, status: "ACTIVE" },
      include: { hospital: { select: { id: true, name: true } } },
      orderBy: { startTime: "asc" },
    }),

    // All active weekly schedules (for Upcoming section)
    prisma.doctorAvailability.findMany({
      where: { doctorId, status: "ACTIVE" },
      include: { hospital: { select: { id: true, name: true } } },
      orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
    }),
  ]);

  // Serialise
  const appts = todayAppts.map((a) => ({
    id:          a.id,
    dateTime:    a.dateTime.toISOString(),
    status:      a.status,
    visitType:   (a as any).visitType ?? "General OPD",
    patient:     { name: a.patient.name, udid: a.patient.udid, age: a.patient.age, sex: a.patient.sex, mobile: a.patient.mobile },
    hospital:    { id: a.hospital.id, name: a.hospital.name },
    visitId:     a.visit?.id ?? null,
  }));

  const surgeries = upcomingSurgeries.map((s) => ({
    id:          s.id,
    surgeryType: s.surgeryType,
    surgeryDate: s.surgeryDate.toISOString(),
    rightEye:    s.rightEye,
    leftEye:     s.leftEye,
    patient:     s.visit.patient,
    hospital:    s.visit.hospital,
  }));

  const hospitals = linkedHospitals.map((l) => ({ id: l.hospital.id, name: l.hospital.name }));

  const admissions = activeAdmissions.map((a) => ({
    id:          a.id,
    ward:        a.ward,
    reason:      a.reason,
    createdAt:   a.createdAt.toISOString(),
    patient:     a.visit.patient,
    hospital:    a.visit.hospital,
    surgeryType: a.visit.surgicalCounselling?.surgeryType ?? null,
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
    <DoctorDashboardClient
      doctorName={user.name}
      appts={appts}
      surgeries={surgeries}
      hospitals={hospitals}
      admissions={admissions}
      monthlyCount={monthlyCount}
      todayLabel={format(now, "EEEE, d MMM yyyy")}
      todaySchedule={todaySchedule}
      upcomingSchedule={upcoming}
    />
  );
}
