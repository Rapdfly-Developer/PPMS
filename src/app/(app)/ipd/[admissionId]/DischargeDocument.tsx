// Printable discharge summary (A4): a clean clinical report. Key facts sit in
// an "at a glance" panel; each section has its title in a left margin; empty
// sections are left out. Pure markup (no <header>/<nav>: the app's print
// styles hide those).
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

const ACCENT = "#0f5f5c";
const exact = "[print-color-adjust:exact] [-webkit-print-color-adjust:exact]";
const day = (s?: string | null) =>
  s ? new Date(s.length === 10 ? `${s}T00:00:00+05:30` : s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "";
const dateTime = (s: string) =>
  new Date(s).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
const SEX: Record<string, string> = { MALE: "Male", FEMALE: "Female", OTHER: "Other" };
const lines = (v: string) => v.split("\n").map((l) => l.replace(/^[•\-*]\s*/, "").trim()).filter(Boolean);
const has = (...v: string[]) => v.some((x) => x && x.trim());
const dr = (n: string) => `Dr. ${n.replace(/^Dr\.?\s*/i, "")}`;

/** Section: title in the left margin, content on the right, hairline above. */
function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-[38mm_1fr] gap-5 border-t border-gray-200 py-3 break-inside-avoid">
      <h3 className="pt-[1px] text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500">{title}</h3>
      <div className="text-[12px] leading-[1.6] text-gray-900 min-w-0">{children}</div>
    </section>
  );
}

function Lines({ v }: { v: string }) {
  return <>{lines(v).map((l, i) => <p key={i}>{l}</p>)}</>;
}

function Bullets({ v }: { v: string }) {
  return (
    <ul className="space-y-0.5">
      {lines(v).map((l, i) => (
        <li key={i} className="flex gap-2"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-gray-500" /><span>{l}</span></li>
      ))}
    </ul>
  );
}

/** RE / LE mini-table for vision and eye pressure. */
function EyeTable({ rows }: { rows: [string, string, string][] }) {
  const shown = rows.filter(([, re, le]) => has(re, le));
  if (!shown.length) return null;
  return (
    <table className="text-[12px] border-collapse">
      <thead>
        <tr className="text-[10px] uppercase tracking-wider text-gray-500">
          <th className="pr-6 pb-1 text-left font-semibold" />
          <th className="pr-8 pb-1 text-left font-semibold">Right eye</th>
          <th className="pb-1 text-left font-semibold">Left eye</th>
        </tr>
      </thead>
      <tbody>
        {shown.map(([k, re, le]) => (
          <tr key={k}>
            <td className="pr-6 py-0.5 text-gray-500">{k}</td>
            <td className="pr-8 py-0.5 font-semibold">{re || "—"}</td>
            <td className="py-0.5 font-semibold">{le || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-gray-500">{label}</p>
      <p className="text-[12px] font-semibold text-gray-900 leading-snug">{children || "—"}</p>
    </div>
  );
}

export function DischargeDocument({ h, s }: { h: DischargeHeader; s: DischargeData }) {
  const surgical = has(s.procedure.name, s.procedure.implant);
  const diagnoses = lines(s.diagnosis);
  const consultant = s.consultant || h.doctor;
  const procedure = [s.procedure.eye, s.procedure.name].filter(Boolean).join(" ");

  const letterhead = (
    <div className="flex items-center justify-between gap-6 pb-3">
      <div className="flex items-center gap-3">
        {h.logoUrl && <img src={fileHref(h.logoUrl) ?? h.logoUrl} alt="" className="h-12 max-w-[120px] object-contain" />}
        <div className="leading-tight">
          <p className="text-[15px] font-bold" style={{ color: ACCENT }}>{h.hospital}</p>
          <p className="text-[10.5px] text-gray-500">{[h.address, h.contact && `Ph ${h.contact}`].filter(Boolean).join("  ·  ")}</p>
        </div>
      </div>
      <div className="text-right leading-tight">
        <p className="text-[12px] font-bold text-gray-900">{dr(h.doctor)}</p>
        <p className="text-[10.5px] text-gray-500">{[h.qualifications, h.regNo && `Reg. ${h.regNo}`].filter(Boolean).join("  ·  ") || "Ophthalmology"}</p>
      </div>
    </div>
  );

  const footer = (
    <div className="mt-4 flex items-center justify-between gap-4 border-t border-gray-200 pt-2 text-[9.5px] text-gray-500">
      <span>{h.patient.name} · {h.patient.id}{h.fileNo ? ` · IP ${h.fileNo}` : ""}</span>
      {h.contact && <span className={`rounded-full px-2.5 py-0.5 font-semibold text-white ${exact}`} style={{ background: ACCENT }}>Emergency: {h.contact}</span>}
      <span>Please bring this summary to every follow-up visit</span>
    </div>
  );

  return (
    <div className="mx-auto w-[210mm] max-w-full bg-white text-gray-900 px-[16mm] py-[12mm] print:w-auto print:p-0" style={{ fontFamily: "'Segoe UI', Arial, Helvetica, sans-serif" }}>
      <table className="w-full border-collapse">
        <thead><tr><td className="p-0">{letterhead}<div className={`h-[3px] rounded-full ${exact}`} style={{ background: ACCENT }} /></td></tr></thead>
        <tfoot><tr><td className="p-0">{footer}</td></tr></tfoot>
        <tbody><tr><td className="p-0 align-top">

          {/* Title + status */}
          <div className="flex items-end justify-between gap-4 mt-5 mb-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">Department of Ophthalmology</p>
              <h1 className="text-[24px] font-light tracking-tight text-gray-900 leading-tight">Discharge Summary</h1>
            </div>
            {h.signed
              ? <span className={`rounded-full border px-3 py-1 text-[10.5px] font-semibold ${exact}`} style={{ borderColor: ACCENT, color: ACCENT }}>Signed {dateTime(h.signed.at)}</span>
              : <span className={`rounded-full border border-amber-400 bg-amber-50 px-3 py-1 text-[10.5px] font-bold text-amber-700 ${exact}`}>DRAFT · NOT SIGNED</span>}
          </div>

          {/* Patient strip */}
          <div className={`grid grid-cols-4 gap-x-6 gap-y-3 rounded-lg bg-gray-50 px-4 py-3 ${exact}`}>
            <Fact label="Patient">{h.patient.name}</Fact>
            <Fact label="Age / Sex">{h.patient.age} yrs · {SEX[h.patient.sex] ?? h.patient.sex}</Fact>
            <Fact label="Hospital No.">{h.patient.id}</Fact>
            <Fact label="IP No.">{h.fileNo}</Fact>
            <Fact label="Admitted">{day(h.admittedOn)}</Fact>
            <Fact label="Discharged">{day(s.dischargeDate)}</Fact>
            <Fact label="Ward">{[h.ward && `Ward ${h.ward}`, h.floor && `Floor ${h.floor}`].filter(Boolean).join(", ")}</Fact>
            <Fact label="Consultant">{dr(consultant)}</Fact>
          </div>

          {/* At a glance */}
          <div className={`mt-4 mb-2 rounded-lg border-l-[3px] px-4 py-3 ${exact}`} style={{ borderColor: ACCENT, background: "#f0f7f6" }}>
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em]" style={{ color: ACCENT }}>Diagnosis</p>
            {diagnoses.length
              ? diagnoses.map((d, i) => <p key={i} className="text-[14px] font-semibold text-gray-900 leading-snug">{d}</p>)
              : <p className="text-[13px] text-gray-500">—</p>}
            <div className="mt-2.5 grid grid-cols-3 gap-6">
              {surgical
                ? <Fact label="Procedure">{procedure}{s.procedure.date ? `, ${day(s.procedure.date)}` : ""}</Fact>
                : <Fact label="Admission">{admissionTypeText(h.type, h.typeOther)}</Fact>}
              <Fact label="Condition at discharge">{s.condition.general}</Fact>
              <Fact label="Discharge">{dischargeTypeLabel(s.dischargeType)}{s.dischargeType === "REFERRED" && s.referredTo ? ` to ${s.referredTo}` : ""}</Fact>
            </div>
          </div>

          {/* Clinical sections (empty ones are left out) */}
          {has(s.complaints) && <Row title="Presenting complaints"><Lines v={s.complaints} /></Row>}
          {has(s.history, s.allergies) && (
            <Row title="History">
              {has(s.history) && <Lines v={s.history} />}
              <p className={has(s.history) ? "mt-1" : ""}><span className="text-gray-500">Allergies: </span><span className="font-semibold">{s.allergies || "None known"}</span></p>
            </Row>
          )}
          {has(s.findings.vaRe, s.findings.vaLe, s.findings.iopRe, s.findings.iopLe, s.findings.anterior, s.findings.posterior) && (
            <Row title="On admission">
              <EyeTable rows={[["Vision", s.findings.vaRe, s.findings.vaLe], ["IOP", s.findings.iopRe, s.findings.iopLe]]} />
              {has(s.findings.anterior) && <div className="mt-1.5"><span className="text-gray-500">Anterior segment </span><Lines v={s.findings.anterior} /></div>}
              {has(s.findings.posterior) && <div className="mt-1.5"><span className="text-gray-500">Posterior segment </span><Lines v={s.findings.posterior} /></div>}
            </Row>
          )}
          {has(s.investigations) && <Row title="Investigations"><Bullets v={s.investigations} /></Row>}
          {surgical && (
            <Row title="Procedure">
              <p className="font-semibold">{procedure || "—"}{s.procedure.date ? <span className="font-normal text-gray-500"> · {day(s.procedure.date)}</span> : null}</p>
              <div className="mt-1 grid grid-cols-3 gap-4">
                <Fact label="Anaesthesia">{s.procedure.anaesthesia}</Fact>
                <Fact label="Implant">{s.procedure.implant}</Fact>
                <Fact label="Surgeon">{s.procedure.surgeon ? dr(s.procedure.surgeon) : ""}</Fact>
              </div>
              {has(s.procedure.events) && <p className="mt-1.5"><span className="text-gray-500">Intra-operative: </span>{s.procedure.events}</p>}
            </Row>
          )}
          {has(s.course) && <Row title="Course in hospital"><Lines v={s.course} /></Row>}
          <Row title="At discharge">
            <p className="mb-1"><span className="text-gray-500">General condition: </span><span className="font-semibold">{s.condition.general || "—"}</span></p>
            <EyeTable rows={[["Vision", s.condition.vaRe, s.condition.vaLe], ["IOP", s.condition.iopRe, s.condition.iopLe]]} />
            {has(s.condition.eye) && <p className="mt-1"><span className="text-gray-500">Operated / affected eye: </span>{s.condition.eye}</p>}
          </Row>

          <Row title="Medicines">
            {s.meds.length === 0 ? <p className="text-gray-500">No medicines prescribed.</p> : (
              <table className="w-full text-[12px] border-collapse">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-gray-500 border-b border-gray-300">
                    {["Medicine", "Dose", "Eye", "How often", "For"].map((x) => <th key={x} className="py-1 pr-3 text-left font-semibold">{x}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {s.meds.map((m, i) => (
                    <tr key={i} className="border-b border-gray-100 last:border-0">
                      <td className="py-1.5 pr-3 font-semibold">{m.name}</td>
                      <td className="py-1.5 pr-3">{m.dose}</td>
                      <td className="py-1.5 pr-3 font-semibold">{m.eye}</td>
                      <td className="py-1.5 pr-3">{m.frequency}</td>
                      <td className="py-1.5">{m.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Row>

          {has(s.advice) && <Row title="Advice"><Bullets v={s.advice} /></Row>}

          {(has(s.warning) || s.followUpDate) && (
            <div className="grid grid-cols-[1fr_auto] gap-4 border-t border-gray-200 pt-3 break-inside-avoid">
              {has(s.warning) ? (
                <div className={`rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 ${exact}`}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-red-700 mb-1">Come back immediately if</p>
                  <ul className="text-[11.5px] leading-[1.55] text-red-900 space-y-0.5">
                    {lines(s.warning).filter((l) => !/^return to the hospital/i.test(l)).map((l, i) => <li key={i}>• {l}</li>)}
                  </ul>
                </div>
              ) : <div />}
              {s.followUpDate && (
                <div className={`rounded-lg px-5 py-3 text-center self-start ${exact}`} style={{ background: ACCENT }}>
                  <p className="text-[9.5px] font-semibold uppercase tracking-[0.15em] text-white/80">Next review</p>
                  <p className="text-[17px] font-bold text-white leading-tight">{day(s.followUpDate)}</p>
                  {s.followUpNote && <p className="text-[10.5px] text-white/85">{s.followUpNote}</p>}
                </div>
              )}
            </div>
          )}

          {/* Signatures */}
          <div className="mt-8 grid grid-cols-2 gap-16 break-inside-avoid text-[11.5px]">
            <div>
              <div className="h-10" />
              <div className="border-t border-gray-400 pt-1.5">
                <p className="font-bold">{dr(h.signed?.by ?? consultant)}</p>
                <p className="text-gray-500">{[h.qualifications, h.regNo && `Reg. ${h.regNo}`].filter(Boolean).join(" · ") || "Treating consultant"}</p>
                {h.signed && <p className="text-[10px] mt-0.5" style={{ color: ACCENT }}>Signed electronically, verified by OTP · {dateTime(h.signed.at)}</p>}
              </div>
            </div>
            <div>
              <div className="h-10" />
              <div className="border-t border-gray-400 pt-1.5">
                <p className="font-bold">Patient / attendant</p>
                <p className="text-gray-500">I have received and understood the advice.</p>
              </div>
            </div>
          </div>
        </td></tr></tbody>
      </table>
    </div>
  );
}
