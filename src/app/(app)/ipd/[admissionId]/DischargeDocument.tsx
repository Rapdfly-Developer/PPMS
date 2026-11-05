// Printable discharge summary (A4), laid out like a standard hospital discharge
// summary. Pure markup, used by the print page. No <header>/<nav> elements:
// the app's print styles hide those.
import { admissionTypeText, dischargeTypeLabel, type DischargeData } from "@/lib/ipd";
import { fileHref } from "@/lib/file-href";

export interface DischargeHeader {
  hospital: string; address: string | null; contact: string | null; logoUrl: string | null;
  doctor: string; qualifications: string | null; regNo: string | null;
  patient: { name: string; age: number; sex: string; id: string };
  fileNo: string | null; ward: string | null; floor: string | null;
  type: string; typeOther: string | null;
  admittedOn: string;
  signed: { by: string; at: string } | null;
}

const ordinal = (n: number) => (n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th");
function LongDate({ s }: { s?: string | null }) {
  if (!s) return <>—</>;
  const d = new Date(s.length === 10 ? `${s}T00:00:00+05:30` : s);
  const day = Number(d.toLocaleDateString("en-GB", { day: "numeric", timeZone: "Asia/Kolkata" }));
  const rest = d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
  return <>{String(day).padStart(2, "0")}<sup>{ordinal(day)}</sup> {rest}</>;
}
const dateTime = (s: string) =>
  new Date(s).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
const SEX: Record<string, string> = { MALE: "Male", FEMALE: "Female", OTHER: "Other" };
const lines = (v: string) => v.split("\n").map((l) => l.trim()).filter(Boolean);

const Dashed = () => <div className="my-2.5 border-t border-dashed border-gray-400" />;

function Heading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[12px] font-bold uppercase tracking-wide text-black mb-1">{children}</h3>;
}

/** One section: bold heading, plain content, dashed rule after it. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid">
      <Heading>{title}</Heading>
      <div className="text-[12px] leading-[1.55] text-gray-900">{children}</div>
      <Dashed />
    </section>
  );
}

function Para({ v }: { v: string }) {
  const ls = lines(v);
  if (!ls.length) return <p className="text-gray-500">Nil</p>;
  return <>{ls.map((l, i) => <p key={i}>{l}</p>)}</>;
}

/** label : value row of the patient details block. */
function Pair({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <>
      <span className="font-bold uppercase text-[11px] tracking-wide text-black">{k}</span>
      <span className="text-[12px] text-gray-900"><span className="mr-1.5">:</span>{v || "—"}</span>
    </>
  );
}

const cell = "border border-gray-700 px-2 py-1 text-left align-top";

export function DischargeDocument({ h, s }: { h: DischargeHeader; s: DischargeData }) {
  const surgical = !!(s.procedure.name || s.procedure.implant);
  const diagnoses = lines(s.diagnosis);
  const consultant = s.consultant || h.doctor;

  const letterhead = (
    <div className="flex items-start justify-between gap-6 pb-3 mb-3 border-b-2 border-gray-800">
      <div className="text-[11px] leading-snug text-gray-900">
        <p className="text-[14px] font-extrabold uppercase tracking-wide text-black">{h.hospital}</p>
        {h.address && <p className="max-w-[300px]">{h.address}</p>}
        {h.contact && <p>Ph: {h.contact}</p>}
      </div>
      {h.logoUrl
        ? <img src={fileHref(h.logoUrl) ?? h.logoUrl} alt={h.hospital} className="h-16 max-w-[180px] object-contain" />
        : <p className="text-[20px] font-black text-teal-800 leading-none text-right max-w-[220px]">{h.hospital}</p>}
    </div>
  );

  const footer = (
    <div className="pt-3 text-center">
      <p className="text-[10px] font-semibold text-gray-800">{h.hospital}{h.address ? `, ${h.address}` : ""}{h.contact ? ` · Tel: ${h.contact}` : ""}</p>
      <div className="mt-1.5 bg-teal-800 text-white py-1.5 text-[15px] tracking-[0.12em] [print-color-adjust:exact] [-webkit-print-color-adjust:exact]" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
        EMERGENCY CALL{h.contact ? ` - ${h.contact}` : ""}
      </div>
      <p className="mt-1.5 text-[10px] font-bold uppercase text-gray-900">&ldquo;Keep the reports carefully and bring them along during your next visit to our hospital&rdquo;</p>
    </div>
  );

  return (
    <div className="mx-auto w-[210mm] max-w-full bg-white text-black px-[14mm] py-[10mm] print:w-auto print:p-0" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      {/* thead / tfoot repeat the letterhead and footer on every printed page */}
      <table className="w-full border-collapse">
        <thead><tr><td className="p-0">{letterhead}</td></tr></thead>
        <tfoot><tr><td className="p-0">{footer}</td></tr></tfoot>
        <tbody><tr><td className="p-0 align-top">
          {/* Title */}
          <div className="relative text-center mb-3">
            <p className="text-[12px] font-bold uppercase tracking-wide">Department of Ophthalmology</p>
            <h1 className="text-[20px] font-bold underline underline-offset-4 mt-1">Discharge Summary</h1>
            {h.fileNo && <p className="absolute right-0 top-0 text-[14px] font-semibold" style={{ fontFamily: "'Courier New', monospace" }}>{h.fileNo}</p>}
          </div>

          {/* Patient details */}
          <Heading>Patient Details</Heading>
          <div className="border-y border-gray-800 py-2 mb-3 grid grid-cols-[auto_1fr_auto_1fr] gap-x-4 gap-y-1.5 items-baseline">
            <Pair k="Name" v={h.patient.name} />
            <Pair k="Hospital No" v={h.patient.id} />
            <Pair k="Age / Sex" v={`${h.patient.age} Yrs / ${SEX[h.patient.sex] ?? h.patient.sex}`} />
            <Pair k="IP No" v={h.fileNo} />
            <Pair k="Admission Date" v={<LongDate s={h.admittedOn} />} />
            <Pair k="Discharge Date" v={<LongDate s={s.dischargeDate} />} />
            <Pair k="Admitted Under" v={`Dr. ${consultant}`} />
            <Pair k="Department" v="Ophthalmology" />
            <Pair k="Ward / Bed" v={[h.ward && `Ward ${h.ward}`, h.floor && `Floor ${h.floor}`].filter(Boolean).join(", ")} />
            <Pair k="Admission Type" v={admissionTypeText(h.type, h.typeOther)} />
            <Pair k="Discharge Type" v={`${dischargeTypeLabel(s.dischargeType)}${s.dischargeType === "REFERRED" && s.referredTo ? ` to ${s.referredTo}` : ""}`} />
          </div>

          <Section title="Treating Clinicians">
            <p>Dr. {consultant}{h.qualifications ? `, ${h.qualifications}` : ""}</p>
          </Section>

          <Section title="Diagnosis">
            {diagnoses.length === 0 ? <p className="text-gray-500">Nil</p> : (
              <ol className="list-decimal pl-5 font-bold text-[#1f2a5a]">
                {diagnoses.map((d, i) => <li key={i}>{d}</li>)}
              </ol>
            )}
          </Section>

          <Section title="Chief Complaints">
            <Para v={s.complaints} />
          </Section>

          <Section title="History">
            <Para v={s.history} />
            <p className="mt-1"><span className="font-semibold">Allergies:</span> {s.allergies || "Nil"}</p>
          </Section>

          <Section title="Examination on Admission">
            <p>Visual acuity: RE {s.findings.vaRe || "—"}, LE {s.findings.vaLe || "—"}</p>
            <p>IOP: RE {s.findings.iopRe || "—"}, LE {s.findings.iopLe || "—"}</p>
            {lines(s.findings.anterior).map((l, i) => <p key={`a${i}`}>{i === 0 ? "Anterior segment: " : ""}{l}</p>)}
            {lines(s.findings.posterior).map((l, i) => <p key={`p${i}`}>{i === 0 ? "Posterior segment: " : ""}{l}</p>)}
          </Section>

          <Section title="Investigations">
            <Para v={s.investigations} />
          </Section>

          {surgical && (
            <Section title="Surgery / Procedures Done">
              <table className="w-full border-collapse text-[12px] mb-1.5">
                <thead>
                  <tr className="bg-gray-100 [print-color-adjust:exact] [-webkit-print-color-adjust:exact]">
                    <th className={`${cell} w-[60%]`}>Surgery / Procedure Name</th>
                    <th className={cell}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={cell}>{[s.procedure.eye, s.procedure.name].filter(Boolean).join(" ") || "—"}</td>
                    <td className={cell}><LongDate s={s.procedure.date} /></td>
                  </tr>
                </tbody>
              </table>
              <p>Anaesthesia: {s.procedure.anaesthesia || "—"}</p>
              <p>Implant: {s.procedure.implant || "—"}</p>
              <p>Surgeon: {s.procedure.surgeon ? `Dr. ${s.procedure.surgeon.replace(/^Dr\.?\s*/i, "")}` : "—"}</p>
              <p>Intra-operative events: {s.procedure.events || "—"}</p>
            </Section>
          )}

          <Section title="Course in Hospital">
            <Para v={s.course} />
          </Section>

          <Section title="Condition at Discharge">
            <p>General condition: {s.condition.general || "—"}</p>
            <p>Visual acuity: RE {s.condition.vaRe || "—"}, LE {s.condition.vaLe || "—"}</p>
            <p>IOP: RE {s.condition.iopRe || "—"}, LE {s.condition.iopLe || "—"}</p>
            {s.condition.eye.trim() && <p>Operated / affected eye: {s.condition.eye}</p>}
          </Section>

          <Section title="Medications on Discharge">
            {s.meds.length === 0 ? <p className="text-gray-500">Nil</p> : (
              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr className="bg-gray-100 [print-color-adjust:exact] [-webkit-print-color-adjust:exact]">
                    {["S.No", "Medicine", "Dose", "Eye", "Frequency", "Duration"].map((x) => <th key={x} className={cell}>{x}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {s.meds.map((m, i) => (
                    <tr key={i}>
                      <td className={`${cell} w-10`}>{i + 1}</td>
                      <td className={`${cell} font-semibold`}>{m.name}</td>
                      <td className={cell}>{m.dose}</td>
                      <td className={cell}>{m.eye}</td>
                      <td className={cell}>{m.frequency}</td>
                      <td className={cell}>{m.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          <Section title="Advice on Discharge">
            <Para v={s.advice} />
            {lines(s.warning).length > 0 && (
              <div className="mt-2">
                {lines(s.warning).map((l, i) => <p key={i} className={i === 0 ? "font-bold" : ""}>{l}</p>)}
              </div>
            )}
          </Section>

          <Section title="Follow-up">
            <p>Review on <span className="font-semibold"><LongDate s={s.followUpDate} /></span>{s.followUpNote ? ` (${s.followUpNote})` : ""}</p>
          </Section>

          {/* Signatures */}
          <div className="mt-6 grid grid-cols-2 gap-10 break-inside-avoid text-[12px]">
            <div>
              {h.signed ? (
                <p className="text-[11px] text-gray-700">Signed electronically on {dateTime(h.signed.at)} (verified by OTP)</p>
              ) : (
                <p className="text-[11px] font-bold text-red-700">DRAFT, NOT YET SIGNED</p>
              )}
              <div className="mt-8 border-t border-gray-800 pt-1">
                <p className="font-bold">Dr. {h.signed?.by ?? consultant}</p>
                {h.qualifications && <p>{h.qualifications}</p>}
                {h.regNo && <p>Reg. No. {h.regNo}</p>}
                <p className="text-gray-600">Treating Consultant</p>
              </div>
            </div>
            <div className="self-end">
              <div className="border-t border-gray-800 pt-1">
                <p className="font-bold">Patient / Attendant</p>
                <p className="text-gray-600">I have received and understood the advice given.</p>
              </div>
            </div>
          </div>
        </td></tr></tbody>
      </table>
    </div>
  );
}
