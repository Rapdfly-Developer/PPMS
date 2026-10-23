// Default "In view of" keywords per investigation, offered as chips under the
// field when the test is ticked in the Investigations order form. Keywords a
// doctor adds with "+ Keyword" are saved per test on top of these (localStorage
// `kw_inv_in_view_of:<test name>`). Tests not listed here start with none.
export const INV_IN_VIEW_OF_DEFAULTS: Record<string, readonly string[]> = {
  // Imaging
  "OCT Macula (6mm cube)": ["Diabetic macular edema", "ARMD", "CSCR", "Macular hole", "ERM", "CME"],
  "OCT Disc/RNFL": ["Glaucoma suspect", "POAG", "Optic disc edema", "Optic atrophy"],
  "OCT Anterior Segment": ["Narrow angles", "Corneal thickness", "Keratoconus", "Post-op evaluation"],
  "FFA": ["Diabetic retinopathy", "CNVM", "CSCR", "Retinal vein occlusion", "Vasculitis"],
  "ICGA": ["Polypoidal choroidal vasculopathy", "Choroiditis", "CNVM", "CSCR"],
  "B-scan Ultrasound": ["Media opacity", "Dense cataract", "Vitreous hemorrhage", "Retinal detachment", "Ocular mass"],
  "UBM": ["Angle closure", "Plateau iris", "Ciliary body cyst", "Anterior segment mass"],
  "Fundus Photography": ["Documentation", "Diabetic retinopathy", "Glaucoma follow-up", "Retinal lesion"],
  // Perimetry
  "Humphrey VF 24-2": ["Glaucoma", "Glaucoma suspect", "Neuro-ophthalmic field defect"],
  "Humphrey VF 30-2": ["Glaucoma", "Neuro-ophthalmic field defect", "Pituitary lesion"],
  "Goldmann Perimetry": ["Advanced glaucoma", "Retinitis pigmentosa", "Neurological field loss"],
  "Amsler Grid": ["ARMD", "Metamorphopsia", "Macular disease"],
  // Biometry
  "A-scan Biometry": ["Cataract surgery", "IOL power calculation"],
  "IOL Master": ["Cataract surgery", "IOL power calculation"],
  "Pentacam": ["Keratoconus", "Refractive surgery screening", "Corneal ectasia"],
  "Specular Microscopy": ["Pre-op cataract", "Fuchs dystrophy", "Corneal decompensation"],
  // Refraction
  "Cycloplegic Refraction": ["Pediatric refraction", "Accommodative esotropia", "Latent hyperopia"],
  "Manifest Refraction": ["Refractive error", "Spectacle prescription"],
  "Keratometry": ["Pre-op cataract", "Contact lens fitting", "Astigmatism"],
  "Topography": ["Keratoconus", "Irregular astigmatism", "Refractive surgery screening"],
  // Electrophysiology
  "ERG": ["Retinal dystrophy", "Retinitis pigmentosa", "Unexplained vision loss"],
  "VEP": ["Optic neuritis", "Optic neuropathy", "Unexplained vision loss"],
  "EOG": ["Best disease", "RPE dysfunction"],
  // Pre-op Labs
  "CBC": ["Pre-op evaluation", "Infection"],
  "Blood Sugar (FBS/PPBS)": ["Pre-op evaluation", "Diabetes"],
  "HbA1c": ["Diabetes control", "Diabetic retinopathy"],
  "Serum Creatinine": ["Pre-op evaluation", "Before FFA contrast"],
  "ECG": ["Pre-op evaluation", "Cardiac history"],
  "Chest X-ray": ["Pre-op evaluation", "General anesthesia"],
  "PT/INR": ["Pre-op evaluation", "On anticoagulants"],
  // Microbiology
  "Corneal Scraping Culture": ["Corneal ulcer", "Microbial keratitis", "Fungal keratitis"],
  "Conjunctival Swab C/S": ["Conjunctivitis", "Pre-op screening"],
  "KOH Mount": ["Fungal keratitis", "Corneal ulcer"],
  "Gram Stain": ["Bacterial keratitis", "Corneal ulcer", "Conjunctivitis"],
};
