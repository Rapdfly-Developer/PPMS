import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { QueriesClient } from "./QueriesClient";

export default async function QueriesPage() {
  const user = await requirePermission("insurance.view");
  const hospitalId = user.hospitalId ?? user.doctorId ?? "";

  const queries = await prisma.insuranceQuery.findMany({
    where: { claim: { hospitalId } },
    include: {
      claim: {
        select: {
          claimNumber: true,
          status: true,
          patientInsurance: { include: { patient: { select: { name: true } }, insuranceCompany: { select: { name: true } } } },
        },
      },
    },
    orderBy: { raisedAt: "desc" },
  });

  return (
    <QueriesClient
      queries={queries.map((q) => ({
        id: q.id,
        claimId: q.claimId,
        claimNumber: q.claim.claimNumber,
        claimStatus: q.claim.status,
        patientName: q.claim.patientInsurance.patient.name,
        insuranceCompanyName: q.claim.patientInsurance.insuranceCompany.name,
        queryBy: q.queryBy,
        queryText: q.queryText,
        responseText: q.responseText,
        status: q.status,
        raisedAt: q.raisedAt.toISOString(),
        respondedAt: q.respondedAt?.toISOString() ?? null,
      }))}
    />
  );
}
