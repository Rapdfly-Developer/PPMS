import { readFileSync, writeFileSync } from "fs";

const path = String.raw`C:\Users\ELCOT\Desktop\RFConnector\RF Connector\chargebridge\portal\src\pages\ClientPortal.tsx`;
let c = readFileSync(path, "utf8");

// Fix JSX expressions: ₵{expr} -> ₵ {expr}  (but not ₵0.xx/kWh tariff rates)
c = c.replace(/₵\{/g, "₵ {");

// Fix string literals: ₵NUMBER -> ₵ NUMBER (skip ₵0.xx/kWh tariff rates)
// Match ₵ followed by a digit (not a per-unit rate like ₵0.34/kWh)
c = c.replace(/₵(\d)/g, (match, d) => `₵ ${d}`);

writeFileSync(path, c, "utf8");
console.log("Done");
