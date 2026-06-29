import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { BookAppointmentForm } from "./BookAppointmentForm";

export default async function BookAppointmentPage() {
  const user = await requireRole("HOSPITAL", "DOCTOR");

  // Re-fetch hospitalId from DB to guard against stale JWT
  let hospitalId: string | null = null;
  if (user.role === "HOSPITAL") {
    const staff = await prisma.hospitalStaff.findUnique({
      where: { userId: user.id },
      select: { hospitalId: true },
    });
    hospitalId = staff?.hospitalId ?? null;
  }

  const links = await prisma.doctorHospitalLink.findMany({
    where: hospitalId
      ? { hospitalId, active: true }
      : { doctorId: user.profileId!, active: true },
    include: { doctor: { select: { id: true, name: true, specialty: true } } },
  });
  const doctors = links.map((l) => l.doctor);
  const doctorIds = doctors.map((d) => d.id);

  // Existing patients for search
  const patients = await prisma.patient.findMany({
    where: hospitalId
      ? { registeredAtId: hospitalId }
      : { doctorId: user.profileId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, udid: true, age: true, sex: true, mobile: true },
  });

  // Doctor availability — keyed by doctorId
  const availabilityRows = await prisma.doctorAvailability.findMany({
    where: {
      doctorId: { in: doctorIds },
      ...(hospitalId ? { hospitalId } : {}),
    },
    orderBy: { weekday: "asc" },
  });
  const availabilityByDoctor: Record<string, { weekday: number; startTime: string; endTime: string; slotMins: number }[]> = {};
  for (const row of availabilityRows) {
    (availabilityByDoctor[row.doctorId] ??= []).push({
      weekday: row.weekday,
      startTime: row.startTime,
      endTime: row.endTime,
      slotMins: row.slotMins,
    });
  }

  return (
    <BookAppointmentForm
      doctors={doctors}
      patients={patients}
      hospitalId={hospitalId}
      availabilityByDoctor={availabilityByDoctor}
    />
  );
}
