/**
 * PPMS Plugin Framework — Main Entry Point
 *
 * Import from "@/plugin-framework" to access the full framework API.
 * Plugin code should prefer "@/plugin-framework/gateway" for data access.
 */

// Types
export type {
  Plugin,
  PluginManifest,
  PluginStatus,
  PluginLicenseStatus,
  PluginRecord,
  PluginLifecycleHooks,
  GatewayContext,
  ConfigField,
  ConfigFieldType,
  RouteSpec,
  UiSurface,
  PluginLicensingSpec,
  PluginDependency,
  InstallPayload,
  EnablePayload,
  DisablePayload,
  RemovePayload,
  UpdatePayload,
} from "./types";

// Errors
export {
  PluginError,
  PluginNotFoundError,
  PluginVersionError,
  PluginPermissionError,
  PluginDisabledError,
  PluginGatewayError,
} from "./types";

// Registry (static, build-time)
export {
  registerPlugin,
  getAllRegisteredPlugins,
  getAllManifests,
  getPlugin,
  getManifest,
  isPluginRegistered,
  isPpmsVersionCompatible,
  assertVersionCompatible,
  getAllPluginPermissionKeys,
} from "./registry";

// Manager (DB-backed, runtime)
export {
  installPlugin,
  enablePlugin,
  disablePlugin,
  removePlugin,
  updatePluginVersion,
  getPluginStatus,
  isPluginEnabled,
  listPluginsForDoctor,
  assertPluginEnabled,
} from "./manager";

// Lifecycle
export { runLifecycleHook, runLifecycleHookForAll } from "./lifecycle";

// Permissions
export {
  registerPluginPermissions,
  deregisterPluginPermissions,
  userHasPluginPermission,
  getPluginPermissions,
} from "./permissions";

// Configuration
export {
  getPluginConfig,
  getPluginConfigAll,
  savePluginConfig,
  savePluginConfigBatch,
  deletePluginConfig,
  validatePluginConfig,
} from "./config";

// Licensing
export {
  checkPluginLicense,
  createPluginTrial,
  incrementPluginUsage,
  invalidatePluginLicenseCache,
} from "./license";
export type { PluginLicenseInfo } from "./license";

// Startup
export { initPluginFramework } from "./startup";
