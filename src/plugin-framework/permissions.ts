/**
 * Plugin Permission Registration
 *
 * Integrates plugin-declared permissions with the PPMS RBAC system.
 * Permissions are upserted into the existing Permission + RolePermission
 * tables — no second auth system is created.
 *
 * This runs on plugin install, and again on startup (idempotent upsert).
 */

import { prisma } from "@/lib/prisma";
import type { PluginManifest } from "./types";

/**
 * Register a plugin's declared permissions into the PPMS permission system.
 *
 * - Upserts each permission key into the Permission table.
 * - Assigns default role → permission mappings from the manifest.
 *   Only applies defaults for roles that have NO existing permissions for
 *   this plugin (additive, never revokes).
 *
 * Safe to call multiple times (fully idempotent).
 */
export async function registerPluginPermissions(
  manifest: PluginManifest,
): Promise<void> {
  // 1. Upsert all permission keys into the Permission table
  for (const key of manifest.permissions) {
    // Derive a label from the key: "ai.copilot.view" → "AI Copilot: View"
    const label = permissionLabel(key, manifest.name);
    await prisma.permission.upsert({
      where: { key },
      update: { label },
      create: { key, label },
    });
  }

  // 2. Apply default role assignments (skip if that role already has any
  //    of this plugin's permissions — prevents overwriting admin decisions)
  for (const [roleName, grantedKeys] of Object.entries(manifest.defaultPermissions)) {
    const keysToGrant =
      grantedKeys.includes("*")
        ? manifest.permissions   // wildcard → grant all plugin permissions
        : grantedKeys.filter((k) => manifest.permissions.includes(k));

    if (keysToGrant.length === 0) continue;

    // Check if any plugin permissions are already assigned to this role
    const existingCount = await prisma.rolePermission.count({
      where: {
        role: roleName,
        permission: { key: { in: manifest.permissions } },
      },
    });
    // Skip if already set — respect admin role management
    if (existingCount > 0) continue;

    for (const key of keysToGrant) {
      const perm = await prisma.permission.findUnique({ where: { key } });
      if (!perm) continue;
      await prisma.rolePermission.upsert({
        where: { role_permissionId: { role: roleName, permissionId: perm.id } },
        update: {},
        create: { role: roleName, permissionId: perm.id },
      });
    }
  }
}

/**
 * Remove a plugin's permissions from the PPMS permission system.
 * Deletes RolePermission rows for all plugin-declared keys, then deletes
 * the Permission rows themselves.
 *
 * Called on plugin removal.
 */
export async function deregisterPluginPermissions(
  manifest: PluginManifest,
): Promise<void> {
  const perms = await prisma.permission.findMany({
    where: { key: { in: manifest.permissions } },
    select: { id: true },
  });
  const permIds = perms.map((p) => p.id);

  if (permIds.length > 0) {
    await prisma.rolePermission.deleteMany({ where: { permissionId: { in: permIds } } });
    await prisma.permission.deleteMany({ where: { id: { in: permIds } } });
  }
}

/**
 * Returns the PPMS SessionUser's permissions that belong to this plugin.
 */
export function getPluginPermissions(
  userPermissions: string[],
  manifest: PluginManifest,
): string[] {
  if (userPermissions.includes("*")) return manifest.permissions;
  return userPermissions.filter((p) => manifest.permissions.includes(p));
}

/**
 * Returns true if the user holds a specific plugin permission.
 */
export function userHasPluginPermission(
  userPermissions: string[],
  permission: string,
): boolean {
  return userPermissions.includes("*") || userPermissions.includes(permission);
}

// ── Helpers ───────────────────────────────────────────────────────────────

/** Convert a permission key to a human-readable label. */
function permissionLabel(key: string, pluginName: string): string {
  // "ai.copilot.view" → "AI Copilot: View"
  const segments = key.split(".");
  const action = segments[segments.length - 1] ?? "";
  const actionLabel = action.charAt(0).toUpperCase() + action.slice(1);
  return `${pluginName}: ${actionLabel}`;
}
