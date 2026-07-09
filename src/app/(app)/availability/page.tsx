import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { AvailabilityClient } from "./AvailabilityClient";

export default async function AvailabilityPage() {
  const user = await requireRole("DOCTOR");

  const doctor = await prisma.doctor.findUnique({
    where: { userId: user.id },
    select: { id: true, name: true },
  });
  if (!doctor) return <p className="p-8 text-sm text-[var(--color-ink-400)]">Doctor profile not found.</p>;

  const links = await prisma.doctorHospitalLink.findMany({
    where: { doctorId: doctor.id, active: true },
    include: { hospital: { select: { id: true, name: true } } },
    orderBy: { hospital: { name: "asc" } },
  });

  const availRows = links.length > 0
    ? await prisma.doctorAvailability.findMany({
        where: { doctorId: doctor.id },
        select: { id: true, hospitalId: true, weekday: true, startTime: true, endTime: true, slotMins: true, maxPatients: true, status: true },
        orderBy: { weekday: "asc" },
      })
    : [];

  // Upcoming appointments count (next 7 days)
  const now = new Date();
  const next7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const upcomingCount = await prisma.appointment.count({
    where: {
      doctorId: doctor.id,
      dateTime: { gte: now, lte: next7 },
      status: { in: ["CONFIRMED", "SCHEDULED", "REQUESTED"] },
    },
  });

  const hospitals = links.map((l) => ({
    ...l.hospital,
    availability: availRows.filter((a) => a.hospitalId === l.hospital.id),
  }));

  return (
    <AvailabilityClient
      hospitals={hospitals}
      doctorName={doctor.name}
      upcomingCount={upcomingCount}
    />
  );
}
