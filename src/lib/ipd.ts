// IPD (Phase 2) — shared rules and templates. No server-only imports, so the
// file screens and the server actions read the same definitions.

export type AdmissionType = "CONSERVATIVE" | "PRE_OP" | "OTHERS";
export type IpdStatus = "ADMITTED" | "IN_OT" | "POST_OP" | "DISCHARGED";

export const ADMISSION_TYPE_LABEL: Record<AdmissionType, string> = {
  CONSERVATIVE: "Conservative Management",
  PRE_OP: "Pre-op",
  OTHERS: "Others",
};

export const IPD_STATUS_LABEL: Record<IpdStatus, string> = {
  ADMITTED: "In Ward",
  IN_OT: "In OT",
  POST_OP: "Post-op Ward",
  DISCHARGED: "Discharged",
};

export function admissionTypeText(type: string, other?: string | null): string {
  if (type === "OTHERS" && other?.trim()) return other.trim();
  return ADMISSION_TYPE_LABEL[type as AdmissionType] ?? type;
}

/* ── Forms ───────────────────────────────────────────────────────────────── */

export type FormKey =
  | "summary" | "investigations" | "implant" | "consents" | "checklist"
  | "education" | "treatment" | "nurse" | "otNotes" | "discharge" | "postOpNotes";

export interface FormDef {
  key: FormKey;
  title: string;
  /** Shown only when the admission type is Pre-op. */
  preOpOnly?: boolean;
  /** Read-only content pulled from the EMR / Counselling; can still be confirmed (frozen) and have photos. */
  display?: boolean;
  /** Stays editable in the post-op ward (everything else is frozen there). */
  postOp?: boolean;
}

export const IPD_FORMS: FormDef[] = [
  { key: "summary",        title: "Today's Long Summary",          display: true },
  { key: "investigations", title: "Investigation Reports",         display: true },
  { key: "implant",        title: "Implant Details",               preOpOnly: true },
  { key: "consents",       title: "Consents",                      preOpOnly: true },
  { key: "checklist",      title: "Surgery Checklist",             preOpOnly: true },
  { key: "education",      title: "Patient Education & Diet Chart", postOp: true },
  { key: "treatment",      title: "Treatment Chart",               postOp: true },
  { key: "nurse",          title: "Nurse Notes",                   postOp: true },
  { key: "otNotes",        title: "Draft OT Notes",                preOpOnly: true },
  { key: "discharge",      title: "Draft Discharge Summary",       postOp: true },
  { key: "postOpNotes",    title: "Draft Post-op Notes" },
];

export const isCustomKey = (key: string) => key.startsWith("custom-");

/** Fixed forms that apply to this admission type, in order. */
export function formsFor(type: string): FormDef[] {
  return IPD_FORMS.filter((f) => !f.preOpOnly || type === "PRE_OP");
}

/** Keys that count towards completion: fixed forms for the type + custom forms. */
export function requiredKeys(type: string, customKeys: string[]): string[] {
  return [...formsFor(type).map((f) => f.key), ...customKeys.filter(isCustomKey)];
}

/** Can the form's main content be changed? (Running logs follow logsOpen.) */
export function formEditable(key: string, frozen: boolean, status: string): boolean {
  if (status === "POST_OP") return IPD_FORMS.some((f) => f.key === key && f.postOp);
  if (status !== "ADMITTED") return false;
  return !frozen;
}

/** Nurse / treatment / diet entries can be added until discharge (not while in OT). */
export function logsOpen(status: string): boolean {
  return status === "ADMITTED" || status === "POST_OP";
}

/** Can photos of documents be attached to a form? */
export function attachOpen(status: string): boolean {
  return status === "ADMITTED" || status === "POST_OP";
}

/** Only surgical admissions go to OT; conservative ones are discharged from the ward. */
export function canGoToOt(type: string): boolean {
  return type === "PRE_OP" || type === "OTHERS";
}

export function canDischargeNow(type: string, status: string): boolean {
  return status === "POST_OP" || (status === "ADMITTED" && type !== "PRE_OP");
}

/* ── Form data shapes ───────────────────────────────────────────────────── */

export type { LogEntry } from "./ipd-forms";

/* ── Draft OT notes (starter templates; doctors can edit per patient) ───── */

const OT_TEMPLATES: { match: RegExp; steps: string[] }[] = [
  {
    match: /phaco/i,
    steps: [
      "Patient identity, eye and consent verified; time-out done.",
      "Anaesthesia: {anaesthesia}.",
      "Painting with 5% povidone-iodine, draping, speculum applied.",
      "Main incision: ___ mm clear corneal / scleral tunnel at ___ o'clock; side port made.",
      "Viscoelastic injected into the anterior chamber.",
      "Continuous curvilinear capsulorhexis (~5.0–5.5 mm).",
      "Hydrodissection and hydrodelineation.",
      "Phacoemulsification of nucleus by ___ technique.",
      "Irrigation–aspiration of cortex.",
      "Capsular bag inflated with viscoelastic.",
      "IOL implanted in the bag: {implant}.",
      "Viscoelastic removed; wounds hydrated and checked for leak.",
      "Intracameral antibiotic ___; subconjunctival injection ___ (if given).",
      "Eye patched / shield applied.",
      "Intra-op events: Uneventful / ___",
    ],
  },
  {
    match: /msics|small incision|ecce|extracapsular|cataract/i,
    steps: [
      "Patient identity, eye and consent verified; time-out done.",
      "Anaesthesia: {anaesthesia}.",
      "Painting with 5% povidone-iodine, draping, speculum applied.",
      "Superior rectus bridle suture (if needed); fornix-based conjunctival flap.",
      "Haemostasis with wet-field cautery.",
      "Scleral tunnel incision ___ mm, ___ mm from limbus; side port made.",
      "Capsulotomy / capsulorhexis.",
      "Hydrodissection; nucleus prolapsed into AC and delivered.",
      "Cortical clean-up with Simcoe cannula.",
      "IOL implanted in the bag: {implant}.",
      "AC formed; wound checked for leak; conjunctiva reposited.",
      "Subconjunctival antibiotic + steroid injection.",
      "Eye patched / shield applied.",
      "Intra-op events: Uneventful / ___",
    ],
  },
  {
    match: /trab/i,
    steps: [
      "Patient identity, eye and consent verified; time-out done.",
      "Anaesthesia: {anaesthesia}.",
      "Painting, draping, speculum; corneal traction suture.",
      "Fornix / limbus-based conjunctival flap.",
      "MMC ___ mg/ml applied for ___ minutes; washed with BSS.",
      "Partial-thickness scleral flap ___ × ___ mm.",
      "Paracentesis made.",
      "Sclerostomy and peripheral iridectomy.",
      "Scleral flap sutured with 10-0 nylon (___ sutures).",
      "Conjunctiva closed; bleb formed, checked for leak.",
      "Subconjunctival antibiotic + steroid injection.",
      "Eye patched / shield applied.",
      "Intra-op events: Uneventful / ___",
    ],
  },
  {
    match: /vitrectomy|ppv/i,
    steps: [
      "Patient identity, eye and consent verified; time-out done.",
      "Anaesthesia: {anaesthesia}.",
      "Painting, draping, speculum.",
      "23 / 25G trocar cannulas placed 3.5–4 mm from limbus; infusion checked.",
      "Core vitrectomy; PVD induced / confirmed.",
      "Peripheral vitrectomy with scleral depression.",
      "Membrane peeling / ILM peeling (if done): ___",
      "Endolaser: ___ spots.",
      "Fluid–air exchange; tamponade: ___",
      "Ports removed; sclerotomies checked for leak / sutured.",
      "Subconjunctival antibiotic + steroid injection.",
      "Eye patched; positioning advised: ___",
      "Intra-op events: Uneventful / ___",
    ],
  },
  {
    match: /pterygium/i,
    steps: [
      "Patient identity, eye and consent verified; time-out done.",
      "Anaesthesia: {anaesthesia}.",
      "Painting, draping, speculum.",
      "Pterygium head dissected off the cornea; body excised with Tenon's.",
      "Bare sclera cleaned; haemostasis.",
      "Conjunctival autograft harvested from superior bulbar conjunctiva.",
      "Graft secured with fibrin glue / sutures.",
      "Antibiotic ointment; eye patched.",
      "Intra-op events: Uneventful / ___",
    ],
  },
  {
    match: /dcr|dacryo/i,
    steps: [
      "Patient identity, side and consent verified; time-out done.",
      "Anaesthesia: {anaesthesia}; nasal packing done.",
      "Skin incision ___ mm medial to medial canthus.",
      "Orbicularis split; medial palpebral ligament identified.",
      "Lacrimal sac fossa exposed; bony ostium created ___ × ___ mm.",
      "Sac and nasal mucosa flaps fashioned; posterior / anterior flaps sutured.",
      "Patency confirmed on syringing.",
      "Skin closed with ___ sutures; pressure bandage.",
      "Intra-op events: Uneventful / ___",
    ],
  },
];

const GENERIC_OT_STEPS = [
  "Patient identity, eye / side and consent verified; time-out done.",
  "Anaesthesia: {anaesthesia}.",
  "Painting, draping, speculum.",
  "Procedure steps:",
  "  1. ___",
  "  2. ___",
  "  3. ___",
  "Implant used: {implant}.",
  "Haemostasis achieved; wound checked.",
  "Medication given at end of surgery: ___",
  "Dressing / shield applied.",
  "Intra-op events: Uneventful / ___",
];

/** Template steps for the surgery, with anaesthesia and implant filled in. */
export function otTemplateSteps(a: { surgery?: string | null; implant?: string | null; anaesthesia?: string | null }): string[] {
  const steps = OT_TEMPLATES.find((t) => t.match.test(a.surgery ?? ""))?.steps ?? GENERIC_OT_STEPS;
  return steps
    .filter((s) => !s.startsWith("  ") && s !== "Procedure steps:" && !s.startsWith("Intra-op events"))
    .map((s) => s.replace("{anaesthesia}", a.anaesthesia || "___").replace("{implant}", a.implant || "___"));
}

export function otNotesTemplate(a: { surgery?: string | null; laterality?: string | null; implant?: string | null; anaesthesia?: string | null }): string {
  const steps = OT_TEMPLATES.find((t) => t.match.test(a.surgery ?? ""))?.steps ?? GENERIC_OT_STEPS;
  const head = `OPERATION NOTES (DRAFT)\nProcedure: ${[a.laterality, a.surgery].filter(Boolean).join(" ") || "___"}\nImplant: ${a.implant || "___"}\nAnaesthesia: ${a.anaesthesia || "___"}\nSurgeon: ___    Assistant: ___    Scrub nurse: ___\n\nSteps:`;
  const body = steps
    .map((s) => s.replace("{anaesthesia}", a.anaesthesia || "___").replace("{implant}", a.implant || "___"))
    .map((s, i) => (s.startsWith("  ") ? s : `${i + 1}. ${s}`))
    .join("\n");
  return `${head}\n${body}`;
}

/* ── Discharge summary (structured, NABH-style sections) ─────────────────── */

export const DISCHARGE_TYPES = [
  { value: "ROUTINE", label: "Routine" },
  { value: "ON_REQUEST", label: "On request" },
  { value: "LAMA", label: "Against medical advice (LAMA)" },
  { value: "REFERRED", label: "Referred" },
] as const;

export interface DischargeInvestigation { id: string; test: string; eye: string; ordered: string; received: string }

type OrderLike = { id?: string; testName: string; laterality: string | null; resultAt: string | Date | null; createdAt: string | Date };

export function invListFromOrders(orders: OrderLike[]): DischargeInvestigation[] {
  return orders.map((o, i) => ({
    id: o.id ?? `o${i}`, test: o.testName, eye: o.laterality ?? "",
    ordered: istDay(o.createdAt), received: o.resultAt ? istDay(o.resultAt) : "",
  }));
}

/** Older drafts listed investigations as text lines; move them into the table. */
export function normalizeDischarge(s: DischargeData, orders: OrderLike[]): DischargeData {
  if (s.invList) return s;
  const auto = /report (pending|on file)/.test(s.investigations);
  return { ...s, invList: invListFromOrders(orders), investigations: auto ? "" : s.investigations };
}

export interface DischargeMed { name: string; dose: string; eye: string; frequency: string; duration: string }

export interface DischargeData {
  v: 2;
  dischargeType: string;
  referredTo: string;
  dischargeDate: string;          // yyyy-mm-dd
  consultant: string;
  diagnosis: string;
  complaints: string;
  history: string;
  allergies: string;
  findings: { vaRe: string; vaLe: string; iopRe: string; iopLe: string; anterior: string; posterior: string };
  /** Key findings / results to report (free text). */
  investigations: string;
  /** Investigations done, as a table (older drafts have only the text above). */
  invList?: DischargeInvestigation[];
  procedure: { name: string; eye: string; date: string; anaesthesia: string; implant: string; surgeon: string; events: string };
  course: string;
  condition: { general: string; vaRe: string; vaLe: string; iopRe: string; iopLe: string; eye: string };
  meds: DischargeMed[];
  advice: string;
  warning: string;
  followUpDate: string;           // yyyy-mm-dd
  followUpNote: string;
}

export const isDischargeData = (x: unknown): x is DischargeData =>
  !!x && typeof x === "object" && (x as { v?: unknown }).v === 2;

export const DISCHARGE_WARNING_SIGNS =
  "Return to the hospital immediately, or call us, if you notice:\n• Increasing pain, redness or swelling of the eye\n• Sudden drop or blurring of vision\n• Sticky discharge or watering that keeps increasing\n• Flashes of light, new floaters or a curtain over the vision\n• Nausea, vomiting or severe headache";

const istDay = (d?: Date | string | null) =>
  d ? new Date(new Date(d).getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10) : "";
const dayLabel = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

const parseJson = <T,>(s: string | null | undefined, fallback: T): T => {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
};

const SEGMENT_LABELS: Record<string, string> = {
  upperLid: "Upper lid", lowerLid: "Lower lid", conjunctiva: "Conjunctiva", sclera: "Sclera", cornea: "Cornea",
  anteriorChamber: "AC", iris: "Iris", pupil: "Pupil", lens: "Lens",
  media: "Media", cdr: "CDR", nrr: "NRR", macula: "Macula", retinalVessels: "Vessels", background: "Background", periphery: "Periphery",
  discSize: "Disc size", discShape: "Disc shape", discColour: "Disc colour", discMargin: "Disc margin", discVessels: "Disc vessels",
};

/** "RE: Cornea clear; Lens NS2 · LE: …" from the EMR segment JSON (empty fields skipped). */
function segmentLine(re?: string | null, le?: string | null): string {
  const side = (raw?: string | null) => {
    const o = parseJson<Record<string, unknown>>(raw, {});
    return Object.entries(o)
      .map(([k, v]) => [k, typeof v === "string" ? v.replace(/•/g, "").replace(/\s+/g, " ").trim() : ""] as const)
      .filter(([k, v]) => v && SEGMENT_LABELS[k])
      .map(([k, v]) => `${SEGMENT_LABELS[k]} ${v}`)
      .join("; ");
  };
  return [side(re) && `RE: ${side(re)}`, side(le) && `LE: ${side(le)}`].filter(Boolean).join("\n");
}

export interface DischargeInputs {
  type: string;
  doctor: string;
  admittedOn: Date | string;
  expectedDischarge?: Date | string | null;
  surgery?: string | null; laterality?: string | null; implant?: string | null; anaesthesia?: string | null; surgeryDate?: Date | string | null;
  complaint?: string | null;
  diagnoses: { description: string; laterality: string | null; status?: string | null }[];
  pastHistory?: string | null; pmhOther?: string | null; familyHistory?: string | null;
  allergies?: string | null; nkda?: boolean;
  va?: { re?: string | null; le?: string | null } | null;
  iop?: { re?: number | null; le?: number | null } | null;
  anterior?: { re?: string | null; le?: string | null } | null;
  posterior?: { re?: string | null; le?: string | null } | null;
  orders: OrderLike[];
  doctorNotes: { text: string; at: string | Date }[];
  drugs: { name: string; dose: string; eye: string; frequency: string }[];
  education?: string | null;
  diet?: { time: string; item: string }[];
  followUpDate?: Date | string | null;
}

export function courseFromNotes(notes: { text: string; at: string | Date }[]): string {
  return [...notes]
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    .map((n) => `${dayLabel(n.at)}: ${n.text.trim()}`)
    .join("\n");
}

export function medsFromDrugs(drugs: { name: string; dose: string; eye: string; frequency: string }[]): DischargeMed[] {
  return drugs.filter((d) => d.name?.trim()).map((d) => ({ name: d.name, dose: d.dose, eye: d.eye, frequency: d.frequency, duration: "" }));
}

/** A first draft filled from everything the system already knows; every field stays editable. */
export function buildDischargeDraft(i: DischargeInputs): DischargeData {
  const surgical = i.type === "PRE_OP" || !!i.surgery;
  const va = (raw?: string | null) => {
    const o = parseJson<Record<string, string>>(raw, {});
    return [o.unaided && `${o.unaided} (unaided)`, o.bestCorrected && `${o.bestCorrected} (BCVA)`].filter(Boolean).join(", ");
  };
  const pmh = parseJson<unknown[]>(i.pastHistory, []).filter((x): x is string => typeof x === "string");
  const history = [
    pmh.length ? `Past history: ${pmh.join(", ")}` : "",
    i.pmhOther?.trim() ? i.pmhOther.trim() : "",
    i.familyHistory?.trim() ? `Family history: ${i.familyHistory.trim()}` : "",
  ].filter(Boolean).join("\n");
  const diet = (i.diet ?? []).filter((r) => r.item?.trim()).map((r) => `${r.time}: ${r.item}`).join("; ");

  return {
    v: 2,
    dischargeType: "ROUTINE",
    referredTo: "",
    dischargeDate: istDay(i.expectedDischarge) || "",
    consultant: i.doctor,
    diagnosis: i.diagnoses
      .map((d) => [d.laterality, d.description].filter(Boolean).join(" ") + (d.status && d.status !== "ACTIVE" ? ` (${d.status.toLowerCase()})` : ""))
      .join("\n"),
    complaints: (i.complaint ?? "").trim(),
    history,
    allergies: i.nkda ? "No known drug allergies" : (i.allergies ?? "").trim(),
    findings: {
      vaRe: va(i.va?.re), vaLe: va(i.va?.le),
      iopRe: i.iop?.re != null ? `${i.iop.re} mmHg` : "", iopLe: i.iop?.le != null ? `${i.iop.le} mmHg` : "",
      anterior: segmentLine(i.anterior?.re, i.anterior?.le),
      posterior: segmentLine(i.posterior?.re, i.posterior?.le),
    },
    investigations: "",
    invList: invListFromOrders(i.orders),
    procedure: surgical
      ? { name: i.surgery ?? "", eye: i.laterality ?? "", date: istDay(i.surgeryDate), anaesthesia: i.anaesthesia ?? "", implant: i.implant ?? "", surgeon: i.doctor, events: "Uneventful" }
      : { name: "", eye: "", date: "", anaesthesia: "", implant: "", surgeon: "", events: "" },
    course: courseFromNotes(i.doctorNotes),
    condition: { general: "Stable, ambulatory", vaRe: "", vaLe: "", iopRe: "", iopLe: "", eye: surgical ? "Quiet, wound healthy" : "" },
    meds: medsFromDrugs(i.drugs),
    advice: [i.education?.trim() ?? "", diet ? `Diet: ${diet}` : ""].filter(Boolean).join("\n"),
    warning: DISCHARGE_WARNING_SIGNS,
    followUpDate: istDay(i.followUpDate),
    followUpNote: surgical ? "Post-operative review" : "",
  };
}

export const dischargeTypeLabel = (v: string) => DISCHARGE_TYPES.find((t) => t.value === v)?.label ?? v;


/** Count frozen required forms. */
export function completion(type: string, forms: { key: string; frozen: boolean }[]): { done: number; total: number } {
  const keys = requiredKeys(type, forms.map((f) => f.key));
  const frozen = new Set(forms.filter((f) => f.frozen).map((f) => f.key));
  return { done: keys.filter((k) => frozen.has(k)).length, total: keys.length };
}
