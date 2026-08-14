import { requirePermission, userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { CounselingClient } from "./CounselingClient";
import { COUNSELLING_PERMISSIONS as P } from "@/lib/counselling-workflow";

export default async function CounselingPage() {
  const user = await requirePermission("appointments.view");

  /* ── access scoping — mirrors /scheduled-ot ── */
  let counsellingWhere: any;
  let scheduleWhere: any;

  if (user.role === "DOCTOR") {
    counsellingWhere = { visit: { doctorId: user.profileId } };
    scheduleWhere    = { operatingSurgeonId: user.profileId };
  } else {
    const linkedDoctors = await prisma.doctorHospitalLink.findMany({
      where: { hospitalId: user.hospitalId, active: true },
      select: { doctorId: true },
    });
    const doctorIds = linkedDoctors.map((l) => l.doctorId);
    counsellingWhere = {
      OR: [
        { visit: { hospitalId: user.hospitalId } },
        ...(doctorIds.length > 0 ? [{ visit: { doctorId: { in: doctorIds } } }] : []),
      ],
    };
    scheduleWhere = { hospitalId: user.hospitalId };
  }

  const [records, schedules] = await Promise.all([
    prisma.surgicalCounselling.findMany({
      where: counsellingWhere,
      include: {
        visit: { include: { patient: true, hospital: true, doctor: true } },
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
    />
  );
}
