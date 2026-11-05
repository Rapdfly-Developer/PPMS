import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { visitRecordScope } from "@/lib/patient-access";
import { isDischargeData } from "@/lib/ipd";
import { DischargeDocument } from "../../(app)/ipd/[admissionId]/DischargeDocument";
import { PrintBar } from "./PrintBar";

export const metadata = { title: "Discharge Summary" };

/** Printable discharge summary, outside the app shell so only the document prints. */
export default async function DischargePrintPage({ params, searchParams }: { params: Promise<{ admissionId: string }>; searchParams: Promise<{ print?: string }> }) {
  const { admissionId } = await params;
  const { print } = await searchParams;
  const user = await requirePermission("ipd.view");
  const scope = await visitRecordScope(user);
  if (!scope) notFound();

  const a = await prisma.ipdAdmission.findFirst({
    where: { id: admissionId, visit: { ...scope, finalizedAt: { not: null } } },
    include: {
      forms: { where: { key: "discharge" } },
      visit: {
        select: {
          hospital: { select: { name: true, address: true, contact: true, logoUrl: true, email: true } },
          doctor: { select: { name: true, qualifications: true, medicalRegNumber: true, specialty: true } },
          patient: { select: { id: true, name: true, udid: true, uhid: true, age: true, sex: true, mobile: true } },
        },
      },
    },
  });
  if (!a) notFound();

  const form = a.forms[0];
  let summary: unknown = null;
  try { summary = form ? JSON.parse(form.data) : null; } catch { summary = null; }
  const v = a.visit;

  if (!isDischargeData(summary)) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <p className="text-sm text-gray-600">Save the discharge summary in the patient file first, then print it.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 print:bg-white">
      <style>{"@page { size: A4; margin: 10mm 0; }"}</style>
      <PrintBar autoPrint={print !== "0"} />
      <div className="py-6 print:py-0">
        <div className="mx-auto w-fit shadow-sm print:shadow-none">
          <DischargeDocument
            s={summary}
            h={{
              hospital: v.hospital.name, address: v.hospital.address, contact: v.hospital.contact, logoUrl: v.hospital.logoUrl, email: v.hospital.email,
              doctor: v.doctor.name, qualifications: v.doctor.qualifications, regNo: v.doctor.medicalRegNumber, specialty: v.doctor.specialty || null,
              patient: { name: v.patient.name, age: v.patient.age, sex: v.patient.sex, id: v.patient.uhid ?? v.patient.udid ?? v.patient.id, mobile: v.patient.mobile },
              fileNo: a.fileNo, ward: a.ward, floor: a.floor,
              type: a.admissionType, typeOther: a.admissionTypeOther,
              admittedOn: a.admittedOn.toISOString(),
              signed: a.status === "DISCHARGED" && a.dischargedBy ? { by: a.dischargedBy, at: (form.frozenAt ?? a.dischargedAt ?? new Date()).toISOString() } : null,
            }}
          />
        </div>
      </div>
    </main>
  );
}
