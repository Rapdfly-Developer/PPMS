import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { istTodayRange, toISTWall } from "@/lib/ist";
import { userCan, type SessionUser } from "@/lib/rbac";
import { getLicenseForHospital } from "@/lib/license";
import { DashboardClient } from "./DashboardClient";
import { LicenseBanner } from "./LicenseBanner";

export async function HospitalDashboard({
  user,
  hospitalId,
  returnTo,
}: {
  user: SessionUser;
  hospitalId: string;
  returnTo?: string;
}) {
  const now       = new Date();
  const { dayStart, dayEnd } = istTodayRange();


  // Run sequentially to avoid exhausting Neon pgbouncer's connection pool
  const hospital = await prisma.hospital.findUnique({
    where: { id: hospitalId },
    select: { name: true, logoUrl: true },
  });

  const license = await getLicenseForHospital(hospitalId);

  const todayAppts = await prisma.appointment.findMany({
    where: {
      hospitalId,
      dateTime: { gte: dayStart, lte: dayEnd },
      // Only fetch appointments that are shown on the dashboard queue.
      // REQUESTED/CANCELLED/NO_SHOW/RESCHEDULED are never rendered here.
      // CONFIRMED without arrivedAt (pre-confirmed, not yet in queue) is also excluded.
      status: { notIn: ["REQUESTED", "CANCELLED", "NO_SHOW", "RESCHEDULED"] },
      OR: [
        { isWalkIn: true },
        { arrivedAt: { not: null } },
        { status: { in: ["DISPENSED", "PARTIAL_DISPENSE"] } },
      ],
    },
    include: {
      patient: { select: { name: true, udid: true, uhid: true, age: true, sex: true, mobile: true, complaint: true } },
      doctor:  { select: { id: true, name: true } },
      visit:   { select: { id: true, date: true, finalizedAt: true, refractionDone: true } },
    },
    orderBy: { dateTime: "asc" },
  });

  const linkedDoctors = await prisma.doctorHospitalLink.findMany({
    where: { hospitalId, active: true },
    select: { doctor: { select: { id: true, name: true } } },
  });

  
  // Derive monthly count from already-fetched data to avoid an extra query
  const monthlyAppts = todayAppts.length;

  // Derived KPIs
  const totalToday    = todayAppts.length;
  const pendingOPD    = todayAppts.filter((a) => ["REQUESTED", "CONFIRMED"].includes(a.status)).length;
  const consultedToday = todayAppts.filter((a) => a.status === "DISPENSED").length;

  // Serialise for client
  const appts = todayAppts.map((a) => ({
    id:        a.id,
    dateTime:  a.dateTime.toISOString(),
    createdAt: a.createdAt.toISOString(),
    arrivedAt: a.arrivedAt ? a.arrivedAt.toISOString() : null,
    status:    a.status,
    isWalkIn:  a.isWalkIn,
    visitType: a.visitType ?? null,
    complaint:             a.patient.complaint ?? null,
    partialDispenseReason: a.partialDispenseReason ?? null,
    partialDispenseAt:     (a as any).partialDispenseAt ? (a as any).partialDispenseAt.toISOString() : null,
    patient:   { name: a.patient.name, udid: a.patient.udid ?? "", uhid: a.patient.uhid ?? "", age: a.patient.age, sex: a.patient.sex, mobile: a.patient.mobile ?? undefined },
    doctor:    a.doctor ? { id: a.doctor.id, name: a.doctor.name } : null,
    visitId:          a.visit?.id ?? null,
    visitStartedAt:   a.visit?.date?.toISOString() ?? null,
    visitFinalizedAt: a.visit?.finalizedAt?.toISOString() ?? null,
    refractionDone:   a.visit?.refractionDone ?? false,
  }));

  const doctors = linkedDoctors.map((l) => ({ id: l.doctor.id, name: l.doctor.name }));

  
  const hospitalName = hospital?.name ?? "Hospital";

  // The shared front-desk login (role HOSPITAL) is the hospital, so its banner
  // stays the hospital's name — unchanged. A named staff member (receptionist,
  // refractionist, any custom role) is a person, so they get their own name
  // with the hospital moved to the subtitle.
  const isSharedHospitalAccount = user.role === "HOSPITAL";
  const roleLabel = user.role.charAt(0) + user.role.slice(1).toLowerCase().replace(/_/g, " ");

  return (
    <>
      {userCan(user, "dashboard.view") && <LicenseBanner license={license} role="HOSPITAL" />}
      <DashboardClient
        scope="HOSPITAL"
        permissions={user.permissions ?? []}
        displayName={hospitalName}
        bannerTitle={isSharedHospitalAccount ? hospitalName : `Welcome, ${user.name}`}
        bannerSubtitle={isSharedHospitalAccount ? undefined : `${roleLabel} · ${hospitalName}`}
        todayLabel={format(toISTWall(now), "EEEE, d MMM yyyy")}
        appts={appts}
        filterOptions={doctors}
        hospitalLogoUrl={hospital?.logoUrl ?? null}
        newEncounterHref="/appointments/book"
        newEncounterLabel="New Appointment"
        returnTo={returnTo}
      />
    </>
  );
}
