/**
 * Seed default permissions for all roles.
 * Safe to re-run — uses upsert so existing data is not duplicated.
 *
 * Run with:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-permissions.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ALL_PERMISSIONS: { key: string; label: string }[] = [
  { key: "dashboard.view",        label: "View Dashboard" },
  { key: "patients.view",         label: "View Patients" },
  { key: "patients.create",       label: "Register Patients" },
  { key: "patients.edit",         label: "Edit Patient Info" },
  { key: "patients.delete",       label: "Delete Patients" },
  { key: "appointments.view",     label: "View Appointments" },
  { key: "appointments.create",   label: "Book Appointments" },
  { key: "appointments.edit",     label: "Edit Appointments" },
  { key: "appointments.cancel",   label: "Cancel Appointments" },
  { key: "emr.view",              label: "View EMR" },
  { key: "emr.create",            label: "Create EMR Records" },
  { key: "emr.edit",              label: "Edit EMR Records" },
  { key: "emr.print",             label: "Print / Export EMR" },
  { key: "refraction.view",       label: "View Refraction" },
  { key: "refraction.create",     label: "Record Refraction" },
  { key: "refraction.edit",       label: "Edit Refraction" },
  { key: "investigations.view",   label: "View Investigations" },
  { key: "investigations.create", label: "Order Investigations" },
  { key: "investigations.edit",   label: "Edit Investigations" },
  { key: "billing.view",          label: "View Billing" },
  { key: "billing.create",        label: "Create Bills" },
  { key: "billing.edit",          label: "Edit Bills" },
  { key: "billing.print",         label: "Print Bills" },
  { key: "reports.view",          label: "View Reports & Analytics" },
  { key: "reports.export",        label: "Export Reports" },
  { key: "ipd.view",              label: "View IPD" },
  { key: "ipd.manage",            label: "Manage IPD (Admit/Discharge)" },
  { key: "availability.view",     label: "View Availability" },
  { key: "availability.manage",   label: "Manage Availability" },
  { key: "settings.view",         label: "View Settings" },
  { key: "settings.manage",       label: "Manage Settings" },
  { key: "users.manage",          label: "Manage Users" },
  { key: "roles.manage",          label: "Manage Roles & Permissions" },
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  DOCTOR: ["*"],

  HOSPITAL: [
    "dashboard.view",
    "patients.view", "patients.create", "patients.edit",
    "appointments.view", "appointments.create", "appointments.edit", "appointments.cancel",
    "emr.view",
    "investigations.view", "investigations.create", "investigations.edit",
    "billing.view", "billing.create", "billing.edit", "billing.print",
    "reports.view", "reports.export",
    "settings.view",
  ],

  REFRACTIONIST: [
    "dashboard.view",
    "patients.view",
    "appointments.view",
    "emr.view",
    "refraction.view", "refraction.create", "refraction.edit",
    "investigations.view", "investigations.create", "investigations.edit",
  ],
};

async function main() {
  console.log("Seeding permissions…");

  // Upsert all permission keys (including the "*" wildcard used by DOCTOR)
  const allKeys = [
    ...ALL_PERMISSIONS,
    { key: "*", label: "Super Admin — all permissions" },
  ];

  for (const { key, label } of allKeys) {
    await prisma.permission.upsert({
      where: { key },
      create: { key, label },
      update: { label },
    });
  }
  console.log(`  ✓ ${allKeys.length} permission records upserted`);

  // Upsert role → permission mappings
  for (const [role, keys] of Object.entries(ROLE_PERMISSIONS)) {
    for (const key of keys) {
      const perm = await prisma.permission.findUnique({ where: { key } });
      if (!perm) { console.warn(`  ! Permission "${key}" not found, skipping`); continue; }
      await prisma.rolePermission.upsert({
        where: { role_permissionId: { role, permissionId: perm.id } },
        create: { role, permissionId: perm.id },
        update: {},
      });
    }
    console.log(`  ✓ ${role}: ${keys.length} permissions assigned`);
  }

  console.log("Done.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
