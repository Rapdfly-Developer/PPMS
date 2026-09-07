/**
 * PPMS Plugin Manager
 *
 * Handles all database-backed plugin operations:
 * install, enable, disable, remove, configure, version validation.
 *
 * All operations are scoped to a doctorId (the PPMS licensee).
 * Disabling a plugin never affects PPMS Core or other plugins.
 */

import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import {
  getPlugin,
  getAllRegisteredPlugins,
  isPluginRegistered,
  assertVersionCompatible,
} from "./registry";
import { registerPluginPermissions } from "./permissions";
import { runLifecycleHook } from "./lifecycle";
import { createPluginTrial } from "./license";
import type { PluginRecord, PluginStatus } from "./types";
import {
  PluginDisabledError,
} from "./types";

// ── Current PPMS version (read from env or package.json version) ──────────
// Used for compatibility checks at install time.
const PPMS_VERSION = process.env.PPMS_VERSION ?? "16.2.9";

// ── Install ───────────────────────────────────────────────────────────────

/**
 * Install a plugin for a doctor. Creates PluginRegistration row,
 * registers permissions, runs onInstall hook, creates trial license.
 *
 * Idempotent: calling install on an already-installed plugin is a no-op
 * (returns the existing record without error).
 */
export async function installPlugin(
  pluginId: string,
  doctorId: string,
  userId: string,
): Promise<{ success: true; registrationId: string } | { success: false; error: string }> {
  if (!isPluginRegistered(pluginId)) {
    return { success: false, error: `Plugin not found: ${pluginId}` };
  }

  const plugin = getPlugin(pluginId);

  // Version compatibility check
  try {
    assertVersionCompatible(pluginId, PPMS_VERSION);
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }

  // Idempotency: already installed → skip
  const existing = await prisma.pluginRegistration.findUnique({
    where: { pluginId_doctorId: { pluginId, doctorId } },
  });
  if (existing) {
    return { success: true, registrationId: existing.id };
  }

  // Create DB record
  const registration = await prisma.pluginRegistration.create({
    data: {
      pluginId,
      doctorId,
      status: "INSTALLED",
      version: plugin.manifest.version,
    },
  });

  // Register permissions into the PPMS permission system
  await registerPluginPermissions(plugin.manifest);

  // Create trial license (14 days by default, or manifest-specified)
  await createPluginTrial(pluginId, doctorId, plugin.manifest.licensing);

  // Run plugin's own onInstall hook (best-effort — never block install)
  await runLifecycleHook(plugin, "onInstall", { doctorId, version: plugin.manifest.version });

  writeAudit(userId, "PLUGIN_REGISTRATION", registration.id, "PLUGIN_INSTALLED", {
    pluginId,
    version: plugin.manifest.version,
  });

  return { success: true, registrationId: registration.id };
}

// ── Enable ────────────────────────────────────────────────────────────────

/**
 * Enable an installed plugin. Sets status to ENABLED.
 * Does NOT bypass license checks — those are performed separately by the
 * gateway and the license module.
 */
export async function enablePlugin(
  pluginId: string,
  doctorId: string,
  userId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const registration = await prisma.pluginRegistration.findUnique({
    where: { pluginId_doctorId: { pluginId, doctorId } },
  });

  if (!registration) {
    return { success: false, error: "Plugin is not installed. Install it first." };
  }
  if (registration.status === "ENABLED") {
    return { success: true };
  }

  if (!isPluginRegistered(pluginId)) {
    return { success: false, error: `Plugin not found: ${pluginId}` };
  }
  const plugin = getPlugin(pluginId);

  await prisma.pluginRegistration.update({
    where: { pluginId_doctorId: { pluginId, doctorId } },
    data: { status: "ENABLED" },
  });

  await runLifecycleHook(plugin, "onEnable", { doctorId });

  writeAudit(userId, "PLUGIN_REGISTRATION", registration.id, "PLUGIN_ENABLED", { pluginId });

  return { success: true };
}

// ── Disable ───────────────────────────────────────────────────────────────

/**
 * Disable an enabled plugin. Sets status to DISABLED.
 * Config is preserved so the plugin can be re-enabled without reconfiguration.
 * PPMS Core and other plugins are unaffected.
 */
export async function disablePlugin(
  pluginId: string,
  doctorId: string,
  userId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const registration = await prisma.pluginRegistration.findUnique({
    where: { pluginId_doctorId: { pluginId, doctorId } },
  });

  if (!registration) {
    return { success: false, error: "Plugin is not installed." };
  }
  if (registration.status === "DISABLED") {
    return { success: true };
  }

  if (isPluginRegistered(pluginId)) {
    const plugin = getPlugin(pluginId);
    await runLifecycleHook(plugin, "onDisable", { doctorId });
  }

  await prisma.pluginRegistration.update({
    where: { pluginId_doctorId: { pluginId, doctorId } },
    data: { status: "DISABLED" },
  });

  writeAudit(userId, "PLUGIN_REGISTRATION", registration.id, "PLUGIN_DISABLED", { pluginId });

  return { success: true };
}

// ── Remove ────────────────────────────────────────────────────────────────

/**
 * Remove a plugin completely. Deletes PluginRegistration and PluginConfig rows.
 * PluginLicense is retained for billing audit purposes (soft removal).
 */
export async function removePlugin(
  pluginId: string,
  doctorId: string,
  userId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const registration = await prisma.pluginRegistration.findUnique({
    where: { pluginId_doctorId: { pluginId, doctorId } },
  });

  if (!registration) {
    return { success: false, error: "Plugin is not installed." };
  }

  if (isPluginRegistered(pluginId)) {
    const plugin = getPlugin(pluginId);
    await runLifecycleHook(plugin, "onRemove", { doctorId });
  }

  // Delete config for all hospitals under this doctor
  const doctorHospitals = await prisma.doctorHospitalLink.findMany({
    where: { doctorId },
    select: { hospitalId: true },
  });
  const hospitalIds = doctorHospitals.map((h) => h.hospitalId);

  await prisma.pluginConfig.deleteMany({
    where: { pluginId, hospitalId: { in: hospitalIds } },
  });

  await prisma.pluginRegistration.delete({
    where: { pluginId_doctorId: { pluginId, doctorId } },
  });

  writeAudit(userId, "PLUGIN_REGISTRATION", registration.id, "PLUGIN_REMOVED", { pluginId });

  return { success: true };
}

// ── Version update ────────────────────────────────────────────────────────

/**
 * Update the registered version of an installed plugin.
 * Typically called on startup when a newer plugin version is detected.
 */
export async function updatePluginVersion(
  pluginId: string,
  doctorId: string,
  userId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const registration = await prisma.pluginRegistration.findUnique({
    where: { pluginId_doctorId: { pluginId, doctorId } },
  });

  if (!registration) {
    return { success: false, error: "Plugin is not installed." };
  }

  if (!isPluginRegistered(pluginId)) {
    return { success: false, error: `Plugin not found: ${pluginId}` };
  }

  const plugin = getPlugin(pluginId);
  const fromVersion = registration.version;
  const toVersion = plugin.manifest.version;

  if (fromVersion === toVersion) return { success: true };

  try {
    assertVersionCompatible(pluginId, PPMS_VERSION);
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }

  await runLifecycleHook(plugin, "onUpdate", { doctorId, fromVersion, toVersion });

  await prisma.pluginRegistration.update({
    where: { pluginId_doctorId: { pluginId, doctorId } },
    data: { version: toVersion },
  });

  writeAudit(userId, "PLUGIN_REGISTRATION", registration.id, "PLUGIN_UPDATED", {
    pluginId,
    fromVersion,
    toVersion,
  });

  return { success: true };
}

// ── Status queries ────────────────────────────────────────────────────────

/** Get the current DB-backed status of a plugin for a doctor. */
export async function getPluginStatus(
  pluginId: string,
  doctorId: string,
): Promise<PluginStatus | "NOT_INSTALLED"> {
  const registration = await prisma.pluginRegistration.findUnique({
    where: { pluginId_doctorId: { pluginId, doctorId } },
    select: { status: true },
  });
  return (registration?.status as PluginStatus) ?? "NOT_INSTALLED";
}

/** Returns true only when the plugin is currently ENABLED for this doctor. */
export async function isPluginEnabled(
  pluginId: string,
  doctorId: string,
): Promise<boolean> {
  const status = await getPluginStatus(pluginId, doctorId);
  return status === "ENABLED";
}

/**
 * Lists all plugins (registered + DB state) for a doctor.
 * Merges static manifest data with live DB registration state.
 */
export async function listPluginsForDoctor(doctorId: string): Promise<PluginRecord[]> {
  const allPlugins = getAllRegisteredPlugins();

  const registrations = await prisma.pluginRegistration.findMany({
    where: { doctorId },
    select: {
      id: true,
      pluginId: true,
      status: true,
      version: true,
      installedAt: true,
      updatedAt: true,
    },
  });

  const regByPluginId = new Map(registrations.map((r) => [r.pluginId, r]));

  return allPlugins.map(({ manifest }) => {
    const reg = regByPluginId.get(manifest.pluginId);
    return {
      manifest,
      registrationId: reg?.id,
      status: (reg?.status as PluginStatus) ?? "NOT_INSTALLED",
      installedVersion: reg?.version,
      installedAt: reg?.installedAt,
      updatedAt: reg?.updatedAt,
    };
  });
}

/**
 * Throws PluginDisabledError if the plugin is not ENABLED.
 * Call this in any plugin API route before executing business logic.
 */
export async function assertPluginEnabled(
  pluginId: string,
  doctorId: string,
): Promise<void> {
  if (!(await isPluginEnabled(pluginId, doctorId))) {
    throw new PluginDisabledError(pluginId);
  }
}
