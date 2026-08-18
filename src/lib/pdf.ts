import { format as formatBase } from "date-fns";
import { toISTWall } from "@/lib/ist";
import QRCode from "qrcode";

// All timestamps in generated PDFs are Indian wall-clock times; production runs on UTC.
const format = (d: Date | number, fmt: string) => formatBase(toISTWall(new Date(d)), fmt);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function val(v: unknown, fallback = "—") {
  if (v === null || v === undefined || v === "") return escapeHtml(fallback);
  return escapeHtml(String(v));
}

async function makeQr(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: 96,
      margin: 1,
      color: { dark: "#0D4A45", light: "#FFFFFF" },
    });
  } catch {
    return "";
  }
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  SHARED CSS                                                                */
/* ─────────────────────────────────────────────────────────────────────────── */

const SHARED_CSS = `
  /* Reset */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  /* Page */
  @page {
    size: A4;
    margin: 16mm 14mm 20mm 14mm;
  }
  @page :first { margin-top: 12mm; }

  body {
    font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    font-size: 11px;
    line-height: 1.55;
    color: #1A2E2A;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ── Top accent bar ── */
  .top-bar {
    height: 5px;
    background: linear-gradient(90deg, #0D4A45 0%, #10857A 50%, #059669 100%);
    margin: -16mm -14mm 0;
    page-break-after: avoid;
  }

  /* ── Letterhead ── */
  .letterhead {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 14px 0 12px;
    border-bottom: 2px solid #0D4A45;
    margin-bottom: 0;
    page-break-after: avoid;
    page-break-inside: avoid;
  }
  .lh-logo {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: linear-gradient(135deg, #0D4A45 0%, #10857A 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: #fff;
    font-size: 22px;
    font-weight: 900;
    letter-spacing: -1px;
  }
  .lh-hosp { flex: 1; min-width: 0; }
  .lh-hosp-name {
    font-size: 17px;
    font-weight: 800;
    color: #0D4A45;
    letter-spacing: -0.3px;
    line-height: 1.2;
  }
  .lh-hosp-sub {
    font-size: 9.5px;
    color: #5C7A75;
    margin-top: 2px;
    line-height: 1.4;
  }
  .lh-right {
    text-align: right;
    flex-shrink: 0;
    font-size: 10px;
    color: #5C7A75;
    line-height: 1.6;
  }
  .lh-right .doc-name {
    font-size: 13px;
    font-weight: 700;
    color: #0D4A45;
    display: block;
  }
  .lh-right .visit-badge {
    display: inline-block;
    margin-top: 3px;
    padding: 2px 8px;
    border-radius: 999px;
    background: #E8F5F3;
    color: #0D4A45;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    border: 1px solid #C0DDD9;
  }

  /* ── Sub header bar (doc type label) ── */
  .doc-type-bar {
    background: #0D4A45;
    color: #fff;
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    padding: 4px 12px;
    margin: 0 0 14px;
    page-break-after: avoid;
  }

  /* ── Patient card ── */
  .patient-card {
    background: #F4FFFE;
    border: 1px solid #C8E8E4;
    border-left: 4px solid #0D4A45;
    border-radius: 0 8px 8px 0;
    padding: 11px 14px;
    margin-bottom: 14px;
    page-break-inside: avoid;
  }
  .patient-card-head {
    font-size: 8.5px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #0D4A45;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .patient-card-head::after {
    content: "";
    flex: 1;
    height: 1px;
    background: #C8E8E4;
  }
  .patient-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 6px 16px;
  }
  .pf-label {
    font-size: 8.5px;
    color: #7A9C97;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 600;
  }
  .pf-value {
    font-size: 12px;
    font-weight: 700;
    color: #0D4A45;
    margin-top: 1px;
  }
  .pf-value.mono {
    font-family: "Courier New", monospace;
    background: #DFF0EE;
    padding: 1px 5px;
    border-radius: 4px;
    font-size: 11px;
  }
  .pf-value.normal {
    font-size: 11px;
    font-weight: 600;
    color: #1A2E2A;
  }

  /* ── Section header ── */
  .sec-hdr {
    display: flex;
    align-items: center;
    gap: 0;
    margin: 14px 0 6px;
    page-break-after: avoid;
    break-after: avoid;
  }
  .sec-hdr-label {
    background: #0D4A45;
    color: #fff;
    font-size: 8.5px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 4px 12px;
    border-radius: 4px 0 0 4px;
    white-space: nowrap;
  }
  .sec-hdr-line {
    flex: 1;
    height: 2px;
    background: linear-gradient(90deg, #0D4A45 0%, #C8E8E4 60%, transparent 100%);
    border-radius: 0 2px 2px 0;
  }

  /* ── Tables ── */
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10.5px;
    page-break-inside: auto;
  }
  thead { display: table-header-group; }
  thead tr {
    background: #E8F5F3;
  }
  th {
    text-align: left;
    font-size: 8.5px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #0D4A45;
    padding: 6px 8px;
    border-bottom: 2px solid #C8E8E4;
    white-space: nowrap;
  }
  td {
    padding: 7px 8px;
    vertical-align: top;
    word-break: break-word;
  }
  tr:nth-child(even) td { background: #F9FDFC; }
  .td-num { width: 24px; text-align: center; font-weight: 700; color: #0D4A45; font-size: 10px; }
  .td-head { font-weight: 700; color: #0D4A45; white-space: nowrap; }
  .td-mono { font-family: "Courier New", monospace; font-size: 10px; color: #0D4A45; background: #DFF0EE; padding: 1px 4px; border-radius: 3px; }
  .empty-row td { color: #9AB8B4; font-style: italic; text-align: center; padding: 12px; }

  /* Priority / status badges */
  .badge {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 999px;
    font-size: 8.5px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .badge-urgent { background: #FEE2E2; color: #B91C1C; border: 1px solid #FCA5A5; }
  .badge-routine { background: #E8F5F3; color: #0D4A45; border: 1px solid #C8E8E4; }
  .badge-stat { background: #FFF3CD; color: #92400E; border: 1px solid #FDE68A; }
  .badge-active { background: #DCFCE7; color: #15803D; border: 1px solid #86EFAC; }
  .badge-resolved { background: #F1F5F9; color: #475569; border: 1px solid #CBD5E1; }
  .badge-pending { background: #FEF3C7; color: #92400E; border: 1px solid #FDE68A; }

  /* Drug row special */
  .drug-name { font-weight: 700; font-size: 11px; color: #0D4A45; }
  .drug-sub { font-size: 9px; color: #5C7A75; margin-top: 1px; }
  .drug-dose { color: #1A2E2A; }

  /* Info grid (vitals) */
  .info-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    padding: 8px;
    background: #F4FFFE;
    border: 1px solid #C8E8E4;
    border-radius: 6px;
    page-break-inside: avoid;
  }
  .ig-item { }
  .ig-label { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #7A9C97; }
  .ig-value { font-size: 14px; font-weight: 800; color: #0D4A45; margin-top: 1px; }
  .ig-unit { font-size: 8.5px; color: #5C7A75; font-weight: 400; }

  /* Text block */
  .text-block {
    background: #F4FFFE;
    border: 1px solid #C8E8E4;
    border-left: 3px solid #10857A;
    border-radius: 0 6px 6px 0;
    padding: 9px 12px;
    font-size: 11px;
    line-height: 1.65;
    color: #1A2E2A;
    white-space: pre-wrap;
    word-break: break-word;
  }

  /* Advice box */
  .advice-box {
    background: #FFFBEB;
    border: 1px solid #FDE68A;
    border-left: 4px solid #D97706;
    border-radius: 0 8px 8px 0;
    padding: 10px 14px;
    font-size: 11px;
    page-break-inside: avoid;
  }
  .advice-box .advice-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 4px 0;
    border-bottom: 1px dashed #FDE68A;
  }
  .advice-box .advice-row:last-child { border-bottom: none; }
  .advice-box .advice-label {
    font-size: 9px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #92400E;
    white-space: nowrap;
    min-width: 88px;
  }
  .advice-box .advice-val { color: #1A2E2A; }


  /* Optical Rx table */
  .rx-table { font-size: 11px; }
  .rx-table th { font-size: 9px; text-align: center; }
  .rx-table td { text-align: center; font-weight: 600; }
  .rx-table .rx-eye { text-align: left; font-weight: 700; color: #0D4A45; width: 110px; }
  .rx-table .rx-eye-sub { font-size: 9px; color: #5C7A75; font-weight: 400; }

  /* Signature + QR */
  .bottom-section {
    margin-top: 24px;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    page-break-inside: avoid;
    border-top: 1px solid #C8E8E4;
    padding-top: 14px;
  }
  .qr-block { text-align: center; flex-shrink: 0; }
  .qr-block img { width: 76px; height: 76px; display: block; margin: 0 auto 4px; border: 1px solid #C8E8E4; border-radius: 4px; }
  .qr-label { font-size: 7.5px; color: #7A9C97; text-transform: uppercase; letter-spacing: 0.07em; }
  .sig-block { flex: 1; }
  .sig-line-row {
    border-top: 1.5px solid #0D4A45;
    width: 200px;
    margin-bottom: 5px;
  }
  .sig-name { font-size: 12px; font-weight: 700; color: #0D4A45; }
  .sig-sub { font-size: 9.5px; color: #5C7A75; margin-top: 1px; }
  .sig-reg { font-size: 8.5px; color: #7A9C97; margin-top: 2px; }
  .disclaimer {
    font-size: 8.5px;
    color: #9AB8B4;
    font-style: italic;
    margin-top: 10px;
    line-height: 1.5;
  }

  /* Footer */
  .footer {
    position: running(footer);
    font-size: 8.5px;
    color: #7A9C97;
    text-align: center;
    border-top: 1px solid #C8E8E4;
    padding-top: 5px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  @page { @bottom-center { content: element(footer); } }

  /* Page numbers via counter */
  .page-num::after { content: counter(page); }
  .page-total::after { content: counter(pages); }

  /* Alternating section bg */
  .empty-note {
    font-size: 10px;
    color: #9AB8B4;
    font-style: italic;
    padding: 6px 2px;
  }

  /* Two column layout */
  .two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    page-break-inside: avoid;
  }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-break { page-break-inside: avoid; break-inside: avoid; }
  }
`;

/* ─────────────────────────────────────────────────────────────────────────── */
/*  SHARED HELPERS                                                             */
/* ─────────────────────────────────────────────────────────────────────────── */

function secHdr(title: string) {
  return `<div class="sec-hdr" style="page-break-after:avoid;"><span class="sec-hdr-label">${title}</span><span class="sec-hdr-line"></span></div>`;
}

function badgePriority(p: string) {
  const cls = p.toUpperCase() === "URGENT" || p.toUpperCase() === "STAT"
    ? p.toUpperCase() === "STAT" ? "badge-stat" : "badge-urgent"
    : "badge-routine";
  return `<span class="badge ${cls}">${escapeHtml(p)}</span>`;
}

function badgeStatus(s: string) {
  const lower = s.toLowerCase().replace(/_/g, " ");
  const cls = lower.includes("resolv") ? "badge-resolved"
    : lower.includes("active") ? "badge-active"
    : lower.includes("complet") ? "badge-resolved"
    : "badge-pending";
  return `<span class="badge ${cls}">${escapeHtml(lower)}</span>`;
}

function letterhead(hospitalName: string, hospitalAddress: string | null | undefined, hospitalContact: string | null | undefined, doctorName: string, visitDate: Date, visitType: string | null | undefined, docLabel: string): string {
  return `
  <div class="top-bar"></div>
  <div class="letterhead">
    <div class="lh-logo">✚</div>
    <div class="lh-hosp">
      <div class="lh-hosp-name">${escapeHtml(hospitalName)}</div>
      <div class="lh-hosp-sub">
        ${hospitalAddress ? escapeHtml(hospitalAddress) + "<br/>" : ""}
        ${hospitalContact ? escapeHtml(hospitalContact) : ""}
      </div>
    </div>
    <div class="lh-right">
      <span class="doc-name">Dr. ${escapeHtml(doctorName)}</span>
      ${format(visitDate, "dd MMM yyyy")}<br/>
      ${format(visitDate, "hh:mm a")} IST<br/>
      <span class="visit-badge">${val(visitType, "Consultation")}</span>
    </div>
  </div>
  <div class="doc-type-bar">${escapeHtml(docLabel)}</div>`;
}

function patientCard(patient: { name: string; udid: string; age: number; sex: string; mobile?: string | null; address?: string | null }, doctorName: string, visitDate: Date, hospitalName: string): string {
  return `
  <div class="patient-card">
    <div class="patient-card-head">Patient Information</div>
    <div class="patient-grid">
      <div>
        <div class="pf-label">Patient Name</div>
        <div class="pf-value">${escapeHtml(patient.name)}</div>
      </div>
      <div>
        <div class="pf-label">UHID / Patient ID</div>
        <div class="pf-value mono">${escapeHtml(patient.udid)}</div>
      </div>
      <div>
        <div class="pf-label">Age / Gender</div>
        <div class="pf-value normal">${patient.age} yrs / ${escapeHtml(patient.sex)}</div>
      </div>
      <div>
        <div class="pf-label">Mobile</div>
        <div class="pf-value normal">${patient.mobile ? escapeHtml(patient.mobile) : "—"}</div>
      </div>
      <div>
        <div class="pf-label">Consulting Doctor</div>
        <div class="pf-value normal">Dr. ${escapeHtml(doctorName)}</div>
      </div>
      <div>
        <div class="pf-label">Visit Date &amp; Time</div>
        <div class="pf-value normal">${format(visitDate, "dd MMM yyyy, hh:mm a")}</div>
      </div>
      ${patient.address ? `<div style="grid-column:1/-1;"><div class="pf-label">Address</div><div class="pf-value normal">${escapeHtml(patient.address)}</div></div>` : ""}
    </div>
  </div>`;
}

function footerHtml(udid: string, label: string): string {
  const ts = format(new Date(), "dd MMM yyyy, hh:mm a");
  return `
  <div class="footer">
    <span>PPMS · ${escapeHtml(label)} · Generated: ${ts} IST</span>
    <span>UHID: ${escapeHtml(udid)}</span>
    <span>Page <span class="page-num"></span> of <span class="page-total"></span></span>
  </div>`;
}

function bottomSection(doctorName: string, hospitalName: string, qrDataUrl: string, udid: string): string {
  return `
  <div class="bottom-section">
    <div class="sig-block">
      <div class="sig-line-row"></div>
      <div class="sig-name">Dr. ${escapeHtml(doctorName)}</div>
      <div class="sig-sub">Ophthalmologist &amp; Eye Specialist</div>
      <div class="sig-reg">${escapeHtml(hospitalName)}</div>
      <div class="disclaimer">
        This document is computer-generated and is valid only with the doctor's digital seal or wet signature.<br/>
        For clinical reference only — not a substitute for professional medical advice.
      </div>
    </div>
    ${qrDataUrl ? `
    <div class="qr-block">
      <img src="${qrDataUrl}" alt="QR Code" />
      <div class="qr-label">UHID: ${escapeHtml(udid)}</div>
    </div>` : ""}
  </div>`;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  DISPENSE PDF                                                               */
/* ─────────────────────────────────────────────────────────────────────────── */

export type DispenseSummaryData = {
  patient: { udid: string; name: string; age: number; sex: string; mobileMasked: string };
  visit: { date: Date; hospitalName: string; doctorName: string };
  vitals: { bp?: string | null; pulse?: string | null; temperature?: string | null; weight?: string | null };
  chiefComplaint?: string | null;
  diagnoses: { description: string; icd10Code: string; status: string; laterality?: string | null }[];
  investigations: { testName: string; priority: string; status: string }[];
  dispenseSummary?: string | null;
};

async function renderDispenseHtml(data: DispenseSummaryData): Promise<string> {
  const qr = await makeQr(`PPMS-${data.patient.udid}`);

  const diagRows = data.diagnoses.length
    ? data.diagnoses.map((d, i) => `
      <tr>
        <td class="td-num">${i + 1}</td>
        <td class="td-head">${escapeHtml(d.description)}</td>
        <td><span class="td-mono">${escapeHtml(d.icd10Code)}</span></td>
        <td>${val(d.laterality)}</td>
        <td>${badgeStatus(d.status)}</td>
      </tr>`).join("")
    : `<tr class="empty-row"><td colspan="5">No diagnoses recorded</td></tr>`;

  const invRows = data.investigations.length
    ? data.investigations.map((i, idx) => `
      <tr>
        <td class="td-num">${idx + 1}</td>
        <td class="td-head">${escapeHtml(i.testName)}</td>
        <td>${badgePriority(i.priority)}</td>
        <td>${badgeStatus(i.status)}</td>
      </tr>`).join("")
    : `<tr class="empty-row"><td colspan="4">No investigations ordered</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><title>Dispense Summary — ${escapeHtml(data.patient.name)}</title>
<style>${SHARED_CSS}</style>
</head>
<body>
  ${letterhead(data.visit.hospitalName, null, null, data.visit.doctorName, data.visit.date, "Dispensary Visit", "Dispense Summary")}
  ${patientCard({ name: data.patient.name, udid: data.patient.udid, age: data.patient.age, sex: data.patient.sex, mobile: data.patient.mobileMasked }, data.visit.doctorName, data.visit.date, data.visit.hospitalName)}

  ${secHdr("Vitals")}
  <div class="info-grid">
    <div class="ig-item"><div class="ig-label">BP</div><div class="ig-value">${val(data.vitals.bp)}</div></div>
    <div class="ig-item"><div class="ig-label">Pulse</div><div class="ig-value">${val(data.vitals.pulse)}</div></div>
    <div class="ig-item"><div class="ig-label">Temperature</div><div class="ig-value">${val(data.vitals.temperature)}</div></div>
    <div class="ig-item"><div class="ig-label">Weight</div><div class="ig-value">${val(data.vitals.weight)}</div></div>
  </div>

  ${data.chiefComplaint ? `${secHdr("Chief Complaint")}<div class="text-block">${escapeHtml(data.chiefComplaint)}</div>` : ""}

  ${secHdr("Diagnosis")}
  <table>
    <thead><tr><th style="width:24px">#</th><th>Diagnosis</th><th>ICD-10</th><th>Laterality</th><th>Status</th></tr></thead>
    <tbody>${diagRows}</tbody>
  </table>

  ${secHdr("Investigations")}
  <table>
    <thead><tr><th style="width:24px">#</th><th>Test Name</th><th>Priority</th><th>Status</th></tr></thead>
    <tbody>${invRows}</tbody>
  </table>

  ${secHdr("Dispense Summary & Clinical Plan")}
  <div class="text-block">${escapeHtml(data.dispenseSummary ?? "No dispense summary recorded.")}</div>

  ${bottomSection(data.visit.doctorName, data.visit.hospitalName, qr, data.patient.udid)}
  ${footerHtml(data.patient.udid, "Dispense Summary")}
</body>
</html>`;
}

export async function generateDispensePdf(data: DispenseSummaryData): Promise<Buffer> {
  return htmlToPdf(await renderDispenseHtml(data));
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  PRESCRIPTION PDF                                                           */
/* ─────────────────────────────────────────────────────────────────────────── */

export type PrescriptionData = {
  patient: { udid: string; name: string; age: number; sex: string };
  visit: { date: Date; hospitalName: string; doctorName: string };
  medications: { drugName: string; dosage?: string | null; frequency?: string | null; duration?: string | null; instructions?: string | null; route?: string | null; laterality?: string | null }[];
  opticalRx: {
    re: { sph?: string; cyl?: string; axis?: string; nearSph?: string; nearCyl?: string; nearAxis?: string };
    le: { sph?: string; cyl?: string; axis?: string; nearSph?: string; nearCyl?: string; nearAxis?: string };
  };
};

async function renderPrescriptionHtml(data: PrescriptionData): Promise<string> {
  const qr = await makeQr(`PPMS-${data.patient.udid}`);

  const pdfMedBadge = (route: string | null | undefined, lat: string | null | undefined, name: string) => {
    const r = route ?? "";
    if (r === "Topical" || /eye\s*drops?|eye\s*oint/i.test(name)) {
      const lbl = lat || "OU";
      return `<span style="display:inline-block;min-width:26px;padding:1px 4px;border-radius:3px;background:#DBEAFE;color:#1D4ED8;font-size:7.5px;font-weight:700;text-align:center;margin-right:4px;">${escapeHtml(lbl)}</span>`;
    }
    if (/syrup|suspension/i.test(r) || /syrup|suspension/i.test(name)) {
      return `<span style="display:inline-block;min-width:26px;padding:1px 4px;border-radius:3px;background:#D1FAE5;color:#065F46;font-size:7.5px;font-weight:700;text-align:center;margin-right:4px;">SYP</span>`;
    }
    if (r === "IM" || r === "IV" || r === "Intravitreal" || r === "Subconjunctival" || r === "Subtenon" || /inject/i.test(name)) {
      return `<span style="display:inline-block;min-width:26px;padding:1px 4px;border-radius:3px;background:#FFE4E6;color:#9F1239;font-size:7.5px;font-weight:700;text-align:center;margin-right:4px;">INJ</span>`;
    }
    if (r === "Oral" || /tablet|capsule/i.test(name)) {
      return `<span style="display:inline-block;min-width:26px;padding:1px 4px;border-radius:3px;background:#FEF3C7;color:#92400E;font-size:7.5px;font-weight:700;text-align:center;margin-right:4px;">TAB</span>`;
    }
    return "";
  };

  const medRows = data.medications.length
    ? data.medications.map((m, i) => `
      <tr>
        <td class="td-num">${i + 1}</td>
        <td><div class="drug-name">${pdfMedBadge(m.route, m.laterality, m.drugName)}${escapeHtml(m.drugName)}</div>${m.instructions ? `<div class="drug-sub">${escapeHtml(m.instructions)}</div>` : ""}</td>
        <td class="drug-dose">${val(m.dosage)}</td>
        <td>${val(m.frequency)}</td>
        <td>${val(m.duration)}</td>
      </tr>`).join("")
    : `<tr class="empty-row"><td colspan="5">No medications prescribed</td></tr>`;

  const rxRow = (eye: string, sub: string, sph?: string, cyl?: string, axis?: string) =>
    `<tr><td class="rx-eye">${eye}<br/><span class="rx-eye-sub">${sub}</span></td><td>${val(sph)}</td><td>${val(cyl)}</td><td>${val(axis)}</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><title>Prescription — ${escapeHtml(data.patient.name)}</title>
<style>${SHARED_CSS}</style>
</head>
<body>
  ${letterhead(data.visit.hospitalName, null, null, data.visit.doctorName, data.visit.date, "Consultation", "Prescription")}
  ${patientCard({ name: data.patient.name, udid: data.patient.udid, age: data.patient.age, sex: data.patient.sex }, data.visit.doctorName, data.visit.date, data.visit.hospitalName)}

  ${secHdr("Medications Prescribed")}
  <table>
    <thead><tr><th style="width:24px">#</th><th>Drug / Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th></tr></thead>
    <tbody>${medRows}</tbody>
  </table>

  ${secHdr("Optical Prescription")}
  <table class="rx-table">
    <thead>
      <tr><th style="width:110px;text-align:left"></th><th>Sphere (SPH)</th><th>Cylinder (CYL)</th><th>Axis</th></tr>
    </thead>
    <tbody>
      ${rxRow("Right Eye (RE)", "Distance", data.opticalRx.re.sph, data.opticalRx.re.cyl, data.opticalRx.re.axis)}
      ${rxRow("Left Eye (LE)", "Distance", data.opticalRx.le.sph, data.opticalRx.le.cyl, data.opticalRx.le.axis)}
      ${rxRow("Right Eye (RE)", "Near Add", data.opticalRx.re.nearSph, data.opticalRx.re.nearCyl, data.opticalRx.re.nearAxis)}
      ${rxRow("Left Eye (LE)", "Near Add", data.opticalRx.le.nearSph, data.opticalRx.le.nearCyl, data.opticalRx.le.nearAxis)}
    </tbody>
  </table>

  ${bottomSection(data.visit.doctorName, data.visit.hospitalName, qr, data.patient.udid)}
  ${footerHtml(data.patient.udid, "Prescription")}
</body>
</html>`;
}

export async function generatePrescriptionPdf(data: PrescriptionData): Promise<Buffer> {
  return htmlToPdf(await renderPrescriptionHtml(data));
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  PUPPETEER CORE                                                             */
/* ─────────────────────────────────────────────────────────────────────────── */

async function launchBrowser() {
  if (process.env.VERCEL) {
    const chromium = (await import("@sparticuz/chromium")).default;
    const puppeteer = (await import("puppeteer-core")).default;
    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
  }
  const puppeteer = (await import("puppeteer")).default;
  return puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "16mm", bottom: "20mm", left: "14mm", right: "14mm" },
      displayHeaderFooter: false,
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
    await browser.close();
  }
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  SHORT SUMMARY PDF                                                          */
/* ─────────────────────────────────────────────────────────────────────────── */

export type ShortSummaryData = {
  patient: { udid: string; name: string; age: number; sex: string; mobile?: string | null };
  visit: {
    date: Date; visitType?: string | null;
    hospitalName: string; hospitalLogo?: string | null; hospitalAddress?: string | null; hospitalContact?: string | null; hospitalEmail?: string | null;
    doctorName: string;
    /* Sign-off block. All optional — a field that is absent is simply not printed. */
    doctorQualifications?: string | null;
    doctorSpecialty?: string | null;
    doctorRegNumber?: string | null;
    /** The doctor's own uploaded signature. Never fabricated — absent means a blank sign-off rule. */
    doctorSignatureUrl?: string | null;
    followUpDate?: Date | null;
    referralEnabled?: boolean;
    referralNote?: string | null;
  };
  chiefComplaint?: string | null;
  /** Visit.adviseNotes — the doctor's own advice text, printed verbatim. */
  advice?: string | null;
  diagnoses: { description: string; icd10Code: string; status: string; laterality?: string | null }[];
  medications: { drugName: string; dosage?: string | null; frequency?: string | null; duration?: string | null; instructions?: string | null; route?: string | null; laterality?: string | null }[];
  investigations: { testName: string; category: string; priority: string; laterality?: string | null; status: string }[];
  opticalRx?: {
    re: { sph?: string; cyl?: string; axis?: string; nearSph?: string };
    le: { sph?: string; cyl?: string; axis?: string; nearSph?: string };
  } | null;
  minorProcedure?: { procedureName?: string | null; procedureLaterality?: string | null; anesthesiaType?: string | null } | null;
};

async function renderShortSummaryHtml(d: ShortSummaryData): Promise<string> {
  const v2 = (x: unknown) => (x === null || x === undefined || x === "") ? "" : escapeHtml(String(x));

  /* Format "[RE] [5 days] Left Eye pain" → "RE Left Eye pain · Since 5 days" */
  const fmtComplaint = (raw: string): string => {
    const durations: string[] = [];
    const others: string[] = [];
    const rest = raw.replace(/\[([^\]]+)\]/g, (_, inner) => {
      const t = inner.trim();
      /^\d+\s*(day|week|month|year|hour)s?/i.test(t) ? durations.push(t) : others.push(t);
      return "";
    }).replace(/\s+/g, " ").trim();
    const body = [...others, rest].filter(Boolean).join(" ").trim();
    return durations.length ? `${body} · Since ${durations.join(", ")}` : body;
  };

  /*
    Palette — the app's own brand tokens from globals.css, so a printed summary
    and the screen it came from read as one product.
      #0B3D3A primary-900   #115E59 primary-700   #157A73 primary-600
      #1C9388 primary-500   #2BA89C primary-400   #DCEFEC primary-100
      #F0F8F6 primary-50
  */
  const INK = "#0B3D3A", LABEL_C = "#115E59", BRAND = "#157A73", MINT = "#2BA89C";
  const TINT = "#F0F8F6", LINE = "#D3E6E2";

  /* ── Rounded section card: green title strip over bordered body ── */
  const card = (label: string, inner: string) =>
    `<div class="no-break" style="border:1px solid ${LINE};border-radius:6px;overflow:hidden;margin-bottom:12px;">` +
    `<div style="background:${TINT};border-bottom:1px solid ${LINE};padding:4.5px 10px;">` +
    `<span style="font-size:8.5px;font-weight:800;letter-spacing:0.11em;text-transform:uppercase;color:${LABEL_C};">${label}</span>` +
    `</div>` +
    `<div style="padding:7px 10px;">${inner}</div>` +
    `</div>`;

  /* ── Inline section: label tag on the left, content on the same row ── */
  /* Label is fixed 148px wide so all three rows snap to the same vertical grid. */
  const inlineCard = (label: string, inner: string) =>
    `<div class="no-break" style="display:flex;align-items:flex-start;gap:6px;margin-bottom:11px;">` +
    `<div style="width:148px;min-width:148px;background:${TINT};border:1px solid ${LINE};border-radius:4px;padding:5px 8px;font-size:8.5px;font-weight:800;letter-spacing:0.11em;text-transform:uppercase;color:${LABEL_C};white-space:nowrap;text-align:center;flex-shrink:0;">${label}</div>` +
    `<div style="flex:1;border:1px solid ${LINE};border-radius:4px;padding:5px 9px;min-height:28px;display:flex;align-items:center;">${inner}</div>` +
    `</div>`;

  /* ── Muted empty state — states absence, never invents content ── */
  const none = (t: string) => `<span style="color:#9AA5A3;font-style:italic;font-size:9.5px;">${t}</span>`;

  /* ── Patient info field box (rounded, reference style) ── */
  const fbox = (label: string, value: string) =>
    `<td style="padding-right:10px;padding-bottom:6px;vertical-align:top;">` +
    `<div style="font-size:8px;font-weight:700;color:${LABEL_C};margin-bottom:2px;letter-spacing:0.04em;">${label}</div>` +
    `<div style="background:#fff;border:1px solid ${LINE};border-radius:4px;padding:4px 8px;font-size:9.5px;color:#111;min-height:20px;">${value || "&nbsp;"}</div>` +
    `</td>`;

  /* ── Key-value row (follow-up): borderless, report style ── */
  const kvRow = (label: string, value: string) =>
    `<tr>` +
    `<td style="padding:2.5px 12px 2.5px 0;font-size:9.5px;font-weight:700;color:#4A5A57;width:34%;">${label}</td>` +
    `<td style="padding:2.5px 0;font-size:9.5px;color:#1a1a1a;">${value}</td>` +
    `</tr>`;

  /* ── Table header style ── */
  const TH = `padding:4px 7px;background:${BRAND};color:#fff;font-size:8.5px;font-weight:700;text-align:left;`;

  /* ── Data cell — bottom border only, clean open rows ── */
  const TD = `padding:3.5px 7px;border-bottom:1px solid #ECF3F1;font-size:9.5px;`;

  /* ── Diagnosis status badge ── */
  const diagBadge = (s: string) => {
    const u = s.toUpperCase();
    const [fg, bg] = u === "RESOLVED" || u === "INACTIVE"
      ? ["#15803D", "#F0FDF4"]
      : u === "CHRONIC"
      ? ["#B45309", "#FFFBEB"]
      : ["#DC2626", "#FEF2F2"];
    return `<span style="font-size:8px;font-weight:700;color:${fg};background:${bg};` +
      `padding:1px 6px;border-radius:3px;">${escapeHtml(s)}</span>`;
  };

  /* ── Medication rows ── */
  const pdfMedBadge2 = (route: string | null | undefined, lat: string | null | undefined, name: string) => {
    const r = route ?? "";
    if (r === "Topical" || /eye\s*drops?|eye\s*oint/i.test(name)) {
      const lbl = lat || "OU";
      return `<span style="display:inline-block;min-width:24px;padding:1px 4px;border-radius:3px;background:#DBEAFE;color:#1D4ED8;font-size:7px;font-weight:700;text-align:center;margin-right:3px;">${escapeHtml(lbl)}</span>`;
    }
    if (/syrup|suspension/i.test(r) || /syrup|suspension/i.test(name)) {
      return `<span style="display:inline-block;min-width:24px;padding:1px 4px;border-radius:3px;background:#D1FAE5;color:#065F46;font-size:7px;font-weight:700;text-align:center;margin-right:3px;">SYP</span>`;
    }
    if (r === "IM" || r === "IV" || r === "Intravitreal" || r === "Subconjunctival" || r === "Subtenon" || /inject/i.test(name)) {
      return `<span style="display:inline-block;min-width:24px;padding:1px 4px;border-radius:3px;background:#FFE4E6;color:#9F1239;font-size:7px;font-weight:700;text-align:center;margin-right:3px;">INJ</span>`;
    }
    if (r === "Oral" || /tablet|capsule/i.test(name)) {
      return `<span style="display:inline-block;min-width:24px;padding:1px 4px;border-radius:3px;background:#FEF3C7;color:#92400E;font-size:7px;font-weight:700;text-align:center;margin-right:3px;">TAB</span>`;
    }
    return "";
  };

  const MED_TD = `padding:6px 7px;border-bottom:1px solid #ECF3F1;font-size:9.5px;`;

  const medRows = d.medications.length
    ? d.medications.map((m, i) =>
        `<tr style="background:${i % 2 === 0 ? "#fff" : TINT};">` +
        `<td style="${MED_TD}text-align:center;color:#888;">${i + 1}</td>` +
        `<td style="${MED_TD}">` +
        pdfMedBadge2(m.route, m.laterality, m.drugName) +
        `<span style="font-weight:700;color:#1a1a1a;">${escapeHtml(m.drugName)}</span>` +
        (m.instructions ? `<span style="font-size:8.5px;color:#777;margin-left:5px;">${escapeHtml(m.instructions)}</span>` : "") +
        `</td>` +
        `<td style="${MED_TD}">${v2(m.dosage)}</td>` +
        `<td style="${MED_TD}">${v2(m.frequency)}</td>` +
        `<td style="${MED_TD}">${v2(m.duration)}</td>` +
        `</tr>`
      ).join("")
    : `<tr><td colspan="5" style="padding:4px 8px;border:none;">${none("No medications prescribed")}</td></tr>`;

  /* ── Optical Rx ── */
  const hasRx = d.opticalRx && (
    d.opticalRx.re.sph || d.opticalRx.re.cyl || d.opticalRx.re.axis ||
    d.opticalRx.le.sph || d.opticalRx.le.cyl || d.opticalRx.le.axis ||
    d.opticalRx.re.nearSph || d.opticalRx.le.nearSph
  );
  const rxTd = (val?: string) => `<td style="${TD}text-align:center;">${v2(val)}</td>`;
  const rxRowFn = (eye: string, sub: string, sph?: string, cyl?: string, axis?: string, near?: string) =>
    `<tr><td style="${TD}font-weight:700;">${eye} <span style="font-weight:400;font-size:8.5px;color:#777;">(${sub})</span></td>` +
    rxTd(sph) + rxTd(cyl) + rxTd(axis) + rxTd(near) + `</tr>`;

  /* ── Investigations ── */
  const hasInv = d.investigations && d.investigations.length > 0;

  /* ── Follow-up ── */
  const hasFollowUp = !!(d.visit.followUpDate || (d.visit.referralEnabled && d.visit.referralNote));

  const CSS = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      font-size: 9.5px; line-height: 1.4; color: #1a1a1a;
      background: #fff;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    table { width: 100%; border-collapse: collapse; }
    .footer {
      position: running(footer);
      font-size: 7.5px; color: #888;
      display: flex; align-items: center; justify-content: space-between;
      border-top: 1px solid #ddd; padding-top: 4px;
    }
    @page { @bottom-center { content: element(footer); } }
    .page-num::after { content: counter(page); }
    .page-total::after { content: counter(pages); }
    @media print { .no-break { page-break-inside: avoid; break-inside: avoid; } }
  `;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Consultation Summary — ${escapeHtml(d.patient.name)}</title>
<style>${CSS}</style>
</head>
<body>
<div style="min-height:calc(297mm - 36mm);display:flex;flex-direction:column;">

<!-- BRAND ACCENT LINE (full bleed) -->
<div style="height:4px;background:linear-gradient(90deg,${INK} 0%,${BRAND} 50%,${MINT} 100%);margin:0 -14mm;"></div>

<!-- HEADER CARD (full bleed) -->
<div style="margin:0 -14mm;padding:11px 14mm 13px;
            background:linear-gradient(135deg,#F7FCFB 0%,#E8F5F2 55%,#F2FAF8 100%);
            page-break-after:avoid;">
  <div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:flex-start;gap:18px;">

    <!-- Left: Logo card + hospital name + specialty + contacts -->
    <div style="display:flex;align-items:flex-start;gap:12px;min-width:0;">

      <!-- Logo rounded card -->
      ${d.visit.hospitalLogo
        ? `<div style="background:#fff;border:1.5px solid #B8DED7;border-radius:10px;padding:5px;flex-shrink:0;box-shadow:0 1px 6px rgba(21,122,115,0.12);">` +
          `<img src="${escapeHtml(d.visit.hospitalLogo)}" alt="Logo" style="width:44px;height:44px;object-fit:contain;display:block;border-radius:6px;" /></div>`
        : `<div style="background:linear-gradient(135deg,#F0F8F6,#DCEFEC);border:1.5px solid #B8DED7;` +
          `border-radius:10px;width:54px;height:54px;flex-shrink:0;display:flex;align-items:center;` +
          `justify-content:center;color:${BRAND};font-size:24px;font-weight:900;">&#10010;</div>`}

      <!-- Hospital text block -->
      <div style="min-width:0;padding-top:1px;">
        <div style="font-size:15px;font-weight:800;color:${INK};letter-spacing:-0.2px;line-height:1.1;">
          ${escapeHtml(d.visit.hospitalName)}
        </div>
        <div style="font-size:8px;font-weight:600;color:${BRAND};margin-top:3px;letter-spacing:0.06em;text-transform:uppercase;">
          Ophthalmology &amp; Eye Care
        </div>
        ${(d.visit.hospitalAddress || d.visit.hospitalContact || d.visit.hospitalEmail)
          ? `<div style="margin-top:6px;display:flex;flex-direction:column;gap:2px;">` +
            (d.visit.hospitalAddress
              ? `<div style="font-size:7.5px;color:#4A5A57;display:flex;align-items:flex-start;gap:3px;">` +
                `<span style="color:${BRAND};font-size:8px;flex-shrink:0;">&#9679;</span>${escapeHtml(d.visit.hospitalAddress)}</div>`
              : "") +
            ((d.visit.hospitalContact || d.visit.hospitalEmail)
              ? `<div style="font-size:7.5px;color:#4A5A57;display:flex;align-items:center;gap:3px;">` +
                `<span style="color:${BRAND};font-size:8px;flex-shrink:0;">&#9679;</span>` +
                (d.visit.hospitalContact ? `<span>${escapeHtml(d.visit.hospitalContact)}</span>` : "") +
                (d.visit.hospitalContact && d.visit.hospitalEmail
                  ? `<span style="color:#B8CFCA;padding:0 4px;">|</span>` : "") +
                (d.visit.hospitalEmail ? `<span>${escapeHtml(d.visit.hospitalEmail)}</span>` : "") +
                `</div>`
              : "") +
            `</div>`
          : ""}
      </div>
    </div>

    <!-- Center: CONSULTATION SUMMARY title -->
    <div style="text-align:center;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding-top:4px;">
      <div style="font-size:6.5px;font-weight:700;letter-spacing:0.28em;text-transform:uppercase;color:${MINT};margin-bottom:5px;">
        Clinical Report
      </div>
      <div style="font-size:18px;font-weight:900;color:${INK};letter-spacing:0.07em;text-transform:uppercase;line-height:1.0;white-space:nowrap;">
        CONSULTATION
      </div>
      <div style="font-size:18px;font-weight:900;color:${INK};letter-spacing:0.07em;text-transform:uppercase;line-height:1.05;white-space:nowrap;margin-top:1px;">
        SUMMARY
      </div>
      <div style="height:2px;width:100%;background:linear-gradient(90deg,transparent,${BRAND},${MINT});border-radius:1px;margin:6px 0 0;"></div>
    </div>

    <!-- Right: Doctor name, specialty, date & time -->
    <div style="text-align:right;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;justify-content:center;padding-top:2px;">
      <div style="font-size:13px;font-weight:800;color:${INK};line-height:1.2;">Dr. ${escapeHtml(d.visit.doctorName)}</div>
      <div style="font-size:9px;color:${BRAND};font-weight:600;margin-top:2px;">${escapeHtml(d.visit.doctorSpecialty || "Consultant Ophthalmologist")}</div>
      <div style="font-size:8.5px;color:#4A5A57;margin-top:4px;">${format(d.visit.date, "dd MMM yyyy, hh:mm a")} IST</div>
    </div>
  </div>
</div>

<!-- SOFT DIVIDER (full bleed) -->
<div style="height:1px;background:linear-gradient(90deg,#DCEFEC,#B8DED7,#DCEFEC);margin:0 -14mm 10px;"></div>

<!-- PATIENT DETAIL STRIP -->
<table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
  <tbody>
    <tr>
      ${fbox("Patient", escapeHtml(d.patient.name))}
      ${fbox("Patient ID", escapeHtml(d.patient.udid))}
      ${fbox("Age / Gender", `${d.patient.age} yrs / ${escapeHtml(d.patient.sex)}`)}
      ${fbox("Mobile", d.patient.mobile ? escapeHtml(d.patient.mobile) : "—")}
    </tr>
  </tbody>
</table>

<!-- 1 · CHIEF COMPLAINT -->
${inlineCard("Chief Complaint",
  d.chiefComplaint
    ? `<div style="font-size:10.5px;font-weight:600;color:${INK};">${escapeHtml(fmtComplaint(d.chiefComplaint))}</div>`
    : none("No complaint recorded"))}

<!-- 2 · CLINICAL IMPRESSION -->
${inlineCard("Clinical Impression",
  d.diagnoses.length
    ? `<table style="width:100%;">
        <tbody>
          ${d.diagnoses.map((dx, i) =>
            `<tr>` +
            `<td style="padding:3.5px 7px;font-size:9.5px;text-align:center;color:#8A9793;width:22px;">${i + 1}</td>` +
            `<td style="padding:3.5px 7px;font-size:9.5px;font-weight:600;">` +
            (dx.laterality ? `<span style="color:#4A5A57;font-weight:400;margin-right:5px;">${escapeHtml(dx.laterality)}</span>` : "") +
            escapeHtml(dx.description) +
            `</td>` +
            `</tr>`
          ).join("")}
        </tbody>
      </table>`
    : none("No diagnosis recorded"))}

<!-- 2b · MINOR PROCEDURE (only when recorded) -->
${d.minorProcedure?.procedureName
  ? inlineCard("Minor Procedure",
      `<div style="font-size:10.5px;font-weight:600;color:${INK};">` +
      [
        d.minorProcedure.procedureLaterality ? escapeHtml(d.minorProcedure.procedureLaterality) : "",
        escapeHtml(d.minorProcedure.procedureName),
        d.minorProcedure.anesthesiaType ? `Under ${escapeHtml(d.minorProcedure.anesthesiaType)}` : "",
      ].filter(Boolean).join(`<span style="color:#B0BDBA;margin:0 5px;">·</span>`) +
      `</div>`)
  : ""}

<!-- 3 · MEDICATIONS -->
${card("Medications",
  `<table>
    <tbody>${medRows}</tbody>
  </table>`)}

<!-- 4 · ADVICE NOTES -->
${inlineCard("Advice Notes",
  d.advice && d.advice.trim()
    ? `<div style="font-size:9.5px;color:#1a1a1a;white-space:pre-wrap;line-height:1.5;">${escapeHtml(d.advice.trim())}</div>`
    : none("No advice recorded"))}

<!-- 5 · SPECTACLES / REFRACTION (only if an Rx exists) -->
${hasRx
  ? card("Spectacles / Refraction",
      `<table>
        <thead><tr>
          <th style="${TH}width:105px;">Eye</th>
          <th style="${TH}text-align:center;">SPH</th>
          <th style="${TH}text-align:center;">CYL</th>
          <th style="${TH}text-align:center;">Axis</th>
          <th style="${TH}text-align:center;">Near Add</th>
        </tr></thead>
        <tbody>
          ${rxRowFn("RE", "Distance", d.opticalRx!.re.sph, d.opticalRx!.re.cyl, d.opticalRx!.re.axis, d.opticalRx!.re.nearSph)}
          ${rxRowFn("LE", "Distance", d.opticalRx!.le.sph, d.opticalRx!.le.cyl, d.opticalRx!.le.axis, d.opticalRx!.le.nearSph)}
        </tbody>
      </table>`)
  : ""}

<!-- 6 · FOLLOW-UP (only date & day, inline) -->
${d.visit.followUpDate
  ? inlineCard("Follow-up",
      `<div style="font-size:10.5px;font-weight:600;color:${INK};">${format(new Date(d.visit.followUpDate), "EEEE, dd MMM yyyy")}</div>`)
  : ""}

<!-- SPACER: pushes signature to the bottom of the page -->
<div style="flex:1;min-height:40px;"></div>

<!--
  DOCTOR'S SIGNATURE — bottom-right, above the footer.
  Prints the doctor's own uploaded signature when one exists; otherwise leaves a
  blank rule for a wet signature. A signature is never drawn or synthesised.
-->
<div class="no-break" style="margin-top:0;display:flex;justify-content:flex-end;">
  <div style="width:210px;text-align:center;">
    ${d.visit.doctorSignatureUrl
        ? `<div style="height:34px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:2px;">
             <img src="${escapeHtml(d.visit.doctorSignatureUrl)}" alt="Signature of Dr. ${escapeHtml(d.visit.doctorName)}" style="max-height:32px;max-width:190px;object-fit:contain;display:block;" />
           </div>
           <div style="height:1px;background:${BRAND};"></div>`
        : ""}
    <div style="font-size:7px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${LABEL_C};margin-top:3px;">
      Doctor&rsquo;s Signature
    </div>
    <div style="font-size:11px;font-weight:700;color:${INK};margin-top:5px;">Dr. ${escapeHtml(d.visit.doctorName)}</div>
    ${d.visit.doctorQualifications
      ? `<div style="font-size:8.5px;color:#4A5A57;margin-top:1px;">${escapeHtml(d.visit.doctorQualifications)}</div>`
      : ""}
    <div style="font-size:8.5px;color:#4A5A57;margin-top:1px;">${escapeHtml(d.visit.doctorSpecialty || "Consultant Ophthalmologist")}</div>
    ${d.visit.doctorRegNumber
      ? `<div style="font-size:7.5px;color:#8A9793;margin-top:1px;">Reg. No. ${escapeHtml(d.visit.doctorRegNumber)}</div>`
      : ""}
    <div style="font-size:7.5px;color:#8A9793;margin-top:1px;">${escapeHtml(d.visit.hospitalName)}</div>
  </div>
</div>

<!-- CLOSING LINE -->
<div style="margin-top:12px;padding-top:7px;border-top:1px solid ${LINE};text-align:center;">
  <span style="font-size:9px;font-style:italic;color:${LABEL_C};">Thank you for trusting us with your care.</span>
</div>

</div><!-- end flex-column page wrapper -->

<!-- RUNNING FOOTER -->
<div class="footer">
  <span>CONFIDENTIAL — For authorized clinical use only</span>
  <span>UHID: ${escapeHtml(d.patient.udid)}</span>
  <span>Generated by PPMS · Powered by RAPDFLY · Page <span class="page-num"></span> of <span class="page-total"></span></span>
</div>

</body>
</html>`;
}

export async function generateShortSummaryPdf(data: ShortSummaryData): Promise<Buffer> {
  return htmlToPdf(await renderShortSummaryHtml(data));
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  DISCHARGE SUMMARY PDF                                                       */
/* ─────────────────────────────────────────────────────────────────────────── */

export type DischargeSummaryPdfData = {
  patient: { name: string; udid: string; age: number; sex: string; mobile?: string | null };
  visit: {
    doctorName: string; doctorSpecialty?: string | null; doctorRegNumber?: string | null;
    doctorSignatureUrl?: string | null; hospitalName: string; hospitalLogo?: string | null;
    hospitalAddress?: string | null; hospitalContact?: string | null; hospitalEmail?: string | null;
  };
  admission: { admissionDate?: Date | null; dischargeDate?: Date | null; ward: string; reason: string };
  summary: {
    surgeryPerformed?: string | null; operatingEye?: string | null; anesthesiaUsed?: string | null; iolDetails?: string | null;
    postOpDiagnosis?: string | null; intraopComplications?: string | null; postOpCourse?: string | null; conditionAtDischarge: string;
    dischargeMedications?: string | null; dischargeInstructions?: string | null; activityRestrictions?: string | null;
    dietAdvice?: string | null; woundCareInstructions?: string | null; followUpDate?: Date | null; followUpInstructions?: string | null;
  };
};

async function renderDischargeSummaryHtml(d: DischargeSummaryPdfData): Promise<string> {
  const INK = "#0B3D3A", LABEL_C = "#115E59", BRAND = "#157A73", MINT = "#2BA89C";
  const TINT = "#F0F8F6", LINE = "#D3E6E2";

  const v = (x: unknown, fb = "—") => x === null || x === undefined || x === "" ? escapeHtml(String(fb)) : escapeHtml(String(x));

  const conditionColor: Record<string, string> = {
    STABLE:         "#15803D",
    IMPROVED:       "#1D4ED8",
    AGAINST_ADVICE: "#C2410C",
    TRANSFERRED:    "#7C3AED",
  };
  const conditionLabel: Record<string, string> = {
    STABLE: "Stable", IMPROVED: "Improved", AGAINST_ADVICE: "Against Medical Advice", TRANSFERRED: "Transferred",
  };
  const condColor = conditionColor[d.summary.conditionAtDischarge] ?? LABEL_C;
  const condLabel = conditionLabel[d.summary.conditionAtDischarge] ?? d.summary.conditionAtDischarge;

  const eyeLabel: Record<string, string> = { RE: "Right Eye", LE: "Left Eye", BE: "Both Eyes" };

  type Med = { drugName: string; dosage: string; frequency: string; duration: string; instructions: string };
  const meds: Med[] = (() => { try { return JSON.parse(d.summary.dischargeMedications ?? "[]"); } catch { return []; } })();

  const section = (title: string, content: string) =>
    `<div style="margin-bottom:14px;">` +
    `<div style="display:flex;align-items:center;gap:0;margin-bottom:7px;">` +
    `<div style="background:${TINT};border:1px solid ${LINE};border-radius:4px;padding:4px 10px;font-size:8px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:${LABEL_C};white-space:nowrap;">${title}</div>` +
    `<div style="flex:1;height:1px;background:linear-gradient(90deg,${LINE},transparent);margin-left:6px;"></div>` +
    `</div>` +
    content +
    `</div>`;

  const row = (label: string, value: string) =>
    `<div style="display:flex;align-items:flex-start;gap:8px;padding:4px 0;border-bottom:1px solid ${TINT};">` +
    `<div style="width:160px;min-width:160px;font-size:8.5px;font-weight:700;color:#4A5A57;flex-shrink:0;">${label}</div>` +
    `<div style="flex:1;font-size:9.5px;color:${INK};">${value}</div>` +
    `</div>`;

  const CSS = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Segoe UI","Helvetica Neue",Arial,sans-serif; font-size:9.5px; line-height:1.5; color:#1a1a1a; background:#fff; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    table { width:100%; border-collapse:collapse; }
    .footer { position:running(footer); font-size:7.5px; color:#888; display:flex; align-items:center; justify-content:space-between; border-top:1px solid #ddd; padding-top:4px; }
    @page { @bottom-center { content: element(footer); } }
    .page-num::after { content: counter(page); }
    .page-total::after { content: counter(pages); }
    @media print { .no-break { page-break-inside:avoid; break-inside:avoid; } }
  `;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Discharge Summary — ${escapeHtml(d.patient.name)}</title>
<style>${CSS}</style>
</head>
<body>
<div style="min-height:calc(297mm - 36mm);display:flex;flex-direction:column;">

<!-- TOP BAR -->
<div style="height:4px;background:linear-gradient(90deg,${INK} 0%,${BRAND} 50%,${MINT} 100%);margin:0 -14mm;"></div>

<!-- HEADER -->
<div style="margin:0 -14mm;padding:11px 14mm 13px;background:linear-gradient(135deg,#F7FCFB 0%,#E8F5F2 55%,#F2FAF8 100%);page-break-after:avoid;">
  <div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:flex-start;gap:18px;">
    <!-- Left -->
    <div style="display:flex;align-items:flex-start;gap:12px;min-width:0;">
      ${d.visit.hospitalLogo
        ? `<div style="background:#fff;border:1.5px solid #B8DED7;border-radius:10px;padding:5px;flex-shrink:0;"><img src="${escapeHtml(d.visit.hospitalLogo)}" alt="Logo" style="width:44px;height:44px;object-fit:contain;display:block;border-radius:6px;" /></div>`
        : `<div style="background:linear-gradient(135deg,#F0F8F6,#DCEFEC);border:1.5px solid #B8DED7;border-radius:10px;width:54px;height:54px;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:${BRAND};font-size:24px;font-weight:900;">&#10010;</div>`}
      <div style="min-width:0;padding-top:1px;">
        <div style="font-size:15px;font-weight:800;color:${INK};letter-spacing:-0.2px;line-height:1.1;">${escapeHtml(d.visit.hospitalName)}</div>
        <div style="font-size:8px;font-weight:600;color:${BRAND};margin-top:3px;letter-spacing:0.06em;text-transform:uppercase;">Ophthalmology &amp; Eye Care</div>
        ${d.visit.hospitalAddress ? `<div style="font-size:7.5px;color:#4A5A57;margin-top:4px;">${escapeHtml(d.visit.hospitalAddress)}</div>` : ""}
        ${d.visit.hospitalContact ? `<div style="font-size:7.5px;color:#4A5A57;">${escapeHtml(d.visit.hospitalContact)}</div>` : ""}
      </div>
    </div>
    <!-- Center -->
    <div style="text-align:center;flex-shrink:0;padding-top:4px;">
      <div style="font-size:6.5px;font-weight:700;letter-spacing:0.28em;text-transform:uppercase;color:${MINT};margin-bottom:5px;">Clinical Document</div>
      <div style="font-size:18px;font-weight:900;color:${INK};letter-spacing:0.07em;text-transform:uppercase;line-height:1.0;white-space:nowrap;">DISCHARGE</div>
      <div style="font-size:18px;font-weight:900;color:${INK};letter-spacing:0.07em;text-transform:uppercase;line-height:1.05;white-space:nowrap;margin-top:1px;">SUMMARY</div>
      <div style="height:2px;width:100%;background:linear-gradient(90deg,transparent,${BRAND},${MINT});border-radius:1px;margin:6px 0 0;"></div>
    </div>
    <!-- Right -->
    <div style="text-align:right;flex-shrink:0;padding-top:2px;">
      <div style="font-size:13px;font-weight:800;color:${INK};">Dr. ${escapeHtml(d.visit.doctorName)}</div>
      <div style="font-size:9px;color:${BRAND};font-weight:600;margin-top:2px;">${escapeHtml(d.visit.doctorSpecialty || "Consultant Ophthalmologist")}</div>
      ${d.visit.doctorRegNumber ? `<div style="font-size:8px;color:#4A5A57;margin-top:2px;">Reg. No. ${escapeHtml(d.visit.doctorRegNumber)}</div>` : ""}
    </div>
  </div>
</div>

<!-- DIVIDER -->
<div style="height:1px;background:linear-gradient(90deg,#DCEFEC,#B8DED7,#DCEFEC);margin:0 -14mm 10px;"></div>

<!-- PATIENT STRIP -->
<table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
  <tbody>
    <tr>
      ${[
        ["Patient", escapeHtml(d.patient.name)],
        ["Patient ID", escapeHtml(d.patient.udid)],
        ["Age / Sex", `${d.patient.age} yrs / ${escapeHtml(d.patient.sex)}`],
        ["Admission", d.admission.admissionDate ? format(d.admission.admissionDate, "dd MMM yyyy") : "—"],
        ["Discharge", d.admission.dischargeDate ? format(d.admission.dischargeDate, "dd MMM yyyy") : "—"],
        ["Ward", d.admission.ward.replace(/_/g, " ")],
      ].map(([lbl, val]) =>
        `<td style="padding-right:8px;padding-bottom:6px;vertical-align:top;">` +
        `<div style="font-size:8px;font-weight:700;color:${LABEL_C};margin-bottom:2px;">${lbl}</div>` +
        `<div style="background:#fff;border:1px solid ${LINE};border-radius:4px;padding:4px 8px;font-size:9.5px;color:#111;min-height:20px;">${val}</div>` +
        `</td>`
      ).join("")}
    </tr>
  </tbody>
</table>

<!-- CONDITION BADGE -->
<div style="margin-bottom:12px;display:flex;align-items:center;gap:8px;">
  <div style="font-size:8px;font-weight:700;color:#4A5A57;text-transform:uppercase;letter-spacing:0.08em;">Condition at discharge:</div>
  <div style="display:inline-block;padding:3px 12px;border-radius:20px;background:${condColor}18;border:1px solid ${condColor}44;color:${condColor};font-size:10px;font-weight:700;">${condLabel}</div>
</div>

<!-- SURGERY DETAILS -->
${section("Surgery Details",
  row("Surgery / Procedure", v(d.summary.surgeryPerformed)) +
  row("Operating Eye", v(d.summary.operatingEye ? (eyeLabel[d.summary.operatingEye] ?? d.summary.operatingEye) : null)) +
  row("Anesthesia", v(d.summary.anesthesiaUsed)) +
  row("IOL Details", v(d.summary.iolDetails))
)}

<!-- CLINICAL OUTCOME -->
${section("Clinical Outcome",
  row("Post-Op Diagnosis", v(d.summary.postOpDiagnosis)) +
  row("Intra-Op Complications", v(d.summary.intraopComplications, "None")) +
  row("Post-Op Course", `<div style="white-space:pre-wrap;">${v(d.summary.postOpCourse, "Uneventful")}</div>`)
)}

<!-- DISCHARGE MEDICATIONS -->
${section("Discharge Medications",
  meds.length
    ? `<table style="font-size:9px;">
        <thead>
          <tr style="background:${TINT};">
            <th style="padding:4px 7px;text-align:left;font-size:7.5px;font-weight:800;color:${LABEL_C};letter-spacing:0.08em;text-transform:uppercase;border-bottom:1px solid ${LINE};">#</th>
            <th style="padding:4px 7px;text-align:left;font-size:7.5px;font-weight:800;color:${LABEL_C};letter-spacing:0.08em;text-transform:uppercase;border-bottom:1px solid ${LINE};">Medicine</th>
            <th style="padding:4px 7px;text-align:left;font-size:7.5px;font-weight:800;color:${LABEL_C};letter-spacing:0.08em;text-transform:uppercase;border-bottom:1px solid ${LINE};">Dosage</th>
            <th style="padding:4px 7px;text-align:left;font-size:7.5px;font-weight:800;color:${LABEL_C};letter-spacing:0.08em;text-transform:uppercase;border-bottom:1px solid ${LINE};">Frequency</th>
            <th style="padding:4px 7px;text-align:left;font-size:7.5px;font-weight:800;color:${LABEL_C};letter-spacing:0.08em;text-transform:uppercase;border-bottom:1px solid ${LINE};">Duration</th>
          </tr>
        </thead>
        <tbody>
          ${meds.map((m, i) =>
            `<tr style="background:${i % 2 === 0 ? "#fff" : TINT};">` +
            `<td style="padding:5px 7px;border-bottom:1px solid ${LINE};color:#888;text-align:center;">${i + 1}</td>` +
            `<td style="padding:5px 7px;border-bottom:1px solid ${LINE};font-weight:700;color:${INK};">${escapeHtml(m.drugName)}${m.instructions ? `<br/><span style="font-size:8px;color:#777;font-weight:400;">${escapeHtml(m.instructions)}</span>` : ""}</td>` +
            `<td style="padding:5px 7px;border-bottom:1px solid ${LINE};">${escapeHtml(m.dosage || "—")}</td>` +
            `<td style="padding:5px 7px;border-bottom:1px solid ${LINE};">${escapeHtml(m.frequency || "—")}</td>` +
            `<td style="padding:5px 7px;border-bottom:1px solid ${LINE};">${escapeHtml(m.duration || "—")}</td>` +
            `</tr>`
          ).join("")}
        </tbody>
      </table>`
    : `<div style="font-size:9.5px;color:#888;font-style:italic;padding:4px 0;">No medications prescribed at discharge.</div>`
)}

<!-- INSTRUCTIONS -->
${section("Discharge Instructions",
  (d.summary.dischargeInstructions ? row("General instructions", `<div style="white-space:pre-wrap;">${escapeHtml(d.summary.dischargeInstructions)}</div>`) : "") +
  (d.summary.activityRestrictions ? row("Activity restrictions", `<div style="white-space:pre-wrap;">${escapeHtml(d.summary.activityRestrictions)}</div>`) : "") +
  (d.summary.woundCareInstructions ? row("Wound / eye care", `<div style="white-space:pre-wrap;">${escapeHtml(d.summary.woundCareInstructions)}</div>`) : "") +
  (d.summary.dietAdvice ? row("Diet advice", escapeHtml(d.summary.dietAdvice)) : "")
)}

<!-- FOLLOW-UP -->
${d.summary.followUpDate
  ? section("Follow-Up",
      row("Follow-up date", `<strong>${format(d.summary.followUpDate, "EEEE, dd MMM yyyy")}</strong>`) +
      (d.summary.followUpInstructions ? row("Instructions", escapeHtml(d.summary.followUpInstructions)) : "")
    )
  : ""}

<!-- SPACER -->
<div style="flex:1;min-height:40px;"></div>

<!-- SIGNATURE -->
<div class="no-break" style="display:flex;justify-content:flex-end;margin-top:0;">
  <div style="width:210px;text-align:center;">
    ${d.visit.doctorSignatureUrl
      ? `<div style="height:34px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:2px;">
           <img src="${escapeHtml(d.visit.doctorSignatureUrl)}" alt="Signature" style="max-height:32px;max-width:190px;object-fit:contain;display:block;" />
         </div>
         <div style="height:1px;background:${BRAND};"></div>`
      : ""}
    <div style="font-size:7px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${LABEL_C};margin-top:3px;">Doctor&rsquo;s Signature</div>
    <div style="font-size:11px;font-weight:700;color:${INK};margin-top:5px;">Dr. ${escapeHtml(d.visit.doctorName)}</div>
    <div style="font-size:8.5px;color:#4A5A57;margin-top:1px;">${escapeHtml(d.visit.doctorSpecialty || "Consultant Ophthalmologist")}</div>
    ${d.visit.doctorRegNumber ? `<div style="font-size:7.5px;color:#8A9793;margin-top:1px;">Reg. No. ${escapeHtml(d.visit.doctorRegNumber)}</div>` : ""}
    <div style="font-size:7.5px;color:#8A9793;margin-top:1px;">${escapeHtml(d.visit.hospitalName)}</div>
  </div>
</div>

<!-- CLOSING -->
<div style="margin-top:12px;padding-top:7px;border-top:1px solid ${LINE};text-align:center;">
  <span style="font-size:9px;font-style:italic;color:${LABEL_C};">Thank you for trusting us with your care. Wishing you a speedy recovery.</span>
</div>

</div>

<!-- FOOTER -->
<div class="footer">
  <span>CONFIDENTIAL — For authorized clinical use only</span>
  <span>UHID: ${escapeHtml(d.patient.udid)}</span>
  <span>Generated by PPMS · Page <span class="page-num"></span> of <span class="page-total"></span></span>
</div>

</body>
</html>`;
}

export async function generateDischargeSummaryPdf(data: DischargeSummaryPdfData): Promise<Buffer> {
  return htmlToPdf(await renderDischargeSummaryHtml(data));
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  FULL EMR / LONG SUMMARY PDF                                                */
/* ─────────────────────────────────────────────────────────────────────────── */

export type FullEmrData = {
  patient: { udid: string; name: string; age: number; sex: string; mobile?: string | null; address?: string | null };
  visit: { date: Date; visitType?: string | null; hospitalName: string; hospitalLogo?: string | null; hospitalAddress?: string | null; hospitalContact?: string | null; hospitalEmail?: string | null; doctorName: string };
  generalExam?: {
    bp?: string | null; pulse?: string | null; temperature?: string | null; weight?: string | null;
    chiefComplaint?: string | null; hpi?: string | null;
    pastMedicalHistory?: string[] | null; pmhOtherText?: string | null;
    medications?: string | null; allergies?: string | null; nkda?: boolean | null;
    familyHistory?: string | null; socialHistory?: string | null;
  } | null;
  visualAcuity?: {
    reDistance?: { unaided?: string; ph?: string; bcva?: string } | null;
    leDistance?: { unaided?: string; ph?: string; bcva?: string } | null;
    reNear?: string | null; leNear?: string | null;
    reNearN?: string | null; leNearN?: string | null;
  } | null;
  iopReadings: { method: string; re?: string | null; le?: string | null; takenAt: Date }[];
  colourVision?: { re?: string | null; le?: string | null; notes?: string | null } | null;
  anteriorSegment?: Record<string, string[]> | null;
  posteriorSegment?: { data?: Record<string, string[]>; cdr?: string | null; notes?: string | null } | null;
  diagnoses: { description: string; icd10Code: string; status: string; laterality?: string | null }[];
  medications: { drugName: string; dosage?: string | null; frequency?: string | null; duration?: string | null; instructions?: string | null; route?: string | null; laterality?: string | null }[];
  opticalRx: {
    re: { sph?: string; cyl?: string; axis?: string; nearSph?: string; nearCyl?: string; nearAxis?: string };
    le: { sph?: string; cyl?: string; axis?: string; nearSph?: string; nearCyl?: string; nearAxis?: string };
  };
  investigations: { testName: string; priority: string; status: string; result?: string | null; notes?: string | null }[];
  admission?: { wardName?: string | null; bedNumber?: string | null; reason?: string | null } | null;
};

async function renderFullEmrHtml(d: FullEmrData): Promise<string> {
  const ge = d.generalExam;
  const va = d.visualAcuity;

  /* PMH */
  const rawPmh = ge?.pastMedicalHistory;
  const pmhList = (Array.isArray(rawPmh) ? rawPmh
    : (typeof rawPmh === "string" ? (() => { try { return JSON.parse(rawPmh); } catch { return []; } })() : [])
  ).filter(Boolean);

  const v2 = (x: unknown) => (x === null || x === undefined || x === "") ? "" : escapeHtml(String(x));

  /* ── Shared style constants (matches short summary) ── */
  const TH = `padding:4px 7px;background:#0C5A8C;color:#fff;font-size:8.5px;font-weight:700;text-align:left;`;
  const TD = `padding:3.5px 7px;border-bottom:1px solid #EEEEEE;font-size:9.5px;`;

  const sec = (label: string) =>
    `<div style="margin:10px 0 4px;page-break-after:avoid;break-after:avoid;">` +
    `<span style="font-size:12px;font-weight:700;color:#0C5A8C;">${label}:</span>` +
    `</div>`;

  const fbox = (label: string, value: string) =>
    `<td style="padding-right:10px;padding-bottom:6px;vertical-align:top;">` +
    `<div style="font-size:8.5px;font-weight:700;color:#0C4A7A;margin-bottom:2px;">${label}</div>` +
    `<div style="background:#EBEBEB;border-radius:4px;padding:4px 8px;font-size:9.5px;color:#111;min-height:20px;">${value || "&nbsp;"}</div>` +
    `</td>`;

  const kvRow = (label: string, value: string) =>
    `<tr>` +
    `<td style="padding:2.5px 12px 2.5px 0;font-size:9.5px;font-weight:700;color:#444;width:34%;">${label}</td>` +
    `<td style="padding:2.5px 0;font-size:9.5px;color:#1a1a1a;">${value}</td>` +
    `</tr>`;

  const textBlock = (html: string) =>
    `<div style="background:#F0F7FF;border-left:3px solid #0369A1;border-radius:0 4px 4px 0;` +
    `padding:7px 11px;font-size:9.5px;line-height:1.65;color:#1a1a1a;white-space:pre-wrap;">` +
    html + `</div>`;

  const emptyNote = `<p style="font-size:9.5px;color:#aaa;font-style:italic;padding:2px 0;">Not recorded</p>`;

  /* ── Diagnosis badge ── */
  const diagBadge = (s: string) => {
    const u = s.toUpperCase();
    const [fg, bg] = u === "RESOLVED" || u === "INACTIVE"
      ? ["#15803D", "#F0FDF4"]
      : u === "CHRONIC"
      ? ["#B45309", "#FFFBEB"]
      : ["#DC2626", "#FEF2F2"];
    return `<span style="font-size:8px;font-weight:700;color:${fg};background:${bg};padding:1px 6px;border-radius:3px;">${escapeHtml(s)}</span>`;
  };

  /* ── Priority badge ── */
  const prioBadge = (p: string) => {
    const u = p.toUpperCase();
    const [fg, bg] = u === "STAT" ? ["#92400E", "#FEF3C7"] : u === "URGENT" ? ["#B91C1C", "#FEE2E2"] : ["#0C5A8C", "#DBEAFE"];
    return `<span style="font-size:8px;font-weight:700;color:${fg};background:${bg};padding:1px 6px;border-radius:3px;">${escapeHtml(p)}</span>`;
  };

  /* ── Status badge ── */
  const statusBadge = (s: string) => {
    const l = s.toLowerCase().replace(/_/g, " ");
    const [fg, bg] = l.includes("resolv") || l.includes("complet") ? ["#15803D", "#F0FDF4"]
      : l.includes("active") ? ["#15803D", "#DCFCE7"]
      : ["#92400E", "#FEF3C7"];
    return `<span style="font-size:8px;font-weight:700;color:${fg};background:${bg};padding:1px 6px;border-radius:3px;">${escapeHtml(l)}</span>`;
  };

  /* ── Medication badge ── */
  const medBadge = (route: string | null | undefined, lat: string | null | undefined, name: string) => {
    const r = route ?? "";
    if (r === "Topical" || /eye\s*drops?|eye\s*oint/i.test(name)) {
      const lbl = lat || "OU";
      return `<span style="display:inline-block;min-width:24px;padding:1px 4px;border-radius:3px;background:#DBEAFE;color:#1D4ED8;font-size:7px;font-weight:700;text-align:center;margin-right:3px;">${escapeHtml(lbl)}</span>`;
    }
    if (/syrup|suspension/i.test(r) || /syrup|suspension/i.test(name))
      return `<span style="display:inline-block;min-width:24px;padding:1px 4px;border-radius:3px;background:#D1FAE5;color:#065F46;font-size:7px;font-weight:700;text-align:center;margin-right:3px;">SYP</span>`;
    if (r === "Oral" || /tablet|capsule/i.test(name))
      return `<span style="display:inline-block;min-width:24px;padding:1px 4px;border-radius:3px;background:#FEF3C7;color:#92400E;font-size:7px;font-weight:700;text-align:center;margin-right:3px;">T</span>`;
    return "";
  };

  /* ── Segment table (anterior / posterior data) ── */
  const renderSegment = (segData: Record<string, any> | null | undefined): string => {
    if (!segData || Object.keys(segData).length === 0) return emptyNote;
    const rows = Object.entries(segData).map(([k, v]: [string, any]) => {
      const label = k.replace(/([A-Z])/g, " $1").trim();
      const re = Array.isArray(v?.re) ? v.re.join(", ") : (v?.re ?? "—");
      const le = Array.isArray(v?.le) ? v.le.join(", ") : (v?.le ?? "—");
      return `<tr>` +
        `<td style="${TD}font-weight:600;color:#0C2461;width:130px;">${escapeHtml(label)}</td>` +
        `<td style="${TD}">${escapeHtml(re || "—")}</td>` +
        `<td style="${TD}">${escapeHtml(le || "—")}</td>` +
        `</tr>`;
    }).join("");
    return `<table style="width:100%;border-collapse:collapse;">` +
      `<thead><tr>` +
      `<th style="${TH}width:130px;">Structure</th>` +
      `<th style="${TH}">Right Eye (RE)</th>` +
      `<th style="${TH}">Left Eye (LE)</th>` +
      `</tr></thead><tbody>${rows}</tbody></table>`;
  };

  /* ── Data rows ── */
  const diagRows = d.diagnoses.length
    ? d.diagnoses.map((dx, i) =>
        `<tr style="background:${i % 2 === 0 ? "#fff" : "#F8FBFF"};">` +
        `<td style="${TD}text-align:center;color:#888;">${i + 1}</td>` +
        `<td style="${TD}font-weight:600;">${escapeHtml(dx.description)}</td>` +
        `<td style="${TD}color:#555;">${dx.laterality ? escapeHtml(dx.laterality) : ""}</td>` +
        `<td style="${TD}font-family:'Courier New',monospace;font-size:8.5px;color:#555;">${dx.icd10Code ? escapeHtml(dx.icd10Code) : ""}</td>` +
        `<td style="${TD}">${dx.status ? diagBadge(dx.status) : ""}</td>` +
        `</tr>`).join("")
    : `<tr><td colspan="5" style="padding:6px 8px;font-size:9.5px;color:#aaa;font-style:italic;">No diagnoses recorded</td></tr>`;

  const medRows = d.medications.length
    ? d.medications.map((m, i) =>
        `<tr style="background:${i % 2 === 0 ? "#fff" : "#F8FBFF"};">` +
        `<td style="${TD}text-align:center;color:#888;">${i + 1}</td>` +
        `<td style="${TD}">${medBadge(m.route, m.laterality, m.drugName)}` +
        `<span style="font-weight:700;color:#1a1a1a;">${escapeHtml(m.drugName)}</span>` +
        (m.instructions ? `<span style="font-size:8.5px;color:#777;margin-left:5px;">${escapeHtml(m.instructions)}</span>` : "") +
        `</td>` +
        `<td style="${TD}">${v2(m.dosage)}</td>` +
        `<td style="${TD}">${v2(m.frequency)}</td>` +
        `<td style="${TD}">${v2(m.duration)}</td>` +
        `</tr>`).join("")
    : `<tr><td colspan="5" style="padding:6px 8px;font-size:9.5px;color:#aaa;font-style:italic;">No medications prescribed</td></tr>`;

  const invRows = d.investigations.length
    ? d.investigations.map((inv, i) =>
        `<tr style="background:${i % 2 === 0 ? "#fff" : "#F8FBFF"};">` +
        `<td style="${TD}text-align:center;color:#888;">${i + 1}</td>` +
        `<td style="${TD}font-weight:600;">${escapeHtml(inv.testName)}</td>` +
        `<td style="${TD}">${prioBadge(inv.priority)}</td>` +
        `<td style="${TD}">${statusBadge(inv.status)}</td>` +
        `<td style="${TD}color:#555;">${v2(inv.result ?? inv.notes)}</td>` +
        `</tr>`).join("")
    : `<tr><td colspan="5" style="padding:6px 8px;font-size:9.5px;color:#aaa;font-style:italic;">No investigations ordered</td></tr>`;

  const CSS = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      font-size: 9.5px; line-height: 1.45; color: #1a1a1a;
      background: #fff;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    table { width: 100%; border-collapse: collapse; }
    .footer {
      position: running(footer);
      font-size: 7.5px; color: #888;
      display: flex; align-items: center; justify-content: space-between;
      border-top: 1px solid #ddd; padding-top: 4px;
    }
    @page { @bottom-center { content: element(footer); } }
    .page-num::after { content: counter(page); }
    .page-total::after { content: counter(pages); }
    @media print { .no-break { page-break-inside: avoid; break-inside: avoid; } }
  `;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Complete EMR — ${escapeHtml(d.patient.name)}</title>
<style>${CSS}</style>
</head>
<body>

<!-- PREMIUM GRADIENT ACCENT LINE (full bleed) -->
<div style="height:4px;background:linear-gradient(90deg,#0369A1 0%,#0EA5E9 50%,#0F766E 100%);margin:0 -14mm;"></div>

<!-- PREMIUM HEADER CARD (full bleed) -->
<div style="margin:0 -14mm;padding:11px 14mm 13px;
            background:linear-gradient(135deg,#F8FBFF 0%,#EBF4FF 55%,#F4FAFF 100%);
            page-break-after:avoid;">
  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:18px;">
    <div style="display:flex;align-items:flex-start;gap:12px;min-width:0;flex:1;">
      ${d.visit.hospitalLogo
        ? `<div style="background:#fff;border:1.5px solid #BFDBFE;border-radius:10px;padding:5px;flex-shrink:0;box-shadow:0 1px 6px rgba(3,105,161,0.10);">` +
          `<img src="${escapeHtml(d.visit.hospitalLogo)}" alt="Logo" style="width:44px;height:44px;object-fit:contain;display:block;border-radius:6px;" /></div>`
        : `<div style="background:linear-gradient(135deg,#EFF6FF,#DBEAFE);border:1.5px solid #BFDBFE;border-radius:10px;` +
          `width:54px;height:54px;flex-shrink:0;display:flex;align-items:center;justify-content:center;` +
          `color:#0369A1;font-size:24px;font-weight:900;">&#10010;</div>`}
      <div style="min-width:0;padding-top:1px;">
        <div style="font-size:15px;font-weight:800;color:#0C2461;letter-spacing:-0.2px;line-height:1.1;">
          ${escapeHtml(d.visit.hospitalName)}
        </div>
        <div style="font-size:8px;font-weight:600;color:#0369A1;margin-top:3px;letter-spacing:0.06em;text-transform:uppercase;">
          Ophthalmology &amp; Eye Care
        </div>
        ${(d.visit.hospitalAddress || d.visit.hospitalContact || d.visit.hospitalEmail)
          ? `<div style="margin-top:6px;display:flex;flex-direction:column;gap:2px;">` +
            (d.visit.hospitalAddress
              ? `<div style="font-size:7.5px;color:#475569;display:flex;align-items:flex-start;gap:3px;"><span style="color:#0369A1;font-size:8px;flex-shrink:0;">&#9679;</span>${escapeHtml(d.visit.hospitalAddress)}</div>` : "") +
            ((d.visit.hospitalContact || d.visit.hospitalEmail)
              ? `<div style="font-size:7.5px;color:#475569;display:flex;align-items:center;gap:3px;"><span style="color:#0369A1;font-size:8px;flex-shrink:0;">&#9679;</span>` +
                (d.visit.hospitalContact ? `<span>${escapeHtml(d.visit.hospitalContact)}</span>` : "") +
                (d.visit.hospitalContact && d.visit.hospitalEmail ? `<span style="color:#CBD5E1;padding:0 4px;">|</span>` : "") +
                (d.visit.hospitalEmail ? `<span>${escapeHtml(d.visit.hospitalEmail)}</span>` : "") +
                `</div>` : "") +
            `</div>` : ""}
      </div>
    </div>
    <div style="text-align:right;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;padding-top:2px;">
      <div style="font-size:7px;font-weight:700;letter-spacing:0.28em;text-transform:uppercase;color:#0EA5E9;margin-bottom:5px;">
        Clinical Record
      </div>
      <div style="font-size:18px;font-weight:900;color:#0C2461;letter-spacing:0.07em;text-transform:uppercase;line-height:1.0;white-space:nowrap;">
        COMPLETE
      </div>
      <div style="font-size:18px;font-weight:900;color:#0C2461;letter-spacing:0.07em;text-transform:uppercase;line-height:1.05;white-space:nowrap;margin-top:1px;">
        EMR SUMMARY
      </div>
      <div style="height:2px;width:100%;background:linear-gradient(90deg,transparent,#0369A1,#0EA5E9);border-radius:1px;margin-top:6px;"></div>
    </div>
  </div>
</div>

<!-- SOFT GRADIENT DIVIDER (full bleed) -->
<div style="height:1px;background:linear-gradient(90deg,#BFDBFE,#BAE6FD,#BFDBFE);margin:0 -14mm 6px;"></div>

<!-- PATIENT INFO -->
<table style="width:100%;border-collapse:collapse;">
  <tbody>
    <tr>
      ${fbox("Patient Name", escapeHtml(d.patient.name))}
      ${fbox("UHID / MR No.", escapeHtml(d.patient.udid))}
      ${fbox("Date of Visit", format(d.visit.date, "dd MMM yyyy"))}
    </tr>
    <tr>
      ${fbox("Age / Gender", `${d.patient.age} yrs / ${escapeHtml(d.patient.sex)}`)}
      ${fbox("Mobile", d.patient.mobile ? escapeHtml(d.patient.mobile) : "—")}
      ${fbox("Consultant", `Dr. ${escapeHtml(d.visit.doctorName)}`)}
    </tr>
    <tr>
      ${fbox("Visit Type", escapeHtml(d.visit.visitType ?? "Consultation"))}
      ${fbox("Visit Time", format(d.visit.date, "hh:mm a") + " IST")}
      ${d.patient.address ? fbox("Address", escapeHtml(d.patient.address)) : `<td></td>`}
    </tr>
  </tbody>
</table>

<!-- CHIEF COMPLAINT & HPI -->
${ge?.chiefComplaint || ge?.hpi
  ? sec("Chief Complaint & History of Present Illness") +
    (ge.chiefComplaint
      ? `<p style="font-size:10.5px;font-weight:600;color:#0C2E6B;padding:2px 0 3px;">${escapeHtml(ge.chiefComplaint)}</p>` : "") +
    (ge.hpi ? textBlock(escapeHtml(ge.hpi)) : "")
  : ""}

<!-- PAST MEDICAL & DRUG HISTORY -->
${sec("Past Medical &amp; Drug History")}
${ge
  ? textBlock(
      `<strong>PMH:</strong> ${pmhList.length ? pmhList.map(escapeHtml).join(", ") + (ge.pmhOtherText ? `, ${escapeHtml(ge.pmhOtherText)}` : "") : "Nil"}` +
      (ge.medications ? `<br/><strong>Current Medications:</strong> ${escapeHtml(ge.medications)}` : "") +
      (ge.nkda ? `<br/><strong style="color:#059669;">✓ NKDA</strong> — No Known Drug Allergies`
        : ge.allergies ? `<br/><strong style="color:#DC2626;">Allergies:</strong> ${escapeHtml(ge.allergies)}` : "") +
      (ge.familyHistory ? `<br/><strong>Family History:</strong> ${escapeHtml(ge.familyHistory)}` : "") +
      (ge.socialHistory ? `<br/><strong>Social History:</strong> ${escapeHtml(ge.socialHistory)}` : ""))
  : emptyNote}

<!-- VITALS -->
${sec("Vitals &amp; General Examination")}
${ge
  ? `<table style="width:100%;border-collapse:collapse;"><tbody><tr>` +
    fbox("Blood Pressure", ge.bp ? escapeHtml(ge.bp) + " mmHg" : "—") +
    fbox("Pulse Rate", ge.pulse ? escapeHtml(ge.pulse) + " bpm" : "—") +
    fbox("Temperature", ge.temperature ? escapeHtml(ge.temperature) : "—") +
    fbox("Body Weight", ge.weight ? escapeHtml(ge.weight) : "—") +
    `</tr></tbody></table>`
  : emptyNote}

<!-- VISUAL ACUITY -->
${sec("Visual Acuity")}
${va
  ? `<table style="width:100%;border-collapse:collapse;">
      <thead><tr>
        <th style="${TH}width:110px;"></th>
        <th style="${TH}">Unaided / UCVA</th>
        <th style="${TH}">Pinhole (PH)</th>
        <th style="${TH}">Best Corrected (BCVA)</th>
      </tr></thead>
      <tbody>
        <tr style="background:#fff;">
          <td style="${TD}font-weight:600;color:#0C2461;">RE <span style="font-weight:400;color:#777;font-size:8.5px;">(Distance)</span></td>
          <td style="${TD}">${v2(va.reDistance?.unaided)}</td>
          <td style="${TD}">${v2(va.reDistance?.ph)}</td>
          <td style="${TD}">${v2(va.reDistance?.bcva)}</td>
        </tr>
        <tr style="background:#F8FBFF;">
          <td style="${TD}font-weight:600;color:#0C2461;">LE <span style="font-weight:400;color:#777;font-size:8.5px;">(Distance)</span></td>
          <td style="${TD}">${v2(va.leDistance?.unaided)}</td>
          <td style="${TD}">${v2(va.leDistance?.ph)}</td>
          <td style="${TD}">${v2(va.leDistance?.bcva)}</td>
        </tr>
        <tr style="background:#fff;">
          <td style="${TD}font-weight:600;color:#0C2461;">RE <span style="font-weight:400;color:#777;font-size:8.5px;">(Near)</span></td>
          <td style="${TD}" colspan="2">${v2(va.reNear)}</td>
          <td style="${TD}">${v2(va.reNearN)}</td>
        </tr>
        <tr style="background:#F8FBFF;">
          <td style="${TD}font-weight:600;color:#0C2461;">LE <span style="font-weight:400;color:#777;font-size:8.5px;">(Near)</span></td>
          <td style="${TD}" colspan="2">${v2(va.leNear)}</td>
          <td style="${TD}">${v2(va.leNearN)}</td>
        </tr>
      </tbody>
    </table>`
  : emptyNote}

<!-- IOP -->
${sec("Intraocular Pressure (IOP)")}
${d.iopReadings.length
  ? `<table style="width:100%;border-collapse:collapse;">
      <thead><tr>
        <th style="${TH}">Method</th>
        <th style="${TH}">Right Eye (RE)</th>
        <th style="${TH}">Left Eye (LE)</th>
        <th style="${TH}width:70px;">Time</th>
      </tr></thead>
      <tbody>
        ${d.iopReadings.map((r, i) =>
          `<tr style="background:${i % 2 === 0 ? "#fff" : "#F8FBFF"};">` +
          `<td style="${TD}font-weight:600;color:#0C2461;">${v2(r.method)}</td>` +
          `<td style="${TD}">${v2(r.re)}</td>` +
          `<td style="${TD}">${v2(r.le)}</td>` +
          `<td style="${TD}color:#555;">${format(new Date(r.takenAt), "hh:mm a")}</td>` +
          `</tr>`).join("")}
      </tbody>
    </table>`
  : emptyNote}

<!-- COLOUR VISION -->
${d.colourVision
  ? sec("Colour Vision") +
    `<table style="width:100%;border-collapse:collapse;"><tbody><tr>` +
    fbox("Right Eye (RE)", v2(d.colourVision.re)) +
    fbox("Left Eye (LE)", v2(d.colourVision.le)) +
    (d.colourVision.notes ? fbox("Notes", escapeHtml(d.colourVision.notes)) : `<td></td>`) +
    `</tr></tbody></table>`
  : ""}

<!-- ANTERIOR SEGMENT -->
${sec("Anterior Segment Examination")}
${renderSegment(d.anteriorSegment as any)}

<!-- POSTERIOR SEGMENT -->
${sec("Posterior Segment Examination")}
${(() => {
  const ps = d.posteriorSegment as any;
  if (!ps) return emptyNote;
  return renderSegment(ps.data) +
    (ps.cdr
      ? `<div style="margin-top:5px;font-size:9.5px;"><span style="font-weight:700;color:#0C2461;">CDR:</span> ${escapeHtml(ps.cdr)}</div>`
      : "") +
    (ps.notes ? `<div style="margin-top:4px;">${textBlock(escapeHtml(ps.notes))}</div>` : "");
})()}

<!-- ASSESSMENT / DIAGNOSIS -->
${sec("Assessment / Diagnosis")}
${d.diagnoses.length
  ? `<table style="width:100%;border-collapse:collapse;">
      <thead><tr>
        <th style="${TH}width:28px;text-align:center;">#</th>
        <th style="${TH}">Diagnosis</th>
        <th style="${TH}width:90px;">Laterality</th>
        <th style="${TH}width:75px;">ICD-10</th>
        <th style="${TH}width:78px;">Status</th>
      </tr></thead>
      <tbody>${diagRows}</tbody>
    </table>`
  : `<p style="color:#aaa;font-style:italic;padding:2px 0;font-size:9.5px;">No diagnosis recorded</p>`}

<!-- MEDICATIONS PRESCRIBED -->
${sec("Medications Prescribed")}
<table style="width:100%;border-collapse:collapse;">
  <thead><tr>
    <th style="${TH}width:28px;text-align:center;">#</th>
    <th style="${TH}">Medicine</th>
    <th style="${TH}width:65px;">Dosage</th>
    <th style="${TH}width:95px;">Frequency</th>
    <th style="${TH}width:65px;">Duration</th>
  </tr></thead>
  <tbody>${medRows}</tbody>
</table>

<!-- OPTICAL PRESCRIPTION -->
${sec("Optical Prescription (Refraction)")}
<table style="width:100%;border-collapse:collapse;">
  <thead><tr>
    <th style="${TH}width:110px;">Eye</th>
    <th style="${TH}text-align:center;">SPH</th>
    <th style="${TH}text-align:center;">CYL</th>
    <th style="${TH}text-align:center;">Axis</th>
    <th style="${TH}text-align:center;">Near Add</th>
  </tr></thead>
  <tbody>
    ${["re", "le"].flatMap((eye, ei) =>
      [["Distance", "sph", "cyl", "axis", "nearSph"], ["Near Add", "nearSph", "nearCyl", "nearAxis", ""]].map(([sub, s, c, a, n], ri) => {
        const rx = d.opticalRx[eye as "re" | "le"] as any;
        const hasData = rx?.[s] || rx?.[c] || rx?.[a];
        if (sub === "Near Add" && !hasData) return "";
        return `<tr style="background:${(ei * 2 + ri) % 2 === 0 ? "#fff" : "#F8FBFF"};">` +
          `<td style="${TD}font-weight:600;color:#0C2461;">${eye.toUpperCase()} <span style="font-weight:400;color:#777;font-size:8.5px;">(${sub})</span></td>` +
          `<td style="${TD}text-align:center;">${v2(rx?.[s])}</td>` +
          `<td style="${TD}text-align:center;">${v2(rx?.[c])}</td>` +
          `<td style="${TD}text-align:center;">${v2(rx?.[a])}</td>` +
          `<td style="${TD}text-align:center;">${sub === "Near Add" ? v2(rx?.[n]) : ""}</td>` +
          `</tr>`;
      })).join("")}
  </tbody>
</table>

<!-- INVESTIGATIONS -->
${sec("Investigations Ordered")}
${d.investigations.length
  ? `<table style="width:100%;border-collapse:collapse;">
      <thead><tr>
        <th style="${TH}width:28px;text-align:center;">#</th>
        <th style="${TH}">Test / Investigation</th>
        <th style="${TH}width:72px;">Priority</th>
        <th style="${TH}width:80px;">Status</th>
        <th style="${TH}">Result / Notes</th>
      </tr></thead>
      <tbody>${invRows}</tbody>
    </table>`
  : `<p style="color:#aaa;font-style:italic;padding:2px 0;font-size:9.5px;">No investigations ordered</p>`}

<!-- ADMISSION / DISPOSITION -->
${d.admission
  ? sec("Admission / Disposition") +
    `<table style="width:100%;border-collapse:collapse;"><tbody>` +
    kvRow("Ward", v2(d.admission.wardName)) +
    kvRow("Bed Number", v2(d.admission.bedNumber)) +
    (d.admission.reason ? kvRow("Reason", escapeHtml(d.admission.reason)) : "") +
    `</tbody></table>`
  : ""}

<!-- DOCTOR SIGNATURE -->
<div class="no-break" style="margin-top:12px;padding-top:4px;">
  <div style="font-size:11.5px;font-weight:700;color:#0C2E6B;">Dr. ${escapeHtml(d.visit.doctorName)}</div>
  <div style="font-size:9px;color:#555;margin-top:2px;">Consultant Ophthalmologist</div>
  <div style="font-size:8.5px;color:#888;margin-top:1px;">${escapeHtml(d.visit.hospitalName)}</div>
</div>

<!-- RUNNING FOOTER -->
<div class="footer">
  <span>CONFIDENTIAL — For authorized clinical use only</span>
  <span>UHID: ${escapeHtml(d.patient.udid)}</span>
  <span>Generated by PPMS · Powered by RAPDFLY · Page <span class="page-num"></span> of <span class="page-total"></span></span>
</div>

</body>
</html>`;
}

export async function generateFullEmrPdf(data: FullEmrData): Promise<Buffer> {
  return htmlToPdf(await renderFullEmrHtml(data));
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  ALL VISITS COMBINED PDF                                                    */
/* ─────────────────────────────────────────────────────────────────────────── */

export async function generateAllVisitsSummaryPdf(visits: any[]): Promise<Buffer> {
  if (visits.length === 0) return Buffer.from([]);

  function parseJ3(v: any) {
    if (!v) return null;
    try { return typeof v === "string" ? JSON.parse(v) : v; } catch { return null; }
  }

  function buildData(visit: any): FullEmrData {
    const ge  = visit.generalExam;
    const va  = visit.visualAcuity;
    const ref = visit.refraction;
    const reVA  = parseJ3(va?.re);
    const leVA  = parseJ3(va?.le);
    const reRef = parseJ3(ref?.re);
    const leRef = parseJ3(ref?.le);
    return {
      patient: {
        udid: visit.patient.udid, name: visit.patient.name,
        age: visit.patient.age, sex: visit.patient.sex,
        mobile: (visit.patient as any).mobile ?? null,
        address: (visit.patient as any).address ?? null,
      },
      visit: {
        date: visit.date, visitType: visit.visitType ?? null,
        hospitalName: visit.hospital.name,
        hospitalLogo: (visit.hospital as any).logoUrl ?? null,
        hospitalAddress: (visit.hospital as any).address ?? null,
        hospitalContact: (visit.hospital as any).contact ?? null,
        hospitalEmail: (visit.hospital as any).email ?? null,
        doctorName: visit.doctor.name,
      },
      generalExam: ge ? {
        bp: ge.bp, pulse: ge.pulse, temperature: ge.temperature, weight: ge.weight,
        chiefComplaint: ge.chiefComplaint, hpi: ge.hpi,
        pastMedicalHistory: ge.pastMedicalHistory ?? [],
        pmhOtherText: ge.pmhOtherText, medications: ge.medications,
        allergies: ge.allergies, nkda: ge.nkda,
        familyHistory: ge.familyHistory, socialHistory: ge.socialHistory,
      } : null,
      visualAcuity: va ? {
        reDistance: reVA ? { unaided: reVA.unaided, ph: reVA.pinhole, bcva: reVA.aided } : null,
        leDistance: leVA ? { unaided: leVA.unaided, ph: leVA.pinhole, bcva: leVA.aided } : null,
        reNear: reVA?.near ?? null, leNear: leVA?.near ?? null,
      } : null,
      iopReadings: (visit.iopReadings ?? []).map((r: any) => ({
        method: r.method ?? r.eye ?? "Applanation",
        re: r.eye === "RE" || r.eye === "Both" ? `${r.value} mmHg` : null,
        le: r.eye === "LE" || r.eye === "Both" ? `${r.value} mmHg` : null,
        takenAt: r.takenAt ?? visit.date,
      })),
      colourVision: null,
      anteriorSegment: null,
      posteriorSegment: null,
      diagnoses: (visit.diagnoses ?? []).map((d: any) => ({ description: d.description, icd10Code: d.icd10Code ?? "", status: d.status, laterality: d.laterality ?? null })),
      medications: (visit.medications ?? []).map((m: any) => ({ drugName: m.drugName, dosage: m.dosage ?? null, frequency: m.frequency ?? null, duration: m.duration ?? null, instructions: m.instructions ?? null, route: m.route ?? null, laterality: m.laterality ?? null })),
      opticalRx: {
        re: { sph: reRef?.sph, cyl: reRef?.cyl, axis: reRef?.axis, nearSph: reRef?.nearSph },
        le: { sph: leRef?.sph, cyl: leRef?.cyl, axis: leRef?.axis, nearSph: leRef?.nearSph },
      },
      investigations: (visit.investigationOrders ?? []).map((o: any) => ({ testName: o.testName, priority: o.priority ?? "Routine", status: o.status, result: o.resultRef ?? null, notes: o.notes ?? null })),
      admission: null,
    };
  }

  const patient = visits[0].patient;
  const qr = await makeQr(`PPMS-${patient.udid}-AllVisits`);

  const visitBlocks = visits.map((visit, idx) => {
    const d = buildData(visit);
    const ge = d.generalExam;
    const va = d.visualAcuity;

    const diagRows = d.diagnoses.length
      ? d.diagnoses.map((dx, i) => `<tr><td class="td-num">${i + 1}</td><td class="td-head">${escapeHtml(dx.description)}</td><td><span class="td-mono">${val(dx.icd10Code)}</span></td><td>${val(dx.laterality)}</td><td>${badgeStatus(dx.status)}</td></tr>`).join("")
      : `<tr class="empty-row"><td colspan="5">No diagnoses recorded</td></tr>`;

    const pdfMedBadge4 = (route: string | null | undefined, lat: string | null | undefined, name: string) => {
      const r = route ?? "";
      if (r === "Topical" || /eye\s*drops?|eye\s*oint/i.test(name)) {
        const lbl = lat || "OU";
        return `<span style="display:inline-block;min-width:22px;padding:1px 4px;border-radius:3px;background:#DBEAFE;color:#1D4ED8;font-size:7px;font-weight:700;text-align:center;margin-right:3px;">${escapeHtml(lbl)}</span>`;
      }
      if (/syrup|suspension/i.test(r) || /syrup|suspension/i.test(name)) {
        return `<span style="display:inline-block;min-width:22px;padding:1px 4px;border-radius:3px;background:#D1FAE5;color:#065F46;font-size:7px;font-weight:700;text-align:center;margin-right:3px;">SYP</span>`;
      }
      if (r === "Oral" || /tablet|capsule/i.test(name)) {
        return `<span style="display:inline-block;min-width:22px;padding:1px 4px;border-radius:3px;background:#FEF3C7;color:#92400E;font-size:7px;font-weight:700;text-align:center;margin-right:3px;">T</span>`;
      }
      return "";
    };
    const medRows = d.medications.length
      ? d.medications.map((m, i) => `<tr><td class="td-num">${i + 1}</td><td><div class="drug-name">${pdfMedBadge4(m.route, m.laterality, m.drugName)}${escapeHtml(m.drugName)}</div>${m.instructions ? `<div class="drug-sub">${escapeHtml(m.instructions)}</div>` : ""}</td><td>${val(m.dosage)}</td><td>${val(m.frequency)}</td><td>${val(m.duration)}</td></tr>`).join("")
      : `<tr class="empty-row"><td colspan="5">No medications prescribed</td></tr>`;

    const invRows = d.investigations.length
      ? d.investigations.map((o, i) => `<tr><td class="td-num">${i + 1}</td><td class="td-head">${val(o.testName)}</td><td>${badgePriority(o.priority)}</td><td>${badgeStatus(o.status)}</td></tr>`).join("")
      : `<tr class="empty-row"><td colspan="4">No investigations ordered</td></tr>`;

    const pageBreak = idx > 0 ? `style="page-break-before:always;padding-top:8px;"` : "";

    return `
    <div class="visit-section" ${pageBreak}>
      <!-- Visit header bar -->
      <div style="background:#0D4A45;color:#fff;border-radius:6px;padding:9px 14px;display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <div>
          <span style="font-size:13px;font-weight:800;">Visit #${visit.visitNumber ?? (visits.length - idx)}</span>
          <span style="font-size:10px;opacity:0.75;margin-left:10px;">${escapeHtml(visit.visitType ?? "Consultation")}</span>
        </div>
        <div style="font-size:9.5px;opacity:0.8;text-align:right;">
          ${format(new Date(visit.date), "dd MMM yyyy, hh:mm a")}<br/>
          ${escapeHtml(visit.hospital?.name ?? "")} · Dr. ${escapeHtml(visit.doctor?.name ?? "")}
        </div>
      </div>

      ${ge?.chiefComplaint ? `${secHdr("Chief Complaint")}<div class="text-block">${escapeHtml(ge.chiefComplaint)}</div>` : ""}

      ${ge ? `${secHdr("Vitals")}
      <div class="info-grid">
        <div class="ig-item"><div class="ig-label">BP</div><div class="ig-value" style="font-size:13px;">${val(ge.bp)}</div></div>
        <div class="ig-item"><div class="ig-label">Pulse</div><div class="ig-value" style="font-size:13px;">${val(ge.pulse)}</div></div>
        <div class="ig-item"><div class="ig-label">Temp</div><div class="ig-value" style="font-size:13px;">${val(ge.temperature)}</div></div>
        <div class="ig-item"><div class="ig-label">Weight</div><div class="ig-value" style="font-size:13px;">${val(ge.weight)}</div></div>
      </div>` : ""}

      ${va ? `${secHdr("Visual Acuity")}
      <table>
        <thead><tr><th style="width:110px"></th><th>Unaided</th><th>PH</th><th>BCVA</th></tr></thead>
        <tbody>
          <tr><td class="td-head">RE Distance</td><td>${val(va.reDistance?.unaided)}</td><td>${val(va.reDistance?.ph)}</td><td>${val(va.reDistance?.bcva)}</td></tr>
          <tr><td class="td-head">LE Distance</td><td>${val(va.leDistance?.unaided)}</td><td>${val(va.leDistance?.ph)}</td><td>${val(va.leDistance?.bcva)}</td></tr>
          <tr><td class="td-head">RE Near</td><td colspan="3">${val(va.reNear)}</td></tr>
          <tr><td class="td-head">LE Near</td><td colspan="3">${val(va.leNear)}</td></tr>
        </tbody>
      </table>` : ""}

      ${secHdr("Assessment / Diagnosis")}
      <table>
        <thead><tr><th style="width:24px">#</th><th>Diagnosis</th><th style="width:80px">ICD-10</th><th style="width:90px">Laterality</th><th style="width:90px">Status</th></tr></thead>
        <tbody>${diagRows}</tbody>
      </table>

      ${secHdr("Medications")}
      <table>
        <thead><tr><th style="width:24px">#</th><th>Drug</th><th style="width:80px">Dosage</th><th style="width:110px">Frequency</th><th style="width:80px">Duration</th></tr></thead>
        <tbody>${medRows}</tbody>
      </table>

      ${secHdr("Investigations")}
      <table>
        <thead><tr><th style="width:24px">#</th><th>Test</th><th style="width:80px">Priority</th><th style="width:90px">Status</th></tr></thead>
        <tbody>${invRows}</tbody>
      </table>
    </div>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>All Visit History — ${escapeHtml(patient.name)}</title>
<style>${SHARED_CSS}
.visit-section { margin-bottom: 8px; }
</style>
</head>
<body>
  <div class="top-bar"></div>
  <div class="letterhead">
    <div class="lh-logo">✚</div>
    <div class="lh-hosp">
      <div class="lh-hosp-name">Complete Visit History</div>
      <div class="lh-hosp-sub">All recorded visits — chronological order</div>
    </div>
    <div class="lh-right">
      <span class="doc-name">${escapeHtml(patient.name)}</span>
      UHID: ${escapeHtml(patient.udid)}<br/>
      ${patient.age} yrs / ${escapeHtml(patient.sex)}<br/>
      Generated: ${format(new Date(), "dd MMM yyyy, hh:mm a")}
    </div>
  </div>
  <div class="doc-type-bar">Complete Visit History — ${visits.length} Visit${visits.length !== 1 ? "s" : ""}</div>

  ${patientCard({ name: patient.name, udid: patient.udid, age: patient.age, sex: patient.sex, mobile: (patient as any).mobile ?? null }, "", visits[0].date, visits[0].hospital?.name ?? "")}

  ${visitBlocks}

  ${bottomSection("", visits[0].hospital?.name ?? "", qr, patient.udid)}
  ${footerHtml(patient.udid, "Complete Visit History")}
</body>
</html>`;

  return htmlToPdf(html);
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  VISIT SUMMARY PDF (from raw Prisma visit record)                           */
/* ─────────────────────────────────────────────────────────────────────────── */

function parseJ2(v: any) {
  if (!v) return null;
  try { return typeof v === "string" ? JSON.parse(v) : v; } catch { return null; }
}

export async function generateVisitSummaryPdf(visit: any): Promise<Buffer> {
  const ge  = visit.generalExam;
  const va  = visit.visualAcuity;
  const ref = visit.refraction;
  const ant = visit.anteriorSegment;
  const pos = visit.posteriorSegment;
  const reVA  = parseJ2(va?.re);
  const leVA  = parseJ2(va?.le);
  const reRef = parseJ2(ref?.re);
  const leRef = parseJ2(ref?.le);

  const data: FullEmrData = {
    patient: {
      udid: visit.patient.udid, name: visit.patient.name,
      age: visit.patient.age, sex: visit.patient.sex,
      mobile: (visit.patient as any).mobile ?? null,
      address: (visit.patient as any).address ?? null,
    },
    visit: {
      date: visit.date, visitType: visit.visitType ?? null,
      hospitalName: visit.hospital.name,
      hospitalLogo: (visit.hospital as any).logoUrl ?? null,
      hospitalAddress: (visit.hospital as any).address ?? null,
      hospitalContact: (visit.hospital as any).contact ?? null,
      hospitalEmail: (visit.hospital as any).email ?? null,
      doctorName: visit.doctor.name,
    },
    generalExam: ge ? {
      bp: ge.bp, pulse: ge.pulse, temperature: ge.temperature, weight: ge.weight,
      chiefComplaint: ge.chiefComplaint, hpi: ge.hpi,
      pastMedicalHistory: ge.pastMedicalHistory ?? [], pmhOtherText: ge.pmhOtherText,
      medications: ge.medications, allergies: ge.allergies, nkda: ge.nkda,
      familyHistory: ge.familyHistory, socialHistory: ge.socialHistory,
    } : null,
    visualAcuity: va ? {
      reDistance: reVA ? { unaided: reVA.unaided, ph: reVA.pinhole, bcva: reVA.aided } : null,
      leDistance: leVA ? { unaided: leVA.unaided, ph: leVA.pinhole, bcva: leVA.aided } : null,
      reNear: reVA?.near ?? null, leNear: leVA?.near ?? null,
    } : null,
    iopReadings: (visit.iopReadings ?? []).map((r: any) => ({
      method: r.method ?? r.eye ?? "Applanation",
      re: r.eye === "RE" || r.eye === "Both" ? `${r.value} mmHg` : null,
      le: r.eye === "LE" || r.eye === "Both" ? `${r.value} mmHg` : null,
      takenAt: r.takenAt ?? visit.date,
    })),
    colourVision: (visit as any).colourVisionCS ? {
      re: (visit as any).colourVisionCS.re ?? null,
      le: (visit as any).colourVisionCS.le ?? null,
      notes: (visit as any).colourVisionCS.notes ?? null,
    } : null,
    anteriorSegment: ant ? (parseJ2(ant.re) || parseJ2(ant.le) ? { re: parseJ2(ant.re), le: parseJ2(ant.le) } : null) : null,
    posteriorSegment: pos ? { data: { re: parseJ2(pos.re), le: parseJ2(pos.le) }, cdr: pos.cdr ?? null, notes: pos.notes ?? null } : null,
    diagnoses: (visit.diagnoses ?? []).map((d: any) => ({ description: d.description, icd10Code: d.icd10Code ?? "", status: d.status, laterality: d.laterality ?? null })),
    medications: (visit.medications ?? []).map((m: any) => ({ drugName: m.drugName, dosage: m.dosage ?? null, frequency: m.frequency ?? null, duration: m.duration ?? null, instructions: m.instructions ?? null, route: m.route ?? null, laterality: m.laterality ?? null })),
    opticalRx: {
      re: { sph: reRef?.sph, cyl: reRef?.cyl, axis: reRef?.axis, nearSph: reRef?.nearSph, nearCyl: reRef?.nearCyl, nearAxis: reRef?.nearAxis },
      le: { sph: leRef?.sph, cyl: leRef?.cyl, axis: leRef?.axis, nearSph: leRef?.nearSph, nearCyl: leRef?.nearCyl, nearAxis: leRef?.nearAxis },
    },
    investigations: (visit.investigationOrders ?? []).map((o: any) => ({ testName: o.testName, priority: o.priority ?? "Routine", status: o.status, result: o.resultRef ?? null, notes: o.notes ?? null })),
    admission: (visit as any).admission ?? null,
  };

  return htmlToPdf(await renderFullEmrHtml(data));
}
