// Shared helpers for the Counselling module (surgery-bound patients).
import { istTodayStr } from "@/lib/ist";

export type CounsellingStatus = "PENDING" | "PARTIAL" | "COMPLETED" | "POSTPONED";

/** Report validity window: surgery must happen within 1 month of the oldest report. */
export function reportsValidUntil(oldestReportAt: Date): Date {
  const d = new Date(oldestReportAt);
  d.setMonth(d.getMonth() + 1);
  return d;
}

/** Investigation order status for reports replaced by a retake (kept in the history only). */
export const SUPERSEDED = "SUPERSEDED";

/** An investigation is frozen 2 months after it was ordered (same rule as the EMR). */
export const INV_FREEZE_MONTHS = 2;

/** Stored status, mapping the retired workflow values onto the current ones. */
export function counsellingStatus(rec: {
  status: string;
  eligibleForSurgery: boolean;
  fitForSurgery: boolean;
  surgeryDeferred: boolean;
  advancePaid?: unknown;
  advanceReceived?: boolean;
} | null | undefined): CounsellingStatus {
  // Pending: reports not uploaded or not yet reviewed by the doctor.
  // Partial: the doctor reviewed the reports (Fit for surgery).
  // Completed: the advance payment is recorded (or counselling is finalized).
  if (!rec) return "PENDING";
  if (rec.eligibleForSurgery) return "COMPLETED";
  if (rec.surgeryDeferred) return "POSTPONED";
  if (rec.fitForSurgery && (rec.advanceReceived || Number(rec.advancePaid ?? 0) > 0)) return "COMPLETED";
  if (rec.fitForSurgery) return "PARTIAL";
  return "PENDING";
}

export const LATERALITY_LABEL: Record<string, string> = {
  RE: "Right Eye (RE)",
  LE: "Left Eye (LE)",
  OU: "Both Eyes (OU)",
};

/** Full surgery line: "Phacoemulsification with IOL — Right Eye (RE) — Peribulbar Block". */
export function surgeryLine(v: { advisedSurgeryName: string | null; advisedSurgeryEye: string | null; advisedSurgeryAnaesthesia: string | null }): string {
  return [
    v.advisedSurgeryName?.trim() ?? "",
    v.advisedSurgeryEye ? LATERALITY_LABEL[v.advisedSurgeryEye] ?? v.advisedSurgeryEye : "",
    v.advisedSurgeryAnaesthesia ?? "",
  ].filter(Boolean).join(" — ");
}

// ── EMR Surgical Counselling tab ────────────────────────────────────────────
export const SURGERY_OPTIONS = [
  "Phacoemulsification with IOL",
  "Manual Small Incision Cataract Surgery (MSICS) with IOL",
  "Extracapsular Cataract Extraction (ECCE) with IOL",
  "Phacoemulsification with Toric IOL",
  "Phacoemulsification with Multifocal IOL",
  "Secondary IOL Implantation",
  "Trabeculectomy with MMC",
  "Combined Phaco-Trabeculectomy",
  "Glaucoma Drainage Device (Ahmed Valve) Implantation",
  "Pars Plana Vitrectomy (PPV)",
  "PPV with Silicone Oil Injection",
  "PPV with Endolaser",
  "Silicone Oil Removal",
  "Scleral Buckling",
  "Penetrating Keratoplasty (PK)",
  "DSAEK / DMEK",
  "Pterygium Excision with Conjunctival Autograft",
  "Dacryocystorhinostomy (DCR)",
  "Ptosis Correction",
  "Strabismus Surgery",
  "Evisceration with Orbital Implant",
  "Enucleation with Orbital Implant",
  "Implantable Collamer Lens (ICL)",
];

export const ANAESTHESIA_OPTIONS = [
  "Topical Anesthesia",
  "Local Infiltration",
  "Peribulbar Block",
  "Retrobulbar Block",
  "Sub-Tenon's Block",
  "General Anesthesia",
  "Monitored Anesthesia Care (MAC)",
  "Sedation + Topical",
];

export const SURGICAL_NOTE_KEYWORDS = [
  "Pre-op investigations advised",
  "Physician fitness required",
  "Cardiology clearance required",
  "Biometry done",
  "Biometry to be repeated",
  "Control blood sugar before surgery",
  "Control blood pressure before surgery",
  "Stop anticoagulants as advised",
  "Patient counselled about risks",
  "Guarded visual prognosis explained",
];

// ── Co-payment ──────────────────────────────────────────────────────────────
export const PAYMENT_MODES = [
  { value: "CASH",     label: "Out of Pocket" },
  { value: "CASHLESS", label: "Covered" },
] as const;

/** Payment types, asked first. "Self" is always Out of Pocket; the others are Out of Pocket or Covered. */
export const CASHLESS_TYPES = [
  { value: "INSURANCE",   label: "Health Insurance",      nameLabel: "Insurance company / TPA", idLabel: "Policy number" },
  { value: "GOVT_SCHEME", label: "Government Scheme",     nameLabel: "Scheme name",             idLabel: "Beneficiary / card ID" },
  { value: "CORPORATE",   label: "Corporate",             nameLabel: "Company name",            idLabel: "Employee ID" },
  { value: "COMMUNITY",   label: "Community Based",       nameLabel: "Organisation / camp",     idLabel: "Reference ID" },
  { value: "OTHER",       label: "Other",                 nameLabel: "Details",                 idLabel: "Reference ID" },
] as const;

export const SELF_PAY = "SELF";
export const PAYMENT_TYPES = [
  { value: SELF_PAY, label: "Self", nameLabel: "", idLabel: "" },
  ...CASHLESS_TYPES,
] as const;

/** The payment type; records saved before types came first (Out of Pocket, no type) count as Self. */
export function paymentTypeOf(mode: string | null | undefined, type: string | null | undefined): string {
  return type || (mode === "CASH" ? SELF_PAY : "");
}

/** One line for the payment, e.g. "Self · Out of Pocket" or "Health Insurance · Covered". */
export function paymentLabel(mode: string | null | undefined, type: string | null | undefined): string {
  const t = paymentTypeOf(mode, type);
  const typeLabel = PAYMENT_TYPES.find((x) => x.value === t)?.label ?? "";
  const modeLabel = PAYMENT_MODES.find((m) => m.value === mode)?.label ?? "";
  return [typeLabel, modeLabel].filter(Boolean).join(" · ");
}

export interface PaymentDoc { ref: string; name: string; at: string }

export function parsePaymentDocs(s: string | null | undefined): PaymentDoc[] {
  try {
    const x = JSON.parse(s ?? "[]");
    return Array.isArray(x) ? x.filter((d): d is PaymentDoc => !!d && typeof d.ref === "string" && typeof d.name === "string" && typeof d.at === "string") : [];
  } catch { return []; }
}

/** Starter options for the payer name, per covered-by type; custom entries are remembered on top. */
export const PAYER_SUGGESTIONS: Record<string, string[]> = {
  INSURANCE: [
    "Star Health Insurance",
    "HDFC ERGO",
    "ICICI Lombard",
    "Niva Bupa",
    "Care Health Insurance",
    "Aditya Birla Health Insurance",
    "Bajaj Allianz",
    "Tata AIG",
    "SBI General Insurance",
    "ManipalCigna",
    "New India Assurance",
    "United India Insurance",
    "Oriental Insurance",
    "National Insurance",
    "Medi Assist (TPA)",
    "MD India (TPA)",
    "Paramount Health (TPA)",
    "Vidal Health (TPA)",
    "Heritage Health (TPA)",
    "Family Health Plan (TPA)",
  ],
  GOVT_SCHEME: [
    "Ayushman Bharat (PM-JAY)",
    "CGHS",
    "ECHS",
    "ESIC",
    "Railways (RELHS)",
    "CMCHIS (Tamil Nadu)",
    "Dr. YSR Aarogyasri (Andhra Pradesh)",
    "Aarogyasri (Telangana)",
    "Karunya Arogya Suraksha (Kerala)",
    "MJPJAY (Maharashtra)",
    "Arogya Karnataka",
    "NPCBVI (Blindness Control)",
    "State Government Employees Scheme",
  ],
  CORPORATE: [
    "Company tie-up (direct billing)",
    "PSU employee scheme",
    "Bank employee scheme",
    "Group health insurance (employer)",
  ],
  COMMUNITY: [
    "Lions Club",
    "Rotary Club",
    "NPCBVI eye camp",
    "Free cataract surgery camp",
    "NGO / Charitable trust",
    "Religious trust",
  ],
  OTHER: [],
};

// ── Implants ────────────────────────────────────────────────────────────────
/** Starter implant suggestions, matched by keyword in the surgery name. */
const IMPLANT_PRESETS: { match: RegExp; implants: string[] }[] = [
  {
    match: /cataract|phaco|sics|ecce|iol|lens/i,
    implants: [
      "Monofocal IOL (Hydrophobic acrylic, foldable)",
      "Monofocal IOL (Hydrophilic acrylic, foldable)",
      "Monofocal IOL (PMMA, rigid)",
      "Toric IOL",
      "Multifocal IOL",
      "Trifocal IOL",
      "EDOF IOL",
      "Aspheric Monofocal IOL",
      "Capsular Tension Ring (CTR)",
    ],
  },
  { match: /glaucoma|trab|tube|valve|ahmed|baerveldt/i, implants: ["Ahmed Glaucoma Valve", "Baerveldt Implant", "Ex-PRESS Shunt", "iStent", "Mitomycin C (adjunct)"] },
  { match: /vitrect|retina|buckle|rd |detachment/i, implants: ["Silicone Oil (1000 cs)", "Silicone Oil (5000 cs)", "SF6 Gas", "C3F8 Gas", "Scleral Buckle (Silicone band)", "Scleral Buckle (Silicone tyre)"] },
  { match: /kerato|cornea|dsaek|dmek|graft|pk/i, implants: ["Donor Cornea", "Bandage Contact Lens"] },
  { match: /ptosis|sling/i, implants: ["Silicone Rod (Frontalis sling)", "Fascia Lata"] },
  { match: /eviscer|enucle|orbital implant/i, implants: ["PMMA Orbital Implant", "Silicone Orbital Implant", "Hydroxyapatite Orbital Implant", "Porous Polyethylene (Medpor) Implant"] },
  { match: /dcr|lacrimal|intubation/i, implants: ["Silicone Lacrimal Intubation Tube", "Jones Tube"] },
  { match: /icl|phakic/i, implants: ["Implantable Collamer Lens (ICL)", "Toric ICL"] },
  { match: /pterygium/i, implants: ["Conjunctival Autograft + Fibrin Glue", "Amniotic Membrane"] },
];

export function implantSuggestions(surgery: string): string[] {
  const out: string[] = [];
  for (const p of IMPLANT_PRESETS) if (p.match.test(surgery)) out.push(...p.implants);
  return [...new Set(out)];
}

/** Implant family of a surgery: decides the Implant Details fields in Counselling. */
export type ImplantGroup = "IOL" | "GLAUCOMA" | "RETINA" | "BUCKLE" | "CORNEA" | "PTERYGIUM" | "OTHER" | "NONE";

const CATARACT_IOLS = IMPLANT_PRESETS[0].implants;

/** IOLs by the lens kind named in the surgery (e.g. "Phaco with Multifocal IOL"). */
const IOL_KINDS: { match: RegExp; implants: string[] }[] = [
  { match: /trifocal/i, implants: ["Trifocal IOL (Hydrophobic acrylic)", "Trifocal IOL (Hydrophilic acrylic)", "Trifocal Toric IOL"] },
  { match: /multifocal/i, implants: ["Multifocal IOL (Diffractive)", "Multifocal IOL (Refractive)", "Multifocal Toric IOL"] },
  { match: /edof|extended depth/i, implants: ["EDOF IOL", "EDOF Toric IOL"] },
  { match: /toric/i, implants: ["Toric IOL (Hydrophobic acrylic)", "Toric IOL (Hydrophilic acrylic)"] },
  { match: /monofocal/i, implants: ["Monofocal IOL (Hydrophobic acrylic, foldable)", "Monofocal IOL (Hydrophilic acrylic, foldable)", "Monofocal IOL (PMMA, rigid)", "Aspheric Monofocal IOL"] },
  { match: /icl|phakic/i, implants: ["Implantable Collamer Lens (ICL)", "Toric ICL"] },
];
const kindIols = (name: string) => [...new Set(IOL_KINDS.filter((k) => k.match.test(name)).flatMap((k) => k.implants))];

/** Implant list and Implant Details fields set for each surgery in the EMR list. */
const SURGERY_IMPLANTS: Record<string, { group: ImplantGroup; implants: string[] }> = {
  "Phacoemulsification with IOL": { group: "IOL", implants: CATARACT_IOLS },
  "Manual Small Incision Cataract Surgery (MSICS) with IOL": { group: "IOL", implants: CATARACT_IOLS },
  "Extracapsular Cataract Extraction (ECCE) with IOL": { group: "IOL", implants: CATARACT_IOLS },
  "Phacoemulsification with Toric IOL": { group: "IOL", implants: kindIols("Toric") },
  "Phacoemulsification with Multifocal IOL": { group: "IOL", implants: kindIols("Multifocal") },
  "Secondary IOL Implantation": { group: "IOL", implants: ["Anterior Chamber IOL (ACIOL)", "Scleral-Fixated IOL (SFIOL)", "Iris-Claw IOL", "Sulcus IOL (3-piece)"] },
  "Trabeculectomy with MMC": { group: "NONE", implants: [] },
  "Combined Phaco-Trabeculectomy": { group: "IOL", implants: CATARACT_IOLS },
  "Glaucoma Drainage Device (Ahmed Valve) Implantation": { group: "GLAUCOMA", implants: ["Ahmed Glaucoma Valve (FP7)", "Ahmed Glaucoma Valve (S2)", "Ahmed Glaucoma Valve (FP8, paediatric)"] },
  "Pars Plana Vitrectomy (PPV)": { group: "RETINA", implants: ["Silicone Oil (1000 cs)", "Silicone Oil (5000 cs)", "SF6 Gas", "C3F8 Gas", "Air"] },
  "PPV with Silicone Oil Injection": { group: "RETINA", implants: ["Silicone Oil (1000 cs)", "Silicone Oil (5000 cs)", "Heavy Silicone Oil"] },
  "PPV with Endolaser": { group: "NONE", implants: [] },
  "Silicone Oil Removal": { group: "NONE", implants: [] },
  "Scleral Buckling": { group: "BUCKLE", implants: ["Scleral Buckle (Silicone band)", "Scleral Buckle (Silicone tyre)", "Silicone Sponge"] },
  "Penetrating Keratoplasty (PK)": { group: "CORNEA", implants: ["Donor Cornea", "Bandage Contact Lens"] },
  "DSAEK / DMEK": { group: "CORNEA", implants: ["Donor Cornea (DSAEK lenticule)", "Donor Cornea (DMEK graft)"] },
  "Pterygium Excision with Conjunctival Autograft": { group: "PTERYGIUM", implants: ["Conjunctival Autograft + Fibrin Glue", "Conjunctival Autograft + Sutures", "Amniotic Membrane"] },
  "Dacryocystorhinostomy (DCR)": { group: "OTHER", implants: ["Silicone Lacrimal Intubation Tube", "Jones Tube"] },
  "Ptosis Correction": { group: "OTHER", implants: ["Silicone Rod (Frontalis sling)", "Fascia Lata"] },
  "Strabismus Surgery": { group: "NONE", implants: [] },
  "Evisceration with Orbital Implant": { group: "OTHER", implants: ["PMMA Orbital Implant", "Silicone Orbital Implant", "Hydroxyapatite Orbital Implant", "Porous Polyethylene (Medpor) Implant"] },
  "Enucleation with Orbital Implant": { group: "OTHER", implants: ["PMMA Orbital Implant", "Silicone Orbital Implant", "Hydroxyapatite Orbital Implant", "Porous Polyethylene (Medpor) Implant"] },
  "Implantable Collamer Lens (ICL)": { group: "IOL", implants: kindIols("ICL") },
};
const SURGERY_IMPLANTS_LC = new Map(Object.entries(SURGERY_IMPLANTS).map(([k, v]) => [k.toLowerCase(), v]));
const listed = (surgery: string) => SURGERY_IMPLANTS_LC.get((surgery || "").trim().toLowerCase());

/** Implant family of a surgery: decides the Implant Details fields in Counselling. */
export function implantGroup(surgery: string): ImplantGroup {
  const hit = listed(surgery);
  if (hit) return hit.group;
  // A surgery typed by hand: guess from the words in its name
  const s = surgery || "";
  if (/pterygium/i.test(s)) return "PTERYGIUM";
  if (/icl|phakic|cataract|phaco|sics|ecce|iol|lens/i.test(s)) return "IOL";
  if (/glaucoma|tube|valve|ahmed|baerveldt|shunt|stent/i.test(s)) return "GLAUCOMA";
  if (/buckl/i.test(s)) return "BUCKLE";
  if (/vitrect|retina|rd|detachment/i.test(s)) return "RETINA";
  if (/kerato|cornea|dsaek|dmek|pk/i.test(s)) return "CORNEA";
  return "OTHER";
}

/**
 * Counselling's Type of Implant list: set per surgery; for a surgery typed by
 * hand, the lens kind it names or else its group. (The EMR keeps using implantSuggestions.)
 */
export function counsellingImplantOptions(surgery: string): string[] {
  const hit = listed(surgery);
  if (hit) return hit.implants;
  const kinds = kindIols(surgery || "");
  return kinds.length ? kinds : implantSuggestions(surgery);
}

/** Every starter implant, for when the surgery name matches no preset. */
export const ALL_IMPLANTS: readonly string[] = [...new Set(IMPLANT_PRESETS.flatMap((p) => p.implants))];

/**
 * The surgery date Counselling moved to, when it differs from the tentative
 * date signed in the EMR (null when unchanged). The signed date itself is
 * never rewritten; this is shown beside it as "Rescheduled to …".
 */
export function rescheduledSurgeryDate(
  signed: Date | string | null | undefined,
  counselling: Date | string | null | undefined,
): Date | null {
  if (!counselling) return null;
  const c = new Date(counselling);
  return signed && istTodayStr(new Date(signed)) === istTodayStr(c) ? null : c;
}
