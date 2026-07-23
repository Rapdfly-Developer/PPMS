// Treatment preset system — diagnosis-mapped full treatment protocols.
// All state is localStorage-only; no DB schema change required.

export interface TreatmentPresetMed {
  drugName: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
}

export interface TreatmentPreset {
  id: string;
  name: string;
  /** Prefix-match against ICD-10 code, e.g. "H40" matches H40.10, H40.11 */
  diagnosisCodes: string[];
  /** Case-insensitive substring match against diagnosis description */
  diagnosisKeywords: string[];
  medications: TreatmentPresetMed[];
  investigations?: string[];
  advice?: string;
  followUpDays?: number;
  isDefault?: boolean;
  createdAt?: string;
}

export interface PresetMatch {
  preset: TreatmentPreset;
  diagnosisCode: string;
  diagnosisDesc: string;
}

export interface AppliedPreset {
  presetId: string;
  presetName: string;
  appliedAt: string;
  diagnosisDesc: string;
}

/* ── Default presets ────────────────────────────────────────────────────── */

export const DEFAULT_TREATMENT_PRESETS: TreatmentPreset[] = [
  {
    id: "tx-poag-standard",
    name: "POAG — Standard Protocol",
    diagnosisCodes: ["H40.1", "H40.10", "H40.11", "H40.12"],
    diagnosisKeywords: ["open-angle glaucoma", "poag", "glaucoma suspect"],
    medications: [
      { drugName: "Timolol 0.5% Eye Drops",       dosage: "1 drop", frequency: "BD (Twice daily)",           duration: "Continuous" },
      { drugName: "Latanoprost 0.005% Eye Drops",  dosage: "1 drop", frequency: "OD (Once daily at night)",   duration: "Continuous" },
    ],
    investigations: ["IOP measurement", "Visual Field (Perimetry)", "Optic Disc OCT"],
    advice: "Avoid caffeine. Monitor IOP every 4–6 weeks. Report any sudden vision change immediately.",
    followUpDays: 28,
    isDefault: true,
  },
  {
    id: "tx-poag-max",
    name: "POAG — Maximum Medical Therapy",
    diagnosisCodes: ["H40.1", "H40.10", "H40.11", "H40.12"],
    diagnosisKeywords: ["open-angle glaucoma", "poag", "advanced glaucoma"],
    medications: [
      { drugName: "Timolol 0.5% Eye Drops",       dosage: "1 drop", frequency: "BD (Twice daily)",           duration: "Continuous" },
      { drugName: "Latanoprost 0.005% Eye Drops",  dosage: "1 drop", frequency: "OD (Once daily at night)",   duration: "Continuous" },
      { drugName: "Brimonidine 0.2% Eye Drops",    dosage: "1 drop", frequency: "TID (Three times daily)",    duration: "Continuous" },
      { drugName: "Dorzolamide 2% Eye Drops",      dosage: "1 drop", frequency: "TID (Three times daily)",    duration: "Continuous" },
    ],
    investigations: ["IOP measurement", "Visual Field (Perimetry)", "Optic Disc OCT", "Central Corneal Thickness (CCT)"],
    advice: "Maximum tolerated medical therapy. Discuss surgical options (trabeculectomy/SLT). Strict compliance essential.",
    followUpDays: 14,
    isDefault: true,
  },
  {
    id: "tx-post-cataract",
    name: "Post-Cataract Surgery Protocol",
    diagnosisCodes: ["Z96.1", "H26", "H25", "H26.9"],
    diagnosisKeywords: ["cataract", "post-cataract", "phacoemulsification", "pseudophakia"],
    medications: [
      { drugName: "Prednisolone Acetate 1% Eye Drops", dosage: "1 drop", frequency: "QID (Four times daily)", duration: "4 weeks",  instructions: "Taper over 4 weeks" },
      { drugName: "Moxifloxacin 0.5% Eye Drops",       dosage: "1 drop", frequency: "QID (Four times daily)", duration: "2 weeks" },
      { drugName: "Ketorolac 0.5% Eye Drops",           dosage: "1 drop", frequency: "QID (Four times daily)", duration: "4 weeks" },
    ],
    investigations: ["Visual Acuity", "IOP measurement"],
    advice: "Avoid rubbing eye. Do not swim for 4 weeks. Wear protective shield at night for 2 weeks. Avoid dusty environments.",
    followUpDays: 7,
    isDefault: true,
  },
  {
    id: "tx-dry-eye",
    name: "Dry Eye Disease Protocol",
    diagnosisCodes: ["H04.12", "H04.1", "H19.3"],
    diagnosisKeywords: ["dry eye", "keratoconjunctivitis sicca", "kcs", "sjögren"],
    medications: [
      { drugName: "Carboxymethylcellulose 0.5% Eye Drops", dosage: "1–2 drops", frequency: "QID (Four times daily)", duration: "Continuous" },
      { drugName: "Cyclosporine 0.05% Eye Drops",           dosage: "1 drop",   frequency: "BD (Twice daily)",        duration: "6 months" },
    ],
    investigations: ["Tear Break-Up Time (TBUT)", "Schirmer's Test"],
    advice: "Apply warm compresses twice daily. Reduce screen time; follow 20-20-20 rule. Use humidifier indoors. Increase water intake.",
    followUpDays: 42,
    isDefault: true,
  },
  {
    id: "tx-allergic-conjunctivitis",
    name: "Allergic Conjunctivitis Protocol",
    diagnosisCodes: ["H10.1", "H10.10", "H10.11", "H10.13"],
    diagnosisKeywords: ["allergic conjunctivitis", "vernal conjunctivitis", "atopic conjunctivitis", "hay fever"],
    medications: [
      { drugName: "Olopatadine 0.1% Eye Drops",         dosage: "1 drop", frequency: "BD (Twice daily)",           duration: "4 weeks" },
      { drugName: "Ketotifen 0.025% Eye Drops",         dosage: "1 drop", frequency: "BD (Twice daily)",           duration: "4 weeks" },
      { drugName: "Fluorometholone 0.1% Eye Drops",     dosage: "1 drop", frequency: "QID (Four times daily)",     duration: "1 week",  instructions: "Taper and stop" },
    ],
    advice: "Avoid known allergens. Cold compress for symptomatic relief. Avoid eye rubbing — causes mast cell degranulation.",
    followUpDays: 14,
    isDefault: true,
  },
  {
    id: "tx-diabetic-retinopathy",
    name: "Diabetic Retinopathy Protocol",
    diagnosisCodes: ["H36", "H36.0", "E10.3", "E11.3", "E13.3"],
    diagnosisKeywords: ["diabetic retinopathy", "diabetic macular", "dr protocol", "proliferative dr"],
    medications: [
      { drugName: "Ranibizumab 0.5mg Intravitreal Injection", dosage: "0.5mg", frequency: "Monthly ×3, then PRN", duration: "Per protocol", instructions: "Intravitreal injection under sterile conditions in OT" },
    ],
    investigations: ["OCT Macula", "Fundus Photography", "Fluorescein Angiography (FFA)", "HbA1c (blood test)", "BP monitoring"],
    advice: "Strict blood sugar control (target HbA1c < 7%). BP control < 130/80. Smoking cessation. Regular follow-up is critical.",
    followUpDays: 30,
    isDefault: true,
  },
  {
    id: "tx-corneal-ulcer",
    name: "Corneal Ulcer Protocol",
    diagnosisCodes: ["H16.0", "H16.00", "H16.01", "H16.02"],
    diagnosisKeywords: ["corneal ulcer", "keratitis", "corneal abrasion", "bacterial keratitis"],
    medications: [
      { drugName: "Moxifloxacin 0.5% Eye Drops",         dosage: "1 drop", frequency: "Hourly (first 48h)",          duration: "2 weeks" },
      { drugName: "Natamycin 5% Eye Drops",               dosage: "1 drop", frequency: "Every 2 hours (first 48h)",  duration: "3 weeks", instructions: "Only if fungal aetiology suspected" },
      { drugName: "Homatropine 2% Eye Drops",             dosage: "1 drop", frequency: "BD (Twice daily)",           duration: "Until healed", instructions: "Cycloplegic for pain relief" },
      { drugName: "Carboxymethylcellulose 0.5% Eye Drops", dosage: "1 drop", frequency: "QID (Four times daily)",   duration: "As needed" },
    ],
    investigations: ["Corneal Scraping & Culture", "Gram Stain", "Anterior Segment OCT"],
    advice: "Strict hygiene. No contact lens use until healed. Protective glasses. Avoid rubbing. Daily review until improvement.",
    followUpDays: 1,
    isDefault: true,
  },
];

/* ── Storage helpers ────────────────────────────────────────────────────── */

const TX_PRESETS_KEY    = "ppms_tx_presets_v1";
const APPLIED_KEY       = "ppms_tx_applied_v1";
const DIAG_SNAPSHOT_KEY = "ppms_tx_diag_snapshot_v1";

export function getTreatmentPresets(): TreatmentPreset[] {
  if (typeof window === "undefined") return DEFAULT_TREATMENT_PRESETS;
  try {
    const raw = localStorage.getItem(TX_PRESETS_KEY);
    if (!raw) return DEFAULT_TREATMENT_PRESETS;
    const stored: TreatmentPreset[] = JSON.parse(raw);
    // Custom presets override defaults with the same id; non-default custom ones are additive
    const storedIds = new Set(stored.map((p) => p.id));
    const kept = DEFAULT_TREATMENT_PRESETS.filter((d) => !storedIds.has(d.id));
    return [...kept, ...stored];
  } catch {
    return DEFAULT_TREATMENT_PRESETS;
  }
}

export function saveTreatmentPresets(presets: TreatmentPreset[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TX_PRESETS_KEY, JSON.stringify(presets));
}

/* Applied state ── per visitId ─────────────────────────────────────────── */

export function getApplied(visitId: string): AppliedPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const all = JSON.parse(localStorage.getItem(APPLIED_KEY) ?? "{}");
    return all[visitId] ?? [];
  } catch {
    return [];
  }
}

export function setApplied(visitId: string, records: AppliedPreset[]): void {
  if (typeof window === "undefined") return;
  try {
    const all = JSON.parse(localStorage.getItem(APPLIED_KEY) ?? "{}");
    all[visitId] = records;
    localStorage.setItem(APPLIED_KEY, JSON.stringify(all));
  } catch {}
}

export function clearApplied(visitId: string): void {
  if (typeof window === "undefined") return;
  try {
    const all = JSON.parse(localStorage.getItem(APPLIED_KEY) ?? "{}");
    delete all[visitId];
    localStorage.setItem(APPLIED_KEY, JSON.stringify(all));
  } catch {}
}

/* Diagnosis snapshot — detect diagnosis changes between tabs ─────────── */

export function getDiagnosisSnapshot(visitId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const all = JSON.parse(localStorage.getItem(DIAG_SNAPSHOT_KEY) ?? "{}");
    return all[visitId] ?? [];
  } catch {
    return [];
  }
}

export function setDiagnosisSnapshot(visitId: string, sortedCodes: string[]): void {
  if (typeof window === "undefined") return;
  try {
    const all = JSON.parse(localStorage.getItem(DIAG_SNAPSHOT_KEY) ?? "{}");
    all[visitId] = sortedCodes;
    localStorage.setItem(DIAG_SNAPSHOT_KEY, JSON.stringify(all));
  } catch {}
}

/* ── Matching ───────────────────────────────────────────────────────────── */

export function matchPresets(
  diagnoses: { icd10Code: string; description: string }[],
  presets: TreatmentPreset[],
): PresetMatch[] {
  const matches: PresetMatch[] = [];
  const seenPresetIds = new Set<string>();

  for (const diag of diagnoses) {
    const codeLower = diag.icd10Code.toLowerCase();
    const descLower = diag.description.toLowerCase();

    for (const preset of presets) {
      if (seenPresetIds.has(preset.id)) continue;

      const codeMatch = preset.diagnosisCodes.some(
        (c) => codeLower.startsWith(c.toLowerCase()) || c.toLowerCase().startsWith(codeLower),
      );
      const kwMatch = preset.diagnosisKeywords.some((kw) => descLower.includes(kw.toLowerCase()));

      if (codeMatch || kwMatch) {
        seenPresetIds.add(preset.id);
        matches.push({
          preset,
          diagnosisCode: diag.icd10Code,
          diagnosisDesc: diag.description,
        });
      }
    }
  }

  return matches;
}

/* ── Merge medications (dedup against existing list) ─────────────────── */

export function mergeMeds(
  presetsToApply: TreatmentPreset[],
  existing: { drugName: string }[],
): TreatmentPresetMed[] {
  const existingNames = new Set(existing.map((m) => m.drugName.toLowerCase()));
  const seen = new Set<string>();
  const result: TreatmentPresetMed[] = [];

  for (const preset of presetsToApply) {
    for (const med of preset.medications) {
      const key = med.drugName.toLowerCase();
      if (!existingNames.has(key) && !seen.has(key)) {
        seen.add(key);
        result.push(med);
      }
    }
  }

  return result;
}
