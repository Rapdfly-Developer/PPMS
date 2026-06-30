"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";

export async function getVisitEmrData(visitId: string) {
  await requireUser();
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: {
      hospital:          { select: { name: true } },
      doctor:            { select: { name: true } },
      generalExam:       true,
      visualAcuity:      true,
      refraction:        true,
      colourVisionCS:    true,
      anteriorSegment:   true,
      posteriorSegment:  true,
      iopReadings:       { orderBy: { takenAt: "desc" } },
      diagnoses:         { orderBy: { createdAt: "asc" } },
      medications:       { orderBy: { createdAt: "asc" } },
      investigationOrders: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!visit) return null;
  // Serialize dates
  return JSON.parse(JSON.stringify(visit));
}
