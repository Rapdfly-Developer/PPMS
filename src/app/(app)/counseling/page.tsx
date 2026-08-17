import { requirePermission, userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { CounselingClient } from "./CounselingClient";
import { COUNSELLING_PERMISSIONS as P } from "@/lib/counselling-workflow";
import { getSurgeryScope } from "@/lib/surgery-scope";

export default async function CounselingPage() {
  const user = await requirePermission("appointments.view");

  /* Shared with /scheduled-ot and the case page — see lib/surgery-scope.ts */
  const { counsellingWhere, scheduleWhere } = await getSurgeryScope(user);

  const [records, schedules] = await Promise.all([
    prisma.surgicalCounselling.findMany({
      where: counsellingWhere,
      // Selected rather than included: the board renders ~8 patient fields, but
      // `patient: true` pulls every column of a wide clinical table for every
      // row, and the same again for hospital and doctor. Keep this list in step
      // with the mapping below.
      select: {
        id: true,
        surgeryName: true,
        surgeryType: true,
        surgeryDate: true,
        anaesthesiaType: true,
        rightEye: true,
        leftEye: true,
        conflictFlag: true,
        createdAt: true,
        visitId: true,
        insuranceType: true,
        counselingDone: true,
        investigationDone: true,
        fitForSurgery: true,
        visit: {
          select: {
            patient:  { select: { id: true, name: true, udid: true, uhid: true, age: true, sex: true } },
            hospital: { select: { id: true, name: true } },
            doctor:   { select: { id: true, name: true } },
          },
        },
        // Additive workflow layer — null for records created before this module.
        workflow: {
          select: {
            id: true,
            stage: true,
            decision: true,
            counselledAt: true,
            decidedAt: true,
            confirmedAt: true,
          },
        },
      },
      orderBy: { surgeryDate: "desc" },
    }),
    // Only needed to tell which counselling records already reached the OT list
    prisma.surgerySchedule.findMany({
      where: { ...scheduleWhere, status: { not: "CANCELLED" } },
      select: { surgicalCounsellingId: true },
    }),
  ]);

  const scheduledIds = new Set(
    schedules.map((s) => s.surgicalCounsellingId).filter(Boolean) as string[],
  );

  const items = records.map((r) => ({
    id:                r.id,
    surgeryName:       r.surgeryName ?? null,
    surgeryType:       r.surgeryType,
    surgeryDate:       r.surgeryDate.toISOString(),
    anaesthesiaType:   r.anaesthesiaType,
    rightEye:          r.rightEye,
    leftEye:           r.leftEye,
    conflictFlag:      r.conflictFlag,
    counselledOn:      r.createdAt.toISOString(),
    scheduled:         scheduledIds.has(r.id),
    visitId:           r.visitId,
    insuranceType:     r.insuranceType ?? null,
    counselingDone:    r.counselingDone,
    investigationDone: r.investigationDone,
    fitForSurgery:     r.fitForSurgery ?? null,
    // ── workflow layer (null when the case has not been opened yet) ──
    workflowId:        r.workflow?.id ?? null,
    workflowStage:     r.workflow?.stage ?? null,
    workflowDecision:  r.workflow?.decision ?? null,
    patient: {
      id:   r.visit.patient.id,
      name: r.visit.patient.name,
      udid: r.visit.patient.udid ?? "",
      uhid: (r.visit.patient as any).uhid ?? null,
      age:  r.visit.patient.age,
      sex:  r.visit.patient.sex,
    },
    hospital: { id: r.visit.hospital.id, name: r.visit.hospital.name },
    doctor:   { id: r.visit.doctor.id,   name: r.visit.doctor.name   },
  }));

  const can = {
    view:      userCan(user, P.view),
    counsel:   userCan(user, P.counsel),
    decide:    userCan(user, P.decide),
    schedule:  userCan(user, P.schedule),
    approveOt: userCan(user, P.approveOt),
  };

  return (
    <CounselingClient
      items={items}
      role={user.role as "DOCTOR" | "HOSPITAL"}
      can={can}
      myDoctorId={user.role === "DOCTOR" ? user.profileId : null}
    />
  );
}
