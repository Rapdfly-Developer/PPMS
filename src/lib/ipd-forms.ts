// IPD patient-file forms: data shapes, hospital-standard defaults and presets.
// Shared by the server (defaults) and the form screens. No server imports.
import { toDateDay } from "@/lib/ist";
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
  /** Who the consent was explained to, whether they understood (teach-back), and notes. */
  explainedTo?: string;
  teachBack?: boolean;
  notes?: string;
  signedAt?: string;
  recordedBy?: string;
  /** Older entries only. */
  signedBy?: string;
  /** Scanned / photographed signed consent; when present it is shown instead of the wording. */
  signedFile?: { ref: string; name: string; at: string; by?: string };
  /** Unlocked with a password after the signed copy was uploaded (locked again with Lock). */
  frozen?: boolean;
  unfrozen?: { by: string; at: string };
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
      return `Guarded Visual Prognosis: I, ${who}, have been informed that my ${eyeName(c.eye)} has other existing eye or health conditions (such as a retinal, optic nerve, corneal or glaucoma problem, amblyopia, diabetes or high blood pressure) that may limit the vision I gain after ${proc}.

The doctor has explained that my visual prognosis is GUARDED: the improvement in vision may be partial or less than expected, vision may stay the same, and in some cases it may become worse, even when the operation itself goes well. I may still need glasses, further investigations, laser or another surgery, and long-term treatment for the existing condition.

I understand that no assurance about the final visual outcome has been given to me, and I agree to undergo the operation knowing this.`;
    case "Anaesthesia":
      return `I consent to receive ${c.anaesthesia || "the anaesthesia advised"} for my operation. The anaesthesia plan and its alternatives have been explained to me.\n\nI understand the possible risks, including discomfort, bruising around the eye, allergy to medicines, rise in blood pressure, injury to the eye or optic nerve (for injection blocks) and, rarely, effects on breathing or heart that need emergency treatment. I agree to follow the fasting and medicine instructions given to me.`;
    case "Negative":
      return `High-risk / Negative consent: I have been informed of the possible complications of ${proc}, including infection inside the eye (endophthalmitis), bleeding, raised eye pressure, swelling of the cornea or retina, retinal detachment, dislocation of the implant and, rarely, permanent loss of vision or of the eye.\n\nI understand that despite all care these complications can occur, that additional treatment or surgery may be needed, and that no guarantee of the result has been given to me.`;
    default:
      return "";
  }
}

/** Consents saved before the GVP consent became "Guarded Visual Prognosis" get the new title and, if untouched, the new wording. */
export function upgradeConsents<T extends { items?: { id: string; title: string; text: string }[] }>(d: T, c: FormContext): T {
  if (!d.items) return d;
  return {
    ...d,
    items: d.items.map((i) => i.id !== "GVP" ? i : {
      ...i,
      title: i.title === "General & Visual Prognosis (GVP) Consent" ? "Guarded Visual Prognosis (GVP) Consent" : i.title,
      text: i.text.startsWith("General & Visual Prognosis:") ? consentText("GVP", c) : i.text,
    }),
  };
}

export const CONSENT_KINDS = [
  { id: "General", title: "General Consent for Admission & Surgery" },
  { id: "GVP", title: "Guarded Visual Prognosis (GVP) Consent" },
  { id: "Anaesthesia", title: "Consent for Anaesthesia" },
  { id: "Negative", title: "High-risk / Negative Consent" },
];

/** Further consents that can be added from "+ New": title and wording for this patient. */
const MORE_CONSENTS: { id: string; title: string; text: (c: FormContext, proc: string, who: string) => string }[] = [
  {
    id: "PremiumIOL", title: "Consent for Premium IOL (Toric / Multifocal)",
    text: (c, proc, who) => `I, ${who}, have chosen a premium intraocular lens (toric / multifocal / extended depth of focus) for ${proc}.

The doctor has explained that this lens is meant to reduce my dependence on glasses but cannot guarantee freedom from glasses. I may see glare, haloes or rings around lights, especially at night, and contrast may be slightly lower. A toric lens may rotate and need repositioning. The extra cost of the lens has been explained to me.`,
  },
  {
    id: "SecondEye", title: "Consent for Surgery on the Second Eye",
    text: (c, proc, who) => `I, ${who}, consent to ${proc} on my ${eyeName(c.eye)}, my second eye. I understand that the result in my first eye does not guarantee the same result in this eye, and that the risks explained for the first eye apply again.`,
  },
  {
    id: "Tamponade", title: "Consent for Silicone Oil / Gas Tamponade",
    text: (c, proc, who) => `I, ${who}, consent to silicone oil or gas being placed inside my ${eyeName(c.eye)} during ${proc} to support the retina.

I understand that I must keep the head position advised, that I must not travel by air or to high altitude while gas is in the eye, that vision stays poor while oil is in the eye, and that a further operation is usually needed to remove silicone oil. Raised eye pressure, cataract and corneal problems can occur.`,
  },
  {
    id: "Injection", title: "Consent for Intravitreal Injection",
    text: (c, proc, who) => `I, ${who}, consent to an injection of medicine into my ${eyeName(c.eye)} (intravitreal injection) as advised by Dr. ${c.doctor}.

The need for repeated injections, the cost, and the risks, including infection inside the eye (endophthalmitis), raised eye pressure, bleeding, retinal detachment and cataract, have been explained to me. I will report pain, redness or a drop in vision at once.`,
  },
  {
    id: "DonorTissue", title: "Consent for Donor Cornea / Tissue",
    text: (c, proc, who) => `I, ${who}, consent to the use of donor tissue (cornea / amniotic membrane) supplied by an eye bank for ${proc}.

I understand that donor tissue is screened but a very small risk of infection remains, that the graft may be rejected or fail and need further treatment or surgery, and that long-term drops and regular follow-up are needed.`,
  },
  {
    id: "GuardianGA", title: "Consent by Parent / Guardian (General Anaesthesia)",
    text: (c, proc, who) => `I, the parent / guardian of ${who}, consent to ${proc} under general anaesthesia.

The operation, the anaesthesia, the fasting instructions and the risks, including rare reactions to anaesthesia, have been explained to me in a language I understand. I will stay with the child before and after the operation.`,
  },
  {
    id: "MedicalRisk", title: "Consent for Surgery with Medical Risk",
    text: (c, proc, who) => `I, ${who}, understand that my general health condition (such as diabetes, high blood pressure, heart, kidney or lung disease, or blood thinners) increases the risks of ${proc} and of anaesthesia.

I agree to follow my physician's advice, and I accept that the operation may be postponed or stopped if my condition is not safe on the day.`,
  },
  {
    id: "Photo", title: "Consent for Photography & Video",
    text: (c, proc, who) => `I, ${who}, consent to photographs and video recordings of my eye being taken before, during and after ${proc} for my medical record, and for teaching or publication without showing my identity. I may withdraw this consent at any time.`,
  },
  {
    id: "HighRiskRefusal", title: "Refusal / Against Medical Advice",
    text: (c, proc, who) => `I, ${who}, have been advised ${proc} by Dr. ${c.doctor}. The reasons, benefits and the risks of not having it have been explained to me. I have decided not to undergo it at present, against medical advice, and I take responsibility for this decision.`,
  },
];

/** Every prebuilt consent with wording for this patient: the standard four, then the rest. */
export function prebuiltConsents(c: FormContext): { id: string; title: string; text: string }[] {
  const proc = [c.eye, c.surgery].filter(Boolean).join(" ") || "the advised procedure";
  const who = `${c.patientName} (${c.age} yrs, ${c.sex.toLowerCase()}, ID ${c.patientId})`;
  return [
    ...CONSENT_KINDS.map((k) => ({ id: k.id, title: k.title, text: consentText(k.id, c) })),
    ...MORE_CONSENTS.map((k) => ({ id: k.id, title: k.title, text: k.text(c, proc, who) })),
  ];
}

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

/** Pre-op education: what to do before the operation (common points, then the surgery's own). */
const PRE_COMMON = [
  "Bring all your medicines, reports and spectacles on the day of admission",
  "Take a head bath the day before surgery; do not apply oil, kajal or make-up",
  "Continue BP and diabetes medicines unless the doctor says otherwise",
  "Tell the doctor if you take blood thinners (aspirin, clopidogrel, warfarin); stop them only if advised",
  "Come with one attendant; wear loose, comfortable clothes and no jewellery",
];
const EDU_PRE_POINTS: Record<string, string[]> = {
  cataract: [...PRE_COMMON, "Start the antibiotic eye drops as advised before surgery", "A light breakfast is allowed for surgery under local anaesthesia"],
  glaucoma: [...PRE_COMMON, "Continue your glaucoma drops until the day of surgery unless told otherwise", "Inform the doctor if you are on Diamox (acetazolamide) tablets"],
  retina: [...PRE_COMMON, "Practise the head position that may be needed after surgery", "Plan for someone to help at home while you keep the head position"],
  cornea: [...PRE_COMMON, "The surgery date depends on donor tissue; keep your phone reachable", "Start the drops as advised before surgery"],
  pterygium: [...PRE_COMMON, "Start the drops as advised before surgery"],
  lacrimal: [...PRE_COMMON, "Do not take aspirin or painkillers that thin the blood unless advised", "Tell the doctor about any nose block, cold or sinus problem"],
  lid: [...PRE_COMMON, "Do not take aspirin or blood thinners unless advised"],
  squint: [...PRE_COMMON, "Nil by mouth for 6 hours before surgery if under general anaesthesia", "Bring your glasses for the review"],
  socket: [...PRE_COMMON, "Nil by mouth for 6 hours before surgery if under general anaesthesia", "The artificial eye is fitted a few weeks after surgery"],
  icl: [...PRE_COMMON, "Stop soft contact lenses 1 week (hard lenses 3 weeks) before the measurements and surgery"],
  general: [...PRE_COMMON, "Follow the fasting instructions given by the anaesthetist"],
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

export type EduStageKey = "pre" | "post";

/** Points that belong to one surgery, added to its group's points, so every surgery's set is its own. */
const SURGERY_EDU: Record<string, { pre: string[]; post: string[] }> = {
  "Phacoemulsification with IOL": {
    pre: ["The cataract is removed through a tiny cut under drops or a block; usually no stitches are needed", "Tell us if you wore contact lenses in the last 2 weeks; the lens power is measured from your eye"],
    post: ["Vision usually clears in a few days; new glasses are checked after 4 weeks", "Mild grittiness and watering for a few days are normal"],
  },
  "Manual Small Incision Cataract Surgery (MSICS) with IOL": {
    pre: ["The surgery is done under a block injection; you stay awake but the eye will not move", "Arrange someone to take you home; you cannot drive on the day"],
    post: ["Vision improves over 1-2 weeks; a little astigmatism may need glasses", "Do not lift more than 5 kg for 4 weeks; the cut is larger than in phaco"],
  },
  "Extracapsular Cataract Extraction (ECCE) with IOL": {
    pre: ["The surgery needs a larger opening and stitches; recovery is longer than phaco", "Stop aspirin only if your doctor or physician advises"],
    post: ["Stitches may be removed or adjusted at follow-up to reduce astigmatism", "Avoid any pressure on the eye for 6 weeks; wear the shield at night"],
  },
  "Phacoemulsification with Toric IOL": {
    pre: ["The eye is marked before surgery to line up the toric lens; keep your head still during marking", "Stop soft contact lenses 1 week before the measurements"],
    post: ["Do not rub the eye; rubbing can turn the toric lens", "Tell us if vision looks tilted or blurred; the lens position will be checked"],
  },
  "Phacoemulsification with Multifocal IOL": {
    pre: ["A multifocal lens gives distance and near vision; some people see rings (haloes) around lights at night", "Glasses may still be needed for some fine work"],
    post: ["Haloes and glare at night settle over weeks to months as the brain adapts", "Avoid night driving until the doctor says your vision is ready"],
  },
  "Secondary IOL Implantation": {
    pre: ["A lens is placed in an eye that has none; it may be fixed with stitches or glue", "Bring your present glasses (aphakic glasses) on the day"],
    post: ["Vision settles over 2-4 weeks; new glasses are given after that", "Avoid bending and heavy lifting for 4 weeks so the lens stays centred"],
  },
  "Trabeculectomy with MMC": {
    pre: ["Tell the doctor if you have had eye surgery before", "A new drainage opening (bleb) is made under the upper lid to lower eye pressure"],
    post: ["Stop glaucoma drops in the operated eye only as told; continue them in the other eye", "Do eye massage only if it is taught to you", "Avoid swimming and dusty places for 1 month; the bleb can get infected"],
  },
  "Combined Phaco-Trabeculectomy": {
    pre: ["The cataract and the pressure surgery are done together in one sitting"],
    post: ["Frequent visits are needed in the first month to check eye pressure", "Vision and eye pressure both take a few weeks to settle"],
  },
  "Glaucoma Drainage Device (Ahmed Valve) Implantation": {
    pre: ["A small tube and plate (valve) will be placed to drain fluid from the eye"],
    post: ["Eye pressure can be low or high in the first weeks; keep every visit", "Report at once if the tube area becomes red or the tube shows"],
  },
  "Pars Plana Vitrectomy (PPV)": {
    pre: ["The jelly inside the eye is removed; the surgery may take 1-2 hours", "Tell the doctor about any planned air travel"],
    post: ["Vision stays blurred for some weeks while the eye heals", "Keep the head position if a gas bubble was used"],
  },
  "PPV with Silicone Oil Injection": {
    pre: ["Silicone oil will hold the retina in place; a second surgery to remove it is usually needed after 3-6 months", "Plan for face-down or side positioning at home"],
    post: ["Keep the advised head position (often face-down) for the days told", "Vision is poor while the oil is in the eye; glasses are changed after oil removal", "Keep the oil-removal appointment; the oil should not stay too long"],
  },
  "PPV with Endolaser": {
    pre: ["Laser will be applied inside the eye during the surgery", "Keep blood sugar and blood pressure well controlled before surgery"],
    post: ["Keep blood sugar and blood pressure under control to protect the retina", "Some dimness of side vision after laser is expected"],
  },
  "Silicone Oil Removal": {
    pre: ["This surgery takes out the silicone oil placed earlier", "Bring your previous surgery notes"],
    post: ["Vision may change after the oil is removed; new glasses after 4 weeks", "Report a curtain or shadow in vision at once; the retina is checked again"],
  },
  "Scleral Buckling": {
    pre: ["A silicone band is stitched on the outside of the eye and stays there", "Avoid heavy exertion before surgery if the retina is detached"],
    post: ["Pain, swelling and redness are more than other eye surgeries for 1-2 weeks; take painkillers as charted", "Your spectacle power may change; new glasses after 6 weeks"],
  },
  "Penetrating Keratoplasty (PK)": {
    pre: ["A donor cornea replaces your cornea; the date may move if tissue is not available"],
    post: ["Stitches stay for months; never rub the eye and report a loose stitch", "Steroid drops are used for a long time; never stop them on your own"],
  },
  "DSAEK / DMEK": {
    pre: ["Only the inner layer of the cornea is replaced; an air bubble holds it in place", "Practise lying flat on your back"],
    post: ["Lie flat on your back (face up) as advised, usually for 1-2 days", "Do not fly or go to high altitude until the air bubble is gone"],
  },
  "Pterygium Excision with Conjunctival Autograft": {
    pre: ["The growth is removed and covered with a thin graft from your own eye", "Wear sunglasses from now; sun and dust make it grow"],
    post: ["Do not rub the eye; the graft can move"],
  },
  "Dacryocystorhinostomy (DCR)": {
    pre: ["A new tear passage is made into the nose", "Tell the doctor about any nose bleeding problem"],
    post: ["Watering may continue for a few weeks until the passage heals", "A syringing test is done at follow-up to check the passage"],
  },
  "Ptosis Correction": {
    pre: ["The lid is lifted; the height may be checked while you are awake", "Bring old photographs if you have them"],
    post: ["The eye may not close fully for some days; use the lubricant ointment at night as charted", "Do not rub or pull the lid"],
  },
  "Strabismus Surgery": {
    pre: ["The eye muscles are adjusted; one or both eyes may be operated", "Children are usually operated under general anaesthesia"],
    post: ["Continue patching or eye exercises as advised", "The eye may look red for 2-3 weeks"],
  },
  "Evisceration with Orbital Implant": {
    pre: ["The inside of the eye is removed and an implant placed; the white of the eye stays", "Counselling about the artificial eye is available"],
    post: ["Keep the clear shell (conformer) in place; do not remove it"],
  },
  "Enucleation with Orbital Implant": {
    pre: ["The whole eye is removed and an implant placed in the socket", "Arrange someone to help at home for the first few days"],
    post: ["Keep the clear shell (conformer) in place; do not remove it", "Report fever or a bad smell from the socket"],
  },
  "Implantable Collamer Lens (ICL)": {
    pre: ["A small laser opening (PI) may be done before the surgery"],
    post: ["Haloes at night are common in the first weeks", "Keep the eye pressure check on the day after surgery"],
  },
};

/** One built-in set per surgery in the surgery list, plus medical treatment (post-op education). */
export const BUILTIN_EDUCATION_SETS: EducationSet[] = [
  ...SURGERY_OPTIONS.map((s) => ({ id: `s:${s}`, label: s, points: [...(SURGERY_EDU[s]?.post ?? []), ...EDU_POINTS[categoryOf(s)]] })),
  { id: "s:medical", label: MEDICAL_SET_LABEL, points: EDU_POINTS.general },
];

/** The same, for pre-op education. */
export const BUILTIN_PRE_EDUCATION_SETS: EducationSet[] = [
  ...SURGERY_OPTIONS.map((s) => ({ id: `p:${s}`, label: s, points: [...(SURGERY_EDU[s]?.pre ?? []), ...EDU_PRE_POINTS[categoryOf(s)]] })),
  { id: "p:medical", label: MEDICAL_SET_LABEL, points: EDU_PRE_POINTS.general },
];

export const builtinEducationSets = (stage: EduStageKey) => (stage === "pre" ? BUILTIN_PRE_EDUCATION_SETS : BUILTIN_EDUCATION_SETS);

/** The set that matches the patient's surgery (any surgery name, even one not in the list). */
export function educationSetFor(surgery?: string | null, type?: string, stage: EduStageKey = "post"): EducationSet {
  const sets = builtinEducationSets(stage);
  const exact = sets.find((x) => x.label.toLowerCase() === (surgery ?? "").trim().toLowerCase());
  if (exact) return exact;
  const pts = stage === "pre" ? EDU_PRE_POINTS : EDU_POINTS;
  if (surgery?.trim()) return { id: `${stage === "pre" ? "p" : "s"}:${surgery.trim()}`, label: surgery.trim(), points: pts[categoryOf(surgery)] };
  return type === "PRE_OP" ? sets[0] : sets[sets.length - 1];
}

/** Prebuilt variants of a surgery's set, for the patient in front of you. */
const VARIANT_POINTS: Record<string, { pre: string[]; post: string[] }> = {
  "Diabetic patient": {
    pre: [
      "Check your blood sugar on the morning of surgery and bring the readings",
      "Ask the doctor whether to take your insulin / diabetes tablets on the morning of surgery",
      "Do not skip meals while on diabetes medicines; carry a biscuit or sweet in case sugar drops",
    ],
    post: [
      "Keep blood sugar well controlled; high sugar slows healing and raises the risk of infection",
      "Check sugar more often while using steroid eye drops",
      "Report redness, pain or a drop in vision early; infections can be faster with diabetes",
    ],
  },
  "Elderly patient": {
    pre: [
      "Come with a family member who can help with the drops at home",
      "Bring a written list of every medicine you take",
      "Use your walking aid; the eye may be covered after surgery",
    ],
    post: [
      "A family member should put the drops; keep a written drop chart with times",
      "Move carefully; with one eye covered, balance is harder; do not use stairs alone on the first day",
      "Keep a light on at night to avoid falls",
    ],
  },
  "Child": {
    pre: [
      "No food for 6 hours and clear water only until 2 hours before surgery (general anaesthesia)",
      "Bring a favourite toy or blanket for comfort",
      "Tell the doctor about any cough, cold or fever before the surgery day",
    ],
    post: [
      "Keep the child from rubbing the eye; arm guards may be used at night",
      "Give drops while the child is lying down; a parent should hold the head gently",
      "No swimming, sand play or contact games until the doctor allows",
    ],
  },
};

/**
 * Every prebuilt set for a surgery: the standard set, a brief one (the key
 * points only) and versions for a diabetic patient, an elderly patient and a
 * child. The standard set's label is the surgery itself.
 */
export function educationSetsFor(surgery: string | null | undefined, type: string | undefined, stage: EduStageKey): EducationSet[] {
  const base = educationSetFor(surgery, type, stage);
  const name = base.label;
  return [
    base,
    { id: `${base.id}:brief`, label: `${name} · Brief`, points: base.points.slice(0, 5) },
    ...Object.entries(VARIANT_POINTS).map(([k, v]) => ({ id: `${base.id}:${k}`, label: `${name} · ${k}`, points: [...base.points, ...v[stage]] })),
  ];
}

export const DIET_TYPES = ["Normal", "Diabetic", "Soft", "Liquid", "Low salt", "Nil by mouth"];
export const MEAL_AMOUNTS = ["Full", "Half", "Refused"] as const;

export interface Meal { meal: string; time: string; diet: string }
export interface EduPoint { text: string; done: boolean }
/** A further patient education added to the sheet (its own title and points). */
export interface EduSet { id: string; title: string; points: EduPoint[] }
/** A medicine in the EMR prescription format. */
export interface EduMed {
  id: string; route: string; eye: string; name: string; dose: string; frequency: string; duration: string; instructions: string;
  /** Explained to the patient (ticked like the points). */
  done?: boolean;
}
/** Education and diet for one stage (pre-op or post-op). */
export interface EducationStage {
  preset: string;
  points: EduPoint[];
  sets?: EduSet[];
  meds?: EduMed[];
  explainedTo: string;
  language: string;
  teachBack: boolean;
  notes: string;
  dietTypes: string[];
  nbmFrom: string;
  meals: Meal[];
  /** How many days the diet is followed: before surgery (pre-op) or from the day of surgery (post-op). */
  dietDays?: string;
  /** A note under the diet (keywords or typed). */
  dietNote?: string;
  /** A different meal plan for particular days of the diet window, keyed by IST date (YYYY-MM-DD); other days use `meals`. */
  dietByDate?: Record<string, Meal[]>;
}
/**
 * The top-level fields are the post-op stage (what older sheets held and what
 * the discharge summary uses); `pre` is the pre-op stage.
 */
export interface EducationData extends EducationStage {
  v: 2;
  pre?: EducationStage;
  log: LogEntry[];
}

/** One-line medicine, as printed. */
export const eduMedText = (m: EduMed) =>
  [m.eye && m.route !== "Oral" ? m.eye : "", m.name, m.dose, m.frequency, m.duration && `for ${m.duration}`, m.instructions].filter(Boolean).join(" · ");

export const DEFAULT_MEALS: Meal[] = [
  { meal: "Early morning", time: "06:00", diet: "Tea / coffee / milk" },
  { meal: "Breakfast", time: "08:00", diet: "" },
  { meal: "Mid-morning", time: "11:00", diet: "Fruit / juice" },
  { meal: "Lunch", time: "13:00", diet: "" },
  { meal: "Evening", time: "16:30", diet: "Tea / biscuits" },
  { meal: "Dinner", time: "20:00", diet: "" },
];

type DietPlan = Pick<EducationStage, "dietTypes" | "nbmFrom" | "dietDays"> & { meals: [string, string][] };
const meals = (m: [string, string][]): Meal[] => DEFAULT_MEALS.map((x) => ({ ...x, diet: m.find(([k]) => k === x.meal)?.[1] ?? x.diet }));

/** The diet a surgery starts with, before and after the operation (by its kind of surgery and anaesthesia). */
const SURGERY_DIET: Record<string, { pre: DietPlan; post: DietPlan }> = {
  // Local / topical anaesthesia: a light meal is allowed
  cataract: {
    pre: { dietTypes: ["Normal"], nbmFrom: "", dietDays: "1", meals: [["Breakfast", "Light breakfast: idli / upma"], ["Lunch", "Rice, dal, vegetables"], ["Dinner", "Chapati, vegetables"]] },
    post: { dietTypes: ["Normal"], nbmFrom: "", dietDays: "7", meals: [["Breakfast", "Idli, sambar"], ["Lunch", "Rice, dal, vegetables, curd"], ["Dinner", "Chapati, dal"]] },
  },
  icl: {
    pre: { dietTypes: ["Normal"], nbmFrom: "", dietDays: "1", meals: [["Breakfast", "Light breakfast"], ["Lunch", "Rice, dal, vegetables"], ["Dinner", "Chapati, vegetables"]] },
    post: { dietTypes: ["Normal"], nbmFrom: "", dietDays: "7", meals: [["Breakfast", "Idli, sambar"], ["Lunch", "Rice, dal, vegetables"], ["Dinner", "Chapati, dal"]] },
  },
  pterygium: {
    pre: { dietTypes: ["Normal"], nbmFrom: "", dietDays: "1", meals: [["Breakfast", "Light breakfast"], ["Lunch", "Rice, dal, vegetables"], ["Dinner", "Chapati, vegetables"]] },
    post: { dietTypes: ["Normal"], nbmFrom: "", dietDays: "7", meals: [["Breakfast", "Idli, sambar"], ["Lunch", "Rice, dal, vegetables"], ["Dinner", "Chapati, dal"]] },
  },
  // Glaucoma: water in small amounts through the day, little salt
  glaucoma: {
    pre: { dietTypes: ["Normal", "Low salt"], nbmFrom: "", dietDays: "2", meals: [["Early morning", "Tea / milk (small cup)"], ["Breakfast", "Light breakfast"], ["Lunch", "Rice, dal, vegetables, less salt"], ["Dinner", "Chapati, vegetables"]] },
    post: { dietTypes: ["Normal", "Low salt"], nbmFrom: "", dietDays: "14", meals: [["Early morning", "Small cup of tea / milk; drink water a little at a time"], ["Lunch", "Rice, dal, vegetables, less salt"], ["Dinner", "Chapati, vegetables"]] },
  },
  // Retina: longer surgery; soft food while keeping the head position
  retina: {
    pre: { dietTypes: ["Normal", "Diabetic"], nbmFrom: "", dietDays: "3", meals: [["Breakfast", "Light breakfast"], ["Lunch", "Rice, dal, green vegetables"], ["Dinner", "Chapati, vegetables"]] },
    post: { dietTypes: ["Soft"], nbmFrom: "", dietDays: "14", meals: [["Breakfast", "Idli / upma (eat while keeping the head position)"], ["Mid-morning", "Fruit / juice"], ["Lunch", "Soft rice, dal, vegetables"], ["Dinner", "Soft chapati, dal"]] },
  },
  // Cornea: protein for healing
  cornea: {
    pre: { dietTypes: ["Normal"], nbmFrom: "", dietDays: "2", meals: [["Breakfast", "Light breakfast"], ["Lunch", "Rice, dal, vegetables"], ["Dinner", "Chapati, vegetables"]] },
    post: { dietTypes: ["Normal"], nbmFrom: "", dietDays: "14", meals: [["Breakfast", "Idli, sambar, egg / sprouts"], ["Lunch", "Rice, dal, vegetables, curd"], ["Evening", "Milk, fruit"], ["Dinner", "Chapati, dal / paneer"]] },
  },
  // Usually general anaesthesia: nil by mouth before, liquids then soft after
  lacrimal: {
    pre: { dietTypes: ["Nil by mouth"], nbmFrom: "22:00", dietDays: "1", meals: [] },
    post: { dietTypes: ["Soft"], nbmFrom: "", dietDays: "7", meals: [["Breakfast", "Idli, sambar (not hot)"], ["Lunch", "Soft rice, dal"], ["Dinner", "Soft chapati, dal"]] },
  },
  lid: {
    pre: { dietTypes: ["Normal"], nbmFrom: "", dietDays: "1", meals: [["Breakfast", "Light breakfast"], ["Lunch", "Rice, dal, vegetables"], ["Dinner", "Chapati, vegetables"]] },
    post: { dietTypes: ["Normal"], nbmFrom: "", dietDays: "7", meals: [["Breakfast", "Idli, sambar"], ["Lunch", "Rice, dal, vegetables"], ["Dinner", "Chapati, dal"]] },
  },
  squint: {
    pre: { dietTypes: ["Nil by mouth"], nbmFrom: "22:00", dietDays: "1", meals: [] },
    post: { dietTypes: ["Liquid", "Soft"], nbmFrom: "", dietDays: "3", meals: [["Breakfast", "Milk / porridge once fully awake"], ["Lunch", "Soft rice, dal"], ["Dinner", "Soft chapati, dal"]] },
  },
  socket: {
    pre: { dietTypes: ["Nil by mouth"], nbmFrom: "22:00", dietDays: "1", meals: [] },
    post: { dietTypes: ["Liquid", "Soft"], nbmFrom: "", dietDays: "5", meals: [["Breakfast", "Milk / porridge"], ["Lunch", "Soft rice, dal"], ["Dinner", "Soft chapati, dal"]] },
  },
  general: {
    pre: { dietTypes: ["Normal"], nbmFrom: "", dietDays: "1", meals: [] },
    post: { dietTypes: ["Normal"], nbmFrom: "", dietDays: "7", meals: [] },
  },
};

/** The pre-op or post-op diet for a surgery. */
export function dietFor(surgery: string | null | undefined, stage: EduStageKey): Pick<EducationStage, "dietTypes" | "nbmFrom" | "meals" | "dietDays"> {
  const plan = (SURGERY_DIET[categoryOf(surgery)] ?? SURGERY_DIET.general)[stage];
  return { dietTypes: [...plan.dietTypes], nbmFrom: plan.nbmFrom, dietDays: plan.dietDays, meals: meals(plan.meals) };
}

export function defaultEducationStage(c: Pick<FormContext, "surgery" | "type">, stage: EduStageKey): EducationStage {
  const set = educationSetFor(c.surgery, c.type, stage);
  return {
    preset: set.label,
    points: set.points.map((text) => ({ text, done: false })),
    sets: [], meds: [],
    explainedTo: "", language: "English", teachBack: false, notes: "",
    ...dietFor(c.surgery, stage),
  };
}

export function defaultEducation(c: Pick<FormContext, "surgery" | "type">): EducationData {
  return { v: 2, ...defaultEducationStage(c, "post"), pre: defaultEducationStage(c, "pre"), log: [] };
}

/** A stage of the sheet; older sheets have no pre-op stage yet, so it starts from the standard set. */
export function educationStage(e: EducationData, stage: EduStageKey, c: Pick<FormContext, "surgery" | "type">): EducationStage {
  return foldSets(stage === "pre" ? e.pre ?? defaultEducationStage(c, "pre") : postStage(e));
}

/** One set per stage: points from education added as further sets (older sheets) join the set's points. */
function foldSets(s: EducationStage): EducationStage {
  if (!s.sets?.length) return s;
  const seen = new Set(s.points.map((p) => p.text));
  const extra = s.sets.flatMap((x) => x.points).filter((p) => !seen.has(p.text) && (seen.add(p.text), true));
  return { ...s, points: [...s.points, ...extra], sets: [] };
}

/** The post-op stage: the sheet's top-level fields. */
export const postStage = (e: EducationStage): EducationStage => ({
  preset: e.preset, points: e.points, sets: e.sets, meds: e.meds,
  explainedTo: e.explainedTo, language: e.language, teachBack: e.teachBack, notes: e.notes,
  dietTypes: e.dietTypes, nbmFrom: e.nbmFrom, meals: e.meals, dietDays: e.dietDays, dietNote: e.dietNote, dietByDate: e.dietByDate,
});

const DAY_MS = 24 * 3600 * 1000;
/** Date and day in IST, e.g. "14 Nov 2026, Mon" (no year: "14 Nov, Mon"). */
export function dayDate(d: Date | string, year = true): string {
  const x = typeof d === "string" ? new Date(d.length === 10 ? `${d}T00:00:00+05:30` : d) : d;
  return toDateDay(x, "en-GB", { weekday: "short", day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}), timeZone: "Asia/Kolkata" });
}

/**
 * When a stage's diet is followed: pre-op, the N days before the surgery day up to and including it;
 * post-op, N days starting on the surgery day. Null without a surgery date or days.
 */
export function dietWindow(stage: EduStageKey, days: string | undefined, surgeryDate: string | null): { from: Date; to: Date; surgery: Date } | null {
  const n = Number(days);
  if (!surgeryDate || !Number.isInteger(n) || n < 1) return null;
  const surgery = new Date(surgeryDate.length === 10 ? `${surgeryDate}T00:00:00+05:30` : surgeryDate);
  if (isNaN(surgery.getTime())) return null;
  return stage === "pre"
    ? { from: new Date(surgery.getTime() - n * DAY_MS), to: surgery, surgery }
    : { from: surgery, to: new Date(surgery.getTime() + (n - 1) * DAY_MS), surgery };
}

/** The IST calendar day (YYYY-MM-DD) of an instant. */
export const istKey = (d: Date): string => new Date(d.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

/** Every day of the diet window, as IST dates (empty without a surgery date or days). */
export function dietDateKeys(stage: EduStageKey, days: string | undefined, surgeryDate: string | null): string[] {
  const w = dietWindow(stage, days, surgeryDate);
  if (!w) return [];
  const keys: string[] = [];
  for (let t = w.from.getTime(); t <= w.to.getTime() + 1000 && keys.length < 120; t += DAY_MS) keys.push(istKey(new Date(t)));
  return keys;
}

/** The meal plan of one day: its own plan when set, else the stage's standard one. */
export const mealsOn = (s: EducationStage, key: string | null | undefined): Meal[] => (key && s.dietByDate?.[key]) || s.meals;

export interface DietMatrix {
  cols: { key: string; label: string; surgery: boolean }[];
  rows: { meal: string; cells: ({ time: string; diet: string } | null)[] }[];
}
/** Meals (rows) by dates (columns): the whole diet at a glance. One plain column without dates. */
export function dietMatrix(s: EducationStage, stage: EduStageKey, surgeryDate: string | null, merge = true): DietMatrix {
  const keys = dietDateKeys(stage, s.dietDays, surgeryDate);
  const surgeryKey = keys.length && surgeryDate ? istKey(new Date(surgeryDate.length === 10 ? `${surgeryDate}T00:00:00+05:30` : surgeryDate)) : "";
  // Days with the same plan run together as one column ("14 Nov, Sat to 22 Nov, Sun"); the surgery day stays its own
  const sig = (k: string) => JSON.stringify(mealsOn(s, k).filter((m) => m.meal.trim() && m.diet.trim()).map((m) => [m.meal.trim(), m.time, m.diet.trim()]));
  const groups: string[][] = [];
  for (const k of keys) {
    const last = groups[groups.length - 1];
    if (merge && last && k !== surgeryKey && last[0] !== surgeryKey && sig(last[0]) === sig(k)) last.push(k);
    else groups.push([k]);
  }
  const cols = groups.length
    ? groups.map((g) => ({ key: g[0], label: g.length > 1 ? `${dayDate(g[0], false)} to ${dayDate(g[g.length - 1], false)}` : dayDate(g[0], false), surgery: g.includes(surgeryKey) }))
    : [{ key: "", label: "Plan", surgery: false }];
  const plans = cols.map((col) => mealsOn(s, col.key));
  const names: string[] = [];
  for (const p of plans) for (const m of p) { const n = m.meal.trim(); if (n && m.diet.trim() && !names.includes(n)) names.push(n); }
  return {
    cols,
    rows: names.map((meal) => ({
      meal,
      cells: plans.map((p) => { const m = p.find((x) => x.meal.trim() === meal); return m && m.diet.trim() ? { time: m.time, diet: m.diet } : null; }),
    })),
  };
}

/** "5 days", "2 weeks", "1 month" → days; null when it can't be read (e.g. "Long-term"). */
export function durationDays(d: string | undefined): number | null {
  const m = (d ?? "").trim().match(/^(\d+)\s*(day|week|month|year)s?$/i);
  if (!m) return null;
  const n = Number(m[1]);
  return n * ({ day: 1, week: 7, month: 30, year: 365 } as Record<string, number>)[m[2].toLowerCase()];
}

/**
 * The dates a medicine on the education sheet is used: pre-op, the days just
 * before the surgery day; post-op, from the surgery day. "" without a date.
 */
export function medDates(stage: EduStageKey, duration: string | undefined, surgeryDate: string | null): string {
  const n = durationDays(duration);
  if (!n) return "";
  const w = dietWindow(stage, String(n), surgeryDate);
  return w ? `${dayDate(w.from, false)} → ${dayDate(w.to)}` : "";
}

/**
 * The dates for a duration written inside a point ("Use the drops for 2 weeks"):
 * pre-op, the days up to the surgery day; post-op, from the surgery day.
 * "" when the point names no duration or there is no surgery date.
 */
export function pointDates(stage: EduStageKey, text: string, surgeryDate: string | null): string {
  const m = text.match(/\b(\d+)\s*(day|week|month|year)s?\b/i);
  return m ? medDates(stage, `${m[1]} ${m[2].toLowerCase()}s`, surgeryDate) : "";
}

/** The point with its dates in brackets right after the duration: "Do not apply oil for 2 weeks (29 Oct, Thu to 12 Nov 2026, Thu)". */
export function pointWithDates(stage: EduStageKey, text: string, surgeryDate: string | null): string {
  const m = text.match(/(d+)s*(day|week|month|year)s?/i);
  const d = pointDates(stage, text, surgeryDate);
  if (!m || m.index === undefined || !d) return text;
  const at = m.index + m[0].length;
  return `${text.slice(0, at)} (${d})${text.slice(at)}`;
}

/** The diet window as one sentence, for prints and summaries. */
export function dietStory(stage: EduStageKey, days: string | undefined, surgeryDate: string | null): string {
  const n = Number(days);
  if (!Number.isInteger(n) || n < 1) return "";
  const w = dietWindow(stage, days, surgeryDate);
  const dd = `${n} day${n > 1 ? "s" : ""}`;
  if (!w) return stage === "pre" ? `Follow this diet for ${dd} before the surgery.` : `Follow this diet for ${dd} from the day of surgery.`;
  return stage === "pre"
    ? `From ${dayDate(w.from, false)} to ${dayDate(w.to)}, the surgery day (${dd} before surgery).`
    : `From the surgery day, ${dayDate(w.from, false)}, to ${dayDate(w.to)} (${dd}).`;
}

/** A saved sheet with both stages (older sheets get the standard pre-op stage). */
export function completeEducation(e: EducationData, c: Pick<FormContext, "surgery" | "type">): EducationData {
  const pre = e.pre ? forSurgery(e.pre, c, "pre") : defaultEducationStage(c, "pre");
  const post = forSurgery(postStage(e), c, "post");
  return { ...e, ...post, pre };
}

/**
 * A stage that still holds another surgery's standard set (none of it
 * explained yet) starts again from this surgery's set and diet; the doctor's
 * own sets and anything already explained are kept.
 */
function forSurgery(s: EducationStage, c: Pick<FormContext, "surgery" | "type">, stage: EduStageKey): EducationStage {
  if (!c.surgery) return s;
  const own = educationSetFor(c.surgery, c.type, stage);
  const other = builtinEducationSets(stage).some((x) => x.label === s.preset) && s.preset !== own.label;
  // The diet is untouched (the old plain default): give it the surgery's diet
  const plainDiet = !s.dietDays && s.dietTypes.join() === "Normal" && !s.nbmFrom
    && JSON.stringify(s.meals) === JSON.stringify(DEFAULT_MEALS);
  let next = s;
  if (other && !s.points.some((p) => p.done)) next = { ...next, preset: own.label, points: own.points.map((text) => ({ text, done: false })), sets: [] };
  if (plainDiet) next = { ...next, ...dietFor(c.surgery, stage) };
  return next;
}

/** Every point of a stage: its main set, then the education added to it. */
export const stagePoints = (s: EducationStage): EduPoint[] => [...s.points, ...(s.sets ?? []).flatMap((x) => x.points)];

/** Plain-text advice for the discharge summary (post-op education). */
export function educationAdvice(e: EducationData): string {
  const pts = stagePoints(e).map((p) => `• ${p.text}`);
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

/** The EMR prescription as the treatment chart's first set of orders. */
export function emrMedsToOrders(
  meds: { id: string; drugName: string; dosage?: string | null; frequency?: string | null; duration?: string | null; instructions?: string | null; route?: string | null; laterality?: string | null }[],
  admittedOn: Date,
): DrugOrder[] {
  const start = new Date(admittedOn.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  return meds.filter((m) => m.drugName.trim()).map((m) => ({
    id: `emr-${m.id}`, name: m.drugName.trim(), dose: m.dosage ?? "", route: m.route || "Topical", eye: m.laterality ?? "", frequency: m.frequency ?? "",
    start, orderedBy: "EMR prescription",
    instructions: [m.duration && `For ${m.duration}`, m.instructions].filter(Boolean).join(". "), stopped: false,
  }));
}

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
/** A saved nurse note: vitals and nursing note taken together, with who and when. */
export interface NurseEntry {
  id: string; at: string; by: string; editedAt?: string;
  vitals: Record<string, string>; shift: string; ordersFollowed: string; note: string;
}
export interface NurseData { v: 2; checks: NurseCheck[]; log: LogEntry[]; entries?: NurseEntry[] }

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
    entries: [],
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
  at?: string; editedAt?: string;
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
