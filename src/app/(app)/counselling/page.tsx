import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { visitRecordScope } from "@/lib/patient-access";
import { counsellingStatus } from "@/lib/counselling";
import { CounsellingClient, type CounsellingRow } from "./CounsellingClient";

export const metadata = { title: "Counselling" };

export default async function CounsellingPage() {
  const user = await requirePermission("counselling.view");
  const scope = (await visitRecordScope(user)) ?? { id: "__no_scope__" };

  // A visit enters counselling once Surgical Counselling is saved in the EMR
  // Patient Disposition card and the visit is finalized and signed.
  const visits = await prisma.visit.findMany({
    where: { ...scope, surgeryAdvised: true, finalizedAt: { not: null }, advisedSurgeryName: { not: null } },
    orderBy: { date: "desc" },
    select: {
      id: true,
      date: true,
      advisedSurgeryName: true,
      advisedSurgeryEye: true,
      advisedSurgeryAnaesthesia: true,
      advisedSurgeryDate: true,
      patient: { select: { id: true, name: true, udid: true, uhid: true, age: true, sex: true, photoUrl: true } },
      doctor: { select: { id: true, name: true } },
      generalExam: { select: { chiefComplaint: true } },
      diagnoses: { select: { description: true, laterality: true, status: true }, orderBy: { createdAt: "asc" } },
      investigationOrders: { select: { resultRef: true } },
      counsellingRecord: {
        select: {
          status: true, fitForSurgery: true, eligibleForSurgery: true, surgeryDeferred: true,
          dateOfSurgery: true, implant: true, reportsValidUntil: true, postponedUntil: true, postponedIndefinitely: true,
          createdAt: true, updatedAt: true,
        },
      },
    },
  });

  const rows: CounsellingRow[] = visits
    .map((v) => {
      const rec = v.counsellingRecord;
      return {
        visitId: v.id,
        visitDate: v.date.toISOString(),
        surgery: v.advisedSurgeryName ?? "",
        laterality: v.advisedSurgeryEye,
        anaesthesia: v.advisedSurgeryAnaesthesia,
        patient: { ...v.patient, udid: v.patient.udid ?? v.patient.id },
        doctor: v.doctor,
        chiefComplaint: v.generalExam?.chiefComplaint ?? null,
        diagnoses: v.diagnoses,
        invDone: v.investigationOrders.filter((o) => o.resultRef).length,
        invTotal: v.investigationOrders.length,
        status: counsellingStatus(rec),
        tentativeDate: (rec?.dateOfSurgery ?? v.advisedSurgeryDate)?.toISOString() ?? null,
        implant: rec?.implant ?? null,
        reportsValidUntil: rec?.reportsValidUntil?.toISOString() ?? null,
        postponedUntil: rec?.postponedUntil?.toISOString() ?? null,
        postponedIndefinitely: rec?.postponedIndefinitely ?? false,
        updatedAt: (rec?.updatedAt ?? v.date).toISOString(),
      };
    });

  return <CounsellingClient rows={rows} />;
}
