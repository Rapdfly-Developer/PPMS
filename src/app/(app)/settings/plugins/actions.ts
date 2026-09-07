"use server";

import "@/plugins";
import { requireRole, requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import {
  installPlugin,
  enablePlugin,
  disablePlugin,
  removePlugin,
  listPluginsForDoctor,
  getPluginStatus,
  checkPluginLicense,
} from "@/plugin-framework";
import {
  savePluginConfigBatch,
  validatePluginConfig,
  getPluginConfigAll,
} from "@/plugin-framework/config";
import { getManifest } from "@/plugin-framework/registry";
import type { PluginRecord } from "@/plugin-framework/types";

// ── List all plugins for the current doctor ───────────────────────────────

export async function getPluginsForCurrentDoctor(): Promise<{
  plugins: PluginRecord[];
  error?: string;
}> {
  try {
    const user = await requirePermission("plugins.view");
    const doctorId =
      user.role === "DOCTOR" ? user.profileId : (user.doctorId ?? null);
    if (!doctorId) return { plugins: [], error: "No doctor scope." };
    const plugins = await listPluginsForDoctor(doctorId);
    return { plugins };
  } catch {
    return { plugins: [], error: "Failed to load plugins." };
  }
}

// ── Install ───────────────────────────────────────────────────────────────

export async function installPluginAction(
  pluginId: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole("DOCTOR");
  const doctorId = user.profileId;

  const result = await installPlugin(pluginId, doctorId, user.id);
  if (!result.success) return result;

  revalidatePath("/settings/plugins");
  return { success: true };
}

// ── Enable ────────────────────────────────────────────────────────────────

export async function enablePluginAction(
  pluginId: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole("DOCTOR");
  const doctorId = user.profileId;

  // Check license before enabling
  const license = await checkPluginLicense(pluginId, doctorId);
  if (license.isBlocked) {
    return {
      success: false,
      error: `Plugin license is ${license.status}. Please renew or subscribe.`,
    };
  }

  const result = await enablePlugin(pluginId, doctorId, user.id);
  if (!result.success) return result;

  revalidatePath("/settings/plugins");
  return { success: true };
}

// ── Disable ───────────────────────────────────────────────────────────────

export async function disablePluginAction(
  pluginId: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole("DOCTOR");
  const doctorId = user.profileId;

  const result = await disablePlugin(pluginId, doctorId, user.id);
  if (!result.success) return result;

  revalidatePath("/settings/plugins");
  return { success: true };
}

// ── Remove ────────────────────────────────────────────────────────────────

export async function removePluginAction(
  pluginId: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole("DOCTOR");
  const doctorId = user.profileId;

  const result = await removePlugin(pluginId, doctorId, user.id);
  if (!result.success) return result;

  writeAudit(user.id, "PLUGIN", pluginId, "PLUGIN_REMOVED");
  revalidatePath("/settings/plugins");
  return { success: true };
}

// ── Configure ─────────────────────────────────────────────────────────────

export async function savePluginConfigAction(
  pluginId: string,
  hospitalId: string,
  values: Record<string, unknown>,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole("DOCTOR");

  // Validate against manifest schema
  try {
    const manifest = getManifest(pluginId);
    const error = validatePluginConfig(values, manifest.configuration);
    if (error) return { success: false, error };
  } catch {
    return { success: false, error: "Plugin not found." };
  }

  await savePluginConfigBatch(pluginId, hospitalId, values);

  writeAudit(user.id, "PLUGIN_CONFIG", `${pluginId}:${hospitalId}`, "CONFIG_UPDATED", values);
  revalidatePath("/settings/plugins");
  return { success: true };
}

// ── Get config for a specific plugin + hospital ───────────────────────────

export async function getPluginConfigAction(
  pluginId: string,
  hospitalId: string,
): Promise<{ config: Record<string, unknown>; error?: string }> {
  await requirePermission("plugins.manage");

  try {
    const manifest = getManifest(pluginId);
    const config = await getPluginConfigAll(pluginId, hospitalId, manifest.configuration);
    return { config };
  } catch {
    return { config: {}, error: "Plugin not found." };
  }
}

// ── Get license info for a plugin ─────────────────────────────────────────

export async function getPluginLicenseAction(pluginId: string): Promise<{
  status: string;
  trialEndsAt?: Date | null;
  expiresAt?: Date | null;
  usageCount: number;
  usageLimit: number | null;
  isBlocked: boolean;
  error?: string;
}> {
  const user = await requirePermission("plugins.view");
  const doctorId =
    user.role === "DOCTOR" ? user.profileId : (user.doctorId ?? null);
  if (!doctorId) return { status: "UNKNOWN", usageCount: 0, usageLimit: null, isBlocked: true };

  const info = await checkPluginLicense(pluginId, doctorId);
  return { ...info };
}
