import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { visitRecordScope } from "@/lib/patient-access";
import { IpdPrintHeader } from "../../../IpdPrintHeader";
import { CONSENT_DECLARATION, defaultConsents, eyeName, isV2, type ConsentsData, type FormContext } from "@/lib/ipd-forms";
import { PrintBar } from "../../PrintBar";

export const metadata = { title: "Consent Form" };

const SEX: Record<string, string> = { MALE: "Male", FEMALE: "Female", OTHER: "Other" };
const dateTime = (d: string) =>
  new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });

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
  const data: ConsentsData = isV2(saved) ? (saved as ConsentsData) : defaultConsents(ctx);
  const c = data.items.find((x) => x.id === decodeURIComponent(consentId));
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
            dateText={c.signedAt ? dateTime(c.signedAt) : "Date: ____________"}
            boxes={[
              ["Patient", ctx.patientName],
              ["Age / Gender", `${ctx.age} yrs / ${SEX[ctx.sex] ?? ctx.sex}`],
              ["Phone", v.patient.mobile],
              ["Hospital No. / IP No.", [pid, a.fileNo].filter(Boolean).join(" / ")],
              ["Procedure", [ctx.eye, ctx.surgery].filter(Boolean).join(" ")],
              ["Eye", eyeName(ctx.eye)],
              ["Surgeon", `Dr. ${ctx.doctor}`],
              ["Anaesthesia", ctx.anaesthesia ?? ""],
            ]}
          />

          <div className="space-y-3 text-[12.5px] leading-[1.7] text-justify">
            {c.text.split("\n").filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
          </div>
          <p className="mt-4 text-[12px] font-semibold italic">{CONSENT_DECLARATION}</p>
          <p className="mt-2 text-[12px]">Explained in: {c.language ?? "______________"}</p>

          <div className="mt-6 grid grid-cols-3 gap-8 text-[11.5px] break-inside-avoid">
            <div>
              <p className={line}><b>Signature of patient / relative</b></p>
              <p>Name: {c.signer?.name ?? "____________________"}</p>
              <p>Relationship: {c.signer ? (c.signer.kind === "PATIENT" ? "Self" : c.signer.relation) : "______________"}</p>
            </div>
            <div>
              <p className={line}><b>Signature of witness</b></p>
              <p>Name: {c.witness ?? "____________________"}</p>
            </div>
            <div>
              <p className={line}><b>Signature of doctor</b></p>
              <p>Dr. {(c.explainedBy ?? ctx.doctor).replace(/^Dr\.?\s*/i, "")}</p>
              {v.doctor.qualifications && <p>{v.doctor.qualifications}</p>}
            </div>
          </div>
          <p className="mt-6 text-[11px]">Date & time: {c.signedAt ? dateTime(c.signedAt) : "______________________"}</p>
          {c.signed && <p className="mt-1 text-[10px] text-gray-500">Signature recorded in the patient file by {c.recordedBy ?? "—"}.</p>}
        </div>
      </div>
    </main>
  );
}
