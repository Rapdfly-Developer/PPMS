import { format } from "date-fns";
import { ConsentPrintBody, CONSENT_PAGE_MIN_H } from "@/app/ipd-print/ConsentPrintBody";
import { IpdPrintHeader } from "@/app/ipd-print/IpdPrintHeader";
import { PrintBar } from "@/app/ipd-print/[admissionId]/PrintBar";
import { LATERALITY_LABEL, CASHLESS_TYPES, paymentLabel, parsePaymentDocs } from "@/lib/counselling";
import { loadCounsellingPrint, SEX } from "../load";
import { EducationPrintBody } from "../../EducationPrintBody";

export const metadata = { title: "Counselling" };

const rupees = (n: unknown) => (n == null ? "" : `Rs. ${Number(n).toLocaleString("en-IN")}`);
const day = (d: Date | string | null | undefined) => (d ? format(new Date(d), "d MMM yyyy") : "");

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr>
      <td className="border border-gray-400 px-2 py-1.5 font-semibold w-[38%] align-top bg-gray-50">{label}</td>
      <td className="border border-gray-400 px-2 py-1.5 align-top">{value || "-"}</td>
    </tr>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-4 mb-1.5 text-[13px] font-bold uppercase tracking-wide break-after-avoid">{children}</h2>;
}

/**
 * The Counselling print chosen in the Print pop-up: any of the Counselling
 * Sheet, Investigations, Consents and Education & Diet, each starting on its
 * own A4 page. ?s=1 sheet, ?i=1 investigations, ?e=1 education, ?c=<consent id> (repeatable).
 */
export default async function CounsellingAllPrintPage({ params, searchParams }: {
  params: Promise<{ visitId: string }>;
  searchParams: Promise<{ print?: string; s?: string; i?: string; e?: string; c?: string | string[] }>;
}) {
  const { visitId } = await params;
  const q = await searchParams;
  const { v, pid, ctx, consents, education, implantDetails: imp } = await loadCounsellingPrint(visitId);
  const rec = v.counsellingRecord;
  const consentIds = q.c ? (Array.isArray(q.c) ? q.c : [q.c]) : [];
  const chosenConsents = consents.items.filter((c) => consentIds.includes(c.id));

  const hospital = { name: v.hospital.name, logoUrl: v.hospital.logoUrl, address: v.hospital.address, contact: v.hospital.contact, email: v.hospital.email };
  const procedure = [ctx.eye, ctx.surgery].filter(Boolean).join(" ");
  const baseBoxes: [string, string][] = [
    ["Patient", ctx.patientName],
    ["Age / Gender", `${ctx.age} yrs / ${SEX[ctx.sex] ?? ctx.sex}`],
    ["Hospital No.", pid],
    ["Procedure", procedure],
    ["Surgery date", ctx.surgeryDate ? day(ctx.surgeryDate) : ""],
    ["Surgeon", `Dr. ${ctx.doctor}`],
  ];
  const cashless = CASHLESS_TYPES.find((t) => t.value === rec?.paymentType);
  const docs = parsePaymentDocs(rec?.paymentDocs);
  const orders = v.investigationOrders;

  const pages: { key: string; consent?: boolean; node: React.ReactNode }[] = [];

  if (q.s === "1") {
    pages.push({
      key: "sheet",
      node: (
        <>
          <IpdPrintHeader hospital={hospital} doctor={ctx.doctor} specialty={v.doctor.specialty || null}
            kicker="Surgical Counselling" title="Counselling Sheet" dateText={`Date: ${format(new Date(), "d MMM yyyy")}`} boxes={baseBoxes} />
          <H2>Surgery</H2>
          <table className="w-full border-collapse text-[12px]">
            <tbody>
              <Row label="Surgery" value={v.advisedSurgeryName} />
              <Row label="Eye" value={v.advisedSurgeryEye ? LATERALITY_LABEL[v.advisedSurgeryEye] ?? v.advisedSurgeryEye : ""} />
              <Row label="Anaesthesia" value={v.advisedSurgeryAnaesthesia} />
              {v.advisedSurgeryNotes?.trim() && <Row label="Surgery notes" value={v.advisedSurgeryNotes} />}
              <Row label="Type of implant" value={rec?.implant} />
              <Row label="Tentative date" value={day(rec?.dateOfSurgery ?? v.advisedSurgeryDate)} />
            </tbody>
          </table>
          <H2>Implant details</H2>
          <table className="w-full border-collapse text-[12px]">
            <tbody>
              <Row label="Manufacturer" value={imp.manufacturer} />
              <Row label="Model" value={imp.model} />
              <Row label="IOL power" value={imp.power ? `${imp.power} D` : ""} />
              <Row label="A-constant" value={imp.aConstant} />
              <Row label="Lot / batch no." value={imp.lot} />
              <Row label="Serial no." value={imp.serial} />
              <Row label="Expiry" value={imp.expiry} />
            </tbody>
          </table>
          <H2>Payment</H2>
          <table className="w-full border-collapse text-[12px]">
            <tbody>
              <Row label="Payment" value={paymentLabel(rec?.paymentMode, rec?.paymentType)} />
              {cashless && <Row label={cashless.nameLabel} value={rec?.schemeName} />}
              {cashless && <Row label={cashless.idLabel} value={rec?.policyNumber} />}
              {docs.length > 0 && <Row label="Documents" value={docs.map((d) => d.name).join(", ")} />}
              <Row label="Estimate" value={rupees(rec?.estimateAmount)} />
              <Row label="Advance" value={rec?.advancePaid != null ? rupees(rec.advancePaid) : rec?.advanceReceived ? "Received" : ""} />
            </tbody>
          </table>
          <H2>Fitness</H2>
          <table className="w-full border-collapse text-[12px]">
            <tbody>
              <Row label="Fit for surgery" value={rec?.fitForSurgery ? `Yes${rec.fitByName ? `, marked by ${rec.fitByName}` : ""}${rec.doctorReviewedAt ? ` on ${day(rec.doctorReviewedAt)}` : ""}` : "Not yet"} />
            </tbody>
          </table>
          <div className="mt-12 grid grid-cols-2 gap-10 text-[11.5px] break-inside-avoid">
            <div><p className="border-t border-gray-800 pt-1"><b>Counsellor</b></p><p>Name: ____________________</p></div>
            <div><p className="border-t border-gray-800 pt-1"><b>Patient / relative</b></p><p>Name: ____________________</p></div>
          </div>
        </>
      ),
    });
  }

  if (q.i === "1") {
    pages.push({
      key: "inv",
      node: (
        <>
          <IpdPrintHeader hospital={hospital} doctor={ctx.doctor} specialty={v.doctor.specialty || null}
            kicker="Surgical Counselling" title="Investigations" dateText={`Date: ${format(new Date(), "d MMM yyyy")}`} boxes={baseBoxes} />
          {orders.length === 0 ? (
            <p className="mt-4 text-[12.5px]">No investigations ordered.</p>
          ) : (
            <table className="mt-3 w-full border-collapse text-[12px]">
              <thead>
                <tr className="bg-gray-100">
                  {["#", "Investigation", "Eye", "Ordered", "Report", "Doctor's notes"].map((h) => <th key={h} className="border border-gray-400 px-2 py-1.5 text-left font-bold">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {orders.map((o, n) => (
                  <tr key={o.id} className="break-inside-avoid">
                    <td className="border border-gray-400 px-2 py-1.5 align-top">{n + 1}</td>
                    <td className="border border-gray-400 px-2 py-1.5 align-top font-semibold">
                      {o.testName}
                      {o.notes?.trim() && <span className="block font-normal text-[11px]">In view of: {o.notes}</span>}
                    </td>
                    <td className="border border-gray-400 px-2 py-1.5 align-top whitespace-nowrap">{o.laterality ?? "-"}</td>
                    <td className="border border-gray-400 px-2 py-1.5 align-top whitespace-nowrap">{day(o.createdAt)}</td>
                    <td className="border border-gray-400 px-2 py-1.5 align-top whitespace-nowrap">{o.resultRef ? `Uploaded ${day(o.resultAt)}` : "Pending"}</td>
                    <td className="border border-gray-400 px-2 py-1.5 align-top">{o.doctorNotes?.trim() || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      ),
    });
  }

  for (const c of chosenConsents) {
    pages.push({
      key: `c-${c.id}`,
      consent: true,
      node: (
        <>
          <IpdPrintHeader hospital={hospital} doctor={ctx.doctor} specialty={v.doctor.specialty || null}
            kicker="Informed Consent" title={c.title} dateText="Date: ____________"
            boxes={[
              ["Patient", ctx.patientName],
              ["Age / Gender", `${ctx.age} yrs / ${SEX[ctx.sex] ?? ctx.sex}`],
              ["Phone", v.patient.mobile],
              ["Hospital No.", pid],
              ["Procedure", procedure],
              ["Surgeon", `Dr. ${ctx.doctor}`],
              ["Anaesthesia", ctx.anaesthesia ?? ""],
            ]} />
          <ConsentPrintBody c={c} doctor={ctx.doctor} qualifications={v.doctor.qualifications} />
        </>
      ),
    });
  }

  if (q.e === "1") {
    pages.push({
      key: "edu",
      node: (
        <>
          <IpdPrintHeader hospital={hospital} doctor={ctx.doctor} specialty={v.doctor.specialty || null}
            kicker="Before your operation" title="Patient Education & Diet" dateText={`Date: ${format(new Date(), "d MMM yyyy")}`} boxes={baseBoxes} />
          <EducationPrintBody e={education} />
        </>
      ),
    });
  }

  return (
    <main className="min-h-screen bg-gray-100 print:bg-white">
      <style>{"@page { size: A4; margin: 10mm 0; }"}</style>
      <PrintBar autoPrint={q.print !== "0"} title="Counselling" />
      <div className="py-6 print:py-0 space-y-6 print:space-y-0">
        {pages.length === 0 && <p className="text-center text-sm text-gray-500">Nothing chosen to print.</p>}
        {pages.map((p, n) => (
          <div key={p.key}
            className={`mx-auto w-[210mm] max-w-full bg-white pt-0 shadow-sm print:shadow-none print:w-auto text-black ${n > 0 ? "break-before-page" : ""} ${
              p.consent ? `px-[7mm] pb-[10mm] print:pb-0 flex flex-col box-border ${CONSENT_PAGE_MIN_H}` : "px-[14mm] pb-[12mm] print:py-0"
            }`}
            style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
            {p.node}
          </div>
        ))}
      </div>
    </main>
  );
}
