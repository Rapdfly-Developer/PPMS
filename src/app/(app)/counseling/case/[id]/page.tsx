import { notFound, redirect } from "next/navigation";
import { requirePermission, userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { COUNSELLING_PERMISSIONS as P } from "@/lib/counselling-workflow";
import { CaseClient } from "./CaseClient";

/**
 * One case page for the whole counselling workflow. Which panel renders is
 * decided by the case's stage and the viewer's permissions, so the four steps
 * (counseling → clinical decision → confirmation → OT request/approval) share a
 * single shell instead of four near-identical routes.
 *
 * `id` is the SurgicalCounselling id — the same key the legacy screens use — so
 * links from the existing counselling list keep working.
 */
export default async function CounsellingCasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await requirePermission("appointments.view");
  if (!userCan(user, P.view)) redirect("/counseling");

  const sc = await prisma.surgicalCounselling.findUnique({
    where: { id },
    select: {
      id: true,
      surgeryName: true,
      surgeryType: true,
      rightEye: true,
      leftEye: true,
      anaesthesiaType: true,
      surgeryDate: true,
      insuranceType: true,
      counselingDone: true,
      investigationDone: true,
      fitForSurgery: true,
      reviewStatus: true,
      advanceAmount: true,
      visitId: true,
      visit: {
        select: {
          patientId: true,
          doctorId: true,
          hospitalId: true,
          patient:  { select: { name: true, udid: true, uhid: true, age: true, sex: true } },
          doctor:   { select: { id: true, name: true } },
          hospital: { select: { id: true, name: true } },
          diagnoses: {
            where: { confirmedAt: { not: null } },
            select: { description: true },
            orderBy: { confirmedAt: "desc" },
            take: 5,
          },
        },
      },
      workflow: {
        select: {
          id: true,
          stage: true,
          eyeLaterality: true,
          diagnosisText: true,
          procedureExplanation: true,
          benefits: true,
          risks: true,
          recoveryInfo: true,
          patientQuestions: true,
          estimatedCost: true,
          paymentMode: true,
          insuranceApproval: true,
          packageStatus: true,
          requiredInvestigations: true,
          investigationStatus: true,
          consentStatus: true,
          counsellingNotes: true,
          counselledByName: true,
          counselledAt: true,
          decision: true,
          decisionReason: true,
          decisionInvestigations: true,
          decidedByName: true,
          decidedAt: true,
          confirmedSections: true,
          confirmationNotes: true,
          patientReady: true,
          consentConfirmed: true,
          confirmedByName: true,
          confirmedAt: true,
        },
      },
    },
  });

  if (!sc) notFound();

  /* ── Scope check — a user may only open cases in their own reach ────── */
  if (user.role === "DOCTOR") {
    if (sc.visit.doctorId !== user.profileId) redirect("/counseling");
  } else if (user.hospitalId) {
    const sameHospital = sc.visit.hospitalId === user.hospitalId;
    if (!sameHospital) {
      const linked = await prisma.doctorHospitalLink.findFirst({
        where: { hospitalId: user.hospitalId, doctorId: sc.visit.doctorId, active: true },
        select: { id: true },
      });
      if (!linked) redirect("/counseling");
    }
  }

  const workflowId = sc.workflow?.id ?? null;

  const [versions, otRequests] = await Promise.all([
    workflowId
      ? prisma.counsellingVersion.findMany({
          where: { workflowId },
          orderBy: { createdAt: "desc" },
          take: 40,
          select: {
            id: true,
            stage: true,
            changeType: true,
            changedByName: true,
            note: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
    workflowId
      ? prisma.otSlotRequest.findMany({
          where: { workflowId },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            otRoom: true,
            requestedDate: true,
            timeSlot: true,
            surgeryName: true,
            equipment: true,
            staff: true,
            notes: true,
            status: true,
            doctorNote: true,
            suggestedDateTime: true,
            requestedByName: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const can = {
    view:      true,
    counsel:   userCan(user, P.counsel),
    decide:    userCan(user, P.decide),
    schedule:  userCan(user, P.schedule),
    approveOt: userCan(user, P.approveOt),
  };

  const wf = sc.workflow;

  return (
    <CaseClient
      surgicalCounsellingId={sc.id}
      udid={sc.visit.patient.udid ?? ""}
      can={can}
      patient={{
        name: sc.visit.patient.name,
        udid: sc.visit.patient.udid ?? "",
        uhid: sc.visit.patient.uhid ?? null,
        age:  sc.visit.patient.age,
        sex:  sc.visit.patient.sex,
      }}
      doctor={{ id: sc.visit.doctor.id, name: sc.visit.doctor.name }}
      hospital={{ id: sc.visit.hospital.id, name: sc.visit.hospital.name }}
      surgery={{
        surgeryName:     sc.surgeryName,
        surgeryType:     sc.surgeryType,
        rightEye:        sc.rightEye,
        leftEye:         sc.leftEye,
        anaesthesiaType: sc.anaesthesiaType,
        surgeryDate:     sc.surgeryDate.toISOString(),
        insuranceType:   sc.insuranceType,
        advanceAmount:   sc.advanceAmount,
      }}
      diagnoses={sc.visit.diagnoses.map((d) => d.description)}
      workflow={
        wf
          ? {
              id:                     wf.id,
              stage:                  wf.stage,
              eyeLaterality:          wf.eyeLaterality,
              diagnosisText:          wf.diagnosisText,
              procedureExplanation:   wf.procedureExplanation,
              benefits:               wf.benefits,
              risks:                  wf.risks,
              recoveryInfo:           wf.recoveryInfo,
              patientQuestions:       wf.patientQuestions,
              estimatedCost:          wf.estimatedCost,
              paymentMode:            wf.paymentMode,
              insuranceApproval:      wf.insuranceApproval,
              packageStatus:          wf.packageStatus,
              requiredInvestigations: wf.requiredInvestigations,
              investigationStatus:    wf.investigationStatus,
              consentStatus:          wf.consentStatus,
              counsellingNotes:       wf.counsellingNotes,
              counselledByName:       wf.counselledByName,
              counselledAt:           wf.counselledAt?.toISOString() ?? null,
              decision:               wf.decision,
              decisionReason:         wf.decisionReason,
              decisionInvestigations: wf.decisionInvestigations,
              decidedByName:          wf.decidedByName,
              decidedAt:              wf.decidedAt?.toISOString() ?? null,
              confirmedSections:      wf.confirmedSections,
              confirmationNotes:      wf.confirmationNotes,
              patientReady:           wf.patientReady,
              consentConfirmed:       wf.consentConfirmed,
              confirmedByName:        wf.confirmedByName,
              confirmedAt:            wf.confirmedAt?.toISOString() ?? null,
            }
          : null
      }
      versions={versions.map((v) => ({
        id:            v.id,
        stage:         v.stage,
        changeType:    v.changeType,
        changedByName: v.changedByName,
        note:          v.note,
        createdAt:     v.createdAt.toISOString(),
      }))}
      otRequests={otRequests.map((r) => ({
        id:                r.id,
        otRoom:            r.otRoom,
        requestedDate:     r.requestedDate.toISOString(),
        timeSlot:          r.timeSlot,
        surgeryName:       r.surgeryName,
        equipment:         r.equipment,
        staff:             r.staff,
        notes:             r.notes,
        status:            r.status,
        doctorNote:        r.doctorNote,
        suggestedDateTime: r.suggestedDateTime?.toISOString() ?? null,
        requestedByName:   r.requestedByName,
        createdAt:         r.createdAt.toISOString(),
      }))}
    />
  );
}
