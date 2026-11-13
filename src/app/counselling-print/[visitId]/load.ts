// Server-only: the counselling visit and its sheets, for the consent and education prints.
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { visitRecordScope } from "@/lib/patient-access";
import { defaultConsents, defaultEducation, type ConsentsData, type EducationData, type FormContext } from "@/lib/ipd-forms";
import { parseCounsellingConsents, parseCounsellingEducation } from "@/lib/counselling-sheets";

export const SEX: Record<string, string> = { MALE: "Male", FEMALE: "Female", OTHER: "Other" };

export async function loadCounsellingPrint(visitId: string) {
  const user = await requirePermission("counselling.view");
  const scope = await visitRecordScope(user);
  if (!scope) notFound();
  const v = await prisma.visit.findFirst({
    where: { id: visitId, ...scope, surgeryAdvised: true, finalizedAt: { not: null }, advisedSurgeryName: { not: null } },
    select: {
      advisedSurgeryName: true, advisedSurgeryEye: true, advisedSurgeryAnaesthesia: true, advisedSurgeryDate: true,
      hospital: { select: { name: true, address: true, contact: true, logoUrl: true, email: true } },
      doctor: { select: { name: true, qualifications: true, specialty: true } },
      patient: { select: { id: true, name: true, udid: true, uhid: true, age: true, sex: true, mobile: true } },
      counsellingRecord: { select: { implant: true, dateOfSurgery: true, consents: true, education: true } },
    },
  });
  if (!v) notFound();
  const rec = v.counsellingRecord;
  const pid = v.patient.uhid ?? v.patient.udid ?? v.patient.id;
  const ctx: FormContext = {
    patientName: v.patient.name, age: v.patient.age, sex: v.patient.sex, patientId: pid, hospital: v.hospital.name, doctor: v.doctor.name,
    surgery: v.advisedSurgeryName, eye: v.advisedSurgeryEye, implant: rec?.implant ?? null, anaesthesia: v.advisedSurgeryAnaesthesia,
    surgeryDate: (rec?.dateOfSurgery ?? v.advisedSurgeryDate)?.toISOString() ?? null, type: "PRE_OP",
  };
  const consents: ConsentsData = parseCounsellingConsents(rec?.consents) ?? defaultConsents(ctx);
  const education: EducationData = parseCounsellingEducation(rec?.education) ?? defaultEducation(ctx);
  return { v, pid, ctx, consents, education };
}
