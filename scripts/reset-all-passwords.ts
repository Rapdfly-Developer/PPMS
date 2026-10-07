/**
 * Reset every account to a new random password using only visually
 * unambiguous characters (no l/1/I, no O/0).
 *
 * Run:  npx tsx scripts/reset-all-passwords.ts
 *
 * Save the printed table — passwords cannot be recovered afterwards.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();

// Characters that cannot be confused with each other
const CHARS = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

function randomPassword(len = 16): string {
  const bytes = crypto.randomBytes(len);
  return Array.from(bytes).map((b) => CHARS[b % CHARS.length]).join("");
}

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, email: true, role: true },
    orderBy: { role: "asc" },
  });

  console.log(`\nResetting ${users.length} account(s)...\n`);
  console.log("ROLE               USERNAME                             PASSWORD");
  console.log("─".repeat(75));

  for (const u of users) {
    const pw = randomPassword();
    const hash = await bcrypt.hash(pw, 12);
    await prisma.user.update({ where: { id: u.id }, data: { passwordHash: hash } });
    const label = u.email && u.email !== u.username ? `${u.username} (${u.email})` : u.username;
    console.log(`${u.role.padEnd(18)} ${label.padEnd(44)} ${pw}`);
  }

  console.log("\n" + "─".repeat(75));
  console.log("Done. Save this output — these passwords cannot be recovered.\n");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
