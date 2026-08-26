// Shared investigation catalog — single source of truth for the Investigations
// tab (ordering) and any other picker that needs the same test list/categories.
export const INV_CATALOG: Record<string, { name: string; price: number }[]> = {
  Imaging: [
    { name: "OCT Macula (6mm cube)", price: 1200 },
    { name: "OCT Disc/RNFL", price: 1200 },
    { name: "OCT Anterior Segment", price: 1000 },
    { name: "FFA", price: 3500 },
    { name: "ICGA", price: 4000 },
    { name: "B-scan Ultrasound", price: 800 },
    { name: "UBM", price: 1500 },
    { name: "Fundus Photography", price: 600 },
  ],
  Perimetry: [
    { name: "Humphrey VF 24-2", price: 900 },
    { name: "Humphrey VF 30-2", price: 900 },
    { name: "Goldmann Perimetry", price: 700 },
    { name: "Amsler Grid", price: 200 },
  ],
  Biometry: [
    { name: "A-scan Biometry", price: 600 },
    { name: "IOL Master", price: 1500 },
    { name: "Pentacam", price: 1800 },
    { name: "Specular Microscopy", price: 800 },
  ],
  Refraction: [
    { name: "Cycloplegic Refraction", price: 400 },
    { name: "Manifest Refraction", price: 300 },
    { name: "Keratometry", price: 300 },
    { name: "Topography", price: 1200 },
  ],
  Electrophysiology: [
    { name: "ERG", price: 2500 },
    { name: "VEP", price: 2500 },
    { name: "EOG", price: 2000 },
  ],
  "Pre-op Labs": [
    { name: "CBC", price: 400 },
    { name: "Blood Sugar (FBS/PPBS)", price: 200 },
    { name: "HbA1c", price: 450 },
    { name: "Serum Creatinine", price: 250 },
    { name: "ECG", price: 350 },
    { name: "Chest X-ray", price: 500 },
    { name: "PT/INR", price: 350 },
  ],
  Microbiology: [
    { name: "Corneal Scraping Culture", price: 800 },
    { name: "Conjunctival Swab C/S", price: 600 },
    { name: "KOH Mount", price: 300 },
    { name: "Gram Stain", price: 250 },
  ],
};
