import { prisma } from "@/lib/prisma";
import { format, startOfMonth } from "date-fns";
import type { SessionUser } from "@/lib/rbac";
import { HospitalDashboardClient } from "./HospitalDashboardClient";

export async function HospitalDashboard({
  user,
  hospitalId,
}: {
  user: SessionUser;
  hospitalId: string;
}) {
  const now       = new Date();
  const dayStart  = new Date(now); dayStart.setHours(0, 0, 0, 0);
  const dayEnd    = new Date(now); dayEnd.setHours(23, 59, 59, 999);
  const monthStart = startOfMonth(now);

  const [todayAppts, upcomingSurgeries, monthlyAppts, hospital, linkedDoctors, activeAdmissions] = await Promise.all([
    // Today's appointments with full patient + doctor info
    prisma.appointment.findMany({
      where: { hospitalId, dateTime: { gte: dayStart, lte: dayEnd } },
      include: {
        patient: { select: { name: true, udid: true, age: true, sex: true } },
        doctor:  { select: { id: true, name: true } },
        visit:   { select: { id: true } },
      },
      orderBy: { dateTime: "asc" },
    }),

    // Upcoming surgeries (today onwards)
    prisma.surgicalCounselling.findMany({
      where: { surgeryDate: { gte: dayStart }, visit: { hospitalId } },
      select: {
        id: true, surgeryType: true, surgeryDate: true, rightEye: true, leftEye: true,
        visit: { select: { patient: { select: { name: true, udid: true } }, doctor: { select: { name: true } } } },
      },
      orderBy: { surgeryDate: "asc" },
    }),

    // Monthly appointments for trend number
    prisma.appointment.count({
      where: { hospitalId, dateTime: { gte: monthStart, lte: dayEnd } },
    }),

    // Hospital name
    prisma.hospital.findUnique({ where: { id: hospitalId }, select: { name: true } }),

    // Doctors linked to this hospital (for doctor filter)
    prisma.doctorHospitalLink.findMany({
      where: { hospitalId, active: true },
      select: { doctor: { select: { id: true, name: true } } },
    }),

    // Active IPD admissions
    prisma.admission.findMany({
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
    }),
  ]);

  // Derived KPIs
  const totalToday    = todayAppts.length;
  const pendingOPD    = todayAppts.filter((a) => ["REQUESTED", "CONFIRMED"].includes(a.status)).length;
  const consultedToday = todayAppts.filter((a) => a.status === "COMPLETED").length;
  const surgeryCount  = upcomingSurgeries.length;

  // Serialise for client
  const appts = todayAppts.map((a) => ({
    id:        a.id,
    dateTime:  a.dateTime.toISOString(),
    status:    a.status,
    visitType: (a as any).visitType ?? "General OPD",
    patient:   { name: a.patient.name, udid: a.patient.udid, age: a.patient.age, sex: a.patient.sex },
    doctor:    a.doctor ? { id: a.doctor.id, name: a.doctor.name } : null,
    visitId:   a.visit?.id ?? null,
  }));

  const surgeries = upcomingSurgeries.map((s) => ({
    id:          s.id,
    surgeryType: s.surgeryType,
    surgeryDate: s.surgeryDate.toISOString(),
    rightEye:    s.rightEye,
    leftEye:     s.leftEye,
    patient:     s.visit.patient,
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
    <HospitalDashboardClient
      hospitalName={hospital?.name ?? "Hospital"}
      kpis={{ totalToday, pendingOPD, consultedToday, surgeryCount, monthlyAppts }}
      appointments={appts}
      surgeries={surgeries}
      admissions={admissions}
      doctors={doctors}
      todayLabel={format(now, "EEEE, d MMM yyyy")}
    />
  );
}
