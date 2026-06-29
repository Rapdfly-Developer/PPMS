import { readFileSync, writeFileSync } from "fs";
const path = String.raw`C:\Users\ELCOT\Desktop\RFConnector\RF Connector\chargebridge\portal\src\pages\ClientPortal.tsx`;
let c = readFileSync(path, "utf8");

// Country code fixes for partners
c = c.split("name:'ECG Ghana',      country:'NL'").join("name:'ECG Ghana',      country:'GH'");
c = c.split("name:'Goil EV Network',         country:'DE'").join("name:'Goil EV Network',         country:'GH'");
c = c.split("name:'Total Energies Ghana',  country:'FR'").join("name:'Total Energies Ghana',  country:'GH'");
c = c.split("name:'Shell Ghana EV',  country:'DE'").join("name:'Shell Ghana EV',  country:'GH'");
c = c.split("name:'Eletrobras EV Brasil',          country:'FI'").join("name:'Eletrobras EV Brasil',          country:'BR'");
c = c.split("name:'VRA EV Charge',        country:'NL'").join("name:'VRA EV Charge',        country:'GH'");

// Goil protocol fix
c = c.split("name:'Goil EV Network',         country:'GH', sessions:512, status:'online',  latency:'55ms', uptime:'99.8%', cdrs:1440, protocol:'eMIP 3.x'").join("name:'Goil EV Network',         country:'GH', sessions:512, status:'online',  latency:'55ms', uptime:'99.8%', cdrs:1440, protocol:'OCPI 2.2'");

// Session data city fixes
c = c.split("country:'GH', city:'Amsterdam'").join("country:'GH', city:'Accra'");
c = c.split("country:'FR', city:'Paris'").join("country:'GH', city:'Kumasi'");
c = c.split("country:'BR', city:'Helsinki'").join("country:'BR', city:'Sao Paulo'");
c = c.split("country:'GH', city:'Berlin'").join("country:'GH', city:'Tema'");

// CDR country fixes
c = c.replace(/partner:'Total Energies Ghana', country:'FR'/g, "partner:'Total Energies Ghana', country:'GH'");
c = c.replace(/partner:'Goil EV Network',\s*country:'DE'/g, "partner:'Goil EV Network', country:'GH'");
c = c.replace(/partner:'Shell Ghana EV',\s*country:'DE'/g, "partner:'Shell Ghana EV', country:'GH'");
c = c.replace(/partner:'VRA EV Charge',\s*country:'NL'/g, "partner:'VRA EV Charge', country:'GH'");
c = c.replace(/partner:'Eletrobras EV Brasil',\s*country:'FI'/g, "partner:'Eletrobras EV Brasil', country:'BR'");

// Event log country fixes
c = c.replace(/partner:'Total Energies Ghana', country:'FR'/g, "partner:'Total Energies Ghana', country:'GH'");

// Fix Amsterdam/Berlin/Paris/Helsinki city references in sessions
c = c.split("city:'Amsterdam'").join("city:'Accra'");
c = c.split("city:'Berlin'").join("city:'Tema'");
c = c.split("city:'Paris'").join("city:'Kumasi'");
c = c.split("city:'Helsinki'").join("city:'Sao Paulo'");

// Fix EVSE location names
c = c.split("'Amsterdam Zuid'").join("'Accra Central'");
c = c.split("Amsterdam Zuid").join("Accra Central");
c = c.split("Amsterdam").join("Accra");
c = c.split("Berlin").join("Accra");
c = c.split("Paris Est Depot").join("Kumasi Depot");
c = c.split("Paris").join("Kumasi");
c = c.split("Helsinki").join("Sao Paulo");

// Fix tariff codes that reference EU
c = c.split("TARIFF-EU-STD-01").join("TARIFF-GH-STD-01");
c = c.split("TARIFF-EU-ECO-03").join("TARIFF-GH-ECO-03");
c = c.split("TARIFF-EU-DC-01").join("TARIFF-GH-DC-01");
c = c.split("TARIFF-FR-BIL-03").join("TARIFF-GH-BIL-03");
c = c.split("TARIFF-DE-BIL-02").join("TARIFF-GH-BIL-02");
c = c.split("TARIFF-ALG-DC50").join("TARIFF-ECG-DC50");

// Fix negotiation subject
c = c.split("France bilateral renewal").join("Ghana bilateral renewal");
c = c.split("France-specific regulatory requirements apply.").join("Ghana regulatory requirements apply.");

// Fix NL/DE/FR country codes in EVSE IDs
c = c.split("EVSE-NL-").join("EVSE-GH-");

// Fix email references with European domains
c = c.split("EMAID FR*TOT*E").join("RFID-TOT-GH-E");

// Fix Netherlands/Amsterdam in address
c = c.split("Netherlands").join("Ghana");

writeFileSync(path, c, "utf8");
console.log("Done");
