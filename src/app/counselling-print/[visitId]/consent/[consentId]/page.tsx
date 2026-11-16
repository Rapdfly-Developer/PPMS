import { notFound } from "next/navigation";
import { ConsentPrintBody, CONSENT_PAGE_MIN_H } from "@/app/ipd-print/ConsentPrintBody";
import { IpdPrintHeader } from "@/app/ipd-print/IpdPrintHeader";
import { PrintBar } from "@/app/ipd-print/[admissionId]/PrintBar";
import { loadCounsellingPrint, SEX } from "../../load";

export const metadata = { title: "Consent Form" };

/** One counselling consent, printed for the patient / relative and witness to sign. */
export default async function CounsellingConsentPrintPage({ params, searchParams }: {
  params: Promise<{ visitId: string; consentId: string }>; searchParams: Promise<{ print?: string }>;
}) {
  const { visitId, consentId } = await params;
  const { print } = await searchParams;
  const { v, pid, ctx, consents } = await loadCounsellingPrint(visitId);
  const c = consents.items.find((x) => x.id === decodeURIComponent(consentId));
  if (!c) notFound();

  return (
    <main className="min-h-screen bg-gray-100 print:bg-white">
      <style>{"@page { size: A4; margin: 10mm 0; }"}</style>
      <PrintBar autoPrint={print !== "0"} title={c.title} />
      <div className="py-6 print:py-0">
        <div className={`mx-auto w-[210mm] max-w-full bg-white px-[7mm] pt-0 pb-[10mm] shadow-sm print:shadow-none print:w-auto print:pb-0 text-black flex flex-col box-border ${CONSENT_PAGE_MIN_H}`} style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
          <IpdPrintHeader
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
              ["Hospital No.", pid],
              ["Procedure", [ctx.eye, ctx.surgery].filter(Boolean).join(" ")],
              ["Surgeon", `Dr. ${ctx.doctor}`],
              ["Anaesthesia", ctx.anaesthesia ?? ""],
            ]}
          />

          <ConsentPrintBody c={c} doctor={ctx.doctor} qualifications={v.doctor.qualifications} />
        </div>
      </div>
    </main>
  );
}
