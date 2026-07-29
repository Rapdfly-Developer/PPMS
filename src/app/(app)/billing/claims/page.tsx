import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { ClaimsClient } from "./ClaimsClient";

export default async function ClaimsPage() {
  const user = await requirePermission("insurance.view");
  const hospitalId = user.hospitalId ?? user.doctorId ?? "";

  const [claims, policies] = await Promise.all([
    prisma.insuranceClaim.findMany({
      where: { hospitalId },
      include: {
        patientInsurance: { include: { patient: { select: { name: true, uhid: true, udid: true } } } },
        insuranceCompany: { select: { name: true } },
        preAuth: { select: { id: true, authCode: true, approvedAmount: true } },
        documents: { select: { id: true, docType: true, fileName: true, fileUrl: true, uploadedAt: true } },
        queries: { orderBy: { raisedAt: "asc" } },
        settlements: { orderBy: { createdAt: "asc" } },
        payments: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.patientInsurance.findMany({
      where: { hospitalId, status: "ACTIVE" },
      include: {
        patient: { select: { name: true, uhid: true, udid: true } },
        insuranceCompany: { select: { id: true, name: true } },
      },
    }),
  ]);

  return (
    <ClaimsClient
      claims={claims.map((c) => ({
        id: c.id,
        claimNumber: c.claimNumber,
        patientName: c.patientInsurance.patient.name,
        patientUhid: c.patientInsurance.patient.uhid ?? c.patientInsurance.patient.udid ?? "",
        patientInsuranceId: c.patientInsuranceId,
        insuranceCompanyId: c.insuranceCompanyId,
        insuranceCompanyName: c.insuranceCompany.name,
        preAuthId: c.preAuthId,
        preAuthCode: c.preAuth?.authCode ?? null,
        admissionId: c.admissionId,
        roomCharges: c.roomCharges,
        surgeryCharges: c.surgeryCharges,
        pharmacyCharges: c.pharmacyCharges,
        labCharges: c.labCharges,
        miscCharges: c.miscCharges,
        totalBillAmount: c.totalBillAmount,
        approvedAmount: c.approvedAmount,
        patientResponsibility: c.patientResponsibility,
        status: c.status,
        submittedAt: c.submittedAt?.toISOString() ?? null,
        approvedAt: c.approvedAt?.toISOString() ?? null,
        closedAt: c.closedAt?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
        documents: c.documents.map((d) => ({ id: d.id, docType: d.docType, fileName: d.fileName, fileUrl: d.fileUrl, uploadedAt: d.uploadedAt.toISOString() })),
        queries: c.queries.map((q) => ({ id: q.id, queryBy: q.queryBy, queryText: q.queryText, responseText: q.responseText, status: q.status, raisedAt: q.raisedAt.toISOString(), respondedAt: q.respondedAt?.toISOString() ?? null })),
        settlements: c.settlements.map((s) => ({ id: s.id, settledAmount: s.settledAmount, settledDate: s.settledDate.toISOString(), referenceNumber: s.referenceNumber, notes: s.notes })),
        payments: c.payments.map((p) => ({ id: p.id, amount: p.amount, paymentDate: p.paymentDate.toISOString(), paymentMode: p.paymentMode, referenceNumber: p.referenceNumber })),
      }))}
      policies={policies.map((p) => ({
        id: p.id,
        patientName: p.patient.name,
        patientUhid: p.patient.uhid ?? p.patient.udid ?? "",
        insuranceCompanyId: p.insuranceCompany.id,
        insuranceCompanyName: p.insuranceCompany.name,
        coveragePercent: p.coveragePercent,
      }))}
      hospitalId={hospitalId}
    />
  );
}
