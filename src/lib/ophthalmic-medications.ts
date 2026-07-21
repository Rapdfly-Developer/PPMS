export interface MedEntry {
  id: string;
  name: string;
  generic: string;
  brand?: string;
  strength: string;
  form: string;
  category: string;
  route: string;
  defaultDose?: string;
}

export const OPHTHALMIC_MEDICATIONS: MedEntry[] = [
  // ── Beta-blockers (Glaucoma) ──
  { id: "t1",  name: "Timolol 0.5% Eye Drops",        generic: "Timolol",       strength: "0.5%",        form: "Eye Drops",              category: "Beta-blocker",    route: "Topical",       defaultDose: "1 drop" },
  { id: "t2",  name: "Timolol 0.25% Eye Drops",       generic: "Timolol",       strength: "0.25%",       form: "Eye Drops",              category: "Beta-blocker",    route: "Topical",       defaultDose: "1 drop" },
  { id: "t3",  name: "Betaxolol 0.5% Eye Drops",      generic: "Betaxolol",     brand: "Betoptic",       strength: "0.5%",  form: "Eye Drops",   category: "Beta-blocker",    route: "Topical",       defaultDose: "1 drop" },
  { id: "t4",  name: "Levobunolol 0.5% Eye Drops",    generic: "Levobunolol",   strength: "0.5%",        form: "Eye Drops",              category: "Beta-blocker",    route: "Topical",       defaultDose: "1 drop" },

  // ── Prostaglandins (Glaucoma) ──
  { id: "p1",  name: "Latanoprost 0.005% Eye Drops",  generic: "Latanoprost",   brand: "Xalatan",        strength: "0.005%", form: "Eye Drops",  category: "Prostaglandin",   route: "Topical",       defaultDose: "1 drop" },
  { id: "p2",  name: "Bimatoprost 0.03% Eye Drops",   generic: "Bimatoprost",   brand: "Lumigan",        strength: "0.03%",  form: "Eye Drops",  category: "Prostaglandin",   route: "Topical",       defaultDose: "1 drop" },
  { id: "p3",  name: "Travoprost 0.004% Eye Drops",   generic: "Travoprost",    brand: "Travatan",       strength: "0.004%", form: "Eye Drops",  category: "Prostaglandin",   route: "Topical",       defaultDose: "1 drop" },
  { id: "p4",  name: "Tafluprost 0.0015% Eye Drops",  generic: "Tafluprost",    brand: "Saflutan",       strength: "0.0015%", form: "Eye Drops", category: "Prostaglandin",   route: "Topical",       defaultDose: "1 drop" },

  // ── Alpha-2 Agonists (Glaucoma) ──
  { id: "a1",  name: "Brimonidine 0.2% Eye Drops",    generic: "Brimonidine",   brand: "Alphagan",       strength: "0.2%",   form: "Eye Drops",  category: "Alpha-agonist",   route: "Topical",       defaultDose: "1 drop" },
  { id: "a2",  name: "Brimonidine 0.15% Eye Drops",   generic: "Brimonidine",   brand: "Alphagan P",     strength: "0.15%",  form: "Eye Drops",  category: "Alpha-agonist",   route: "Topical",       defaultDose: "1 drop" },
  { id: "a3",  name: "Apraclonidine 0.5% Eye Drops",  generic: "Apraclonidine", brand: "Iopidine",       strength: "0.5%",   form: "Eye Drops",  category: "Alpha-agonist",   route: "Topical",       defaultDose: "1 drop" },

  // ── Carbonic Anhydrase Inhibitors ──
  { id: "c1",  name: "Dorzolamide 2% Eye Drops",      generic: "Dorzolamide",   brand: "Trusopt",        strength: "2%",     form: "Eye Drops",  category: "CAI",             route: "Topical",       defaultDose: "1 drop" },
  { id: "c2",  name: "Brinzolamide 1% Eye Drops",     generic: "Brinzolamide",  brand: "Azopt",          strength: "1%",     form: "Eye Drops",  category: "CAI",             route: "Topical",       defaultDose: "1 drop" },
  { id: "c3",  name: "Acetazolamide 250mg Tablet",    generic: "Acetazolamide", brand: "Diamox",         strength: "250mg",  form: "Tablet",     category: "CAI (Oral)",      route: "Oral",          defaultDose: "1 tab" },
  { id: "c4",  name: "Acetazolamide 500mg Tablet",    generic: "Acetazolamide", brand: "Diamox SR",      strength: "500mg",  form: "Tablet",     category: "CAI (Oral)",      route: "Oral",          defaultDose: "1 tab" },

  // ── Combination Glaucoma ──
  { id: "co1", name: "Dorzolamide 2% + Timolol 0.5%", generic: "Dorzolamide + Timolol",   brand: "Cosopt",    strength: "2%/0.5%",      form: "Eye Drops", category: "Combination", route: "Topical", defaultDose: "1 drop" },
  { id: "co2", name: "Brimonidine 0.2% + Timolol 0.5%", generic: "Brimonidine + Timolol", brand: "Combigan",  strength: "0.2%/0.5%",    form: "Eye Drops", category: "Combination", route: "Topical", defaultDose: "1 drop" },
  { id: "co3", name: "Bimatoprost 0.03% + Timolol 0.5%", generic: "Bimatoprost + Timolol", brand: "Ganfort",  strength: "0.03%/0.5%",   form: "Eye Drops", category: "Combination", route: "Topical", defaultDose: "1 drop" },
  { id: "co4", name: "Latanoprost 0.005% + Timolol 0.5%", generic: "Latanoprost + Timolol", brand: "Xalacom", strength: "0.005%/0.5%",  form: "Eye Drops", category: "Combination", route: "Topical", defaultDose: "1 drop" },
  { id: "co5", name: "Travoprost 0.004% + Timolol 0.5%", generic: "Travoprost + Timolol",  brand: "DuoTrav",  strength: "0.004%/0.5%",  form: "Eye Drops", category: "Combination", route: "Topical", defaultDose: "1 drop" },

  // ── Antibiotics – Topical ──
  { id: "ab1",  name: "Ciprofloxacin 0.3% Eye Drops",   generic: "Ciprofloxacin",  brand: "Ciloxan",   strength: "0.3%",  form: "Eye Drops",  category: "Antibiotic", route: "Topical", defaultDose: "1 drop" },
  { id: "ab2",  name: "Moxifloxacin 0.5% Eye Drops",    generic: "Moxifloxacin",   brand: "Vigamox",   strength: "0.5%",  form: "Eye Drops",  category: "Antibiotic", route: "Topical", defaultDose: "1 drop" },
  { id: "ab3",  name: "Tobramycin 0.3% Eye Drops",      generic: "Tobramycin",     brand: "Tobrex",    strength: "0.3%",  form: "Eye Drops",  category: "Antibiotic", route: "Topical", defaultDose: "1 drop" },
  { id: "ab4",  name: "Gentamicin 0.3% Eye Drops",      generic: "Gentamicin",     strength: "0.3%",   form: "Eye Drops",  category: "Antibiotic", route: "Topical", defaultDose: "1 drop" },
  { id: "ab5",  name: "Ofloxacin 0.3% Eye Drops",       generic: "Ofloxacin",      strength: "0.3%",   form: "Eye Drops",  category: "Antibiotic", route: "Topical", defaultDose: "1 drop" },
  { id: "ab6",  name: "Levofloxacin 0.5% Eye Drops",    generic: "Levofloxacin",   strength: "0.5%",   form: "Eye Drops",  category: "Antibiotic", route: "Topical", defaultDose: "1 drop" },
  { id: "ab7",  name: "Gatifloxacin 0.3% Eye Drops",    generic: "Gatifloxacin",   brand: "Zymar",     strength: "0.3%",  form: "Eye Drops",  category: "Antibiotic", route: "Topical", defaultDose: "1 drop" },
  { id: "ab8",  name: "Azithromycin 1% Eye Drops",      generic: "Azithromycin",   brand: "AzaSite",   strength: "1%",    form: "Eye Drops",  category: "Antibiotic", route: "Topical", defaultDose: "1 drop" },
  { id: "ab9",  name: "Chloramphenicol 0.5% Eye Drops", generic: "Chloramphenicol", strength: "0.5%",  form: "Eye Drops",  category: "Antibiotic", route: "Topical", defaultDose: "1 drop" },
  { id: "ab10", name: "Chloramphenicol 1% Eye Ointment", generic: "Chloramphenicol", strength: "1%",   form: "Eye Ointment", category: "Antibiotic", route: "Topical", defaultDose: "small ribbon" },
  { id: "ab11", name: "Tobramycin 0.3% + Dexamethasone 0.1%", generic: "Tobramycin + Dexamethasone", brand: "Tobradex", strength: "0.3%/0.1%", form: "Eye Drops", category: "Antibiotic+Steroid", route: "Topical", defaultDose: "1 drop" },
  { id: "ab12", name: "Vancomycin 50mg/mL Fortified Eye Drops", generic: "Vancomycin", strength: "50mg/mL", form: "Fortified Eye Drops", category: "Antibiotic", route: "Topical", defaultDose: "1 drop" },
  { id: "ab13", name: "Cefazolin 50mg/mL Fortified Eye Drops",  generic: "Cefazolin",  strength: "50mg/mL", form: "Fortified Eye Drops", category: "Antibiotic", route: "Topical", defaultDose: "1 drop" },
  { id: "ab14", name: "Doxycycline 100mg Capsule",  generic: "Doxycycline",  strength: "100mg", form: "Capsule", category: "Antibiotic (Oral)", route: "Oral", defaultDose: "1 cap" },
  { id: "ab15", name: "Doxycycline 50mg Capsule",   generic: "Doxycycline",  strength: "50mg",  form: "Capsule", category: "Antibiotic (Oral)", route: "Oral", defaultDose: "1 cap" },

  // ── Steroids – Topical ──
  { id: "st1",  name: "Prednisolone 1% Eye Drops",       generic: "Prednisolone",    brand: "Pred Forte", strength: "1%",    form: "Eye Drops",   category: "Steroid",         route: "Topical", defaultDose: "1 drop" },
  { id: "st2",  name: "Prednisolone 0.5% Eye Drops",     generic: "Prednisolone",    brand: "Pred Mild",  strength: "0.5%",  form: "Eye Drops",   category: "Steroid",         route: "Topical", defaultDose: "1 drop" },
  { id: "st3",  name: "Dexamethasone 0.1% Eye Drops",    generic: "Dexamethasone",   strength: "0.1%",    form: "Eye Drops",   category: "Steroid",         route: "Topical", defaultDose: "1 drop" },
  { id: "st4",  name: "Fluorometholone 0.1% Eye Drops",  generic: "Fluorometholone", brand: "FML",        strength: "0.1%",  form: "Eye Drops",   category: "Steroid",         route: "Topical", defaultDose: "1 drop" },
  { id: "st5",  name: "Loteprednol 0.5% Eye Drops",      generic: "Loteprednol",     brand: "Lotemax",   strength: "0.5%",  form: "Eye Drops",   category: "Steroid",         route: "Topical", defaultDose: "1 drop" },
  { id: "st6",  name: "Loteprednol 0.2% Eye Drops",      generic: "Loteprednol",     brand: "Alrex",     strength: "0.2%",  form: "Eye Drops",   category: "Steroid",         route: "Topical", defaultDose: "1 drop" },
  { id: "st7",  name: "Difluprednate 0.05% Eye Drops",   generic: "Difluprednate",   brand: "Durezol",   strength: "0.05%", form: "Eye Drops",   category: "Steroid",         route: "Topical", defaultDose: "1 drop" },
  { id: "st8",  name: "Rimexolone 1% Eye Drops",         generic: "Rimexolone",      brand: "Vexol",     strength: "1%",    form: "Eye Drops",   category: "Steroid",         route: "Topical", defaultDose: "1 drop" },
  { id: "st9",  name: "Dexamethasone 0.1% Eye Ointment", generic: "Dexamethasone",   strength: "0.1%",    form: "Eye Ointment", category: "Steroid",      route: "Topical", defaultDose: "small ribbon" },
  { id: "st10", name: "Triamcinolone 40mg/mL Injection",       generic: "Triamcinolone",     brand: "Kenalog",      strength: "40mg/mL", form: "Injection", category: "Steroid",       route: "Subtenon",  defaultDose: "0.5mL" },
  { id: "st11", name: "Methylprednisolone 40mg/mL Injection",  generic: "Methylprednisolone", brand: "Depo-Medrol", strength: "40mg/mL", form: "Injection", category: "Steroid",       route: "IM",        defaultDose: "1mL" },
  { id: "st12", name: "Prednisolone 10mg Tablet",  generic: "Prednisolone", strength: "10mg", form: "Tablet", category: "Steroid (Oral)", route: "Oral", defaultDose: "1 tab" },
  { id: "st13", name: "Prednisolone 5mg Tablet",   generic: "Prednisolone", strength: "5mg",  form: "Tablet", category: "Steroid (Oral)", route: "Oral", defaultDose: "1 tab" },

  // ── NSAIDs ──
  { id: "ns1", name: "Ketorolac 0.5% Eye Drops",   generic: "Ketorolac",  brand: "Acular",   strength: "0.5%",  form: "Eye Drops", category: "NSAID",       route: "Topical", defaultDose: "1 drop" },
  { id: "ns2", name: "Diclofenac 0.1% Eye Drops",  generic: "Diclofenac", brand: "Voltaren", strength: "0.1%",  form: "Eye Drops", category: "NSAID",       route: "Topical", defaultDose: "1 drop" },
  { id: "ns3", name: "Bromfenac 0.09% Eye Drops",  generic: "Bromfenac",  brand: "Xibrom",   strength: "0.09%", form: "Eye Drops", category: "NSAID",       route: "Topical", defaultDose: "1 drop" },
  { id: "ns4", name: "Nepafenac 0.1% Eye Drops",   generic: "Nepafenac",  brand: "Nevanac",  strength: "0.1%",  form: "Eye Drops", category: "NSAID",       route: "Topical", defaultDose: "1 drop" },
  { id: "ns5", name: "Ibuprofen 400mg Tablet",      generic: "Ibuprofen",  strength: "400mg", form: "Tablet",    category: "NSAID (Oral)", route: "Oral", defaultDose: "1 tab" },

  // ── Dry Eye / Lubricants ──
  { id: "de1",  name: "Sodium Hyaluronate 0.1% Eye Drops",   generic: "Sodium Hyaluronate",  strength: "0.1%",   form: "Eye Drops",  category: "Lubricant", route: "Topical", defaultDose: "1 drop" },
  { id: "de2",  name: "Sodium Hyaluronate 0.2% Eye Drops",   generic: "Sodium Hyaluronate",  strength: "0.2%",   form: "Eye Drops",  category: "Lubricant", route: "Topical", defaultDose: "1 drop" },
  { id: "de3",  name: "Sodium Hyaluronate 0.4% Eye Drops",   generic: "Sodium Hyaluronate",  strength: "0.4%",   form: "Eye Drops",  category: "Lubricant", route: "Topical", defaultDose: "1 drop" },
  { id: "de4",  name: "Carboxymethylcellulose 0.5% Eye Drops", generic: "Carboxymethylcellulose", brand: "Refresh",      strength: "0.5%", form: "Eye Drops", category: "Lubricant", route: "Topical", defaultDose: "1 drop" },
  { id: "de5",  name: "Carboxymethylcellulose 1% Eye Drops",   generic: "Carboxymethylcellulose", brand: "Refresh Plus", strength: "1%",   form: "Eye Drops", category: "Lubricant", route: "Topical", defaultDose: "1 drop" },
  { id: "de6",  name: "Hydroxypropyl Methylcellulose 0.3% Eye Drops", generic: "HPMC", brand: "GenTeal", strength: "0.3%", form: "Eye Drops", category: "Lubricant", route: "Topical", defaultDose: "1 drop" },
  { id: "de7",  name: "Polyethylene Glycol 0.4% Eye Drops",  generic: "Polyethylene Glycol",  brand: "Systane",   strength: "0.4%",  form: "Eye Drops",    category: "Lubricant", route: "Topical", defaultDose: "1 drop" },
  { id: "de8",  name: "Carbomer 0.2% Eye Gel",               generic: "Carbomer",             brand: "Viscotears", strength: "0.2%", form: "Eye Gel",      category: "Lubricant", route: "Topical", defaultDose: "small ribbon" },
  { id: "de9",  name: "Lubricant Eye Ointment",              generic: "White Soft Paraffin + Liquid Paraffin", brand: "Lacrilube", strength: "—", form: "Eye Ointment", category: "Lubricant", route: "Topical", defaultDose: "small ribbon" },
  { id: "de10", name: "Cyclosporine 0.05% Eye Drops",        generic: "Cyclosporine",  brand: "Restasis", strength: "0.05%", form: "Eye Drops", category: "Immunomodulator", route: "Topical", defaultDose: "1 drop" },
  { id: "de11", name: "Cyclosporine 0.1% Eye Drops",         generic: "Cyclosporine",  brand: "Ikervis",  strength: "0.1%",  form: "Eye Drops", category: "Immunomodulator", route: "Topical", defaultDose: "1 drop" },
  { id: "de12", name: "Lifitegrast 5% Eye Drops",            generic: "Lifitegrast",   brand: "Xiidra",   strength: "5%",    form: "Eye Drops", category: "Immunomodulator", route: "Topical", defaultDose: "1 drop" },

  // ── Antivirals ──
  { id: "av1", name: "Acyclovir 3% Eye Ointment",    generic: "Acyclovir",     brand: "Zovirax",  strength: "3%",    form: "Eye Ointment", category: "Antiviral",       route: "Topical", defaultDose: "small ribbon" },
  { id: "av2", name: "Ganciclovir 0.15% Eye Gel",    generic: "Ganciclovir",   brand: "Zirgan",   strength: "0.15%", form: "Eye Gel",     category: "Antiviral",       route: "Topical", defaultDose: "1 drop" },
  { id: "av3", name: "Trifluridine 1% Eye Drops",    generic: "Trifluridine",  brand: "Viroptic", strength: "1%",    form: "Eye Drops",   category: "Antiviral",       route: "Topical", defaultDose: "1 drop" },
  { id: "av4", name: "Acyclovir 400mg Tablet",       generic: "Acyclovir",     brand: "Zovirax",  strength: "400mg", form: "Tablet",      category: "Antiviral (Oral)", route: "Oral",   defaultDose: "1 tab" },
  { id: "av5", name: "Valacyclovir 500mg Tablet",    generic: "Valacyclovir",  brand: "Valtrex",  strength: "500mg", form: "Tablet",      category: "Antiviral (Oral)", route: "Oral",   defaultDose: "1 tab" },
  { id: "av6", name: "Famciclovir 250mg Tablet",     generic: "Famciclovir",   brand: "Famvir",   strength: "250mg", form: "Tablet",      category: "Antiviral (Oral)", route: "Oral",   defaultDose: "1 tab" },

  // ── Antifungals ──
  { id: "af1", name: "Natamycin 5% Eye Drops",       generic: "Natamycin",    brand: "Natacyn",  strength: "5%",    form: "Eye Drops", category: "Antifungal",       route: "Topical", defaultDose: "1 drop" },
  { id: "af2", name: "Voriconazole 1% Eye Drops",    generic: "Voriconazole", strength: "1%",    form: "Eye Drops",   category: "Antifungal",       route: "Topical", defaultDose: "1 drop" },
  { id: "af3", name: "Amphotericin B 0.15% Eye Drops", generic: "Amphotericin B", strength: "0.15%", form: "Eye Drops", category: "Antifungal",    route: "Topical", defaultDose: "1 drop" },
  { id: "af4", name: "Fluconazole 150mg Tablet",     generic: "Fluconazole",  brand: "Diflucan", strength: "150mg", form: "Tablet",    category: "Antifungal (Oral)", route: "Oral",    defaultDose: "1 tab" },

  // ── Antiallergic ──
  { id: "al1",  name: "Olopatadine 0.1% Eye Drops",      generic: "Olopatadine",        brand: "Patanol",  strength: "0.1%",   form: "Eye Drops", category: "Antiallergic",      route: "Topical", defaultDose: "1 drop" },
  { id: "al2",  name: "Olopatadine 0.2% Eye Drops",      generic: "Olopatadine",        brand: "Pataday",  strength: "0.2%",   form: "Eye Drops", category: "Antiallergic",      route: "Topical", defaultDose: "1 drop" },
  { id: "al3",  name: "Ketotifen 0.025% Eye Drops",      generic: "Ketotifen",          brand: "Zaditor",  strength: "0.025%", form: "Eye Drops", category: "Antiallergic",      route: "Topical", defaultDose: "1 drop" },
  { id: "al4",  name: "Azelastine 0.05% Eye Drops",      generic: "Azelastine",         brand: "Optivar",  strength: "0.05%",  form: "Eye Drops", category: "Antiallergic",      route: "Topical", defaultDose: "1 drop" },
  { id: "al5",  name: "Epinastine 0.05% Eye Drops",      generic: "Epinastine",         brand: "Elestat",  strength: "0.05%",  form: "Eye Drops", category: "Antiallergic",      route: "Topical", defaultDose: "1 drop" },
  { id: "al6",  name: "Emedastine 0.05% Eye Drops",      generic: "Emedastine",         brand: "Emadine",  strength: "0.05%",  form: "Eye Drops", category: "Antiallergic",      route: "Topical", defaultDose: "1 drop" },
  { id: "al7",  name: "Lodoxamide 0.1% Eye Drops",       generic: "Lodoxamide",         brand: "Alomide",  strength: "0.1%",   form: "Eye Drops", category: "Mast Cell Stabilizer", route: "Topical", defaultDose: "1 drop" },
  { id: "al8",  name: "Sodium Cromoglycate 2% Eye Drops", generic: "Sodium Cromoglycate", brand: "Opticrom", strength: "2%",   form: "Eye Drops", category: "Mast Cell Stabilizer", route: "Topical", defaultDose: "1 drop" },
  { id: "al9",  name: "Cetirizine 10mg Tablet",          generic: "Cetirizine",  brand: "Zyrtec",    strength: "10mg",   form: "Tablet",    category: "Antihistamine (Oral)", route: "Oral",    defaultDose: "1 tab" },
  { id: "al10", name: "Loratadine 10mg Tablet",          generic: "Loratadine",  brand: "Claritin",  strength: "10mg",   form: "Tablet",    category: "Antihistamine (Oral)", route: "Oral",    defaultDose: "1 tab" },

  // ── Mydriatics / Cycloplegics ──
  { id: "my1", name: "Tropicamide 1% Eye Drops",        generic: "Tropicamide",     brand: "Mydriacyl", strength: "1%",   form: "Eye Drops", category: "Mydriatic",     route: "Topical", defaultDose: "1 drop" },
  { id: "my2", name: "Tropicamide 0.5% Eye Drops",      generic: "Tropicamide",     strength: "0.5%",  form: "Eye Drops",  category: "Mydriatic",     route: "Topical", defaultDose: "1 drop" },
  { id: "my3", name: "Cyclopentolate 1% Eye Drops",     generic: "Cyclopentolate",  brand: "Cyclogyl", strength: "1%",   form: "Eye Drops", category: "Cycloplegic",   route: "Topical", defaultDose: "1 drop" },
  { id: "my4", name: "Atropine 1% Eye Drops",           generic: "Atropine",        strength: "1%",    form: "Eye Drops", category: "Cycloplegic",   route: "Topical", defaultDose: "1 drop" },
  { id: "my5", name: "Atropine 0.5% Eye Drops",         generic: "Atropine",        strength: "0.5%",  form: "Eye Drops", category: "Cycloplegic",   route: "Topical", defaultDose: "1 drop" },
  { id: "my6", name: "Atropine 0.01% Eye Drops",        generic: "Atropine",        strength: "0.01%", form: "Eye Drops", category: "Myopia Control", route: "Topical", defaultDose: "1 drop" },
  { id: "my7", name: "Phenylephrine 2.5% Eye Drops",    generic: "Phenylephrine",   strength: "2.5%",  form: "Eye Drops", category: "Mydriatic",     route: "Topical", defaultDose: "1 drop" },
  { id: "my8", name: "Phenylephrine 10% Eye Drops",     generic: "Phenylephrine",   strength: "10%",   form: "Eye Drops", category: "Mydriatic",     route: "Topical", defaultDose: "1 drop" },
  { id: "my9", name: "Homatropine 2% Eye Drops",        generic: "Homatropine",     strength: "2%",    form: "Eye Drops", category: "Cycloplegic",   route: "Topical", defaultDose: "1 drop" },

  // ── Anti-VEGF (Intravitreal) ──
  { id: "vg1", name: "Bevacizumab 1.25mg Intravitreal",  generic: "Bevacizumab",    brand: "Avastin",  strength: "1.25mg/0.05mL", form: "Intravitreal Inj.", category: "Anti-VEGF", route: "Intravitreal", defaultDose: "0.05mL" },
  { id: "vg2", name: "Ranibizumab 0.5mg Intravitreal",   generic: "Ranibizumab",    brand: "Lucentis", strength: "0.5mg/0.05mL",  form: "Intravitreal Inj.", category: "Anti-VEGF", route: "Intravitreal", defaultDose: "0.05mL" },
  { id: "vg3", name: "Aflibercept 2mg Intravitreal",     generic: "Aflibercept",    brand: "Eylea",    strength: "2mg/0.05mL",    form: "Intravitreal Inj.", category: "Anti-VEGF", route: "Intravitreal", defaultDose: "0.05mL" },
  { id: "vg4", name: "Brolucizumab 6mg Intravitreal",    generic: "Brolucizumab",   brand: "Beovu",    strength: "6mg/0.05mL",    form: "Intravitreal Inj.", category: "Anti-VEGF", route: "Intravitreal", defaultDose: "0.05mL" },
  { id: "vg5", name: "Triamcinolone 4mg Intravitreal",   generic: "Triamcinolone",  brand: "Kenalog",  strength: "4mg/0.1mL",     form: "Intravitreal Inj.", category: "Anti-VEGF", route: "Intravitreal", defaultDose: "0.1mL" },

  // ── Hyperosmotic ──
  { id: "ho1", name: "Mannitol 20% IV Infusion",    generic: "Mannitol",  strength: "20%",    form: "IV Infusion",    category: "Hyperosmotic", route: "IV",   defaultDose: "1–2g/kg" },
  { id: "ho2", name: "Glycerol 50% Oral Solution",  generic: "Glycerol",  strength: "50%",    form: "Oral Solution",  category: "Hyperosmotic", route: "Oral", defaultDose: "1–1.5g/kg" },

  // ── Decongestants ──
  { id: "dc1", name: "Naphazoline 0.1% Eye Drops",     generic: "Naphazoline",      brand: "Clear Eyes", strength: "0.1%",  form: "Eye Drops", category: "Decongestant", route: "Topical", defaultDose: "1 drop" },
  { id: "dc2", name: "Tetrahydrozoline 0.05% Eye Drops", generic: "Tetrahydrozoline", brand: "Visine",   strength: "0.05%", form: "Eye Drops", category: "Decongestant", route: "Topical", defaultDose: "1 drop" },

  // ── Miotics ──
  { id: "mi1", name: "Pilocarpine 1% Eye Drops",  generic: "Pilocarpine", strength: "1%",  form: "Eye Drops", category: "Miotic", route: "Topical", defaultDose: "1 drop" },
  { id: "mi2", name: "Pilocarpine 2% Eye Drops",  generic: "Pilocarpine", strength: "2%",  form: "Eye Drops", category: "Miotic", route: "Topical", defaultDose: "1 drop" },
  { id: "mi3", name: "Pilocarpine 4% Eye Drops",  generic: "Pilocarpine", strength: "4%",  form: "Eye Drops", category: "Miotic", route: "Topical", defaultDose: "1 drop" },

  // ── Vitamins / Supplements ──
  { id: "vi1", name: "AREDS2 Eye Supplement",  generic: "Lutein + Zeaxanthin + Vit C + Vit E + Zinc", strength: "—", form: "Capsule", category: "Supplement", route: "Oral", defaultDose: "1 cap" },
  { id: "vi2", name: "Lutein 10mg Capsule",    generic: "Lutein",    strength: "10mg", form: "Capsule", category: "Supplement", route: "Oral", defaultDose: "1 cap" },
  { id: "vi3", name: "Vitamin A 5000 IU Eye Drops", generic: "Vitamin A Palmitate", strength: "5000 IU/mL", form: "Eye Drops", category: "Vitamin", route: "Topical", defaultDose: "1 drop" },

  // ── Surgical / Antimetabolites ──
  { id: "su1", name: "5-Fluorouracil 50mg/mL Injection",  generic: "5-Fluorouracil", strength: "50mg/mL", form: "Injection",  category: "Antimetabolite", route: "Subconjunctival", defaultDose: "0.1mL" },
  { id: "su2", name: "Mitomycin C 0.2mg/mL Solution",     generic: "Mitomycin C",    strength: "0.2mg/mL", form: "Solution",  category: "Antimetabolite", route: "Topical",          defaultDose: "as directed" },

  // ── Topical Anaesthetics ──
  { id: "ta1", name: "Proxymetacaine 0.5% Eye Drops", generic: "Proxymetacaine", brand: "Proparacaine", strength: "0.5%",  form: "Eye Drops", category: "Topical Anaesthetic", route: "Topical", defaultDose: "1 drop" },
  { id: "ta2", name: "Oxybuprocaine 0.4% Eye Drops",  generic: "Oxybuprocaine",  brand: "Benoxinate",   strength: "0.4%",  form: "Eye Drops", category: "Topical Anaesthetic", route: "Topical", defaultDose: "1 drop" },
  { id: "ta3", name: "Tetracaine 0.5% Eye Drops",     generic: "Tetracaine",     strength: "0.5%",      form: "Eye Drops", category: "Topical Anaesthetic", route: "Topical", defaultDose: "1 drop" },

  // ── Antiseptics ──
  { id: "pi1", name: "Povidone Iodine 5% Eye Drops",   generic: "Povidone Iodine", brand: "Betadine", strength: "5%",   form: "Eye Drops", category: "Antiseptic", route: "Topical", defaultDose: "1 drop" },
  { id: "pi2", name: "Povidone Iodine 0.5% Eye Drops", generic: "Povidone Iodine", brand: "Betadine", strength: "0.5%", form: "Eye Drops", category: "Antiseptic", route: "Topical", defaultDose: "1 drop" },

  // ── Analgesics ──
  { id: "an1", name: "Paracetamol 500mg Tablet",  generic: "Paracetamol", brand: "Calpol", strength: "500mg", form: "Tablet",  category: "Analgesic", route: "Oral", defaultDose: "1–2 tabs" },
  { id: "an2", name: "Tramadol 50mg Capsule",     generic: "Tramadol",    brand: "Ultram", strength: "50mg",  form: "Capsule", category: "Analgesic", route: "Oral", defaultDose: "1 cap" },
];

export function searchMedications(query: string, limit = 8): MedEntry[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return OPHTHALMIC_MEDICATIONS
    .filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.generic.toLowerCase().includes(q) ||
        (m.brand?.toLowerCase().includes(q) ?? false)
    )
    .sort((a, b) => {
      const aStart =
        a.name.toLowerCase().startsWith(q) || a.generic.toLowerCase().startsWith(q) ? -1 : 0;
      const bStart =
        b.name.toLowerCase().startsWith(q) || b.generic.toLowerCase().startsWith(q) ? -1 : 0;
      return aStart - bStart;
    })
    .slice(0, limit);
}

export function categoryColor(category: string): string {
  if (category.includes("Antibiotic"))       return "bg-blue-50 text-blue-700 border-blue-200";
  if (category.includes("Steroid"))          return "bg-orange-50 text-orange-700 border-orange-200";
  if (category.includes("NSAID"))            return "bg-amber-50 text-amber-700 border-amber-200";
  if (category.includes("Lubricant") || category.includes("Immunomodulator")) return "bg-sky-50 text-sky-700 border-sky-200";
  if (["Beta-blocker","Prostaglandin","Alpha-agonist","CAI","Miotic","Combination"].some((k) => category.includes(k)))
    return "bg-purple-50 text-purple-700 border-purple-200";
  if (category.includes("Antiviral"))        return "bg-rose-50 text-rose-700 border-rose-200";
  if (category.includes("Antifungal"))       return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (category.includes("Antiallergic") || category.includes("Mast Cell") || category.includes("Antihistamine"))
    return "bg-pink-50 text-pink-700 border-pink-200";
  if (category.includes("Mydriatic") || category.includes("Cycloplegic") || category.includes("Myopia"))
    return "bg-indigo-50 text-indigo-700 border-indigo-200";
  if (category.includes("Anti-VEGF"))        return "bg-teal-50 text-teal-700 border-teal-200";
  if (category.includes("Supplement") || category.includes("Vitamin"))
    return "bg-lime-50 text-lime-700 border-lime-200";
  if (category.includes("Analgesic"))        return "bg-yellow-50 text-yellow-700 border-yellow-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
}
