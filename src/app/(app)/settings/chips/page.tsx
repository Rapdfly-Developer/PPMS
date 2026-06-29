import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { ChipOptionsClient } from "./ChipOptionsClient";
import { PAST_MEDICAL_HISTORY_CHIPS } from "@/lib/constants";

export default async function ChipOptionsPage() {
  const user = await requireRole("DOCTOR");

  const doctor = await prisma.doctor.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!doctor) return <p className="p-8 text-sm text-[var(--color-ink-400)]">Doctor profile not found.</p>;

  const links = await prisma.doctorHospitalLink.findMany({
    where: { doctorId: doctor.id, active: true },
    include: {
      hospital: {
        select: {
          id: true,
          name: true,
          chipOptions: {
            where: { category: "PMH", active: true },
            orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
          },
        },
      },
    },
    orderBy: { hospital: { name: "asc" } },
  });

  const hospitals = links.map((l) => l.hospital);

  return (
    <ChipOptionsClient
      hospitals={hospitals}
      defaultChips={[...PAST_MEDICAL_HISTORY_CHIPS]}
    />
  );
}
