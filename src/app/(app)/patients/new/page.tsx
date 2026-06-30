import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { NewPatientForm } from "./NewPatientForm";

export default async function NewPatientPage() {
  const user = await requirePermission("patients.create");

  // Doctor: show all hospitals that have a staff account (i.e. visible in User Management).
  // Hospital: only their own hospital.
  const hospitals =
    user.role === "DOCTOR"
      ? await prisma.hospital.findMany({
          where: { staff: { some: {} } },
          orderBy: { name: "asc" },
        })
      : await prisma.hospital.findMany({
          where: { id: user.hospitalId },
          orderBy: { name: "asc" },
        });

  return <NewPatientForm hospitals={hospitals} lockedHospitalId={user.role === "HOSPITAL" ? user.hospitalId : undefined} />;
}
