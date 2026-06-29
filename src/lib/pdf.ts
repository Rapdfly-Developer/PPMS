import { format } from "date-fns";

export type DispenseSummaryData = {
  patient: { udid: string; name: string; age: number; sex: string; mobileMasked: string };
  visit: { date: Date; hospitalName: string; doctorName: string };
  vitals: { bp?: string | null; pulse?: string | null; temperature?: string | null; weight?: string | null };
  chiefComplaint?: string | null;
  diagnoses: { description: string; icd10Code: string; status: string; laterality?: string | null }[];
  investigations: { testName: string; priority: string; status: string }[];
  dispenseSummary?: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderDispenseHtml(data: DispenseSummaryData): string {
  const diagnosesRows = data.diagnoses.length
    ? data.diagnoses
        .map(
          (d) =>
            `<tr><td>${escapeHtml(d.description)}</td><td class="mono">${escapeHtml(d.icd10Code)}</td><td>${d.laterality ?? "—"}</td><td>${d.status}</td></tr>`
        )
        .join("")
    : `<tr><td colspan="4" class="empty">No diagnoses recorded</td></tr>`;

  const investigationRows = data.investigations.length
    ? data.investigations
        .map((i) => `<tr><td>${escapeHtml(i.testName)}</td><td>${i.priority}</td><td>${i.status.replace(/_/g, " ")}</td></tr>`)
        .join("")
    : `<tr><td colspan="3" class="empty">No investigations ordered</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #14242B; margin: 0; padding: 36px 44px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #115E59; padding-bottom: 16px; margin-bottom: 24px; }
  .brand { font-size: 22px; font-weight: 700; color: #0B3D3A; }
  .brand-sub { font-size: 11px; color: #5C6E76; margin-top: 2px; }
  .meta { text-align: right; font-size: 12px; color: #5C6E76; }
  .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #115E59; margin: 22px 0 8px; }
  .patient-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; background: #F0F8F6; border-radius: 10px; padding: 14px 18px; }
  .field-label { font-size: 10px; color: #8A9AA1; text-transform: uppercase; }
  .field-value { font-size: 14px; font-weight: 600; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; color: #8A9AA1; border-bottom: 1px solid #E2E6E8; padding: 6px 4px; }
  td { padding: 8px 4px; border-bottom: 1px solid #E2E6E8; }
  .mono { font-family: monospace; }
  .empty { color: #8A9AA1; text-align: center; padding: 14px; }
  .summary-box { background: #ECEFF1; border-radius: 10px; padding: 14px 18px; font-size: 13px; line-height: 1.6; white-space: pre-wrap; }
  .footer { margin-top: 36px; font-size: 10px; color: #8A9AA1; text-align: center; border-top: 1px solid #E2E6E8; padding-top: 12px; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">PPMS</div>
      <div class="brand-sub">Personal Patient Management System — Visit Summary</div>
    </div>
    <div class="meta">
      ${format(data.visit.date, "dd MMM yyyy")}<br/>
      ${escapeHtml(data.visit.hospitalName)}<br/>
      ${escapeHtml(data.visit.doctorName)}
    </div>
  </div>

  <div class="patient-grid">
    <div><div class="field-label">Patient</div><div class="field-value">${escapeHtml(data.patient.name)}</div></div>
    <div><div class="field-label">UDID</div><div class="field-value mono">${escapeHtml(data.patient.udid)}</div></div>
    <div><div class="field-label">Age / Sex</div><div class="field-value">${data.patient.age} / ${data.patient.sex}</div></div>
    <div><div class="field-label">Mobile</div><div class="field-value">${escapeHtml(data.patient.mobileMasked)}</div></div>
    <div><div class="field-label">BP</div><div class="field-value">${escapeHtml(data.vitals.bp ?? "—")}</div></div>
    <div><div class="field-label">Pulse</div><div class="field-value">${escapeHtml(data.vitals.pulse ?? "—")}</div></div>
  </div>

  <div class="section-title">Chief Complaint</div>
  <p style="font-size:13px; margin:0;">${escapeHtml(data.chiefComplaint ?? "—")}</p>

  <div class="section-title">Diagnosis</div>
  <table>
    <thead><tr><th>Description</th><th>ICD-10</th><th>Laterality</th><th>Status</th></tr></thead>
    <tbody>${diagnosesRows}</tbody>
  </table>

  <div class="section-title">Investigations</div>
  <table>
    <thead><tr><th>Test</th><th>Priority</th><th>Status</th></tr></thead>
    <tbody>${investigationRows}</tbody>
  </table>

  <div class="section-title">Dispense Summary & Plan</div>
  <div class="summary-box">${escapeHtml(data.dispenseSummary ?? "No dispense summary recorded yet.")}</div>

  <div class="footer">Generated by PPMS on ${format(new Date(), "dd MMM yyyy, h:mm a")} — for clinical reference only.</div>
</body>
</html>`;
}

export type PrescriptionData = {
  patient: { udid: string; name: string; age: number; sex: string };
  visit: { date: Date; hospitalName: string; doctorName: string };
  medications: { drugName: string; dosage?: string | null; frequency?: string | null; duration?: string | null; instructions?: string | null }[];
  opticalRx: {
    re: { sph?: string; cyl?: string; axis?: string; nearSph?: string; nearCyl?: string; nearAxis?: string };
    le: { sph?: string; cyl?: string; axis?: string; nearSph?: string; nearCyl?: string; nearAxis?: string };
  };
};

function renderPrescriptionHtml(data: PrescriptionData): string {
  const medRows = data.medications.length
    ? data.medications
        .map(
          (m) =>
            `<tr><td>${escapeHtml(m.drugName)}</td><td>${escapeHtml(m.dosage ?? "—")}</td><td>${escapeHtml(m.frequency ?? "—")}</td><td>${escapeHtml(m.duration ?? "—")}</td></tr>`
        )
        .join("")
    : `<tr><td colspan="4" class="empty">No medications prescribed</td></tr>`;

  const rxRow = (label: string, v: PrescriptionData["opticalRx"]["re"]) =>
    `<tr><td>${label}</td><td>${escapeHtml(v.sph || "—")}</td><td>${escapeHtml(v.cyl || "—")}</td><td>${escapeHtml(v.axis || "—")}</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #14242B; margin: 0; padding: 36px 44px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #115E59; padding-bottom: 16px; margin-bottom: 24px; }
  .brand { font-size: 22px; font-weight: 700; color: #0B3D3A; }
  .brand-sub { font-size: 11px; color: #5C6E76; margin-top: 2px; }
  .meta { text-align: right; font-size: 12px; color: #5C6E76; }
  .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #115E59; margin: 22px 0 8px; }
  .patient-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; background: #F0F8F6; border-radius: 10px; padding: 14px 18px; }
  .field-label { font-size: 10px; color: #8A9AA1; text-transform: uppercase; }
  .field-value { font-size: 14px; font-weight: 600; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; color: #8A9AA1; border-bottom: 1px solid #E2E6E8; padding: 6px 4px; }
  td { padding: 8px 4px; border-bottom: 1px solid #E2E6E8; }
  .empty { color: #8A9AA1; text-align: center; padding: 14px; }
  .footer { margin-top: 36px; font-size: 10px; color: #8A9AA1; text-align: center; border-top: 1px solid #E2E6E8; padding-top: 12px; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">PPMS</div>
      <div class="brand-sub">Personal Patient Management System — Prescription</div>
    </div>
    <div class="meta">
      ${format(data.visit.date, "dd MMM yyyy")}<br/>
      ${escapeHtml(data.visit.hospitalName)}<br/>
      ${escapeHtml(data.visit.doctorName)}
    </div>
  </div>

  <div class="patient-grid">
    <div><div class="field-label">Patient</div><div class="field-value">${escapeHtml(data.patient.name)}</div></div>
    <div><div class="field-label">UDID</div><div class="field-value mono">${escapeHtml(data.patient.udid)}</div></div>
    <div><div class="field-label">Age / Sex</div><div class="field-value">${data.patient.age} / ${data.patient.sex}</div></div>
  </div>

  <div class="section-title">Medications</div>
  <table>
    <thead><tr><th>Drug</th><th>Dosage</th><th>Frequency</th><th>Duration</th></tr></thead>
    <tbody>${medRows}</tbody>
  </table>

  <div class="section-title">Optical Prescription</div>
  <table>
    <thead><tr><th></th><th>Sphere</th><th>Cylinder</th><th>Axis</th></tr></thead>
    <tbody>
      ${rxRow("RE Distance", data.opticalRx.re)}
      ${rxRow("LE Distance", data.opticalRx.le)}
      ${rxRow("RE Near", { sph: data.opticalRx.re.nearSph, cyl: data.opticalRx.re.nearCyl, axis: data.opticalRx.re.nearAxis })}
      ${rxRow("LE Near", { sph: data.opticalRx.le.nearSph, cyl: data.opticalRx.le.nearCyl, axis: data.opticalRx.le.nearAxis })}
    </tbody>
  </table>

  <div class="footer">Generated by PPMS on ${format(new Date(), "dd MMM yyyy, h:mm a")} — for clinical reference only.</div>
</body>
</html>`;
}

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

async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "10mm", bottom: "10mm" } });
    return Buffer.from(pdf);
  } finally {
    await page.close();
    await browser.close();
  }
}

export async function generateDispensePdf(data: DispenseSummaryData): Promise<Buffer> {
  return htmlToPdf(renderDispenseHtml(data));
}

export async function generatePrescriptionPdf(data: PrescriptionData): Promise<Buffer> {
  return htmlToPdf(renderPrescriptionHtml(data));
}

// ── Full EMR PDF ──────────────────────────────────────────────────────────────

export type FullEmrData = {
  patient: { udid: string; name: string; age: number; sex: string; mobile?: string | null; address?: string | null };
  visit: { date: Date; visitType?: string | null; hospitalName: string; doctorName: string };
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

function val(v: string | null | undefined, fallback = "—") {
  return escapeHtml(v ?? fallback);
}

function sectionTitle(title: string) {
  return `<div class="section-title">${title}</div>`;
}

function renderFullEmrHtml(d: FullEmrData): string {
  const ge = d.generalExam;
  const va = d.visualAcuity;

  /* ── Vitals ── */
  const vitalsHtml = ge
    ? `<div class="info-grid">
        <div><div class="lbl">BP</div><div class="val">${val(ge.bp)}</div></div>
        <div><div class="lbl">Pulse</div><div class="val">${val(ge.pulse)}</div></div>
        <div><div class="lbl">Temp</div><div class="val">${val(ge.temperature)}</div></div>
        <div><div class="lbl">Weight</div><div class="val">${val(ge.weight)}</div></div>
      </div>`
    : `<p class="empty">Not recorded</p>`;

  /* ── PMH ── */
  const pmhList = (ge?.pastMedicalHistory ?? []).filter(Boolean);
  const pmhHtml = ge
    ? `<p style="font-size:12px;margin:4px 0 0;">${
        pmhList.length ? pmhList.map(escapeHtml).join(", ") + (ge.pmhOtherText ? `, ${escapeHtml(ge.pmhOtherText)}` : "") : "Nil"
      }</p>
      ${ge.medications ? `<p style="font-size:11px;color:#5C6E76;margin:4px 0 0;"><strong>Current meds:</strong> ${escapeHtml(ge.medications)}</p>` : ""}
      ${ge.nkda ? `<p style="font-size:11px;color:#059669;margin:4px 0 0;font-weight:600;">✓ NKDA (No Known Drug Allergies)</p>` : ge.allergies ? `<p style="font-size:11px;color:#DC2626;margin:4px 0 0;"><strong>Allergies:</strong> ${escapeHtml(ge.allergies)}</p>` : ""}`
    : `<p class="empty">Not recorded</p>`;

  /* ── VA ── */
  const vaRow = (label: string, unaided?: string, ph?: string, bcva?: string) =>
    `<tr><td class="row-head">${label}</td><td>${val(unaided)}</td><td>${val(ph)}</td><td>${val(bcva)}</td></tr>`;

  const vaHtml = va
    ? `<table>
        <thead><tr><th></th><th>Unaided</th><th>PH</th><th>BCVA</th></tr></thead>
        <tbody>
          ${vaRow("RE Distance", va.reDistance?.unaided, va.reDistance?.ph, va.reDistance?.bcva)}
          ${vaRow("LE Distance", va.leDistance?.unaided, va.leDistance?.ph, va.leDistance?.bcva)}
          <tr><td class="row-head">RE Near</td><td colspan="2">${val(va.reNear)}</td><td>${val(va.reNearN)}</td></tr>
          <tr><td class="row-head">LE Near</td><td colspan="2">${val(va.leNear)}</td><td>${val(va.leNearN)}</td></tr>
        </tbody>
      </table>`
    : `<p class="empty">Not recorded</p>`;

  /* ── IOP ── */
  const iopHtml = d.iopReadings.length
    ? `<table>
        <thead><tr><th>Method</th><th>RE</th><th>LE</th><th>Time</th></tr></thead>
        <tbody>${d.iopReadings.map(r => `<tr><td>${val(r.method)}</td><td>${val(r.re)}</td><td>${val(r.le)}</td><td>${format(new Date(r.takenAt), "hh:mm a")}</td></tr>`).join("")}</tbody>
      </table>`
    : `<p class="empty">Not recorded</p>`;

  /* ── Colour Vision ── */
  const cvHtml = d.colourVision
    ? `<div class="info-grid">
        <div><div class="lbl">Right Eye</div><div class="val">${val(d.colourVision.re)}</div></div>
        <div><div class="lbl">Left Eye</div><div class="val">${val(d.colourVision.le)}</div></div>
      </div>${d.colourVision.notes ? `<p style="font-size:11px;color:#5C6E76;margin:6px 0 0;">${escapeHtml(d.colourVision.notes)}</p>` : ""}`
    : `<p class="empty">Not recorded</p>`;

  /* ── Segment helper ── */
  const renderSegment = (data: Record<string, string[]> | null | undefined) => {
    if (!data || Object.keys(data).length === 0) return `<p class="empty">Not recorded</p>`;
    return `<table>
      <thead><tr><th>Structure</th><th>Right Eye (RE)</th><th>Left Eye (LE)</th></tr></thead>
      <tbody>${Object.entries(data).map(([k, v]: [string, any]) => {
        const label = k.replace(/([A-Z])/g, " $1").trim();
        const re = Array.isArray(v?.re) ? v.re.join(", ") : (v?.re ?? "—");
        const le = Array.isArray(v?.le) ? v.le.join(", ") : (v?.le ?? "—");
        return `<tr><td class="row-head">${escapeHtml(label)}</td><td>${escapeHtml(re || "—")}</td><td>${escapeHtml(le || "—")}</td></tr>`;
      }).join("")}</tbody>
    </table>`;
  };

  /* ── Anterior Segment ── */
  const asHtml = renderSegment(d.anteriorSegment as any);

  /* ── Posterior Segment ── */
  const ps = d.posteriorSegment as any;
  const psHtml = ps
    ? `${renderSegment(ps.data)}
       ${ps.cdr ? `<p style="font-size:12px;margin:6px 0 0;"><strong>CDR:</strong> ${escapeHtml(ps.cdr)}</p>` : ""}
       ${ps.notes ? `<p style="font-size:11px;color:#5C6E76;margin:4px 0 0;">${escapeHtml(ps.notes)}</p>` : ""}`
    : `<p class="empty">Not recorded</p>`;

  /* ── Diagnoses ── */
  const diagHtml = d.diagnoses.length
    ? `<table>
        <thead><tr><th>#</th><th>Diagnosis</th><th>ICD-10</th><th>Laterality</th><th>Status</th></tr></thead>
        <tbody>${d.diagnoses.map((dx, i) => `<tr>
          <td>${i + 1}</td>
          <td>${val(dx.description)}</td>
          <td class="mono">${val(dx.icd10Code)}</td>
          <td>${val(dx.laterality)}</td>
          <td>${escapeHtml(dx.status)}</td>
        </tr>`).join("")}</tbody>
      </table>`
    : `<p class="empty">No diagnoses recorded</p>`;

  /* ── Medications ── */
  const medHtml = d.medications.length
    ? `<table>
        <thead><tr><th>#</th><th>Drug</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Instructions</th></tr></thead>
        <tbody>${d.medications.map((m, i) => `<tr>
          <td>${i + 1}</td>
          <td>${val(m.drugName)}</td>
          <td>${val(m.dosage)}</td>
          <td>${val(m.frequency)}</td>
          <td>${val(m.duration)}</td>
          <td>${val(m.instructions)}</td>
        </tr>`).join("")}</tbody>
      </table>`
    : `<p class="empty">No medications prescribed</p>`;

  /* ── Optical Rx ── */
  const rxRow = (label: string, sph?: string, cyl?: string, axis?: string) =>
    `<tr><td class="row-head">${label}</td><td>${val(sph)}</td><td>${val(cyl)}</td><td>${val(axis)}</td></tr>`;

  const opticalHtml = `<table>
    <thead><tr><th></th><th>SPH</th><th>CYL</th><th>AXIS</th></tr></thead>
    <tbody>
      ${rxRow("RE Distance", d.opticalRx.re.sph, d.opticalRx.re.cyl, d.opticalRx.re.axis)}
      ${rxRow("LE Distance", d.opticalRx.le.sph, d.opticalRx.le.cyl, d.opticalRx.le.axis)}
      ${rxRow("RE Near Add", d.opticalRx.re.nearSph, d.opticalRx.re.nearCyl, d.opticalRx.re.nearAxis)}
      ${rxRow("LE Near Add", d.opticalRx.le.nearSph, d.opticalRx.le.nearCyl, d.opticalRx.le.nearAxis)}
    </tbody>
  </table>`;

  /* ── Investigations ── */
  const invHtml = d.investigations.length
    ? `<table>
        <thead><tr><th>Test</th><th>Priority</th><th>Status</th><th>Result / Notes</th></tr></thead>
        <tbody>${d.investigations.map(inv => `<tr>
          <td>${val(inv.testName)}</td>
          <td>${escapeHtml(inv.priority)}</td>
          <td>${escapeHtml(inv.status.replace(/_/g, " "))}</td>
          <td>${val(inv.result ?? inv.notes)}</td>
        </tr>`).join("")}</tbody>
      </table>`
    : `<p class="empty">No investigations ordered</p>`;

  /* ── Disposition ── */
  const dispHtml = [
    d.admission ? `<p style="font-size:12px;margin:4px 0;"><strong>Admitted:</strong> Ward ${val(d.admission.wardName)} · Bed ${val(d.admission.bedNumber)}${d.admission.reason ? ` · ${escapeHtml(d.admission.reason)}` : ""}</p>` : "",
    d.surgicalCounselling?.surgeryType ? `<p style="font-size:12px;margin:4px 0;"><strong>Surgery:</strong> ${val(d.surgicalCounselling.surgeryType)}${d.surgicalCounselling.surgeryDate ? ` on ${format(new Date(d.surgicalCounselling.surgeryDate), "dd MMM yyyy")}` : ""}${d.surgicalCounselling.notes ? ` — ${escapeHtml(d.surgicalCounselling.notes)}` : ""}</p>` : "",
  ].filter(Boolean).join("") || `<p class="empty">No disposition recorded</p>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>EMR – ${escapeHtml(d.patient.name)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A4; margin: 14mm 14mm 14mm 14mm; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #14242B; font-size: 12px; line-height: 1.5; }
  .page { width: 100%; }

  /* Header */
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0B3D3A; padding-bottom: 14px; margin-bottom: 18px; }
  .brand { font-size: 20px; font-weight: 800; color: #0B3D3A; letter-spacing: -0.5px; }
  .brand-sub { font-size: 10px; color: #5C6E76; margin-top: 2px; letter-spacing: 0.04em; text-transform: uppercase; }
  .meta { text-align: right; font-size: 11px; color: #5C6E76; line-height: 1.7; }
  .meta strong { color: #14242B; }

  /* Patient banner */
  .patient-banner { background: #F0F8F6; border: 1px solid #C8E6E4; border-radius: 10px; padding: 12px 16px; margin-bottom: 18px; }
  .patient-name { font-size: 17px; font-weight: 700; color: #0B3D3A; }
  .patient-meta { font-size: 11px; color: #5C6E76; margin-top: 3px; }
  .patient-meta span { margin-right: 14px; }
  .udid { font-family: monospace; background: #E0F0ED; padding: 1px 6px; border-radius: 4px; color: #115E59; font-size: 10px; }

  /* Section title */
  .section-title {
    font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
    color: #fff; background: #115E59; padding: 4px 10px; border-radius: 4px;
    margin: 18px 0 8px; display: inline-block;
  }

  /* Info grid */
  .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .lbl { font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: #8A9AA1; }
  .val { font-size: 13px; font-weight: 600; margin-top: 1px; }

  /* Tables */
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 4px; }
  th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: #8A9AA1; border-bottom: 2px solid #E2E6E8; padding: 5px 6px; }
  td { padding: 6px 6px; border-bottom: 1px solid #EEF0F2; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  td.row-head { font-weight: 600; color: #0B3D3A; white-space: nowrap; width: 110px; }
  td.mono { font-family: monospace; }
  .empty { color: #9AA9B2; font-style: italic; margin: 6px 0; }

  /* Two-column layout for medications + optical rx */
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }

  /* Signature */
  .sig-box { margin-top: 32px; border-top: 1px solid #E2E6E8; padding-top: 16px; display: flex; justify-content: flex-end; }
  .sig-line { text-align: center; }
  .sig-line .line { width: 200px; border-top: 1px solid #14242B; margin: 0 auto 6px; }
  .sig-line p { font-size: 11px; color: #5C6E76; }
  .sig-line strong { font-size: 12px; color: #0B3D3A; display: block; }

  /* Footer */
  .footer { margin-top: 20px; font-size: 9px; color: #9AA9B2; text-align: center; border-top: 1px solid #EEF0F2; padding-top: 8px; }

  /* Print */
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div>
      <div class="brand">${escapeHtml(d.visit.hospitalName)}</div>
      <div class="brand-sub">Electronic Medical Record · Visit Summary</div>
    </div>
    <div class="meta">
      <strong>${format(d.visit.date, "dd MMM yyyy")}</strong><br/>
      Visit type: ${val(d.visit.visitType, "General")}<br/>
      Physician: Dr. ${escapeHtml(d.visit.doctorName)}
    </div>
  </div>

  <!-- Patient Banner -->
  <div class="patient-banner">
    <div class="patient-name">${escapeHtml(d.patient.name)}</div>
    <div class="patient-meta">
      <span class="udid">${escapeHtml(d.patient.udid)}</span>
      <span>${d.patient.age} yrs · ${escapeHtml(d.patient.sex)}</span>
      ${d.patient.mobile ? `<span>📞 ${escapeHtml(d.patient.mobile)}</span>` : ""}
      ${d.patient.address ? `<span>📍 ${escapeHtml(d.patient.address)}</span>` : ""}
    </div>
  </div>

  <!-- Chief Complaint & HPI -->
  ${sectionTitle("Chief Complaint & History")}
  ${ge?.chiefComplaint ? `<p style="font-size:13px;font-weight:600;margin-bottom:4px;">${escapeHtml(ge.chiefComplaint)}</p>` : ""}
  ${ge?.hpi ? `<p style="font-size:12px;color:#3D5560;line-height:1.6;">${escapeHtml(ge.hpi)}</p>` : !ge?.chiefComplaint ? `<p class="empty">Not recorded</p>` : ""}

  <!-- Vitals -->
  ${sectionTitle("Vitals")}
  ${vitalsHtml}

  <!-- PMH -->
  ${sectionTitle("Past Medical History & Allergies")}
  ${pmhHtml}

  <!-- Visual Acuity -->
  ${sectionTitle("Visual Acuity")}
  ${vaHtml}

  <!-- IOP -->
  ${sectionTitle("Intraocular Pressure (IOP)")}
  ${iopHtml}

  <!-- Colour Vision -->
  ${sectionTitle("Colour Vision")}
  ${cvHtml}

  <!-- Anterior Segment -->
  ${sectionTitle("Anterior Segment")}
  ${asHtml}

  <!-- Posterior Segment -->
  ${sectionTitle("Posterior Segment")}
  ${psHtml}

  <!-- Assessment / Diagnosis -->
  ${sectionTitle("Assessment / Diagnosis")}
  ${diagHtml}

  <!-- Plan: Medications -->
  ${sectionTitle("Medications")}
  ${medHtml}

  <!-- Plan: Optical Rx -->
  ${sectionTitle("Optical Prescription")}
  ${opticalHtml}

  <!-- Investigations -->
  ${sectionTitle("Investigations")}
  ${invHtml}

  <!-- Disposition -->
  ${sectionTitle("Disposition")}
  ${dispHtml}

  <!-- Signature -->
  <div class="sig-box">
    <div class="sig-line">
      <div class="line"></div>
      <strong>Dr. ${escapeHtml(d.visit.doctorName)}</strong>
      <p>Ophthalmologist</p>
      <p>${escapeHtml(d.visit.hospitalName)}</p>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    Generated by PPMS on ${format(new Date(), "dd MMM yyyy, h:mm a")} · ${escapeHtml(d.patient.udid)} · For clinical reference only. Not valid without doctor's signature.
  </div>

</div>
</body>
</html>`;
}

export async function generateFullEmrPdf(data: FullEmrData): Promise<Buffer> {
  return htmlToPdf(renderFullEmrHtml(data));
}
