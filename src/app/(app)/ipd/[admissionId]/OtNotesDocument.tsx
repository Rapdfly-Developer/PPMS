// Printable OT notes (A4), in the same style as the discharge summary: the
// hospital letterhead, a patient band, an "at a glance" result panel, the
// operation times, the procedure steps and a signature line.
// Pure markup (no <header>/<nav>: the app's print styles hide those).
import { wardTypeText } from "@/lib/ipd";
import type { OtNotesCopy } from "@/lib/ot";
import { IpdPrintHeader } from "@/app/ipd-print/IpdPrintHeader";

export interface OtNotesHeader {
  hospital: string; address: string | null; contact: string | null; logoUrl: string | null; email: string | null;
  doctor: string; qualifications: string | null; regNo: string | null; specialty: string | null;
  patient: { name: string; age: number; sex: string; id: string; mobile: string | null };
  fileNo: string | null; ward: string | null; wardType: string | null; floor: string | null;
  admittedOn: string;
  saved: { by: string; at: string } | null;
}

const ACCENT = "#0f5f5c";
const TEXT = "#111111", RULE = "#404040", SHADE = "#D4D4D4", TINT = "#E6EFEE", ALERT = "#991B1B", WARN = "#92400E";
const exact = "[print-color-adjust:exact] [-webkit-print-color-adjust:exact]";
const SEX: Record<string, string> = { MALE: "Male", FEMALE: "Female", OTHER: "Other" };
const day = (s?: string | null) => (s ? new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "");
const time = (s?: string | null) => (s ? new Date(s).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }) : "-");
const dateTime = (s: string) => new Date(s).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
const dr = (n: string) => `Dr. ${n.replace(/^Dr\.?\s*/i, "")}`;
const mins = (a?: string | null, b?: string | null) => (a && b ? Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)) : null);
const has = (...v: (string | undefined | null)[]) => v.some((x) => x && x.trim());

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-2.5 break-inside-avoid">
      <h3 className={`pb-[2px] text-[10px] font-bold uppercase tracking-[0.12em] border-b-[1.5px] ${exact}`} style={{ color: ACCENT, borderColor: ACCENT }}>{title}</h3>
      <div className="pt-1.5 text-[11.5px] leading-[1.45] min-w-0">{children}</div>
    </section>
  );
}

export function OtNotesDocument({ h, n }: { h: OtNotesHeader; n: OtNotesCopy }) {
  const t = n.times ?? { shiftedToOt: null, begun: null, anaesthesia: null, ended: null, aborted: null };
  const opDay = t.begun ?? t.shiftedToOt;
  const procedure = [n.eye, n.procedure].filter(Boolean).join(" ");
  const duration = mins(t.begun, t.ended ?? t.aborted);

  const result =
    n.result === "ABORTED" ? { text: "Operation aborted", color: ALERT }
      : n.result === "EVENTFUL" ? { text: "Eventful", color: WARN }
        : { text: "Uneventful", color: ACCENT };

  const team: [string, string][] = ([
    ["Surgeon", n.surgeon && dr(n.surgeon)],
    ["Assistant", n.assistant],
    ["Anaesthetist", n.anaesthetist],
    ["Scrub nurse", n.scrubNurse],
  ] as [string, string][]).filter(([, v]) => has(v));

  const footer = (
    <div className="mt-3 flex items-center justify-between gap-4 border-t pt-1.5 text-[9.5px] font-medium" style={{ borderColor: RULE }}>
      <span>{h.patient.name} · {h.patient.id}{h.fileNo ? ` · ${/^ip/i.test(h.fileNo) ? h.fileNo : `IP ${h.fileNo}`}` : ""}</span>
      <span>Operation notes · {day(opDay)}</span>
    </div>
  );

  return (
    <div className="mx-auto w-[210mm] max-w-full bg-white px-[14mm] pt-0 pb-[10mm] print:w-auto print:py-0" style={{ fontFamily: "'Segoe UI', Arial, Helvetica, sans-serif", color: TEXT }}>
      <table className="w-full border-collapse">
        <tfoot><tr><td className="p-0">{footer}</td></tr></tfoot>
        <tbody><tr><td className="p-0 align-top">

          <IpdPrintHeader
            hospital={{ name: h.hospital, logoUrl: h.logoUrl, address: h.address, contact: h.contact, email: h.email }}
            doctor={n.surgeon || h.doctor}
            specialty={h.specialty}
            kicker="Operation Theatre"
            title="Operation Notes"
            dateText={`Operated ${day(opDay) || "-"}`}
            badge={<span className={`inline-block rounded border-[1.5px] bg-white px-2 py-[1px] text-[9px] font-bold ${exact}`} style={{ borderColor: result.color, color: result.color }}>{result.text.toUpperCase()}</span>}
            boxes={[
              ["Patient", h.patient.name],
              ["Age / Gender", `${h.patient.age} yrs / ${SEX[h.patient.sex] ?? h.patient.sex}`],
              ["Phone", h.patient.mobile ?? ""],
              ["Hospital No. / IP No.", [h.patient.id, h.fileNo].filter(Boolean).join(" / ")],
              ["Admitted", day(h.admittedOn)],
              ["Ward / Floor", [h.ward && `Ward ${h.ward}`, wardTypeText(h.wardType), h.floor && `Floor ${h.floor}`].filter(Boolean).join(", ")],
              ["Anaesthesia", n.anaesthesia],
              ["Implant", n.implant],
            ]}
          />

          {/* At a glance: procedure + result */}
          <div className={`border-l-[3px] break-inside-avoid px-3 py-2 ${exact}`} style={{ borderColor: result.color, background: TINT }}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <p className="text-[13px] font-bold">{procedure || "-"}{n.implant && !/^(none|nil|na|-)$/i.test(n.implant.trim()) ? <span className="font-semibold"> + {n.implant}</span> : null}</p>
              <p className="text-[11px] font-bold" style={{ color: result.color }}>{result.text}</p>
            </div>
            {n.result === "ABORTED" && n.abort && (
              <p className="mt-1 text-[11.5px]" style={{ color: ALERT }}>
                Aborted at <b>{dateTime(n.abort.at)}</b> at step <b>{n.abort.step || "-"}</b>. Reason: {n.abort.reason || "-"}.
              </p>
            )}
            {n.result === "EVENTFUL" && n.event && (
              <div className="mt-1 grid grid-cols-2 gap-x-6 gap-y-0.5 text-[11.5px]">
                <p><span className="font-semibold">Reason:</span> {n.event.reason || "-"}</p>
                <p><span className="font-semibold">At step:</span> {n.event.step || "-"}</p>
                <p><span className="font-semibold">Intra-op management:</span> {n.event.intraOp || "-"}</p>
                <p><span className="font-semibold">Post-op management:</span> {n.event.postOp || "-"}</p>
              </div>
            )}
          </div>

          {/* Times */}
          <Row title="Time line">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr>
                  {["Shifted to OT", "Operation begun", "Anaesthesia", t.aborted ? "Aborted" : "Operation ended", "Duration"].map((x) => (
                    <th key={x} className={`border-y px-2 py-[3px] text-left text-[9.5px] font-bold uppercase tracking-wider ${exact}`} style={{ borderColor: RULE, background: SHADE }}>{x}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {[time(t.shiftedToOt), time(t.begun), time(t.anaesthesia), time(t.aborted ?? t.ended), duration != null ? `${duration} min` : "-"].map((x, i) => (
                    <td key={i} className="border-b px-2 py-[3px] tabular-nums" style={{ borderColor: RULE }}>{x}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </Row>

          {team.length > 0 && (
            <Row title="Operating team">
              <div className="grid grid-cols-4 gap-x-4">
                {team.map(([k, v]) => <p key={k}><span className="font-semibold">{k}:</span> {v}</p>)}
              </div>
            </Row>
          )}

          {(n.steps ?? []).some((s) => s.trim()) && (
            <Row title="Procedure (step by step)">
              <ol className="space-y-0.5">
                {n.steps.filter((s) => s.trim()).map((s, i) => (
                  <li key={i} className="flex gap-2"><span className="w-5 shrink-0 text-right font-semibold tabular-nums">{i + 1}.</span><span>{s}</span></li>
                ))}
              </ol>
            </Row>
          )}

          {has(n.findings) && <Row title="Intra-operative findings"><p className="whitespace-pre-line">{n.findings}</p></Row>}
          {has(n.complications) && <Row title="Complications"><p className="whitespace-pre-line">{n.complications}</p></Row>}
          {has(n.instructions) && <Row title="Post-operative instructions"><p className="whitespace-pre-line">{n.instructions}</p></Row>}

          {/* Signature */}
          <div className="mt-6 grid grid-cols-2 gap-12 break-inside-avoid text-[11px]">
            <div>
              <div className="h-8" />
              <div className="border-t pt-1" style={{ borderColor: RULE }}>
                <p className="font-bold">{dr(n.surgeon || h.doctor)}</p>
                <p>{[h.qualifications, h.regNo && `Reg. ${h.regNo}`].filter(Boolean).join(" · ") || "Operating surgeon"}</p>
                {h.saved && <p className="mt-0.5 text-[10px]">Notes saved by {h.saved.by} · {dateTime(h.saved.at)}</p>}
              </div>
            </div>
            <div>
              <div className="h-8" />
              <div className="border-t pt-1" style={{ borderColor: RULE }}>
                <p className="font-bold">Anaesthetist</p>
                <p>{n.anaesthetist || " "}</p>
              </div>
            </div>
          </div>
        </td></tr></tbody>
      </table>
    </div>
  );
}
