/**
 * One-shot script: find every account whose bcrypt hash matches "password123"
 * and replace it with a per-account random 20-character password.
 *
 * Run ONCE against production:
 *   npx tsx scripts/reset-weak-passwords.ts
 *
 * The script prints every affected username → new-password pair.
 * Save that output somewhere safe immediately — the passwords are not stored
 * anywhere else. Affected users will need to be told their new password or
 * use "Forgot password".
 *
 * Safe to re-run: if no account still uses "password123" it prints "Nothing to do."
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();

const WEAK_PASSWORD = "password123";

function randomPassword(len = 20): string {
  return crypto.randomBytes(Math.ceil((len * 3) / 4)).toString("base64url").slice(0, len);
}

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, email: true, passwordHash: true, role: true },
  });

  const affected: { id: string; username: string; email: string | null; role: string; newPassword: string }[] = [];

  for (const u of users) {
    const match = await bcrypt.compare(WEAK_PASSWORD, u.passwordHash);
    if (match) {
      affected.push({ id: u.id, username: u.username, email: u.email, role: u.role, newPassword: randomPassword() });
    }
  }

  if (affected.length === 0) {
    console.log("Nothing to do — no accounts with password123 found.");
    return;
  }

  console.log(`\nFound ${affected.length} account(s) with weak password. Resetting...\n`);

  for (const u of affected) {
    const hash = await bcrypt.hash(u.newPassword, 12);
    await prisma.user.update({ where: { id: u.id }, data: { passwordHash: hash } });
    const label = u.email ? `${u.username} (${u.email})` : u.username;
    console.log(`  ${u.role.padEnd(18)} ${label.padEnd(48)} new password: ${u.newPassword}`);
  }

  console.log(`\nDone. ${affected.length} password(s) reset. Save the output above — these cannot be recovered.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
