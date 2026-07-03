import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { NewPatientForm } from "./NewPatientForm";

export default async function NewPatientPage() {
  const user = await requirePermission("patients.create");

  // Doctor: all hospitals linked via DoctorHospitalLink (regardless of staff).
  // Hospital: only their own hospital.
  const hospitals =
    user.role === "DOCTOR"
      ? await prisma.hospital.findMany({
          where: { doctorLinks: { some: { doctorId: user.profileId } } },
          orderBy: { name: "asc" },
        })
      : await prisma.hospital.findMany({
          where: { id: user.hospitalId },
          orderBy: { name: "asc" },
        });

  return <NewPatientForm hospitals={hospitals} lockedHospitalId={user.role === "HOSPITAL" ? user.hospitalId : undefined} />;
}
