import { format as formatBase } from "date-fns";
import { toISTWall } from "@/lib/ist";
import QRCode from "qrcode";
import type { Browser } from "puppeteer-core";
import { complaintLabel, parseComplaintItems } from "@/lib/appointment-cc";

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
  lacrimalSac?: { re?: { chips?: string[]; findings?: string } | null; le?: { chips?: string[]; findings?: string } | null } | null;
  diplopiaChart?: Record<string, { status?: string; notes?: string }> | null;
  hessChart?: { grid?: Record<string, { reH?: string; reV?: string; leH?: string; leV?: string }>; interpretation?: string | null } | null;
};

async function renderShortSummaryHtml(d: ShortSummaryData): Promise<string> {
  const v2 = (x: unknown) => (x === null || x === undefined || x === "") ? "" : escapeHtml(String(x));


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

  /* ── Patient info field box: label + value inside a single teal-bordered box ── */
  const fbox = (label: string, value: string) =>
    `<td style="padding-right:10px;padding-bottom:6px;vertical-align:top;">` +
    `<div style="background:#fff;border:1.5px solid ${MINT};border-radius:5px;padding:4px 9px 5px;min-height:26px;">` +
    `<div style="font-size:7.5px;font-weight:700;color:${LABEL_C};letter-spacing:0.05em;text-transform:uppercase;margin-bottom:1px;">${label}</div>` +
    `<div style="font-size:9.5px;color:#111;font-weight:500;">${value || "&nbsp;"}</div>` +
    `</div>` +
    `</td>`;

  /* ── Key-value row (follow-up): borderless, report style ── */
  const kvRow = (label: string, value: string) =>
    `<tr>` +
    `<td style="padding:2.5px 12px 2.5px 0;font-size:9.5px;font-weight:700;color:#4A5A57;width:34%;">${label}</td>` +
    `<td style="padding:2.5px 0;font-size:9.5px;color:#1a1a1a;">${value}</td>` +
    `</tr>`;

  const simpleRows = (rows: Array<readonly string[]>) =>
    `<table style="width:100%;"><tbody>${rows.map(([label, value]) =>
      `<tr><td style="${TD}width:34%;font-weight:700;color:#4A5A57;">${escapeHtml(label ?? "")}</td><td style="${TD}">${v2(value ?? "")}</td></tr>`
    ).join("")}</tbody></table>`;

  /* ── Table header style ── */
  const TH = `padding:4px 7px;color:#0D4A45;border-bottom:2px solid #C8E8E4;font-size:8.5px;font-weight:700;text-align:left;`;

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

  const MED_TD = `padding:6px 7px;border-bottom:1px dotted #C8DBD8;font-size:9.5px;`;

  const medRows = d.medications.length
    ? d.medications.map((m, i) => {
        const split = splitTaperPdf(m.instructions, m.duration);
        const baseDur = durCellPdf(split.baseDuration, d.visit.date);
        let offsetDays = baseDur.days ?? null;
        const mainRow =
          `<tr style="background:#fff;">` +
          `<td style="${MED_TD}text-align:center;color:#888;">${i + 1}</td>` +
          `<td style="${MED_TD}">` +
          pdfMedBadge2(m.route, m.laterality, m.drugName) +
          `<span style="font-weight:700;color:#1a1a1a;">${escapeHtml(m.drugName)}</span>` +
          (split.note ? `<span style="font-size:8.5px;color:#777;margin-left:5px;">${escapeHtml(split.note)}</span>` : "") +
          `</td>` +
          `<td style="${MED_TD}">${v2(m.dosage)}</td>` +
          `<td style="${MED_TD}">${v2(m.frequency)}</td>` +
          `<td style="${MED_TD}">${baseDur.html}</td>` +
          `</tr>`;
        const taperRows = split.taper.map((t) => {
          const taperStart = offsetDays !== null ? addDaysPdf(d.visit.date, offsetDays!) : d.visit.date;
          const taperDur = durCellPdf(`${t.durationNum} ${t.durationUnit}`, taperStart);
          if (taperDur.days !== null && offsetDays !== null) offsetDays += taperDur.days;
          else offsetDays = null;
          return `<tr style="background:#f8fafa;">` +
            `<td style="${MED_TD}text-align:center;color:#bbb;">↓</td>` +
            `<td style="${MED_TD}padding-left:16px;font-size:8.5px;color:#888;">↓ Taper</td>` +
            `<td style="${MED_TD}">${t.dose ? escapeHtml(t.dose) : `<span style="color:#aaa;">—</span>`}</td>` +
            `<td style="${MED_TD}">${t.frequency ? escapeHtml(t.frequency) : `<span style="color:#aaa;">—</span>`}</td>` +
            `<td style="${MED_TD}">${taperDur.html}</td>` +
            `</tr>`;
        }).join("");
        return mainRow + taperRows;
      }).join("")
    : `<tr><td colspan="5" style="padding:4px 8px;border:none;">${none("No medications prescribed")}</td></tr>`;

  /* ── Optical Rx ── */
  const hasRx = d.opticalRx && (
    d.opticalRx.re.sph || d.opticalRx.re.cyl || d.opticalRx.re.axis ||
    d.opticalRx.le.sph || d.opticalRx.le.cyl || d.opticalRx.le.axis ||
    d.opticalRx.re.nearSph || d.opticalRx.le.nearSph
  );
  const rxTd = (val?: string) => `<td style="${TD}text-align:center;">${v2(val)}</td>`;
  const rxRowFn = (eye: string, sph?: string, cyl?: string, axis?: string, va?: string, near?: string, nearVa?: string) =>
    `<tr><td style="${TD}font-weight:700;color:#0B3D3A;">${eye}</td>` +
    rxTd(sph) + rxTd(cyl) + rxTd(axis) + rxTd(va) + rxTd(near) + rxTd(nearVa) + `</tr>`;

  /* ── Minor Procedure: procedureName stored as JSON array, join for display ── */
  const rawProc = d.minorProcedure?.procedureName ?? "";
  let procDisplay = rawProc;
  if (rawProc) {
    try {
      const parsed = JSON.parse(rawProc);
      if (Array.isArray(parsed)) procDisplay = parsed.filter((s: unknown) => typeof s === "string").join(", ");
    } catch {}
  }

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
${d.chiefComplaint
  ? inlineCard("Chief Complaint",
      `<div style="font-size:10.5px;font-weight:600;color:${INK};">${complaintHtml(d.chiefComplaint)}</div>`)
  : ""}

<!-- 1b · DRUG ALLERGY -->
${d.nkda
  ? inlineCard("Drug Allergy",
      `<div style="font-size:10.5px;font-weight:700;color:#059669;">✓ NKDA — No Known Drug Allergies</div>`)
  : d.allergies
  ? inlineCard("Drug Allergy",
      `<div style="font-size:10.5px;font-weight:700;color:#DC2626;">${escapeHtml(d.allergies)}</div>`)
  : ""}

<!-- 2 · CLINICAL IMPRESSION -->
${inlineCard("Clinical Impression",
  d.diagnoses.length
    ? `<div style="font-size:10.5px;font-weight:600;color:${INK};line-height:1.9;">` +
      d.diagnoses.map((dx) =>
        (dx.status && dx.status !== "BLANK" ? `<span style="color:#888;font-weight:400;">${escapeHtml(dx.status.charAt(0) + dx.status.slice(1).toLowerCase())} ·</span> ` : "") +
        (dx.laterality ? `<span style="color:#1a6e6a;font-weight:700;margin-right:4px;">${escapeHtml(dx.laterality)}</span>` : "") +
        escapeHtml(dx.description)
      ).join("<br>") +
      `</div>`
    : none("No diagnosis recorded"))}

<!-- 2b · MINOR PROCEDURE (only when recorded) -->
${procDisplay
  ? inlineCard("Minor Procedure",
      `<div style="font-size:10.5px;font-weight:600;color:${INK};">` +
      [
        d.minorProcedure!.procedureLaterality ? escapeHtml(d.minorProcedure!.procedureLaterality!) : "",
        escapeHtml(procDisplay),
        d.minorProcedure!.anesthesiaType ? `Under ${escapeHtml(d.minorProcedure!.anesthesiaType!)}` : "",
      ].filter(Boolean).join(`<span style="color:#B0BDBA;margin:0 5px;">·</span>`) +
      `</div>` +
      (d.minorProcedure!.procedureNotes ? `<div style="margin-top:6px;padding:6px 10px;background:#F0F8F6;border:1px solid #C7DED9;border-left:3px solid #2BA89C;border-radius:0 5px 5px 0;font-size:9px;color:#2A4A46;line-height:1.55;white-space:pre-wrap;">${escapeHtml(d.minorProcedure!.procedureNotes)}</div>` : ""))
  : ""}

<!-- 3 · MEDICATIONS -->
${d.medications.length
  ? card("Medications",
      `<table>
    <tbody>${medRows}</tbody>
  </table>`)
  : ""}

<!-- 4 · SPECTACLES / REFRACTION (only if an Rx exists) -->
${hasRx
  ? card(`Spectacles / Refraction${d.opticalRx?.re.method || d.opticalRx?.le.method ? ` — ${escapeHtml(d.opticalRx!.re.method || d.opticalRx!.le.method || "")}` : ""}`,
      `<table>
        <thead><tr>
          <th style="${TH}width:90px;">Eye</th>
          <th style="${TH}text-align:center;">Sph</th>
          <th style="${TH}text-align:center;">Cyl</th>
          <th style="${TH}text-align:center;">Axis°</th>
          <th style="${TH}text-align:center;background:#f4f6f5;">VA</th>
          <th style="${TH}text-align:center;">Add</th>
          <th style="${TH}text-align:center;background:#f4f6f5;">NV</th>
        </tr></thead>
        <tbody>
          ${(() => {
            const rxRowGrey2 = (eye: string, sph?: string, cyl?: string, axis?: string, va?: string, near?: string, nearVa?: string) =>
              `<tr><td style="${TD}font-weight:700;color:#0B3D3A;">${eye}</td>` +
              rxTd(sph) + rxTd(cyl) + rxTd(axis) +
              `<td style="${TD}text-align:center;background:#f4f6f5;">${v2(va)}</td>` +
              rxTd(near) +
              `<td style="${TD}text-align:center;background:#f4f6f5;">${v2(nearVa)}</td></tr>`;
            return rxRowGrey2("Right Eye", d.opticalRx!.re.sph, d.opticalRx!.re.cyl, d.opticalRx!.re.axis, d.opticalRx!.re.va, d.opticalRx!.re.nearSph, d.opticalRx!.re.nearVa) +
                   rxRowGrey2("Left Eye", d.opticalRx!.le.sph, d.opticalRx!.le.cyl, d.opticalRx!.le.axis, d.opticalRx!.le.va, d.opticalRx!.le.nearSph, d.opticalRx!.le.nearVa);
          })()}
        </tbody>
      </table>`)
  : ""}

<!-- 4b · EXTRA CORRECTIONS -->
${d.extraCorrections && d.extraCorrections.length > 0
  ? d.extraCorrections.map((ec) => {
      const ecMethod = ec.re?.method || ec.le?.method || "";
      const rxRowGrey = (eye: string, sph?: string, cyl?: string, axis?: string, va?: string, near?: string, nearVa?: string) =>
        `<tr><td style="${TD}font-weight:700;color:#0B3D3A;">${eye}</td>` +
        rxTd(sph) + rxTd(cyl) + rxTd(axis) +
        `<td style="${TD}text-align:center;background:#f4f6f5;">${v2(va)}</td>` +
        rxTd(near) +
        `<td style="${TD}text-align:center;background:#f4f6f5;">${v2(nearVa)}</td></tr>`;
      return card(`${escapeHtml(ec.label)}${ecMethod ? ` · ${escapeHtml(ecMethod)}` : ""}`,
        `<table>
          <thead><tr>
            <th style="${TH}width:90px;">Eye</th>
            <th style="${TH}text-align:center;">Sph</th>
            <th style="${TH}text-align:center;">Cyl</th>
            <th style="${TH}text-align:center;">Axis°</th>
            <th style="${TH}text-align:center;background:#f4f6f5;">VA</th>
            <th style="${TH}text-align:center;">Add</th>
            <th style="${TH}text-align:center;background:#f4f6f5;">NV</th>
          </tr></thead>
          <tbody>
            ${rxRowGrey("Right Eye", ec.re?.sph, ec.re?.cyl, ec.re?.axis, ec.re?.va, ec.re?.nearSph, ec.re?.nearVa)}
            ${rxRowGrey("Left Eye", ec.le?.sph, ec.le?.cyl, ec.le?.axis, ec.le?.va, ec.le?.nearSph, ec.le?.nearVa)}
          </tbody>
        </table>`);
    }).join("")
  : ""}

<!-- 5 · INVESTIGATIONS -->
${d.investigations.length
  ? card("Investigations",
      `<table style="width:100%;">
        <tbody>
          ${d.investigations.map((inv, i) =>
            `<tr>` +
            `<td style="${TD}text-align:center;color:#8A9793;font-size:9px;width:24px;">${i + 1}</td>` +
            `<td style="${TD}font-size:9.5px;font-weight:600;">` +
            (inv.laterality ? `<span style="font-size:8px;font-weight:700;color:${BRAND};margin-right:4px;">${escapeHtml(inv.laterality)}</span>` : "") +
            escapeHtml(inv.testName) +
            (inv.notes ? `<span style="font-weight:400;font-style:italic;color:#555;margin-left:5px;">· In view of: ${escapeHtml(inv.notes)}</span>` : "") +
            `</td>` +
            `</tr>`
          ).join("")}
        </tbody>
      </table>`)
  : ""}

<!-- 6 · FOLLOW-UP with In View Of -->
${d.visit.followUpDate
  ? inlineCard("Follow-up",
      `<div style="font-size:10.5px;font-weight:600;color:${INK};">${format(new Date(d.visit.followUpDate), "EEEE, dd MMM yyyy")}</div>` +
      (d.visit.inViewOf && d.visit.inViewOf.trim()
        ? `<div style="font-size:9px;color:#4A5A57;margin-top:3px;line-height:1.4;"><span style="font-weight:700;text-transform:uppercase;letter-spacing:0.08em;font-size:8px;">In View Of:</span> ${escapeHtml(d.visit.inViewOf.trim())}</div>`
        : ""))
  : ""}

<!-- 7 · ADVICE NOTES -->
${d.advice && d.advice.trim()
  ? `<div class="no-break" style="font-size:9.5px;color:#1a1a1a;white-space:pre-wrap;line-height:1.5;margin-bottom:11px;padding:8px 12px;border:1px solid #FDE68A;border-left:4px solid #F59E0B;border-radius:4px;background:#FFFBEB;">${escapeHtml(d.advice.trim())}</div>`
  : ""}

<!-- 8 · REFERRAL with In View Of -->
${d.visit.referralEnabled && d.visit.referralNote && d.visit.referralNote.trim()
  ? inlineCard("Referral",
      `<div style="font-size:10.5px;font-weight:600;color:${INK};">${escapeHtml(d.visit.referralNote.trim())}</div>` +
      (d.visit.inViewOf && d.visit.inViewOf.trim() && !d.visit.followUpDate
        ? `<div style="font-size:9px;color:#4A5A57;margin-top:3px;line-height:1.4;"><span style="font-weight:700;text-transform:uppercase;letter-spacing:0.08em;font-size:8px;">In View Of:</span> ${escapeHtml(d.visit.inViewOf.trim())}</div>`
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
  lacrimalSac?: { re?: { chips?: string[]; findings?: string } | null; le?: { chips?: string[]; findings?: string } | null } | null;
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
  ).filter(Boolean).map((item: any) => typeof item === "string" ? item : (item.name ?? "")).filter(Boolean);

  const v2 = (x: unknown) => (x === null || x === undefined || x === "") ? "" : escapeHtml(String(x));

  /* ── Brand palette (matches Short Summary exactly) ── */
  const INK = "#0B3D3A", LABEL_C = "#115E59", BRAND = "#157A73", MINT = "#2BA89C";
  const TINT = "#F0F8F6", LINE = "#D3E6E2";

  /* ── Rounded section card (matches Short Summary) ── */
  const card = (label: string, inner: string) =>
    `<div class="no-break" style="border:1px solid ${LINE};border-radius:6px;overflow:hidden;margin-bottom:12px;">` +
    `<div style="background:${TINT};border-bottom:1px solid ${LINE};padding:4.5px 10px;">` +
    `<span style="font-size:8.5px;font-weight:800;letter-spacing:0.11em;text-transform:uppercase;color:${LABEL_C};">${label}</span>` +
    `</div>` +
    `<div style="padding:7px 10px;">${inner}</div>` +
    `</div>`;

  /* ── Field box (matches Short Summary) ── */
  const fbox = (label: string, value: string) =>
    `<td style="padding-right:10px;padding-bottom:6px;vertical-align:top;">` +
    `<div style="background:#fff;border:1.5px solid ${MINT};border-radius:5px;padding:4px 9px 5px;min-height:26px;">` +
    `<div style="font-size:7.5px;font-weight:700;color:${LABEL_C};letter-spacing:0.05em;text-transform:uppercase;margin-bottom:1px;">${label}</div>` +
    `<div style="font-size:9.5px;color:#111;font-weight:500;">${value || "&nbsp;"}</div>` +
    `</div>` +
    `</td>`;

  /* ── None / empty state ── */
  const none = (t: string) => `<span style="color:#9AA5A3;font-style:italic;font-size:9.5px;">${t}</span>`;
  const emptyNote = none("Not recorded");

  /* ── Table header / cell style (matches Short Summary) ── */
  const TH = `padding:4px 7px;color:#0D4A45;border-bottom:2px solid #C8E8E4;font-size:8.5px;font-weight:700;text-align:left;`;
  const TD = `padding:3.5px 7px;border-bottom:1px solid #ECF3F1;font-size:9.5px;`;
  const MED_TD = `padding:6px 5px;border-bottom:1px dotted #C8DBD8;font-size:9.5px;`;

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
  const prioBadge = (p: string | null | undefined) => {
    if (!p) return "";
    const u = p.toUpperCase();
    const [fg, bg] = u === "STAT" ? ["#92400E", "#FEF3C7"] : u === "URGENT" ? ["#B91C1C", "#FEE2E2"] : [LABEL_C, "#DCF5EF"];
    return `<span style="font-size:8px;font-weight:700;color:${fg};background:${bg};padding:1px 6px;border-radius:3px;">${escapeHtml(p)}</span>`;
  };

  /* ── Status badge ── */
  const statusBadge = (s: string | null | undefined) => {
    if (!s) return "";
    const l = s.toLowerCase().replace(/_/g, " ");
    const [fg, bg] = l.includes("resolv") || l.includes("complet") ? ["#15803D", "#F0FDF4"]
      : l.includes("active") ? ["#15803D", "#DCFCE7"]
      : ["#92400E", "#FEF3C7"];
    return `<span style="font-size:8px;font-weight:700;color:${fg};background:${bg};padding:1px 6px;border-radius:3px;">${escapeHtml(l)}</span>`;
  };

  /* ── Medication badge (matches Short Summary) ── */
  const medBadge = (route: string | null | undefined, lat: string | null | undefined, name: string) => {
    const r = route ?? "";
    if (r === "Topical" || /eye\s*drops?|eye\s*oint/i.test(name)) {
      const lbl = lat || "OU";
      return `<span style="display:inline-block;min-width:24px;padding:1px 4px;border-radius:3px;background:#DBEAFE;color:#1D4ED8;font-size:7px;font-weight:700;text-align:center;margin-right:3px;">${escapeHtml(lbl)}</span>`;
    }
    if (/syrup|suspension/i.test(r) || /syrup|suspension/i.test(name))
      return `<span style="display:inline-block;min-width:24px;padding:1px 4px;border-radius:3px;background:#D1FAE5;color:#065F46;font-size:7px;font-weight:700;text-align:center;margin-right:3px;">SYP</span>`;
    if (r === "IM" || r === "IV" || r === "Intravitreal" || r === "Subconjunctival" || r === "Subtenon" || /inject/i.test(name))
      return `<span style="display:inline-block;min-width:24px;padding:1px 4px;border-radius:3px;background:#FFE4E6;color:#9F1239;font-size:7px;font-weight:700;text-align:center;margin-right:3px;">INJ</span>`;
    if (r === "Oral" || /tablet|capsule/i.test(name))
      return `<span style="display:inline-block;min-width:24px;padding:1px 4px;border-radius:3px;background:#FEF3C7;color:#92400E;font-size:7px;font-weight:700;text-align:center;margin-right:3px;">TAB</span>`;
    return "";
  };

  /* ── Segment table (anterior / posterior data) ── */
  const renderSegment = (segData: Record<string, any> | null | undefined): string => {
    if (!segData || Object.keys(segData).length === 0) return emptyNote;
    const rows = Object.entries(segData).map(([k, v]: [string, any]) => {
      const label = k.replace(/([A-Z])/g, " $1").trim();
      const re = Array.isArray(v?.re) ? v.re.join(", ") : String(v?.re ?? "—");
      const le = Array.isArray(v?.le) ? v.le.join(", ") : String(v?.le ?? "—");
      return `<tr>` +
        `<td style="${TD}font-weight:600;color:${LABEL_C};width:130px;">${escapeHtml(label)}</td>` +
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

  /* ── Strip leading bullet char (matches screen's stripBullet) ── */
  const stripB = (v: string | null | undefined): string =>
    v ? v.replace(/^[•·]\s*/, "") : "";

  /* ── Eye-section table builder (section label | RE | LE, with row dividers) ── */
  const eyeTbl = (sectionLabel: string, rows: Array<[string, string | null | undefined, string | null | undefined]>): string => {
    const bodyRows = rows.filter(([, re, le]) => re || le)
      .map(([label, re, le]) =>
        `<tr style="border-bottom:1px solid #ECF3F1;">` +
        `<td style="${TD}color:#555;">${escapeHtml(label)}</td>` +
        `<td style="${TD}">${re ? escapeHtml(re) : `<span style="color:#ccc;">—</span>`}</td>` +
        `<td style="${TD}">${le ? escapeHtml(le) : `<span style="color:#ccc;">—</span>`}</td>` +
        `</tr>`
      ).join("");
    if (!bodyRows) return "";
    return `<table style="width:100%;border-collapse:collapse;">` +
      `<thead><tr>` +
      `<th style="${TH}">${sectionLabel}</th>` +
      `<th style="${TH}color:${LABEL_C};">RE</th>` +
      `<th style="${TH}color:${LABEL_C};">LE</th>` +
      `</tr></thead>` +
      `<tbody>${bodyRows}</tbody>` +
      `</table>`;
  };

  /* ── Data rows ── */
  const diagRows = d.diagnoses.length
    ? d.diagnoses.map((dx, i) =>
        `<tr style="background:${i % 2 === 0 ? "#fff" : TINT};">` +
        `<td style="${TD}text-align:center;color:#888;">${i + 1}</td>` +
        `<td style="${TD}font-weight:600;">${dx.status && dx.status !== "BLANK" ? `<span style="color:#888;font-weight:400;margin-right:4px;">${escapeHtml(dx.status.charAt(0) + dx.status.slice(1).toLowerCase())} ·</span>` : ""}${dx.laterality ? `<span style="color:#1a6e6a;font-weight:700;margin-right:5px;">${escapeHtml(dx.laterality)}</span>` : ""}${escapeHtml(dx.description)}</td>` +
        `<td style="${TD}font-family:'Courier New',monospace;font-size:8.5px;color:#555;">${dx.icd10Code ? escapeHtml(dx.icd10Code) : ""}</td>` +
        `<td style="${TD}">${dx.status ? diagBadge(dx.status) : ""}</td>` +
        `</tr>`).join("")
    : `<tr><td colspan="4" style="padding:6px 8px;font-size:9.5px;color:#aaa;font-style:italic;">No diagnoses recorded</td></tr>`;

  const medRows = d.medications.length
    ? d.medications.map((m, i) => {
        const split = splitTaperPdf(m.instructions, m.duration);
        const baseDur = durCellPdf(split.baseDuration, d.visit.date);
        let offsetDays = baseDur.days ?? null;
        const mainRow =
          `<tr style="background:#fff;">` +
          `<td style="${MED_TD}text-align:center;color:#888;">${i + 1}</td>` +
          `<td style="${MED_TD}">${medBadge(m.route, m.laterality, m.drugName)}` +
          `<span style="font-weight:700;color:#1a1a1a;">${escapeHtml(m.drugName)}</span>` +
          (split.note ? `<span style="font-size:8.5px;color:#777;margin-left:5px;">${escapeHtml(split.note)}</span>` : "") +
          `</td>` +
          `<td style="${MED_TD}">${v2(m.dosage)}</td>` +
          `<td style="${MED_TD}">${v2(m.frequency)}</td>` +
          `<td style="${MED_TD}">${baseDur.html}</td>` +
          `</tr>`;
        const taperRows = split.taper.map((t) => {
          const taperStart = offsetDays !== null ? addDaysPdf(d.visit.date, offsetDays!) : d.visit.date;
          const taperDur = durCellPdf(`${t.durationNum} ${t.durationUnit}`, taperStart);
          if (taperDur.days !== null && offsetDays !== null) offsetDays += taperDur.days;
          else offsetDays = null;
          return `<tr style="background:#f8fafa;">` +
            `<td style="${MED_TD}text-align:center;color:#bbb;">↓</td>` +
            `<td style="${MED_TD}padding-left:16px;font-size:8.5px;color:#888;">↓ Taper</td>` +
            `<td style="${MED_TD}">${t.dose ? escapeHtml(t.dose) : `<span style="color:#aaa;">—</span>`}</td>` +
            `<td style="${MED_TD}">${t.frequency ? escapeHtml(t.frequency) : `<span style="color:#aaa;">—</span>`}</td>` +
            `<td style="${MED_TD}">${taperDur.html}</td>` +
            `</tr>`;
        }).join("");
        return mainRow + taperRows;
      }).join("")
    : `<tr><td colspan="5" style="padding:4px 8px;border:none;">${none("No medications prescribed")}</td></tr>`;

  const invRows = d.investigations.length
    ? d.investigations.map((inv, i) =>
        `<tr style="background:${i % 2 === 0 ? "#fff" : TINT};">` +
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
    <tr>
      ${fbox("Date of Visit", format(d.visit.date, "dd MMM yyyy"))}
      ${fbox("Visit Time", format(d.visit.date, "hh:mm a") + " IST")}
      ${fbox("Visit Type", escapeHtml(d.visit.visitType ?? "Consultation"))}
      ${d.patient.address ? fbox("Address", escapeHtml(d.patient.address)) : `<td></td>`}
    </tr>
  </tbody>
</table>

<!-- 1 · CHIEF COMPLAINT -->
${ge?.chiefComplaint
  ? card("Chief Complaint",
      `<div style="font-size:10.5px;font-weight:600;color:${INK};">${complaintHtml(ge.chiefComplaint)}</div>`)
  : ""}

<!-- 2 · ALLERGY — separate, bright red bold -->
${ge?.nkda
  ? card("Drug Allergy",
      `<div style="font-size:10.5px;font-weight:700;color:#059669;">✓ NKDA — No Known Drug Allergies</div>`)
  : ge?.allergies
  ? card("Drug Allergy",
      `<div style="font-size:10.5px;font-weight:700;color:#DC2626;">${escapeHtml(ge.allergies)}</div>`)
  : ""}

<!-- 3 · HPI -->
${ge?.hpi
  ? card("History of Present Illness",
      `<div style="background:${TINT};border-left:3px solid ${BRAND};border-radius:0 4px 4px 0;padding:6px 10px;font-size:9.5px;line-height:1.65;white-space:pre-wrap;">${escapeHtml(ge.hpi)}</div>`)
  : ""}

<!-- 4 · PAST HISTORY -->
${ge && pmhList.length
  ? card("Past History",
      `<div style="font-size:9.5px;color:${INK};line-height:1.7;">${pmhList.map(escapeHtml).join(", ")}</div>`)
  : ""}

<!-- 5 · SYSTEMIC HISTORY -->
${ge && (ge.pmhOtherText || ge.medications || ge.familyHistory || ge.socialHistory)
  ? card("Systemic History",
      `<div style="font-size:9.5px;color:${INK};line-height:1.7;">` +
      (ge.pmhOtherText ? `<div style="margin-bottom:4px;white-space:pre-wrap;">${escapeHtml(ge.pmhOtherText)}</div>` : "") +
      (ge.medications ? `<div><strong style="color:${LABEL_C};">Current Medications:</strong> ${(() => {
        try {
          const meds = typeof ge.medications === "string" ? JSON.parse(ge.medications!) : ge.medications;
          if (Array.isArray(meds) && meds.length) {
            return meds.map((m: any) => escapeHtml([m.drugName, m.dosage, m.frequency, m.duration].filter(Boolean).join(" · "))).join(", ");
          }
        } catch { /* plain text */ }
        return escapeHtml(ge.medications!);
      })()}</div>` : "") +
      (ge.familyHistory ? `<div><strong style="color:${LABEL_C};">Family History:</strong> ${escapeHtml(ge.familyHistory)}</div>` : "") +
      (ge.socialHistory ? `<div><strong style="color:${LABEL_C};">Social History:</strong> ${escapeHtml(ge.socialHistory)}</div>` : "") +
      `</div>`)
  : ""}

<!-- 6 · VITALS — single compact line -->
${ge && (ge.bp || ge.pulse || ge.temperature || ge.weight)
  ? card("Vitals",
      `<div style="font-size:9.5px;color:${INK};display:flex;flex-wrap:wrap;gap:0 20px;">` +
      (ge.bp        ? `<span><strong style="color:${LABEL_C};">BP:</strong> ${escapeHtml(ge.bp)} mmHg</span>` : "") +
      (ge.pulse     ? `<span><strong style="color:${LABEL_C};">Pulse:</strong> ${escapeHtml(ge.pulse)} bpm</span>` : "") +
      (ge.temperature ? `<span><strong style="color:${LABEL_C};">Temp:</strong> ${escapeHtml(ge.temperature)}</span>` : "") +
      (ge.weight    ? `<span><strong style="color:${LABEL_C};">Wt:</strong> ${escapeHtml(ge.weight)}</span>` : "") +
      `</div>`)
  : ""}

<!-- 7 · VISUAL ACUITY -->
${va
  ? card("Visual Acuity",
      `<table style="width:100%;border-collapse:collapse;">
        <thead><tr>
          <th style="${TH}width:150px;"></th>
          <th style="${TH}font-weight:700;color:${LABEL_C};">RE</th>
          <th style="${TH}font-weight:700;color:${LABEL_C};">LE</th>
        </tr></thead>
        <tbody>
          <tr style="background:#fff;">
            <td style="${TD}color:#555;">Unaided / UCVA <span style="font-size:8px;">(Dist)</span></td>
            <td style="${TD}">${v2(va.reDistance?.unaided)}</td>
            <td style="${TD}">${v2(va.leDistance?.unaided)}</td>
          </tr>
          <tr style="background:${TINT};">
            <td style="${TD}color:#555;">Pinhole (PH)</td>
            <td style="${TD}">${v2(va.reDistance?.ph)}</td>
            <td style="${TD}">${v2(va.leDistance?.ph)}</td>
          </tr>
          <tr style="background:#fff;">
            <td style="${TD}color:#555;">Best Corrected (BCVA)</td>
            <td style="${TD}">${v2(va.reDistance?.bcva)}</td>
            <td style="${TD}">${v2(va.leDistance?.bcva)}</td>
          </tr>
          ${va.reNear || va.leNear ? `<tr style="background:${TINT};"><td style="${TD}color:#555;">Unaided <span style="font-size:8px;">(Near)</span></td><td style="${TD}">${v2(va.reNear)}</td><td style="${TD}">${v2(va.leNear)}</td></tr>` : ""}
          ${va.reNearN || va.leNearN ? `<tr style="background:#fff;"><td style="${TD}color:#555;">BCVA <span style="font-size:8px;">(Near)</span></td><td style="${TD}">${v2(va.reNearN)}</td><td style="${TD}">${v2(va.leNearN)}</td></tr>` : ""}
        </tbody>
      </table>`)
  : ""}

<!-- 8 · REFRACTIONS — all in spectacle format with method labels -->
${(() => {
  const rxTable = (label: string, re: any, le: any) =>
    `<div style="margin-bottom:8px;">` +
    `<div style="font-size:8px;font-weight:800;color:${LABEL_C};letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;">${escapeHtml(label)}</div>` +
    `<table style="width:100%;border-collapse:collapse;"><thead><tr>` +
    `<th style="${TH}width:110px;">Eye</th>` +
    `<th style="${TH}text-align:center;">Sph</th><th style="${TH}text-align:center;">Cyl</th><th style="${TH}text-align:center;">Axis°</th>` +
    `<th style="${TH}text-align:center;background:#f4f6f5;">VA</th>` +
    `<th style="${TH}text-align:center;">Add</th>` +
    `<th style="${TH}text-align:center;background:#f4f6f5;">NV</th>` +
    `</tr></thead><tbody>` +
    `<tr style="background:#fff;"><td style="${TD}font-weight:700;color:${INK};">Right Eye</td>` +
    `<td style="${TD}text-align:center;">${v2(re?.sph)}</td><td style="${TD}text-align:center;">${v2(re?.cyl)}</td><td style="${TD}text-align:center;">${v2(re?.axis)}</td>` +
    `<td style="${TD}text-align:center;background:#f4f6f5;">${v2(re?.va)}</td><td style="${TD}text-align:center;">${v2(re?.nearSph)}</td><td style="${TD}text-align:center;background:#f4f6f5;">${v2(re?.nearVa)}</td></tr>` +
    `<tr style="background:${TINT};"><td style="${TD}font-weight:700;color:${INK};">Left Eye</td>` +
    `<td style="${TD}text-align:center;">${v2(le?.sph)}</td><td style="${TD}text-align:center;">${v2(le?.cyl)}</td><td style="${TD}text-align:center;">${v2(le?.axis)}</td>` +
    `<td style="${TD}text-align:center;background:#f4f6f5;">${v2(le?.va)}</td><td style="${TD}text-align:center;">${v2(le?.nearSph)}</td><td style="${TD}text-align:center;background:#f4f6f5;">${v2(le?.nearVa)}</td></tr>` +
    `</tbody></table></div>`;
  const blocks: string[] = [];
  if (d.extraCorrections && d.extraCorrections.length > 0) {
    d.extraCorrections.forEach((ec) => {
      const method = ec.re?.method || ec.le?.method || "";
      blocks.push(rxTable(`${ec.label}${method ? " · " + method : ""}`, ec.re, ec.le));
    });
  }
  if (d.retinoscopy && (d.retinoscopy.re || d.retinoscopy.le)) {
    blocks.push(rxTable("Retinoscopy", d.retinoscopy.re, d.retinoscopy.le));
  }
  return blocks.length ? card("Refractions", blocks.join("")) : "";
})()}

<!-- 9 · EOM / DEVIATION (Diplopia & Hess Charts) -->
${(() => {
  const dp = d.diplopiaChart;
  const hc = d.hessChart;
  if (!dp && !hc) return "";
  const POSITIONS = ["TL","T","TR","L","C","R","BL","B","BR"];
  const POS_LABELS: Record<string,string> = { TL:"↖ Up-Left",T:"↑ Up",TR:"↗ Up-Right",L:"← Left",C:"Primary",R:"→ Right",BL:"↙ Down-Left",B:"↓ Down",BR:"↘ Down-Right" };
  let inner = "";
  if (dp && Object.keys(dp).length > 0) {
    const dpRows = POSITIONS.map((pos) => {
      const cell = dp[pos];
      if (!cell) return "";
      const status = cell.status ?? "";
      const hasData = status && status !== "NOT_TESTED";
      if (!hasData) return "";
      const color = status === "DIPLOPIA_PRESENT" ? "#DC2626" : "#059669";
      return `<tr><td style="${TD}font-weight:600;color:${LABEL_C};">${POS_LABELS[pos] ?? pos}</td>` +
        `<td style="${TD};color:${color};font-weight:600;">${escapeHtml(status.replace(/_/g," "))}</td>` +
        `<td style="${TD}color:#555;">${cell.notes ? escapeHtml(cell.notes) : "—"}</td></tr>`;
    }).filter(Boolean).join("");
    if (dpRows) {
      inner += `<div style="font-size:8px;font-weight:800;color:${LABEL_C};text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;">Diplopia Chart</div>` +
        `<table style="width:100%;border-collapse:collapse;"><thead><tr>` +
        `<th style="${TH}">Position</th><th style="${TH}">Diplopia</th><th style="${TH}">Notes</th>` +
        `</tr></thead><tbody>${dpRows}</tbody></table>`;
    }
  }
  if (hc) {
    if (inner) inner += `<div style="height:8px;"></div>`;
    inner += `<div style="font-size:8px;font-weight:800;color:${LABEL_C};text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;">Hess Chart</div>`;
    if (hc.interpretation) inner += `<div style="font-size:9.5px;color:${INK};margin-bottom:4px;">${escapeHtml(hc.interpretation)}</div>`;
  }
  return inner ? card("Ocular Motility / EOM & Deviation", inner) : "";
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
      const methodGrid = (rows: MRow[], label: string) => {
        if (!rows.some(r => r.method || r.re || r.le)) return "";
        const hdrTh = `font-size:8px;font-weight:700;color:${LABEL_C};text-transform:uppercase;letter-spacing:0.05em;padding:4px 6px;border-bottom:1px solid ${LINE};`;
        const bodyRows = rows.map((row, i) =>
          `<tr style="${i % 2 !== 0 ? `background:#F7FBFA;` : ""}">` +
          `<td style="${TD}vertical-align:top;">` +
          `<span style="display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;border-radius:50%;background:#EBF5F3;color:${LABEL_C};font-size:7.5px;font-weight:700;border:1px solid #C8E0DC;margin-right:5px;vertical-align:middle;">${i + 1}</span>` +
          `<span style="font-weight:600;color:${INK};">${escapeHtml(row.method || "—")}</span></td>` +
          `<td style="${TD}vertical-align:top;"><div>${v2(row.re)}</div>${row.reNotes ? `<div style="font-size:8px;color:#777;font-style:italic;">[${escapeHtml(row.reNotes)}]</div>` : ""}</td>` +
          `<td style="${TD}vertical-align:top;"><div>${v2(row.le)}</div>${row.leNotes ? `<div style="font-size:8px;color:#777;font-style:italic;">[${escapeHtml(row.leNotes)}]</div>` : ""}</td>` +
          `</tr>`
        ).join("");
        return `<div style="font-size:8px;font-weight:700;color:${LABEL_C};text-transform:uppercase;letter-spacing:0.05em;margin-bottom:3px;">${label}</div>` +
          `<table style="width:100%;border-collapse:collapse;margin-bottom:8px;">` +
          `<thead><tr><th style="width:45%;${hdrTh}"></th><th style="${hdrTh}">RE</th><th style="${hdrTh}">LE</th></tr></thead>` +
          `<tbody>${bodyRows}</tbody></table>`;
      };
      const inner = methodGrid(cvRows, "Colour Vision") + methodGrid(csRows, "Contrast Sensitivity") +
        (d.colourVision!.notes ? `<div style="margin-top:4px;font-size:9.5px;"><span style="font-weight:700;color:${LABEL_C};">Notes:</span> ${escapeHtml(d.colourVision!.notes)}</div>` : "");
      if (!inner.trim()) return "";
      return card("Colour Vision & Contrast Sensitivity", inner);
    })()
  : ""}

<!-- 11 · IOP & GONIOSCOPY -->
${(() => {
  const gonio = d.gonioscopy;
  const hasI = d.iopReadings.length > 0;
  const hasG = !!(gonio?.re || gonio?.le);
  if (!hasI && !hasG) return "";
  const iopUniq = hasI ? Array.from(new Set(d.iopReadings.map((r) => r.method || ""))) : [];
  const singleMethod = iopUniq.length === 1 ? iopUniq[0] : "";
  const baseLabel = hasI && hasG ? "IOP &amp; Gonioscopy" : hasI ? "Intraocular Pressure" : "Gonioscopy";
  const iopSectionHdr = singleMethod ? `${baseLabel} · ${escapeHtml(singleMethod)}` : baseLabel;
  const gonioHdr = `Gonioscopy${gonio?.method ? ` · ${escapeHtml(gonio.method)}` : ""}`;
  let inner = "";
  if (hasI) {
    inner += `<table style="width:100%;border-collapse:collapse;${hasG ? "margin-bottom:8px;" : ""}">` +
      `<thead><tr>` +
      `<th style="${TH}">${iopSectionHdr}</th>` +
      `<th style="${TH}color:${LABEL_C};">RE (mmHg)</th>` +
      `<th style="${TH}color:${LABEL_C};">LE (mmHg)</th>` +
      `</tr></thead><tbody>` +
      d.iopReadings.map((r, i) =>
        `<tr style="border-bottom:1px solid #ECF3F1;">` +
        `<td style="${TD}color:#555;">${escapeHtml(singleMethod ? (d.iopReadings.length > 1 ? `Reading ${i + 1}` : "Pressure") : (r.method || "—"))}</td>` +
        `<td style="${TD}font-weight:600;">${v2(r.re)}</td>` +
        `<td style="${TD}font-weight:600;">${v2(r.le)}</td>` +
        `</tr>`
      ).join("") +
      `</tbody></table>`;
  }
  if (hasG) {
    const gonioRe = [stripB(gonio!.re), gonio!.reDeg].filter(Boolean).join(" ") || null;
    const gonioLe = [stripB(gonio!.le), gonio!.leDeg].filter(Boolean).join(" ") || null;
    inner += eyeTbl(hasI ? gonioHdr : iopSectionHdr, [["Findings", gonioRe, gonioLe]]);
  }
  const cardLabel = hasI && hasG ? "IOP &amp; Gonioscopy" : hasI ? "Intraocular Pressure" : "Gonioscopy";
  return inner ? card(cardLabel, inner) : "";
})()}

<!-- 12 · TEAR FILM -->
${d.tearFilm && (d.tearFilm.tbutRe != null || d.tearFilm.tbutLe != null || d.tearFilm.schirmer1Re != null || d.tearFilm.schirmer1Le != null || d.tearFilm.schirmer2Re != null || d.tearFilm.schirmer2Le != null)
  ? card("Tear Film", eyeTbl("Tear Film", [
      ["TBUT (sec)", d.tearFilm.tbutRe != null ? String(d.tearFilm.tbutRe) : null, d.tearFilm.tbutLe != null ? String(d.tearFilm.tbutLe) : null],
      ["Schirmer’s 1 (mm)", d.tearFilm.schirmer1Re != null ? String(d.tearFilm.schirmer1Re) : null, d.tearFilm.schirmer1Le != null ? String(d.tearFilm.schirmer1Le) : null],
      ["Schirmer’s 2 (mm)", d.tearFilm.schirmer2Re != null ? String(d.tearFilm.schirmer2Re) : null, d.tearFilm.schirmer2Le != null ? String(d.tearFilm.schirmer2Le) : null],
    ]))
  : ""}

<!-- 13 · LACRIMAL SAC -->
${d.lacrimalSac && (d.lacrimalSac.re || d.lacrimalSac.le)
  ? card("Lacrimal Sac Syringing", eyeTbl("Lacrimal Sac Syringing", [
      ["Findings",
        d.lacrimalSac.re ? ([...(d.lacrimalSac.re.chips ?? []), d.lacrimalSac.re.findings].filter(Boolean).join(" · ")) || null : null,
        d.lacrimalSac.le ? ([...(d.lacrimalSac.le.chips ?? []), d.lacrimalSac.le.findings].filter(Boolean).join(" · ")) || null : null,
      ],
    ]))
  : ""}

<!-- 14 · ANTERIOR SEGMENT -->
${d.anteriorSegment
  ? (() => {
      const re: Record<string, any> = (d.anteriorSegment.re as any) ?? {};
      const le: Record<string, any> = (d.anteriorSegment.le as any) ?? {};
      const antMethod: string = (re._method ?? le._method ?? "") as string;
      const sLabel = antMethod ? `Anterior Segment · ${escapeHtml(antMethod)}` : "Anterior Segment";
      const ANT_FIELDS: [string, string][] = [
        ["upperLid", "Upper Lid"], ["lowerLid", "Lower Lid"], ["conjunctiva", "Conjunctiva"],
        ["sclera", "Sclera"], ["cornea", "Cornea"], ["anteriorChamber", "Ant. Chamber"],
        ["iris", "Iris"], ["pupil", "Pupil"], ["lens", "Lens"],
      ];
      const rows: Array<[string, string | null, string | null]> = [
        ...ANT_FIELDS
          .filter(([k]) => re[k] || le[k])
          .map(([k, label]): [string, string | null, string | null] => [label, stripB(re[k] as string | undefined) || null, stripB(le[k] as string | undefined) || null]),
        ...(re.freeText || le.freeText ? [["Notes", (re.freeText as string | null) || null, (le.freeText as string | null) || null] as [string, string | null, string | null]] : []),
      ];
      const tbl = eyeTbl(sLabel, rows);
      return tbl ? card("Anterior Segment Examination", tbl) : "";
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
  const POS_LABELS: [string, string][] = [
    ["media", "Media"], ["discSize", "Disc Size"], ["discShape", "Disc Shape"],
    ["discColour", "Disc Colour"], ["discVessels", "Disc Vessels"], ["discMargin", "Disc Margin"],
    ["cdr", "CDR"], ["nrr", "NRR"], ["macula", "Macula"],
    ["retinalVessels", "Retinal Vessels"], ["background", "Background"], ["periphery", "Periphery"],
  ];
  const sLabel = posMethod ? `Posterior Segment · ${escapeHtml(posMethod)}` : "Posterior Segment";
  const allKeys = Array.from(new Set([...Object.keys(re), ...Object.keys(le)]));
  const posRows: Array<[string, string | null, string | null]> = [
    ...allKeys
      .filter((k) => !k.startsWith("_") && (re[k] || le[k]))
      .map((k): [string, string | null, string | null] => {
        const found = POS_LABELS.find(([fk]) => fk === k);
        const label = found ? found[1] : k.replace(/([A-Z])/g, " $1").trim();
        return [label, stripB(re[k] as string | undefined) || null, stripB(le[k] as string | undefined) || null];
      }),
    ...(posReNotes || posLeNotes ? [["Notes", posReNotes || null, posLeNotes || null] as [string, string | null, string | null]] : []),
  ];
  if (!posRows.length && !ps.notes) return "";
  let inner = eyeTbl(sLabel, posRows);
  if (ps.notes) inner += `<div style="margin-top:6px;background:${TINT};border-left:3px solid ${BRAND};border-radius:0 4px 4px 0;padding:6px 10px;font-size:9.5px;white-space:pre-wrap;">${escapeHtml(ps.notes)}</div>`;
  return inner ? card("Posterior Segment Examination", inner) : "";
})()}

<!-- 16 · ASSESSMENT / DIAGNOSIS -->
${d.diagnoses.length
  ? card("Assessment / Diagnosis",
      `<div style="font-size:10.5px;font-weight:600;color:${INK};line-height:1.9;">` +
      d.diagnoses.map((dx) =>
        (dx.status && dx.status !== "BLANK" ? `<span style="color:#888;font-weight:400;">${escapeHtml(dx.status.charAt(0) + dx.status.slice(1).toLowerCase())} ·</span> ` : "") +
        (dx.laterality ? `<span style="color:#1a6e6a;font-weight:700;margin-right:4px;">${escapeHtml(dx.laterality)}</span>` : "") +
        escapeHtml(dx.description) +
        (dx.icd10Code ? ` <span style="font-family:'Courier New',monospace;font-size:8px;color:#888;font-weight:400;">${escapeHtml(dx.icd10Code)}</span>` : "")
      ).join("<br>") +
      `</div>`)
  : ""}

<!-- 17 · MINOR PROCEDURE -->
${d.minorProcedure?.procedureName
  ? card("Minor Procedure",
      `<div style="font-size:10.5px;font-weight:600;color:${INK};">` +
      [
        d.minorProcedure.procedureLaterality ? escapeHtml(d.minorProcedure.procedureLaterality) : "",
        escapeHtml(d.minorProcedure.procedureName),
        d.minorProcedure.anesthesiaType ? `Under ${escapeHtml(d.minorProcedure.anesthesiaType)}` : "",
      ].filter(Boolean).join(`<span style="color:#B0BDBA;margin:0 5px;">·</span>`) +
      `</div>` +
      (d.minorProcedure.procedureNotes
        ? `<div style="margin-top:6px;padding:7px 11px;background:#F0F8F6;border:1px solid #C7DED9;border-left:3px solid #2BA89C;border-radius:0 5px 5px 0;font-size:9px;color:#2A4A46;line-height:1.55;white-space:pre-wrap;">${escapeHtml(d.minorProcedure.procedureNotes)}</div>`
        : ""))
  : ""}

<!-- 18 · MEDICATIONS PRESCRIBED -->
${d.medications.length
  ? card("Medications Prescribed",
    `<table style="width:100%;border-collapse:collapse;">
    <thead><tr>
      <th style="${TH}width:24px;text-align:center;">#</th>
      <th style="${TH}">Medicine</th>
      <th style="${TH}width:55px;">Dosage</th>
      <th style="${TH}width:85px;">Frequency</th>
      <th style="${TH}width:115px;">Duration</th>
    </tr></thead>
    <tbody>${medRows}</tbody>
  </table>`)
  : ""}

<!-- 18b · ADVICE NOTES -->
${d.adviseNotes
  ? card("Advice",
      `<div style="font-size:9.5px;color:${INK};line-height:1.6;white-space:pre-wrap;">${escapeHtml(d.adviseNotes)}</div>`)
  : ""}

<!-- 19 · INVESTIGATIONS WITH IN VIEW OF -->
${d.investigations.length
  ? card("Investigations Ordered",
      `<div>` +
      d.investigations.map((inv, i) =>
        `<div style="display:flex;align-items:flex-start;gap:8px;padding:5px 0;${i > 0 ? "border-top:1px solid #ECF3F1;" : ""}">` +
        `<span style="font-size:9px;color:#8A9793;width:20px;text-align:right;flex-shrink:0;font-weight:600;">${i + 1}.</span>` +
        `<div style="font-size:9.5px;font-weight:600;color:#1a1a1a;flex:1;">` +
        (inv.laterality ? `<span style="font-weight:700;color:${BRAND};margin-right:5px;">${escapeHtml(inv.laterality)}</span>` : "") +
        escapeHtml(inv.testName) +
        (inv.notes ? `<span style="font-weight:400;font-style:italic;color:#555;margin-left:5px;">· In view of: ${escapeHtml(inv.notes)}</span>` : "") +
        `</div></div>`
      ).join("") +
      `</div>`)
  : ""}

<!-- 20 · FOLLOW-UP WITH IN VIEW OF -->
${d.visit.followUpDate
  ? card("Follow-up",
      `<div style="font-size:10.5px;font-weight:600;color:${INK};">${format(new Date(d.visit.followUpDate), "EEEE, dd MMM yyyy")}</div>` +
      (d.visit.inViewOf && d.visit.inViewOf.trim()
        ? `<div style="margin-top:4px;font-size:9px;color:#4A5A57;"><span style="font-weight:700;text-transform:uppercase;letter-spacing:0.08em;font-size:8px;color:${LABEL_C};">In View Of:</span> ${escapeHtml(d.visit.inViewOf.trim())}</div>`
        : ""))
  : ""}

<!-- 21 · REFERRAL WITH IN VIEW OF -->
${d.visit.referralEnabled && d.visit.referralNote && d.visit.referralNote.trim()
  ? card("Referral",
      `<div style="font-size:10.5px;font-weight:600;color:${INK};">${escapeHtml(d.visit.referralNote.trim())}</div>` +
      (d.visit.inViewOf && d.visit.inViewOf.trim() && !d.visit.followUpDate
        ? `<div style="margin-top:4px;font-size:9px;color:#4A5A57;"><span style="font-weight:700;text-transform:uppercase;letter-spacing:0.08em;font-size:8px;color:${LABEL_C};">In View Of:</span> ${escapeHtml(d.visit.inViewOf.trim())}</div>`
        : ""))
  : ""}

<!-- DOCTOR SIGNATURE (matches Short Summary sign-off block) -->
<div class="no-break" style="margin-top:0;display:flex;justify-content:flex-end;">
  <div style="width:210px;text-align:center;">
    <div style="font-size:7px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${LABEL_C};margin-top:3px;">
      Doctor&rsquo;s Signature
    </div>
    <div style="font-size:11px;font-weight:700;color:${INK};margin-top:5px;">Dr. ${escapeHtml(d.visit.doctorName)}</div>
    <div style="font-size:8.5px;color:#4A5A57;margin-top:1px;">Consultant Ophthalmologist</div>
    <div style="font-size:7.5px;color:#8A9793;margin-top:1px;">${escapeHtml(d.visit.hospitalName)}</div>
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
          ${va.reNear || va.leNear ? `<tr><td class="td-head">Unaided (Near)</td><td>${val(va.reNear)}</td><td>${val(va.leNear)}</td></tr>` : ""}
          ${va.reNearN || va.leNearN ? `<tr><td class="td-head">BCVA (Near)</td><td>${val(va.reNearN ?? null)}</td><td>${val(va.leNearN ?? null)}</td></tr>` : ""}
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
      return { re: ls.re ? parseEye(ls.re) : null, le: ls.le ? parseEye(ls.le) : null };
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
