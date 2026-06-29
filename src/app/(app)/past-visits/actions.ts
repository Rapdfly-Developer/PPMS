"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

export async function createPastVisit(data: {
  patientId: string;
  savedName: string;
  originalFileName: string;
  sourceDate: string | null;
  sourceHospital: string | null;
  extractedDiagnosis: string | null;
  extractedTreatment: string | null;
}) {
  await requireRole("DOCTOR", "HOSPITAL");

  await prisma.pastExternalVisit.create({
    data: {
      patientId: data.patientId,
      sourceDate: data.sourceDate ? new Date(data.sourceDate) : null,
      sourceHospital: data.sourceHospital,
      extractedDiagnosis: data.extractedDiagnosis,
      extractedTreatment: data.extractedTreatment,
      scanFileRef: data.savedName,
      verificationStatus: "PENDING_REVIEW",
    },
  });

  revalidatePath("/past-visits");
}

export async function updatePastVisit(
  id: string,
  status: "VERIFIED" | "REJECTED",
  corrected?: Record<string, string>
) {
  await requireRole("DOCTOR");

  await prisma.pastExternalVisit.update({
    where: { id },
    data: {
      verificationStatus: status,
      ...(corrected ?? {}),
    },
  });

  revalidatePath("/past-visits");
}
