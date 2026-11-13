import { notFound } from "next/navigation";
import { requirePermission, userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { visitRecordScope } from "@/lib/patient-access";
import { counsellingStatus } from "@/lib/counselling";
import { getCounsellingActivity } from "@/lib/counselling-activity";
import { CounsellingDetail, type CounsellingDetailData } from "./CounsellingDetail";
import { defaultConsents, defaultEducation, type FormContext } from "@/lib/ipd-forms";
import { parseCounsellingConsents, parseCounsellingEducation, parseCounsellingImplant } from "@/lib/counselling-sheets";
import { getOwnerDoctorId } from "@/lib/role-permissions";

export const metadata = { title: "Counselling" };

export default async function CounsellingVisitPage({
  params,
}: {
  params: Promise<{ visitId: string }>;
}) {
  const { visitId } = await params;
  const user = await requirePermission("counselling.view");
  const scope = await visitRecordScope(user);
  if (!scope) notFound();

  const visit = await prisma.visit.findFirst({
    where: { id: visitId, ...scope, surgeryAdvised: true, finalizedAt: { not: null }, advisedSurgeryName: { not: null } },
    select: {
      id: true,
      date: true,
      finalizedAt: true,
      patientId: true,
      advisedSurgeryName: true,
      advisedSurgeryEye: true,
      advisedSurgeryAnaesthesia: true,
      advisedSurgeryDate: true,
      advisedSurgeryNotes: true,
      patient: { select: { id: true, name: true, udid: true, uhid: true, age: true, sex: true, mobile: true, photoUrl: true } },
      doctor: { select: { id: true, name: true } },
      hospital: { select: { name: true } },
      generalExam: { select: { chiefComplaint: true } },
      diagnoses: { select: { description: true, laterality: true }, orderBy: { createdAt: "asc" } },
      counsellingRecord: true,
    },
  });
  if (!visit) notFound();

  // Investigation history: every order for this patient within the user's scope.
  const orders = await prisma.investigationOrder.findMany({
    where: { visit: { patientId: visit.patientId, ...scope } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, visitId: true, testName: true, category: true, laterality: true, notes: true,
      resultRef: true, resultAt: true, updatedAt: true, createdAt: true,
    },
  });

  const rec = visit.counsellingRecord;
  const preOp = rec?.preOpAppointmentId
    ? await prisma.appointment.findUnique({ where: { id: rec.preOpAppointmentId }, select: { dateTime: true, status: true } })
    : null;

  const activity = await getCounsellingActivity({
    visitId: visit.id,
    visitDate: visit.date,
    finalizedAt: visit.finalizedAt,
    doctorName: visit.doctor.name,
    surgery: [visit.advisedSurgeryEye, visit.advisedSurgeryName].filter(Boolean).join(" "),
    orders: orders.filter((o) => o.visitId === visit.id).map((o) => ({
      id: o.id, testName: o.testName, createdAt: o.createdAt, resultAt: o.resultRef ? (o.resultAt ?? o.updatedAt) : null,
    })),
    rec,
    preOp,
  });

  // Sheets: saved ones, or the same hospital-standard starts as the IPD forms
  const ctx: FormContext = {
    patientName: visit.patient.name, age: visit.patient.age, sex: visit.patient.sex,
    patientId: visit.patient.uhid ?? visit.patient.udid ?? visit.patient.id,
    hospital: visit.hospital.name, doctor: visit.doctor.name,
    surgery: visit.advisedSurgeryName, eye: visit.advisedSurgeryEye, implant: rec?.implant ?? null,
    anaesthesia: visit.advisedSurgeryAnaesthesia,
    surgeryDate: (rec?.dateOfSurgery ?? visit.advisedSurgeryDate)?.toISOString() ?? null, type: "PRE_OP",
  };
  const ownerId = user.role === "DOCTOR" ? user.profileId : await getOwnerDoctorId(user.id);
  const templates = ownerId
    ? (await prisma.ipdTemplate.findMany({ where: { doctorId: ownerId, kind: "EDUCATION" }, orderBy: { updatedAt: "desc" } })).map((t) => {
        let items: string[] = [];
        try { const x = JSON.parse(t.items); if (Array.isArray(x)) items = x.filter((i): i is string => typeof i === "string"); } catch { /* ignore */ }
        return { id: t.id, kind: t.kind, name: t.name, surgery: t.surgery, items };
      })
    : [];

  const data: CounsellingDetailData = {
    visitId: visit.id,
    visitDate: visit.date.toISOString(),
    surgery: visit.advisedSurgeryName ?? "",
    laterality: visit.advisedSurgeryEye,
    anaesthesia: visit.advisedSurgeryAnaesthesia,
    surgeryNotes: visit.advisedSurgeryNotes,
    doctorName: visit.doctor.name,
    patient: { ...visit.patient, udid: visit.patient.udid ?? visit.patient.id },
    chiefComplaint: visit.generalExam?.chiefComplaint ?? null,
    diagnoses: visit.diagnoses,
    orders: orders.map((o) => ({
      id: o.id,
      current: o.visitId === visit.id,
      testName: o.testName,
      category: o.category,
      laterality: o.laterality,
      notes: o.notes,
      resultRef: o.resultRef,
      resultAt: o.resultRef ? (o.resultAt ?? o.updatedAt).toISOString() : null,
      createdAt: o.createdAt.toISOString(),
    })),
    status: counsellingStatus(rec),
    rec: {
      implant: rec?.implant ?? "",
      dateOfSurgery: (rec?.dateOfSurgery ?? visit.advisedSurgeryDate)?.toISOString() ?? null,
      paymentMode: rec?.paymentMode ?? "",
      paymentType: rec?.paymentType ?? "",
      schemeName: rec?.schemeName ?? "",
      policyNumber: rec?.policyNumber ?? "",
      estimateAmount: rec?.estimateAmount != null ? Number(rec.estimateAmount) : null,
      advancePaid: rec?.advancePaid != null ? Number(rec.advancePaid) : null,
      advanceReceived: rec?.advanceReceived ?? false,
      fitForSurgery: rec?.fitForSurgery ?? false,
      eligibleForSurgery: rec?.eligibleForSurgery ?? false,
      surgeryDeferred: rec?.surgeryDeferred ?? false,
      postponedUntil: rec?.postponedUntil?.toISOString() ?? null,
      postponedIndefinitely: rec?.postponedIndefinitely ?? false,
      postponeReason: rec?.deferralNotes ?? "",
      investigationDetails: rec?.investigationDetails ?? "",
      reportsValidUntil: rec?.reportsValidUntil?.toISOString() ?? null,
      fitByName: rec?.fitByName ?? null,
      eligibleByName: rec?.eligibleByName ?? null,
      enteredAt: rec?.createdAt.toISOString() ?? null,
      fitAt: rec?.doctorReviewedAt?.toISOString() ?? null,
      postponedAt: rec?.postponedAt?.toISOString() ?? null,
      eligibleAt: rec?.confirmedAt?.toISOString() ?? null,
    },
    preOp: preOp ? { dateTime: preOp.dateTime.toISOString(), status: preOp.status } : null,
    activity,
    sheets: {
      me: user.name,
      ctx,
      templates,
      implant: parseCounsellingImplant(rec?.implantDetails),
      consents: parseCounsellingConsents(rec?.consents) ?? defaultConsents(ctx),
      education: parseCounsellingEducation(rec?.education) ?? defaultEducation(ctx),
    },
  };

  return (
    <CounsellingDetail
      data={data}
      canEdit={userCan(user, "counselling.edit")}
      canFit={userCan(user, "counselling.fit")}
      canAddInvestigations={userCan(user, "counselling.addInvestigations")}
      canEligible={userCan(user, "counselling.eligible")}
      canUpload={["counselling.reports", "emr.edit", "emr.labReports.upload", "emr.labReports.edit", "investigations.edit"].some((p) => userCan(user, p))}
      canViewProfile={userCan(user, "patients.view")}
    />
  );
}
