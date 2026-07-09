import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { NewEncounterForm } from "./NewEncounterForm";

export default async function NewEncounterPage() {
  const user = await requireRole("DOCTOR");

  // Patients under this doctor
  const patients = await prisma.patient.findMany({
    where: { doctorId: user.profileId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, udid: true, age: true, sex: true },
  });

  // Hospitals this doctor is linked to
  const links = await prisma.doctorHospitalLink.findMany({
    where: { doctorId: user.profileId!, active: true },
    include: { hospital: { select: { id: true, name: true } } },
  });
  const hospitals = links.map((l) => l.hospital);

  return <NewEncounterForm patients={patients.map((p) => ({ ...p, udid: p.udid ?? "" }))} hospitals={hospitals} />;
}
