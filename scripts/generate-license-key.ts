// Mint signed license keys and record them in the IssuedLicenseKey registry.
//
// Usage:
//   npx tsx scripts/generate-license-key.ts                       → 1 key, 12 months
//   npx tsx scripts/generate-license-key.ts 5                     → 5 keys, 12 months
//   npx tsx scripts/generate-license-key.ts 1 24 "Dr. Kumar"      → 1 key, 24 months, noted
//
// Requires LICENSE_SECRET (or AUTH_SECRET) in .env — keys minted with a
// different secret will not verify on the server.

import { PrismaClient } from "@prisma/client";
import { generateLicenseKey } from "../src/lib/license-key";

const prisma = new PrismaClient();

async function main() {
  const count = Math.min(Number(process.argv[2] ?? 1) || 1, 50);
  const months = Math.min(Math.max(Number(process.argv[3] ?? 12) || 12, 1), 60);
  const note = process.argv[4] ?? null;

  console.log(`Minting ${count} key(s) — ${months} month(s) each${note ? ` — note: ${note}` : ""}\n`);

  for (let i = 0; i < count; i++) {
    const key = generateLicenseKey();
    await prisma.issuedLicenseKey.create({ data: { key, months, note } });
    console.log(`  ${key}`);
  }

  console.log(`\nDone. Keys are single-use and tracked in the IssuedLicenseKey table.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
