import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { IpdClient } from "./IpdClient";

export default async function IpdPage() {
  const user = await requireRole("DOCTOR");
  const doctorId = user.profileId;

  const admissions = await prisma.admission.findMany({
    where: { visit: { doctorId } },
    include: {
      visit: {
        include: {
          patient: true,
          hospital: true,
          doctor: true,
        },
      },
    },
    orderBy: [{ createdAt: "asc" }],
  });

  const admissionsMapped = admissions.map((a) => ({
    ...a,
    visit: { ...a.visit, patient: { ...a.visit.patient, udid: a.visit.patient.udid ?? "" } },
  }));
  return <IpdClient admissions={admissionsMapped} />;
}
