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

  // ── Corneal ───────────────────────────────────────────────────────────────

  {
    id: "tx-adherent-leucoma",
    name: "Adherent Leucoma Protocol",
    diagnosisCodes: ["H17.0", "H17"],
    diagnosisKeywords: ["adherent leucoma", "leucoma", "corneal leucoma", "corneal opacity", "corneal scar"],
    medications: [
      { drugName: "Carboxymethylcellulose 0.5% Eye Drops",  dosage: "1–2 drops", frequency: "QID (Four times daily)", duration: "Continuous", instructions: "Lubrication to reduce friction and discomfort" },
      { drugName: "Fluorometholone 0.1% Eye Drops",         dosage: "1 drop",    frequency: "BD (Twice daily)",        duration: "4 weeks",     instructions: "Anti-inflammatory; taper and stop. Avoid if IOP raised." },
      { drugName: "Homatropine 2% Eye Drops",               dosage: "1 drop",    frequency: "BD (Twice daily)",        duration: "2 weeks",     instructions: "Cycloplegic for pain relief if photophobia present" },
    ],
    investigations: ["Visual Acuity", "Slit-lamp Examination", "Corneal Topography", "Specular Microscopy", "IOP measurement"],
    advice: "Avoid eye rubbing. UV-protective glasses recommended outdoors. Discuss penetrating keratoplasty (PKP) if vision significantly impaired. Regular review for IOP rise on steroids.",
    followUpDays: 14,
    isDefault: true,
  },
  {
    id: "tx-corneal-abrasion",
    name: "Corneal Abrasion Protocol",
    diagnosisCodes: ["S05.0", "T15.0", "H16.1"],
    diagnosisKeywords: ["corneal abrasion", "corneal erosion", "recurrent corneal erosion", "corneal foreign body"],
    medications: [
      { drugName: "Moxifloxacin 0.5% Eye Drops",              dosage: "1 drop",    frequency: "QID (Four times daily)", duration: "5 days" },
      { drugName: "Carboxymethylcellulose 0.5% Eye Drops",    dosage: "1–2 drops", frequency: "QID (Four times daily)", duration: "2 weeks" },
      { drugName: "Homatropine 2% Eye Drops",                 dosage: "1 drop",    frequency: "BD (Twice daily)",       duration: "3 days",  instructions: "Cycloplegic for pain relief" },
    ],
    investigations: ["Visual Acuity", "Slit-lamp with Fluorescein staining"],
    advice: "Avoid contact lens use until fully healed. Protective glasses for work. Lubricants to prevent recurrent erosion. Review in 48 h if no improvement.",
    followUpDays: 2,
    isDefault: true,
  },
  {
    id: "tx-pterygium",
    name: "Pterygium Protocol",
    diagnosisCodes: ["H11.0", "H11.00", "H11.01", "H11.02", "H11.03"],
    diagnosisKeywords: ["pterygium", "pinguecula"],
    medications: [
      { drugName: "Carboxymethylcellulose 0.5% Eye Drops", dosage: "1–2 drops", frequency: "QID (Four times daily)", duration: "Continuous" },
      { drugName: "Ketorolac 0.5% Eye Drops",              dosage: "1 drop",    frequency: "TID (Three times daily)", duration: "2 weeks",  instructions: "For acute inflammatory episodes only" },
    ],
    investigations: ["Visual Acuity", "Corneal Topography (if encroaching on visual axis)", "Slit-lamp Examination"],
    advice: "UV-protective sunglasses mandatory outdoors. Avoid dusty/windy environments. Surgery (excision + conjunctival autograft) if encroaching within 2 mm of visual axis or causing significant astigmatism.",
    followUpDays: 90,
    isDefault: true,
  },

  // ── Conjunctiva & Lids ────────────────────────────────────────────────────

  {
    id: "tx-bacterial-conjunctivitis",
    name: "Bacterial Conjunctivitis Protocol",
    diagnosisCodes: ["H10.0", "H10.00", "H10.01", "H10.02", "H10.03"],
    diagnosisKeywords: ["bacterial conjunctivitis", "purulent conjunctivitis", "mucopurulent conjunctivitis"],
    medications: [
      { drugName: "Moxifloxacin 0.5% Eye Drops",  dosage: "1 drop", frequency: "QID (Four times daily)", duration: "7 days" },
      { drugName: "Tobramycin 0.3% Eye Drops",     dosage: "1 drop", frequency: "QID (Four times daily)", duration: "7 days", instructions: "Alternative if moxifloxacin not tolerated" },
    ],
    investigations: ["Conjunctival Swab for C&S (if severe or recurrent)"],
    advice: "Strict hand hygiene. Avoid touching eyes. Do not share towels or eye drops. Discard contact lenses if worn. Review in 3 days if no improvement.",
    followUpDays: 7,
    isDefault: true,
  },
  {
    id: "tx-viral-conjunctivitis",
    name: "Viral Conjunctivitis Protocol",
    diagnosisCodes: ["H10.3", "H10.30", "H10.31", "H10.9", "B30.1"],
    diagnosisKeywords: ["viral conjunctivitis", "adenoviral conjunctivitis", "epidemic keratoconjunctivitis", "ekc"],
    medications: [
      { drugName: "Carboxymethylcellulose 0.5% Eye Drops",  dosage: "1–2 drops", frequency: "QID (Four times daily)", duration: "2 weeks",  instructions: "Symptomatic lubrication" },
      { drugName: "Cold Artificial Tears (refrigerated)",   dosage: "1–2 drops", frequency: "QID (Four times daily)", duration: "2 weeks",  instructions: "Cold compresses and cold drops for symptomatic relief" },
      { drugName: "Fluorometholone 0.1% Eye Drops",         dosage: "1 drop",    frequency: "BD (Twice daily)",       duration: "2 weeks",  instructions: "Only if subepithelial infiltrates causing visual disturbance" },
    ],
    advice: "Highly contagious — strict isolation for 2 weeks. Wash hands frequently. Avoid public swimming pools. No contact lens use. Self-limiting; typically resolves in 2–4 weeks.",
    followUpDays: 14,
    isDefault: true,
  },
  {
    id: "tx-blepharitis",
    name: "Blepharitis Protocol",
    diagnosisCodes: ["H01.0", "H01.00", "H01.01"],
    diagnosisKeywords: ["blepharitis", "anterior blepharitis", "posterior blepharitis", "meibomian gland dysfunction", "mgd"],
    medications: [
      { drugName: "Carboxymethylcellulose 0.5% Eye Drops",  dosage: "1–2 drops", frequency: "QID (Four times daily)", duration: "Continuous" },
      { drugName: "Tobramycin 0.3% + Dexamethasone 0.1% Eye Drops", dosage: "1 drop", frequency: "BD (Twice daily)", duration: "4 weeks", instructions: "For acute flares only" },
      { drugName: "Doxycycline 100mg Capsules",             dosage: "1 capsule", frequency: "OD (Once daily)",        duration: "6 weeks",  instructions: "Oral – for MGD / posterior blepharitis (take with food)" },
    ],
    investigations: ["Slit-lamp Examination", "Meibomian Gland Expression"],
    advice: "Lid hygiene twice daily: warm compresses (10 min) + cotton bud lid scrubs with diluted baby shampoo. Omega-3 supplements (flaxseed oil). Chronic condition — maintenance lid hygiene for life.",
    followUpDays: 28,
    isDefault: true,
  },
  {
    id: "tx-chalazion",
    name: "Chalazion Protocol",
    diagnosisCodes: ["H00.1", "H00.10", "H00.11", "H00.14", "H00.15"],
    diagnosisKeywords: ["chalazion", "meibomian cyst", "tarsal cyst"],
    medications: [
      { drugName: "Chloramphenicol 0.5% Eye Drops",         dosage: "1 drop", frequency: "QID (Four times daily)", duration: "1 week",  instructions: "Prophylaxis; only if secondary infection suspected" },
      { drugName: "Triamcinolone 40mg/mL Injection",        dosage: "0.1–0.2 mL", frequency: "Stat (Immediately)", duration: "Single dose", instructions: "Intralesional steroid injection under LA if >4 weeks and persistent" },
    ],
    investigations: ["Clinical Examination", "Histopathology (if recurrent or atypical — rule out sebaceous carcinoma)"],
    advice: "Warm compresses 4× daily for 10 minutes each. Gentle massage over the lesion. Most resolve in 4–6 weeks. Surgical incision and curettage (I&C) if no resolution after 6–8 weeks.",
    followUpDays: 28,
    isDefault: true,
  },
  {
    id: "tx-hordeolum",
    name: "Hordeolum (Stye) Protocol",
    diagnosisCodes: ["H00.0", "H00.01", "H00.04"],
    diagnosisKeywords: ["hordeolum", "stye", "external stye", "internal stye"],
    medications: [
      { drugName: "Chloramphenicol 0.5% Eye Ointment",  dosage: "Small amount", frequency: "BD (Twice daily)",        duration: "7 days" },
      { drugName: "Moxifloxacin 0.5% Eye Drops",        dosage: "1 drop",       frequency: "QID (Four times daily)", duration: "5 days",  instructions: "If cellulitis spreading beyond lid margin" },
    ],
    advice: "Warm compresses 4× daily for 10 minutes. Do NOT squeeze or burst. Avoid eye makeup until resolved. Oral antibiotics (Amoxicillin-Clavulanate) if preseptal cellulitis develops.",
    followUpDays: 7,
    isDefault: true,
  },

  // ── Uvea & Retina ─────────────────────────────────────────────────────────

  {
    id: "tx-anterior-uveitis",
    name: "Anterior Uveitis (Iridocyclitis) Protocol",
    diagnosisCodes: ["H20.0", "H20.00", "H20.01", "H20.1", "H20.9"],
    diagnosisKeywords: ["anterior uveitis", "iridocyclitis", "iritis", "uveitis"],
    medications: [
      { drugName: "Prednisolone Acetate 1% Eye Drops",     dosage: "1 drop", frequency: "Hourly (first 48h), then taper", duration: "6–8 weeks", instructions: "Taper based on clinical response: hourly → QID → TID → BD → OD → stop" },
      { drugName: "Atropine 1% Eye Drops",                 dosage: "1 drop", frequency: "BD (Twice daily)",               duration: "Until flare resolves", instructions: "Cycloplegic; prevents posterior synechiae" },
      { drugName: "Ketorolac 0.5% Eye Drops",              dosage: "1 drop", frequency: "QID (Four times daily)",         duration: "4 weeks" },
    ],
    investigations: ["Visual Acuity", "IOP measurement", "Slit-lamp (cells and flare)", "ANA, HLA-B27, VDRL/TPHA, Mantoux/IGRA, CXR (if recurrent)"],
    advice: "Attend all follow-up appointments. Monitor IOP closely on steroids. If recurrent — systemic workup mandatory. Avoid prolonged steroid use without monitoring.",
    followUpDays: 7,
    isDefault: true,
  },
  {
    id: "tx-wet-amd",
    name: "Wet AMD (nAMD) Protocol",
    diagnosisCodes: ["H35.3", "H35.30", "H35.31", "H35.32"],
    diagnosisKeywords: ["wet amd", "neovascular amd", "choroidal neovascularisation", "cnv", "age-related macular degeneration", "amd"],
    medications: [
      { drugName: "Ranibizumab 0.5mg Intravitreal Injection",  dosage: "0.5mg", frequency: "Monthly ×3 loading, then PRN", duration: "Per protocol", instructions: "Intravitreal anti-VEGF — administer in OT under sterile conditions" },
      { drugName: "Bevacizumab 1.25mg Intravitreal Injection", dosage: "1.25mg", frequency: "Monthly ×3 loading, then PRN", duration: "Per protocol", instructions: "Alternative anti-VEGF — off-label; lower cost" },
    ],
    investigations: ["OCT Macula", "Fundus Fluorescein Angiography (FFA)", "ICGA", "Fundus Photography", "Visual Acuity"],
    advice: "Monthly monitoring initially. Report any sudden loss of vision, new distortion, or scotoma immediately. Amsler grid daily self-monitoring. Vitamin supplements (AREDS2 formula) for fellow eye protection.",
    followUpDays: 30,
    isDefault: true,
  },
  {
    id: "tx-dry-amd",
    name: "Dry AMD Protocol",
    diagnosisCodes: ["H35.3", "H35.30", "H35.31"],
    diagnosisKeywords: ["dry amd", "geographic atrophy", "drusen", "non-neovascular amd"],
    medications: [
      { drugName: "AREDS2 Formula Supplements (Lutein + Zeaxanthin)", dosage: "1 tablet", frequency: "OD (Once daily)", duration: "Long-term", instructions: "High-dose antioxidant vitamins; reduces progression risk by ~25%" },
    ],
    investigations: ["OCT Macula", "Fundus Photography (for monitoring progression)", "Visual Acuity", "Amsler Grid"],
    advice: "Daily Amsler grid monitoring — present to clinic immediately if new distortion develops (may indicate conversion to wet AMD). UV-protective sunglasses. Smoking cessation is mandatory. Healthy diet rich in leafy greens and oily fish.",
    followUpDays: 180,
    isDefault: true,
  },
  {
    id: "tx-crvo",
    name: "Central Retinal Vein Occlusion (CRVO) Protocol",
    diagnosisCodes: ["H34.8", "H34.81", "H34.82"],
    diagnosisKeywords: ["central retinal vein occlusion", "crvo", "branch retinal vein occlusion", "brvo", "retinal vein occlusion"],
    medications: [
      { drugName: "Ranibizumab 0.5mg Intravitreal Injection", dosage: "0.5mg", frequency: "Monthly until stable, then PRN", duration: "Per protocol", instructions: "Anti-VEGF for macular oedema; administer in OT" },
    ],
    investigations: ["OCT Macula", "Fundus Photography", "Fundus Fluorescein Angiography", "BP measurement", "FBS/HbA1c", "Lipid profile", "CBC", "Coagulation screen (young patient)"],
    advice: "Manage systemic risk factors aggressively: BP, diabetes, hyperlipidaemia. Aspirin 75mg OD (after physician review). Avoid dehydration. No oral contraceptive pill. Refer to physician for cardiovascular risk assessment.",
    followUpDays: 30,
    isDefault: true,
  },
  {
    id: "tx-crao",
    name: "Central Retinal Artery Occlusion (CRAO) — Emergency Protocol",
    diagnosisCodes: ["H34.1", "H34.10", "H34.11", "H34.12"],
    diagnosisKeywords: ["central retinal artery occlusion", "crao", "branch retinal artery occlusion", "brao", "retinal artery occlusion"],
    medications: [
      { drugName: "Aspirin 300mg Tablet",         dosage: "300mg stat",  frequency: "Stat (Immediately)",     duration: "Single dose",   instructions: "Loading dose — give immediately; then 75mg OD long-term after physician review" },
      { drugName: "Acetazolamide 500mg IV / Oral", dosage: "500mg",       frequency: "Stat (Immediately)",     duration: "Single dose",   instructions: "Emergency IOP lowering to improve perfusion (acute CRAO within 4 h)" },
      { drugName: "Timolol 0.5% Eye Drops",        dosage: "1 drop",      frequency: "BD (Twice daily)",       duration: "Acute phase",   instructions: "IOP lowering to improve ocular perfusion" },
    ],
    investigations: ["Urgent ECG", "Carotid Doppler Ultrasound", "Echocardiogram", "BP measurement", "FBS", "Lipid profile", "CBC + ESR + CRP (rule out GCA)", "Coagulation screen"],
    advice: "EMERGENCY — refer to stroke unit immediately (up to 40% have concurrent cerebral ischaemia). Ocular massage may be attempted. Thrombolysis only within 4.5 h at stroke centre. Long-term cardiovascular risk management essential.",
    followUpDays: 1,
    isDefault: true,
  },
  {
    id: "tx-vitreous-hemorrhage",
    name: "Vitreous Haemorrhage Protocol",
    diagnosisCodes: ["H43.1", "H43.10", "H43.11", "H43.12", "H43.13"],
    diagnosisKeywords: ["vitreous hemorrhage", "vitreous haemorrhage", "vitreous bleed"],
    medications: [
      { drugName: "Ranibizumab 0.5mg Intravitreal Injection", dosage: "0.5mg", frequency: "Stat — if PDR aetiology", duration: "Per protocol", instructions: "Anti-VEGF only if due to PDR or CRVO — administer in OT" },
    ],
    investigations: ["Fundus B-scan Ultrasound (if fundus view obscured)", "OCT (when media clears)", "FBS/HbA1c", "BP measurement"],
    advice: "Head elevated at 30–45°. Avoid strenuous activity, Valsalva, aspirin/NSAIDs if possible. No flying. Return immediately if pain, flashing lights increase, or curtain appears (retinal detachment). Most absorb spontaneously in 3–6 months. Vitrectomy if no clearing.",
    followUpDays: 14,
    isDefault: true,
  },

  // ── Glaucoma (additional) ─────────────────────────────────────────────────

  {
    id: "tx-aacg",
    name: "Acute Angle Closure Glaucoma (AACG) — Emergency",
    diagnosisCodes: ["H40.2", "H40.20", "H40.21", "H40.22", "H40.23"],
    diagnosisKeywords: ["acute angle closure", "acute angle-closure glaucoma", "aacg", "angle closure glaucoma", "acute glaucoma"],
    medications: [
      { drugName: "Acetazolamide 500mg IV",             dosage: "500mg IV",   frequency: "Stat (Immediately)",       duration: "Single dose", instructions: "Systemic IOP lowering — EMERGENCY" },
      { drugName: "Timolol 0.5% Eye Drops",             dosage: "1 drop",     frequency: "Stat then BD",             duration: "Acute phase" },
      { drugName: "Brimonidine 0.2% Eye Drops",         dosage: "1 drop",     frequency: "Stat then TID",            duration: "Acute phase" },
      { drugName: "Pilocarpine 2% Eye Drops",           dosage: "1 drop",     frequency: "Stat — every 15 min × 3", duration: "Acute phase", instructions: "Miotic — apply after IOP has started to fall (ineffective if IOP very high and iris ischaemic)" },
      { drugName: "Glycerol 50% Oral",                  dosage: "1 g/kg",     frequency: "Stat (Immediately)",       duration: "Single dose", instructions: "Hyperosmotic agent — avoid if diabetic; can use IV mannitol 20% instead" },
      { drugName: "Prednisolone Acetate 1% Eye Drops",  dosage: "1 drop",     frequency: "QID (Four times daily)",   duration: "1 week",      instructions: "Reduce post-attack inflammation" },
    ],
    investigations: ["IOP measurement (urgent)", "Gonioscopy (fellow eye)", "Anterior Segment OCT", "A-scan Biometry"],
    advice: "EMERGENCY — admit immediately. Target IOP < 25 mmHg before laser. Laser peripheral iridotomy (LPI) to both eyes once attack broken. Topical drops continued until LPI. Patient education on avoidance of precipitants (dim light, mydriatics).",
    followUpDays: 1,
    isDefault: true,
  },
  {
    id: "tx-normal-tension-glaucoma",
    name: "Normal Tension Glaucoma (NTG) Protocol",
    diagnosisCodes: ["H40.1", "H40.12"],
    diagnosisKeywords: ["normal tension glaucoma", "ntg", "low tension glaucoma"],
    medications: [
      { drugName: "Latanoprost 0.005% Eye Drops",  dosage: "1 drop", frequency: "OD (Once daily at night)", duration: "Continuous", instructions: "Target IOP reduction ≥30% from baseline" },
      { drugName: "Brimonidine 0.2% Eye Drops",    dosage: "1 drop", frequency: "BD (Twice daily)",         duration: "Continuous", instructions: "Additional neuroprotective benefit suggested" },
    ],
    investigations: ["IOP measurement (diurnal curve)", "Visual Field (SITA Standard 24-2)", "Optic Disc OCT (RNFL)", "BP measurement (orthostatic hypotension check)", "FBC, ESR, CRP"],
    advice: "Avoid nocturnal hypotension — do not take BP medications at night. Maintain target IOP. Vascular risk factor management. Discuss SLT or trabeculectomy if progression on maximum medical therapy.",
    followUpDays: 90,
    isDefault: true,
  },

  // ── Oculomotility & Neuro-Ophthalmology ─────────────────────────────────

  {
    id: "tx-optic-neuritis",
    name: "Optic Neuritis Protocol",
    diagnosisCodes: ["H46", "H46.0", "H46.1", "H46.8", "H46.9"],
    diagnosisKeywords: ["optic neuritis", "retrobulbar neuritis", "demyelinating optic neuritis"],
    medications: [
      { drugName: "Methylprednisolone 1g IV",    dosage: "1g in 250 mL NS", frequency: "OD × 3 days",      duration: "3 days",  instructions: "IV infusion over 30–60 min; accelerates visual recovery but does not change final visual outcome" },
      { drugName: "Prednisolone 1mg/kg Oral",    dosage: "Per body weight",  frequency: "OD (Once daily)",   duration: "11 days then taper", instructions: "Following IV course — taper over 4 days" },
    ],
    investigations: ["Visual Acuity (LogMAR)", "Colour Vision (Ishihara / HRR)", "Visual Field (30-2)", "VEP (Visual Evoked Potentials)", "MRI Brain and Orbits (with Gadolinium) — urgent", "OCT RNFL", "Blood: AQP4-IgG, MOG-IgG, ANA, ESR"],
    advice: "Urgent MRI to risk-stratify for MS (McDonald criteria). Refer to neurologist. 50% risk of MS within 15 years if white matter lesions on MRI. Vision typically recovers in 6–12 weeks even without treatment.",
    followUpDays: 7,
    isDefault: true,
  },
  {
    id: "tx-amblyopia",
    name: "Amblyopia Protocol",
    diagnosisCodes: ["H53.0", "H53.00", "H53.01", "H53.02", "H53.03", "H53.04"],
    diagnosisKeywords: ["amblyopia", "lazy eye", "anisometropic amblyopia", "strabismic amblyopia", "deprivation amblyopia"],
    medications: [
      { drugName: "Atropine 1% Eye Drops",  dosage: "1 drop", frequency: "OD (Once daily) — in better eye", duration: "Until VA equalises", instructions: "Penalisation of fellow eye — alternative to occlusion patching" },
    ],
    investigations: ["Visual Acuity (age-appropriate)", "Cycloplegic Refraction", "Cover Test", "Fundus Examination", "Stereoacuity (TNO/Randot)"],
    advice: "Full refractive correction is the FIRST step — glasses must be worn full-time for at least 3 months before adding patching. Occlusion patching of better eye: 2 h/day (mild) to 6 h/day (severe). Amblyopia treatment is effective until at least age 12. Compliance is critical.",
    followUpDays: 84,
    isDefault: true,
  },

  // ── Retina (additional) ────────────────────────────────────────────────────

  {
    id: "tx-retinal-detachment",
    name: "Rhegmatogenous Retinal Detachment — Pre-op Protocol",
    diagnosisCodes: ["H33.0", "H33.00", "H33.01", "H33.02", "H33.03", "H33.05"],
    diagnosisKeywords: ["retinal detachment", "rhegmatogenous retinal detachment", "rrd", "retinal tear", "macula off"],
    medications: [
      { drugName: "Prednisolone Acetate 1% Eye Drops", dosage: "1 drop", frequency: "QID (Four times daily)", duration: "Pre-op only", instructions: "Reduce pre-operative inflammation" },
    ],
    investigations: ["B-scan Ultrasound (mandatory if media opaque)", "Visual Acuity", "IOP measurement", "Slit-lamp + indirect ophthalmoscopy", "Surgical consent"],
    advice: "URGENT SURGICAL REFERRAL. Macula-off RRD: surgery within 24 h. Macula-on RRD: surgery same day if possible. Nil by mouth preparation. Bed rest with appropriate head posture. No aspirin/anticoagulants if feasible.",
    followUpDays: 1,
    isDefault: true,
  },
  {
    id: "tx-macular-hole",
    name: "Macular Hole Protocol",
    diagnosisCodes: ["H35.34", "H35.342", "H35.343"],
    diagnosisKeywords: ["macular hole", "full thickness macular hole", "foveal hole"],
    medications: [],
    investigations: ["OCT Macula (mandatory — staging)", "Visual Acuity", "Amsler Grid", "Fundus Photography"],
    advice: "Stage 2–4 macular holes require pars plana vitrectomy (PPV) + ILM peel + gas tamponade. Face-down posturing for 1–2 weeks post-op. Success rate >90% for stage 2–3. Discuss surgery urgency with vitreoretinal surgeon.",
    followUpDays: 7,
    isDefault: true,
  },
  {
    id: "tx-retinitis-pigmentosa",
    name: "Retinitis Pigmentosa Protocol",
    diagnosisCodes: ["H35.52", "H35.5", "H35.50"],
    diagnosisKeywords: ["retinitis pigmentosa", "rp", "rod-cone dystrophy", "cone-rod dystrophy"],
    medications: [
      { drugName: "Vitamin A Palmitate 15,000 IU Capsules", dosage: "15,000 IU",  frequency: "OD (Once daily)",        duration: "Long-term", instructions: "May slow progression in some forms. Avoid in pregnancy. Monitor liver function annually." },
      { drugName: "Docosahexaenoic Acid (DHA) Omega-3",    dosage: "1200 mg",    frequency: "OD (Once daily)",        duration: "Long-term", instructions: "Adjuvant to Vitamin A — may have additional benefit" },
      { drugName: "Dorzolamide 2% Eye Drops",               dosage: "1 drop",     frequency: "BD (Twice daily)",       duration: "As needed", instructions: "For associated cystoid macular oedema (CMO)" },
    ],
    investigations: ["Full-field ERG (mandatory for diagnosis)", "OCT Macula (CMO?)", "Visual Field (30-2 and 60-4)", "Colour Vision", "Genetic Testing (if available)", "Fundus Photography"],
    advice: "No cure currently. UV protective sunglasses mandatory. Genetic counselling for family members. Register as visually impaired if eligible. Review low vision aids. Avoid Vitamin E supplements (may accelerate progression). Clinical trials available — discuss with specialist.",
    followUpDays: 365,
    isDefault: true,
  },

  // ── Paediatric & Strabismus ───────────────────────────────────────────────

  {
    id: "tx-congenital-nasolacrimal-obstruction",
    name: "Congenital Nasolacrimal Duct Obstruction Protocol",
    diagnosisCodes: ["H04.5", "H04.53", "Q10.5"],
    diagnosisKeywords: ["nasolacrimal obstruction", "nlo", "nasolacrimal duct obstruction", "dacryostenosis", "epiphora infant", "watering eye"],
    medications: [
      { drugName: "Chloramphenicol 0.5% Eye Drops",  dosage: "1 drop",        frequency: "QID (Four times daily)", duration: "5 days",   instructions: "Only when mucopurulent discharge present — not for prophylaxis" },
    ],
    investigations: ["Clinical Examination", "Dye disappearance test (fluorescein)"],
    advice: "Crigler massage (lacrimal sac massage) 2× daily — push upward on the inner corner of the eye. 90% resolve spontaneously by 12 months. If not resolved by 12 months → refer for probing under GA. Do not use antibiotics long-term prophylactically.",
    followUpDays: 90,
    isDefault: true,
  },
];

/* ── Storage helpers ────────────────────────────────────────────────────── */

const TX_PRESETS_KEY    = "ppms_tx_presets_v1";
const APPLIED_KEY       = "ppms_tx_applied_v1";
const DIAG_SNAPSHOT_KEY = "ppms_tx_diag_snapshot_v1";
const DISMISSED_KEY     = "ppms_tx_dismissed_v1";

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

/* Dismissed preset IDs — per visitId ──────────────────────────────────── */

export function getDismissedPresets(visitId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const all = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "{}");
    return all[visitId] ?? [];
  } catch {
    return [];
  }
}

export function addDismissedPreset(visitId: string, presetId: string): void {
  if (typeof window === "undefined") return;
  try {
    const all = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "{}");
    const existing: string[] = all[visitId] ?? [];
    if (!existing.includes(presetId)) all[visitId] = [...existing, presetId];
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(all));
  } catch {}
}

export function clearDismissedPresets(visitId: string): void {
  if (typeof window === "undefined") return;
  try {
    const all = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "{}");
    delete all[visitId];
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(all));
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
