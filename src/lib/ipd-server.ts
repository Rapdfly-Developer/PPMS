// Server-only IPD helpers (not "use server": nothing here is a public endpoint).
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface EligibleSurgery {
  visitId: string;
  surgery: string;
  laterality: string | null;
  implant: string | null;
  anaesthesia: string | null;
  /** Latest surgery date: Counselling's date, else the date the doctor signed. */
  date: string | null;
}

/** The patient's most recent counselling marked Eligible for surgery, for a Pre-op admission. */
export async function eligibleSurgeryFor(patientId: string, scope: Prisma.VisitWhereInput): Promise<EligibleSurgery | null> {
  const v = await prisma.visit.findFirst({
    where: { ...scope, patientId, finalizedAt: { not: null }, counsellingRecord: { eligibleForSurgery: true } },
    orderBy: { date: "desc" },
    select: {
      id: true, advisedSurgeryName: true, advisedSurgeryEye: true, advisedSurgeryAnaesthesia: true, advisedSurgeryDate: true,
      counsellingRecord: { select: { implant: true, dateOfSurgery: true } },
    },
  });
  if (!v) return null;
  return {
    visitId: v.id,
    surgery: v.advisedSurgeryName ?? "",
    laterality: v.advisedSurgeryEye,
    implant: v.counsellingRecord?.implant ?? null,
    anaesthesia: v.advisedSurgeryAnaesthesia,
    date: (v.counsellingRecord?.dateOfSurgery ?? v.advisedSurgeryDate)?.toISOString() ?? null,
  };
}

/**
 * Called by the OT module when the operation ends and the file returns to the
 * ward: everything is frozen except the running charts (see formEditable).
 */
export async function returnFileFromOt(admissionId: string) {
  return prisma.ipdAdmission.update({
    where: { id: admissionId },
    data: { status: "POST_OP", returnedFromOtAt: new Date() },
  });
}
