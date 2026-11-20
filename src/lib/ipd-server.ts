// Server-only IPD helpers (not "use server": nothing here is a public endpoint).
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface CounsellingSheet {
  visitId: string;
  surgery: string;
  laterality: string | null;
  implant: string | null;
  anaesthesia: string | null;
  /** Latest surgery date: Counselling's date, else the date the doctor signed. */
  date: string | null;
  /** Counselling stage, e.g. "Proceed for surgery". */
  stage: string;
  /** Last day the counselling reports are valid (null when not known). */
  reportsValidUntil?: string | null;
}

const STAGE = (r: { eligibleForSurgery: boolean; fitForSurgery: boolean; surgeryDeferred: boolean } | null) =>
  !r ? "Not started" : r.eligibleForSurgery ? "Proceed for surgery" : r.fitForSurgery ? "Proceed for surgery" : r.surgeryDeferred ? "Date not confirmed" : "Pending";

/**
 * The patient's counselling sheet to import into an admission: the most recent
 * one marked Proceed for surgery, else the most recent one of any stage.
 */
export async function counsellingSheetFor(patientId: string, scope: Prisma.VisitWhereInput): Promise<CounsellingSheet | null> {
  const select = {
    id: true, advisedSurgeryName: true, advisedSurgeryEye: true, advisedSurgeryAnaesthesia: true, advisedSurgeryDate: true, advisedSurgeryImplant: true,
    counsellingRecord: { select: { implant: true, dateOfSurgery: true, eligibleForSurgery: true, fitForSurgery: true, surgeryDeferred: true, reportsValidUntil: true } },
  } as const;
  const base = { ...scope, patientId, finalizedAt: { not: null }, surgeryAdvised: true, advisedSurgeryName: { not: null } };
  const v =
    (await prisma.visit.findFirst({ where: { ...base, counsellingRecord: { eligibleForSurgery: true } }, orderBy: { date: "desc" }, select })) ??
    (await prisma.visit.findFirst({ where: base, orderBy: { date: "desc" }, select }));
  if (!v) return null;
  return {
    visitId: v.id,
    surgery: v.advisedSurgeryName ?? "",
    laterality: v.advisedSurgeryEye,
    implant: v.counsellingRecord?.implant ?? v.advisedSurgeryImplant ?? null,
    anaesthesia: v.advisedSurgeryAnaesthesia,
    date: (v.counsellingRecord?.dateOfSurgery ?? v.advisedSurgeryDate)?.toISOString() ?? null,
    stage: STAGE(v.counsellingRecord),
    reportsValidUntil: v.counsellingRecord?.reportsValidUntil?.toISOString() ?? null,
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
