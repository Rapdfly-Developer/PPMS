"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";

export async function dischargePatient(admissionId: string): Promise<{ error?: string }> {
  const user = await requireRole("DOCTOR");

  const admission = await prisma.admission.findUnique({
    where: { id: admissionId },
    include: { visit: { select: { doctorId: true } } },
  });
  if (!admission) return { error: "Admission not found." };
  if (admission.visit.doctorId !== user.profileId) return { error: "Forbidden." };

  if (admission.discharged) return { error: "Patient is already discharged." };

  await prisma.admission.update({
    where: { id: admissionId },
    data: { discharged: true, dischargedAt: new Date() },
  });
  await writeAudit(user.id, "Admission", admissionId, "DISCHARGE");

  revalidatePath("/ipd");
  revalidatePath("/dashboard");
  return {};
}
