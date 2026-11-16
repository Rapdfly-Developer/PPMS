import { format } from "date-fns";
import { IpdPrintHeader } from "@/app/ipd-print/IpdPrintHeader";
import { PrintBar } from "@/app/ipd-print/[admissionId]/PrintBar";
import { loadCounsellingPrint, SEX } from "../load";
import { EducationPrintBody } from "../../EducationPrintBody";

export const metadata = { title: "Patient Education & Diet" };

/** One copy of the patient education points and diet chart, given to the patient before the operation. */
export default async function CounsellingEducationPrintPage({ params, searchParams }: {
  params: Promise<{ visitId: string }>; searchParams: Promise<{ print?: string }>;
}) {
  const { visitId } = await params;
  const { print } = await searchParams;
  const { v, pid, ctx, education: e } = await loadCounsellingPrint(visitId);

  return (
    <main className="min-h-screen bg-gray-100 print:bg-white">
      <style>{"@page { size: A4; margin: 10mm 0; }"}</style>
      <PrintBar autoPrint={print !== "0"} title="Patient education & diet" />
      <div className="py-6 print:py-0">
        <div className="mx-auto w-[210mm] max-w-full bg-white px-[14mm] pt-0 pb-[12mm] shadow-sm print:shadow-none print:w-auto print:py-0 text-black" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
          <IpdPrintHeader
            hospital={{ name: v.hospital.name, logoUrl: v.hospital.logoUrl, address: v.hospital.address, contact: v.hospital.contact, email: v.hospital.email }}
            doctor={ctx.doctor}
            specialty={v.doctor.specialty || null}
            kicker="Before your operation"
            title="Patient Education & Diet"
            dateText={`Date: ${format(new Date(), "d MMM yyyy")}`}
            boxes={[
              ["Patient", ctx.patientName],
              ["Age / Gender", `${ctx.age} yrs / ${SEX[ctx.sex] ?? ctx.sex}`],
              ["Hospital No.", pid],
              ["Procedure", [ctx.eye, ctx.surgery].filter(Boolean).join(" ")],
              ["Surgery date", ctx.surgeryDate ? format(new Date(ctx.surgeryDate), "d MMM yyyy") : ""],
              ["Surgeon", `Dr. ${ctx.doctor}`],
            ]}
          />

          <EducationPrintBody e={e} />
        </div>
      </div>
    </main>
  );
}
