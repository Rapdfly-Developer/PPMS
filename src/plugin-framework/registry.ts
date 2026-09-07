/**
 * PPMS Plugin Registry
 *
 * Maintains the authoritative list of plugins that exist in this PPMS build.
 * All plugins must be statically registered here at build time because
 * Next.js App Router does not support runtime module loading.
 *
 * The registry is in-memory; DB state (enabled/disabled/version) is read from
 * PluginRegistration via the manager.
 */

import type { Plugin, PluginManifest } from "./types";
import { PluginError, PluginNotFoundError, PluginVersionError } from "./types";

// ── Static plugin registry ────────────────────────────────────────────────
//
// To register a new plugin, import its Plugin object and add it here.
// Order does not matter; registry is keyed by pluginId.
//
const REGISTERED_PLUGINS: Map<string, Plugin> = new Map();

// ── PPMS version (used for compatibility checks) ──────────────────────────

function parseSemver(v: string): [number, number, number] {
  const parts = v.split(".").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new PluginError(`Invalid semver: "${v}"`, "INVALID_VERSION");
  }
  return [parts[0], parts[1], parts[2]];
}

/**
 * Returns true when the installed PPMS version satisfies the plugin's
 * minPpmsVersion requirement (PPMS >= minRequired).
 */
export function isPpmsVersionCompatible(
  ppmsVersion: string,
  minRequired: string,
): boolean {
  const [pa, pb, pc] = parseSemver(ppmsVersion);
  const [ra, rb, rc] = parseSemver(minRequired);
  if (pa !== ra) return pa > ra;
  if (pb !== rb) return pb > rb;
  return pc >= rc;
}

// ── Registration API ──────────────────────────────────────────────────────

/**
 * Register a plugin with the framework.
 * Call this at the module level from the plugin's own file.
 * Duplicate pluginIds are rejected.
 */
export function registerPlugin(plugin: Plugin): void {
  const { pluginId } = plugin.manifest;

  if (REGISTERED_PLUGINS.has(pluginId)) {
    throw new PluginError(
      `Plugin already registered: ${pluginId}`,
      "ALREADY_REGISTERED",
      pluginId,
    );
  }

  validateManifest(plugin.manifest);
  REGISTERED_PLUGINS.set(pluginId, plugin);
}

/** Validate the required fields of a manifest before accepting registration. */
function validateManifest(m: PluginManifest): void {
  const required: (keyof PluginManifest)[] = [
    "pluginId", "name", "description", "version", "author",
    "minPpmsVersion", "permissions", "requiredApis",
    "configuration", "dependencies", "apiRoutes", "ui", "licensing",
  ];
  for (const key of required) {
    if (m[key] === undefined || m[key] === null) {
      throw new PluginError(
        `Manifest for "${m.pluginId}" is missing required field: ${key}`,
        "INVALID_MANIFEST",
        m.pluginId,
      );
    }
  }
  if (!m.pluginId.includes(".")) {
    throw new PluginError(
      `pluginId must be in reverse-DNS format (e.g. "ppms.plugin.name"), got: ${m.pluginId}`,
      "INVALID_MANIFEST",
      m.pluginId,
    );
  }
  if (!m.licensing?.featureKey) {
    throw new PluginError(
      `Manifest for "${m.pluginId}" must declare licensing.featureKey`,
      "INVALID_MANIFEST",
      m.pluginId,
    );
  }
}

// ── Query API ─────────────────────────────────────────────────────────────

/** Returns all statically registered plugin manifests. */
export function getAllRegisteredPlugins(): Plugin[] {
  return Array.from(REGISTERED_PLUGINS.values());
}

/** Returns all registered manifests (convenience wrapper). */
export function getAllManifests(): PluginManifest[] {
  return getAllRegisteredPlugins().map((p) => p.manifest);
}

/** Finds a registered plugin by pluginId. Throws if not found. */
export function getPlugin(pluginId: string): Plugin {
  const plugin = REGISTERED_PLUGINS.get(pluginId);
  if (!plugin) throw new PluginNotFoundError(pluginId);
  return plugin;
}

/** Returns the manifest for a registered plugin. Throws if not found. */
export function getManifest(pluginId: string): PluginManifest {
  return getPlugin(pluginId).manifest;
}

/** Returns true if a plugin with the given ID is statically registered. */
export function isPluginRegistered(pluginId: string): boolean {
  return REGISTERED_PLUGINS.has(pluginId);
}

/**
 * Checks that the plugin's minPpmsVersion is satisfied by the running PPMS.
 * Throws PluginVersionError if not compatible.
 */
export function assertVersionCompatible(
  pluginId: string,
  ppmsVersion: string,
): void {
  const manifest = getManifest(pluginId);
  if (!isPpmsVersionCompatible(ppmsVersion, manifest.minPpmsVersion)) {
    throw new PluginVersionError(
      pluginId,
      `Plugin requires PPMS >= ${manifest.minPpmsVersion}, running ${ppmsVersion}`,
    );
  }
}

/** Returns all permission keys declared by all registered plugins. */
export function getAllPluginPermissionKeys(): string[] {
  return getAllManifests().flatMap((m) => m.permissions);
}

/**
 * Unregister a plugin (test utility only — not called at runtime).
 * Production code never calls this.
 */
export function _unregisterPlugin(pluginId: string): void {
  REGISTERED_PLUGINS.delete(pluginId);
}
