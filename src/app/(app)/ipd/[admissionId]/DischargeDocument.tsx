// Printable discharge summary (A4). Pure markup, used by the print page.
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

const day = (s?: string | null) =>
  s ? new Date(s.length === 10 ? `${s}T00:00:00+05:30` : s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "—";
const dateTime = (s: string) =>
  new Date(s).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
const SEX: Record<string, string> = { MALE: "Male", FEMALE: "Female", OTHER: "Other" };

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 break-inside-avoid">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-teal-800 border-b border-teal-700/30 pb-0.5 mb-1.5">{n}. {title}</h3>
      <div className="text-[12px] leading-relaxed text-gray-800">{children}</div>
    </section>
  );
}
const Text = ({ v }: { v: string }) => (v.trim() ? <p className="whitespace-pre-line">{v}</p> : <p className="text-gray-400">—</p>);

export function DischargeDocument({ h, s }: { h: DischargeHeader; s: DischargeData }) {
  const surgical = !!(s.procedure.name || s.procedure.implant);
  let n = 0;
  const next = () => ++n;
  return (
    <article className="mx-auto w-full max-w-[210mm] bg-white text-gray-900 p-8 print:p-0">
      {/* Letterhead */}
      <header className="flex items-start justify-between gap-6 border-b-2 border-teal-800 pb-3">
        <div className="flex items-start gap-3">
          {h.logoUrl && <img src={fileHref(h.logoUrl) ?? h.logoUrl} alt="" className="h-14 w-14 object-contain" />}
          <div>
            <h1 className="text-xl font-bold text-teal-900 leading-tight">{h.hospital}</h1>
            {h.address && <p className="text-[11px] text-gray-600 mt-0.5">{h.address}</p>}
            {h.contact && <p className="text-[11px] text-gray-600">Contact: {h.contact}</p>}
          </div>
        </div>
        <div className="text-right text-[11px] text-gray-700">
          <p className="font-bold text-[13px] text-gray-900">Dr. {h.doctor}</p>
          {h.qualifications && <p>{h.qualifications}</p>}
          {h.regNo && <p>Reg. No. {h.regNo}</p>}
        </div>
      </header>

      <h2 className="text-center text-base font-extrabold tracking-[0.2em] text-gray-900 mt-3">DISCHARGE SUMMARY</h2>

      {/* 1. Patient & admission details */}
      <Section n={next()} title="Patient & admission details">
        <div className="grid grid-cols-2 gap-x-8 gap-y-0.5">
          <p><b>Name:</b> {h.patient.name}</p>
          <p><b>Age / Sex:</b> {h.patient.age} / {SEX[h.patient.sex] ?? h.patient.sex}</p>
          <p><b>Patient ID:</b> {h.patient.id}</p>
          <p><b>IP / File No.:</b> {h.fileNo || "—"}</p>
          <p><b>Ward / Floor:</b> {[h.ward, h.floor].filter(Boolean).join(" / ") || "—"}</p>
          <p><b>Consultant:</b> {s.consultant || h.doctor}</p>
          <p><b>Date of admission:</b> {day(h.admittedOn)}</p>
          <p><b>Date of discharge:</b> {day(s.dischargeDate)}</p>
          <p><b>Type of admission:</b> {admissionTypeText(h.type, h.typeOther)}</p>
          <p><b>Type of discharge:</b> {dischargeTypeLabel(s.dischargeType)}{s.dischargeType === "REFERRED" && s.referredTo ? ` to ${s.referredTo}` : ""}</p>
        </div>
      </Section>

      <Section n={next()} title="Diagnosis"><Text v={s.diagnosis} /></Section>
      <Section n={next()} title="Presenting complaints, history & allergies">
        <Text v={s.complaints} />
        {s.history.trim() && <p className="whitespace-pre-line mt-1">{s.history}</p>}
        <p className="mt-1"><b>Allergies:</b> {s.allergies || "—"}</p>
      </Section>
      <Section n={next()} title="Findings on admission">
        <table className="w-full text-[12px] border border-gray-300">
          <thead><tr className="bg-gray-50"><th className="border border-gray-300 px-2 py-0.5 text-left w-32"></th><th className="border border-gray-300 px-2 py-0.5 text-left">RE</th><th className="border border-gray-300 px-2 py-0.5 text-left">LE</th></tr></thead>
          <tbody>
            <tr><td className="border border-gray-300 px-2 py-0.5 font-semibold">Visual acuity</td><td className="border border-gray-300 px-2 py-0.5">{s.findings.vaRe || "—"}</td><td className="border border-gray-300 px-2 py-0.5">{s.findings.vaLe || "—"}</td></tr>
            <tr><td className="border border-gray-300 px-2 py-0.5 font-semibold">IOP</td><td className="border border-gray-300 px-2 py-0.5">{s.findings.iopRe || "—"}</td><td className="border border-gray-300 px-2 py-0.5">{s.findings.iopLe || "—"}</td></tr>
          </tbody>
        </table>
        {s.findings.anterior.trim() && <p className="whitespace-pre-line mt-1"><b>Anterior segment:</b> {s.findings.anterior}</p>}
        {s.findings.posterior.trim() && <p className="whitespace-pre-line mt-1"><b>Posterior segment:</b> {s.findings.posterior}</p>}
      </Section>
      <Section n={next()} title="Investigations"><Text v={s.investigations} /></Section>
      {surgical && (
        <Section n={next()} title="Procedure">
          <div className="grid grid-cols-2 gap-x-8 gap-y-0.5">
            <p><b>Surgery:</b> {[s.procedure.eye, s.procedure.name].filter(Boolean).join(" ") || "—"}</p>
            <p><b>Date:</b> {day(s.procedure.date)}</p>
            <p><b>Anaesthesia:</b> {s.procedure.anaesthesia || "—"}</p>
            <p><b>Implant:</b> {s.procedure.implant || "—"}</p>
            <p><b>Surgeon:</b> {s.procedure.surgeon || "—"}</p>
          </div>
          <p className="whitespace-pre-line mt-1"><b>Intra-operative events:</b> {s.procedure.events || "—"}</p>
        </Section>
      )}
      <Section n={next()} title="Course in hospital"><Text v={s.course} /></Section>
      <Section n={next()} title="Condition at discharge">
        <p><b>General condition:</b> {s.condition.general || "—"}</p>
        <p><b>Visual acuity:</b> RE {s.condition.vaRe || "—"} · LE {s.condition.vaLe || "—"}</p>
        <p><b>IOP:</b> RE {s.condition.iopRe || "—"} · LE {s.condition.iopLe || "—"}</p>
        {s.condition.eye.trim() && <p><b>Operated / affected eye:</b> {s.condition.eye}</p>}
      </Section>
      <Section n={next()} title="Medicines on discharge">
        {s.meds.length === 0 ? <p className="text-gray-400">—</p> : (
          <table className="w-full text-[12px] border border-gray-300">
            <thead><tr className="bg-gray-50">{["#", "Medicine", "Dose", "Eye", "Frequency", "Duration"].map((x) => <th key={x} className="border border-gray-300 px-2 py-0.5 text-left">{x}</th>)}</tr></thead>
            <tbody>
              {s.meds.map((m, i) => (
                <tr key={i}>
                  <td className="border border-gray-300 px-2 py-0.5">{i + 1}</td>
                  <td className="border border-gray-300 px-2 py-0.5 font-semibold">{m.name}</td>
                  <td className="border border-gray-300 px-2 py-0.5">{m.dose}</td>
                  <td className="border border-gray-300 px-2 py-0.5">{m.eye}</td>
                  <td className="border border-gray-300 px-2 py-0.5">{m.frequency}</td>
                  <td className="border border-gray-300 px-2 py-0.5">{m.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
      <Section n={next()} title="Advice">
        <Text v={s.advice} />
        {s.warning.trim() && <div className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1 whitespace-pre-line text-red-900">{s.warning}</div>}
      </Section>
      <Section n={next()} title="Follow-up">
        <p><b>Review on:</b> {day(s.followUpDate)}{s.followUpNote ? ` · ${s.followUpNote}` : ""}</p>
      </Section>

      {/* Signatures */}
      <section className="mt-8 grid grid-cols-2 gap-10 break-inside-avoid text-[11px]">
        <div>
          {h.signed ? (
            <div className="rounded border border-teal-700/40 bg-teal-50 px-3 py-2">
              <p className="font-bold text-teal-900">Signed electronically by Dr. {h.signed.by}</p>
              <p className="text-teal-800">{dateTime(h.signed.at)} · verified by OTP</p>
            </div>
          ) : (
            <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 font-semibold text-amber-800">DRAFT · not yet signed</p>
          )}
          <p className="mt-6 border-t border-gray-400 pt-1 text-gray-600">Consultant: Dr. {s.consultant || h.doctor}</p>
        </div>
        <div>
          <div className="h-[52px]" />
          <p className="mt-6 border-t border-gray-400 pt-1 text-gray-600">Patient / attendant: received and understood the advice</p>
        </div>
      </section>
      <p className="mt-6 text-center text-[10px] text-gray-400">This is a computer-generated discharge summary from {h.hospital}.</p>
    </article>
  );
}
