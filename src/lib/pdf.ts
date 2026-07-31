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
    margin: -12mm -14mm 0;
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

  /* Surgical counselling box */
  .surgery-box {
    background: #FFF1F2;
    border: 1px solid #FECDD3;
    border-left: 4px solid #E11D48;
    border-radius: 0 8px 8px 0;
    padding: 10px 14px;
    font-size: 11px;
    margin-top: 8px;
    page-break-inside: avoid;
  }

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
  medications: { drugName: string; dosage?: string | null; frequency?: string | null; duration?: string | null; instructions?: string | null }[];
  opticalRx: {
    re: { sph?: string; cyl?: string; axis?: string; nearSph?: string; nearCyl?: string; nearAxis?: string };
    le: { sph?: string; cyl?: string; axis?: string; nearSph?: string; nearCyl?: string; nearAxis?: string };
  };
};

async function renderPrescriptionHtml(data: PrescriptionData): Promise<string> {
  const qr = await makeQr(`PPMS-${data.patient.udid}`);

  const medRows = data.medications.length
    ? data.medications.map((m, i) => `
      <tr>
        <td class="td-num">${i + 1}</td>
        <td><div class="drug-name">${escapeHtml(m.drugName)}</div>${m.instructions ? `<div class="drug-sub">${escapeHtml(m.instructions)}</div>` : ""}</td>
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
    hospitalName: string; hospitalAddress?: string | null; hospitalContact?: string | null; hospitalEmail?: string | null;
    doctorName: string;
    followUpDate?: Date | null;
    referralEnabled?: boolean;
    referralNote?: string | null;
  };
  chiefComplaint?: string | null;
  diagnoses: { description: string; icd10Code: string; status: string; laterality?: string | null }[];
  medications: { drugName: string; dosage?: string | null; frequency?: string | null; duration?: string | null; instructions?: string | null }[];
  investigations: { testName: string; category: string; priority: string; laterality?: string | null; status: string }[];
  opticalRx?: {
    re: { sph?: string; cyl?: string; axis?: string; nearSph?: string };
    le: { sph?: string; cyl?: string; axis?: string; nearSph?: string };
  } | null;
  surgicalCounselling?: { surgeryType?: string | null; surgeryDate?: Date | null; notes?: string | null } | null;
};

async function renderShortSummaryHtml(d: ShortSummaryData): Promise<string> {
  const qr = await makeQr(`PPMS-${d.patient.udid}-${format(d.visit.date, "yyyyMMdd")}`);

  /* Local helper: empty string fallback (no em-dash) */
  const v2 = (x: unknown) => (x === null || x === undefined || x === "") ? "" : escapeHtml(String(x));

  /* Custom header for hospital summary */
  const hospSubLines = [
    d.visit.hospitalAddress,
    d.visit.hospitalContact,
    d.visit.hospitalEmail,
  ].filter((x): x is string => Boolean(x)).map(escapeHtml).join(" &nbsp;|&nbsp; ");

  const summaryHeader = `
  <div class="top-bar"></div>
  <div class="letterhead">
    <div class="lh-logo">✚</div>
    <div class="lh-hosp">
      <div class="lh-hosp-name">${escapeHtml(d.visit.hospitalName)}</div>
      ${hospSubLines ? `<div class="lh-hosp-sub">${hospSubLines}</div>` : ""}
    </div>
    <div class="lh-right">
      <span class="doc-name">Dr. ${escapeHtml(d.visit.doctorName)}</span>
      ${format(d.visit.date, "dd MMM yyyy")}<br/>
      ${format(d.visit.date, "hh:mm a")} IST
    </div>
  </div>
  <div class="doc-type-bar">Consultation Summary</div>`;

  /* Impression rows — # / Diagnosis / Laterality only */
  const impressionRows = d.diagnoses.length
    ? d.diagnoses.map((dx, i) => `
      <tr>
        <td class="td-num">${i + 1}</td>
        <td class="td-head">${escapeHtml(dx.description)}</td>
        <td>${dx.laterality ? escapeHtml(dx.laterality) : ""}</td>
      </tr>`).join("")
    : `<tr class="empty-row"><td colspan="3">No diagnosis recorded</td></tr>`;

  /* Medications */
  const medRows = d.medications.length
    ? d.medications.map((m, i) => `
      <tr>
        <td class="td-num">${i + 1}</td>
        <td><div class="drug-name">${escapeHtml(m.drugName)}</div>${m.instructions ? `<div class="drug-sub">${escapeHtml(m.instructions)}</div>` : ""}</td>
        <td class="drug-dose">${v2(m.dosage)}</td>
        <td>${v2(m.frequency)}</td>
        <td>${v2(m.duration)}</td>
      </tr>`).join("")
    : `<tr class="empty-row"><td colspan="5">No medications prescribed</td></tr>`;

  /* Optical Rx */
  const hasRx = d.opticalRx && (
    d.opticalRx.re.sph || d.opticalRx.re.cyl || d.opticalRx.re.axis ||
    d.opticalRx.le.sph || d.opticalRx.le.cyl || d.opticalRx.le.axis ||
    d.opticalRx.re.nearSph || d.opticalRx.le.nearSph
  );
  const rxRow = (eye: string, sub: string, sph?: string, cyl?: string, axis?: string) =>
    `<tr><td class="rx-eye">${eye}<br/><span class="rx-eye-sub">${sub}</span></td><td>${v2(sph)}</td><td>${v2(cyl)}</td><td>${v2(axis)}</td></tr>`;

  const opticalBlock = hasRx ? `
    ${secHdr("Optical Prescription")}
    <table class="rx-table">
      <thead><tr><th style="width:110px;text-align:left"></th><th>Sphere (SPH)</th><th>Cylinder (CYL)</th><th>Axis</th></tr></thead>
      <tbody>
        ${rxRow("Right Eye (RE)", "Distance", d.opticalRx!.re.sph, d.opticalRx!.re.cyl, d.opticalRx!.re.axis)}
        ${rxRow("Left Eye (LE)", "Distance", d.opticalRx!.le.sph, d.opticalRx!.le.cyl, d.opticalRx!.le.axis)}
        ${d.opticalRx!.re.nearSph || d.opticalRx!.le.nearSph ? rxRow("Right Eye (RE)", "Near Add", d.opticalRx!.re.nearSph) + rxRow("Left Eye (LE)", "Near Add", d.opticalRx!.le.nearSph) : ""}
      </tbody>
    </table>` : "";

  /* Advice & follow-up */
  const followUpLine = d.visit.followUpDate
    ? `In view of the above, please review on <strong>${format(new Date(d.visit.followUpDate), "EEEE, dd MMM yyyy")}</strong>.`
    : "";
  const referralLine = d.visit.referralEnabled && d.visit.referralNote
    ? `Referred to: ${escapeHtml(d.visit.referralNote)}`
    : "";

  const surgRow = d.surgicalCounselling?.surgeryType ? {
    type: d.surgicalCounselling.surgeryType,
    date: d.surgicalCounselling.surgeryDate ? format(new Date(d.surgicalCounselling.surgeryDate), "dd MMM yyyy") : null,
    notes: d.surgicalCounselling.notes,
  } : null;

  const adviceBlock = (followUpLine || referralLine || surgRow) ? `
  ${secHdr("Advice & Follow-up")}
  ${followUpLine || referralLine ? `<div class="advice-box">
    ${followUpLine ? `<div class="advice-row"><span class="advice-val">${followUpLine}</span></div>` : ""}
    ${referralLine ? `<div class="advice-row"><span class="advice-label">Referral</span><span class="advice-val">${referralLine}</span></div>` : ""}
  </div>` : ""}
  ${surgRow ? `<div class="surgery-box" style="margin-top:8px;">
    <div style="font-size:9px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#E11D48;margin-bottom:5px;">⚕ Surgical Counselling</div>
    <div style="font-size:12px;font-weight:700;color:#1A2E2A;">${escapeHtml(surgRow.type)}</div>
    ${surgRow.date ? `<div style="font-size:10.5px;color:#5C7A75;margin-top:2px;">Planned date: ${escapeHtml(surgRow.date)}</div>` : ""}
    ${surgRow.notes ? `<div style="font-size:10.5px;color:#1A2E2A;margin-top:4px;">${escapeHtml(surgRow.notes)}</div>` : ""}
  </div>` : ""}` : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Consultation Summary — ${escapeHtml(d.patient.name)}</title>
<style>${SHARED_CSS}</style>
</head>
<body>

  ${summaryHeader}
  ${patientCard(d.patient, d.visit.doctorName, d.visit.date, d.visit.hospitalName)}

  ${d.chiefComplaint ? `${secHdr("Chief Complaint")}<div class="text-block">${escapeHtml(d.chiefComplaint)}</div>` : ""}

  ${secHdr("Impression")}
  <table>
    <thead><tr><th style="width:24px">#</th><th>Diagnosis</th><th style="width:100px">Laterality</th></tr></thead>
    <tbody>${impressionRows}</tbody>
  </table>

  ${secHdr("Medications Prescribed")}
  <table>
    <thead><tr><th style="width:24px">#</th><th>Drug / Medicine</th><th style="width:80px">Dosage</th><th style="width:110px">Frequency</th><th style="width:80px">Duration</th></tr></thead>
    <tbody>${medRows}</tbody>
  </table>

  ${opticalBlock}

  ${adviceBlock}

  ${bottomSection(d.visit.doctorName, d.visit.hospitalName, qr, d.patient.udid)}
  ${footerHtml(d.patient.udid, "Consultation Summary")}

</body>
</html>`;
}

export async function generateShortSummaryPdf(data: ShortSummaryData): Promise<Buffer> {
  return htmlToPdf(await renderShortSummaryHtml(data));
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  FULL EMR / LONG SUMMARY PDF                                                */
/* ─────────────────────────────────────────────────────────────────────────── */

export type FullEmrData = {
  patient: { udid: string; name: string; age: number; sex: string; mobile?: string | null; address?: string | null };
  visit: { date: Date; visitType?: string | null; hospitalName: string; hospitalAddress?: string | null; hospitalContact?: string | null; doctorName: string };
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
  medications: { drugName: string; dosage?: string | null; frequency?: string | null; duration?: string | null; instructions?: string | null }[];
  opticalRx: {
    re: { sph?: string; cyl?: string; axis?: string; nearSph?: string; nearCyl?: string; nearAxis?: string };
    le: { sph?: string; cyl?: string; axis?: string; nearSph?: string; nearCyl?: string; nearAxis?: string };
  };
  investigations: { testName: string; priority: string; status: string; result?: string | null; notes?: string | null }[];
  admission?: { wardName?: string | null; bedNumber?: string | null; reason?: string | null } | null;
  surgicalCounselling?: { surgeryType?: string | null; surgeryDate?: Date | null; notes?: string | null } | null;
};

async function renderFullEmrHtml(d: FullEmrData): Promise<string> {
  const qr = await makeQr(`PPMS-${d.patient.udid}-${format(d.visit.date, "yyyyMMdd")}`);
  const ge = d.generalExam;
  const va = d.visualAcuity;

  /* PMH */
  const rawPmh = ge?.pastMedicalHistory;
  const pmhList = (Array.isArray(rawPmh) ? rawPmh
    : (typeof rawPmh === "string" ? (() => { try { return JSON.parse(rawPmh); } catch { return []; } })() : [])
  ).filter(Boolean);

  /* Segment helper */
  const renderSegment = (segData: Record<string, string[]> | null | undefined) => {
    if (!segData || Object.keys(segData).length === 0) return `<p class="empty-note">Not recorded</p>`;
    const rows = Object.entries(segData).map(([k, v]: [string, any]) => {
      const label = k.replace(/([A-Z])/g, " $1").trim();
      const re = Array.isArray(v?.re) ? v.re.join(", ") : (v?.re ?? "—");
      const le = Array.isArray(v?.le) ? v.le.join(", ") : (v?.le ?? "—");
      return `<tr><td class="td-head" style="width:120px">${escapeHtml(label)}</td><td>${escapeHtml(re || "—")}</td><td>${escapeHtml(le || "—")}</td></tr>`;
    }).join("");
    return `<table>
      <thead><tr><th style="width:120px">Structure</th><th>Right Eye (RE)</th><th>Left Eye (LE)</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  };

  const rxRow = (eye: string, sub: string, sph?: string, cyl?: string, axis?: string) =>
    `<tr><td class="rx-eye">${eye}<br/><span class="rx-eye-sub">${sub}</span></td><td>${val(sph)}</td><td>${val(cyl)}</td><td>${val(axis)}</td></tr>`;

  /* Diagnoses */
  const diagRows = d.diagnoses.length
    ? d.diagnoses.map((dx, i) => `
      <tr>
        <td class="td-num">${i + 1}</td>
        <td class="td-head">${escapeHtml(dx.description)}</td>
        <td><span class="td-mono">${val(dx.icd10Code)}</span></td>
        <td>${val(dx.laterality)}</td>
        <td>${badgeStatus(dx.status)}</td>
      </tr>`).join("")
    : `<tr class="empty-row"><td colspan="5">No diagnoses recorded</td></tr>`;

  /* Medications */
  const medRows = d.medications.length
    ? d.medications.map((m, i) => `
      <tr>
        <td class="td-num">${i + 1}</td>
        <td><div class="drug-name">${escapeHtml(m.drugName)}</div>${m.instructions ? `<div class="drug-sub">${escapeHtml(m.instructions)}</div>` : ""}</td>
        <td class="drug-dose">${val(m.dosage)}</td>
        <td>${val(m.frequency)}</td>
        <td>${val(m.duration)}</td>
      </tr>`).join("")
    : `<tr class="empty-row"><td colspan="5">No medications prescribed</td></tr>`;

  /* Investigations */
  const invRows = d.investigations.length
    ? d.investigations.map((inv, i) => `
      <tr>
        <td class="td-num">${i + 1}</td>
        <td class="td-head">${escapeHtml(inv.testName)}</td>
        <td>${badgePriority(inv.priority)}</td>
        <td>${badgeStatus(inv.status)}</td>
        <td>${val(inv.result ?? inv.notes)}</td>
      </tr>`).join("")
    : `<tr class="empty-row"><td colspan="5">No investigations ordered</td></tr>`;

  /* Disposition */
  const admissionBlock = d.admission
    ? `<div class="advice-box">
        <div class="advice-row"><span class="advice-label">Ward</span><span class="advice-val">${val(d.admission.wardName)}</span></div>
        <div class="advice-row"><span class="advice-label">Bed Number</span><span class="advice-val">${val(d.admission.bedNumber)}</span></div>
        ${d.admission.reason ? `<div class="advice-row"><span class="advice-label">Reason</span><span class="advice-val">${escapeHtml(d.admission.reason)}</span></div>` : ""}
      </div>` : "";

  const surgBlock = d.surgicalCounselling?.surgeryType
    ? `<div class="surgery-box">
        <div style="font-size:9px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#E11D48;margin-bottom:5px;">⚕ Surgical Counselling</div>
        <div style="font-size:12px;font-weight:700;color:#1A2E2A;">${val(d.surgicalCounselling!.surgeryType)}</div>
        ${d.surgicalCounselling!.surgeryDate ? `<div style="font-size:10.5px;color:#5C7A75;margin-top:2px;">Planned date: ${format(new Date(d.surgicalCounselling!.surgeryDate), "dd MMM yyyy")}</div>` : ""}
        ${d.surgicalCounselling!.notes ? `<div style="font-size:10.5px;color:#1A2E2A;margin-top:4px;">${escapeHtml(d.surgicalCounselling!.notes)}</div>` : ""}
      </div>` : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Long Summary EMR — ${escapeHtml(d.patient.name)}</title>
<style>${SHARED_CSS}</style>
</head>
<body>

  ${letterhead(d.visit.hospitalName, d.visit.hospitalAddress, d.visit.hospitalContact, d.visit.doctorName, d.visit.date, d.visit.visitType, "Complete EMR — Long Summary")}
  ${patientCard(d.patient, d.visit.doctorName, d.visit.date, d.visit.hospitalName)}

  <!-- Chief Complaint & History -->
  ${ge?.chiefComplaint || ge?.hpi ? `
  ${secHdr("Chief Complaint & History of Present Illness")}
  ${ge.chiefComplaint ? `<div style="font-size:12.5px;font-weight:700;color:#0D4A45;margin-bottom:5px;">${escapeHtml(ge.chiefComplaint)}</div>` : ""}
  ${ge.hpi ? `<div class="text-block">${escapeHtml(ge.hpi)}</div>` : ""}
  ` : ""}

  <!-- Vitals -->
  ${secHdr("Vitals & General Examination")}
  ${ge ? `<div class="info-grid">
    <div class="ig-item"><div class="ig-label">Blood Pressure</div><div class="ig-value">${val(ge.bp)}<span class="ig-unit"> mmHg</span></div></div>
    <div class="ig-item"><div class="ig-label">Pulse Rate</div><div class="ig-value">${val(ge.pulse)}<span class="ig-unit"> bpm</span></div></div>
    <div class="ig-item"><div class="ig-label">Temperature</div><div class="ig-value">${val(ge.temperature)}</div></div>
    <div class="ig-item"><div class="ig-label">Body Weight</div><div class="ig-value">${val(ge.weight)}</div></div>
  </div>` : `<p class="empty-note">Not recorded</p>`}

  <!-- Past Medical History -->
  ${secHdr("Past Medical & Drug History")}
  ${ge ? `<div class="text-block">
    <strong>PMH:</strong> ${pmhList.length ? pmhList.map(escapeHtml).join(", ") + (ge.pmhOtherText ? `, ${escapeHtml(ge.pmhOtherText)}` : "") : "Nil"}<br/>
    ${ge.medications ? `<strong>Current Medications:</strong> ${escapeHtml(ge.medications)}<br/>` : ""}
    ${ge.nkda ? `<strong style="color:#059669;">✓ NKDA</strong> — No Known Drug Allergies<br/>` : ge.allergies ? `<strong style="color:#DC2626;">Allergies:</strong> ${escapeHtml(ge.allergies)}<br/>` : ""}
    ${ge.familyHistory ? `<strong>Family History:</strong> ${escapeHtml(ge.familyHistory)}<br/>` : ""}
    ${ge.socialHistory ? `<strong>Social History:</strong> ${escapeHtml(ge.socialHistory)}` : ""}
  </div>` : `<p class="empty-note">Not recorded</p>`}

  <!-- Visual Acuity -->
  ${secHdr("Visual Acuity")}
  ${va ? `<table>
    <thead>
      <tr><th style="width:110px"></th><th>Unaided / UCVA</th><th>Pinhole (PH)</th><th>Best Corrected (BCVA)</th></tr>
    </thead>
    <tbody>
      <tr>
        <td class="td-head">Right Eye (RE)<br/><span style="font-size:9px;color:#5C7A75;font-weight:400;">Distance</span></td>
        <td>${val(va.reDistance?.unaided)}</td>
        <td>${val(va.reDistance?.ph)}</td>
        <td>${val(va.reDistance?.bcva)}</td>
      </tr>
      <tr>
        <td class="td-head">Left Eye (LE)<br/><span style="font-size:9px;color:#5C7A75;font-weight:400;">Distance</span></td>
        <td>${val(va.leDistance?.unaided)}</td>
        <td>${val(va.leDistance?.ph)}</td>
        <td>${val(va.leDistance?.bcva)}</td>
      </tr>
      <tr>
        <td class="td-head">Right Eye (RE)<br/><span style="font-size:9px;color:#5C7A75;font-weight:400;">Near</span></td>
        <td colspan="2">${val(va.reNear)}</td>
        <td>${val(va.reNearN)}</td>
      </tr>
      <tr>
        <td class="td-head">Left Eye (LE)<br/><span style="font-size:9px;color:#5C7A75;font-weight:400;">Near</span></td>
        <td colspan="2">${val(va.leNear)}</td>
        <td>${val(va.leNearN)}</td>
      </tr>
    </tbody>
  </table>` : `<p class="empty-note">Not recorded</p>`}

  <!-- IOP -->
  ${secHdr("Intraocular Pressure (IOP)")}
  ${d.iopReadings.length ? `<table>
    <thead><tr><th>Method</th><th>Right Eye (RE)</th><th>Left Eye (LE)</th><th>Time</th></tr></thead>
    <tbody>${d.iopReadings.map(r => `<tr>
      <td class="td-head">${val(r.method)}</td>
      <td>${val(r.re)}</td>
      <td>${val(r.le)}</td>
      <td>${format(new Date(r.takenAt), "hh:mm a")}</td>
    </tr>`).join("")}</tbody>
  </table>` : `<p class="empty-note">Not recorded</p>`}

  <!-- Colour Vision -->
  ${d.colourVision ? `
  ${secHdr("Colour Vision")}
  <div class="info-grid" style="grid-template-columns:1fr 1fr;">
    <div class="ig-item"><div class="ig-label">Right Eye (RE)</div><div class="ig-value" style="font-size:13px;">${val(d.colourVision.re)}</div></div>
    <div class="ig-item"><div class="ig-label">Left Eye (LE)</div><div class="ig-value" style="font-size:13px;">${val(d.colourVision.le)}</div></div>
  </div>
  ${d.colourVision.notes ? `<div class="text-block" style="margin-top:6px;">${escapeHtml(d.colourVision.notes)}</div>` : ""}
  ` : ""}

  <!-- Anterior Segment -->
  ${secHdr("Anterior Segment Examination")}
  ${renderSegment(d.anteriorSegment as any)}

  <!-- Posterior Segment -->
  ${secHdr("Posterior Segment Examination")}
  ${(() => {
    const ps = d.posteriorSegment as any;
    if (!ps) return `<p class="empty-note">Not recorded</p>`;
    return renderSegment(ps.data)
      + (ps.cdr ? `<div style="font-size:11px;margin-top:6px;"><strong>CDR:</strong> ${escapeHtml(ps.cdr)}</div>` : "")
      + (ps.notes ? `<div class="text-block" style="margin-top:6px;">${escapeHtml(ps.notes)}</div>` : "");
  })()}

  <!-- Diagnosis -->
  ${secHdr("Assessment / Diagnosis")}
  <table>
    <thead><tr><th style="width:24px">#</th><th>Diagnosis</th><th style="width:80px">ICD-10</th><th style="width:90px">Laterality</th><th style="width:90px">Status</th></tr></thead>
    <tbody>${diagRows}</tbody>
  </table>

  <!-- Medications -->
  ${secHdr("Medications Prescribed")}
  <table>
    <thead><tr><th style="width:24px">#</th><th>Drug / Medicine</th><th style="width:80px">Dosage</th><th style="width:110px">Frequency</th><th style="width:80px">Duration</th></tr></thead>
    <tbody>${medRows}</tbody>
  </table>

  <!-- Optical Rx -->
  ${secHdr("Optical Prescription (Refraction)")}
  <table class="rx-table">
    <thead><tr><th style="width:110px;text-align:left"></th><th>Sphere (SPH)</th><th>Cylinder (CYL)</th><th>Axis</th></tr></thead>
    <tbody>
      ${rxRow("Right Eye (RE)", "Distance", d.opticalRx.re.sph, d.opticalRx.re.cyl, d.opticalRx.re.axis)}
      ${rxRow("Left Eye (LE)", "Distance", d.opticalRx.le.sph, d.opticalRx.le.cyl, d.opticalRx.le.axis)}
      ${rxRow("Right Eye (RE)", "Near Add", d.opticalRx.re.nearSph, d.opticalRx.re.nearCyl, d.opticalRx.re.nearAxis)}
      ${rxRow("Left Eye (LE)", "Near Add", d.opticalRx.le.nearSph, d.opticalRx.le.nearCyl, d.opticalRx.le.nearAxis)}
    </tbody>
  </table>

  <!-- Investigations -->
  ${secHdr("Investigations Ordered")}
  <table>
    <thead><tr><th style="width:24px">#</th><th>Test / Investigation</th><th style="width:80px">Priority</th><th style="width:90px">Status</th><th>Result / Notes</th></tr></thead>
    <tbody>${invRows}</tbody>
  </table>

  <!-- Disposition -->
  ${d.admission || d.surgicalCounselling?.surgeryType ? `
  ${secHdr("Disposition / Plan")}
  ${admissionBlock}
  ${surgBlock}
  ` : ""}

  ${bottomSection(d.visit.doctorName, d.visit.hospitalName, qr, d.patient.udid)}
  ${footerHtml(d.patient.udid, "Complete EMR — Long Summary")}

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
        hospitalAddress: (visit.hospital as any).address ?? null,
        hospitalContact: (visit.hospital as any).contact ?? null,
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
      medications: (visit.medications ?? []).map((m: any) => ({ drugName: m.drugName, dosage: m.dosage ?? null, frequency: m.frequency ?? null, duration: m.duration ?? null, instructions: m.instructions ?? null })),
      opticalRx: {
        re: { sph: reRef?.sph, cyl: reRef?.cyl, axis: reRef?.axis, nearSph: reRef?.nearSph },
        le: { sph: leRef?.sph, cyl: leRef?.cyl, axis: leRef?.axis, nearSph: leRef?.nearSph },
      },
      investigations: (visit.investigationOrders ?? []).map((o: any) => ({ testName: o.testName, priority: o.priority ?? "Routine", status: o.status, result: o.resultRef ?? null, notes: o.notes ?? null })),
      admission: null,
      surgicalCounselling: (visit as any).surgicalCounselling ?? null,
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

    const medRows = d.medications.length
      ? d.medications.map((m, i) => `<tr><td class="td-num">${i + 1}</td><td><div class="drug-name">${escapeHtml(m.drugName)}</div>${m.instructions ? `<div class="drug-sub">${escapeHtml(m.instructions)}</div>` : ""}</td><td>${val(m.dosage)}</td><td>${val(m.frequency)}</td><td>${val(m.duration)}</td></tr>`).join("")
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
      hospitalAddress: (visit.hospital as any).address ?? null,
      hospitalContact: (visit.hospital as any).contact ?? null,
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
    medications: (visit.medications ?? []).map((m: any) => ({ drugName: m.drugName, dosage: m.dosage ?? null, frequency: m.frequency ?? null, duration: m.duration ?? null, instructions: m.instructions ?? null })),
    opticalRx: {
      re: { sph: reRef?.sph, cyl: reRef?.cyl, axis: reRef?.axis, nearSph: reRef?.nearSph, nearCyl: reRef?.nearCyl, nearAxis: reRef?.nearAxis },
      le: { sph: leRef?.sph, cyl: leRef?.cyl, axis: leRef?.axis, nearSph: leRef?.nearSph, nearCyl: leRef?.nearCyl, nearAxis: leRef?.nearAxis },
    },
    investigations: (visit.investigationOrders ?? []).map((o: any) => ({ testName: o.testName, priority: o.priority ?? "Routine", status: o.status, result: o.resultRef ?? null, notes: o.notes ?? null })),
    admission: (visit as any).admission ?? null,
    surgicalCounselling: (visit as any).surgicalCounselling ?? null,
  };

  return htmlToPdf(await renderFullEmrHtml(data));
}
