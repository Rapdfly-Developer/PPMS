/* ── Structured HPI ──────────────────────────────────────────────────────────
   The General tab's HPI card offers dropdowns for each category; "Generate HPI"
   turns the selections plus the visit's patient data and chief complaints into
   the formatted write-up stored in GeneralExamination.hpi. The selections are
   kept (JSON) in GeneralExamination.hpiFields so they reload with the visit. */

import { parseComplaintItems } from "./appointment-cc";

export type HpiFieldDef = { key: string; label: string; options: readonly string[]; multi?: boolean };
export type HpiGroup = { id: string; label: string; fields: HpiFieldDef[] };

/** Saved selections: key → one value (single) or several (multi). */
export type HpiFields = Record<string, string | string[]>;

export const HPI_GROUPS: HpiGroup[] = [
  {
    id: "condition", label: "Pt Condition",
    fields: [
      { key: "condition", label: "Condition", options: ["Apparently asymptomatic", "Known case on follow-up", "Under treatment elsewhere", "Recurrent episode"] },
    ],
  },
  {
    id: "onset", label: "Onset",
    fields: [
      { key: "onset", label: "Onset", options: ["Sudden", "Insidious", "Gradual"] },
      { key: "course", label: "Course", options: ["Progressive", "Stationary", "Fluctuating", "Recurrent"] },
    ],
  },
  {
    id: "duration", label: "Duration",
    fields: [
      { key: "durationNum", label: "Duration", options: Array.from({ length: 30 }, (_, i) => String(i + 1)) },
      { key: "durationUnit", label: "Unit", options: ["days", "weeks", "months", "years"] },
    ],
  },
];

/** "Character" opens these sub-groups; only the filled ones reach the text. */
export const HPI_CHARACTER_GROUPS: HpiGroup[] = [
  {
    id: "vision", label: "Vision",
    fields: [
      { key: "visAffects", label: "Affects", options: ["Distance", "Near", "Both distance and near"] },
      { key: "visPain", label: "Pain", options: ["Painful", "Painless"] },
      { key: "visField", label: "Field", multi: true, options: ["Central scotoma", "Peripheral field defect", "Generalized blur"] },
      { key: "visAssoc", label: "Associated with", multi: true, options: ["Metamorphopsia", "Micropsia", "Coloured halos around lights", "Glare", "Uniocular diplopia", "None"] },
      { key: "visDiurnal", label: "Worse during", options: ["Daytime (Hemeralopia)", "Nighttime or dim light (Nyctalopia)", "No diurnal variation"] },
    ],
  },
  {
    id: "posterior", label: "Posterior Segment",
    fields: [
      { key: "floaters", label: "Floaters", options: ["Present", "Absent"] },
      { key: "floaterType", label: "Floater type", multi: true, options: ["Mobile dots", "Cobwebs", "Sudden shower of black spots"] },
      { key: "photopsia", label: "Photopsia", multi: true, options: ["Temporal flashes", "Arcs of light"] },
      { key: "shadow", label: "Field shadow", options: ["Curtain-like shadow", "Veil"] },
    ],
  },
  {
    id: "pain", label: "Pain & Surface",
    fields: [
      { key: "painType", label: "Pain / surface", multi: true, options: ["No pain", "Foreign body sensation", "Burning", "Deep boring ache", "Periocular headache"] },
      { key: "painAssoc", label: "Pain", multi: true, options: ["Worsens on ocular movements", "Radiates to forehead-temple", "Associated with nausea or vomiting", "None"] },
    ],
  },
  {
    id: "redness", label: "Redness & Discharge",
    fields: [
      { key: "redness", label: "Redness", options: ["Diffuse", "Circumcorneal", "Sectoral"] },
      { key: "discharge", label: "Discharge", multi: true, options: ["Watery (tearing)", "Mucoid", "Mucopurulent", "Purulent", "Ropy-stringy"] },
      { key: "matting", label: "Matting on waking", options: ["Present", "Absent"] },
    ],
  },
  {
    id: "motility", label: "Motility & Binocularity",
    fields: [
      { key: "diplopia", label: "Diplopia", options: ["Present", "Absent"] },
      { key: "diplopiaType", label: "Type", options: ["Binocular (resolves on covering either eye)", "Monocular (persists on occluding fellow eye)"] },
      { key: "diplopiaDir", label: "Direction", options: ["Horizontal", "Vertical", "Torsional"] },
      { key: "diplopiaGaze", label: "Maximal in", options: ["Primary gaze", "Right gaze", "Left gaze", "Up gaze", "Down gaze"] },
      { key: "diplopiaAssoc", label: "With", multi: true, options: ["Diurnal variation", "Ptosis"] },
    ],
  },
];

export const HPI_FACTOR_GROUP: HpiGroup = {
  id: "factors", label: "Aggravating & Relieving",
  fields: [
    { key: "aggravating", label: "Aggravated by", multi: true, options: ["Near work", "Bright light", "Allergens", "Eye movement"] },
    { key: "relieving", label: "Relieved by", multi: true, options: ["Rest", "Dark room", "Lubricants", "None"] },
    { key: "priorCare", label: "Prior evaluation", options: ["Clinic", "Self-medicated", "None"] },
    { key: "priorTx", label: "Treated with", multi: true, options: ["Topical steroid", "Topical antibiotic", "Antiglaucoma drops", "Lubricants"] },
    { key: "priorRelief", label: "Relief", options: ["Partial", "No", "Temporary"] },
  ],
};

export const HPI_NEGATIVES: readonly string[] = [
  "No history of blunt/penetrating ocular trauma, vegetative matter injury, or chemical exposure.",
  "No history of contact lens wear or swimming exposure.",
  "No history of recent intraocular surgery, laser procedures, or intravitreal injections.",
  "No history of prolonged topical/systemic corticosteroid use.",
  "No scalp tenderness, jaw claudication, fever, joint pains, oral/genital ulcers, or focal neurological deficits.",
];

/* ── helpers ── */

const one = (f: HpiFields, k: string): string => {
  const v = f[k];
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
};
const many = (f: HpiFields, k: string): string[] => {
  const v = f[k];
  return (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean);
};
/** "a", "a and b", "a, b and c" */
const join = (xs: string[]) => xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
/** Lower-case a phrase for mid-sentence use, keeping words in brackets (e.g. "(Hemeralopia)"). */
const lc = (s: string) => s.replace(/(\([^)]*\))|([^(]+)/g, (_m, br, txt) => br ?? txt.toLowerCase());
const eyeWords = (lat: string | null) => lat === "RE" ? "the right eye" : lat === "LE" ? "the left eye" : lat === "OU" ? "both eyes" : "the eye(s)";
const presence = (v: string) => v === "Present" ? "Presence" : v === "Absent" ? "Absence" : v;

export function hasHpiFields(f: HpiFields | null | undefined): boolean {
  return !!f && Object.values(f).some((v) => (Array.isArray(v) ? v.length > 0 : !!v));
}

/**
 * Builds the HPI write-up. Sections with nothing selected are left out.
 * Headings end with ":" and are upper-case; bullets start with "• "; complaints
 * are numbered — formatHpi() below and the print renderer read that shape.
 */
export function buildHpiText(
  f: HpiFields,
  patient: { age?: number | null; sex?: string | null; occupation?: string | null },
  chiefComplaint: string | null | undefined,
): string {
  const complaints = parseComplaintItems(chiefComplaint);
  const sex = (patient.sex ?? "").toUpperCase().startsWith("F") ? "female" : (patient.sex ?? "").toUpperCase().startsWith("M") ? "male" : "patient";
  const durNum = one(f, "durationNum");
  const durUnit = one(f, "durationUnit") || "days";
  const duration = durNum ? `${durNum} ${Number(durNum) === 1 ? durUnit.replace(/s$/, "") : durUnit}` : (complaints[0]?.since ?? "");

  const lines: string[] = [];
  lines.push("HISTORY OF PRESENTING ILLNESS (HPI):");
  const who = [
    patient.age ? `${patient.age}-year-old` : null,
    sex,
  ].filter(Boolean).join(" ");
  lines.push(`The patient is a ${who}${patient.occupation ? `, ${patient.occupation}` : ""}, presenting with complaints of:`);
  if (complaints.length) {
    complaints.forEach((c, i) => {
      lines.push(`${i + 1}. ${c.text}${c.lat ? ` in ${c.lat}` : ""}${c.since ? ` for ${c.since}` : ""}`);
    });
  } else {
    lines.push("1. —");
  }

  // Narrative & symptom analysis
  const narrative: string[] = [];
  const first = complaints[0];
  const condition = one(f, "condition");
  const complaintText = first ? lc(first.text) : "the complaints";
  const eye = eyeWords(first?.lat ?? null);
  if (condition === "Apparently asymptomatic" || !condition) {
    narrative.push(`The patient was apparently asymptomatic${duration ? ` ${duration} ago` : ""}, when they developed ${complaintText} in ${eye}.`);
  } else {
    narrative.push(`${condition}; developed ${complaintText} in ${eye}${duration ? ` ${duration} ago` : ""}.`);
  }

  const onset = one(f, "onset"), course = one(f, "course");
  if (onset || course) {
    narrative.push(`• Onset & Course: ${[onset && `${onset} in onset`, course && `${lc(course)} in nature`].filter(Boolean).join(" and ")}.`);
  }

  const vis: string[] = [];
  if (one(f, "visAffects")) vis.push(`Affects ${lc(one(f, "visAffects"))} vision`);
  if (one(f, "visPain")) vis.push(lc(one(f, "visPain")));
  if (many(f, "visField").length) vis.push(lc(join(many(f, "visField"))));
  let visLine = vis.join("; ");
  if (many(f, "visAssoc").length) visLine += `${visLine ? ". " : ""}Associated with ${lc(join(many(f, "visAssoc")))}`;
  if (one(f, "visDiurnal")) {
    const d = one(f, "visDiurnal");
    visLine += `${visLine ? ". " : ""}${d === "No diurnal variation" ? "No diurnal variation" : `Vision is notably worse during ${lc(d)}`}`;
  }
  if (visLine) narrative.push(`• Vision Characteristics: ${visLine.charAt(0).toUpperCase() + visLine.slice(1)}.`);

  const post: string[] = [];
  if (one(f, "floaters")) post.push(`${presence(one(f, "floaters"))} of floaters${many(f, "floaterType").length ? ` (${lc(join(many(f, "floaterType")))})` : ""}`);
  else if (many(f, "floaterType").length) post.push(`Floaters (${lc(join(many(f, "floaterType")))})`);
  if (many(f, "photopsia").length) post.push(`photopsia (${lc(join(many(f, "photopsia")))})`);
  if (one(f, "shadow")) post.push(`a ${lc(one(f, "shadow"))} progressing across the visual field`);
  if (post.length) narrative.push(`• Posterior Segment Symptoms: ${post.join(", ")}.`);

  const pain: string[] = [];
  if (many(f, "painType").length) pain.push(join(many(f, "painType")));
  const painAssoc = many(f, "painAssoc").filter((p) => p !== "None");
  if (painAssoc.length) pain.push(`Pain ${lc(join(painAssoc))}`);
  if (pain.length) narrative.push(`• Pain & Surface Symptoms: ${pain.join(". ")}.`);

  const red: string[] = [];
  if (one(f, "redness")) red.push(`${one(f, "redness")} redness`);
  if (many(f, "discharge").length) red.push(`${red.length ? "associated with " : ""}${lc(join(many(f, "discharge")))} discharge`);
  if (one(f, "matting")) red.push(`${lc(presence(one(f, "matting")))} of matting of eyelashes upon waking`);
  if (red.length) narrative.push(`• Redness & Discharge: ${red.join(", ").replace(/^./, (c) => c.toUpperCase())}.`);

  const mot: string[] = [];
  if (one(f, "diplopia")) mot.push(`${presence(one(f, "diplopia"))} of diplopia`);
  if (one(f, "diplopiaType")) mot.push(lc(one(f, "diplopiaType")));
  if (one(f, "diplopiaDir")) mot.push(lc(one(f, "diplopiaDir")));
  if (one(f, "diplopiaGaze")) mot.push(`maximal in ${lc(one(f, "diplopiaGaze"))}`);
  if (many(f, "diplopiaAssoc").length) mot.push(`with ${lc(join(many(f, "diplopiaAssoc")))}`);
  if (mot.length) narrative.push(`• Motility & Binocularity: ${mot.join(", ")}.`);

  const mod: string[] = [];
  if (many(f, "aggravating").length) mod.push(`Aggravated by ${lc(join(many(f, "aggravating")))}`);
  const rel = many(f, "relieving").filter((r) => r !== "None");
  if (rel.length) mod.push(`${mod.length ? "relieved" : "Relieved"} by ${lc(join(rel))}`);
  let modLine = mod.join(" and ");
  const care = one(f, "priorCare");
  if (care && care !== "None") {
    const tx = many(f, "priorTx");
    const relief = one(f, "priorRelief");
    modLine += `${modLine ? ". " : ""}${care === "Self-medicated" ? "Self-medicated" : `Prior evaluation at a ${lc(care)}`}${tx.length ? `, treated with ${lc(join(tx))}` : ""}${relief ? ` with ${lc(relief)} relief` : ""}`;
  } else if (care === "None") {
    modLine += `${modLine ? ". " : ""}No prior evaluation`;
  }
  if (modLine) narrative.push(`• Modifying Factors & Prior Care: ${modLine}.`);

  lines.push("");
  lines.push("NARRATIVE & SYMPTOM ANALYSIS:");
  lines.push(...narrative);

  const negatives = many(f, "negatives");
  if (negatives.length) {
    lines.push("");
    lines.push("PERTINENT NEGATIVES & RISK FACTORS:");
    negatives.forEach((n) => lines.push(`• ${n}`));
  }

  const other = one(f, "other").trim();
  if (other) {
    lines.push("");
    lines.push("OTHER DESCRIPTIONS:");
    lines.push(other);
  }

  return lines.join("\n");
}

/* ── formatting for display / print ── */

export type HpiBlock =
  | { kind: "heading"; text: string }
  | { kind: "numbered"; num: string; text: string }
  | { kind: "bullet"; label: string | null; text: string }
  | { kind: "para"; text: string }
  | { kind: "gap" };

/** Splits HPI text into display blocks. Free-typed HPI comes out as plain paragraphs. */
export function formatHpi(text: string): HpiBlock[] {
  return text.replace(/\r/g, "").split("\n").map((raw): HpiBlock => {
    const line = raw.trim();
    if (!line) return { kind: "gap" };
    if (/^[A-Z0-9 &()/,'-]+:$/.test(line) && /[A-Z]{3}/.test(line)) return { kind: "heading", text: line.replace(/:$/, "") };
    const num = line.match(/^(\d+)\.\s+(.*)$/);
    if (num) return { kind: "numbered", num: num[1], text: num[2] };
    const bul = line.match(/^[•\-*]\s*(.*)$/);
    if (bul) {
      const lab = bul[1].match(/^([A-Z][A-Za-z &/]+):\s+(.*)$/);
      return lab ? { kind: "bullet", label: lab[1], text: lab[2] } : { kind: "bullet", label: null, text: bul[1] };
    }
    return { kind: "para", text: line };
  });
}
