/**
 * Plugin Framework Startup
 *
 * Called once per cold start from src/lib/startup.ts.
 * Registers plugin permissions for all installed plugins and
 * detects version bumps that need the onUpdate hook.
 */

import { prisma } from "@/lib/prisma";
import { getAllRegisteredPlugins, isPluginRegistered } from "./registry";
import { registerPluginPermissions } from "./permissions";
import { runLifecycleHook } from "./lifecycle";
import { assertVersionCompatible } from "./registry";

const PPMS_VERSION = process.env.PPMS_VERSION ?? "16.2.9";

/**
 * Initialize the plugin framework on cold start.
 *
 * - Re-registers permissions for all installed+enabled plugins (idempotent).
 * - Runs onUpdate hooks for plugins whose manifest version differs from DB.
 * - Logs warnings for incompatible or orphaned registrations.
 */
export async function initPluginFramework(): Promise<void> {
  try {
    // 1. Re-register permissions for all statically registered plugins
    //    so any new permission keys from a code update are picked up.
    for (const plugin of getAllRegisteredPlugins()) {
      await registerPluginPermissions(plugin.manifest).catch((err) => {
        console.warn(`[PluginFramework] Permission registration failed for "${plugin.manifest.pluginId}":`, err);
      });
    }

    // 2. Check for version bumps in installed plugins
    const installations = await prisma.pluginRegistration.findMany({
      where: { status: { in: ["INSTALLED", "ENABLED"] } },
      select: { pluginId: true, doctorId: true, version: true, id: true },
    });

    for (const inst of installations) {
      if (!isPluginRegistered(inst.pluginId)) {
        // Plugin was removed from the build but DB record exists — log only
        console.warn(
          `[PluginFramework] Plugin "${inst.pluginId}" is installed in DB but not registered in this build.`,
        );
        continue;
      }

      // Check PPMS compatibility
      try {
        assertVersionCompatible(inst.pluginId, PPMS_VERSION);
      } catch (err) {
        console.warn(`[PluginFramework] Version incompatibility for "${inst.pluginId}":`, err);
        continue;
      }

      // Run onUpdate if manifest version differs from DB version
      const plugin = getAllRegisteredPlugins().find(
        (p) => p.manifest.pluginId === inst.pluginId,
      );
      if (!plugin) continue;

      const toVersion = plugin.manifest.version;
      if (inst.version !== toVersion) {
        await runLifecycleHook(plugin, "onUpdate", {
          doctorId: inst.doctorId,
          fromVersion: inst.version,
          toVersion,
        });
        await prisma.pluginRegistration.update({
          where: { id: inst.id },
          data: { version: toVersion },
        });
      }
    }
  } catch (err) {
    // Framework startup failures must never block the PPMS request
    console.error("[PluginFramework] Startup error:", err);
  }
}
