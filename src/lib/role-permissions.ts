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

/** Effective permissions for a signed-in account. */
export async function getUserPermissions(userId: string, role: string): Promise<string[]> {
  if (role === "DOCTOR") return ["*"];
  return getRolePermissionsForDoctor(role, await getOwnerDoctorId(userId));
}
