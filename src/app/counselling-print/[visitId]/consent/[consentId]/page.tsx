import { notFound } from "next/navigation";
import { CONSENT_DECLARATION } from "@/lib/ipd-forms";
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

  const line = "border-t border-gray-800 pt-1 mt-12";
  return (
    <main className="min-h-screen bg-gray-100 print:bg-white">
      <style>{"@page { size: A4; margin: 10mm 0; }"}</style>
      <PrintBar autoPrint={print !== "0"} title={c.title} />
      <div className="py-6 print:py-0">
        <div className="mx-auto w-[210mm] max-w-full bg-white px-[14mm] pt-0 pb-[12mm] shadow-sm print:shadow-none print:w-auto print:py-0 text-black" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
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

          <div className="space-y-3 text-[12.5px] leading-[1.7] text-justify">
            {c.text.split("\n").filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
          </div>
          <p className="mt-4 text-[12px] font-semibold italic">{CONSENT_DECLARATION}</p>
          <p className="mt-2 text-[12px]">
            Explained in: {c.language || "______________"}
            {c.explainedBy ? <> · Explained by: {c.explainedBy}</> : null}
          </p>

          <div className="mt-6 grid grid-cols-3 gap-8 text-[11.5px] break-inside-avoid">
            <div>
              <p className={line}><b>Signature of {c.signer?.kind === "RELATIVE" ? "relative" : c.signer?.kind === "PATIENT" ? "patient" : "patient / relative"}</b></p>
              <p>Name: {c.signer?.name || "____________________"}</p>
              {c.signer?.kind !== "PATIENT" && <p>Relationship: {c.signer?.relation || "______________"}</p>}
            </div>
            <div>
              <p className={line}><b>Signature of witness</b></p>
              <p>Name: {c.witness || "____________________"}</p>
            </div>
            <div>
              <p className={line}><b>Signature of doctor</b></p>
              <p>Dr. {ctx.doctor.replace(/^Dr\.?\s*/i, "")}</p>
              {v.doctor.qualifications && <p>{v.doctor.qualifications}</p>}
            </div>
          </div>
          <p className="mt-6 text-[11px]">Date & time: ______________________</p>
        </div>
      </div>
    </main>
  );
}
