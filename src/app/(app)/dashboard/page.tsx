import { redirect } from "next/navigation";
import { requirePermission, scopeDoctorId } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { istTodayRange, istParts, toISTWall } from "@/lib/ist";
import { HomeDashboardClient } from "@/app/(app)/home/HomeDashboardClient";

export default async function DashboardPage() {
  const user = await requirePermission("dashboard.view");

  if (user.role === "DOCTOR") {
    const doctorId = scopeDoctorId(user);

    const linkedHospitals = await prisma.doctorHospitalLink.findMany({
      where: { doctorId, active: true },
      select: { hospital: { select: { id: true, name: true, logoUrl: true } } },
    });
    if (linkedHospitals.length === 0) redirect("/settings?section=add-hospital");

    const now = new Date();
    const { dayStart, dayEnd } = istTodayRange();

    const doctorProfile = await prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { name: true },
    });

    const todayAppts = await prisma.appointment.findMany({
      where: { doctorId, dateTime: { gte: dayStart, lte: dayEnd } },
      include: {
        patient:  { select: { name: true, udid: true, uhid: true, age: true, sex: true, mobile: true, complaint: true } },
        hospital: { select: { id: true, name: true, logoUrl: true } },
        visit:    { select: { id: true, date: true, finalizedAt: true } },
      },
      orderBy: { dateTime: "asc" },
    });

    const yesterdayStart = new Date(dayStart.getTime() - 86_400_000);
    const yesterdayEnd   = new Date(dayEnd.getTime()   - 86_400_000);
    const yesterdayCount = await prisma.appointment.count({
      where: { doctorId, dateTime: { gte: yesterdayStart, lte: yesterdayEnd } },
    });

    // Determine which of today's patients are truly new to this doctor
    const todayPatientIds = [...new Set(todayAppts.map((a) => a.patientId).filter(Boolean))];
    const priorPatients = todayPatientIds.length > 0
      ? await prisma.appointment.findMany({
          where: {
            doctorId,
            patientId: { in: todayPatientIds },
            dateTime:  { lt: dayStart },
            status:    { in: ["DISPENSED", "PARTIAL_DISPENSE"] },
          },
          select: { patientId: true },
          distinct: ["patientId"],
        })
      : [];
    const returningPatientIds = new Set(priorPatients.map((a) => a.patientId));

    const weekEnd = new Date(dayEnd.getTime() + 7 * 86_400_000);
    const rawFollowUps = await prisma.appointment.findMany({
      where: {
        doctorId,
        dateTime:  { gt: dayEnd, lte: weekEnd },
        visitType: "Follow-up",
        status:    { notIn: ["CANCELLED", "NO_SHOW"] },
      },
      include: {
        patient:  { select: { name: true, udid: true } },
        hospital: { select: { name: true } },
      },
      orderBy: { dateTime: "asc" },
      take: 5,
    });

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
      isNewPatient: !returningPatientIds.has(a.patientId),
      patient:     { name: a.patient.name, udid: a.patient.udid ?? "", uhid: a.patient.uhid ?? "", age: a.patient.age, sex: a.patient.sex, mobile: a.patient.mobile },
      hospital:    { id: a.hospital.id, name: a.hospital.name, logoUrl: (a.hospital as any).logoUrl ?? null },
      visitId:          a.visit?.id ?? null,
      visitStartedAt:   a.visit?.date?.toISOString() ?? null,
      visitFinalizedAt: a.visit?.finalizedAt?.toISOString() ?? null,
    }));

    const hospitals = linkedHospitals.map((l) => ({
      id: l.hospital.id, name: l.hospital.name, logoUrl: l.hospital.logoUrl ?? null,
    }));

    const upcomingFollowUps = rawFollowUps.map((f) => ({
      id: f.id,
      dateTime:    f.dateTime.toISOString(),
      patient:     { name: f.patient.name, udid: f.patient.udid ?? "" },
      hospitalName: f.hospital.name,
    }));

    return (
      <HomeDashboardClient
        scope="DOCTOR"
        permissions={user.permissions ?? []}
        bannerTitle={`Dr. ${doctorProfile?.name ?? user.name}`}
        todayLabel={format(toISTWall(now), "EEEE, d MMM yyyy")}
        appts={appts}
        filterOptions={hospitals}
        newEncounterHref="/appointments/new"
        newEncounterLabel="New Encounter"
        yesterdayCount={yesterdayCount}
        upcomingFollowUps={upcomingFollowUps}
      />
    );
  }

  // Refractionist's home is OPD — the dashboard duplicates the queue.
  if (user.role === "REFRACTIONIST") redirect("/opd");

  // ── Hospital / staff roles ─────────────────────────────────────────────
  const hospitalId = user.hospitalId;
  if (!hospitalId) redirect("/settings?section=add-hospital");

  const now = new Date();
  const { dayStart, dayEnd } = istTodayRange();

  const hospital = await prisma.hospital.findUnique({
    where: { id: hospitalId },
    select: { name: true },
  });

  const linkedDoctors = await prisma.doctorHospitalLink.findMany({
    where: { hospitalId, active: true },
    select: { doctor: { select: { id: true, name: true } } },
  });

  const hTodayAppts = await prisma.appointment.findMany({
    where: { hospitalId, dateTime: { gte: dayStart, lte: dayEnd } },
    include: {
      patient: { select: { name: true, udid: true, uhid: true, age: true, sex: true, mobile: true, complaint: true } },
      doctor:  { select: { id: true, name: true } },
      visit:   { select: { id: true, date: true, finalizedAt: true } },
    },
    orderBy: { dateTime: "asc" },
  });

  const hYesterdayStart = new Date(dayStart.getTime() - 86_400_000);
  const hYesterdayEnd   = new Date(dayEnd.getTime()   - 86_400_000);
  const hYesterdayCount = await prisma.appointment.count({
    where: { hospitalId, dateTime: { gte: hYesterdayStart, lte: hYesterdayEnd } },
  });

  // New patient detection: first-ever visit to this hospital
  const hPatientIds = [...new Set(hTodayAppts.map((a) => a.patientId).filter(Boolean))];
  const hPriorPatients = hPatientIds.length > 0
    ? await prisma.appointment.findMany({
        where: {
          hospitalId,
          patientId: { in: hPatientIds },
          dateTime:  { lt: dayStart },
          status:    { in: ["DISPENSED", "PARTIAL_DISPENSE"] },
        },
        select: { patientId: true },
        distinct: ["patientId"],
      })
    : [];
  const hReturningIds = new Set(hPriorPatients.map((a) => a.patientId));

  const hWeekEnd = new Date(dayEnd.getTime() + 7 * 86_400_000);
  const hRawFollowUps = await prisma.appointment.findMany({
    where: {
      hospitalId,
      dateTime:  { gt: dayEnd, lte: hWeekEnd },
      visitType: "Follow-up",
      status:    { notIn: ["CANCELLED", "NO_SHOW"] },
    },
    include: {
      patient: { select: { name: true, udid: true } },
      doctor:  { select: { name: true } },
    },
    orderBy: { dateTime: "asc" },
    take: 5,
  });

  const hospitalName     = hospital?.name ?? "Hospital";
  const isSharedAccount  = user.role === "HOSPITAL";
  const roleLabel        = user.role.charAt(0) + user.role.slice(1).toLowerCase().replace(/_/g, " ");

  const hAppts = hTodayAppts.map((a) => ({
    id:          a.id,
    dateTime:    a.dateTime.toISOString(),
    createdAt:   a.createdAt.toISOString(),
    arrivedAt:   a.arrivedAt ? a.arrivedAt.toISOString() : null,
    status:      a.status,
    isWalkIn:    a.isWalkIn,
    visitType:   a.visitType ?? null,
    complaint:             a.patient.complaint ?? null,
    partialDispenseReason: a.partialDispenseReason ?? null,
    partialDispenseAt:     (a as any).partialDispenseAt ? (a as any).partialDispenseAt.toISOString() : null,
    isNewPatient: !hReturningIds.has(a.patientId),
    patient: { name: a.patient.name, udid: a.patient.udid ?? "", uhid: a.patient.uhid ?? "", age: a.patient.age, sex: a.patient.sex, mobile: a.patient.mobile },
    doctor:  a.doctor ? { id: a.doctor.id, name: a.doctor.name } : null,
    visitId:          a.visit?.id ?? null,
    visitStartedAt:   a.visit?.date?.toISOString() ?? null,
    visitFinalizedAt: a.visit?.finalizedAt?.toISOString() ?? null,
  }));

  const doctors = linkedDoctors.map((l) => ({ id: l.doctor.id, name: l.doctor.name }));

  const hFollowUps = hRawFollowUps.map((f) => ({
    id:           f.id,
    dateTime:     f.dateTime.toISOString(),
    patient:      { name: f.patient.name, udid: f.patient.udid ?? "" },
    hospitalName: hospitalName,
  }));

  return (
    <HomeDashboardClient
      scope="HOSPITAL"
      permissions={user.permissions ?? []}
      bannerTitle={isSharedAccount ? hospitalName : `Welcome, ${user.name}`}
      bannerSubtitle={isSharedAccount ? undefined : `${roleLabel} · ${hospitalName}`}
      todayLabel={format(toISTWall(now), "EEEE, d MMM yyyy")}
      appts={hAppts}
      filterOptions={doctors}
      newEncounterHref="/appointments/book"
      newEncounterLabel="New Appointment"
      yesterdayCount={hYesterdayCount}
      upcomingFollowUps={hFollowUps}
    />
  );
}
