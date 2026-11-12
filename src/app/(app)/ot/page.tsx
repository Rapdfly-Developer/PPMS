import { requirePermission, userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { visitRecordScope } from "@/lib/patient-access";
import { requiredKeys } from "@/lib/ipd";
import { otStage } from "@/lib/ot";
import { OtClient, type OtRow } from "./OtClient";

export const metadata = { title: "OT" };

export default async function OtPage() {
  const user = await requirePermission("ot.view");
  const scope = (await visitRecordScope(user)) ?? { id: "__no_scope__" };

  // Files that reached OT, plus pre-op patients still in the ward (Upcoming placeholders)
  const admissions = await prisma.ipdAdmission.findMany({
    where: {
      visit: { ...scope, finalizedAt: { not: null } },
      OR: [{ shiftedToOtAt: { not: null } }, { status: "ADMITTED", admissionType: "PRE_OP" }],
    },
    orderBy: { admittedOn: "desc" },
    include: {
      forms: { select: { key: true } },
      otCase: true,
      visit: {
        select: {
          patient: { select: { id: true, name: true, udid: true, uhid: true, age: true, sex: true, photoUrl: true } },
          doctor: { select: { name: true } },
        },
      },
    },
  });

  const rows: OtRow[] = admissions.map((a) => {
    const c = a.otCase;
    const upcoming = a.status === "ADMITTED" && !a.shiftedToOtAt;
    return {
      id: a.id,
      patient: { ...a.visit.patient, udid: a.visit.patient.udid ?? a.visit.patient.id },
      doctor: a.visit.doctor.name,
      surgery: a.surgery,
      laterality: a.laterality,
      implant: a.implant,
      anaesthesia: a.anaesthesia,
      surgeryDate: a.surgeryDate?.toISOString() ?? null,
      admittedOn: a.admittedOn.toISOString(),
      ward: a.ward,
      fileNo: a.fileNo,
      ipdStatus: a.status,
      upcoming,
      stage: upcoming ? null : otStage(c, requiredKeys(a.admissionType, a.forms.map((f) => f.key))),
      sequence: c?.sequence ?? 0,
      shiftedToOtAt: a.shiftedToOtAt?.toISOString() ?? null,
      begunAt: c?.begunAt?.toISOString() ?? null,
      endedAt: c?.endedAt?.toISOString() ?? null,
      abortedAt: c?.abortedAt?.toISOString() ?? null,
      shiftedToWardAt: c?.shiftedToWardAt?.toISOString() ?? null,
      eventful: !!c?.eventful,
    };
  });

  return <OtClient rows={rows} canArrange={userCan(user, "ot.arrange")} />;
}
