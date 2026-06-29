"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function deletePatient(patientId: string) {
  await requireRole("DOCTOR", "HOSPITAL");
  await prisma.patient.delete({ where: { id: patientId } });
  revalidatePath("/patients");
}
