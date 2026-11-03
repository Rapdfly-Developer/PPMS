import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { visitRecordScope } from "@/lib/patient-access";
import { counsellingStatus, procedureText } from "@/lib/counselling";
import { CounsellingClient, type CounsellingRow } from "./CounsellingClient";

export const metadata = { title: "Counselling" };

export default async function CounsellingPage() {
  const user = await requirePermission("counselling.view");
  const scope = (await visitRecordScope(user)) ?? { id: "__no_scope__" };

  // A visit enters counselling as soon as a procedure is filled in the EMR
  // Plan tab's Minor Procedure card.
  const visits = await prisma.visit.findMany({
    where: { ...scope, AND: [{ procedureName: { not: null } }, { procedureName: { not: "" } }] },
    orderBy: { date: "desc" },
    select: {
      id: true,
      date: true,
      procedureName: true,
      procedureLaterality: true,
      anesthesiaType: true,
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
    .filter((v) => procedureText(v.procedureName))
    .map((v) => {
      const rec = v.counsellingRecord;
      return {
        visitId: v.id,
        visitDate: v.date.toISOString(),
        surgery: procedureText(v.procedureName),
        laterality: v.procedureLaterality,
        anaesthesia: v.anesthesiaType,
        patient: { ...v.patient, udid: v.patient.udid ?? v.patient.id },
        doctor: v.doctor,
        chiefComplaint: v.generalExam?.chiefComplaint ?? null,
        diagnoses: v.diagnoses,
        invDone: v.investigationOrders.filter((o) => o.resultRef).length,
        invTotal: v.investigationOrders.length,
        status: counsellingStatus(rec),
        tentativeDate: rec?.dateOfSurgery?.toISOString() ?? null,
        implant: rec?.implant ?? null,
        reportsValidUntil: rec?.reportsValidUntil?.toISOString() ?? null,
        postponedUntil: rec?.postponedUntil?.toISOString() ?? null,
        postponedIndefinitely: rec?.postponedIndefinitely ?? false,
        updatedAt: (rec?.updatedAt ?? v.date).toISOString(),
      };
    });

  return <CounsellingClient rows={rows} showDoctor={user.role !== "DOCTOR"} />;
}
