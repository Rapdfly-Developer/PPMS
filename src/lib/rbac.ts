import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/constants";

export type SessionUser = {
  id: string;
  name: string;
  role: Role;
  profileId: string;
  hospitalId?: string;
  doctorId?: string;
  permissions?: string[];
};

/** Fetches fresh permissions from DB so role-manager changes apply immediately. */
async function freshPermissions(role: string): Promise<string[]> {
  if (role === "DOCTOR") return ["*"];
  const rows = await prisma.rolePermission.findMany({
    where: { role },
    select: { permission: { select: { key: true } } },
  });
  return rows.map((r) => r.permission.key);
}

export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as unknown as SessionUser;
  // Always resolve fresh permissions so changes in Role Manager take effect immediately.
  user.permissions = await freshPermissions(user.role);
  return user;
}

/** Returns true for any role not built into the system (Receptionist, Nurse, etc.). */
export function isCustomRole(role: string): boolean {
  return !["DOCTOR", "HOSPITAL", "REFRACTIONIST"].includes(role);
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role === "DOCTOR" || roles.includes(user.role)) return user;
  // Custom roles are hospital-affiliated staff — pass through when HOSPITAL is an accepted role
  if (isCustomRole(user.role) && (roles as string[]).includes("HOSPITAL")) return user;
  redirect(roleHome(user.role));
}

/** True if the user holds the given permission (or is super-admin with "*"). */
export function userCan(user: SessionUser, permission: string): boolean {
  const perms = user.permissions ?? [];
  return perms.includes("*") || perms.includes(permission);
}

/** Redirects to the role's home page if the user lacks the given permission. */
export async function requirePermission(permission: string): Promise<SessionUser> {
  const user = await requireUser();
  if (userCan(user, permission)) return user;
  redirect(roleHome(user.role));
}

export function scopeDoctorId(user: SessionUser): string {
  if (user.role === "DOCTOR") return user.profileId;
  if (user.doctorId) return user.doctorId;
  throw new Error("No doctor scope resolvable for this user");
}

export function roleHome(role: Role): string {
  if (role === "DOCTOR") return "/dashboard";
  if (role === "HOSPITAL") return "/dashboard";
  if (role === "REFRACTIONIST") return "/queue";
  return "/dashboard"; // custom roles always land on dashboard
}
