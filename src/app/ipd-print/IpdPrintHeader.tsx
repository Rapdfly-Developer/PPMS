// Print header for IPD documents, matching the EMR print summaries
// (lib/pdf.ts): brand accent line, tinted header band with the logo card and
// hospital details, the document title in the centre, the doctor and date on
// the right, then a strip of boxed patient details. No <header> element: the
// app's print styles hide those.
import { fileHref } from "@/lib/file-href";

const INK = "#0B3D3A", LABEL_C = "#115E59", BRAND = "#157A73", MINT = "#2BA89C";
const exact = { printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" } as React.CSSProperties;

export interface PrintHospital { name: string; logoUrl: string | null; address: string | null; contact: string | null; email: string | null }

export function IpdPrintHeader({ hospital, doctor, specialty, title, kicker, dateText, boxes }: {
  hospital: PrintHospital; doctor: string; specialty: string | null; title: string; kicker: string; dateText: string;
  boxes: [string, string][];
}) {
  const logo = hospital.logoUrl ? (fileHref(hospital.logoUrl) ?? hospital.logoUrl) : null;
  return (
    <div style={{ fontFamily: "Inter, Arial, Helvetica, sans-serif" }}>
      {/* Brand accent line */}
      <div style={{ height: 4, background: `linear-gradient(90deg,${INK} 0%,${BRAND} 50%,${MINT} 100%)`, ...exact }} />

      {/* Header band */}
      <div style={{ padding: "11px 14px 13px", background: "linear-gradient(135deg,#F7FCFB 0%,#E8F5F2 55%,#F2FAF8 100%)", ...exact }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "flex-start", gap: 18 }}>
          {/* Left: logo card + hospital */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
            {logo ? (
              <div style={{ background: "#fff", border: "1.5px solid #B8DED7", borderRadius: 10, padding: 5, flexShrink: 0, boxShadow: "0 1px 6px rgba(21,122,115,0.12)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logo} alt="Logo" style={{ width: 44, height: 44, objectFit: "contain", display: "block", borderRadius: 6 }} />
              </div>
            ) : (
              <div style={{ background: "linear-gradient(135deg,#F0F8F6,#DCEFEC)", border: "1.5px solid #B8DED7", borderRadius: 10, width: 54, height: 54, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: BRAND, fontSize: 24, fontWeight: 900, ...exact }}>✚</div>
            )}
            <div style={{ minWidth: 0, paddingTop: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: INK, letterSpacing: "-0.2px", lineHeight: 1.1 }}>{hospital.name}</div>
              <div style={{ fontSize: 8, fontWeight: 600, color: BRAND, marginTop: 3, letterSpacing: "0.06em", textTransform: "uppercase" }}>Ophthalmology &amp; Eye Care</div>
              {(hospital.address || hospital.contact || hospital.email) && (
                <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 2, fontSize: 7.5, color: "#4A5A57" }}>
                  {hospital.address && <div style={{ display: "flex", gap: 3 }}><span style={{ color: BRAND }}>●</span>{hospital.address}</div>}
                  {(hospital.contact || hospital.email) && (
                    <div style={{ display: "flex", gap: 3 }}>
                      <span style={{ color: BRAND }}>●</span>
                      {hospital.contact && <span>{hospital.contact}</span>}
                      {hospital.contact && hospital.email && <span style={{ color: "#B8CFCA", padding: "0 4px" }}>|</span>}
                      {hospital.email && <span>{hospital.email}</span>}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Centre: document title */}
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 4 }}>
            <div style={{ fontSize: 6.5, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: MINT, marginBottom: 5 }}>{kicker}</div>
            <div style={{ fontSize: 8.5, fontWeight: 900, color: INK, letterSpacing: "0.07em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{title}</div>
            <div style={{ height: 2, width: "100%", background: `linear-gradient(90deg,transparent,${BRAND},${MINT})`, borderRadius: 1, marginTop: 6, ...exact }} />
          </div>

          {/* Right: doctor + date */}
          <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", paddingTop: 2, paddingRight: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: INK, lineHeight: 1.2 }}>Dr. {doctor.replace(/^Dr\.?\s*/i, "")}</div>
            <div style={{ fontSize: 9, color: BRAND, fontWeight: 600, marginTop: 2 }}>{specialty || "Consultant Ophthalmologist"}</div>
            <div style={{ fontSize: 8.5, color: "#4A5A57", marginTop: 4 }}>{dateText}</div>
          </div>
        </div>
      </div>

      {/* Soft divider */}
      <div style={{ height: 1, background: "linear-gradient(90deg,#DCEFEC,#B8DED7,#DCEFEC)", marginBottom: 10, ...exact }} />

      {/* Patient detail strip (boxes, four per row) */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
        <tbody>
          {Array.from({ length: Math.ceil(boxes.length / 4) }, (_, r) => (
            <tr key={r}>
              {boxes.slice(r * 4, r * 4 + 4).map(([label, value]) => (
                <td key={label} style={{ paddingRight: 10, paddingBottom: 6, verticalAlign: "top", width: "25%" }}>
                  <div style={{ background: "#fff", border: `1.5px solid ${MINT}`, borderRadius: 5, padding: "4px 9px 5px", minHeight: 26 }}>
                    <div style={{ fontSize: 7.5, fontWeight: 700, color: LABEL_C, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 1 }}>{label}</div>
                    <div style={{ fontSize: 9.5, color: "#111", fontWeight: 500 }}>{value || "—"}</div>
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
