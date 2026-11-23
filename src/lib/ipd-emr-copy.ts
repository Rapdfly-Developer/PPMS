// The IPD file's own editable copy of the EMR visit (General, Ophthalmic, Plan).
// It is a visit-shaped JSON built once from the real visit, then edited here
// through the same tab screens as the EMR. The real EMR is never written.
// Stored on each signed doctor's note (IpdDoctorNote.data).

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface IpdValues { postOpMeds: string; surgeryName: string; surgeryDate: string; surgeon?: string; dischargeNote: string }

export interface EmrCopy {
  v: 2;
  /** Visit-shaped data (dates as ISO strings). */
  visit: Record<string, any>;
  /** The values that replace parts of the EMR in the notes. */
  ipd: IpdValues;
}

/** Visit sub-records the tabs read as objects ("merge" ops). */
export const MERGE_KEYS = [
  "generalExam", "visualAcuity", "refraction", "colourVisionCS", "anteriorSegment", "posteriorSegment",
  "diplopiaChart", "hessChart", "retinoscopy", "tearFilm", "lacrimalSac",
] as const;
export type MergeKey = (typeof MERGE_KEYS)[number];

/** Visit scalar fields the tabs write. */
export const SCALAR_KEYS = [
  "followUpDate", "referralEnabled", "referralNote", "inViewOf", "referralType", "referralInViewOf",
  "adviseNotes", "anesthesiaType", "procedureLaterality", "procedureName", "procedureNotes", "gonioNotes", "oculoplasty",
] as const;

export type CopyOp =
  | { t: "merge"; key: MergeKey; data: Record<string, any> }
  | { t: "scalar"; data: Record<string, any> }
  | { t: "iopAdd"; row: Record<string, any> }
  | { t: "iopRemove"; id: string }
  | { t: "ipd"; data: Partial<IpdValues> };

/** Apply one edit; used on the server (stored copy) and in the tab (what is shown), so both agree. */
export function applyCopyOp(copy: EmrCopy, op: CopyOp): EmrCopy {
  const visit = { ...copy.visit };
  switch (op.t) {
    case "merge":
      if (!(MERGE_KEYS as readonly string[]).includes(op.key)) return copy;
      visit[op.key] = { ...(visit[op.key] ?? {}), ...op.data };
      return { ...copy, visit };
    case "scalar":
      for (const k of SCALAR_KEYS) if (k in op.data) visit[k] = op.data[k] ?? null;
      return { ...copy, visit };
    case "iopAdd":
      visit.iopReadings = [op.row, ...(Array.isArray(visit.iopReadings) ? visit.iopReadings : [])];
      return { ...copy, visit };
    case "iopRemove":
      visit.iopReadings = (Array.isArray(visit.iopReadings) ? visit.iopReadings : []).filter((r: any) => r.id !== op.id);
      return { ...copy, visit };
    case "ipd":
      return { ...copy, ipd: { ...copy.ipd, ...op.data } };
  }
}

/** The copy of a real visit (only the parts the three tabs use). */
export function buildEmrCopy(visit: any, extra: { postOpMeds: string[]; surgeryName: string; surgeryDate: string; surgeon?: string }): EmrCopy {
  const keep: Record<string, any> = {};
  const raw = JSON.parse(JSON.stringify(visit ?? {}));
  for (const k of [...MERGE_KEYS, ...SCALAR_KEYS, "id", "date", "iopReadings", "doctorId", "status", "visitType"]) if (k in raw) keep[k] = raw[k];
  keep.iopReadings = Array.isArray(raw.iopReadings) ? raw.iopReadings : [];
  return {
    v: 2,
    visit: keep,
    ipd: { postOpMeds: extra.postOpMeds.join("\n"), surgeryName: extra.surgeryName, surgeryDate: extra.surgeryDate, surgeon: extra.surgeon ?? "", dischargeNote: "" },
  };
}

export const isEmrCopy = (x: unknown): x is EmrCopy =>
  !!x && typeof x === "object" && (x as { v?: number }).v === 2 && typeof (x as EmrCopy).visit === "object" && !!(x as EmrCopy).ipd;

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
/** Turn ISO date strings back into Dates (the tabs expect the visit as the EMR page gives it). */
export function reviveDates<T>(v: T): T {
  if (typeof v === "string") return (ISO.test(v) ? new Date(v) : v) as unknown as T;
  if (Array.isArray(v)) return v.map(reviveDates) as unknown as T;
  if (v && typeof v === "object" && !(v instanceof Date)) {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, reviveDates(x)])) as T;
  }
  return v;
}

/* ── Signed doctor's notes: each note keeps its own copy ─────────────────── */

export interface NoteMedSnapshot { id?: string; name: string; dose: string; route: string; eye: string; frequency: string; instructions: string }

/** The medicines of the Treatment Chart as they stood when the note was signed. */
export function withMeds(copy: EmrCopy, meds: NoteMedSnapshot[]): EmrCopy & { meds: NoteMedSnapshot[] } {
  return { ...copy, meds };
}
export const medsOf = (copy: EmrCopy): NoteMedSnapshot[] => (Array.isArray((copy as { meds?: unknown }).meds) ? (copy as unknown as { meds: NoteMedSnapshot[] }).meds : []);

export type PostOpMed = { route: string; eye: string; name: string; dose: string; frequency: string; duration: string; instructions: string };

/** Post-op medications are stored as JSON; older copies hold one medicine per line. */
export function parsePostOp(raw: string): PostOpMed[] {
  const blank = { route: "", eye: "", dose: "", frequency: "", duration: "", instructions: "" };
  try {
    const a = JSON.parse(raw);
    if (Array.isArray(a)) return a.filter((m) => m && typeof m.name === "string").map((m) => ({ ...blank, ...m }));
  } catch { /* plain text */ }
  return (raw ?? "").split("\n").map((l) => l.trim()).filter(Boolean).map((name) => ({ ...blank, name }));
}

const j = (x: unknown): any => { if (typeof x !== "string") return x ?? null; try { return JSON.parse(x); } catch { return null; } };
const flat = (x: unknown): string => {
  const v = j(x);
  if (v == null) return "";
  if (typeof v !== "object") return String(v);
  const out: string[] = [];
  const walk = (o: any, k = "") => {
    if (o == null || o === "") return;
    if (Array.isArray(o)) { const t = o.filter((y) => y != null && typeof y !== "object" && y !== "").join(", "); if (t) out.push(k ? `${k} ${t}` : t); return; }
    if (typeof o === "object") { for (const [kk, y] of Object.entries(o)) { if (kk.startsWith("_")) continue; walk(y, kk); } return; }
    out.push(k ? `${k} ${o}` : String(o));
  };
  walk(v);
  return out.slice(0, 8).join(", ");
};
const eyes = (re: string, le: string) => [re && `RE ${re}`, le && `LE ${le}`].filter(Boolean).join(", ");
const dayOf = (s: string) => { const d = new Date(s.length === 10 ? `${s}T00:00:00` : s); return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); };
const medLine = (m: { name: string; dose?: string; eye?: string; frequency?: string }) => [m.name, m.dose, m.eye, m.frequency].filter(Boolean).join(" ");

/** The plain-text form of a note ("Label: value" lines), kept in the note's text column. */
export function noteText(copy: EmrCopy, change?: { added: string[]; stopped: string[] }): string {
  const v = copy.visit;
  const ge = v.generalExam ?? {};
  const va = eyes(flat(v.visualAcuity?.re), flat(v.visualAcuity?.le));
  const iop = Array.isArray(v.iopReadings) ? v.iopReadings[0] : null;
  const iopT = iop ? eyes(iop.re != null ? String(iop.re) : "", iop.le != null ? String(iop.le) : "") : "";
  const ant = eyes(flat(v.anteriorSegment?.re), flat(v.anteriorSegment?.le));
  const post = eyes(flat(v.posteriorSegment?.re), flat(v.posteriorSegment?.le));
  const findings = [ant && `Anterior: ${ant}`, post && `Posterior: ${post}`].filter(Boolean).join(". ");
  const dispo = [v.followUpDate ? `Follow up review ${dayOf(String(v.followUpDate).slice(0, 10))}` : "", copy.ipd.dischargeNote ? `Discharge: ${copy.ipd.dischargeNote}` : ""].filter(Boolean).join("; ");
  const surgery = [copy.ipd.surgeryName, copy.ipd.surgeryDate && dayOf(copy.ipd.surgeryDate)].filter(Boolean).join(" on ");
  return [
    ge.chiefComplaint && `Complaints: ${ge.chiefComplaint}`,
    va && `Vision: ${va}`,
    iopT && `IOP: ${iopT}`,
    findings && `Findings: ${findings}`,
    surgery && `Surgery: ${surgery}`,
    [v.adviseNotes, dispo].filter(Boolean).length ? `Plan / Orders: ${[v.adviseNotes, dispo].filter(Boolean).join(". ")}` : "",
    change?.added.length ? `Medications added: ${change.added.join("; ")}` : "",
    change?.stopped.length ? `Medications stopped: ${change.stopped.join("; ")}` : "",
  ].filter(Boolean).join("\n") || "Note signed";
}

/** The note as the visit-shaped data the Patient profile's Short / Long summaries render. */
export function noteEmrData(copy: EmrCopy): Record<string, any> {
  const v = copy.visit;
  const surgery = [copy.ipd.surgeryName, copy.ipd.surgeryDate && `(${dayOf(copy.ipd.surgeryDate)})`].filter(Boolean).join(" ");
  return {
    ...v,
    generalExam: {
      ...(v.generalExam ?? {}),
      hpi: [hpiSentence(copy.ipd), (v.generalExam?.hpi ?? "").trim()].filter(Boolean).join(" "), hpiFields: null,
      medications: JSON.stringify(medsOf(copy).map((m) => ({ drugName: m.name, dosage: m.dose, frequency: m.frequency, duration: "", laterality: m.eye }))),
      pastMedicalHistory: JSON.stringify(surgery ? [{ name: `Surgery: ${surgery}` }] : []),
    },
    diagnoses: [], investigationOrders: [], counsellingRecord: null,
    adviseNotes: [v.adviseNotes, copy.ipd.dischargeNote && `Discharge: ${copy.ipd.dischargeNote}`].filter(Boolean).join("\n") || null,
    medications: medsOf(copy).map((m, i) => ({ id: m.id ?? `m${i}`, drugName: m.name, dosage: m.dose, frequency: m.frequency, duration: "", instructions: m.instructions, route: m.route, laterality: m.eye })),
  };
}

/** A short prose summary of the note (the AI tab, built locally from the note's own data). */
export function noteSummaryProse(copy: EmrCopy): string {
  const v = copy.visit;
  const ge = v.generalExam ?? {};
  const bits: string[] = [];
  if (ge.chiefComplaint) bits.push(`Chief complaint: ${ge.chiefComplaint}.`);
  const surgery = [copy.ipd.surgeryName, copy.ipd.surgeryDate && `on ${dayOf(copy.ipd.surgeryDate)}`].filter(Boolean).join(" ");
  if (surgery) bits.push(`Surgery: ${surgery}.`);
  const va = eyes(flat(v.visualAcuity?.re), flat(v.visualAcuity?.le));
  if (va) bits.push(`Vision ${va}.`);
  const iop = Array.isArray(v.iopReadings) ? v.iopReadings[0] : null;
  if (iop && (iop.re != null || iop.le != null)) bits.push(`IOP ${eyes(iop.re != null ? String(iop.re) : "", iop.le != null ? String(iop.le) : "")} mmHg.`);
  const ant = eyes(flat(v.anteriorSegment?.re), flat(v.anteriorSegment?.le));
  if (ant) bits.push(`Anterior segment: ${ant}.`);
  const post = eyes(flat(v.posteriorSegment?.re), flat(v.posteriorSegment?.le));
  if (post) bits.push(`Posterior segment: ${post}.`);
  const meds = medsOf(copy);
  if (meds.length) bits.push(`Medications: ${meds.map(medLine).join("; ")}.`);
  if (v.adviseNotes) bits.push(`Advice: ${v.adviseNotes}.`);
  if (v.followUpDate) bits.push(`Follow up review on ${dayOf(String(v.followUpDate).slice(0, 10))}.`);
  if (copy.ipd.dischargeNote) bits.push(`Discharge: ${copy.ipd.dischargeNote}.`);
  return bits.join(" ") || "No details were recorded in this note.";
}

/** "Underwent LE Trabeculectomy on 12 Nov 2026 by Dr. Name." from the three history fields. */
export function hpiSentence(ipd: IpdValues): string {
  // The surgery name may carry the anaesthesia after " · " (as in the banner); the sentence names the surgery only
  const name = (ipd.surgeryName ?? "").split(" · ")[0].trim();
  if (!name) return "";
  const on = ipd.surgeryDate ? ` on ${dayOf(ipd.surgeryDate)}` : "";
  const by = (ipd.surgeon ?? "").trim() ? ` by Dr. ${(ipd.surgeon ?? "").trim().replace(/^Dr\.?\s*/i, "")}` : "";
  return `Underwent ${name}${on}${by}.`;
}
