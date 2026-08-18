"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { PERMISSION_GROUPS, type RoleWithPerms } from "./permission-groups";

// ── Default permissions for each system role ──────────────────────────────
const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  HOSPITAL: [
    "dashboard.view",
    "appointments.view", "appointments.create", "appointments.edit", "appointments.cancel",
    "patients.view", "patients.create", "patients.edit",
    "emr.view", "refraction.view",
    "investigations.view", "investigations.create", "investigations.edit",
    "billing.view", "billing.create", "billing.edit", "billing.print",
    "reports.view", "reports.export",
    "settings.view", "settings.manage",
  ],
};

/**
 * Permissions introduced *after* the initial seed, which therefore must reach
 * roles that already have a permission set (the block below skips those). Only
 * ever add keys here — the backfill upserts and never revokes, and each key is
 * granted once, so an admin who later removes one keeps it removed.
 *
 * counselling.decide / counselling.approve_ot are deliberately absent: clinical
 * decisions stay with the DOCTOR role, which holds "*".
 */
const ADDITIVE_ROLE_PERMISSIONS: Record<string, string[]> = {};

// ── Default role definitions ───────────────────────────────────────────────
const DEFAULT_ROLES = [
  { name: "DOCTOR",   label: "Doctor",        description: "Super Admin — unrestricted access to all features",          isSystem: true, color: "#6366f1" },
  { name: "HOSPITAL", label: "Hospital Admin", description: "Front-desk — appointments, patients and basic settings", isSystem: true, color: "#10b981" },
];

// ── Seed helpers (idempotent) ─────────────────────────────────────────────
export async function seedRolesAndPermissions() {
  // Upsert roles
  for (const r of DEFAULT_ROLES) {
    await prisma.role.upsert({
      where: { name: r.name },
      update: {},
      create: r,
    });
  }

  // Collect all permission keys
  const allKeys = PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.key));
  const allLabels: Record<string, string> = {};
  for (const g of PERMISSION_GROUPS) {
    for (const p of g.permissions) allLabels[p.key] = p.label;
  }

  // Upsert permissions
  for (const key of allKeys) {
    await prisma.permission.upsert({
      where: { key },
      update: { label: allLabels[key] },
      create: { key, label: allLabels[key] },
    });
  }

  // Seed default role permissions (skip if already set for a role)
  for (const [roleName, keys] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    const existing = await prisma.rolePermission.count({ where: { role: roleName } });
    if (existing > 0) continue;
    for (const key of keys) {
      const perm = await prisma.permission.findUnique({ where: { key } });
      if (!perm) continue;
      await prisma.rolePermission.upsert({
        where: { role_permissionId: { role: roleName, permissionId: perm.id } },
        update: {},
        create: { role: roleName, permissionId: perm.id },
      });
    }
  }

  // Backfill permissions added by later modules onto roles that were already
  // seeded. Runs for every role (unlike the block above) but only ever grants,
  // and each grant is recorded so a deliberate revoke is not undone.
  for (const [roleName, keys] of Object.entries(ADDITIVE_ROLE_PERMISSIONS)) {
    for (const key of keys) {
      const perm = await prisma.permission.findUnique({ where: { key } });
      if (!perm) continue;
      const seeded = await prisma.rolePermissionSeed.findUnique({
        where: { role_permissionKey: { role: roleName, permissionKey: key } },
      }).catch(() => null);
      if (seeded) continue;
      await prisma.rolePermission.upsert({
        where: { role_permissionId: { role: roleName, permissionId: perm.id } },
        update: {},
        create: { role: roleName, permissionId: perm.id },
      });
      await prisma.rolePermissionSeed.create({
        data: { role: roleName, permissionKey: key },
      }).catch(() => { /* concurrent seed — ignore */ });
    }
  }
}

// ── Load page data ────────────────────────────────────────────────────────
export async function loadRolesPageData(doctorId?: string) {
  const [dbRoles, rolePerms] = await Promise.all([
    prisma.role.findMany({
      where: doctorId
        ? {
            OR: [
              { isSystem: true },
              { createdByDoctorId: doctorId },
            ],
          }
        : undefined,
      orderBy: { createdAt: "asc" },
    }),
    prisma.rolePermission.findMany({ include: { permission: true } }),
  ]);

  const permsByRole: Record<string, string[]> = {};
  for (const rp of rolePerms) {
    if (!permsByRole[rp.role]) permsByRole[rp.role] = [];
    permsByRole[rp.role].push(rp.permission.key);
  }

  const totalPerms = PERMISSION_GROUPS.reduce((a, g) => a + g.permissions.length, 0);

  return dbRoles.map((r) => ({
    ...r,
    permissionKeys: r.name === "DOCTOR" ? (["*"] as string[]) : (permsByRole[r.name] ?? []),
    totalPerms,
  }));
}


// ── CRUD actions ──────────────────────────────────────────────────────────
export async function saveRolePermissions(roleName: string, keys: string[]) {
  const user = await requireRole("DOCTOR");
  if (roleName === "DOCTOR") return; // super admin always has *

  // Fetch permission records for requested keys
  const perms = await prisma.permission.findMany({ where: { key: { in: keys } } });

  // Replace all RolePermissions for this role in a transaction
  const oldPerms = await prisma.rolePermission.findMany({
    where: { role: roleName },
    include: { permission: true },
  });
  const oldKeys = oldPerms.map((rp) => rp.permission.key).sort().join(",");
  const newKeys = keys.sort().join(",");

  const txOps: any[] = [
    prisma.rolePermission.deleteMany({ where: { role: roleName } }),
    ...(perms.length > 0
      ? [prisma.rolePermission.createMany({
          data: perms.map((p) => ({ role: roleName, permissionId: p.id })),
          skipDuplicates: true,
        })]
      : []),
  ];
  await prisma.$transaction(txOps);

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      entityType: "RolePermission",
      entityId: roleName,
      action: "UPDATE_PERMISSIONS",
      oldValue: oldKeys,
      newValue: newKeys,
    },
  });

  revalidatePath("/settings/roles");
}

export async function createRole(data: {
  name: string;
  label: string;
  description?: string | null;
  color: string;
}) {
  const user = await requireRole("DOCTOR");
  const name = data.name.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
  const doctorId = user.profileId;

  const role = await prisma.role.create({
    data: { name, label: data.label, description: data.description, color: data.color, isSystem: false, createdByDoctorId: doctorId },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      entityType: "Role",
      entityId: role.id,
      action: "CREATE",
      newValue: JSON.stringify({ name, label: data.label }),
    },
  });

  revalidatePath("/settings/roles");
  return role;
}

export async function updateRoleMeta(
  roleId: string,
  data: { label: string; description?: string | null; color: string },
) {
  await requireRole("DOCTOR");
  await prisma.role.update({ where: { id: roleId }, data });
  revalidatePath("/settings/roles");
}

export async function deleteRole(roleId: string) {
  const user = await requireRole("DOCTOR");
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role || role.isSystem) throw new Error("Cannot delete a system role");

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { role: role.name } }),
    prisma.role.delete({ where: { id: roleId } }),
  ]);

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      entityType: "Role",
      entityId: roleId,
      action: "DELETE",
      oldValue: role.name,
    },
  });

  revalidatePath("/settings/roles");
}
