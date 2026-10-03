"use server";

import { prisma } from "@/lib/prisma";
import { requireRole, scopeDoctorId } from "@/lib/rbac";
import { getRolePermissionsForDoctor } from "@/lib/role-permissions";
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
    "plugins.view",
  ],
};

/**
 * Permissions introduced *after* the initial seed, which therefore must reach
 * roles that already have a permission set (the block below skips those). Only
 * ever add keys here — the backfill upserts and never revokes, and each key is
 * granted once, so an admin who later removes one keeps it removed.
 */
const ADDITIVE_ROLE_PERMISSIONS: Record<string, string[]> = {};

// ── Default role definitions ───────────────────────────────────────────────
const DEFAULT_ROLES = [
  { name: "DOCTOR",   label: "Doctor",        description: "Super Admin, unrestricted access to all features",          isSystem: true, color: "#6366f1" },
  { name: "HOSPITAL", label: "Hospital Admin", description: "Front-desk, appointments, patients and basic settings", isSystem: true, color: "#10b981" },
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
/**
 * Roles this doctor manages: system roles, roles they created, and older shared
 * custom roles (no creator). Permissions shown are the doctor's own set where
 * they have customised the role, otherwise the shared defaults.
 */
export async function loadRolesPageData(doctorId: string) {
  const [dbRoles, rolePerms, ownPerms] = await Promise.all([
    prisma.role.findMany({
      where: {
        OR: [
          { isSystem: true },
          { createdByDoctorId: doctorId },
          { createdByDoctorId: null },
        ],
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.rolePermission.findMany({ include: { permission: true } }),
    prisma.doctorRolePermission.findMany({ where: { doctorId } }),
  ]);

  const permsByRole: Record<string, string[]> = {};
  for (const rp of rolePerms) {
    if (!permsByRole[rp.role]) permsByRole[rp.role] = [];
    permsByRole[rp.role].push(rp.permission.key);
  }
  for (const own of ownPerms) permsByRole[own.role] = own.permissions;

  const totalPerms = PERMISSION_GROUPS.reduce((a, g) => a + g.permissions.length, 0);

  return dbRoles.map((r) => ({
    ...r,
    permissionKeys: r.name === "DOCTOR" ? (["*"] as string[]) : (permsByRole[r.name] ?? []),
    totalPerms,
  }));
}


// ── CRUD actions ──────────────────────────────────────────────────────────
/**
 * Saves this doctor's permission set for a role. It applies only to the
 * doctor's own staff; other doctors keep their own settings (or the shared
 * defaults).
 */
export async function saveRolePermissions(roleName: string, keys: string[]) {
  const user = await requireRole("DOCTOR");
  if (roleName === "DOCTOR") return; // super admin always has *
  const doctorId = scopeDoctorId(user);

  // Keep only real permission keys
  const perms = await prisma.permission.findMany({ where: { key: { in: keys } }, select: { key: true } });
  const validKeys = perms.map((p) => p.key).sort();

  const oldKeys = (await getRolePermissionsForDoctor(roleName, doctorId)).sort().join(",");
  const newKeys = validKeys.join(",");

  await prisma.doctorRolePermission.upsert({
    where: { doctorId_role: { doctorId, role: roleName } },
    update: { permissions: validKeys },
    create: { doctorId, role: roleName, permissions: validKeys },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      entityType: "RolePermission",
      entityId: `${roleName}@${doctorId}`,
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
}): Promise<{ role: Awaited<ReturnType<typeof prisma.role.create>> | null; error: string | null }> {
  const user = await requireRole("DOCTOR");
  const name = data.name.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
  const doctorId = user.profileId;

  const existing = await prisma.role.findUnique({ where: { name } });
  if (existing) {
    return { role: null, error: `A role named "${name}" already exists. Choose a different name.` };
  }

  try {
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
    return { role, error: null };
  } catch (err: any) {
    if (err?.code === "P2002") {
      return { role: null, error: `A role named "${name}" already exists. Choose a different name.` };
    }
    return { role: null, error: "Failed to create role. Please try again." };
  }
}

export async function updateRoleMeta(
  roleId: string,
  data: { label: string; description?: string | null; color: string },
) {
  const user = await requireRole("DOCTOR");
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw new Error("Role not found");
  // System and shared roles carry the same name for every doctor.
  if (role.createdByDoctorId !== scopeDoctorId(user)) throw new Error("You can only rename roles you created.");
  await prisma.role.update({ where: { id: roleId }, data });
  revalidatePath("/settings/roles");
}

export async function deleteRole(roleId: string): Promise<{ error?: string }> {
  const user = await requireRole("DOCTOR");
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role || role.isSystem) return { error: "System roles cannot be deleted." };
  // Shared roles (no creator) may still be used by other doctors' staff.
  if (role.createdByDoctorId !== scopeDoctorId(user)) return { error: "You can only delete roles you created." };
  const inUse = await prisma.user.count({ where: { role: role.name } });
  if (inUse > 0) return { error: `Reassign the ${inUse} user(s) with this role before deleting it.` };

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { role: role.name } }),
    prisma.doctorRolePermission.deleteMany({ where: { role: role.name } }),
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
  return {};
}
