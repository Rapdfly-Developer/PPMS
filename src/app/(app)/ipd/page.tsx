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
          surgicalCounselling: true,
        },
      },
    },
    orderBy: [{ createdAt: "asc" }],
  });

  const todaySurgeries = await prisma.surgicalCounselling.count({
    where: {
      visit: { doctorId },
      surgeryDate: {
        gte: new Date(new Date().setHours(0, 0, 0, 0)),
        lte: new Date(new Date().setHours(23, 59, 59, 999)),
      },
    },
  });

  return <IpdClient admissions={admissions} todaySurgeriesCount={todaySurgeries} />;
}
