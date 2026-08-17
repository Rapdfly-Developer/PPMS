import { cache } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/constants";

export type SessionUser = {
  id: string;
  name: string;
  username: string;
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

/**
 * Resolves the session user once per server request.
 *
 * requireUser() is called from the app layout and again from every page, action
 * and API route beneath it — 200+ call sites. Without this each call repeated
 * both the session decode and the permission query, so a single page render
 * issued the same DB round-trip several times over.
 *
 * React's cache() memoises for the lifetime of one request only, so permissions
 * are still re-read on every navigation and Role Manager changes still apply
 * immediately — exactly as before, just once instead of N times.
 */
const loadSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  if (!session?.user) return null;

  // Copy rather than mutate the session object, since this result is now shared.
  const user = { ...(session.user as unknown as SessionUser) };
  user.permissions = await freshPermissions(user.role);
  return user;
});

export async function requireUser(): Promise<SessionUser> {
  const user = await loadSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Restricts a route to the Super Admin only (username in SETUP_ADMIN_USERNAME env var). */
export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  const adminUsername = process.env.SETUP_ADMIN_USERNAME ?? "developer";
  if (user.username !== adminUsername) redirect("/");
  return user;
}

/** Returns true for any role not built into the system (Receptionist, Nurse, etc.). */
export function isCustomRole(role: string): boolean {
  return !["DOCTOR", "HOSPITAL"].includes(role);
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
  return "/dashboard"; // custom roles always land on dashboard
}
