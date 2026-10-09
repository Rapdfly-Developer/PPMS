import { prisma } from "@/lib/prisma";

/**
 * Action permissions imply the minimum read access needed to use that action.
 * Stored role selections remain unchanged; this only expands the effective
 * permission set loaded for a signed-in user.
 */
const PERMISSION_IMPLICATIONS: Record<string, string[]> = {
  "opd.walkin.create": ["opd.view"],
  "opd.queue.manage": ["opd.view"],
  "opd.dispense": ["opd.view"],
  "opd.partialDispense": ["opd.view"],

  "appointments.create": ["appointments.view"],
  "appointments.edit": ["appointments.view"],
  "appointments.cancel": ["appointments.view"],
  "appointments.noshow": ["appointments.view"],

  "patients.create": ["patients.view"],
  "patients.edit": ["patients.view"],
  "patients.delete": ["patients.view"],

  "emr.create": ["emr.view"],
  "emr.edit": ["emr.view"],
  "emr.print": ["emr.view"],
  "emr.copilot.view": ["emr.view"],
  "emr.general.edit": ["emr.general.view", "emr.view"],
  "emr.va.edit": ["emr.va.view", "emr.view"],
  "refraction.create": ["refraction.view", "emr.view"],
  "refraction.edit": ["refraction.view", "emr.view"],
  "emr.refraction.edit": ["refraction.view", "emr.view"],
  "emr.iop.edit": ["emr.iop.view", "emr.view"],
  "emr.colour.edit": ["emr.colour.view", "emr.view"],
  "emr.anterior.edit": ["emr.anterior.view", "emr.view"],
  "emr.posterior.edit": ["emr.posterior.view", "emr.view"],
  "emr.assessment.edit": ["emr.assessment.view", "emr.view"],
  "emr.plan.edit": ["emr.plan.view", "emr.view"],
  "emr.medications.view": ["emr.plan.view", "emr.view"],
  "emr.medications.edit": ["emr.medications.view", "emr.plan.view", "emr.view"],
  "emr.ophthalmic.edit": ["emr.view"],
  "investigations.create": ["investigations.view", "emr.view"],
  "investigations.edit": ["investigations.view", "emr.view"],
  "emr.labReports.upload": ["investigations.view", "emr.view"],
  "emr.labReports.edit": ["investigations.view", "emr.view"],

  "followups.edit": ["followups.view"],
  "reports.export": ["reports.view"],
  "availability.manage": ["availability.view"],
  "settings.manage": ["settings.view"],
  "users.manage": ["settings.view"],
  "roles.manage": ["settings.view"],
  "plugins.manage": ["plugins.view"],
};

export function expandPermissionImplications(permissions: string[]): string[] {
  if (permissions.includes("*")) return permissions;
  const effective = new Set(permissions);
  let changed = true;
  while (changed) {
    changed = false;
    for (const permission of [...effective]) {
      for (const implied of PERMISSION_IMPLICATIONS[permission] ?? []) {
        if (!effective.has(implied)) {
          effective.add(implied);
          changed = true;
        }
      }
    }
  }
  return [...effective];
}

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
  const assigned = await getRolePermissionsForDoctor(role, await getOwnerDoctorId(userId));
  return expandPermissionImplications(assigned);
}
