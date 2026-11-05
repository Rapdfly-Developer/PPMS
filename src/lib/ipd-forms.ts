// IPD patient-file forms: data shapes, hospital-standard defaults and presets.
// Shared by the server (defaults) and the form screens. No server imports.
import { SURGERY_OPTIONS } from "@/lib/counselling";

/* ── Running logs (charts) ─────────────────────────────────────────────── */

export type LogKind = "dose" | "food" | "vitals" | "note";
export interface LogEntry {
  at: string;
  by: string;
  text: string;
  kind?: LogKind;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meta?: Record<string, any>;
}

export interface Tick { by: string; at: string }

/** Who filled what: the shared context every form gets. */
export interface FormContext {
  patientName: string;
  age: number;
  sex: string;
  patientId: string;
  hospital: string;
  doctor: string;
  surgery: string | null;
  eye: string | null;
  implant: string | null;
  anaesthesia: string | null;
  surgeryDate: string | null;
  type: string;
}

const EYE_NAME: Record<string, string> = { RE: "right eye (RE)", LE: "left eye (LE)", OU: "both eyes (OU)" };
export const eyeName = (e?: string | null) => (e ? EYE_NAME[e] ?? e : "the eye");

/* ── Implant details ───────────────────────────────────────────────────── */

export interface ImplantData {
  v: 2;
  manufacturer: string;
  model: string;
  power: string;
  aConstant: string;
  lot: string;
  serial: string;
  expiry: string;
  verify: Record<"patient" | "eye" | "implant" | "power" | "expiry", Tick | null>;
}
export const IMPLANT_VERIFY: { key: keyof ImplantData["verify"]; label: string }[] = [
  { key: "patient", label: "Patient identity matches the file" },
  { key: "eye", label: "Operative eye matches the consent and marking" },
  { key: "implant", label: "Implant model matches the counselling plan" },
  { key: "power", label: "IOL power matches the biometry report" },
  { key: "expiry", label: "Implant pack is sealed and within expiry" },
];
export function defaultImplant(): ImplantData {
  return {
    v: 2, manufacturer: "", model: "", power: "", aConstant: "", lot: "", serial: "", expiry: "",
    verify: { patient: null, eye: null, implant: null, power: null, expiry: null },
  };
}

/* ── Consents ──────────────────────────────────────────────────────────── */

export interface ConsentSigner { kind: "PATIENT" | "RELATIVE"; name: string; relation: string }
export interface ConsentItem {
  id: string;
  title: string;
  text: string;
  signed: boolean;
  signer?: ConsentSigner;
  witness?: string;
  language?: string;
  explainedBy?: string;
  signedAt?: string;
  recordedBy?: string;
  /** Older entries only. */
  signedBy?: string;
}
export interface ConsentsData { v: 2; items: ConsentItem[] }

export const CONSENT_LANGUAGES = ["English", "Tamil", "Hindi", "Malayalam", "Kannada", "Telugu"];

function consentText(kind: string, c: FormContext): string {
  const proc = [c.eye, c.surgery].filter(Boolean).join(" ") || "the advised procedure";
  const who = `${c.patientName} (${c.age} yrs, ${c.sex.toLowerCase()}, ID ${c.patientId})`;
  switch (kind) {
    case "General":
      return `I, ${who}, hereby give my consent to be admitted to ${c.hospital} and to undergo ${proc} on my ${eyeName(c.eye)} under the care of Dr. ${c.doctor} and team.\n\nThe nature of my eye condition, the purpose of the operation, the expected benefits, the alternatives available (including not having the operation) and the likely course after surgery have been explained to me in a language I understand. I have had the opportunity to ask questions and all my questions have been answered to my satisfaction.\n\nI consent to the administration of medicines, injections and investigations that the treating team considers necessary, and to any additional procedure that may become necessary during the operation in my best interest.`;
    case "GVP":
      return `General & Visual Prognosis: I understand that the visual outcome after ${proc} depends on the condition of my eye, including the retina, optic nerve and cornea, and on other health conditions such as diabetes and high blood pressure.\n\nIt has been explained that vision may improve, remain the same or, rarely, become worse; that I may still need glasses for distance and/or near after surgery; and that further treatment such as laser (YAG capsulotomy) or another procedure may be needed in future.`;
    case "Anaesthesia":
      return `I consent to receive ${c.anaesthesia || "the anaesthesia advised"} for my operation. The anaesthesia plan and its alternatives have been explained to me.\n\nI understand the possible risks, including discomfort, bruising around the eye, allergy to medicines, rise in blood pressure, injury to the eye or optic nerve (for injection blocks) and, rarely, effects on breathing or heart that need emergency treatment. I agree to follow the fasting and medicine instructions given to me.`;
    case "Negative":
      return `High-risk / Negative consent: I have been informed of the possible complications of ${proc}, including infection inside the eye (endophthalmitis), bleeding, raised eye pressure, swelling of the cornea or retina, retinal detachment, dislocation of the implant and, rarely, permanent loss of vision or of the eye.\n\nI understand that despite all care these complications can occur, that additional treatment or surgery may be needed, and that no guarantee of the result has been given to me.`;
    default:
      return "";
  }
}

export const CONSENT_KINDS = [
  { id: "General", title: "General Consent for Admission & Surgery" },
  { id: "GVP", title: "General & Visual Prognosis (GVP) Consent" },
  { id: "Anaesthesia", title: "Consent for Anaesthesia" },
  { id: "Negative", title: "High-risk / Negative Consent" },
];

export function defaultConsents(c: FormContext): ConsentsData {
  return { v: 2, items: CONSENT_KINDS.map((k) => ({ id: k.id, title: k.title, text: consentText(k.id, c), signed: false })) };
}

export const CONSENT_DECLARATION =
  "I confirm that I have read (or have had read to me) and understood the above, in a language I understand, and I give my consent voluntarily.";

/* ── Pre-operative surgery checklist ───────────────────────────────────── */

export type CheckAnswer = "YES" | "NO" | "NA";
export interface ChecklistAnswer { value: CheckAnswer; by: string; at: string; remark?: string }
export interface ChecklistData {
  v: 2;
  answers: Record<string, ChecklistAnswer>;
  custom: string[];
  vitals: { bp: string; pulse: string; temp: string; spo2: string; rbs: string; weight: string };
  lastOral: string;
  dilationAt: string;
  handedOverBy: string;
}

export const PREOP_CHECKLIST: { section: string; items: string[] }[] = [
  {
    section: "Identification & consent",
    items: [
      "Identity band on; name and ID verified with the patient",
      "Operative eye confirmed and marked",
      "All consents signed, witnessed and filed",
      "Allergies checked and recorded",
    ],
  },
  {
    section: "Investigations & fitness",
    items: [
      "Blood sugar and BP within accepted limits",
      "Blood reports and ECG reviewed",
      "Biometry / IOL power report in the file",
      "Physician fitness obtained (if advised)",
    ],
  },
  {
    section: "Physical preparation",
    items: [
      "Face washed; lashes and periocular area cleaned",
      "Ornaments, dentures, contact lenses and hairpins removed",
      "Make-up and nail polish removed",
      "Bladder emptied before shifting",
      "OT gown and cap worn",
      "IV line secured (if advised)",
    ],
  },
  {
    section: "Medications",
    items: [
      "Pre-op dilating drops instilled as ordered",
      "Pre-op antibiotic drops instilled",
      "Antihypertensive / antidiabetic medicines given as advised",
      "Anticoagulants / antiplatelets stopped as advised",
    ],
  },
];

export function defaultChecklist(): ChecklistData {
  return {
    v: 2, answers: {}, custom: [],
    vitals: { bp: "", pulse: "", temp: "", spo2: "", rbs: "", weight: "" },
    lastOral: "", dilationAt: "", handedOverBy: "",
  };
}

/* ── Patient education & diet chart ────────────────────────────────────── */

/** Education points by kind of surgery; every surgery in the list maps to one. */
const EDU_POINTS: Record<string, string[]> = {
  cataract: [
    "Do not rub or press the operated eye",
    "Wear the protective shield while sleeping for 2 weeks",
    "Wash hands before putting drops; keep a 5-minute gap between drops",
    "Keep water and soap out of the eye for 2 weeks",
    "Avoid bending, lifting heavy weights and dusty or smoky places",
    "Wear dark glasses outdoors",
    "Reading and watching TV are allowed in moderation",
    "Come back immediately for pain, redness or a sudden drop in vision",
  ],
  glaucoma: [
    "Do not rub or press the operated eye; wear the shield at night",
    "Use drops exactly as charted; do not stop any drop on your own",
    "Avoid bending and lifting heavy weights",
    "Keep all review appointments for eye-pressure checks",
    "Come back immediately for pain, redness, watering or a drop in vision",
  ],
  retina: [
    "Maintain the head position advised by the doctor",
    "Do not travel by air or to high altitude while gas is in the eye",
    "Do not rub or press the operated eye; wear the shield at night",
    "Use drops exactly as charted",
    "Come back immediately for pain, a curtain over the vision or flashes",
  ],
  cornea: [
    "Do not rub or press the eye; wear the shield at all times for the first week",
    "Use steroid and antibiotic drops exactly as charted; never stop them suddenly",
    "Lie on your back as advised (endothelial grafts)",
    "Avoid dust, smoke and swimming until the doctor allows",
    "Watch for graft rejection: redness, sensitivity to light, blurred vision or pain (RSVP) - come back immediately",
  ],
  pterygium: [
    "Do not rub the eye; mild watering and foreign-body feeling are expected",
    "Use drops as charted to reduce the chance of recurrence",
    "Wear dark glasses outdoors; avoid dust and sun exposure",
    "Come back for pain, discharge or the graft moving",
  ],
  lacrimal: [
    "Do not blow the nose forcefully for 2 weeks",
    "Apply the nasal drops / spray as charted",
    "Keep the skin wound dry and clean until the stitches are removed",
    "Some blood-stained nasal discharge for a day or two is expected",
    "Come back for heavy bleeding, fever or swelling",
  ],
  lid: [
    "Apply cold compresses for the first 48 hours to reduce swelling",
    "Keep the wound clean and dry; apply ointment as charted",
    "Sleep with the head raised for the first few nights",
    "Bruising and swelling settle in 1-2 weeks",
    "Come back for bleeding, increasing pain or difficulty closing the eye",
  ],
  squint: [
    "Mild redness and discomfort for a few days are expected",
    "Use drops as charted; keep water out of the eyes for a week",
    "Double vision for a short time can occur and usually settles",
    "Continue glasses / exercises as advised",
    "Come back for increasing pain, discharge or reduced vision",
  ],
  socket: [
    "Keep the pressure bandage on until the doctor removes it",
    "Use drops / ointment in the socket as charted",
    "Swelling and discomfort settle over 1-2 weeks",
    "The artificial eye (prosthesis) is fitted after about 6 weeks",
    "Come back for bleeding, fever or discharge from the socket",
  ],
  icl: [
    "Do not rub or press the eye; wear the shield at night for 1 week",
    "Use drops exactly as charted",
    "Keep water out of the eye for 1 week; avoid swimming for 1 month",
    "Come back immediately for pain, haloes with headache or a drop in vision",
  ],
  general: [
    "Use the medicines exactly as charted",
    "Keep the eye clean; do not rub the eye",
    "Inform the nurse of any pain, vomiting, headache or drop in vision",
    "Follow the diet advised",
  ],
};

function categoryOf(surgery?: string | null): string {
  const s = (surgery ?? "").toLowerCase();
  if (!s) return "general";
  if (/trab|glaucoma|ahmed|valve|drainage/.test(s)) return "glaucoma";
  if (/collamer|\bicl\b/.test(s)) return "icl";
  if (/phaco|cataract|msics|ecce|iol/.test(s)) return "cataract";
  if (/vitrect|ppv|retin|buckl|silicone/.test(s)) return "retina";
  if (/kerato|dsaek|dmek|cornea/.test(s)) return "cornea";
  if (/pterygium/.test(s)) return "pterygium";
  if (/dacryo|dcr|lacrimal/.test(s)) return "lacrimal";
  if (/ptosis|lid|chalazion|entropion|ectropion/.test(s)) return "lid";
  if (/strabism|squint/.test(s)) return "squint";
  if (/eviscer|enucle|socket/.test(s)) return "socket";
  return "general";
}

export interface EducationSet { id: string; label: string; points: string[]; mine?: boolean }

export const MEDICAL_SET_LABEL = "Medical / conservative treatment";

/** One built-in set per surgery in the surgery list, plus medical treatment. */
export const BUILTIN_EDUCATION_SETS: EducationSet[] = [
  ...SURGERY_OPTIONS.map((s) => ({ id: `s:${s}`, label: s, points: EDU_POINTS[categoryOf(s)] })),
  { id: "s:medical", label: MEDICAL_SET_LABEL, points: EDU_POINTS.general },
];

/** The set that matches the patient's surgery (any surgery name, even one not in the list). */
export function educationSetFor(surgery?: string | null, type?: string): EducationSet {
  const exact = BUILTIN_EDUCATION_SETS.find((x) => x.label.toLowerCase() === (surgery ?? "").trim().toLowerCase());
  if (exact) return exact;
  if (surgery?.trim()) return { id: `s:${surgery.trim()}`, label: surgery.trim(), points: EDU_POINTS[categoryOf(surgery)] };
  return type === "PRE_OP" ? BUILTIN_EDUCATION_SETS[0] : BUILTIN_EDUCATION_SETS[BUILTIN_EDUCATION_SETS.length - 1];
}

export const DIET_TYPES = ["Normal", "Diabetic", "Soft", "Liquid", "Low salt", "Nil by mouth"];
export const MEAL_AMOUNTS = ["Full", "Half", "Refused"] as const;

export interface Meal { meal: string; time: string; diet: string }
export interface EducationData {
  v: 2;
  preset: string;
  points: { text: string; done: boolean }[];
  explainedTo: string;
  language: string;
  teachBack: boolean;
  notes: string;
  dietTypes: string[];
  nbmFrom: string;
  meals: Meal[];
  log: LogEntry[];
}

export const DEFAULT_MEALS: Meal[] = [
  { meal: "Early morning", time: "06:00", diet: "Tea / coffee / milk" },
  { meal: "Breakfast", time: "08:00", diet: "" },
  { meal: "Mid-morning", time: "11:00", diet: "Fruit / juice" },
  { meal: "Lunch", time: "13:00", diet: "" },
  { meal: "Evening", time: "16:30", diet: "Tea / biscuits" },
  { meal: "Dinner", time: "20:00", diet: "" },
];

export function defaultEducation(c: Pick<FormContext, "surgery" | "type">): EducationData {
  const set = educationSetFor(c.surgery, c.type);
  return {
    v: 2, preset: set.label,
    points: set.points.map((text) => ({ text, done: false })),
    explainedTo: "", language: "English", teachBack: false, notes: "",
    dietTypes: ["Normal"], nbmFrom: "", meals: DEFAULT_MEALS.map((m) => ({ ...m })), log: [],
  };
}

/** Plain-text advice for the discharge summary. */
export function educationAdvice(e: EducationData): string {
  const pts = e.points.map((p) => `• ${p.text}`);
  return [...pts, e.notes.trim()].filter(Boolean).join("\n");
}

/* ── Treatment chart (orders + administration record) ──────────────────── */

export interface DrugOrder {
  id: string;
  name: string;
  dose: string;
  route: string;
  eye: string;
  frequency: string;
  start: string;
  orderedBy: string;
  instructions: string;
  stopped: boolean;
  stoppedBy?: string;
  stoppedAt?: string;
}
export interface TreatmentData { v: 2; drugs: DrugOrder[]; log: LogEntry[] }

export const ROUTES = ["Topical", "Oral", "IV", "IM", "Subconjunctival", "Intravitreal", "Ointment"];
export const EYES = ["RE", "LE", "OU"];

/** Standard ward administration times for a frequency; empty for SOS / stat. */
export function scheduleFor(frequency: string): string[] {
  const f = frequency.toLowerCase();
  const every = (h: number) => Array.from({ length: Math.floor(16 / h) + 1 }, (_, i) => `${String(6 + i * h).padStart(2, "0")}:00`);
  if (/prn|sos|stat|as needed|immediately/.test(f)) return [];
  if (/half an hourly/.test(f)) return every(1);
  if (/^hourly|\bhourly\b/.test(f) && !/\d|2nd|3rd|4th/.test(f)) return every(1);
  if (/2nd hourly|2 hourly/.test(f)) return every(2);
  if (/3rd hourly|3 hourly/.test(f)) return every(3);
  if (/4th hourly|4 hourly/.test(f)) return every(4);
  if (/6 times/.test(f)) return ["06:00", "09:00", "12:00", "15:00", "18:00", "21:00"];
  if (/5 times/.test(f)) return ["06:00", "10:00", "14:00", "18:00", "22:00"];
  if (/qid|four/.test(f)) return ["06:00", "12:00", "18:00", "22:00"];
  if (/tid|tds|three/.test(f)) return ["08:00", "14:00", "20:00"];
  if (/bd|twice/.test(f)) return ["08:00", "20:00"];
  if (/qhs|bedtime|hs\b/.test(f)) return ["21:00"];
  if (/od|once/.test(f)) return ["08:00"];
  return [];
}

export function defaultTreatment(): TreatmentData { return { v: 2, drugs: [], log: [] }; }

/* ── Nurse notes ───────────────────────────────────────────────────────── */

export interface NurseCheck { label: string; done: boolean; preOp?: boolean; by?: string; at?: string }
export interface NurseData { v: 2; checks: NurseCheck[]; log: LogEntry[] }

export const NURSE_QUICK_NOTES = [
  "Patient comfortable", "No vomiting", "No headache", "No eye pain", "Slept well",
  "Drops instilled as charted", "Diet taken", "Ambulating", "Eye pad / shield intact",
  "Complains of eye pain", "Complains of vomiting", "Complains of headache", "Doctor informed",
];
export const SHIFTS = ["Morning", "Evening", "Night"];

export function defaultNurse(type: string): NurseData {
  const preOp = type === "PRE_OP";
  return {
    v: 2,
    checks: [
      ...(preOp ? [{ label: "OT gown worn", done: false, preOp: true }, { label: "Ornaments removed", done: false, preOp: true }] : []),
      { label: "Passed urine", done: false },
    ],
    log: [],
  };
}

/* ── Draft OT notes ────────────────────────────────────────────────────── */

export interface OtNotesData {
  v: 2;
  surgeon: string; assistant: string; anaesthetist: string; scrubNurse: string;
  anaesthesia: string; eye: string; procedure: string; implant: string;
  steps: string[];
  findings: string;
  complications: string;
  instructions: string;
}

export function defaultOtNotes(c: FormContext, steps: string[]): OtNotesData {
  return {
    v: 2,
    surgeon: c.doctor, assistant: "", anaesthetist: "", scrubNurse: "",
    anaesthesia: c.anaesthesia ?? "", eye: c.eye ?? "", procedure: c.surgery ?? "", implant: c.implant ?? "",
    steps,
    findings: "", complications: "None",
    instructions: "Pad and bandage / shield; start post-op drops as charted; review next morning.",
  };
}

/* ── Draft post-op notes (daily review) ────────────────────────────────── */

export interface PostOpReview {
  id: string; date: string; pod: string;
  vaRe: string; vaLe: string; iopRe: string; iopLe: string;
  lids: string; conjunctiva: string; cornea: string; ac: string; pupil: string; lens: string; fundus: string;
  complaints: string; plan: string;
  by: string;
}
export interface PostOpData { v: 2; reviews: PostOpReview[] }
export const POSTOP_NORMAL = {
  lids: "Normal", conjunctiva: "Mild congestion", cornea: "Clear", ac: "Formed, quiet", pupil: "Round, reactive", lens: "IOL in the bag, centred", fundus: "Normal glow",
};
export const POSTOP_EXAM: { key: keyof typeof POSTOP_NORMAL; label: string }[] = [
  { key: "lids", label: "Lids" }, { key: "conjunctiva", label: "Conjunctiva" }, { key: "cornea", label: "Cornea" },
  { key: "ac", label: "Anterior chamber" }, { key: "pupil", label: "Pupil" }, { key: "lens", label: "Lens / IOL" }, { key: "fundus", label: "Fundus" },
];
export function defaultPostOp(): PostOpData { return { v: 2, reviews: [] }; }

/* ── Doctor's notes ────────────────────────────────────────────────────── */

export const DOCTOR_NOTE_FIELDS = [
  { key: "complaints", label: "Complaints" },
  { key: "va", label: "Vision" },
  { key: "iop", label: "IOP" },
  { key: "findings", label: "Findings" },
  { key: "assessment", label: "Assessment" },
  { key: "plan", label: "Plan / Orders" },
] as const;
export const DOCTOR_NOTE_CHIPS: Record<string, string[]> = {
  complaints: ["No fresh complaints", "Mild pain", "Watering", "Foreign-body sensation", "Headache", "Nausea / vomiting"],
  findings: ["Lids normal", "Conjunctiva mildly congested", "Cornea clear", "AC formed, quiet", "Pupil round, reactive", "IOL in the bag, centred", "Wound well apposed"],
  assessment: ["Satisfactory recovery", "Post-op inflammation", "Raised IOP", "Corneal oedema"],
  plan: ["Continue same treatment", "Taper steroid drops", "Add anti-glaucoma drops", "Fit for discharge", "Review tomorrow"],
};

/** "Label: value" lines, stored as the note text. */
export function composeDoctorNote(v: Record<string, string>): string {
  return DOCTOR_NOTE_FIELDS.map((f) => (v[f.key]?.trim() ? `${f.label}: ${v[f.key].trim()}` : "")).filter(Boolean).join("\n");
}

/** Small helper so every saved shape is recognisable. */
export const isV2 = (x: unknown): boolean => !!x && typeof x === "object" && (x as { v?: unknown }).v === 2;
