import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { istTodayRange, toISTWall } from "@/lib/ist";
import type { SessionUser } from "@/lib/rbac";
import { getLicenseForHospital } from "@/lib/license";
import { DashboardClient } from "./DashboardClient";
import { LicenseBanner } from "./LicenseBanner";

export async function HospitalDashboard({
  user,
  hospitalId,
}: {
  user: SessionUser;
  hospitalId: string;
}) {
  const now       = new Date();
  const { dayStart, dayEnd } = istTodayRange();


  // Run sequentially to avoid exhausting Neon pgbouncer's connection pool
  const hospital = await prisma.hospital.findUnique({
    where: { id: hospitalId },
    select: { name: true },
  });

  const license = await getLicenseForHospital(hospitalId);

  const todayAppts = await prisma.appointment.findMany({
    where: { hospitalId, dateTime: { gte: dayStart, lte: dayEnd } },
    include: {
      patient: { select: { name: true, udid: true, uhid: true, age: true, sex: true, complaint: true } },
      doctor:  { select: { id: true, name: true } },
      visit:   { select: { id: true } },
    },
    orderBy: { dateTime: "asc" },
  });

  const linkedDoctors = await prisma.doctorHospitalLink.findMany({
    where: { hospitalId, active: true },
    select: { doctor: { select: { id: true, name: true } } },
  });

  const upcomingSurgeries = await prisma.surgicalCounselling.findMany({
    where: { surgeryDate: { gte: dayStart }, visit: { hospitalId } },
    select: {
      id: true, surgeryType: true, surgeryDate: true, rightEye: true, leftEye: true,
      visit: { select: { patient: { select: { name: true, udid: true } }, doctor: { select: { name: true } } } },
    },
    orderBy: { surgeryDate: "asc" },
  });

  const activeAdmissions = await prisma.admission.findMany({
    where: { discharged: false, visit: { hospitalId } },
    select: {
      id: true, ward: true, reason: true, createdAt: true,
      visit: {
        select: {
          patient: { select: { name: true, udid: true } },
          doctor:  { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 10,
  });

  // Derive monthly count from already-fetched data to avoid an extra query
  const monthlyAppts = todayAppts.length;

  // Derived KPIs
  const totalToday    = todayAppts.length;
  const pendingOPD    = todayAppts.filter((a) => ["REQUESTED", "CONFIRMED"].includes(a.status)).length;
  const consultedToday = todayAppts.filter((a) => a.status === "DISPENSED").length;
  const surgeryCount  = upcomingSurgeries.length;

  // Serialise for client
  const appts = todayAppts.map((a) => ({
    id:        a.id,
    dateTime:  a.dateTime.toISOString(),
    status:    a.status,
    complaint:  a.patient.complaint ?? null,
    patient:   { name: a.patient.name, udid: a.patient.udid ?? "", uhid: a.patient.uhid ?? "", age: a.patient.age, sex: a.patient.sex },
    doctor:    a.doctor ? { id: a.doctor.id, name: a.doctor.name } : null,
    visitId:   a.visit?.id ?? null,
  }));

  const surgeries = upcomingSurgeries.map((s) => ({
    id:          s.id,
    surgeryType: s.surgeryType,
    surgeryDate: s.surgeryDate.toISOString(),
    rightEye:    s.rightEye,
    leftEye:     s.leftEye,
    patient:     { ...s.visit.patient, udid: s.visit.patient.udid ?? "" },
    doctor:      s.visit.doctor,
  }));

  const doctors = linkedDoctors.map((l) => ({ id: l.doctor.id, name: l.doctor.name }));

  const admissions = activeAdmissions.map((a) => ({
    id:        a.id,
    ward:      a.ward,
    reason:    a.reason,
    createdAt: a.createdAt.toISOString(),
    patient:   a.visit.patient,
    doctor:    a.visit.doctor,
  }));

  return (
    <>
      <LicenseBanner license={license} />
      <DashboardClient
        role="HOSPITAL"
        displayName={hospital?.name ?? "Hospital"}
        todayLabel={format(toISTWall(now), "EEEE, d MMM yyyy")}
        appts={appts}
        surgeries={surgeries}
        filterOptions={doctors}
        newEncounterHref="/appointments/book"
        newEncounterLabel="New Appointment"
      />
    </>
  );
}
