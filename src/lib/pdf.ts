import { format as formatBase } from "date-fns";
import { toISTWall } from "@/lib/ist";
import QRCode from "qrcode";
import type { Browser } from "puppeteer-core";
import { complaintLabel, parseComplaintItems } from "@/lib/appointment-cc";
import { MONTSERRAT_600_WOFF2 } from "@/lib/pdfFonts";

// All timestamps in generated PDFs are Indian wall-clock times; production runs on UTC.
const format = (d: Date | number, fmt: string) => formatBase(toISTWall(new Date(d)), fmt);


/** Chief complaint in the app-wide format ("RE • Blurred Vision • 8 days"), one complaint per line. */
function complaintHtml(raw: string): string {
  const items = parseComplaintItems(raw);
  return items.length ? items.map((c) => escapeHtml(complaintLabel(c))).join("<br>") : escapeHtml(raw);
}

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "string" ? value : String(value);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function val(v: unknown, fallback = "—") {
  if (v === null || v === undefined || v === "") return escapeHtml(fallback);
  return escapeHtml(String(v));
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  TAPER / DURATION HELPERS                                                    */
/* ─────────────────────────────────────────────────────────────────────────── */

type TaperStepPdf = { dose: string; frequency: string; durationNum: string; durationUnit: string };

function parseTaperStepsPdf(text: string): TaperStepPdf[] {
  return text.split(" → ").flatMap((step) => {
    const m = step.match(/^(?:(.+?) · )?(.*?) × (\d+) (days?|weeks?|months?|years?)$/i);
    return m ? [{ dose: m[1] ?? "", frequency: m[2], durationNum: m[3], durationUnit: m[4] }] : [];
  });
}

function splitTaperPdf(instructions: string | null | undefined, duration: string | null | undefined) {
  const parts = String(instructions ?? "").split(" | ");
  const instrTaper = parts.find((p) => p.startsWith("Tapering: "))?.slice("Tapering: ".length);
  const [baseDuration, presetTaper] = String(duration ?? "").split(" → Taper: ", 2);
  const taperText = instrTaper || presetTaper;
  const taper = taperText ? parseTaperStepsPdf(taperText) : [];
  return {
    note: parts.filter((p) => p && !p.startsWith("Tapering: ")).join(" | "),
    baseDuration: baseDuration.trim(),
    taper,
  };
}

function parseDurationDaysPdf(s: string): number | null {
  const m = s.trim().match(/^(\d+)\s*(day|days|week|weeks|month|months|year|years)$/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const u = m[2].toLowerCase().replace(/s$/, "");
  if (u === "day") return n;
  if (u === "week") return n * 7;
  if (u === "month") return n * 30;
  if (u === "year") return n * 365;
  return null;
}

const PDF_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function addDaysPdf(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

function fmtEndDatePdf(d: Date): string {
  return `${d.getDate()} ${PDF_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Returns {html, days}: html is "3 days — until 8 Oct 2026" when parseable,
 * otherwise just the escaped duration. days is the parsed integer or null.
 */
function durCellPdf(durationStr: string | null | undefined, startDate: Date): { html: string; days: number | null } {
  if (!durationStr || !durationStr.trim()) {
    return { html: `<span style="color:#aaa;font-style:italic;">—</span>`, days: null };
  }
  const days = parseDurationDaysPdf(durationStr);
  if (days === null) return { html: escapeHtml(durationStr), days: null };
  const end = addDaysPdf(startDate, days - 1);
  return {
    html: `${escapeHtml(durationStr)} - ${fmtEndDatePdf(end)}`,
    days,
  };
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


function badgeStatus(s: string | null | undefined) {
  if (!s) return "";
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

function patientCard(patient: { name: string; udid: string; uhid?: string | null; age: number; sex: string; mobile?: string | null; address?: string | null }, doctorName: string, visitDate: Date, hospitalName: string): string {
  return `
  <div class="patient-card">
    <div class="patient-card-head">Patient Information</div>
    <div class="patient-grid">
      <div>
        <div class="pf-label">Patient Name</div>
        <div class="pf-value">${escapeHtml(patient.name)}</div>
      </div>
      <div>
        <div class="pf-label">UDID / Patient ID</div>
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
    <span>UDID: ${escapeHtml(udid)}</span>
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
        For clinical reference only, not a substitute for professional medical advice.
      </div>
    </div>
    ${qrDataUrl ? `
    <div class="qr-block">
      <img src="${qrDataUrl}" alt="QR Code" />
      <div class="qr-label">UDID: ${escapeHtml(udid)}</div>
    </div>` : ""}
  </div>`;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  DISPENSE PDF                                                               */
/* ─────────────────────────────────────────────────────────────────────────── */

/** A stored result file prints as a note, never as its (private) storage address. */
function printableResult(ref: string | null | undefined): string | null {
  if (!ref) return null;
  return /^(https?:|local:)/.test(ref) || /\.(pdf|png|jpe?g|webp)$/i.test(ref) ? "Report attached" : ref;
}

export type DispenseSummaryData = {
  patient: { udid: string; name: string; age: number; sex: string; mobileMasked: string };
  visit: { date: Date; hospitalName: string; doctorName: string };
  vitals: { bp?: string | null; pulse?: string | null; temperature?: string | null; weight?: string | null };
  chiefComplaint?: string | null;
  diagnoses: { description: string; icd10Code: string; status: string; laterality?: string | null }[];
  investigations: { testName: string; priority: string; status: string; notes?: string | null }[];
  dispenseSummary?: string | null;
};

async function renderDispenseHtml(data: DispenseSummaryData): Promise<string> {
  const qr = await makeQr(`PPMS-${data.patient.udid}`);

  const diagRows = data.diagnoses.length
    ? data.diagnoses.map((d, i) => `
      <tr>
        <td class="td-num">${i + 1}</td>
        <td class="td-head">${d.status && d.status !== "BLANK" ? `<span style="color:#888;font-weight:400;margin-right:4px;">${escapeHtml(d.status.charAt(0) + d.status.slice(1).toLowerCase())} ·</span>` : ""}${d.laterality ? `<span style="font-weight:700;color:#1a6e6a;margin-right:5px;">${escapeHtml(d.laterality)}</span>` : ""}${escapeHtml(d.description)}</td>
        <td><span class="td-mono">${escapeHtml(d.icd10Code)}</span></td>
        <td>${badgeStatus(d.status)}</td>
      </tr>`).join("")
    : `<tr class="empty-row"><td colspan="4">No diagnoses recorded</td></tr>`;

  const invRows = data.investigations.length
    ? data.investigations.map((i, idx) => `
      <tr>
        <td class="td-num">${idx + 1}</td>
        <td class="td-head">${escapeHtml(i.testName)}</td>
        <td>${i.notes ? escapeHtml(i.notes) : "<span style='color:#aaa;font-style:italic;'>—</span>"}</td>
      </tr>`).join("")
    : `<tr class="empty-row"><td colspan="3">No investigations ordered</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><title>Dispense Summary: ${escapeHtml(data.patient.name)}</title>
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

  ${data.chiefComplaint ? `${secHdr("Chief Complaint")}<div class="text-block">${complaintHtml(data.chiefComplaint)}</div>` : ""}

  ${secHdr("Diagnosis")}
  <table>
    <thead><tr><th style="width:24px">#</th><th>Diagnosis</th><th>ICD-10</th><th>Status</th></tr></thead>
    <tbody>${diagRows}</tbody>
  </table>

  ${secHdr("Investigations")}
  <table>
    <thead><tr><th style="width:24px">#</th><th>Test Name</th><th>In View Of</th></tr></thead>
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
    ? data.medications.map((m, i) => {
        const split = splitTaperPdf(m.instructions, m.duration);
        const baseDur = durCellPdf(split.baseDuration, data.visit.date);
        let offsetDays = baseDur.days ?? null;
        const mainRow = `
      <tr>
        <td class="td-num">${i + 1}</td>
        <td><div class="drug-name">${pdfMedBadge(m.route, m.laterality, m.drugName)}${escapeHtml(m.drugName)}</div>${split.note ? `<div class="drug-sub">${escapeHtml(split.note)}</div>` : ""}</td>
        <td class="drug-dose">${val(m.dosage)}</td>
        <td>${val(m.frequency)}</td>
        <td>${baseDur.html}</td>
      </tr>`;
        const taperRows = split.taper.map((t) => {
          const taperStart = offsetDays !== null ? addDaysPdf(data.visit.date, offsetDays) : data.visit.date;
          const taperDur = durCellPdf(`${t.durationNum} ${t.durationUnit}`, taperStart);
          if (taperDur.days !== null && offsetDays !== null) offsetDays += taperDur.days;
          else offsetDays = null;
          return `<tr style="background:#f8fafa;">
        <td class="td-num" style="color:#bbb;">↓</td>
        <td style="padding:3px 8px;font-size:8.5px;color:#666;">↓ Taper</td>
        <td class="drug-dose">${t.dose ? escapeHtml(t.dose) : `<span style="color:#aaa;">—</span>`}</td>
        <td>${t.frequency ? escapeHtml(t.frequency) : `<span style="color:#aaa;">—</span>`}</td>
        <td>${taperDur.html}</td>
      </tr>`;
        }).join("");
        return mainRow + taperRows;
      }).join("")
    : `<tr class="empty-row"><td colspan="5">No medications prescribed</td></tr>`;

  const rxRow = (eye: string, sub: string, sph?: string, cyl?: string, axis?: string) =>
    `<tr><td class="rx-eye">${eye}<br/><span class="rx-eye-sub">${sub}</span></td><td>${val(sph)}</td><td>${val(cyl)}</td><td>${val(axis)}</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><title>Prescription: ${escapeHtml(data.patient.name)}</title>
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

async function launchBrowser(): Promise<Browser> {
  if (process.env.VERCEL) {
    const chromium = (await import("@sparticuz/chromium")).default;
    const puppeteer = (await import("puppeteer-core")).default;
    // executablePath() always checks /tmp/chromium first (warm → instant).
    // On cold starts the binary may not be bundled via outputFileTracing, so
    // we supply the GitHub release URL as a reliable download fallback.
    const executablePath = await chromium.executablePath(
      "https://github.com/Sparticuz/chromium/releases/download/v133.0.0/chromium-v133.0.0-pack.tar"
    );
    return puppeteer.launch({
      args: [...chromium.args, "--disable-dev-shm-usage"],
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: true,
    });
  }
  const puppeteer = (await import("puppeteer")).default;
  // puppeteer (local dev) and puppeteer-core (Vercel) are on different majors,
  // so their Browser types differ nominally though not structurally. Casting the
  // dev-only branch keeps launchBrowser to one return type, which is what lets
  // page.evaluate below resolve its generic signature.
  return puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] }) as unknown as Browser;
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    // "load" blocks on every subresource, so one slow or unreachable hospital
    // logo / doctor signature hangs generation until the function dies. Parse
    // the DOM first, then wait on images with a per-image ceiling: a reachable
    // logo still renders, an unreachable one is skipped instead of fatal.
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => Promise.all(
      Array.from(document.images)
        .filter((img) => !img.complete)
        .map((img) => new Promise<void>((resolve) => {
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
          setTimeout(done, 3000);
        })),
    ));
    // Embedded fonts (summary headings) must finish decoding before the PDF is cut.
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
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
  patient: { udid: string; uhid?: string | null; name: string; age: number; sex: string; mobile?: string | null };
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
    inViewOf?: string | null;
  };
  chiefComplaint?: string | null;
  /** Visit.adviseNotes — the doctor's own advice text, printed verbatim. */
  advice?: string | null;
  diagnoses: { description: string; icd10Code: string; status: string; laterality?: string | null }[];
  medications: { drugName: string; dosage?: string | null; frequency?: string | null; duration?: string | null; instructions?: string | null; route?: string | null; laterality?: string | null }[];
  investigations: { testName: string; category: string; priority: string; laterality?: string | null; status: string; notes?: string | null }[];
  opticalRx?: {
    re: { sph?: string; cyl?: string; axis?: string; nearSph?: string; va?: string; nearVa?: string; method?: string };
    le: { sph?: string; cyl?: string; axis?: string; nearSph?: string; va?: string; nearVa?: string; method?: string };
  } | null;
  extraCorrections?: { label: string; re: { sph?: string; cyl?: string; axis?: string; nearSph?: string; va?: string; nearVa?: string; method?: string }; le: { sph?: string; cyl?: string; axis?: string; nearSph?: string; va?: string; nearVa?: string; method?: string } }[] | null;
  visualAcuity?: { reDistance?: { unaided?: string; ph?: string; bcva?: string } | null; leDistance?: { unaided?: string; ph?: string; bcva?: string } | null; reNear?: string | null; leNear?: string | null } | null;
  retinoscopy?: { re?: { sph?: string; cyl?: string; axis?: string } | null; le?: { sph?: string; cyl?: string; axis?: string } | null } | null;
  minorProcedure?: { procedureName?: string | null; procedureLaterality?: string | null; anesthesiaType?: string | null; procedureNotes?: string | null } | null;
  allergies?: string | null;
  nkda?: boolean | null;
  anteriorSegment?: { re?: Record<string, string> | null; le?: Record<string, string> | null } | null;
  posteriorSegment?: { re?: Record<string, string> | null; le?: Record<string, string> | null; notes?: string | null } | null;
  colourVision?: { re?: Record<string, string> | null; le?: Record<string, string> | null } | null;
  contrastSensitivity?: { re?: Record<string, string> | null; le?: Record<string, string> | null } | null;
  iopReadings?: { method?: string | null; takenAt?: Date | string | null; re?: number | null; le?: number | null }[] | null;
  gonioscopy?: Record<string, string> | null;
  tearFilm?: Record<string, number | null> | null;
  lacrimalSac?: { re?: { chips?: string[]; findings?: string } | null; le?: { chips?: string[]; findings?: string } | null; method?: string | null } | null;
  diplopiaChart?: Record<string, { status?: string; notes?: string }> | null;
  hessChart?: { grid?: Record<string, { reH?: string; reV?: string; leH?: string; leV?: string }>; interpretation?: string | null } | null;
};

/* ─────────────────────────────────────────────────────────────────────────── */
/*  SUMMARY FIELD LAYOUT (shared by the Short and Long summary prints)          */
/* ─────────────────────────────────────────────────────────────────────────── */

/*
  Lays fields out the way the Previous Visits page does (VisitSummaryTabs.tsx):
  "LABEL · value" lines, labelled blocks with indented tables, RE/LE tables with the
  section label in the header row, chips and numbered lists. Colours are the app's
  tokens from globals.css; sizes are scaled to A4.
*/
const SUI = {
  INK_800: "#111111", INK_700: "#111111", INK_600: "#111111", INK_500: "#111111",
  INK_400: "#111111", INK_300: "#111111", BORDER: "#E2E8F0", SUNKEN: "#F1F5F9",
  P700: "#0F766E", P600: "#0D9488", P50: "#F0FDFA",
  INDENT: 14,
};

/** CSS the summary helpers rely on (row dividers between table rows). */
const SUMMARY_UI_CSS = `
  @font-face { font-family: "PdfHeading"; font-weight: 600; font-style: normal; src: url(data:font/woff2;base64,${MONTSERRAT_600_WOFF2}) format("woff2"); }
  .sui-div > tr + tr > td { border-top: 1px solid ${SUI.BORDER}; }
  .sui-list > li + li { border-top: 1px solid ${SUI.BORDER}; }
  /* Print: solid black, no transparency, colours exactly as authored. */
  @media print {
    html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body, body * { color: #000000 !important; opacity: 1 !important; }
  }
`;

/* Section headings: Montserrat SemiBold in solid dark teal, so they print firmly even on
   a low-ink printer, while staying smaller and lighter than the values they label. */
const SUI_HEAD_COLOR = "#000000";
const SUI_HEAD_FONT = `font-family:'PdfHeading','Segoe UI',Arial,sans-serif;font-weight:600;text-transform:uppercase;`;
const SUI_LABEL = `${SUI_HEAD_FONT}font-size:8.5px;letter-spacing:0.1em;color:${SUI_HEAD_COLOR};`;
const SUI_TH = `padding:0 12px 5px 0;text-align:left;vertical-align:bottom;${SUI_HEAD_FONT}font-size:8px;letter-spacing:0.08em;color:${SUI_HEAD_COLOR};`;
const SUI_TD = `padding:4px 12px 4px 0;vertical-align:top;font-size:9.5px;font-weight:500;line-height:1.35;color:${SUI.INK_700};`;
const SUI_TD_MUTED = `padding:4px 12px 4px 0;vertical-align:top;font-size:9.5px;font-weight:600;line-height:1.35;color:${SUI.INK_500};`;
const SUI_DASH = `<span style="color:${SUI.INK_300};">—</span>`;

const suiVal = (v: unknown) => (v === null || v === undefined || v === "") ? SUI_DASH : escapeHtml(String(v));
/** Like suiVal, but keeps the line breaks the doctor typed (multi-line notes). */
const suiValLines = (v: unknown) => (v === null || v === undefined || String(v).trim() === "")
  ? SUI_DASH
  : `<span style="white-space:pre-wrap;">${escapeHtml(String(v).replace(/\r/g, ""))}</span>`;

/** One line: "LABEL · value". */
function suiLine(label: string, valueHtml: string, danger = false): string {
  const lc = danger ? "#DC2626" : SUI_HEAD_COLOR;
  const dc = danger ? "#FCA5A5" : SUI.INK_300;
  return `<div class="no-break" style="display:flex;align-items:baseline;flex-wrap:wrap;gap:6px;margin-bottom:12px;">` +
    `<span style="${SUI_LABEL}color:${lc};white-space:nowrap;">${label}</span>` +
    `<span style="font-size:8px;font-weight:700;color:${dc};">·</span>` +
    `<div style="flex:1;min-width:0;">${valueHtml}</div>` +
    `</div>`;
}

/** A label above an indented body (Block / SumHead + pl-5). */
function suiBlock(label: string, bodyHtml: string, indent = true): string {
  return `<div class="no-break" style="margin-bottom:12px;">` +
    `<div style="${SUI_LABEL}margin-bottom:5px;">${label}</div>` +
    `<div style="${indent ? `padding-left:${SUI.INDENT}px;` : ""}">${bodyHtml}</div>` +
    `</div>`;
}

/** Fixed-layout table; `indent` shifts rows like a Block body (label then sits in the header via suiInlineHead). */
function suiTable(widths: string[], head: string, body: string, opts: { indent?: boolean; divided?: boolean } = {}): string {
  return `<div style="${opts.indent ? `padding-left:${SUI.INDENT}px;` : ""}">` +
    `<table style="width:100%;table-layout:fixed;border-collapse:collapse;">` +
    `<colgroup>${widths.map((w) => `<col style="width:${w}">`).join("")}</colgroup>` +
    head +
    `<tbody${opts.divided ? ` class="sui-div"` : ""}>${body}</tbody>` +
    `</table></div>`;
}

/** Section label sitting in an indented table's header cell, pulled back flush left. */
const suiInlineHead = (label: string) => `<span style="display:block;margin-left:-${SUI.INDENT}px;">${label}</span>`;

/** RE / LE header row; `first` is the section label shown in the first header cell. */
function suiEyeHead(first = "", line = false, reSuffix = "", leSuffix = ""): string {
  const bb = line ? `border-bottom:1px solid ${SUI.BORDER};` : "";
  return `<thead><tr>` +
    `<th style="${SUI_TH}${bb}">${first ? suiInlineHead(first) : ""}</th>` +
    `<th style="${SUI_TH}${bb}"><strong style="color:${SUI.P700};">RE</strong>${reSuffix}</th>` +
    `<th style="${SUI_TH}${bb}"><strong style="color:${SUI.P700};">LE</strong>${leSuffix}</th>` +
    `</tr></thead>`;
}

const suiBullet = `<span style="color:${SUI.P600};margin-right:5px;">•</span>`;

/** A label / RE / LE row; `stripe` shades it like the screen's alternate rows. */
function suiEyeRow(labelHtml: string, re: string, le: string, opts: { stripe?: boolean; strong?: boolean } = {}): string {
  const bg = opts.stripe ? `background:${SUI.SUNKEN};` : "";
  const w = opts.strong ? "font-weight:500;" : "";
  return `<tr style="${bg}">` +
    `<td style="${SUI_TD_MUTED}">${labelHtml}</td>` +
    `<td style="${SUI_TD}${w}">${re}</td>` +
    `<td style="${SUI_TD}${w}">${le}</td>` +
    `</tr>`;
}

/** Spectacle grid: Right Eye / Left Eye rows under Sph · Cyl · Axis° · VA · Add · NV. */
function suiRxTable(re: Record<string, string | undefined> | null | undefined, le: Record<string, string | undefined> | null | undefined, method = ""): string {
  // Auto-Refraction prints keratometry (K1, K2, ΔK) in place of the VA columns.
  const isAR = method === "Auto-Refraction";
  const withDk = (v: Record<string, string | undefined> | null | undefined) => {
    const o = { ...(v ?? {}) };
    const a = parseFloat(o.k1 ?? ""), b = parseFloat(o.k2 ?? "");
    if (Number.isFinite(a) && Number.isFinite(b)) o.dk = Math.abs(a - b).toFixed(2);
    return o;
  };
  const cols: { key: string; label: string; grey?: boolean }[] = isAR
    ? [
        { key: "sph", label: "Sph" }, { key: "cyl", label: "Cyl" }, { key: "axis", label: "Axis°" },
        { key: "k1", label: "K1" }, { key: "k2", label: "K2" }, { key: "dk", label: "ΔK", grey: true },
      ]
    : [
        { key: "sph", label: "Sph" }, { key: "cyl", label: "Cyl" }, { key: "axis", label: "Axis°" },
        { key: "va", label: "VA", grey: true }, { key: "nearSph", label: "Add" }, { key: "nearVa", label: "NV", grey: true },
      ];
  const r = isAR ? withDk(re) : (re ?? {}), l = isAR ? withDk(le) : (le ?? {});
  const hasRe = cols.some((c) => r[c.key]);
  const hasLe = cols.some((c) => l[c.key]);
  if (!hasRe && !hasLe) return "";
  const cell = `padding:5px 8px;border-right:1px solid ${SUI.BORDER};`;
  const th = (c?: { label: string; grey?: boolean }) =>
    `<th style="${cell}text-align:center;${SUI_HEAD_FONT}font-size:8px;letter-spacing:0.08em;color:${SUI_HEAD_COLOR};${c?.grey ? `background:${SUI.SUNKEN};` : ""}">${c ? c.label : ""}</th>`;
  const row = (eye: string, v: Record<string, string | undefined>) =>
    `<tr style="border-top:1px solid ${SUI.BORDER};">` +
    `<td style="${cell}font-size:9.5px;font-weight:600;color:${SUI.P700};white-space:nowrap;">${eye}</td>` +
    cols.map((c) => `<td style="${cell}text-align:center;font-size:9.5px;color:${c.grey ? SUI.INK_500 : SUI.INK_700};${c.grey ? `background:${SUI.SUNKEN};` : ""}">${suiVal(v[c.key])}</td>`).join("") +
    `</tr>`;
  return `<div style="border:1px solid ${SUI.BORDER};border-radius:6px;overflow:hidden;">` +
    `<table style="width:100%;border-collapse:collapse;">` +
    `<thead><tr style="background:${SUI.P50};">${th()}${cols.map((c) => th(c)).join("")}</tr></thead>` +
    `<tbody>${hasRe ? row("Right Eye", r) : ""}${hasLe ? row("Left Eye", l) : ""}</tbody>` +
    `</table></div>`;
}

/** Tinted note box with a coloured left rule (HPI, systemic history, advice, procedure notes). */
function suiNote(text: string, tone: "sky" | "slate" | "amber" | "plain", indent = true): string {
  const [border, left, bg, w] =
    tone === "sky"   ? ["#BAE6FD", "#38BDF8", "#F0F9FF", 3] :
    tone === "slate" ? ["#E2E8F0", "#94A3B8", "#F8FAFC", 3] :
    tone === "amber" ? ["#FDE68A", "#FBBF24", "#FFFBEB", 3] :
                       [SUI.BORDER, "#5EEAD4", SUI.SUNKEN, 2];
  return `<div style="${indent ? `margin-left:${SUI.INDENT}px;` : ""}padding:6px 10px;border:1px solid ${border};border-left:${w}px solid ${left};border-radius:5px;background:${bg};font-size:9.5px;line-height:1.55;color:${tone === "plain" ? SUI.INK_600 : SUI.INK_700};white-space:pre-wrap;">${escapeHtml(text)}</div>`;
}

/** Chief-complaint chips ("RE • Blurred Vision • 8 days"). */
function suiComplaintChips(raw: string): string {
  const items = parseComplaintItems(raw);
  const labels = items.length ? items.map((c) => complaintLabel(c)) : [raw];
  return `<span style="display:inline-flex;flex-wrap:wrap;gap:4px;">` +
    labels.map((l) => `<span style="display:inline-block;padding:1px 8px;border:1px solid #F1D7B4;border-radius:999px;background:#FFF8ED;color:#8A501A;font-size:9.5px;font-weight:500;line-height:15px;">${escapeHtml(l)}</span>`).join("") +
    `</span>`;
}

/** Diagnosis chips: "Active · • RE Description ICD". */
function suiDiagnosisChips(dx: { description: string; icd10Code?: string | null; status?: string | null; laterality?: string | null }[], withIcd = false): string {
  return `<span style="display:inline-flex;flex-wrap:wrap;gap:5px;">` +
    dx.map((d) =>
      `<span style="display:inline-flex;align-items:center;gap:5px;padding:1px 8px;border:1px solid #F0C6CE;border-radius:999px;background:#FFF1F3;color:#96384B;font-size:9.5px;font-weight:500;line-height:15px;">` +
      (d.status && d.status !== "BLANK" ? `<span style="color:${SUI.INK_400};font-weight:400;">${escapeHtml(d.status.charAt(0) + d.status.slice(1).toLowerCase())} ·</span>` : "") +
      `<span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:currentColor;"></span>` +
      (d.laterality ? `<span style="font-weight:700;">${escapeHtml(d.laterality)}</span>` : "") +
      `<span>${escapeHtml(d.description)}</span>` +
      (withIcd && d.icd10Code ? `<span style="font-family:'Courier New',monospace;font-size:8px;color:${SUI.INK_400};margin-left:2px;">${escapeHtml(d.icd10Code)}</span>` : "") +
      `</span>`
    ).join("") +
    `</span>`;
}

/** Minor procedure value: laterality + name (+ anaesthesia), notes box below. */
function suiProcedure(p: { procedureName?: string | null; procedureLaterality?: string | null; anesthesiaType?: string | null; procedureNotes?: string | null }, name: string): string {
  return `<span style="font-size:9.5px;font-weight:600;color:${SUI.INK_800};">` +
    (p.procedureLaterality ? `<span style="font-weight:700;color:${SUI.P700};margin-right:5px;">${escapeHtml(p.procedureLaterality)}</span>` : "") +
    escapeHtml(name) +
    (p.anesthesiaType ? `<span style="font-weight:400;color:${SUI.INK_500};"> · Under ${escapeHtml(p.anesthesiaType)}</span>` : "") +
    `</span>` +
    (p.procedureNotes ? `<div style="margin-top:5px;">${suiNote(p.procedureNotes, "plain", false)}</div>` : "");
}

/** Numbered investigation list: "1. RE Test · In view of: …". */
function suiInvestigationList(inv: { testName: string; laterality?: string | null; notes?: string | null }[]): string {
  return `<ol class="sui-list" style="list-style:none;margin:0;padding:0;">` +
    inv.map((o, i) =>
      `<li style="display:flex;align-items:flex-start;gap:7px;padding:5px 0;${i === 0 ? "padding-top:0;" : ""}">` +
      `<span style="width:16px;flex-shrink:0;text-align:right;font-size:9.5px;font-weight:600;color:${SUI.INK_400};">${i + 1}.</span>` +
      `<span style="flex:1;min-width:0;font-size:9.5px;font-weight:600;color:${SUI.INK_800};line-height:1.35;">` +
      (o.laterality ? `<span style="color:${SUI.P700};margin-right:4px;">${escapeHtml(o.laterality)}</span>` : "") +
      escapeHtml(o.testName) +
      (o.notes ? `<span style="font-weight:400;font-style:italic;color:${SUI.INK_500};margin-left:5px;">· In view of: ${escapeHtml(o.notes)}</span>` : "") +
      `</span></li>`
    ).join("") +
    `</ol>`;
}

/** Medication rows: # · drug (laterality, route, instructions) · dose · frequency · duration, taper steps under it. */
function suiMedicationRows(
  meds: { drugName: string; dosage?: string | null; frequency?: string | null; duration?: string | null; instructions?: string | null; route?: string | null; laterality?: string | null }[],
  visitDate: Date,
  long: boolean,
): string {
  return meds.map((m, i) => {
    const split = splitTaperPdf(m.instructions, m.duration);
    const baseDur = durCellPdf(split.baseDuration, visitDate);
    let offsetDays = baseDur.days ?? null;
    const durHtml = (h: { html: string; days: number | null }) => h.days === null && !split.baseDuration ? SUI_DASH : h.html;
    const main =
      `<tr>` +
      `<td style="${SUI_TD_MUTED}">${i + 1}</td>` +
      `<td style="${SUI_TD}font-weight:600;">` +
      `<div>` +
      (m.laterality ? `<span style="font-weight:700;color:${SUI.P700};margin-right:6px;">${escapeHtml(m.laterality)}</span>` : "") +
      escapeHtml(m.drugName) +
      (long && m.route ? `<span style="font-weight:400;color:${SUI.INK_400};margin-left:3px;">· ${escapeHtml(m.route)}</span>` : "") +
      `</div>` +
      (split.note ? `<div style="font-weight:400;font-style:italic;color:${SUI.INK_400};font-size:8px;margin-top:1px;">${escapeHtml(split.note)}</div>` : "") +
      `</td>` +
      `<td style="${SUI_TD_MUTED}">${suiVal(m.dosage)}</td>` +
      `<td style="${SUI_TD_MUTED}">${suiVal(m.frequency)}</td>` +
      `<td style="${SUI_TD_MUTED}white-space:nowrap;">${durHtml(baseDur)}</td>` +
      `</tr>`;
    const taper = split.taper.map((t) => {
      const start = offsetDays !== null ? addDaysPdf(visitDate, offsetDays) : visitDate;
      const dur = durCellPdf(`${t.durationNum} ${t.durationUnit}`, start);
      if (dur.days !== null && offsetDays !== null) offsetDays += dur.days;
      else offsetDays = null;
      return `<tr>` +
        `<td style="${SUI_TD_MUTED}"></td>` +
        `<td style="${SUI_TD_MUTED}padding-left:10px;">↓ Taper</td>` +
        `<td style="${SUI_TD_MUTED}">${suiVal(t.dose)}</td>` +
        `<td style="${SUI_TD_MUTED}">${suiVal(t.frequency)}</td>` +
        `<td style="${SUI_TD_MUTED}white-space:nowrap;">${dur.html}</td>` +
        `</tr>`;
    }).join("");
    return main + taper;
  }).join("");
}

const SUI_MED_COLS = ["5%", "32%", "14%", "22%", "27%"];
const COLS_EYE_PDF = ["38%", "31%", "31%"];

/** Follow-up line value: date, then "· In view of: …". */
function suiFollowUp(date: Date, inViewOf?: string | null): string {
  return `<span style="font-size:9.5px;font-weight:600;color:${SUI.INK_700};">${format(date, "EEEE, d MMM yyyy")}</span>` +
    (inViewOf && inViewOf.trim() ? `<span style="font-size:9.5px;font-style:italic;color:${SUI.INK_500};margin-left:6px;">· In view of: ${escapeHtml(inViewOf.trim())}</span>` : "");
}

/** Blank space (~17mm) for the doctor's wet signature when none is uploaded. */
const suiSignSpace = () => `<div style="height:64px;"></div>`;

/**
 * Doctor sign-off, from the doctor profile only (Settings): "Dr. {name}", then the
 * qualifications, then the registration number exactly as entered (e.g. "KMC 154173").
 * A field left blank in the profile is simply not printed.
 */
function suiDoctorSignOff(name: string, qualifications?: string | null, regNumber?: string | null): string {
  const line = (v?: string | null) => v && v.trim()
    ? `<div style="font-size:9px;color:${SUI.INK_700};margin-top:2px;">${escapeHtml(v.trim())}</div>`
    : "";
  return `<div style="font-size:11px;font-weight:700;color:#0B3D3A;margin-top:5px;">Dr. ${escapeHtml(name)}</div>` +
    line(qualifications) + line(regNumber);
}

const suiText = (html: string, color: string = SUI.INK_700, weight = 600) =>
  `<span style="font-size:9.5px;font-weight:${weight};color:${color};">${html}</span>`;

async function renderShortSummaryHtml(d: ShortSummaryData): Promise<string> {

  /*
    Palette — the app's own brand tokens from globals.css, so a printed summary
    and the screen it came from read as one product.
      #0B3D3A primary-900   #115E59 primary-700   #157A73 primary-600
      #1C9388 primary-500   #2BA89C primary-400   #DCEFEC primary-100
      #F0F8F6 primary-50
  */
  const INK = "#0B3D3A", LABEL_C = "#115E59", BRAND = "#157A73", MINT = "#2BA89C";
  const LINE = "#D3E6E2";
  /* ── Inline section: label tag on the left, content on the same row ── */
  /* ── Patient info field box: label + value inside a single teal-bordered box ── */
  const fbox = (label: string, value: string) =>
    `<td style="padding-right:10px;padding-bottom:6px;vertical-align:top;">` +
    `<div style="background:#fff;border:1.5px solid ${MINT};border-radius:5px;padding:4px 9px 5px;min-height:26px;">` +
    `<div style="font-size:7.5px;font-weight:700;color:${LABEL_C};letter-spacing:0.05em;text-transform:uppercase;margin-bottom:1px;">${label}</div>` +
    `<div style="font-size:9.5px;color:#111;font-weight:500;">${value || "&nbsp;"}</div>` +
    `</div>` +
    `</td>`;

  /* ── Optical Rx ── */
  const hasRx = d.opticalRx && (
    d.opticalRx.re.sph || d.opticalRx.re.cyl || d.opticalRx.re.axis ||
    d.opticalRx.le.sph || d.opticalRx.le.cyl || d.opticalRx.le.axis ||
    d.opticalRx.re.nearSph || d.opticalRx.le.nearSph
  );
  /* ── Minor Procedure: procedureName stored as JSON array, join for display ── */
  const rawProc = d.minorProcedure?.procedureName ?? "";
  let procDisplay = rawProc;
  if (rawProc) {
    try {
      const parsed = JSON.parse(rawProc);
      if (Array.isArray(parsed)) procDisplay = parsed.filter((s: unknown) => typeof s === "string").join(", ");
    } catch {}
  }

  const CSS = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      font-size: 9.5px; font-weight: 500; line-height: 1.4; color: #000000;
      background: #fff;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    table { width: 100%; border-collapse: collapse; }
    .footer {
      position: running(footer);
      font-size: 7.5px; color: #000000;
      display: flex; align-items: center; justify-content: space-between;
      border-top: 1px solid #ddd; padding-top: 4px;
    }
    @page { @bottom-center { content: element(footer); } }
    .page-num::after { content: counter(page); }
    .page-total::after { content: counter(pages); }
    @media print { .no-break { page-break-inside: avoid; break-inside: avoid; } }
    ${SUMMARY_UI_CSS}
  `;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Consultation Summary: ${escapeHtml(d.patient.name)}</title>
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
      <div style="font-size:8.5px;font-weight:900;color:${INK};letter-spacing:0.07em;text-transform:uppercase;white-space:nowrap;">
        CONSULTATION SUMMARY
      </div>
      <div style="height:2px;width:100%;background:linear-gradient(90deg,transparent,${BRAND},${MINT});border-radius:1px;margin:6px 0 0;"></div>
    </div>

    <!-- Right: Doctor name, specialty, date & time -->
    <div style="text-align:right;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;justify-content:center;padding-top:2px;padding-right:6px;">
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
      ${fbox("Patient ID", escapeHtml(d.patient.udid) + (d.patient.uhid ? ' / ' + escapeHtml(d.patient.uhid) : ''))}
      ${fbox("Age / Gender", `${d.patient.age} yrs / ${escapeHtml(d.patient.sex)}`)}
      ${fbox("Mobile", d.patient.mobile ? escapeHtml(d.patient.mobile) : "—")}
    </tr>
  </tbody>
</table>

<!-- 1 · CHIEF COMPLAINT -->
${d.chiefComplaint ? suiLine("Chief Complaint", suiComplaintChips(d.chiefComplaint)) : ""}

<!-- 2 · DRUG ALLERGY -->
${d.nkda
  ? suiLine("Drug Allergy", suiText("NKDA — No Known Drug Allergies", "#15803D"), true)
  : d.allergies
  ? suiLine("Drug Allergy", suiText(escapeHtml(d.allergies), "#DC2626", 700), true)
  : ""}

<!-- 3 · DIAGNOSIS -->
${d.diagnoses.length ? suiLine("Diagnosis", suiDiagnosisChips(d.diagnoses)) : ""}

<!-- 4 · MINOR PROCEDURE -->
${procDisplay ? suiLine("Minor Procedure", suiProcedure(d.minorProcedure!, procDisplay)) : ""}

<!-- 5 · MEDICATIONS -->
${d.medications.length
  ? suiBlock("Medications", suiTable(SUI_MED_COLS, "", suiMedicationRows(d.medications, d.visit.date, false)))
  : ""}

<!-- 6 · SPECTACLE RX — the Subjective prescription only (matches the screen) -->
${hasRx ? suiBlock("Spectacle Rx", suiRxTable(d.opticalRx!.re, d.opticalRx!.le)) : ""}

<!-- 7 · INVESTIGATIONS -->
${d.investigations.length ? suiBlock("Investigations", suiInvestigationList(d.investigations)) : ""}

<!-- 8 · FOLLOW-UP with In View Of -->
${d.visit.followUpDate ? suiLine("Follow-up", suiFollowUp(new Date(d.visit.followUpDate), d.visit.inViewOf)) : ""}

<!-- 9 · ADVICE -->
${d.advice && d.advice.trim() ? suiBlock("Advice", suiNote(d.advice.trim(), "amber", false)) : ""}

<!-- 10 · REFERRAL -->
${d.visit.referralEnabled
  ? suiLine("Referral",
      suiText(d.visit.referralNote && d.visit.referralNote.trim() ? escapeHtml(d.visit.referralNote.trim()) : "Referred") +
      (d.visit.inViewOf && d.visit.inViewOf.trim() && !d.visit.followUpDate
        ? `<span style="font-size:9.5px;font-style:italic;color:${SUI.INK_500};margin-left:6px;">· In view of: ${escapeHtml(d.visit.inViewOf.trim())}</span>`
        : ""))
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
        : suiSignSpace()}
    <div style="font-size:7px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${LABEL_C};margin-top:3px;">
      Doctor&rsquo;s Signature
    </div>
    ${suiDoctorSignOff(d.visit.doctorName, d.visit.doctorQualifications, d.visit.doctorRegNumber)}
  </div>
</div>

<!-- CLOSING LINE -->
<div style="margin-top:12px;padding-top:7px;border-top:1px solid ${LINE};text-align:center;">
  <span style="font-size:9px;font-style:italic;color:${LABEL_C};">Thank you for trusting us with your care.</span>
</div>

</div><!-- end flex-column page wrapper -->

<!-- RUNNING FOOTER -->
<div class="footer">
  <span>CONFIDENTIAL, For authorized clinical use only</span>
  <span>UDID: ${escapeHtml(d.patient.udid)}</span>
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

export type FullEmrData = {
  patient: { udid: string; name: string; age: number; sex: string; mobile?: string | null; address?: string | null };
  visit: {
    date: Date; visitType?: string | null; hospitalName: string; hospitalLogo?: string | null;
    hospitalAddress?: string | null; hospitalContact?: string | null; hospitalEmail?: string | null; doctorName: string;
    /* Sign-off, from the doctor profile. Absent fields are not printed. */
    doctorQualifications?: string | null; doctorRegNumber?: string | null;
    followUpDate?: Date | null; referralEnabled?: boolean; referralNote?: string | null; inViewOf?: string | null;
  };
  generalExam?: {
    bp?: string | null; pulse?: string | null; temperature?: string | null; weight?: string | null;
    chiefComplaint?: string | null; hpi?: string | null;
    pastMedicalHistory?: string[] | null; pmhOtherText?: string | null;
    medications?: string | null; allergies?: string | null; nkda?: boolean | null;
    familyHistory?: string | null; socialHistory?: string | null;
  } | null;
  visualAcuity?: {
    testMethod?: string | null;
    reDistance?: { unaided?: string; ph?: string; bcva?: string } | null;
    leDistance?: { unaided?: string; ph?: string; bcva?: string } | null;
    reNear?: string | null; leNear?: string | null;
    reNearN?: string | null; leNearN?: string | null;
  } | null;
  iopReadings: { method: string; re?: string | null; le?: string | null; takenAt: Date }[];
  gonioscopy?: { re?: string | null; le?: string | null; reDeg?: string | null; leDeg?: string | null; method?: string | null } | null;
  colourVision?: {
    re?: { cvMethod?: string; result?: string; notes?: string; csMethod?: string; csResult?: string; csNotes?: string } | null;
    le?: { cvMethod?: string; result?: string; notes?: string; csMethod?: string; csResult?: string; csNotes?: string } | null;
    notes?: string | null;
  } | null;
  tearFilm?: { tbutRe?: number | null; tbutLe?: number | null; schirmer1Re?: number | null; schirmer1Le?: number | null; schirmer2Re?: number | null; schirmer2Le?: number | null } | null;
  lacrimalSac?: { re?: { chips?: string[]; findings?: string } | null; le?: { chips?: string[]; findings?: string } | null; method?: string | null } | null;
  diplopiaChart?: Record<string, { status?: string; notes?: string }> | null;
  hessChart?: { grid?: Record<string, any>; interpretation?: string | null } | null;
  anteriorSegment?: { re?: Record<string, any> | null; le?: Record<string, any> | null } | null;
  posteriorSegment?: { re?: Record<string, any> | null; le?: Record<string, any> | null; notes?: string | null } | null;
  diagnoses: { description: string; icd10Code: string; status: string; laterality?: string | null }[];
  minorProcedure?: { procedureName?: string | null; procedureLaterality?: string | null; anesthesiaType?: string | null; procedureNotes?: string | null } | null;
  medications: { drugName: string; dosage?: string | null; frequency?: string | null; duration?: string | null; instructions?: string | null; route?: string | null; laterality?: string | null }[];
  adviseNotes?: string | null;
  opticalRx?: {
    re: { sph?: string; cyl?: string; axis?: string; va?: string; nearSph?: string; nearVa?: string; nearCyl?: string; nearAxis?: string; method?: string };
    le: { sph?: string; cyl?: string; axis?: string; va?: string; nearSph?: string; nearVa?: string; nearCyl?: string; nearAxis?: string; method?: string };
  } | null;
  extraCorrections?: { label: string; re: { sph?: string; cyl?: string; axis?: string; nearSph?: string; va?: string; nearVa?: string; method?: string }; le: { sph?: string; cyl?: string; axis?: string; nearSph?: string; va?: string; nearVa?: string; method?: string } }[] | null;
  retinoscopy?: { re?: { sph?: string; cyl?: string; axis?: string } | null; le?: { sph?: string; cyl?: string; axis?: string } | null } | null;
  investigations: { testName: string; priority: string; status: string; laterality?: string | null; result?: string | null; notes?: string | null }[];
};

async function renderFullEmrHtml(d: FullEmrData): Promise<string> {
  const ge = d.generalExam;
  const va = d.visualAcuity;

  /* PMH */
  const rawPmh = ge?.pastMedicalHistory;
  const pmhList = (Array.isArray(rawPmh) ? rawPmh
    : (typeof rawPmh === "string" ? (() => { try { return JSON.parse(rawPmh); } catch { return []; } })() : [])
  ).filter(Boolean).map((item: any) => {
    if (typeof item === "string") return item;
    const since = item.sinceNum ? `${item.sinceNum} ${item.sinceUnit ?? ""}`.trim() : "";
    return item.name ? (since ? `${item.name} · ${since}` : item.name) : "";
  }).filter(Boolean);

  /* Current medications (General Exam) — structured list, same as screen */
  const currentMeds: { drugName: string; laterality?: string; dosage?: string; frequency?: string; duration?: string }[] = (() => {
    if (!ge?.medications) return [];
    try { const a = JSON.parse(ge.medications); if (Array.isArray(a)) return a.filter((m: any) => m?.drugName?.trim()); } catch { /* not JSON */ }
    return [];
  })();
  /* Older records store current medications as plain text — still print it */
  const currentMedsText: string = (() => {
    if (!ge?.medications || currentMeds.length) return "";
    try { if (Array.isArray(JSON.parse(ge.medications))) return ""; } catch { /* plain text */ }
    return ge.medications;
  })();

  /* ── Brand palette (matches Short Summary exactly) ── */
  const INK = "#0B3D3A", LABEL_C = "#115E59", BRAND = "#157A73", MINT = "#2BA89C";
  const LINE = "#D3E6E2";
  /* ── Field box (matches Short Summary) ── */
  const fbox = (label: string, value: string) =>
    `<td style="padding-right:10px;padding-bottom:6px;vertical-align:top;">` +
    `<div style="background:#fff;border:1.5px solid ${MINT};border-radius:5px;padding:4px 9px 5px;min-height:26px;">` +
    `<div style="font-size:7.5px;font-weight:700;color:${LABEL_C};letter-spacing:0.05em;text-transform:uppercase;margin-bottom:1px;">${label}</div>` +
    `<div style="font-size:9.5px;color:#111;font-weight:500;">${value || "&nbsp;"}</div>` +
    `</div>` +
    `</td>`;

  /* ── Strip leading bullet char (matches screen's stripBullet) ── */
  const stripB = (v: string | null | undefined): string =>
    v ? v.replace(/^[•·]\s*/, "") : "";

  const CSS = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      font-size: 9.5px; font-weight: 500; line-height: 1.4; color: #000000;
      background: #fff;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    table { width: 100%; border-collapse: collapse; }
    .footer {
      position: running(footer);
      font-size: 7.5px; color: #000000;
      display: flex; align-items: center; justify-content: space-between;
      border-top: 1px solid #ddd; padding-top: 4px;
    }
    @page { @bottom-center { content: element(footer); } }
    .page-num::after { content: counter(page); }
    .page-total::after { content: counter(pages); }
    @media print { .no-break { page-break-inside: avoid; break-inside: avoid; } }
    ${SUMMARY_UI_CSS}
  `;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Complete EMR: ${escapeHtml(d.patient.name)}</title>
<style>${CSS}</style>
</head>
<body>
<div style="display:flex;flex-direction:column;">

<!-- BRAND ACCENT LINE (full bleed, matches Short Summary) -->
<div style="height:4px;background:linear-gradient(90deg,${INK} 0%,${BRAND} 50%,${MINT} 100%);margin:0 -14mm;"></div>

<!-- HEADER CARD (full bleed, 3-column layout matching Short Summary) -->
<div style="margin:0 -14mm;padding:11px 14mm 13px;
            background:linear-gradient(135deg,#F7FCFB 0%,#E8F5F2 55%,#F2FAF8 100%);
            page-break-after:avoid;">
  <div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:flex-start;gap:18px;">

    <!-- Left: Logo + hospital name + contacts -->
    <div style="display:flex;align-items:flex-start;gap:12px;min-width:0;">
      ${d.visit.hospitalLogo
        ? `<div style="background:#fff;border:1.5px solid #B8DED7;border-radius:10px;padding:5px;flex-shrink:0;box-shadow:0 1px 6px rgba(21,122,115,0.12);">` +
          `<img src="${escapeHtml(d.visit.hospitalLogo)}" alt="Logo" style="width:44px;height:44px;object-fit:contain;display:block;border-radius:6px;" /></div>`
        : `<div style="background:linear-gradient(135deg,#F0F8F6,#DCEFEC);border:1.5px solid #B8DED7;` +
          `border-radius:10px;width:54px;height:54px;flex-shrink:0;display:flex;align-items:center;` +
          `justify-content:center;color:${BRAND};font-size:24px;font-weight:900;">&#10010;</div>`}
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
                (d.visit.hospitalContact && d.visit.hospitalEmail ? `<span style="color:#B8CFCA;padding:0 4px;">|</span>` : "") +
                (d.visit.hospitalEmail ? `<span>${escapeHtml(d.visit.hospitalEmail)}</span>` : "") +
                `</div>`
              : "") +
            `</div>`
          : ""}
      </div>
    </div>

    <!-- Center: Title block (matches Short Summary) -->
    <div style="text-align:center;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding-top:4px;">
      <div style="font-size:6.5px;font-weight:700;letter-spacing:0.28em;text-transform:uppercase;color:${MINT};margin-bottom:5px;">
        Clinical Record
      </div>
      <div style="font-size:8.5px;font-weight:900;color:${INK};letter-spacing:0.07em;text-transform:uppercase;white-space:nowrap;">
        COMPLETE EMR SUMMARY
      </div>
      <div style="height:2px;width:100%;background:linear-gradient(90deg,transparent,${BRAND},${MINT});border-radius:1px;margin:6px 0 0;"></div>
    </div>

    <!-- Right: Doctor name + date (matches Short Summary) -->
    <div style="text-align:right;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;justify-content:center;padding-top:2px;padding-right:6px;">
      <div style="font-size:13px;font-weight:800;color:${INK};line-height:1.2;">Dr. ${escapeHtml(d.visit.doctorName)}</div>
      <div style="font-size:9px;color:${BRAND};font-weight:600;margin-top:2px;">Consultant Ophthalmologist</div>
      <div style="font-size:8.5px;color:#4A5A57;margin-top:4px;">${format(d.visit.date, "dd MMM yyyy, hh:mm a")} IST</div>
    </div>
  </div>
</div>

<!-- SOFT DIVIDER (full bleed, matches Short Summary) -->
<div style="height:1px;background:linear-gradient(90deg,#DCEFEC,#B8DED7,#DCEFEC);margin:0 -14mm 10px;"></div>

<!-- PATIENT DETAIL STRIP (matches Short Summary fbox style) -->
<table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
  <tbody>
    <tr>
      ${fbox("Patient", escapeHtml(d.patient.name))}
      ${fbox("Patient ID", escapeHtml(d.patient.udid))}
      ${fbox("Age / Gender", `${d.patient.age} yrs / ${escapeHtml(d.patient.sex)}`)}
      ${fbox("Mobile", d.patient.mobile ? escapeHtml(d.patient.mobile) : "—")}
    </tr>
    ${d.patient.address ? `<tr>${fbox("Address", escapeHtml(d.patient.address))}<td></td><td></td><td></td></tr>` : ""}
  </tbody>
</table>

<!-- 1 · CHIEF COMPLAINT -->
${ge?.chiefComplaint ? suiLine("Chief Complaint", suiComplaintChips(ge.chiefComplaint)) : ""}

<!-- 2 · DRUG ALLERGY -->
${ge?.nkda
  ? suiLine("Drug Allergy", suiText("NKDA — No Known Drug Allergies", "#15803D"), true)
  : ge?.allergies
  ? suiLine("Drug Allergy", suiText(escapeHtml(ge.allergies), "#DC2626", 700), true)
  : ""}

<!-- 3 · HPI -->
${ge?.hpi ? suiBlock("History of Present Illness", suiNote(ge.hpi, "sky", false)) : ""}

<!-- 4 · PAST HISTORY -->
${ge && pmhList.length
  ? suiLine("Past History",
      `<span style="display:inline-flex;flex-wrap:wrap;gap:5px;">` +
      pmhList.map((item: string) => {
        const [name, ...since] = item.split(" · ");
        return `<span style="display:inline-block;padding:1px 8px;border:1px solid #BFDBFE;border-radius:999px;background:#EFF6FF;color:#1E40AF;font-size:9.5px;font-weight:500;line-height:15px;">` +
          escapeHtml(name) +
          (since.length ? `<span style="font-weight:400;margin-left:3px;">· ${escapeHtml(since.join(" · "))}</span>` : "") +
          `</span>`;
      }).join("") +
      `</span>`)
  : ""}

<!-- 5 · SYSTEMIC HISTORY -->
${ge && (ge.pmhOtherText || ge.socialHistory)
  ? suiBlock("Systemic History",
      (ge.pmhOtherText ? suiNote(ge.pmhOtherText, "slate", false) : "") +
      (ge.socialHistory ? `<div style="margin-top:2px;font-size:9.5px;color:${SUI.INK_700};"><span style="color:${SUI.INK_400};">Social History:</span> ${escapeHtml(ge.socialHistory)}</div>` : ""))
  : ""}

<!-- 5a · FAMILY HISTORY -->
${ge?.familyHistory && ge.familyHistory.trim() ? suiBlock("Family History", suiNote(ge.familyHistory, "slate", false)) : ""}

<!-- 5b · CURRENT MEDICATIONS -->
${currentMedsText
  ? suiBlock("Current Medications", `<div style="font-size:9.5px;color:${SUI.INK_700};white-space:pre-wrap;">${escapeHtml(currentMedsText)}</div>`)
  : currentMeds.length
  ? suiBlock("Current Medications", suiTable(SUI_MED_COLS, "",
      currentMeds.map((m, i) =>
        `<tr>` +
        `<td style="${SUI_TD_MUTED}">${i + 1}</td>` +
        `<td style="${SUI_TD}font-weight:600;">` +
        (m.laterality ? `<span style="font-weight:700;color:${SUI.P700};margin-right:6px;">${escapeHtml(m.laterality)}</span>` : "") +
        `${escapeHtml(m.drugName)}</td>` +
        `<td style="${SUI_TD_MUTED}">${suiVal(m.dosage)}</td>` +
        `<td style="${SUI_TD_MUTED}">${suiVal(m.frequency)}</td>` +
        `<td style="${SUI_TD_MUTED}white-space:nowrap;">${suiVal(m.duration)}</td>` +
        `</tr>`).join("")))
  : ""}

<!-- 6 · VITALS — one line -->
${ge && (ge.bp || ge.pulse || ge.temperature || ge.weight)
  ? suiLine("Vitals",
      `<span style="font-size:9.5px;color:${SUI.INK_700};">` +
      ([
        ["BP", ge.bp, "mmHg"], ["Pulse", ge.pulse, "bpm"], ["Weight", ge.weight, "kg"], ["Temp", ge.temperature, "°C"],
      ] as [string, string | null | undefined, string][])
        .filter(([, v]) => !!v)
        .map(([k, v, unit]) =>
          `<span style="color:${SUI.INK_400};">${k}:</span> <span style="font-weight:500;">${escapeHtml(v)}${String(v).includes(unit) ? "" : ` ${unit}`}</span>`)
        .join(`<span style="color:${SUI.INK_300};margin:0 6px;">·</span>`) +
      `</span>`)
  : ""}

<!-- 7 · VISUAL ACUITY -->
${va && [va.reDistance?.unaided, va.reDistance?.ph, va.reDistance?.bcva, va.leDistance?.unaided, va.leDistance?.ph, va.leDistance?.bcva, va.reNear, va.leNear, va.reNearN, va.leNearN].some(Boolean)
  ? suiBlock(`Visual Acuity${va.testMethod ? ` · ${escapeHtml(va.testMethod)}` : ""}`,
      suiTable(["40%", "30%", "30%"], suiEyeHead(),
        suiEyeRow(`Unaided / UCVA <span style="color:${SUI.INK_400};font-size:8px;">(Dist)</span>`, suiVal(va.reDistance?.unaided), suiVal(va.leDistance?.unaided)) +
        suiEyeRow("Pinhole (PH)", suiVal(va.reDistance?.ph), suiVal(va.leDistance?.ph), { stripe: true }) +
        suiEyeRow("Best Corrected (BCVA)", suiVal(va.reDistance?.bcva), suiVal(va.leDistance?.bcva)) +
        (va.reNear || va.leNear ? suiEyeRow(`Unaided / UCNV <span style="color:${SUI.INK_400};font-size:8px;">(Near)</span>`, suiVal(va.reNear), suiVal(va.leNear), { stripe: true }) : "") +
        (va.reNearN || va.leNearN ? suiEyeRow("Best Corrected (BCNV)", suiVal(va.reNearN), suiVal(va.leNearN)) : "")))
  : ""}

<!-- 8 · REFRACTIONS — one block per method -->
${(() => {
  const blocks: string[] = [];
  const push = (label: string, re: any, le: any, method = "") => {
    const grid = suiRxTable(re, le, method);
    if (grid) blocks.push(suiBlock(escapeHtml(label), grid));
  };
  if (d.opticalRx) {
    const rxMethod = d.opticalRx.re?.method || d.opticalRx.le?.method || "";
    push(`Spectacles / Refraction${rxMethod ? " · " + rxMethod : ""}`, d.opticalRx.re, d.opticalRx.le);
  }
  (d.extraCorrections ?? []).forEach((ec) => {
    const method = ec.re?.method || ec.le?.method || "";
    push(`${ec.label}${method ? " · " + method : ""}`, ec.re, ec.le, method);
  });
  if (d.retinoscopy && (d.retinoscopy.re || d.retinoscopy.le)) push("Retinoscopy", d.retinoscopy.re, d.retinoscopy.le);
  return blocks.join("");
})()}

<!-- 9 · EOM / DEVIATION (Diplopia & Hess Charts) -->
${(() => {
  const dp = d.diplopiaChart;
  const hc = d.hessChart;
  const POSITIONS = ["TL","T","TR","L","C","R","BL","B","BR"];
  const POS_LABELS: Record<string,string> = { TL:"↖ Up-Left",T:"↑ Up",TR:"↗ Up-Right",L:"← Left",C:"Primary",R:"→ Right",BL:"↙ Down-Left",B:"↓ Down",BR:"↘ Down-Right" };
  const rows = dp ? POSITIONS.map((pos) => ({ pos, cell: dp[pos] }))
    .filter(({ cell }) => cell && cell.status && cell.status !== "NOT_TESTED") : [];
  const interp = hc?.interpretation ?? "";
  if (!rows.length && !interp) return "";
  const table = rows.length
    ? suiTable(["30%", "35%", "35%"],
        `<thead><tr><th style="${SUI_TH}">Position</th><th style="${SUI_TH}">Diplopia</th><th style="${SUI_TH}">Notes</th></tr></thead>`,
        rows.map(({ pos, cell }, i) =>
          `<tr style="${i % 2 !== 0 ? `background:${SUI.SUNKEN};` : ""}">` +
          `<td style="${SUI_TD_MUTED}">${POS_LABELS[pos] ?? pos}</td>` +
          `<td style="${SUI_TD}font-weight:500;color:${cell!.status === "DIPLOPIA_PRESENT" ? "#DC2626" : "#15803D"};">${escapeHtml(cell!.status!.replace(/_/g, " "))}</td>` +
          `<td style="${SUI_TD_MUTED}">${cell!.notes ? escapeHtml(cell!.notes) : "—"}</td>` +
          `</tr>`).join(""))
    : "";
  return suiBlock("Ocular Motility / EOM &amp; Deviation",
    table + (interp ? `<p style="margin-top:5px;font-size:9.5px;font-style:italic;line-height:1.55;color:${SUI.INK_600};">${escapeHtml(interp)}</p>` : ""));
})()}

<!-- 10 · COLOUR VISION & CONTRAST SENSITIVITY -->
${d.colourVision
  ? (() => {
      const re = d.colourVision!.re;
      const le = d.colourVision!.le;
      type MRow = { method: string; re: string; reNotes: string; le: string; leNotes: string };
      const buildRows = (reM: string, leM: string, reVal: string, reN: string, leVal: string, leN: string): MRow[] => {
        if (reM === leM) return [{ method: reM, re: reVal, reNotes: reN, le: leVal, leNotes: leN }];
        const out: MRow[] = [];
        if (reVal) out.push({ method: reM, re: reVal, reNotes: reN, le: "", leNotes: "" });
        if (leVal) out.push({ method: leM, re: "", reNotes: "", le: leVal, leNotes: leN });
        return out;
      };
      const cvRows = buildRows(re?.cvMethod || "", le?.cvMethod || "", re?.result || "", re?.notes || "", le?.result || "", le?.notes || "");
      const csRows = buildRows(re?.csMethod || "", le?.csMethod || "", re?.csResult || "", re?.csNotes || "", le?.csResult || "", le?.csNotes || "");
      const cell = (v: string, n: string) =>
        `<div>${suiVal(v)}</div>` + (n ? `<div style="font-size:8px;font-style:italic;color:${SUI.INK_400};margin-top:1px;">[${escapeHtml(n)}]</div>` : "");
      const methodGrid = (rows: MRow[], label: string) => {
        if (!rows.some((r) => r.re || r.le)) return "";
        return `<div class="no-break" style="margin-bottom:12px;">` +
          suiTable(COLS_EYE_PDF, suiEyeHead(label, true),
            rows.map((row) => suiEyeRow(suiBullet + escapeHtml(row.method || "—"), cell(row.re, row.reNotes), cell(row.le, row.leNotes))).join(""),
            { indent: true, divided: true }) +
          `</div>`;
      };
      return methodGrid(cvRows, "Colour Vision") + methodGrid(csRows, "Contrast Sensitivity") +
        (d.colourVision!.notes ? `<div style="margin:-6px 0 12px;padding-left:${SUI.INDENT}px;font-size:9.5px;color:${SUI.INK_700};"><span style="color:${SUI.INK_400};">Notes:</span> ${escapeHtml(d.colourVision!.notes)}</div>` : "");
    })()
  : ""}

<!-- 11 · IOP & GONIOSCOPY -->
${(() => {
  const gonio = d.gonioscopy;
  const hasI = d.iopReadings.length > 0;
  const hasG = !!(gonio?.re || gonio?.le);
  if (!hasI && !hasG) return "";
  const fmtTime = (dt: any) => dt ? new Date(dt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : "";
  const fmtGonio = (finding: string | null | undefined, deg: string | null | undefined): string | null => {
    const f = stripB(finding);
    if (deg && /^\d+(\.\d+)?$/.test(deg.trim())) deg = `${deg.trim()}°`;
    if (!f && !deg) return null;
    if (!deg) return f || null;
    if (!f) return deg;
    return `${deg} ${f}`;
  };
  let out = "";
  if (hasI) {
    out += `<div class="no-break" style="margin-bottom:12px;">` +
      suiTable(COLS_EYE_PDF, suiEyeHead("IOP", true, " (mmHg)", " (mmHg)"),
        d.iopReadings.map((r) => {
          const t = fmtTime(r.takenAt);
          return suiEyeRow(suiBullet + escapeHtml(r.method || "—") + (t ? ` · ${escapeHtml(t)}` : ""), suiVal(r.re), suiVal(r.le), { strong: true });
        }).join(""),
        { indent: true, divided: true }) +
      `</div>`;
  }
  if (hasG) {
    out += `<div class="no-break" style="margin-bottom:12px;">` +
      suiTable(COLS_EYE_PDF, suiEyeHead("Gonioscopy", true),
        suiEyeRow(suiBullet + escapeHtml(gonio?.method || "—"), suiVal(fmtGonio(gonio!.re, gonio!.reDeg)), suiVal(fmtGonio(gonio!.le, gonio!.leDeg))),
        { indent: true, divided: true }) +
      `</div>`;
  }
  return out;
})()}

<!-- 12 · TEAR FILM -->
${(() => {
  const tf = d.tearFilm;
  if (!tf) return "";
  const rows = ([
    ["TBUT (sec)", tf.tbutRe, tf.tbutLe],
    ["Schirmer’s 1 (mm)", tf.schirmer1Re, tf.schirmer1Le],
    ["Schirmer’s 2 (mm)", tf.schirmer2Re, tf.schirmer2Le],
  ] as [string, number | null | undefined, number | null | undefined][])
    .filter(([, re, le]) => re != null || le != null)
    .map(([label, re, le]) => suiEyeRow(label, suiVal(re), suiVal(le))).join("");
  return rows
    ? `<div class="no-break" style="margin-bottom:12px;">${suiTable(COLS_EYE_PDF, suiEyeHead("Tear Film"), rows, { indent: true, divided: true })}</div>`
    : "";
})()}

<!-- 13 · LACRIMAL SAC -->
${(() => {
  const ls = d.lacrimalSac;
  if (!ls) return "";
  // Chips, then the typed note, skipping a note that only repeats a chip (same as the screen).
  const eyeText = (eye?: { chips?: string[]; findings?: string } | null) => {
    if (!eye) return "";
    const chips = eye.chips ?? [];
    const note = (eye.findings ?? "").trim();
    const repeats = chips.some((c) => c.trim().toLowerCase() === note.toLowerCase());
    return [chips.join(", "), repeats ? "" : note].filter(Boolean).join(" · ");
  };
  const re = eyeText(ls.re);
  const le = eyeText(ls.le);
  if (!re && !le) return "";
  return `<div class="no-break" style="margin-bottom:12px;">` +
    suiTable(COLS_EYE_PDF, suiEyeHead(`Lacrimal Sac Syringing${ls.method ? ` · ${escapeHtml(ls.method)}` : ""}`, true), suiEyeRow("Findings", suiVal(re), suiVal(le)), { indent: true, divided: true }) +
    `</div>`;
})()}

<!-- 14 · ANTERIOR SEGMENT -->
${d.anteriorSegment
  ? (() => {
      const re: Record<string, any> = (d.anteriorSegment.re as any) ?? {};
      const le: Record<string, any> = (d.anteriorSegment.le as any) ?? {};
      const antMethod: string = (re._method ?? le._method ?? "") as string;
      const ANT_FIELDS: [string, string][] = [
        ["upperLid", "Upper Lid"], ["lowerLid", "Lower Lid"], ["conjunctiva", "Conjunctiva"],
        ["sclera", "Sclera"], ["cornea", "Cornea"], ["anteriorChamber", "Ant. Chamber"],
        ["iris", "Iris"], ["pupil", "Pupil"], ["lens", "Lens"],
      ];
      const joinNotes = (e: Record<string, any>) =>
        Array.from(new Set([e.freeText, e._notes].filter((x): x is string => typeof x === "string" && !!x.trim()))).join("\n");
      const noteRe = joinNotes(re);
      const noteLe = joinNotes(le);
      const rows: [string, string, string][] = [
        ...ANT_FIELDS.filter(([k]) => re[k] || le[k]).map(([k, label]): [string, string, string] => [label, stripB(re[k]), stripB(le[k])]),
        ...(noteRe || noteLe ? [["Notes", noteRe, noteLe] as [string, string, string]] : []),
      ];
      if (!rows.length) return "";
      return `<div class="no-break" style="margin-bottom:12px;">` +
        suiTable(COLS_EYE_PDF, suiEyeHead(`Anterior Segment · ${escapeHtml(antMethod || "Slit Lamp")}`),
          rows.map(([label, r, l], i) => label === "Notes"
            ? suiEyeRow("Notes", suiValLines(r), suiValLines(l), { stripe: i % 2 !== 0 })
            : suiEyeRow(escapeHtml(label), suiVal(r), suiVal(l), { stripe: i % 2 !== 0 })).join(""),
          { indent: true }) +
        `</div>`;
    })()
  : ""}

<!-- 15 · POSTERIOR SEGMENT -->
${(() => {
  const ps = d.posteriorSegment as any;
  if (!ps) return "";
  const re: Record<string, any> = ps.re ?? {};
  const le: Record<string, any> = ps.le ?? {};
  const posMethod: string = (re._method ?? le._method ?? "") as string;
  const posReNotes: string = (re._notes ?? "") as string;
  const posLeNotes: string = (le._notes ?? "") as string;
  const POS_LABELS: Record<string, string> = {
    media: "Media", discSize: "Disc Size", discShape: "Disc Shape",
    discColour: "Disc Colour", discVessels: "Disc Vessels", discMargin: "Disc Margin",
    cdr: "CDR", nrr: "NRR", macula: "Macula", retinalVessels: "Retinal Vessels",
    background: "Background", periphery: "Periphery",
  };
  const keys = Array.from(new Set([...Object.keys(re), ...Object.keys(le)])).filter((k) => !k.startsWith("_") && (re[k] || le[k]));
  if (!keys.length && !posReNotes && !posLeNotes && !ps.notes) return "";
  const rows = keys.map((k, i) => suiEyeRow(escapeHtml(POS_LABELS[k] ?? k), suiVal(stripB(re[k])), suiVal(stripB(le[k])), { stripe: i % 2 !== 0 })).join("") +
    (posReNotes || posLeNotes ? suiEyeRow("Notes", suiValLines(posReNotes), suiValLines(posLeNotes), { stripe: keys.length % 2 !== 0 }) : "");
  return `<div class="no-break" style="margin-bottom:12px;">` +
    (rows ? suiTable(COLS_EYE_PDF, suiEyeHead(`Posterior Segment · ${escapeHtml(posMethod || "Indirect Ophthalmoscope")}`), rows, { indent: true }) : "") +
    (ps.notes ? `<p style="margin-top:5px;padding-left:${SUI.INDENT}px;font-size:9.5px;font-style:italic;line-height:1.4;color:${SUI.INK_500};white-space:pre-wrap;">${escapeHtml(ps.notes)}</p>` : "") +
    `</div>`;
})()}

<!-- 16 · DIAGNOSIS -->
${d.diagnoses.length
  ? suiLine("Diagnosis", suiDiagnosisChips(
      [...d.diagnoses].sort((a, b) => {
        const ord: Record<string, number> = { ACTIVE: 0, CHRONIC: 1, RESOLVED: 2 };
        return (ord[a.status] ?? 3) - (ord[b.status] ?? 3);
      }), true))
  : ""}

<!-- 17 · MINOR PROCEDURE -->
${d.minorProcedure?.procedureName ? suiLine("Minor Procedure", suiProcedure(d.minorProcedure, d.minorProcedure.procedureName)) : ""}

<!-- 18 · TREATMENT PLAN: MEDICATIONS -->
${d.medications.length
  ? suiBlock("Treatment Plan: Medications", suiTable(SUI_MED_COLS, "", suiMedicationRows(d.medications, d.visit.date, true)))
  : ""}

<!-- 19 · INVESTIGATIONS -->
${d.investigations.length ? suiBlock("Investigations", suiInvestigationList(d.investigations)) : ""}

<!-- 20 · FOLLOW-UP with In View Of -->
${d.visit.followUpDate ? suiLine("Follow-up", suiFollowUp(new Date(d.visit.followUpDate), d.visit.inViewOf)) : ""}

<!-- 21 · ADVICE -->
${d.adviseNotes ? suiBlock("Advice", suiNote(d.adviseNotes, "amber", false)) : ""}

<!-- 22 · REFERRAL -->
${d.visit.referralEnabled
  ? suiLine("Referral",
      suiText(d.visit.referralNote && d.visit.referralNote.trim() ? escapeHtml(d.visit.referralNote.trim()) : "Referred") +
      (d.visit.inViewOf && d.visit.inViewOf.trim() && !d.visit.followUpDate
        ? `<span style="font-size:9.5px;font-style:italic;color:${SUI.INK_500};margin-left:6px;">· In view of: ${escapeHtml(d.visit.inViewOf.trim())}</span>`
        : ""))
  : ""}

<!-- DOCTOR SIGNATURE (matches Short Summary sign-off block) -->
<div class="no-break" style="margin-top:0;display:flex;justify-content:flex-end;">
  <div style="width:210px;text-align:center;">
    ${suiSignSpace()}
    <div style="font-size:7px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${LABEL_C};margin-top:3px;">
      Doctor&rsquo;s Signature
    </div>
    ${suiDoctorSignOff(d.visit.doctorName, d.visit.doctorQualifications, d.visit.doctorRegNumber)}
  </div>
</div>

<!-- CLOSING LINE (matches Short Summary) -->
<div style="margin-top:12px;padding-top:7px;border-top:1px solid ${LINE};text-align:center;">
  <span style="font-size:9px;font-style:italic;color:${LABEL_C};">Thank you for trusting us with your care.</span>
</div>

</div><!-- end flex-column page wrapper -->

<!-- RUNNING FOOTER (matches Short Summary) -->
<div class="footer">
  <span>CONFIDENTIAL, For authorized clinical use only</span>
  <span>UDID: ${escapeHtml(d.patient.udid)}</span>
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
        reDistance: reVA ? { unaided: reVA.unaided, ph: reVA.pinhole, bcva: reVA.bestCorrected } : null,
        leDistance: leVA ? { unaided: leVA.unaided, ph: leVA.pinhole, bcva: leVA.bestCorrected } : null,
        reNear: reVA?.nearUnaided ?? null, leNear: leVA?.nearUnaided ?? null,
      } : null,
      iopReadings: (visit.iopReadings ?? []).map((r: any) => ({
        method: r.method ?? "—",
        re: r.re != null ? String(r.re) : null,
        le: r.le != null ? String(r.le) : null,
        takenAt: r.takenAt ?? visit.date,
      })),
      colourVision: null,
      anteriorSegment: null,
      posteriorSegment: null,
      diagnoses: (visit.diagnoses ?? []).map((d: any) => ({ description: d.description, icd10Code: d.icd10Code ?? "", status: d.status ?? null, laterality: d.laterality ?? null })),
      medications: (visit.medications ?? []).map((m: any) => ({ drugName: m.drugName, dosage: m.dosage ?? null, frequency: m.frequency ?? null, duration: m.duration ?? null, instructions: m.instructions ?? null, route: m.route ?? null, laterality: m.laterality ?? null })),
      opticalRx: {
        re: { sph: reRef?.sph, cyl: reRef?.cyl, axis: reRef?.axis, va: reRef?.va, nearSph: reRef?.nearSph, nearVa: reRef?.nearVa },
        le: { sph: leRef?.sph, cyl: leRef?.cyl, axis: leRef?.axis, va: leRef?.va, nearSph: leRef?.nearSph, nearVa: leRef?.nearVa },
      },
      investigations: (visit.investigationOrders ?? []).map((o: any) => ({ testName: o.testName, priority: o.priority ?? null, status: o.status ?? null, result: printableResult(o.resultRef), notes: o.notes ?? null })),
    };
  }

  const patient = visits[0].patient;
  const qr = await makeQr(`PPMS-${patient.udid}-AllVisits`);

  const visitBlocks = visits.map((visit, idx) => {
    const d = buildData(visit);
    const ge = d.generalExam;
    const va = d.visualAcuity;

    const diagRows = d.diagnoses.length
      ? d.diagnoses.map((dx, i) => `<tr><td class="td-num">${i + 1}</td><td class="td-head">${dx.status && dx.status !== "BLANK" ? `<span style="color:#888;font-weight:400;margin-right:4px;">${escapeHtml(dx.status.charAt(0) + dx.status.slice(1).toLowerCase())} ·</span>` : ""}${dx.laterality ? `<span style="font-weight:700;color:#1a6e6a;margin-right:5px;">${escapeHtml(dx.laterality)}</span>` : ""}${escapeHtml(dx.description)}</td><td><span class="td-mono">${val(dx.icd10Code)}</span></td><td>${badgeStatus(dx.status)}</td></tr>`).join("")
      : `<tr class="empty-row"><td colspan="4">No diagnoses recorded</td></tr>`;

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
    const visitDate = new Date(visit.date);
    const medRows = d.medications.length
      ? d.medications.map((m, i) => {
          const split = splitTaperPdf(m.instructions, m.duration);
          const baseDur = durCellPdf(split.baseDuration, visitDate);
          let offsetDays = baseDur.days ?? null;
          const mainRow = `<tr><td class="td-num">${i + 1}</td><td><div class="drug-name">${pdfMedBadge4(m.route, m.laterality, m.drugName)}${escapeHtml(m.drugName)}</div>${split.note ? `<div class="drug-sub">${escapeHtml(split.note)}</div>` : ""}</td><td>${val(m.dosage)}</td><td>${val(m.frequency)}</td><td>${baseDur.html}</td></tr>`;
          const taperRows = split.taper.map((t) => {
            const taperStart = offsetDays !== null ? addDaysPdf(visitDate, offsetDays!) : visitDate;
            const taperDur = durCellPdf(`${t.durationNum} ${t.durationUnit}`, taperStart);
            if (taperDur.days !== null && offsetDays !== null) offsetDays += taperDur.days;
            else offsetDays = null;
            return `<tr style="background:#f8fafa;"><td class="td-num" style="color:#bbb;">↓</td><td style="padding:3px 8px;font-size:8.5px;color:#666;">↓ Taper</td><td>${t.dose ? escapeHtml(t.dose) : `<span style="color:#aaa;">—</span>`}</td><td>${t.frequency ? escapeHtml(t.frequency) : `<span style="color:#aaa;">—</span>`}</td><td>${taperDur.html}</td></tr>`;
          }).join("");
          return mainRow + taperRows;
        }).join("")
      : `<tr class="empty-row"><td colspan="5">No medications prescribed</td></tr>`;

    const invRows = d.investigations.length
      ? d.investigations.map((o, i) => `<tr><td class="td-num">${i + 1}</td><td class="td-head">${val(o.testName)}</td><td>${o.notes ? escapeHtml(o.notes) : "<span style='color:#aaa;font-style:italic;'>—</span>"}</td></tr>`).join("")
      : `<tr class="empty-row"><td colspan="3">No investigations ordered</td></tr>`;

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
        <thead><tr><th style="width:150px"></th><th class="td-head" style="font-weight:700;">RE</th><th class="td-head" style="font-weight:700;">LE</th></tr></thead>
        <tbody>
          <tr><td class="td-head">Unaided / UCVA (Dist)</td><td>${val(va.reDistance?.unaided)}</td><td>${val(va.leDistance?.unaided)}</td></tr>
          <tr><td class="td-head">Pinhole (PH)</td><td>${val(va.reDistance?.ph)}</td><td>${val(va.leDistance?.ph)}</td></tr>
          <tr><td class="td-head">Best Corrected (BCVA)</td><td>${val(va.reDistance?.bcva)}</td><td>${val(va.leDistance?.bcva)}</td></tr>
          ${va.reNear || va.leNear ? `<tr><td class="td-head">Unaided / UCNV (Near)</td><td>${val(va.reNear)}</td><td>${val(va.leNear)}</td></tr>` : ""}
          ${va.reNearN || va.leNearN ? `<tr><td class="td-head">Best Corrected (BCNV)</td><td>${val(va.reNearN ?? null)}</td><td>${val(va.leNearN ?? null)}</td></tr>` : ""}
        </tbody>
      </table>` : ""}

      ${secHdr("Assessment / Diagnosis")}
      <table>
        <thead><tr><th style="width:24px">#</th><th>Diagnosis</th><th style="width:80px">ICD-10</th><th style="width:90px">Status</th></tr></thead>
        <tbody>${diagRows}</tbody>
      </table>

      ${secHdr("Medications")}
      <table>
        <thead><tr><th style="width:24px">#</th><th>Drug</th><th style="width:80px">Dosage</th><th style="width:110px">Frequency</th><th style="width:80px">Duration</th></tr></thead>
        <tbody>${medRows}</tbody>
      </table>

      ${secHdr("Investigations")}
      <table>
        <tbody>${invRows}</tbody>
      </table>
    </div>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>All Visit History: ${escapeHtml(patient.name)}</title>
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
      <div class="lh-hosp-sub">All recorded visits, chronological order</div>
    </div>
    <div class="lh-right">
      <span class="doc-name">${escapeHtml(patient.name)}</span>
      UDID: ${escapeHtml(patient.udid)}<br/>
      ${patient.age} yrs / ${escapeHtml(patient.sex)}<br/>
      Generated: ${format(new Date(), "dd MMM yyyy, hh:mm a")}
    </div>
  </div>
  <div class="doc-type-bar">Complete Visit History: ${visits.length} Visit${visits.length !== 1 ? "s" : ""}</div>

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
      followUpDate: (visit as any).followUpDate ?? null,
      referralEnabled: (visit as any).referralEnabled ?? false,
      referralNote: (visit as any).referralNote ?? null,
      inViewOf: (visit as any).inViewOf ?? null,
    },
    generalExam: ge ? {
      bp: ge.bp, pulse: ge.pulse, temperature: ge.temperature, weight: ge.weight,
      chiefComplaint: ge.chiefComplaint, hpi: ge.hpi,
      pastMedicalHistory: ge.pastMedicalHistory ?? [], pmhOtherText: ge.pmhOtherText,
      medications: ge.medications, allergies: ge.allergies, nkda: ge.nkda,
      familyHistory: ge.familyHistory, socialHistory: ge.socialHistory,
    } : null,
    visualAcuity: va ? {
      testMethod: va.testMethod ?? null,
      reDistance: reVA ? { unaided: reVA.unaided, ph: reVA.pinhole, bcva: reVA.bestCorrected } : null,
      leDistance: leVA ? { unaided: leVA.unaided, ph: leVA.pinhole, bcva: leVA.bestCorrected } : null,
      reNear: reVA?.nearUnaided ?? null, leNear: leVA?.nearUnaided ?? null,
      reNearN: reVA?.nearBestCorrected ?? null, leNearN: leVA?.nearBestCorrected ?? null,
    } : null,
    iopReadings: (visit.iopReadings ?? []).map((r: any) => ({
      method: r.method ?? "—",
      re: r.re != null ? String(r.re) : null,
      le: r.le != null ? String(r.le) : null,
      takenAt: r.takenAt ?? visit.date,
    })),
    colourVision: (visit as any).colourVisionCS ? (() => {
      const reJ = parseJ2((visit as any).colourVisionCS.re) as any;
      const leJ = parseJ2((visit as any).colourVisionCS.le) as any;
      const fmtEye = (eye: any) => !eye ? null : {
        cvMethod: eye.cvMethod ?? undefined,
        result: eye.result ?? undefined,
        notes: eye.notes ?? undefined,
        csMethod: eye.csMethod ?? undefined,
        csResult: eye.csResult ?? undefined,
        csNotes: eye.csNotes ?? undefined,
      };
      return { re: fmtEye(reJ), le: fmtEye(leJ), notes: (visit as any).colourVisionCS.notes ?? null };
    })() : null,
    gonioscopy: (visit as any).gonioNotes ? (() => { try { const g = parseJ2((visit as any).gonioNotes) as any; return g ? { re: g.re ?? null, le: g.le ?? null, reDeg: g.reDeg ?? null, leDeg: g.leDeg ?? null, method: g.method ?? null } : null; } catch { return null; } })() : null,
    tearFilm: visit.tearFilm ? {
      tbutRe: visit.tearFilm.tbutRe ?? null, tbutLe: visit.tearFilm.tbutLe ?? null,
      schirmer1Re: visit.tearFilm.schirmer1Re ?? null, schirmer1Le: visit.tearFilm.schirmer1Le ?? null,
      schirmer2Re: visit.tearFilm.schirmer2Re ?? null, schirmer2Le: visit.tearFilm.schirmer2Le ?? null,
    } : null,
    lacrimalSac: (() => {
      const ls = visit.lacrimalSac;
      if (!ls) return null;
      const parseEye = (raw: unknown) => {
        const parsed = parseJ2(raw as any);
        if (!parsed) return null;
        return Array.isArray(parsed)
          ? { chips: parsed as string[], findings: "" }
          : { chips: (parsed as any).chips ?? [], findings: (parsed as any).findings ?? "" };
      };
      const reRaw = parseJ2(ls.re as any) as any;
      const method = reRaw && !Array.isArray(reRaw) ? (reRaw.method ?? null) : null;
      return { re: ls.re ? parseEye(ls.re) : null, le: ls.le ? parseEye(ls.le) : null, method };
    })(),
    anteriorSegment: ant ? { re: parseJ2(ant.re) ?? null, le: parseJ2(ant.le) ?? null } : null,
    posteriorSegment: pos ? { re: parseJ2(pos.re) ?? null, le: parseJ2(pos.le) ?? null, notes: pos.notes ?? null } : null,
    diplopiaChart: visit.diplopiaChart ? parseJ2(visit.diplopiaChart.grid) : null,
    diagnoses: (visit.diagnoses ?? []).map((d: any) => ({ description: d.description, icd10Code: d.icd10Code ?? "", status: d.status ?? null, laterality: d.laterality ?? null })),
    minorProcedure: (visit as any).procedureName ? {
      procedureName: (visit as any).procedureName ?? null,
      procedureLaterality: (visit as any).procedureLaterality ?? null,
      anesthesiaType: (visit as any).anesthesiaType ?? null,
      procedureNotes: (visit as any).procedureNotes ?? null,
    } : null,
    medications: (visit.medications ?? []).map((m: any) => ({ drugName: m.drugName, dosage: m.dosage ?? null, frequency: m.frequency ?? null, duration: m.duration ?? null, instructions: m.instructions ?? null, route: m.route ?? null, laterality: m.laterality ?? null })),
    adviseNotes: (visit as any).adviseNotes ?? null,
    opticalRx: {
      re: { sph: reRef?.sph, cyl: reRef?.cyl, axis: reRef?.axis, va: reRef?.va, nearSph: reRef?.nearSph, nearVa: reRef?.nearVa, nearCyl: reRef?.nearCyl, nearAxis: reRef?.nearAxis },
      le: { sph: leRef?.sph, cyl: leRef?.cyl, axis: leRef?.axis, va: leRef?.va, nearSph: leRef?.nearSph, nearVa: leRef?.nearVa, nearCyl: leRef?.nearCyl, nearAxis: leRef?.nearAxis },
    },
    extraCorrections: (() => {
      const rawExtras: any[] = parseJ2((ref as any)?.extraCorrections) ?? [];
      if (!Array.isArray(rawExtras) || rawExtras.length === 0) return null;
      const out: any[] = [];
      rawExtras.forEach((ex: any) => {
        if (ex._v === 2) {
          const methods = (ex.methods || {}) as Record<string, { re: any; le: any }>;
          Object.entries(methods).forEach(([method, entry]) => {
            if (Object.values(entry.re || {}).some(Boolean))
              out.push({ label: (ex.label || "Extra Correction").replace(/^Correction\b/i, "Refraction"), re: { ...entry.re, method }, le: { ...entry.le, method } });
          });
        } else {
          out.push({ label: (ex.label || "Extra Correction").replace(/^Correction\b/i, "Refraction"), re: { ...ex.re, method: ex.re?.method || "" }, le: { ...ex.le, method: ex.le?.method || "" } });
        }
      });
      return out.length ? out : null;
    })(),
    investigations: (visit.investigationOrders ?? []).map((o: any) => ({ testName: o.testName, priority: o.priority ?? null, status: o.status ?? null, laterality: o.laterality ?? null, result: printableResult(o.resultRef), notes: o.notes ?? null })),
  };

  return htmlToPdf(await renderFullEmrHtml(data));
}
