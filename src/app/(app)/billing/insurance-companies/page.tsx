import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { InsuranceCompaniesClient } from "./InsuranceCompaniesClient";

export default async function InsuranceCompaniesPage() {
  const user = await requirePermission("insurance.view");

  const hospitalId = user.hospitalId ?? user.doctorId ?? "";

  const companies = await prisma.insuranceCompany.findMany({
    where: { hospitalId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { patientInsurances: true, claims: true } },
    },
  });

  const serialized = companies.map((c) => ({
    id: c.id,
    name: c.name,
    contactPerson: c.contactPerson,
    email: c.email,
    phone: c.phone,
    address: c.address,
    tpaName: c.tpaName,
    active: c.active,
    createdAt: c.createdAt.toISOString(),
    patientCount: c._count.patientInsurances,
    claimCount: c._count.claims,
  }));

  return <InsuranceCompaniesClient companies={serialized} hospitalId={hospitalId} />;
}
