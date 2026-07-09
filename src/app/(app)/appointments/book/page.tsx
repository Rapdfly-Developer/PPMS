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
    include: {
      doctor: { select: { id: true, name: true, specialty: true } },
      hospital: { select: { id: true, name: true } },
    },
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
    // udid mapped below to coerce null → ""
  });

  // Doctor availability — keyed by doctorId, includes hospitalId for slot scoping
  const availabilityRows = await prisma.doctorAvailability.findMany({
    where: {
      doctorId: { in: doctorIds },
      ...(hospitalId ? { hospitalId } : {}),
      status: "ACTIVE",
    },
    orderBy: { weekday: "asc" },
  });
  const availabilityByDoctor: Record<string, { weekday: number; startTime: string; endTime: string; slotMins: number; hospitalId: string }[]> = {};
  for (const row of availabilityRows) {
    (availabilityByDoctor[row.doctorId] ??= []).push({
      weekday: row.weekday,
      startTime: row.startTime,
      endTime: row.endTime,
      slotMins: row.slotMins,
      hospitalId: row.hospitalId,
    });
  }

  // Hospitals per doctor — needed when DOCTOR role books (they choose which hospital)
  const hospitalsByDoctor: Record<string, { id: string; name: string }[]> = {};
  if (!hospitalId) {
    for (const link of links) {
      (hospitalsByDoctor[link.doctor.id] ??= []).push({ id: link.hospital.id, name: link.hospital.name });
    }
  }

  const patientsMapped = patients.map((p) => ({ ...p, udid: p.udid ?? "" }));

  return (
    <BookAppointmentForm
      doctors={doctors}
      patients={patientsMapped}
      hospitalId={hospitalId}
      availabilityByDoctor={availabilityByDoctor}
      hospitalsByDoctor={hospitalsByDoctor}
    />
  );
}
