/**
 * Backfill script:
 *  1. Copy existing udid → uhid for all patients (hospital-based IDs preserved)
 *  2. Generate new doctor-based udid for every patient
 * Run once: npx ts-node --skip-project scripts/backfill-udid.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Step 1: copy existing udid → uhid
  await prisma.$executeRawUnsafe(`UPDATE "Patient" SET uhid = udid WHERE uhid IS NULL`);
  console.log("✓ Copied udid → uhid for all patients");

  // Clear old udid values so we can re-generate without unique conflicts
  await prisma.$executeRawUnsafe(`UPDATE "Patient" SET udid = NULL`);
  console.log("✓ Cleared old udid values");

  // Step 2: fetch all patients with their doctor's shortCode
  const patients = await prisma.patient.findMany({
    select: {
      id: true,
      doctor: { select: { shortCode: true } },
      registeredAt: { select: { shortCode: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Generating new udid for ${patients.length} patients...`);

  // Track per-prefix counters
  const counters: Record<string, number> = {};

  for (const p of patients) {
    const prefix = `PPMS-${(p.doctor?.shortCode ?? p.registeredAt?.shortCode ?? "GEN").toUpperCase()}-`;
    counters[prefix] = (counters[prefix] ?? 0) + 1;
    const newUdid = `${prefix}${String(counters[prefix]).padStart(4, "0")}`;
    await prisma.patient.update({ where: { id: p.id }, data: { udid: newUdid } });
    console.log(`  ${p.id.slice(0, 8)} → ${newUdid}`);
  }

  console.log("✓ Done. All patients have new doctor-based udid values.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
