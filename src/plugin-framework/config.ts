/**
 * Plugin Configuration
 *
 * Stores and retrieves per-hospital plugin configuration values.
 * Each value is a JSON blob stored in the PluginConfig table.
 *
 * Plugins declare their config schema in their manifest; this module stores
 * values without knowing their semantics. Validation against the schema is
 * the caller's responsibility (e.g. the settings Server Action validates
 * before calling savePluginConfig).
 */

import { prisma } from "@/lib/prisma";
import type { ConfigField } from "./types";

// ── Read ──────────────────────────────────────────────────────────────────

/**
 * Get a single config value for a plugin + hospital.
 * Returns the manifest default if no row exists.
 */
export async function getPluginConfig(
  pluginId: string,
  hospitalId: string,
  key: string,
  defaultValue?: unknown,
): Promise<unknown> {
  const row = await prisma.pluginConfig.findUnique({
    where: { pluginId_hospitalId_key: { pluginId, hospitalId, key } },
    select: { value: true },
  });
  return row?.value ?? defaultValue;
}

/**
 * Get all config values for a plugin + hospital as a plain object.
 * Missing keys fall back to the defaults declared in the config schema.
 */
export async function getPluginConfigAll(
  pluginId: string,
  hospitalId: string,
  schema: ConfigField[],
): Promise<Record<string, unknown>> {
  const rows = await prisma.pluginConfig.findMany({
    where: { pluginId, hospitalId },
    select: { key: true, value: true },
  });

  const stored = new Map(rows.map((r) => [r.key, r.value]));
  const result: Record<string, unknown> = {};

  for (const field of schema) {
    result[field.key] = stored.has(field.key) ? stored.get(field.key) : field.default;
  }

  return result;
}

// ── Write ─────────────────────────────────────────────────────────────────

/**
 * Save a single config value.
 * Uses upsert so it works for both first-time set and updates.
 */
export async function savePluginConfig(
  pluginId: string,
  hospitalId: string,
  key: string,
  value: unknown,
): Promise<void> {
  await prisma.pluginConfig.upsert({
    where: { pluginId_hospitalId_key: { pluginId, hospitalId, key } },
    update: { value: value as never },
    create: { pluginId, hospitalId, key, value: value as never },
  });
}

/**
 * Save multiple config values at once (batch upsert).
 * Any key not in the batch is left unchanged.
 */
export async function savePluginConfigBatch(
  pluginId: string,
  hospitalId: string,
  values: Record<string, unknown>,
): Promise<void> {
  await Promise.all(
    Object.entries(values).map(([key, value]) =>
      savePluginConfig(pluginId, hospitalId, key, value),
    ),
  );
}

// ── Delete ────────────────────────────────────────────────────────────────

/**
 * Delete all config values for a plugin + hospital.
 * Called when a plugin is removed for a doctor.
 */
export async function deletePluginConfig(
  pluginId: string,
  hospitalId: string,
): Promise<void> {
  await prisma.pluginConfig.deleteMany({ where: { pluginId, hospitalId } });
}

/**
 * Delete all config for a plugin across all hospitals.
 * Called during full plugin removal.
 */
export async function deleteAllPluginConfig(pluginId: string): Promise<void> {
  await prisma.pluginConfig.deleteMany({ where: { pluginId } });
}

// ── Validation ────────────────────────────────────────────────────────────

/** Validate a config object against a schema. Returns error string or null. */
export function validatePluginConfig(
  values: Record<string, unknown>,
  schema: ConfigField[],
): string | null {
  for (const field of schema) {
    const value = values[field.key];

    if (field.required && (value === undefined || value === null || value === "")) {
      return `"${field.label}" is required.`;
    }
    if (value === undefined || value === null) continue;

    if (field.type === "number") {
      const n = Number(value);
      if (isNaN(n)) return `"${field.label}" must be a number.`;
      if (field.min !== undefined && n < field.min)
        return `"${field.label}" must be at least ${field.min}.`;
      if (field.max !== undefined && n > field.max)
        return `"${field.label}" must be at most ${field.max}.`;
    }

    if (field.type === "select" && field.options) {
      if (!field.options.includes(String(value))) {
        return `"${field.label}" must be one of: ${field.options.join(", ")}.`;
      }
    }
  }
  return null;
}
