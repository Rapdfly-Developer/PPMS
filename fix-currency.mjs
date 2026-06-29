import { readFileSync, writeFileSync } from 'fs';

const path = String.raw`C:\Users\ELCOT\Desktop\RFConnector\RF Connector\chargebridge\portal\src\pages\ClientPortal.tsx`;
let content = readFileSync(path, 'utf8');

// Mojibake euro: UTF-8 bytes E2 82 AC misread as windows-1252
// = U+00E2 + U+201A + U+00AC
const mojiEuro = 'â‚¬';
const cedi = '₵'; // ₵ Ghanaian Cedi

content = content.split(mojiEuro).join(cedi);

// Catch any literal euro sign too
content = content.split('€').join(cedi);

// Replace EUR currency code
content = content.replace(/EUR0\./g, 'GHS0.');
content = content.replace(/\bEUR\b/g, 'GHS');

// Replace euro/Euro words
content = content.replace(/\beuro\b/g, 'cedi');
content = content.replace(/\bEuro\b/g, 'Cedi');

writeFileSync(path, content, 'utf8');
console.log('Done');
