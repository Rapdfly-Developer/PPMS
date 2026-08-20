import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import Link from "next/link";
import { ChevronLeft, Printer, Download, CheckCircle2, FileText } from "lucide-react";
import ConsentPrintButton from "./ConsentPrintButton";

export async function generateMetadata({ params }: { params: Promise<{ udid: string }> }) {
  const { udid } = await params;
  const patient = await prisma.patient.findUnique({ where: { udid }, select: { name: true } });
  return { title: patient ? `Consent — ${patient.name}` : "Consent Form" };
}

const LAT: Record<string, string> = { RE: "Right Eye", LE: "Left Eye", OU: "Both Eyes" };

export default async function ConsentFormPage({
  params,
}: {
  params: Promise<{ udid: string }>;
}) {
  const { udid } = await params;
  await requirePermission("patients.view");

  const patient = await prisma.patient.findUnique({
    where: { udid },
    select: {
      name: true, udid: true, age: true, sex: true, mobile: true,
      visits: {
        where: { surgeryAdvised: true },
        orderBy: { date: "desc" },
        take: 1,
        select: {
          advisedSurgeryName: true, advisedSurgeryEye: true,
          doctor:   { select: { name: true } },
          hospital: { select: { name: true, address: true, contact: true } },
          counsellingRecord: {
            select: {
              status: true, confirmedAt: true,
              procedure: true, laterality: true, anaesthesia: true,
              iolLensName: true, iolPower: true, iolBrand: true, iolToric: true,
              estimateAmount: true, dateOfSurgery: true,
              paymentType: true, paymentMode: true, schemeName: true, schemeType: true,
            },
          },
        },
      },
    },
  });

  if (!patient) notFound();

  const visit = patient.visits[0];
  if (!visit) notFound();

  const rec = visit.counsellingRecord;
  if (!rec || rec.status !== "CONFIRMED") {
    return (
      <div className="fade-in max-w-2xl mx-auto">
        <Link href={`/counseling/${udid}`}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)] mb-5 transition-colors">
          <ChevronLeft size={15} /> Back to Counseling
        </Link>
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-6 flex items-center gap-4">
          <FileText size={24} className="text-orange-400 shrink-0" />
          <div>
            <p className="text-sm font-bold text-orange-800">Consent form not yet available</p>
            <p className="text-xs text-orange-600 mt-0.5">
              The consent form is generated only after all three counselling stages are completed and confirmed.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const today = format(rec.confirmedAt ?? new Date(), "dd MMMM yyyy");
  const latLabel = rec.laterality ? (LAT[rec.laterality] ?? rec.laterality) : null;
  const eyeLabel = visit.advisedSurgeryEye ? (LAT[visit.advisedSurgeryEye] ?? visit.advisedSurgeryEye) : null;
  const iolParts = [
    rec.iolLensName ? `Lens: ${rec.iolLensName}` : null,
    rec.iolPower    ? `Power: ${rec.iolPower}` : null,
    rec.iolBrand    ? `Brand: ${rec.iolBrand}` : null,
    rec.iolToric    ? "Toric" : null,
  ].filter(Boolean).join("  ·  ");

  return (
    <div className="fade-in max-w-3xl mx-auto">
      {/* Nav */}
      <div className="flex items-center justify-between mb-5">
        <Link href={`/counseling/${udid}`}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)] transition-colors">
          <ChevronLeft size={15} /> Back to Counseling
        </Link>
        <div className="flex items-center gap-2">
          <ConsentPrintButton />
          <a
            href={`/api/consent-pdf/${udid}?dl=1`}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-teal-300 bg-teal-50 text-teal-700 text-sm font-semibold hover:bg-teal-100 transition-colors"
          >
            <Download size={14} /> Download PDF
          </a>
        </div>
      </div>

      {/* Consent card — printable */}
      <div id="consent-printable" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden print:border-none print:rounded-none print:shadow-none">

        {/* Hospital header */}
        <div className="bg-teal-600 px-8 py-5 text-white print:bg-white print:text-black print:border-b-2 print:border-black">
          <h1 className="text-xl font-bold tracking-wide uppercase">{visit.hospital?.name ?? "Hospital"}</h1>
          {visit.hospital?.address && (
            <p className="text-sm text-teal-100 mt-0.5 print:text-gray-600">{visit.hospital.address}</p>
          )}
          {visit.hospital?.contact && (
            <p className="text-sm text-teal-100 print:text-gray-600">Tel: {visit.hospital.contact}</p>
          )}
        </div>

        {/* Document title */}
        <div className="text-center py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-sunken)] print:border-b-2 print:border-black print:bg-white">
          <h2 className="text-base font-bold uppercase tracking-widest text-[var(--color-ink-800)]">
            Informed Consent for Surgical Procedure
          </h2>
        </div>

        <div className="px-8 py-6 flex flex-col gap-6">

          {/* Patient info */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--color-ink-400)] border-b border-[var(--color-border)] pb-1 mb-3">
              Patient Information
            </h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <Row label="Patient Name"   value={patient.name} />
              <Row label="Patient ID"     value={patient.udid ?? "—"} />
              <Row label="Age / Sex"
                value={`${patient.age} yrs / ${patient.sex === "MALE" ? "Male" : patient.sex === "FEMALE" ? "Female" : patient.sex}`}
              />
              <Row label="Mobile"         value={patient.mobile} />
              <Row label="Treating Surgeon" value={`Dr. ${visit.doctor?.name ?? "—"}`} />
              <Row label="Consent Date"   value={today} />
            </div>
          </section>

          {/* Procedure details */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--color-ink-400)] border-b border-[var(--color-border)] pb-1 mb-3">
              Procedure Details
            </h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <Row label="Surgery Advised"
                value={[visit.advisedSurgeryName, eyeLabel && `(${eyeLabel})`].filter(Boolean).join(" ") || "—"}
              />
              <Row label="Laterality" value={latLabel ?? "—"} />
              <Row label="Procedure"   value={rec.procedure ?? "—"} />
              <Row label="Anaesthesia" value={rec.anaesthesia ?? "—"} />
              {iolParts && <Row label="IOL Details" value={iolParts} span />}
              {rec.dateOfSurgery && (
                <>
                  <Row label="Planned Date"
                    value={format(new Date(rec.dateOfSurgery), "dd MMM yyyy")}
                  />
                  <Row label="Estimated Cost"
                    value={rec.estimateAmount ? `₹ ${rec.estimateAmount}` : "—"}
                  />
                </>
              )}
              {rec.paymentType && (
                <>
                  <Row label="Coverage Type" value={
                    rec.paymentType === "INSURANCE"         ? "Insurance" :
                    rec.paymentType === "NON_INSURANCE"     ? "Non-Insurance" :
                    rec.paymentType === "GOVERNMENT_SCHEME" ? "Government Scheme" :
                    rec.paymentType === "CAMP"              ? "Camp" :
                    rec.paymentType
                  } />
                  {rec.paymentType === "NON_INSURANCE" && rec.paymentMode && (
                    <Row label="Sub-type" value={
                      rec.paymentMode === "OUT_OF_POCKET" ? "Out of Pocket" :
                      rec.paymentMode === "FREE_CASH"     ? "Free Cash" :
                      rec.paymentMode
                    } />
                  )}
                  {(rec.paymentType === "INSURANCE" || rec.paymentType === "GOVERNMENT_SCHEME") && rec.schemeName && (
                    <Row label="Scheme" value={`${rec.schemeName}${rec.schemeType ? ` · ${rec.schemeType}` : ""}`} />
                  )}
                </>
              )}
            </div>
          </section>

          {/* Consent text */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--color-ink-400)] border-b border-[var(--color-border)] pb-1 mb-3">
              Declaration of Informed Consent
            </h3>
            <div className="text-sm text-[var(--color-ink-700)] leading-relaxed space-y-3">
              <p>
                I, the undersigned patient / legal guardian of the above-named patient, hereby voluntarily consent to the performance of the surgical procedure described above. I confirm that the nature, purpose, risks, benefits, and alternatives of the procedure have been explained to me in a language I understand, and I have had the opportunity to ask questions.
              </p>
              <p className="font-semibold text-[var(--color-ink-800)]">I understand and acknowledge the following:</p>
              <ol className="list-decimal list-inside space-y-1.5 pl-2">
                <li>The nature, purpose, and expected benefits of the surgical procedure have been fully explained.</li>
                <li>Alternative treatments (including non-surgical options) and their respective risks have been discussed.</li>
                <li>All surgical procedures carry inherent risks including infection, bleeding, anaesthetic reactions, and unforeseen complications.</li>
                <li>In ophthalmic surgery, specific risks include: posterior capsule rupture, endophthalmitis, retinal detachment, corneal decompensation, cystoid macular oedema, suprachoroidal haemorrhage, and reduced or loss of vision.</li>
                <li>Estimated visual outcomes cannot be guaranteed; results may vary depending on individual healing and pre-existing conditions.</li>
                <li>I consent to anaesthesia as deemed appropriate by the anaesthetist / surgeon.</li>
                <li>The surgical team may need to alter the planned procedure based on intra-operative findings.</li>
                <li>All my questions have been answered to my satisfaction prior to signing.</li>
                <li>I am free to withdraw this consent at any time before the procedure commences.</li>
              </ol>
              <p>
                Having understood the foregoing, I give my <strong>full and free consent</strong> to proceed with the planned surgical procedure.
              </p>
            </div>
          </section>

          {/* Signature blocks */}
          <section className="mt-2">
            <div className="grid grid-cols-3 gap-8">
              <SigBlock label="Patient / Guardian Signature" sub="Name: ________________________" sub2="Relationship: ________________" />
              <SigBlock label="Witness Signature"            sub="Name: ________________________" sub2={`Date: ${today}`} />
              <SigBlock label={`Dr. ${visit.doctor?.name ?? "Surgeon"}`} sub="Treating Surgeon" sub2={`Date: ${today}`} />
            </div>
          </section>

          {/* Confirmed badge */}
          <div className="flex items-center gap-2 rounded-xl bg-teal-50 border border-teal-200 px-4 py-3 print:hidden">
            <CheckCircle2 size={14} className="text-teal-600 shrink-0" />
            <p className="text-xs font-semibold text-teal-700">
              Counselling confirmed on {rec.confirmedAt ? format(new Date(rec.confirmedAt), "dd MMM yyyy, HH:mm") : today}
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="px-8 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface-sunken)] text-center">
          <p className="text-[11px] text-[var(--color-ink-400)]">
            {visit.hospital?.name} &nbsp;·&nbsp; Informed Consent Form &nbsp;·&nbsp; {today}
          </p>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body > *:not(#consent-printable) { display: none !important; }
          #consent-printable { border: none !important; box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}

function Row({ label, value, span }: { label: string; value: string; span?: boolean }) {
  return (
    <div className={span ? "col-span-2" : ""}>
      <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-ink-400)]">{label}</span>
      <p className="mt-0.5 text-[var(--color-ink-800)] font-medium">{value}</p>
    </div>
  );
}

function SigBlock({ label, sub, sub2 }: { label: string; sub: string; sub2?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="h-16 border-b-2 border-[var(--color-border)]" />
      <p className="text-xs font-bold text-[var(--color-ink-700)] mt-1">{label}</p>
      <p className="text-[11px] text-[var(--color-ink-400)]">{sub}</p>
      {sub2 && <p className="text-[11px] text-[var(--color-ink-400)]">{sub2}</p>}
    </div>
  );
}
