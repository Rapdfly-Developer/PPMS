import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { visitRecordScope } from "@/lib/patient-access";
import { completion } from "@/lib/ipd";
import { IpdClient, type IpdRow } from "./IpdClient";

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

  return <IpdClient rows={rows} />;
}
