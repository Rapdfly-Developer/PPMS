// Shared helpers for the Counselling module (surgery-bound patients).
import { istTodayStr } from "@/lib/ist";

export type CounsellingStatus = "PENDING" | "PARTIAL" | "COMPLETED" | "POSTPONED";

/** Report validity window: surgery must happen within 1 month of the oldest report. */
export function reportsValidUntil(oldestReportAt: Date): Date {
  const d = new Date(oldestReportAt);
  d.setMonth(d.getMonth() + 1);
  return d;
}

/** Stored status, mapping the retired workflow values onto the current ones. */
export function counsellingStatus(rec: {
  status: string;
  eligibleForSurgery: boolean;
  fitForSurgery: boolean;
  surgeryDeferred: boolean;
} | null | undefined): CounsellingStatus {
  if (!rec) return "PENDING";
  if (rec.eligibleForSurgery) return "COMPLETED";
  if (rec.surgeryDeferred) return "POSTPONED";
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
  { value: "CASH",     label: "Cash (Self-pay)" },
  { value: "CASHLESS", label: "Cashless" },
] as const;

export const CASHLESS_TYPES = [
  { value: "INSURANCE",   label: "Health Insurance",      nameLabel: "Insurance company / TPA", idLabel: "Policy number" },
  { value: "GOVT_SCHEME", label: "Government Scheme",     nameLabel: "Scheme name",             idLabel: "Beneficiary / card ID" },
  { value: "CORPORATE",   label: "Corporate Covered",     nameLabel: "Company name",            idLabel: "Employee ID" },
  { value: "COMMUNITY",   label: "Community Based",       nameLabel: "Organisation / camp",     idLabel: "Reference ID" },
  { value: "OTHER",       label: "Other",                 nameLabel: "Details",                 idLabel: "Reference ID" },
] as const;

/** Starter options for the payer name, per cashless type; custom entries are remembered on top. */
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
