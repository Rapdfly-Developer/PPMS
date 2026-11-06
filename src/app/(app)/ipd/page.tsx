import { requirePermission, userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { visitRecordScope } from "@/lib/patient-access";
import { completion } from "@/lib/ipd";
import { IpdClient, type IpdRow } from "./IpdClient";
import type { UpcomingRow } from "./UpcomingList";

export const metadata = { title: "IPD" };

export default async function IpdPage() {
  const user = await requirePermission("ipd.view");
  const scope = (await visitRecordScope(user)) ?? { id: "__no_scope__" };

  // A patient enters IPD once the visit with a saved Admit tab is finalized and signed.
  const admissions = await prisma.ipdAdmission.findMany({
    where: { visit: { ...scope, finalizedAt: { not: null } } },
    orderBy: { admittedOn: "desc" },
    include: {
      forms: { select: { key: true, frozen: true } },
      visit: {
        select: {
          finalizedAt: true,
          patient: { select: { id: true, name: true, udid: true, uhid: true, age: true, sex: true, photoUrl: true } },
          doctor: { select: { name: true } },
          diagnoses: { select: { description: true, laterality: true }, orderBy: { createdAt: "asc" } },
        },
      },
    },
  });

  const rows: IpdRow[] = admissions.map((a) => ({
    id: a.id,
    patient: { ...a.visit.patient, udid: a.visit.patient.udid ?? a.visit.patient.id },
    doctor: a.visit.doctor.name,
    diagnoses: a.visit.diagnoses,
    type: a.admissionType,
    typeOther: a.admissionTypeOther,
    reason: a.admissionReason,
    surgery: a.surgery,
    laterality: a.laterality,
    implant: a.implant,
    anaesthesia: a.anaesthesia,
    admittedOn: a.admittedOn.toISOString(),
    surgeryDate: a.surgeryDate?.toISOString() ?? null,
    expectedDischarge: a.expectedDischarge?.toISOString() ?? null,
    dischargedAt: a.dischargedAt?.toISOString() ?? null,
    ward: a.ward,
    floor: a.floor,
    fileNo: a.fileNo,
    status: a.status,
    ...completion(a.admissionType, a.forms),
  }));

  // Upcoming: counselling partially completed (Fit for surgery, not yet Eligible or postponed), not yet admitted
  const partial = await prisma.counsellingRecord.findMany({
    where: { fitForSurgery: true, eligibleForSurgery: false, surgeryDeferred: false, visit: { ...scope, finalizedAt: { not: null } } },
    orderBy: { dateOfSurgery: "asc" },
    include: {
      visit: {
        select: {
          id: true, patientId: true, date: true, advisedSurgeryName: true, advisedSurgeryEye: true, advisedSurgeryAnaesthesia: true, advisedSurgeryDate: true,
          patient: { select: { id: true, name: true, udid: true, uhid: true, age: true, sex: true, photoUrl: true } },
          doctor: { select: { name: true } },
          diagnoses: { select: { description: true, laterality: true }, orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
  const admitted = await prisma.ipdAdmission.findMany({
    where: { patientId: { in: partial.map((r) => r.visit.patientId) } },
    select: { patientId: true, status: true, counsellingVisitId: true },
  });
  const upcoming: UpcomingRow[] = partial
    .filter((r) => !admitted.some((a) => a.counsellingVisitId === r.visitId || (a.patientId === r.visit.patientId && a.status !== "DISCHARGED")))
    .map((r) => ({
      visitId: r.visitId,
      visitDate: r.visit.date.toISOString(),
      patient: { ...r.visit.patient, udid: r.visit.patient.udid ?? r.visit.patient.id },
      doctor: r.visit.doctor.name,
      diagnoses: r.visit.diagnoses,
      surgery: r.visit.advisedSurgeryName,
      laterality: r.visit.advisedSurgeryEye,
      anaesthesia: r.visit.advisedSurgeryAnaesthesia,
      implant: r.implant,
      dateOfSurgery: (r.dateOfSurgery ?? r.visit.advisedSurgeryDate)?.toISOString() ?? null,
      paymentMode: r.paymentMode,
      paymentType: r.paymentType,
      schemeName: r.schemeName,
      policyNumber: r.policyNumber,
      estimateAmount: r.estimateAmount != null ? Number(r.estimateAmount) : null,
      advancePaid: r.advancePaid != null ? Number(r.advancePaid) : null,
      advanceReceived: r.advanceReceived,
      investigationDetails: r.investigationDetails,
      reportsValidUntil: r.reportsValidUntil?.toISOString() ?? null,
      fitByName: r.fitByName,
      fitAt: r.doctorReviewedAt?.toISOString() ?? null,
    }));

  return <IpdClient rows={rows} upcoming={upcoming} canViewCounselling={userCan(user, "counselling.view")} />;
}
