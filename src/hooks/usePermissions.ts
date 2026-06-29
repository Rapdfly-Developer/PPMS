"use client";

import { useSession } from "next-auth/react";
import { ROLE_DEFAULT_PERMISSIONS } from "@/lib/permissions";

/**
 * Client-side RBAC hook.
 *
 * Usage:
 *   const { can } = usePermissions();
 *   if (can("patients.create")) { ... }
 *   {can("billing.view") && <BillingMenu />}
 */
export function usePermissions() {
  const { data: session } = useSession();
  const role: string | undefined = (session?.user as any)?.role;
  let permissions: string[] = (session?.user as any)?.permissions ?? [];

  // Fallback for existing sessions that predate the permissions claim in the JWT.
  // Once the user logs out and back in they get a fresh token with real permissions.
  if (permissions.length === 0 && role) {
    permissions = ROLE_DEFAULT_PERMISSIONS[role] ?? [];
  }

  function can(permission: string): boolean {
    return permissions.includes("*") || permissions.includes(permission);
  }

  return { can, permissions };
}
