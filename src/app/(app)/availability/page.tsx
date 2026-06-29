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
        select: { id: true, hospitalId: true, weekday: true, startTime: true, endTime: true, slotMins: true },
        orderBy: { weekday: "asc" },
      })
    : [];

  const hospitals = links.map((l) => ({
    ...l.hospital,
    availability: availRows.filter((a) => a.hospitalId === l.hospital.id),
  }));

  return <AvailabilityClient hospitals={hospitals} doctorName={doctor.name} />;
}
