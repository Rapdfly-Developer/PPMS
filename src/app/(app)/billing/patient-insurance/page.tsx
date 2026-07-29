import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { PatientInsuranceClient } from "./PatientInsuranceClient";

export default async function PatientInsurancePage() {
  const user = await requirePermission("insurance.view");
  const hospitalId = user.hospitalId ?? user.doctorId ?? "";

  const [policies, companies, patients] = await Promise.all([
    prisma.patientInsurance.findMany({
      where: { hospitalId },
      include: {
        patient: { select: { id: true, name: true, uhid: true, udid: true } },
        insuranceCompany: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.insuranceCompany.findMany({
      where: { hospitalId, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.patient.findMany({
      where: {
        OR: [
          { doctorId: hospitalId },
          { registeredAtId: hospitalId },
        ],
      },
      select: { id: true, name: true, uhid: true, udid: true, mobile: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
  ]);

  return (
    <PatientInsuranceClient
      policies={policies.map((p) => ({
        id: p.id,
        patientId: p.patientId,
        patientName: p.patient.name,
        patientUhid: p.patient.uhid ?? p.patient.udid ?? "",
        insuranceCompanyId: p.insuranceCompanyId,
        insuranceCompanyName: p.insuranceCompany.name,
        policyNumber: p.policyNumber,
        cardNumber: p.cardNumber,
        coveragePercent: p.coveragePercent,
        validFrom: p.validFrom.toISOString(),
        validTo: p.validTo.toISOString(),
        status: p.status,
        notes: p.notes,
        createdAt: p.createdAt.toISOString(),
      }))}
      companies={companies}
      patients={patients.map((p) => ({ id: p.id, name: p.name, uhid: p.uhid ?? p.udid ?? "", mobile: p.mobile }))}
      hospitalId={hospitalId}
    />
  );
}
