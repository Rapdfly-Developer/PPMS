// Centralised enum-like constants (SQLite has no native enum support in Prisma,
// so these are validated/typed at the application layer instead).

export const ROLES = ["DOCTOR", "HOSPITAL", "RECEPTIONIST"] as const;
export type Role = string; // dynamic roles from DB; ROLES array used for validation

export const SEXES = ["MALE", "FEMALE", "OTHER"] as const;
export type Sex = (typeof SEXES)[number];

export const APPOINTMENT_STATUSES = [
  "REQUESTED",
  "CONFIRMED",
  "RESCHEDULED",
  "DISPENSED",
  "CANCELLED",
  "NO_SHOW",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const VERIFICATION_STATUSES = ["PENDING_REVIEW", "VERIFIED", "REJECTED"] as const;

export const ORDER_PRIORITIES = ["ROUTINE", "URGENT", "STAT"] as const;
export const ORDER_STATUSES = ["ORDERED", "IN_PROGRESS", "RESULT_AVAILABLE", "REVIEWED"] as const;

export const DIAGNOSIS_STATUSES = ["ACTIVE", "RESOLVED", "CHRONIC"] as const;

export const LATERALITY = ["RE", "LE", "OU"] as const;

export const PAST_MEDICAL_HISTORY_CHIPS = [
  "HTN",
  "DM",
  "Glaucoma",
  "Cataract surgery",
  "Thyroid disorder",
  "Cardiac disease",
  "Asthma",
  "Other",
] as const;

export const VA_TEST_METHODS = ["Snellen", "E-chart", "LogMAR", "Symbols", "HOTV"] as const;

export const VA_SNELLEN_VALUES = ["-", "6/6", "6/9", "6/12", "6/18", "6/24", "6/36", "6/60", "5/60", "CF 1m", "CF 3m", "HM", "PL+", "PL-"] as const;

// Quick-add chips for the Plan tab's prescription panel - common ophthalmology drugs.
export const COMMON_DRUGS = [
  "Timolol 0.5%",
  "Latanoprost 0.005%",
  "Prednisolone 1%",
  "Ciprofloxacin 0.3%",
  "Tobramycin 0.3%",
  "Moxifloxacin 0.5%",
  "Sodium hyaluronate",
  "Carboxymethylcellulose",
] as const;

export const COLOUR_VISION_TESTS = ["Ishihara (38 plates)", "D-15 Farnsworth", "Lanthony D-15", "HRR", "City University"] as const;
export const CONTRAST_SENSITIVITY_TESTS = ["Pelli-Robson", "Mars Letter CS", "Vistech", "FACT"] as const;

export const IOP_METHODS = ["NCT", "Goldmann", "Tono-Pen", "iCare", "Perkins"] as const;

export const ANTERIOR_SEGMENT_STRUCTURES: Record<string, string[]> = {
  upperLid: ["Normal", "Ptosis", "Lid retraction", "Lagophthalmos", "Blepharitis", "Chalazion", "Stye"],
  lowerLid: ["Normal", "Ectropion", "Entropion", "Lagophthalmos", "Blepharitis"],
  conjunctiva: ["Normal", "Congested", "Chemosis", "Pterygium", "Subconjunctival haemorrhage", "Follicles"],
  sclera: ["Normal", "Icteric", "Nodule", "Thinning"],
  cornea: ["Clear", "Edema", "Opacity", "Arcus senilis", "KP", "Vascularisation", "Scar"],
  anteriorChamber: ["Normal depth", "Shallow", "Cells/Flare", "Hyphema", "Hypopyon"],
  iris: ["Normal", "Atrophy", "Synechiae", "Neovascularisation", "Coloboma"],
  pupil: ["Normal/Reactive", "RAPD", "Fixed dilated", "Irregular", "Miotic"],
  lens: ["Clear", "NS1", "NS2", "NS3", "NS4", "PSC", "PCIOL in-situ", "ACIOL in-situ", "Aphakia", "Subluxation"],
};

export const POSTERIOR_SEGMENT_OPTIONS: Record<string, string[]> = {
  media:          ["Clear", "Vitreous haze", "Vitreous haemorrhage", "Asteroid hyalosis", "Synchysis scintillans"],
  discSize:       ["Normal", "Small", "Large", "Megalopapilla"],
  discShape:      ["Round", "Oval", "Tilted", "Oblique insertion", "Irregular"],
  discColour:     ["Normal", "Pale", "Hyperaemic", "Cupped", "Drusen", "Disc oedema", "Tilted disc"],
  discVessels:    [],
  discMargin:     [],
  cdr:            [],
  nrr:            [],
  macula:         ["Normal", "Dry ARMD", "Wet ARMD", "CSME", "ERM", "MH", "CSR", "Macular scar", "Flat scar"],
  retinalVessels: ["Normal", "AV nipping", "Copper/silver wiring", "CRVO", "BRVO", "CRAO", "NVE", "NVD"],
  background:     ["Normal", "DR absent", "Mild NPDR", "Moderate NPDR", "Severe NPDR", "PDR", "Laser scars"],
};

export const LACRIMAL_SAC_CHIPS = [
  "Patent",
  "Clear regurgitation",
  "Mucus regurgitation",
  "Blood regurgitation",
  "Hard stop",
  "Soft stop",
  "Regurgitation - same punctum",
  "Regurgitation - opposite punctum",
];

export const DIPLOPIA_POSITIONS = [
  "Up-Right", "Up", "Up-Left",
  "Right", "Primary", "Left",
  "Down-Right", "Down", "Down-Left",
] as const;

export const DIPLOPIA_STATUS = ["NOT_TESTED", "NO_DIPLOPIA", "DIPLOPIA_PRESENT"] as const;

export const INVESTIGATION_CATALOG: Record<string, string[]> = {
  "Imaging & Functional Tests": [
    "Perimetry",
    "Biometry",
    "Refraction",
    "Electrophysiology",
    "OCT Macula (6mm cube)",
    "OCT Disc/RNFL",
    "OCT Anterior Segment",
    "FFA",
    "ICGA",
    "B-scan Ultrasound",
    "UBM",
    "Fundus Photography",
  ],
  "Pre-op & Lab": ["Pre-op Labs", "Microbiology"],
};

export const WARDS = ["MALE_WARD", "FEMALE_WARD"] as const;

export const ANAESTHESIA_TYPES = ["Topical", "Peribulbar", "Retrobulbar", "General Anaesthesia", "Sub-Tenon's"] as const;

export const SURGERY_TYPES = [
  "Cataract Surgery (Phaco + IOL)",
  "SICS",
  "Trabeculectomy",
  "Vitrectomy",
  "Squint Surgery",
  "Pterygium Excision",
  "DCR (Dacryocystorhinostomy)",
  "Corneal Transplant",
  "Other",
] as const;

// Vitals validation ranges for out-of-range warnings
export const VITAL_RANGES = {
  systolic:    { min: 90,   max: 140,  unit: "mmHg" },
  diastolic:   { min: 60,   max: 90,   unit: "mmHg" },
  pulse:       { min: 60,   max: 100,  unit: "bpm"  },
  temperature: { min: 36.1, max: 37.5, unit: "°C"   },
  weight:      { min: 30,   max: 200,  unit: "kg"   },
} as const;

// Curated ophthalmology ICD-10 subset
export const ICD10_OPHTHALMOLOGY = [
  // Eyelids & lacrimal (H00–H05)
  { code: "H00.0",  description: "Hordeolum (stye) of eyelid" },
  { code: "H00.1",  description: "Chalazion" },
  { code: "H01.0",  description: "Blepharitis" },
  { code: "H02.0",  description: "Entropion of eyelid" },
  { code: "H02.1",  description: "Ectropion of eyelid" },
  { code: "H02.4",  description: "Ptosis of eyelid" },
  { code: "H02.7",  description: "Other degenerative disorders of eyelid" },
  { code: "H04.0",  description: "Dacryoadenitis" },
  { code: "H04.1",  description: "Chronic dacryocystitis" },
  { code: "H04.12", description: "Dry eye syndrome" },
  { code: "H04.3",  description: "Acute dacryocystitis" },
  { code: "H04.4",  description: "Chronic lacrimal duct obstruction" },
  { code: "H05.0",  description: "Acute inflammation of orbit" },
  { code: "H05.1",  description: "Chronic inflammatory disorders of orbit" },
  { code: "H05.2",  description: "Exophthalmos" },
  // Conjunctiva (H10–H13)
  { code: "H10.0",  description: "Mucopurulent conjunctivitis" },
  { code: "H10.1",  description: "Acute atopic conjunctivitis (allergic)" },
  { code: "H10.2",  description: "Other acute conjunctivitis" },
  { code: "H10.3",  description: "Unspecified acute conjunctivitis" },
  { code: "H10.4",  description: "Chronic conjunctivitis" },
  { code: "H10.5",  description: "Blepharoconjunctivitis" },
  { code: "H10.9",  description: "Unspecified conjunctivitis" },
  { code: "H11.0",  description: "Pterygium" },
  { code: "H11.1",  description: "Conjunctival degeneration" },
  { code: "H11.3",  description: "Conjunctival haemorrhage (subconjunctival)" },
  // Sclera & cornea (H15–H19)
  { code: "H15.0",  description: "Scleritis" },
  { code: "H15.1",  description: "Episcleritis" },
  { code: "H16.0",  description: "Corneal ulcer" },
  { code: "H16.1",  description: "Other and unspecified superficial keratitis" },
  { code: "H16.2",  description: "Keratoconjunctivitis" },
  { code: "H16.4",  description: "Corneal neovascularisation" },
  { code: "H16.9",  description: "Unspecified keratitis" },
  { code: "H17.0",  description: "Adherent leucoma" },
  { code: "H17.9",  description: "Unspecified corneal scar and opacity" },
  { code: "H18.0",  description: "Corneal pigmentations and deposits" },
  { code: "H18.5",  description: "Hereditary corneal dystrophies" },
  { code: "H18.6",  description: "Keratoconus" },
  // Iris & ciliary body (H20–H22)
  { code: "H20.0",  description: "Acute and subacute iridocyclitis" },
  { code: "H20.1",  description: "Chronic iridocyclitis" },
  { code: "H20.2",  description: "Lens-induced iridocyclitis" },
  { code: "H21.0",  description: "Hyphaema" },
  { code: "H21.3",  description: "Cyst of iris, ciliary body and anterior chamber" },
  // Lens (H25–H28)
  { code: "H25.0",  description: "Age-related cortical cataract" },
  { code: "H25.1",  description: "Age-related nuclear cataract" },
  { code: "H25.2",  description: "Age-related posterior subcapsular cataract" },
  { code: "H25.9",  description: "Unspecified age-related cataract" },
  { code: "H26.0",  description: "Infantile and juvenile cataract" },
  { code: "H26.1",  description: "Traumatic cataract" },
  { code: "H26.2",  description: "Complicated cataract" },
  { code: "H26.3",  description: "Drug-induced cataract" },
  { code: "H26.9",  description: "Unspecified cataract" },
  { code: "H27.1",  description: "Dislocation of lens (subluxation)" },
  // Choroid & retina (H30–H36)
  { code: "H30.0",  description: "Focal chorioretinal inflammation" },
  { code: "H30.9",  description: "Unspecified chorioretinal inflammation" },
  { code: "H33.0",  description: "Retinal detachment with retinal break" },
  { code: "H33.2",  description: "Serous retinal detachment" },
  { code: "H33.4",  description: "Traction retinal detachment" },
  { code: "H33.5",  description: "Other retinal detachments" },
  { code: "H34.1",  description: "Central retinal artery occlusion (CRAO)" },
  { code: "H34.2",  description: "Other retinal artery occlusions (BRAO)" },
  { code: "H34.8",  description: "Other retinal vascular occlusions (CRVO/BRVO)" },
  { code: "H35.00", description: "Background diabetic retinopathy, unspecified" },
  { code: "H35.1",  description: "Retinopathy of prematurity" },
  { code: "H35.3",  description: "Degeneration of macula and posterior pole" },
  { code: "H35.31", description: "Non-exudative (dry) AMD" },
  { code: "H35.32", description: "Exudative (wet) AMD" },
  { code: "H35.4",  description: "Peripheral retinal degeneration (lattice)" },
  { code: "H35.6",  description: "Retinal haemorrhage" },
  { code: "H35.7",  description: "Separation of retinal layers (retinoschisis)" },
  { code: "H36.0",  description: "Diabetic retinopathy (NPDR / PDR)" },
  // Glaucoma (H40–H42)
  { code: "H40.0",  description: "Glaucoma suspect" },
  { code: "H40.10", description: "Unspecified open-angle glaucoma" },
  { code: "H40.11", description: "Primary open-angle glaucoma (POAG)" },
  { code: "H40.12", description: "Low-tension glaucoma" },
  { code: "H40.13", description: "Pigmentary glaucoma" },
  { code: "H40.20", description: "Unspecified primary angle-closure glaucoma" },
  { code: "H40.21", description: "Acute primary angle-closure glaucoma" },
  { code: "H40.22", description: "Chronic primary angle-closure glaucoma" },
  { code: "H40.3",  description: "Glaucoma secondary to eye trauma" },
  { code: "H40.4",  description: "Glaucoma secondary to eye inflammation" },
  { code: "H40.5",  description: "Glaucoma secondary to other eye disorders" },
  { code: "H42",    description: "Glaucoma in diseases classified elsewhere" },
  // Vitreous & globe (H43–H44)
  { code: "H43.0",  description: "Vitreous prolapse" },
  { code: "H43.1",  description: "Vitreous haemorrhage" },
  { code: "H43.3",  description: "Other vitreous opacities (floaters)" },
  { code: "H44.2",  description: "Degenerative myopia" },
  // Optic nerve (H46–H48)
  { code: "H46",    description: "Optic neuritis" },
  { code: "H47.0",  description: "Disorders of optic nerve, not elsewhere classified" },
  { code: "H47.1",  description: "Papilloedema" },
  { code: "H47.2",  description: "Optic atrophy" },
  { code: "H47.3",  description: "Other disorders of optic disc" },
  // Ocular muscles / refraction (H49–H52)
  { code: "H49.0",  description: "Third (oculomotor) nerve palsy" },
  { code: "H49.1",  description: "Fourth (trochlear) nerve palsy" },
  { code: "H49.2",  description: "Sixth (abducent) nerve palsy" },
  { code: "H50.0",  description: "Convergent concomitant strabismus (esotropia)" },
  { code: "H50.1",  description: "Divergent concomitant strabismus (exotropia)" },
  { code: "H50.4",  description: "Other and unspecified strabismus" },
  { code: "H52.0",  description: "Hypermetropia" },
  { code: "H52.1",  description: "Myopia" },
  { code: "H52.2",  description: "Astigmatism" },
  { code: "H52.4",  description: "Presbyopia" },
  { code: "H52.5",  description: "Disorders of accommodation" },
  // Visual disturbances (H53–H54)
  { code: "H53.0",  description: "Amblyopia ex anopsia (lazy eye)" },
  { code: "H53.1",  description: "Subjective visual disturbances" },
  { code: "H53.2",  description: "Diplopia" },
  { code: "H54.0",  description: "Blindness, both eyes" },
  { code: "H54.4",  description: "Blindness, one eye" },
  { code: "H54.6",  description: "Unqualified visual loss, one eye" },
  // Diabetic eye (E10–E11)
  { code: "E10.31", description: "Type 1 DM with NPDR" },
  { code: "E10.32", description: "Type 1 DM with PDR" },
  { code: "E11.31", description: "Type 2 DM with NPDR" },
  { code: "E11.32", description: "Type 2 DM with PDR" },
  { code: "E11.36", description: "Type 2 DM with diabetic cataract" },
] as const;
