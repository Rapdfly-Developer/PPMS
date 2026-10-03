import { prisma } from "@/lib/prisma";

/**
 * The doctor whose Role Manager settings govern this staff account: the
 * refractionist's own doctor, otherwise the doctor linked to the staff
 * member's hospital (earliest active link when a hospital has several).
 */
export async function getOwnerDoctorId(userId: string): Promise<string | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      refractionist: { select: { doctorId: true } },
      hospitalStaff: {
        select: {
          hospital: {
            select: {
              doctorLinks: { where: { active: true }, orderBy: { id: "asc" }, take: 1, select: { doctorId: true } },
            },
          },
        },
      },
    },
  });
  return u?.refractionist?.doctorId ?? u?.hospitalStaff?.hospital.doctorLinks[0]?.doctorId ?? null;
}

/** Shared default permission keys for a role (used until a doctor customises it). */
export async function getSharedRolePermissions(role: string): Promise<string[]> {
  const rows = await prisma.rolePermission.findMany({
    where: { role },
    select: { permission: { select: { key: true } } },
  });
  return rows.map((r) => r.permission.key);
}

/** A role's permissions as configured by one doctor, falling back to the shared defaults. */
export async function getRolePermissionsForDoctor(role: string, doctorId: string | null): Promise<string[]> {
  if (role === "DOCTOR") return ["*"];
  if (doctorId) {
    const own = await prisma.doctorRolePermission.findUnique({
      where: { doctorId_role: { doctorId, role } },
      select: { permissions: true },
    });
    if (own) return own.permissions;
  }
  return getSharedRolePermissions(role);
}

/**
 * Starting permissions for the Add User / Add Hospital forms: the doctor's own
 * settings for each role, else the shared set. Roles with nothing configured
 * are left out so the form falls back to its built-in defaults.
 */
export async function getSavedPermsForForms(roles: string[], doctorId: string): Promise<Record<string, string[]>> {
  const names = roles.filter((r) => r !== "DOCTOR");
  const [own, shared] = await Promise.all([
    prisma.doctorRolePermission.findMany({ where: { doctorId, role: { in: names } }, select: { role: true, permissions: true } }),
    prisma.rolePermission.findMany({ where: { role: { in: names } }, select: { role: true, permission: { select: { key: true } } } }),
  ]);
  const out: Record<string, string[]> = {};
  for (const r of shared) (out[r.role] ??= []).push(r.permission.key);
  for (const r of own) out[r.role] = r.permissions;
  return out;
}

/** Effective permissions for a signed-in account. */
export async function getUserPermissions(userId: string, role: string): Promise<string[]> {
  if (role === "DOCTOR") return ["*"];
  return getRolePermissionsForDoctor(role, await getOwnerDoctorId(userId));
}
