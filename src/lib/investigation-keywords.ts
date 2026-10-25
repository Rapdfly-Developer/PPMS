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

// Default "Doctor's notes" keywords per investigation — common findings when
// reviewing the result, offered as chips under the field in Previous
// Investigations. "+ Keyword" adds the doctor's own per test (localStorage
// `kw_inv_doctor_notes:<test name>`). Tests not listed here start with none.
export const INV_DOCTOR_NOTE_DEFAULTS: Record<string, readonly string[]> = {
  // Imaging
  "OCT Macula (6mm cube)": ["Normal foveal contour", "Intraretinal fluid", "Subretinal fluid", "CME", "ERM", "Macular hole", "Drusen", "PED", "CNVM"],
  "OCT Disc/RNFL": ["RNFL within normal limits", "RNFL thinning superior", "RNFL thinning inferior", "Borderline RNFL", "Disc edema", "Large cup"],
  "OCT Anterior Segment": ["Open angles", "Narrow angles", "Angle closure", "Normal corneal thickness", "Thin cornea", "Corneal thickening"],
  "FFA": ["Normal angiogram", "Leakage", "Pooling", "Staining", "Non-perfusion areas", "Neovascularisation", "Window defect", "Blocked fluorescence"],
  "ICGA": ["Normal study", "Polyps seen", "Branching vascular network", "Choroidal hyperpermeability", "Hypofluorescent spots"],
  "B-scan Ultrasound": ["Retina attached", "Retinal detachment", "PVD", "Vitreous hemorrhage", "Vitreous opacities", "Choroidal detachment", "Mass lesion"],
  "UBM": ["Open angles", "Narrow angles", "Angle closure", "Plateau iris configuration", "Ciliary body cyst", "Anteriorly rotated ciliary body"],
  "Fundus Photography": ["Documented", "Disc photographed", "Macula photographed", "Lesion documented"],
  // Perimetry
  "Humphrey VF 24-2": ["Full field", "Reliable", "Unreliable", "Arcuate defect", "Nasal step", "Paracentral scotoma", "Generalised depression", "Progression"],
  "Humphrey VF 30-2": ["Full field", "Reliable", "Unreliable", "Arcuate defect", "Bitemporal hemianopia", "Homonymous hemianopia", "Generalised depression"],
  "Goldmann Perimetry": ["Full field", "Constricted field", "Ring scotoma", "Tubular vision", "Hemianopia"],
  "Amsler Grid": ["Normal", "Metamorphopsia", "Central scotoma", "Distortion"],
  // Biometry
  "A-scan Biometry": ["Axial length recorded", "IOL power calculated", "Repeat advised", "Inter-eye difference noted"],
  "IOL Master": ["Axial length recorded", "IOL power calculated", "Good signal quality", "Poor signal, use A-scan"],
  "Pentacam": ["Normal topography", "Keratoconus suspect", "Keratoconus", "Thin cornea", "Fit for refractive surgery", "Not fit for refractive surgery"],
  "Specular Microscopy": ["Normal endothelial count", "Low endothelial count", "Polymegathism", "Pleomorphism", "Guttae"],
  // Refraction
  "Cycloplegic Refraction": ["Hyperopia", "Myopia", "Astigmatism", "Anisometropia", "Glasses prescribed"],
  "Manifest Refraction": ["Hyperopia", "Myopia", "Astigmatism", "Presbyopia", "Glasses prescribed", "No change"],
  "Keratometry": ["Regular astigmatism", "Irregular astigmatism", "Steep cornea", "Flat cornea"],
  "Topography": ["Regular bow-tie", "Irregular astigmatism", "Inferior steepening", "Keratoconus pattern"],
  // Electrophysiology
  "ERG": ["Normal ERG", "Reduced rod response", "Reduced cone response", "Extinguished ERG"],
  "VEP": ["Normal VEP", "Delayed latency", "Reduced amplitude"],
  "EOG": ["Normal Arden ratio", "Reduced Arden ratio"],
  // Pre-op Labs
  "CBC": ["Within normal limits", "Anaemia", "Leucocytosis", "Low platelets"],
  "Blood Sugar (FBS/PPBS)": ["Within normal limits", "Raised", "Uncontrolled", "Fit for surgery"],
  "HbA1c": ["Good control", "Fair control", "Poor control"],
  "Serum Creatinine": ["Within normal limits", "Raised"],
  "ECG": ["Normal ECG", "Abnormal ECG", "Physician opinion needed", "Fit for surgery"],
  "Chest X-ray": ["Normal study", "Abnormal findings", "Fit for surgery"],
  "PT/INR": ["Within normal limits", "Raised INR", "Hold anticoagulant"],
  // Microbiology
  "Corneal Scraping Culture": ["No growth", "Bacterial growth", "Fungal growth", "Sensitivity awaited"],
  "Conjunctival Swab C/S": ["No growth", "Bacterial growth", "Sensitivity awaited"],
  "KOH Mount": ["Negative", "Fungal hyphae seen"],
  "Gram Stain": ["No organisms seen", "Gram-positive cocci", "Gram-negative bacilli", "Pus cells seen"],
};
