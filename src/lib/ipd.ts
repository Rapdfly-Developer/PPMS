// IPD (Phase 2) - shared rules and templates. No server-only imports, so the
// file screens and the server actions read the same definitions.

import { toDateDay } from "./ist";

export type AdmissionType = "CONSERVATIVE" | "PRE_OP" | "OTHERS";
export type IpdStatus = "ADMITTED" | "IN_OT" | "POST_OP" | "DISCHARGED";

/** Ward type chosen at admission. */
export const WARD_TYPE_LABEL: Record<string, string> = { MALE: "Male ward", FEMALE: "Female ward", SPECIAL: "Special ward", VIP: "VIP ward", OTHER: "Others" };
export const wardTypeText = (t: string | null | undefined) => (t ? WARD_TYPE_LABEL[t] ?? t : "");

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
  | "summary" | "investigations" | "counselling" | "implant" | "consents" | "checklist"
  | "education" | "treatment" | "nurse" | "otNotes" | "discharge" | "postOpNotes";

export interface FormDef {
  key: FormKey;
  title: string;
  /** Shown only when the admission type is Pre-op. */
  preOpOnly?: boolean;
  /** Read-only content pulled from the EMR / Counselling; can still be confirmed (frozen) and have photos. */
  display?: boolean;
  /** "Edit till discharge" (document): stays editable after freezing and in the post-op ward. */
  postOp?: boolean;
  /** Created only when Discharge is clicked: never picked as a tab, and shown only once the patient is discharged. */
  atDischarge?: boolean;
}

export const IPD_FORMS: FormDef[] = [
  { key: "summary",        title: "Today's Long Summary",          display: true },
  { key: "investigations", title: "Investigation Reports",         display: true },
  { key: "counselling",    title: "Counselling Sheet",             preOpOnly: true },
  { key: "consents",       title: "Consents",                      preOpOnly: true },
  { key: "checklist",      title: "Surgery Checklist",             preOpOnly: true },
  { key: "education",      title: "Patient Education & Diet Chart", postOp: true },
  { key: "treatment",      title: "Treatment Chart",               postOp: true },
  { key: "nurse",          title: "Nurse Notes",                   postOp: true },
  { key: "otNotes",        title: "Draft OT Notes",                preOpOnly: true },
  { key: "discharge",      title: "Discharge Summary",             postOp: true, atDischarge: true },
  { key: "postOpNotes",    title: "Draft Post-op Notes",           preOpOnly: true, postOp: true },
];

/** Only these tabs have a Freeze / Unfreeze toggle (Counselling, Patient Education, Surgery Checklist). */
/** "diet" is the Diet Chart tab: it is frozen on its own, apart from Patient Education (both are stored in the education form). */
export const FREEZABLE_KEYS: string[] = ["counselling", "education", "diet", "checklist"];

export const isCustomKey = (key: string) => key.startsWith("custom-");

/** Tabs every patient file has: the long summary and the investigations. */
export const ALWAYS_TABS: string[] = ["summary", "investigations"];

/** Fixed forms that apply to this admission type, in order. */
export function formsFor(type: string): FormDef[] {
  return IPD_FORMS.filter((f) => !f.preOpOnly || type === "PRE_OP");
}

/** Tabs that can be picked for the file (besides the two it always has). */
export function tabChoices(type: string, hasCounselling: boolean): FormDef[] {
  return formsFor(type).filter((f) => !f.atDischarge && !ALWAYS_TABS.includes(f.key) && (f.key !== "counselling" || hasCounselling));
}

/** The file's fixed tabs, in order: the two it always has + the ones chosen for it. */
export function tabsFor(type: string, fileTabs: string[]): FormDef[] {
  return formsFor(type).filter((f) => !f.atDischarge && (ALWAYS_TABS.includes(f.key) || fileTabs.includes(f.key)));
}

/** Keys that count towards completion: the file's fixed tabs + custom forms (the long summary is the EMR, not frozen). */
export function requiredKeys(type: string, formKeys: string[], fileTabs: string[]): string[] {
  return tabsFor(type, fileTabs).flatMap((f) => (f.key === "education" ? ["education", "diet"] : [f.key])).filter((k) => FREEZABLE_KEYS.includes(k));
}

/** Can the form's main content be changed? (Running logs follow logsOpen.) */
/**
 * Can the form be changed? Forms the document marks "edit till discharge"
 * (education & diet, treatment, nurse notes, discharge summary, post-op notes)
 * stay editable after freezing and in the post-op ward; freezing them still
 * counts as confirmed for Shift to OT. All other forms lock when frozen.
 * Nothing is editable while the patient is in OT or after discharge.
 */
export function formEditable(key: string, frozen: boolean, status: string): boolean {
  if (status !== "ADMITTED" && status !== "POST_OP") return false;
  const tillDischarge = IPD_FORMS.some((f) => f.key === key && f.postOp);
  if (status === "POST_OP") return tillDischarge;
  return !frozen || tillDischarge || !FREEZABLE_KEYS.includes(key);
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
      "Continuous curvilinear capsulorhexis (~5.0-5.5 mm).",
      "Hydrodissection and hydrodelineation.",
      "Phacoemulsification of nucleus by ___ technique.",
      "Irrigation-aspiration of cortex.",
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
      "23 / 25G trocar cannulas placed 3.5-4 mm from limbus; infusion checked.",
      "Core vitrectomy; PVD induced / confirmed.",
      "Peripheral vitrectomy with scleral depression.",
      "Membrane peeling / ILM peeling (if done): ___",
      "Endolaser: ___ spots.",
      "Fluid-air exchange; tamponade: ___",
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

/**
 * Soft colours a tab (form) can be given. The choice is kept for the hospital and shows for everyone:
 * on the tab, its heading, the add-tab list, the activity timeline and the OT file.
 */
export const TAB_COLOURS = [
  { id: "rose", name: "Rose", dot: "#FB7185", tint: "#FFF1F2" },
  { id: "peach", name: "Peach", dot: "#FB923C", tint: "#FFF7ED" },
  { id: "amber", name: "Sun", dot: "#FBBF24", tint: "#FFFBEB" },
  { id: "lime", name: "Lime", dot: "#A3E635", tint: "#F7FEE7" },
  { id: "mint", name: "Mint", dot: "#34D399", tint: "#ECFDF5" },
  { id: "teal", name: "Teal", dot: "#2DD4BF", tint: "#F0FDFA" },
  { id: "sky", name: "Sky", dot: "#38BDF8", tint: "#F0F9FF" },
  { id: "indigo", name: "Indigo", dot: "#818CF8", tint: "#EEF2FF" },
  { id: "violet", name: "Lilac", dot: "#A78BFA", tint: "#F5F3FF" },
  { id: "pink", name: "Blush", dot: "#F472B6", tint: "#FDF2F8" },
] as const;
export const tabColour = (id: string | null | undefined) => TAB_COLOURS.find((c) => c.id === id) ?? null;
export const TAB_COLOUR_CATEGORY = "ipd_tab_colour";

const ID_STEP = "Patient identity, eye / side and consent verified; time-out done.";
const AN_STEP = "Anaesthesia: {anaesthesia}.";
const PREP = "Painting, draping, speculum.";

/** More ready-made procedure sets (the library), besides the ones above. */
const EXTRA_OT_SETS: { label: string; steps: string[] }[] = [
  { label: "Squint surgery (recession / resection)", steps: [ID_STEP, "Anaesthesia: {anaesthesia}; forced duction test done.", PREP, "Limbal / fornix conjunctival incision; muscle hooked and isolated.", "Recession: muscle secured with 6-0 vicryl, disinserted and reattached ___ mm behind the insertion.", "Resection: muscle measured ___ mm, secured, excised and reattached at the insertion.", "Conjunctiva closed / recessed; antibiotic ointment.", "Eyes checked for alignment on table.", "Intra-op events: Uneventful / ___"] },
  { label: "Scleral buckle", steps: [ID_STEP, AN_STEP, PREP, "360 degree peritomy; rectus muscles slung.", "Indirect ophthalmoscopy; breaks localised and marked.", "Cryopexy to breaks.", "Buckle / band ___ placed and sutured; encirclage tightened.", "Subretinal fluid drained: yes / no. Anterior chamber paracentesis if needed.", "Fundus checked: breaks on buckle, disc perfused.", "Conjunctiva closed; subconjunctival antibiotic + steroid."] },
  { label: "Intravitreal injection", steps: [ID_STEP, "Anaesthesia: {anaesthesia}.", "5% povidone iodine to the lids and conjunctival sac; speculum.", "Injection of ___ (drug / dose) through the pars plana ___ mm from the limbus.", "Optic nerve perfusion and hand motion checked.", "Antibiotic drop; eye patched.", "Intra-op events: Uneventful / ___"] },
  { label: "Glaucoma drainage device (Ahmed / tube)", steps: [ID_STEP, AN_STEP, PREP, "Fornix based conjunctival flap; quadrant exposed.", "Device primed; plate secured to the sclera ___ mm from the limbus.", "Tube trimmed and inserted into the anterior chamber / sulcus through a 23G tract.", "Tube covered with a scleral patch graft.", "Conjunctiva closed; anterior chamber formed.", "Subconjunctival antibiotic + steroid; eye patched."] },
  { label: "Chalazion incision and curettage", steps: [ID_STEP, "Anaesthesia: {anaesthesia}; local infiltration.", "Chalazion clamp applied; everted lid.", "Vertical incision on the conjunctival side; contents curetted.", "Cyst wall excised; haemostasis.", "Antibiotic ointment; pressure pad."] },
  { label: "Ptosis surgery (levator / frontalis sling)", steps: [ID_STEP, "Anaesthesia: {anaesthesia}; lid crease marked.", PREP, "Skin incision on the marked crease; orbicularis dissected.", "Levator resection ___ mm / sling material ___ passed and tied.", "Lid height and contour checked on table.", "Skin closed with ___ sutures; Frost suture if used.", "Antibiotic ointment; dressing."] },
  { label: "Penetrating keratoplasty", steps: [ID_STEP, AN_STEP, PREP, "Flieringa ring sutured if needed.", "Recipient trephination ___ mm; host button removed.", "Donor button ___ mm (+ ___ mm oversize) placed.", "Cardinal sutures, then continuous / interrupted 10-0 nylon (___ sutures).", "Anterior chamber formed; wound checked for leak.", "Subconjunctival antibiotic + steroid; shield applied."] },
  { label: "Evisceration / enucleation", steps: [ID_STEP, "Anaesthesia: {anaesthesia}.", PREP, "360 degree peritomy; muscles identified (enucleation: hooked and cut).", "Globe removed / contents eviscerated and cavity cleaned.", "Implant ___ mm placed; muscles attached; Tenon's and conjunctiva closed in layers.", "Conformer placed; pressure dressing."] },
  { label: "ICL / phakic IOL", steps: [ID_STEP, AN_STEP, PREP, "Side ports made; viscoelastic injected.", "ICL ___ (power ___ ) loaded and injected; haptics tucked behind the iris.", "Viscoelastic washed out; peripheral iridotomy as planned.", "Chamber formed; wounds checked; antibiotic injection."] },
];

/** Ready-made procedure sets for the library, with the anaesthesia and implant filled in. */
export function otSetLibrary(a: { implant?: string | null; anaesthesia?: string | null }): { id: string; label: string; steps: string[] }[] {
  const names = ["Phacoemulsification with IOL", "MSICS / extracapsular cataract", "Trabeculectomy", "Vitrectomy (PPV)", "Pterygium excision with graft", "DCR (dacryocystorhinostomy)"];
  const clean = (steps: string[]) => steps
    .filter((x) => !x.startsWith("  ") && x !== "Procedure steps:" && !x.startsWith("Intra-op events"))
    .map((x) => x.replace("{anaesthesia}", a.anaesthesia || "___").replace("{implant}", a.implant || "___"));
  return [
    ...OT_TEMPLATES.map((t, i) => ({ id: `lib-${i}`, label: names[i] ?? `Set ${i + 1}`, steps: clean(t.steps) })),
    ...EXTRA_OT_SETS.map((t, i) => ({ id: `lib-x${i}`, label: t.label, steps: clean(t.steps) })),
  ];
}

/** Keywords for the OT notes' findings, complications and instructions, by the kind of surgery. */
export function otKeywords(surgery: string | null | undefined): { group: string; findings: string[]; complications: string[]; instructions: string[] } {
  const t = surgery ?? "";
  const pick = (group: string, findings: string[], complications: string[], instructions: string[]) => ({ group, findings, complications, instructions });
  if (/glaucoma|trab|tube|valve|ahmed|baerveldt|shunt|stent|cyclo/i.test(t))
    return pick("glaucoma", ["Uneventful", "Conjunctiva thin / scarred", "Good scleral flap", "Bleb formed", "Iris prolapse", "Anterior chamber formed"],
      ["None", "Hyphaema", "Shallow anterior chamber", "Button-hole in the conjunctiva", "Choroidal effusion", "Vitreous in the wound"],
      ["Avoid pressure on the eye", "No rubbing", "Steroid drops as charted", "Review tomorrow: bleb and IOP", "Eye shield at night", "Avoid heavy lifting and bending"]);
  if (/vitrectomy|ppv|buckle|retina|detachment|intravitreal|injection/i.test(t))
    return pick("retina", ["Uneventful", "PVD induced", "Retina attached", "Breaks sealed with laser / cryo", "Tamponade placed", "ILM peeled"],
      ["None", "Iatrogenic break", "Haemorrhage", "Lens touch", "High IOP", "Choroidal detachment"],
      ["Face-down / positioning as advised", "No air travel while gas is present", "Do not lie flat on the back", "Drops as advised", "Review tomorrow", "Eye shield at night"]);
  if (/pterygium/i.test(t))
    return pick("pterygium", ["Uneventful", "Pterygium excised", "Conjunctival autograft placed", "Graft secured with glue / sutures", "Bare sclera covered"],
      ["None", "Graft displacement", "Buttonhole in the graft", "Scleral thinning", "Bleeding"],
      ["Eye patched for 1 day", "Drops as advised", "Do not rub the eye", "Avoid dust and sunlight", "Review next day"]);
  if (/dcr|dacryo|lacrimal|probing/i.test(t))
    return pick("lacrimal", ["Uneventful", "Bony ostium created", "Sac and nasal flaps anastomosed", "Free flow on syringing"],
      ["None", "Bleeding", "Mucosal tear", "Septal deviation"],
      ["Nasal decongestant drops as advised", "Avoid nose blowing", "Cold compress", "Keep the head elevated", "Review in 1 week for stent / suture"]);
  if (/squint|strabismus|recession|resection/i.test(t))
    return pick("squint", ["Uneventful", "Muscle isolated and secured", "Forced duction test negative", "Eyes aligned on the table", "Conjunctiva closed / recessed"],
      ["None", "Slipped / lost muscle", "Scleral perforation", "Bleeding", "Oculocardiac reflex"],
      ["Antibiotic-steroid drops as advised", "Avoid rubbing the eyes", "Avoid swimming", "Review tomorrow", "Orthoptic evaluation after review"]);
  if (/kerato|cornea|dalk|transplant/i.test(t))
    return pick("cornea", ["Uneventful", "Graft centred and clear", "Sutures well apposed", "Anterior chamber formed", "No wound leak"],
      ["None", "Descemet's perforation", "Wound leak", "Hyphaema", "Iris damage"],
      ["Eye shield at all times", "Steroid and antibiotic drops as charted", "Avoid rubbing and pressure", "Avoid heavy lifting", "Review tomorrow"]);
  if (/ptosis|chalazion|eyelid|entropion|ectropion|evisc|enucle|orbit|blepharo/i.test(t))
    return pick("oculoplasty", ["Uneventful", "Haemostasis achieved", "Lid height / contour satisfactory", "Closure in layers", "Implant placed"],
      ["None", "Bleeding", "Under / over correction", "Lagophthalmos", "Wound gaping"],
      ["Cold compress", "Antibiotic ointment as advised", "Keep the dressing dry", "Avoid straining", "Suture removal at review"]);
  if (/phaco|cataract|msics|sics|ecce|iol|icl|phakic|lens/i.test(t))
    return pick("cataract", ["Uneventful", "Hard cataract", "Shallow anterior chamber", "Small pupil", "Weak zonules", "Posterior capsule intact", "IOL in the bag"],
      ["None", "Posterior capsule rent", "Vitreous loss", "Iris prolapse", "Zonular dialysis", "Dropped nucleus"],
      ["Drops as advised", "Eye shield at night", "Avoid water in the eye", "Avoid heavy lifting and bending", "Review tomorrow"]);
  return pick("general", ["Uneventful", "Haemostasis achieved", "Wound secure"], ["None", "Bleeding", "Wound leak"], ["Drops as advised", "Eye shield at night", "Avoid water in the eye", "Review tomorrow"]);
}

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

export interface DischargeMed {
  name: string; dose: string; eye: string; frequency: string; duration: string;
  route?: string;
  /** Instructions, with the tapering steps as "Tapering: a → b" (same as the EMR plan). */
  instructions?: string;
}

export interface DischargeData {
  v: 2;
  dischargeType: string;
  referredTo: string;
  dischargeDate: string;          // date and time of discharge (ISO timestamp)
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
  /** Which tabs and sections the summary has (the doctor can remove and add them). */
  layout?: DischargeLayout;
}

/* The summary is a set of tabs, each holding sections. Both can be removed and added back. */
export interface DischargeLayout {
  tabs: { id: string; name: string; sections: string[] }[];
  /** Sections written by hand (their id in a tab is "c:" plus the id here). */
  custom: { id: string; title: string; text: string }[];
}
export const DISCHARGE_SECTIONS: Record<string, { title: string; about: string }> = {
  discharge: { title: "Discharge", about: "Date, consultant and type of discharge" },
  diagnosis: { title: "Diagnosis and complaints", about: "Diagnosis, complaints, history, allergies" },
  exam: { title: "Examination on admission", about: "Vision, IOP, anterior and posterior segment" },
  investigations: { title: "Investigations", about: "Tests ordered and their reports" },
  procedure: { title: "Procedure", about: "Surgery, anaesthesia, implant, surgeon" },
  course: { title: "Course in hospital", about: "The stay as a timeline" },
  condition: { title: "Condition at discharge", about: "General condition" },
  meds: { title: "Medicines on discharge", about: "From the treatment chart" },
  advice: { title: "Advice", about: "Care, diet and warning signs" },
  followup: { title: "Follow-up", about: "Review date and reason" },
  signoff: { title: "Sign-off", about: "Electronic signature note" },
};
export const DEFAULT_DISCHARGE_TABS: DischargeLayout["tabs"] = [
  { id: "t-discharge", name: "Discharge", sections: ["discharge", "diagnosis"] },
  { id: "t-clinical", name: "Clinical", sections: ["exam", "investigations"] },
  { id: "t-course", name: "Procedure & course", sections: ["procedure", "course", "condition"] },
  { id: "t-meds", name: "Medicines & follow-up", sections: ["meds", "advice", "followup", "signoff"] },
];
export const layoutOf = (s: { layout?: DischargeLayout }): DischargeLayout =>
  s.layout ?? { tabs: DEFAULT_DISCHARGE_TABS.map((t) => ({ ...t, sections: [...t.sections] })), custom: [] };
/** The data each section owns (cleared from the printed summary when the section is removed). */
const SECTION_EMPTY: Record<string, Partial<DischargeData>> = {
  diagnosis: { diagnosis: "", complaints: "", history: "", allergies: "" },
  exam: { findings: { vaRe: "", vaLe: "", iopRe: "", iopLe: "", anterior: "", posterior: "" } },
  investigations: { invList: [], investigations: "" },
  procedure: { procedure: { name: "", eye: "", date: "", anaesthesia: "", implant: "", surgeon: "", events: "" } },
  course: { course: "" },
  condition: { condition: { general: "", vaRe: "", vaLe: "", iopRe: "", iopLe: "", eye: "" } },
  meds: { meds: [] },
  advice: { advice: "", warning: "" },
  followup: { followUpDate: "", followUpNote: "" },
};
/** The ids of the sections that are in some tab. */
export const placedSections = (l: DischargeLayout) => new Set(l.tabs.flatMap((t) => t.sections));
/** The summary as printed: sections that were removed leave no trace. */
export function applyLayout(s: DischargeData): DischargeData {
  if (!s.layout) return s;
  const placed = placedSections(s.layout);
  let out = s;
  for (const [id, empty] of Object.entries(SECTION_EMPTY)) if (!placed.has(id)) out = { ...out, ...empty };
  return out;
}

export const isDischargeData = (x: unknown): x is DischargeData =>
  !!x && typeof x === "object" && (x as { v?: unknown }).v === 2;

export const DISCHARGE_WARNING_SIGNS =
  "Return to the hospital immediately, or call us, if you notice:\n• Increasing pain, redness or swelling of the eye\n• Sudden drop or blurring of vision\n• Sticky discharge or watering that keeps increasing\n• Flashes of light, new floaters or a curtain over the vision\n• Nausea, vomiting or severe headache";

const istDay = (d?: Date | string | null) =>
  d ? new Date(new Date(d).getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10) : "";
const dayLabel = (d: Date | string) =>
  toDateDay(new Date(d), "en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

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
  /** What the OT notes recorded (surgeon, anaesthesia, implant, complications). */
  ot?: { surgeon?: string; anaesthesia?: string; eye?: string; implant?: string; procedure?: string; complications?: string } | null;
  orders: OrderLike[];
  doctorNotes: { text: string; at: string | Date }[];
  drugs: { name: string; dose: string; eye: string; frequency: string; route?: string; instructions?: string }[];
  education?: string | null;
  diet?: { time: string; item: string }[];
  followUpDate?: Date | string | null;
}

/** The whole stay as a story, oldest first: admission, procedure, investigations, every doctor's note. */
export function courseFromFile(i: {
  admittedOn: Date | string; doctor: string; typeText: string;
  procedure?: { name: string; eye: string; date: string; anaesthesia?: string } | null;
  orders: OrderLike[]; doctorNotes: { text: string; at: string | Date }[];
}): string {
  const ev: { at: number; text: string }[] = [];
  const line = (t: string) => t.split("\n").map((l) => l.trim()).filter(Boolean).join("; ");
  ev.push({ at: new Date(i.admittedOn).getTime() - 1, text: `Admitted${i.typeText ? ` for ${i.typeText}` : ""}${i.doctor ? ` under Dr. ${i.doctor.replace(/^Dr\.?\s*/i, "")}` : ""}` });
  for (const o of i.orders) {
    ev.push({ at: new Date(o.createdAt).getTime(), text: `Investigation ordered: ${[o.laterality, o.testName].filter(Boolean).join(" ")}` });
    if (o.resultAt) ev.push({ at: new Date(o.resultAt).getTime(), text: `Investigation report received: ${[o.laterality, o.testName].filter(Boolean).join(" ")}` });
  }
  const p = i.procedure;
  if (p?.name?.trim() && p.date) {
    ev.push({ at: new Date(`${p.date}T12:00:00+05:30`).getTime(), text: `Surgery: ${[p.eye, p.name].filter(Boolean).join(" ")}${p.anaesthesia ? ` under ${p.anaesthesia}` : ""}` });
  }
  for (const n of i.doctorNotes) ev.push({ at: new Date(n.at).getTime(), text: line(n.text) });
  return ev.filter((e) => e.text.trim() && !Number.isNaN(e.at)).sort((a, b) => a.at - b.at).map((e) => `${dayLabel(new Date(e.at))}: ${e.text}`).join("\n");
}

export function courseFromNotes(notes: { text: string; at: string | Date }[]): string {
  return [...notes]
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    .map((n) => `${dayLabel(n.at)}: ${n.text.split("\n").map((l) => l.trim()).filter(Boolean).join("; ")}`)
    .join("\n");
}

/** "till 3 Dec 2026, Thu" for a duration like "2 weeks" counted from `from` (a YYYY-MM-DD day; today when empty). */
export function durationEnd(duration: string, from?: string | null): string {
  const m = (duration ?? "").match(/(\d+)\s*(day|week|wk|month|mo|year|yr)/i);
  if (!m) return "";
  const n = Number(m[1]);
  const u = m[2].toLowerCase();
  const fromDay = from && from.length > 10 && !Number.isNaN(Date.parse(from)) ? istDay(new Date(from)) : from;
  const d = new Date(`${fromDay && /^\d{4}-\d{2}-\d{2}$/.test(fromDay) ? fromDay : istDay(new Date())}T00:00:00Z`);
  if (u.startsWith("d")) d.setUTCDate(d.getUTCDate() + n);
  else if (u.startsWith("w")) d.setUTCDate(d.getUTCDate() + n * 7);
  else if (u.startsWith("m")) d.setUTCMonth(d.getUTCMonth() + n);
  else d.setUTCFullYear(d.getUTCFullYear() + n);
  return `till ${toDateDay(d, "en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}`;
}

export function medsFromDrugs(drugs: { name: string; dose: string; eye: string; frequency: string; route?: string; instructions?: string }[]): DischargeMed[] {
  return drugs.filter((d) => d.name?.trim()).map((d) => ({ name: d.name, dose: d.dose, eye: d.eye, frequency: d.frequency, duration: "", route: d.route ?? "", instructions: d.instructions ?? "" }));
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
    dischargeDate: new Date().toISOString(),
    consultant: i.doctor,
    diagnosis: i.diagnoses
      .map((d) => [d.laterality, d.description].filter(Boolean).join(" ") + (d.status && !["ACTIVE", "BLANK"].includes(d.status) ? ` (${d.status.toLowerCase()})` : ""))
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
      ? {
          name: i.ot?.procedure?.trim() || i.surgery || "", eye: i.ot?.eye?.trim() || i.laterality || "", date: istDay(i.surgeryDate),
          anaesthesia: i.ot?.anaesthesia?.trim() || i.anaesthesia || "", implant: i.ot?.implant?.trim() || i.implant || "",
          surgeon: i.ot?.surgeon?.trim() || i.doctor,
          events: i.ot?.complications?.trim() && !/^none$/i.test(i.ot.complications.trim()) ? i.ot.complications.trim() : "Uneventful",
        }
      : { name: "", eye: "", date: "", anaesthesia: "", implant: "", surgeon: "", events: "" },
    course: courseFromFile({ admittedOn: i.admittedOn, doctor: i.doctor, typeText: admissionTypeText(i.type), procedure: surgical ? { name: i.ot?.procedure?.trim() || i.surgery || "", eye: i.ot?.eye?.trim() || i.laterality || "", date: istDay(i.surgeryDate), anaesthesia: i.ot?.anaesthesia?.trim() || i.anaesthesia || "" } : null, orders: i.orders, doctorNotes: i.doctorNotes }),
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
export function completion(type: string, forms: { key: string; frozen: boolean }[], fileTabs: string[]): { done: number; total: number } {
  const keys = requiredKeys(type, forms.map((f) => f.key), fileTabs);
  const frozen = new Set(forms.filter((f) => f.frozen).map((f) => f.key));
  return { done: keys.filter((k) => frozen.has(k)).length, total: keys.length };
}
