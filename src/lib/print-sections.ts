/**
 * Every EMR section the Print pop-up lists, in EMR tab order. `short` / `long`
 * say whether that summary prints the section (shown locked in the pop-up);
 * `id` is the query param the long-print route reads for Custom Print
 * ("0" = leave out). Changing a flag here does NOT change what the summaries
 * print: keep it in step with renderShortSummaryHtml / renderFullEmrHtml.
 */

export type PrintSection = {
  id: string;
  label: string;
  short: boolean;
  long: boolean;
  hasData: (visit: any) => boolean;
};

const obj = (raw: unknown): Record<string, any> => {
  if (!raw) return {};
  if (typeof raw === "object") return raw as Record<string, any>;
  try { const p = JSON.parse(String(raw)); return p && typeof p === "object" ? p : {}; } catch { return {}; }
};
const arr = (raw: unknown): any[] => {
  if (Array.isArray(raw)) return raw;
  try { const p = JSON.parse(String(raw ?? "")); return Array.isArray(p) ? p : []; } catch { return []; }
};
const filled = (v: unknown) => (Array.isArray(v) ? v.length > 0 : v != null && String(v).trim() !== "");
const anyFilled = (o: Record<string, any>, skip: (k: string) => boolean = () => false) =>
  Object.entries(o).some(([k, v]) => !skip(k) && filled(v));

const hasRefraction = (rc: any) => {
  if (!rc) return false;
  const re = obj(rc.re);
  const c1 = re._v === 2
    ? Object.values(obj(re.methods)).some((m: any) => anyFilled(obj(m?.re)) || anyFilled(obj(m?.le)))
    : anyFilled(re, (k) => k === "method") || anyFilled(obj(rc.le), (k) => k === "method");
  return c1 || arr(rc.extraCorrections).length > 0;
};

export const PRINT_SECTIONS: PrintSection[] = [
  // General
  { id: "cc",       label: "Chief Complaint",            short: true,  long: true, hasData: (v) => filled(v.generalExam?.chiefComplaint) },
  { id: "hpi",      label: "History of Present Illness", short: false, long: true, hasData: (v) => filled(v.generalExam?.hpi) },
  { id: "pmh",      label: "Past History",               short: false, long: true, hasData: (v) => arr(v.generalExam?.pastMedicalHistory).length > 0 },
  { id: "curmeds",  label: "Current Medications",        short: false, long: true, hasData: (v) => { const m = v.generalExam?.medications; const a = arr(m); return a.length ? a.some((x: any) => filled(x?.drugName)) : filled(m) && m.trim() !== "[]"; } },
  { id: "systemic", label: "Systemic History",           short: false, long: true, hasData: (v) => filled(v.generalExam?.pmhOtherText) || filled(v.generalExam?.socialHistory) },
  { id: "family",   label: "Family History",             short: false, long: true, hasData: (v) => filled(v.generalExam?.familyHistory) },
  { id: "allergy",  label: "Drug Allergy",               short: true,  long: true, hasData: (v) => filled(v.generalExam?.allergies) || !!v.generalExam?.nkda },
  { id: "vitals",   label: "Vitals",                     short: false, long: true, hasData: (v) => ["bp", "pulse", "temperature", "weight"].some((k) => filled(v.generalExam?.[k])) },
  // Ophthalmic
  { id: "va",       label: "Visual Acuity",              short: false, long: true, hasData: (v) => anyFilled(obj(v.visualAcuity?.re)) || anyFilled(obj(v.visualAcuity?.le)) },
  { id: "rx",       label: "Refraction",                 short: true,  long: true, hasData: (v) => hasRefraction(v.refraction) },
  { id: "cv",       label: "Colour Vision",              short: false, long: true, hasData: (v) => { const re = obj(v.colourVisionCS?.re), le = obj(v.colourVisionCS?.le); return [re.result, re.notes, le.result, le.notes].some(filled); } },
  { id: "cs",       label: "Contrast Sensitivity",       short: false, long: true, hasData: (v) => { const re = obj(v.colourVisionCS?.re), le = obj(v.colourVisionCS?.le); return [re.csResult, re.csNotes, le.csResult, le.csNotes].some(filled); } },
  { id: "iop",      label: "Intra-Ocular Pressure",      short: false, long: true, hasData: (v) => (v.iopReadings?.length ?? 0) > 0 },
  { id: "gonio",    label: "Gonioscopy",                 short: false, long: true, hasData: (v) => { const g = obj(v.gonioNotes); return filled(g.re) || filled(g.le); } },
  { id: "ant",      label: "Anterior Segment",           short: false, long: true, hasData: (v) => anyFilled(obj(v.anteriorSegment?.re), (k) => k === "_method") || anyFilled(obj(v.anteriorSegment?.le), (k) => k === "_method") },
  { id: "pos",      label: "Posterior Segment",          short: false, long: true, hasData: (v) => anyFilled(obj(v.posteriorSegment?.re), (k) => k === "_method") || anyFilled(obj(v.posteriorSegment?.le), (k) => k === "_method") || filled(v.posteriorSegment?.notes) },
  { id: "tear",     label: "Tear Film",                  short: false, long: true, hasData: (v) => ["tbutRe", "tbutLe", "schirmer1Re", "schirmer1Le", "schirmer2Re", "schirmer2Le"].some((k) => v.tearFilm?.[k] != null) },
  { id: "lacrimal", label: "Lacrimal Sac Syringing",     short: false, long: true, hasData: (v) => anyFilled(obj(v.lacrimalSac?.re)) || anyFilled(obj(v.lacrimalSac?.le)) || arr(v.lacrimalSac?.re).length > 0 || arr(v.lacrimalSac?.le).length > 0 },
  { id: "diplopia", label: "Diplopia Charting",          short: false, long: true, hasData: (v) => Object.values(obj(v.diplopiaChart?.grid)).some((c: any) => c?.status && c.status !== "NOT_TESTED") },
  { id: "hess",     label: "Hess Charting",              short: false, long: true, hasData: (v) => filled(v.hessChart?.interpretation) || Object.values(obj(v.hessChart?.grid)).some((c: any) => anyFilled(obj(c))) },
  // Assessment
  { id: "pdx",      label: "Provisional Diagnosis",      short: true,  long: true, hasData: (v) => (v.diagnoses ?? []).some((d: any) => d.provisional) },
  { id: "dx",       label: "Diagnosis (ICD-10)",         short: true,  long: true, hasData: (v) => (v.diagnoses ?? []).some((d: any) => !d.provisional) },
  // Investigations
  { id: "inv",      label: "Investigations",             short: true,  long: true, hasData: (v) => (v.investigationOrders?.length ?? 0) > 0 },
  // Plan
  { id: "meds",     label: "Medications",                short: true,  long: true, hasData: (v) => (v.medications?.length ?? 0) > 0 },
  { id: "advice",   label: "Advice",                     short: true,  long: true, hasData: (v) => filled(v.adviseNotes) },
  { id: "proc",     label: "Minor Procedure",            short: true,  long: true, hasData: (v) => { const p = v.procedureName; const a = arr(p); return a.length ? a.some(filled) : filled(p) && p.trim() !== "[]"; } },
  { id: "followup", label: "Follow-up",                  short: true,  long: true, hasData: (v) => !!v.followUpDate },
  { id: "referral", label: "Referral",                   short: true,  long: true, hasData: (v) => !!v.referralEnabled },
];
