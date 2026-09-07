const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const trialEndsAt = new Date();
  trialEndsAt.setFullYear(trialEndsAt.getFullYear() + 1);

  const result = await prisma.pluginLicense.updateMany({
    where: { status: 'EXPIRED' },
    data: { status: 'TRIAL', trialEndsAt, usageCount: 0, usageResetAt: new Date() },
  });

  console.log(`Reset ${result.count} expired license(s) → TRIAL until ${trialEndsAt.toDateString()}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
