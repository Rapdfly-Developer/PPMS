const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PLUGIN_ID = 'ppms.plugin.ai-clinical-copilot';
const TRIAL_DAYS = 365; // 1-year trial for local dev

async function main() {
  const doctors = await prisma.doctor.findMany({ select: { id: true } });
  console.log(`Found ${doctors.length} doctor(s)`);

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

  for (const doctor of doctors) {
    // 1. Install (PluginRegistration)
    await prisma.pluginRegistration.upsert({
      where: { pluginId_doctorId: { pluginId: PLUGIN_ID, doctorId: doctor.id } },
      update: { status: 'ENABLED', version: '1.0.0' },
      create: { pluginId: PLUGIN_ID, doctorId: doctor.id, status: 'ENABLED', version: '1.0.0' },
    });

    // 2. License (PluginLicense)
    await prisma.pluginLicense.upsert({
      where: { pluginId_doctorId: { pluginId: PLUGIN_ID, doctorId: doctor.id } },
      update: { status: 'TRIAL', trialEndsAt, usageCount: 0, usageResetAt: new Date() },
      create: {
        pluginId: PLUGIN_ID,
        doctorId: doctor.id,
        status: 'TRIAL',
        trialEndsAt,
        usageLimit: 500,
        usageResetAt: new Date(),
      },
    });

    console.log(`  ✓ Doctor ${doctor.id} — ENABLED + TRIAL until ${trialEndsAt.toDateString()}`);
  }

  console.log('\nDone. Reload the EMR page to see the AI Copilot panel.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
