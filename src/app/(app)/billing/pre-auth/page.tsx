import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { PreAuthClient } from "./PreAuthClient";

export default async function PreAuthPage() {
  const user = await requirePermission("insurance.view");
  const hospitalId = user.hospitalId ?? user.doctorId ?? "";

  const [preAuths, policies, companies] = await Promise.all([
    prisma.insurancePreAuthorization.findMany({
      where: { hospitalId },
      include: {
        patientInsurance: { include: { patient: { select: { name: true, uhid: true, udid: true } } } },
        insuranceCompany: { select: { name: true } },
        admission: { select: { id: true, reason: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.patientInsurance.findMany({
      where: { hospitalId, status: "ACTIVE" },
      include: {
        patient: { select: { name: true, uhid: true, udid: true } },
        insuranceCompany: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.insuranceCompany.findMany({
      where: { hospitalId, active: true },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <PreAuthClient
      preAuths={preAuths.map((p) => ({
        id: p.id,
        patientName: p.patientInsurance.patient.name,
        patientUhid: p.patientInsurance.patient.uhid ?? p.patientInsurance.patient.udid ?? "",
        insuranceCompanyName: p.insuranceCompany.name,
        patientInsuranceId: p.patientInsuranceId,
        insuranceCompanyId: p.insuranceCompanyId,
        admissionId: p.admissionId,
        admissionReason: p.admission?.reason ?? null,
        diagnosis: p.diagnosis,
        plannedSurgery: p.plannedSurgery,
        estimatedCost: p.estimatedCost,
        requestedAmount: p.requestedAmount,
        approvedAmount: p.approvedAmount,
        authCode: p.authCode,
        status: p.status,
        notes: p.notes,
        submittedAt: p.submittedAt?.toISOString() ?? null,
        respondedAt: p.respondedAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
        hasClaim: false,
      }))}
      policies={policies.map((p) => ({
        id: p.id,
        patientName: p.patient.name,
        patientUhid: p.patient.uhid ?? p.patient.udid ?? "",
        insuranceCompanyId: p.insuranceCompanyId,
        insuranceCompanyName: p.insuranceCompany.name,
        coveragePercent: p.coveragePercent,
      }))}
      companies={companies}
      hospitalId={hospitalId}
    />
  );
}
