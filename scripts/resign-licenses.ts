// Re-sign every TenantLicense row with the current LICENSE_SECRET.
//
// Run after rotating the signing secret, otherwise every existing license
// fails the integrity check and blocks login:
//   LICENSE_SECRET=<secret> npx tsx scripts/resign-licenses.ts
//
// The same secret must be set in every environment (local .env + Vercel).

import { PrismaClient } from "@prisma/client";
import { computeLicenseSignature } from "../src/lib/license-sign";

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.tenantLicense.findMany();
  console.log(`Re-signing ${rows.length} license row(s)…\n`);

  for (const row of rows) {
    const signature = computeLicenseSignature(row);
    await prisma.tenantLicense.update({
      where: { doctorId: row.doctorId },
      data: { signature },
    });
    console.log(`  ${row.doctorId}  →  ${signature.slice(0, 12)}…`);
  }

  console.log("\nDone.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
