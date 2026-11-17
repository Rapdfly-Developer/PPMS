import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { visitRecordScope } from "@/lib/patient-access";
import { IpdPrintHeader } from "../../../IpdPrintHeader";
import { ConsentPrintBody, CONSENT_PAGE_MIN_H } from "../../../ConsentPrintBody";
import { defaultConsents, isV2, upgradeConsents, type ConsentsData, type FormContext } from "@/lib/ipd-forms";
import { PrintBar } from "../../PrintBar";
import { parseCounsellingConsents } from "@/lib/counselling-sheets";
import { surgeryText } from "@/components/ui/SurgeryInline";

export const metadata = { title: "Consent Form" };

const SEX: Record<string, string> = { MALE: "Male", FEMALE: "Female", OTHER: "Other" };

/** One consent, printed for the patient / relative and witness to sign. */
export default async function ConsentPrintPage({ params, searchParams }: {
  params: Promise<{ admissionId: string; consentId: string }>; searchParams: Promise<{ print?: string }>;
}) {
  const { admissionId, consentId } = await params;
  const { print } = await searchParams;
  const user = await requirePermission("ipd.view");
  const scope = await visitRecordScope(user);
  if (!scope) notFound();

  const a = await prisma.ipdAdmission.findFirst({
    where: { id: admissionId, visit: { ...scope, finalizedAt: { not: null } } },
    include: {
      forms: { where: { key: "consents" } },
      visit: {
        select: {
          hospital: { select: { name: true, address: true, contact: true, logoUrl: true, email: true } },
          doctor: { select: { name: true, qualifications: true, specialty: true } },
          patient: { select: { id: true, name: true, udid: true, uhid: true, age: true, sex: true, mobile: true } },
        },
      },
    },
  });
  if (!a) notFound();
  const v = a.visit;
  const pid = v.patient.uhid ?? v.patient.udid ?? v.patient.id;
  const ctx: FormContext = {
    patientName: v.patient.name, age: v.patient.age, sex: v.patient.sex, patientId: pid, hospital: v.hospital.name, doctor: v.doctor.name,
    surgery: a.surgery, eye: a.laterality, implant: a.implant, anaesthesia: a.anaesthesia, surgeryDate: a.surgeryDate?.toISOString() ?? null, type: a.admissionType,
  };
  let saved: unknown = null;
  try { saved = a.forms[0] ? JSON.parse(a.forms[0].data) : null; } catch { saved = null; }
  // Not saved in the ward yet: a Pre-op file starts from the consents filled at counselling
  const fromCounselling = !isV2(saved) && a.counsellingVisitId
    ? parseCounsellingConsents((await prisma.counsellingRecord.findUnique({ where: { visitId: a.counsellingVisitId }, select: { consents: true } }))?.consents)
    : null;
  const data: ConsentsData = upgradeConsents(isV2(saved) ? (saved as ConsentsData) : fromCounselling ?? defaultConsents(ctx), ctx);
  const c = data.items.find((x) => x.id === decodeURIComponent(consentId));
  if (!c) notFound();

  return (
    <main className="min-h-screen bg-gray-100 print:bg-white">
      <style>{"@page { size: A4; margin: 10mm 0; }"}</style>
      <PrintBar autoPrint={print !== "0"} title={c.title} />
      <div className="py-6 print:py-0">
        <div className={`mx-auto w-[210mm] max-w-full bg-white px-[7mm] pt-0 pb-[10mm] shadow-sm print:shadow-none print:w-auto print:pb-0 text-black flex flex-col box-border ${CONSENT_PAGE_MIN_H}`} style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
          <IpdPrintHeader
            bleed="7mm"
            hospital={{ name: v.hospital.name, logoUrl: v.hospital.logoUrl, address: v.hospital.address, contact: v.hospital.contact, email: v.hospital.email }}
            doctor={ctx.doctor}
            specialty={v.doctor.specialty || null}
            kicker="Informed Consent"
            title={c.title}
            dateText="Date: ____________"
            boxes={[
              ["Patient", ctx.patientName],
              ["Age / Gender", `${ctx.age} yrs / ${SEX[ctx.sex] ?? ctx.sex}`],
              ["Phone", v.patient.mobile],
              ["Hospital No. / IP No.", [pid, a.fileNo].filter(Boolean).join(" / ")],
              ["Procedure", surgeryText(ctx.eye, ctx.surgery, ctx.anaesthesia)],
              ["Surgeon", `Dr. ${ctx.doctor}`],
            ]}
          />

          <ConsentPrintBody c={c} doctor={ctx.doctor} qualifications={v.doctor.qualifications} />
        </div>
      </div>
    </main>
  );
}
