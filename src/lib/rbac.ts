import { auth } from "@/auth";
import { redirect } from "next/navigation";
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

export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user as unknown as SessionUser;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  // DOCTOR is super-admin — passes every role check unconditionally.
  if (user.role === "DOCTOR" || roles.includes(user.role)) return user;
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

// Resolves the doctorId scope a given session user is allowed to query within.
export function scopeDoctorId(user: SessionUser): string {
  if (user.role === "DOCTOR") return user.profileId;
  if (user.doctorId) return user.doctorId;
  throw new Error("No doctor scope resolvable for this user");
}

// Each role's landing page - there is no shared /dashboard for Hospital or
// Refractionist accounts, so login/middleware redirects must branch on role
// rather than assuming everyone lands on /dashboard.
export function roleHome(role: Role): string {
  if (role === "DOCTOR") return "/dashboard";
  if (role === "REFRACTIONIST") return "/queue";
  return "/appointments";
}
