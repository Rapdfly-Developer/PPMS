const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const regs = await prisma.pluginRegistration.findMany();
  const licenses = await prisma.pluginLicense.findMany();
  const doctors = await prisma.doctor.findMany({ select: { id: true, userId: true } });
  const users = await prisma.user.findMany({ select: { id: true, username: true, role: true } });

  console.log('Doctors:', JSON.stringify(doctors));
  console.log('Users:', JSON.stringify(users));
  console.log('PluginRegistrations:', JSON.stringify(regs));
  console.log('PluginLicenses:', JSON.stringify(licenses));
}

main().catch(console.error).finally(() => prisma.$disconnect());
