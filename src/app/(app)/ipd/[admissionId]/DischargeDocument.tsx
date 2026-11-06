// Printable discharge summary (A4): a compact clinical report. Key facts sit in
// an "at a glance" panel; each section has a full-width ruled heading; empty
// sections are left out. Dark inks and solid rules so it prints clearly.
// Pure markup (no <header>/<nav>: the app's print styles hide those).
import { admissionTypeText, dischargeTypeLabel, wardTypeText, type DischargeData } from "@/lib/ipd";
import { IpdPrintHeader } from "@/app/ipd-print/IpdPrintHeader";

export interface DischargeHeader {
  hospital: string; address: string | null; contact: string | null; logoUrl: string | null; email?: string | null;
  doctor: string; qualifications: string | null; regNo: string | null; specialty?: string | null;
  patient: { name: string; age: number; sex: string; id: string; mobile?: string | null };
  fileNo: string | null; ward: string | null; wardType?: string | null; floor: string | null;
  type: string; typeOther: string | null;
  admittedOn: string;
  signed: { by: string; at: string } | null;
}

const ACCENT = "#0f5f5c";
const TEXT = "#111111", RULE = "#404040", SHADE = "#D4D4D4", TINT = "#E6EFEE", ALERT = "#991B1B";
const exact = "[print-color-adjust:exact] [-webkit-print-color-adjust:exact]";
const day = (s?: string | null) =>
  s ? new Date(s.length === 10 ? `${s}T00:00:00+05:30` : s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "";
const dateTime = (s: string) =>
  new Date(s).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
const SEX: Record<string, string> = { MALE: "Male", FEMALE: "Female", OTHER: "Other" };
const lines = (v: string) => v.split("\n").map((l) => l.replace(/^[•\-*]\s*/, "").trim()).filter(Boolean);
const has = (...v: string[]) => v.some((x) => x && x.trim());
const dr = (n: string) => `Dr. ${n.replace(/^Dr\.?\s*/i, "")}`;

/** Section: full-width ruled heading, content below. */
function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-2.5 break-inside-avoid">
      <h3 className={`pb-[2px] text-[10px] font-bold uppercase tracking-[0.12em] border-b-[1.5px] ${exact}`}
        style={{ color: ACCENT, borderColor: ACCENT }}>{title}</h3>
      <div className="pt-1.5 text-[11.5px] leading-[1.45] min-w-0">{children}</div>
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold">{children}</span>;
}

function Lines({ v }: { v: string }) {
  return <>{lines(v).map((l, i) => <p key={i}>{l}</p>)}</>;
}

function Bullets({ v }: { v: string }) {
  return (
    <ul className="space-y-0.5">
      {lines(v).map((l, i) => (
        <li key={i} className="flex gap-2"><span className={`mt-[6px] h-1 w-1 shrink-0 rounded-full ${exact}`} style={{ background: TEXT }} /><span>{l}</span></li>
      ))}
    </ul>
  );
}

const thCls = `border-y px-2 py-[3px] text-left text-[9.5px] font-bold uppercase tracking-wider ${exact}`;
const tdCls = "border-b px-2 py-[3px] align-top";

/** Ruled table with a shaded header row. */
function Grid({ head, rows, widths }: { head: string[]; rows: React.ReactNode[][]; widths: string[] }) {
  return (
    <table className="w-full border-collapse text-[11.5px]">
      <colgroup>{widths.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
      <thead>
        <tr>{head.map((x, i) => <th key={i} className={thCls} style={{ borderColor: RULE, background: SHADE }}>{x}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={tdCls} style={{ borderColor: RULE }}>{c}</td>)}</tr>)}
      </tbody>
    </table>
  );
}

export function DischargeDocument({ h, s }: { h: DischargeHeader; s: DischargeData }) {
  const surgical = has(s.procedure.name, s.procedure.implant);
  const diagnoses = lines(s.diagnosis);
  const consultant = s.consultant || h.doctor;
  const procedure = [s.procedure.eye, s.procedure.name].filter(Boolean).join(" ");

  // Vision and IOP, on admission and at discharge, in one table
  const eyeRows = ([
    ["Vision on admission", s.findings.vaRe, s.findings.vaLe],
    ["IOP on admission", s.findings.iopRe, s.findings.iopLe],
    ["Vision at discharge", s.condition.vaRe, s.condition.vaLe],
    ["IOP at discharge", s.condition.iopRe, s.condition.iopLe],
  ] as [string, string, string][]).filter(([, re, le]) => has(re, le));

  const tag = (text: string, color: string) => (
    <span className={`inline-block rounded border-[1.5px] bg-white px-2 py-[1px] text-[9px] font-bold ${exact}`} style={{ borderColor: color, color }}>{text}</span>
  );
  const badge = h.signed ? tag("SIGNED · OTP VERIFIED", ACCENT) : tag("DRAFT · NOT SIGNED", "#92400E");

  const glance: [string, string][] = [
    surgical
      ? ["Procedure", `${procedure}${s.procedure.date ? `, ${day(s.procedure.date)}` : ""}`]
      : ["Admission", admissionTypeText(h.type, h.typeOther)],
    ["Condition at discharge", s.condition.general],
    ["Discharge", `${dischargeTypeLabel(s.dischargeType)}${s.dischargeType === "REFERRED" && s.referredTo ? ` to ${s.referredTo}` : ""}`],
  ];

  const footer = (
    <div className="mt-3 flex items-center justify-between gap-4 border-t pt-1.5 text-[9.5px] font-medium" style={{ borderColor: RULE }}>
      <span>{h.patient.name} · {h.patient.id}{h.fileNo ? ` · ${/^ip/i.test(h.fileNo) ? h.fileNo : `IP ${h.fileNo}`}` : ""}</span>
      {h.contact && <span className={`rounded px-2 py-0.5 font-bold text-white ${exact}`} style={{ background: ACCENT }}>Emergency: {h.contact}</span>}
      <span>Please bring this summary to every follow-up visit</span>
    </div>
  );

  return (
    <div className="mx-auto w-[210mm] max-w-full bg-white px-[14mm] pt-0 pb-[10mm] print:w-auto print:py-0" style={{ fontFamily: "'Segoe UI', Arial, Helvetica, sans-serif", color: TEXT }}>
      <table className="w-full border-collapse">

        <tfoot><tr><td className="p-0">{footer}</td></tr></tfoot>
        <tbody><tr><td className="p-0 align-top">

          <IpdPrintHeader
            hospital={{ name: h.hospital, logoUrl: h.logoUrl, address: h.address, contact: h.contact, email: h.email ?? null }}
            doctor={consultant}
            specialty={h.specialty ?? null}
            kicker="Clinical Report"
            title="Discharge Summary"
            dateText={`Discharged ${day(s.dischargeDate) || "-"}`}
            badge={badge}
            boxes={[
              ["Patient", h.patient.name],
              ["Age / Gender", `${h.patient.age} yrs / ${SEX[h.patient.sex] ?? h.patient.sex}`],
              ["Phone", h.patient.mobile ?? ""],
              ["Hospital No. / IP No.", [h.patient.id, h.fileNo].filter(Boolean).join(" / ")],
              ["Admitted", day(h.admittedOn)],
              ["Discharged", day(s.dischargeDate)],
              ["Ward / Floor", [h.ward && `Ward ${h.ward}`, wardTypeText(h.wardType), h.floor && `Floor ${h.floor}`].filter(Boolean).join(", ")],
              ["Admission", admissionTypeText(h.type, h.typeOther)],
            ]}
          />

          {/* At a glance */}
          <div className={`border-l-[3px] break-inside-avoid ${exact}`} style={{ borderColor: ACCENT, background: TINT }}>
            <div className="px-3 pt-1.5 pb-1">
              <p className="text-[9.5px] font-bold uppercase tracking-[0.1em]" style={{ color: ACCENT }}>Diagnosis</p>
              {diagnoses.length
                ? diagnoses.map((d, i) => <p key={i} className="text-[12.5px] font-bold leading-snug">{d}</p>)
                : <p className="text-[12px]">-</p>}
            </div>
            <div className="mt-1 grid grid-cols-3 gap-4 px-3 pb-1.5 text-[11px]">
              {glance.map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-wider">{k}</p>
                  <p className="font-semibold leading-snug">{v || "-"}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Clinical sections (empty ones are left out) */}
          {has(s.complaints) && <Row title="Presenting complaints"><Lines v={s.complaints} /></Row>}
          {has(s.history, s.allergies) && (
            <Row title="History">
              {has(s.history) && <Lines v={s.history} />}
              <p><Label>Allergies: </Label>{s.allergies || "None known"}</p>
            </Row>
          )}
          {(eyeRows.length > 0 || has(s.findings.anterior, s.findings.posterior, s.condition.eye)) && (
            <Row title="Examination">
              {eyeRows.length > 0 && (
                <div className="mb-1">
                  <Grid head={["", "Right eye (RE)", "Left eye (LE)"]} widths={["40%", "30%", "30%"]}
                    rows={eyeRows.map(([k, re, le]) => [<span key="k" className="font-semibold">{k}</span>, re || "-", le || "-"])} />
                </div>
              )}
              {has(s.findings.anterior) && <p><Label>Anterior segment (on admission): </Label>{lines(s.findings.anterior).join("; ")}</p>}
              {has(s.findings.posterior) && <p><Label>Posterior segment (on admission): </Label>{lines(s.findings.posterior).join("; ")}</p>}
              {has(s.condition.eye) && <p><Label>Operated / affected eye at discharge: </Label>{s.condition.eye}</p>}
            </Row>
          )}
          {((s.invList?.length ?? 0) > 0 || has(s.investigations)) && (
            <Row title="Investigations">
              {s.invList && s.invList.length > 0 && (
                <Grid head={["Investigation", "Eye", "Done on", "Report"]} widths={["46%", "10%", "20%", "24%"]}
                  rows={s.invList.map((r) => [
                    <span key="t" className="font-semibold">{r.test}</span>, r.eye || "-", day(r.ordered) || "-",
                    r.received ? `Received ${day(r.received)}` : <span key="p" className="font-bold">Pending</span>,
                  ])} />
              )}
              {has(s.investigations) && (s.invList?.length
                ? <p className="mt-1"><Label>Key findings: </Label>{lines(s.investigations).join("; ")}</p>
                : <Bullets v={s.investigations} />)}
            </Row>
          )}
          {surgical && (
            <Row title="Procedure">
              <Grid head={["Procedure", "Date", "Anaesthesia", "Implant", "Surgeon"]} widths={["30%", "14%", "18%", "20%", "18%"]}
                rows={[[
                  <span key="p" className="font-semibold">{procedure || "-"}</span>, day(s.procedure.date) || "-",
                  s.procedure.anaesthesia || "-", s.procedure.implant || "-", s.procedure.surgeon ? dr(s.procedure.surgeon) : "-",
                ]]} />
              {has(s.procedure.events) && <p className="mt-1"><Label>Intra-operative: </Label>{s.procedure.events}</p>}
            </Row>
          )}
          {has(s.course) && <Row title="Course in hospital"><Lines v={s.course} /></Row>}

          <Row title="Medicines on discharge">
            {s.meds.length === 0 ? <p>No medicines prescribed.</p> : (
              <Grid head={["#", "Medicine", "Dose", "Eye", "How often", "For"]} widths={["5%", "35%", "13%", "8%", "22%", "17%"]}
                rows={s.meds.map((m, i) => [
                  i + 1, <span key="n" className="font-semibold">{m.name}</span>, m.dose,
                  <span key="e" className="font-semibold">{m.eye}</span>, m.frequency, m.duration,
                ])} />
            )}
          </Row>

          {has(s.advice) && <Row title="Advice"><Bullets v={s.advice} /></Row>}

          {(has(s.warning) || s.followUpDate) && (
            <div className={`mt-2.5 grid gap-3 break-inside-avoid ${has(s.warning) && s.followUpDate ? "grid-cols-[1fr_auto]" : "grid-cols-1"}`}>
              {has(s.warning) ? (
                <div className={`border-[1.5px] px-2.5 py-1.5 ${exact}`} style={{ borderColor: ALERT }}>
                  <p className="mb-0.5 text-[9.5px] font-bold uppercase tracking-[0.1em]" style={{ color: ALERT }}>Come back immediately if</p>
                  <ul className="space-y-0.5 text-[11px] leading-[1.45]">
                    {lines(s.warning).filter((l) => !/^return to the hospital/i.test(l)).map((l, i) => <li key={i}>• {l}</li>)}
                  </ul>
                </div>
              ) : null}
              {s.followUpDate && (
                <div className={`self-start justify-self-end px-4 py-1.5 text-center ${exact}`} style={{ background: ACCENT }}>
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white">Next review</p>
                  <p className="text-[14px] font-bold leading-tight text-white">{day(s.followUpDate)}</p>
                  {s.followUpNote && <p className="text-[10px] text-white">{s.followUpNote}</p>}
                </div>
              )}
            </div>
          )}

          {/* Signatures */}
          <div className="mt-6 grid grid-cols-2 gap-12 break-inside-avoid text-[11px]">
            <div>
              <div className="h-8" />
              <div className="border-t pt-1" style={{ borderColor: RULE }}>
                <p className="font-bold">{dr(h.signed?.by ?? consultant)}</p>
                <p>{[h.qualifications, h.regNo && `Reg. ${h.regNo}`].filter(Boolean).join(" · ") || "Treating consultant"}</p>
                {h.signed && <p className="mt-0.5 text-[10px] font-semibold" style={{ color: ACCENT }}>Signed electronically, verified by OTP · {dateTime(h.signed.at)}</p>}
              </div>
            </div>
            <div>
              <div className="h-8" />
              <div className="border-t pt-1" style={{ borderColor: RULE }}>
                <p className="font-bold">Patient / attendant</p>
                <p>I have received and understood the advice.</p>
              </div>
            </div>
          </div>
        </td></tr></tbody>
      </table>
    </div>
  );
}
