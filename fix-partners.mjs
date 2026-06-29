import { readFileSync, writeFileSync } from "fs";

const path = String.raw`C:\Users\ELCOT\Desktop\RFConnector\RF Connector\chargebridge\portal\src\pages\ClientPortal.tsx`;
let c = readFileSync(path, "utf8");

// Partner name replacements (order matters: longer/more specific first)
const partners = [
  ["Allego Netherlands", "ECG (Electricity Co. Ghana)"],
  ["Allego NL",          "ECG Ghana"],
  ["TotalEnergies",      "Total Energies Ghana"],
  ["Total Energies",     "Total Energies Ghana"],
  ["Ionity",             "Goil EV Network"],
  ["Fastned",            "VRA EV Charge"],
  ["EVBox Germany",      "Shell Ghana EV"],
  ["EVBox",              "Shell Ghana EV"],
  ["ChargePoint EU",     "GreenMobility GH"],
  ["ChargePoint",        "GreenMobility GH"],
  ["Virta",              "Eletrobras EV Brasil"],
  ["Volta Networks",     "Volta Networks"],  // keep as-is (it's the operator)
];

for (const [from, to] of partners) {
  // skip no-op
  if (from === to) continue;
  c = c.split(from).join(to);
}

// Fix country codes that were NL/DE/FR/FI → GH/GH/GH/BR
// Partner-specific country code fixes in data objects
c = c.replace(/'ALG-NL-/g,   "'ECG-GH-");
c = c.replace(/'TOT-FR-/g,   "'TOT-GH-");
c = c.replace(/'ION-DE-/g,   "'GOI-GH-");
c = c.replace(/'FAB-NL-/g,   "'VRA-GH-");
c = c.replace(/'FAB-DE-/g,   "'VRA-GH-");
c = c.replace(/'EVB-DE-/g,   "'SHG-GH-");
c = c.replace(/'VIR-FI-/g,   "'ELB-BR-");

// Country field strings in CDR/partner data
// country:'NL' for Allego -> GH, country:'FR' for Total -> GH, country:'DE' for ION/EVB -> GH
// We'll fix these by EVSE prefix context — already done above via EVSE codes
// Also fix country field in CDR rows — do targeted replacements
c = c.replace(/partner:'ECG Ghana',\s*country:'NL'/g,  "partner:'ECG Ghana', country:'GH'");
c = c.replace(/partner:'Total Energies Ghana',\s*country:'FR'/g, "partner:'Total Energies Ghana', country:'GH'");
c = c.replace(/partner:'Goil EV Network',\s*country:'DE'/g, "partner:'Goil EV Network', country:'GH'");
c = c.replace(/partner:'VRA EV Charge',\s*country:'NL'/g, "partner:'VRA EV Charge', country:'GH'");
c = c.replace(/partner:'VRA EV Charge',\s*country:'DE'/g, "partner:'VRA EV Charge', country:'GH'");
c = c.replace(/partner:'Shell Ghana EV',\s*country:'DE'/g, "partner:'Shell Ghana EV', country:'GH'");
c = c.replace(/partner:'Eletrobras EV Brasil',\s*country:'FI'/g, "partner:'Eletrobras EV Brasil', country:'BR'");

// Protocol fixes: eMIP 3.x was Ionity/EVBox — change to OCPI 2.2 for Ghana partners
c = c.replace(/partner:'Goil EV Network',[^}]*protocol:'eMIP 3\.x'/g, m => m.replace("eMIP 3.x", "OCPI 2.2"));

// Fix EMAID tokens that referenced DE*ION and FI*VIR
c = c.replace(/EMAID DE\*ION\*E\d+/g, "RFID-GOI-GH01");
c = c.replace(/EMAID FI\*VIR\*X\d+/g, "RFID-ELB-BR01");

writeFileSync(path, c, "utf8");
console.log("Done");
