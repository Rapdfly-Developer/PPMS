import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { PastVisitsClient } from "./PastVisitsClient";

export default async function PastVisitsPage() {
  const user = await requireRole("DOCTOR", "HOSPITAL");

  // Fetch patients scoped to this doctor/hospital
  const patients = await prisma.patient.findMany({
    where:
      user.role === "DOCTOR"
        ? { doctorId: user.profileId }
        : { registeredAtId: user.hospitalId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, udid: true },
  });

  // Fetch all past external visits for those patients
  const patientIds = patients.map((p) => p.id);
  const visits = await prisma.pastExternalVisit.findMany({
    where: { patientId: { in: patientIds } },
    include: { patient: { select: { name: true, udid: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <PastVisitsClient
      patients={patients}
      visits={visits}
      canVerify={user.role === "DOCTOR"}
    />
  );
}
