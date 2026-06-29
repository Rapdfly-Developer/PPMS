import { readFileSync, writeFileSync } from "fs";
const path = String.raw`C:\Users\ELCOT\Desktop\RFConnector\RF Connector\chargebridge\portal\src\pages\ClientPortal.tsx`;
let c = readFileSync(path, "utf8");

// Fix doubled name
c = c.split("Total Energies Ghana Ghana").join("Total Energies Ghana");

// Fix Goil eMIP -> OCPI
c = c.split("name:'Goil EV Network',        proto:'eMIP 3.x'").join("name:'Goil EV Network',        proto:'OCPI 2.2'");

writeFileSync(path, c, "utf8");
console.log("Done");
