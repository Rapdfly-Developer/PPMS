import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { SettlementClient } from "./SettlementClient";

export default async function SettlementPage() {
  const user = await requirePermission("insurance.manage");
  const hospitalId = user.hospitalId ?? user.doctorId ?? "";

  const claims = await prisma.insuranceClaim.findMany({
    where: {
      hospitalId,
      status: { in: ["APPROVED", "PAYMENT_RECEIVED", "CLOSED"] },
    },
    include: {
      patientInsurance: { include: { patient: { select: { name: true, uhid: true, udid: true } } } },
      insuranceCompany: { select: { name: true } },
      settlements: { orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <SettlementClient
      claims={claims.map((c) => ({
        id: c.id,
        claimNumber: c.claimNumber,
        patientName: c.patientInsurance.patient.name,
        patientUhid: c.patientInsurance.patient.uhid ?? c.patientInsurance.patient.udid ?? "",
        insuranceCompanyName: c.insuranceCompany.name,
        totalBillAmount: c.totalBillAmount,
        approvedAmount: c.approvedAmount,
        patientResponsibility: c.patientResponsibility,
        status: c.status,
        createdAt: c.createdAt.toISOString(),
        settlements: c.settlements.map((s) => ({
          id: s.id, settledAmount: s.settledAmount, settledDate: s.settledDate.toISOString(),
          referenceNumber: s.referenceNumber, notes: s.notes,
        })),
        payments: c.payments.map((p) => ({
          id: p.id, amount: p.amount, paymentDate: p.paymentDate.toISOString(),
          paymentMode: p.paymentMode, referenceNumber: p.referenceNumber,
        })),
      }))}
    />
  );
}
