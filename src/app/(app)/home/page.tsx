import { redirect } from "next/navigation";
import { requireUser, scopeDoctorId } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { istTodayRange, istParts, toISTWall } from "@/lib/ist";
import { HomeDashboardClient } from "./HomeDashboardClient";

export default async function HomePage() {
  const user = await requireUser();

  if (user.role === "DOCTOR") {
    const doctorId = scopeDoctorId(user);

    const linkedHospitals = await prisma.doctorHospitalLink.findMany({
      where: { doctorId, active: true },
      select: { hospital: { select: { id: true, name: true, logoUrl: true } } },
    });
    if (linkedHospitals.length === 0) redirect("/settings?section=add-hospital");

    const now = new Date();
    const { dayStart, dayEnd } = istTodayRange();
    const todayWeekday = istParts(now).weekday;

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

  // Hospital scope — redirect to OPD for now
  redirect("/dashboard");
}
