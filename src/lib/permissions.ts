import type { SessionUser } from "./rbac";
import type { Role } from "./constants";
import { redirect } from "next/navigation";
import { roleHome } from "./rbac";

/**
 * Central capability table.
 * DOCTOR is super-admin and bypasses every check — other roles are listed
 * explicitly for what they are permitted to do.
 */
const PERMISSIONS = {
  // Appointments
  "appointments:view":    ["DOCTOR", "HOSPITAL", "REFRACTIONIST"],
  "appointments:book":    ["DOCTOR", "HOSPITAL"],
  "appointments:confirm": ["DOCTOR", "HOSPITAL"],
  "appointments:cancel":  ["DOCTOR", "HOSPITAL"],

  // Patients
  "patients:view":        ["DOCTOR", "HOSPITAL"],
  "patients:register":    ["DOCTOR", "HOSPITAL"],
  "patients:edit":        ["DOCTOR", "HOSPITAL"],

  // EMR / Clinical
  "emr:view":             ["DOCTOR", "HOSPITAL", "REFRACTIONIST"],
  "emr:write":            ["DOCTOR"],
  "emr:refraction":       ["DOCTOR", "REFRACTIONIST"],

  // IPD
  "ipd:view":             ["DOCTOR"],
  "ipd:admit":            ["DOCTOR"],
  "ipd:discharge":        ["DOCTOR"],

  // Queue
  "queue:view":           ["DOCTOR", "REFRACTIONIST"],

  // Availability
  "availability:manage":  ["DOCTOR"],

  // Admin / Settings
  "users:manage":         ["DOCTOR"],
  "audit:view":           ["DOCTOR"],
  "chips:manage":         ["DOCTOR"],
  "history:view":         ["DOCTOR"],
  "settings:hospital":    ["DOCTOR", "HOSPITAL"],
} satisfies Record<string, Role[]>;

export type Permission = keyof typeof PERMISSIONS;

/** Returns true if the user can perform the given action.
 *  DOCTOR always returns true (super-admin). */
export function can(user: SessionUser, action: Permission): boolean {
  if (user.role === "DOCTOR") return true;
  return (PERMISSIONS[action] as Role[]).includes(user.role);
}

/** Redirects to the user's home page if they cannot perform the action. */
export function assertCan(user: SessionUser, action: Permission): void {
  if (!can(user, action)) redirect(roleHome(user.role));
}
