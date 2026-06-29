import { readFileSync, writeFileSync } from 'fs';
const path = String.raw`C:\Users\ELCOT\Desktop\RFConnector\RF Connector\chargebridge\portal\src\pages\ClientPortal.tsx`;
let content = readFileSync(path, 'utf8');
// Mojibake euro = U+00E2 + U+201A + U+00AC
const mojiEuro = 'â‚¬';
const cedi = '₵';
content = content.split(mojiEuro).join(cedi);
content = content.split('€').join(cedi);
content = content.replace(/EUR0\./g, 'GHS0.');
content = content.replace(/\bEUR\b/g, 'GHS');
content = content.replace(/\beuro\b/g, 'cedi');
content = content.replace(/\bEuro\b/g, 'Cedi');
writeFileSync(path, content, 'utf8');
console.log('Done - replacements complete');
