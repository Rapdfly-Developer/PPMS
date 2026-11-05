import { notFound } from "next/navigation";
import { requirePermission, userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { visitRecordScope } from "@/lib/patient-access";
import {
  admissionTypeText,
  defaultChecklist, defaultConsents, defaultEducation, defaultNurse, defaultTreatment,
  dischargeTemplate, otNotesTemplate,
} from "@/lib/ipd";
import { PatientFile, type FileData } from "./PatientFile";

export const metadata = { title: "Patient File · IPD" };

/** Category shown as the coloured badge, as on the patient Time Stamp. */
const ACTIVITY_KIND: Record<string, "admission" | "form" | "update" | "ot" | "discharge"> = {
  DETAILS_UPDATED: "update",
  TYPE_CHANGED: "update",
  FORM_FROZEN: "form",
  FORM_ADDED: "form",
  PHOTO_ADDED: "form",
  SHIFTED_TO_OT: "ot",
  DISCHARGED: "discharge",
};

const ACTIVITY_TEXT: Record<string, string> = {
  DETAILS_UPDATED: "Ward / floor / file details updated",
  TYPE_CHANGED: "Type of admission changed",
  FORM_FROZEN: "Form frozen",
  FORM_ADDED: "Form added",
  PHOTO_ADDED: "Photo attached",
  SHIFTED_TO_OT: "Shifted to OT",
  DISCHARGED: "Discharged · summary signed with OTP",
};

export default async function IpdFilePage({
  params,
  searchParams,
}: {
  params: Promise<{ admissionId: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { admissionId } = await params;
  const { returnTo } = await searchParams;
  const user = await requirePermission("ipd.view");
  const scope = await visitRecordScope(user);
  if (!scope) notFound();

  const a = await prisma.ipdAdmission.findFirst({
    where: { id: admissionId, visit: { ...scope, finalizedAt: { not: null } } },
    include: {
      forms: true,
      doctorNotes: { orderBy: { createdAt: "desc" } },
      visit: {
        select: {
          id: true, date: true, finalizedAt: true,
          hospital: { select: { name: true } },
          doctor: { select: { name: true } },
          patient: { select: { id: true, name: true, udid: true, uhid: true, age: true, sex: true, photoUrl: true } },
          generalExam: { select: { chiefComplaint: true } },
          diagnoses: { select: { description: true, laterality: true }, orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
  if (!a) notFound();
  const v = a.visit;
  const udid = v.patient.udid ?? v.patient.id;

  // Investigation reports: every order for this patient within the user's scope
  const orders = await prisma.investigationOrder.findMany({
    where: { visit: { patientId: v.patient.id, ...scope } },
    orderBy: { createdAt: "desc" },
    select: { id: true, testName: true, laterality: true, notes: true, resultRef: true, resultAt: true, updatedAt: true, createdAt: true },
  });

  const counselling = a.counsellingVisitId
    ? await prisma.counsellingRecord.findUnique({
        where: { visitId: a.counsellingVisitId },
        select: { paymentType: true, paymentMode: true, schemeName: true, policyNumber: true, eligibleByName: true, confirmedAt: true },
      })
    : null;

  const audit = await prisma.auditLog.findMany({
    where: { entityType: "IpdAdmission", entityId: a.id },
    orderBy: { timestamp: "desc" },
    take: 200,
    select: { action: true, newValue: true, userName: true, timestamp: true },
  });
  const activity = [
    ...audit.map((l) => {
      let detail = "";
      try {
        const nv = l.newValue ? JSON.parse(l.newValue) : null;
        if (l.action === "FORM_FROZEN" || l.action === "FORM_ADDED") detail = nv?.title ?? "";
        if (l.action === "PHOTO_ADDED") detail = nv?.name ?? "";
        if (l.action === "TYPE_CHANGED") detail = `${admissionTypeText(nv?.from ?? "")} → ${admissionTypeText(nv?.to ?? "", nv?.other)}`;
        if (l.action === "DETAILS_UPDATED") {
          detail = [nv?.ward && `Ward ${nv.ward}`, nv?.floor && `Floor ${nv.floor}`, nv?.fileNo && `File ${nv.fileNo}`].filter(Boolean).join(" · ");
        }
      } catch { /* ignore */ }
      return { at: l.timestamp.toISOString(), by: l.userName ?? "", text: ACTIVITY_TEXT[l.action] ?? l.action, detail, kind: ACTIVITY_KIND[l.action] ?? "update" };
    }),
    { at: (v.finalizedAt ?? a.createdAt).toISOString(), by: v.doctor.name, text: "Admitted (EMR finalized & signed)", detail: admissionTypeText(a.admissionType, a.admissionTypeOther), kind: "admission" as const },
    ...(a.returnedFromOtAt ? [{ at: a.returnedFromOtAt.toISOString(), by: "", text: "Back to ward (post-op)", detail: "", kind: "ot" as const }] : []),
  ].sort((x, y) => y.at.localeCompare(x.at));

  const parse = (s: string) => { try { return JSON.parse(s); } catch { return {}; } };
  const defaults: Record<string, unknown> = {
    consents: defaultConsents(),
    checklist: defaultChecklist(),
    education: defaultEducation(a.admissionType),
    treatment: defaultTreatment(),
    nurse: defaultNurse(a.admissionType),
    otNotes: { text: otNotesTemplate(a) },
    discharge: {
      text: dischargeTemplate({
        hospital: v.hospital.name, patientName: v.patient.name, age: v.patient.age, sex: v.patient.sex, patientId: v.patient.uhid ?? udid,
        admittedOn: a.admittedOn, expectedDischarge: a.expectedDischarge, ward: a.ward, fileNo: a.fileNo, doctor: v.doctor.name,
        complaint: v.generalExam?.chiefComplaint ?? null,
        diagnoses: v.diagnoses.map((d) => [d.laterality, d.description].filter(Boolean).join(" ")),
        type: a.admissionType, typeOther: a.admissionTypeOther,
        surgery: a.surgery, laterality: a.laterality, implant: a.implant, anaesthesia: a.anaesthesia, surgeryDate: a.surgeryDate,
      }),
    },
    postOpNotes: { text: "" },
  };

  const data: FileData = {
    id: a.id,
    visitId: v.id,
    udid,
    returnTo: returnTo && returnTo.startsWith("/") ? returnTo : `/patients/${udid}?source=ipd&returnTo=${encodeURIComponent("/ipd")}`,
    patient: { name: v.patient.name, age: v.patient.age, sex: v.patient.sex, id: v.patient.uhid ?? udid, photoUrl: v.patient.photoUrl },
    doctor: v.doctor.name,
    hospital: v.hospital.name,
    complaint: v.generalExam?.chiefComplaint ?? null,
    diagnoses: v.diagnoses,
    type: a.admissionType,
    typeOther: a.admissionTypeOther,
    surgery: a.surgery,
    laterality: a.laterality,
    implant: a.implant,
    anaesthesia: a.anaesthesia,
    surgeryDate: a.surgeryDate?.toISOString() ?? null,
    admittedOn: a.admittedOn.toISOString(),
    expectedDischarge: a.expectedDischarge?.toISOString() ?? null,
    ward: a.ward,
    floor: a.floor,
    fileNo: a.fileNo,
    status: a.status,
    shiftedToOtAt: a.shiftedToOtAt?.toISOString() ?? null,
    returnedFromOtAt: a.returnedFromOtAt?.toISOString() ?? null,
    dischargedAt: a.dischargedAt?.toISOString() ?? null,
    dischargedBy: a.dischargedBy,
    dischargeNotes: a.dischargeNotes,
    payment: counselling
      ? {
          type: counselling.paymentType, mode: counselling.paymentMode, scheme: counselling.schemeName, policy: counselling.policyNumber,
          eligibleBy: counselling.eligibleByName, eligibleAt: counselling.confirmedAt?.toISOString() ?? null,
        }
      : null,
    forms: a.forms.map((f) => ({
      key: f.key,
      title: f.title,
      data: parse(f.data),
      attachments: (() => { const x = parse(f.attachments); return Array.isArray(x) ? x : []; })(),
      frozen: f.frozen,
      frozenAt: f.frozenAt?.toISOString() ?? null,
      frozenBy: f.frozenBy,
    })),
    defaults,
    orders: orders.map((o) => ({
      id: o.id, testName: o.testName, laterality: o.laterality, notes: o.notes, resultRef: o.resultRef,
      resultAt: o.resultRef ? (o.resultAt ?? o.updatedAt).toISOString() : null, createdAt: o.createdAt.toISOString(),
    })),
    doctorNotes: a.doctorNotes.map((n) => ({ id: n.id, text: n.text, by: n.byName, at: n.createdAt.toISOString() })),
    activity,
  };

  return (
    <PatientFile
      data={data}
      can={{
        edit: userCan(user, "ipd.edit"),
        admit: userCan(user, "ipd.admit"),
        shiftOt: userCan(user, "ipd.shiftOt"),
        discharge: userCan(user, "ipd.discharge"),
        doctorNotes: userCan(user, "ipd.admit") || userCan(user, "ipd.discharge"),
        profile: userCan(user, "patients.view"),
      }}
    />
  );
}
