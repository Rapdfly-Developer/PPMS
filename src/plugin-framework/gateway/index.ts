/**
 * Plugin Gateway — Public API
 *
 * This is the ONLY import path that plugin code in src/plugins/** should use
 * to interact with PPMS Core. Direct imports from @/lib/prisma are forbidden
 * in plugin code (enforced by ESLint — see eslint.config.mjs).
 *
 * Plugins get:
 *   - Gateway authorization (auth + permission + plugin-enabled + license)
 *   - Tenant scope resolution
 *   - Config read/write
 *   - License checks
 *   - Plugin status checks
 */

export { authorizeGatewayRequest, authorizePluginAction, resolveTenantScope } from "./auth";
export type { AuthResult, GatewayRequest, GatewayResult, TenantScope } from "./types";

export {
  checkPluginLicense,
  createPluginTrial,
  incrementPluginUsage,
  invalidatePluginLicenseCache,
} from "../license";

export {
  getPluginConfig,
  getPluginConfigAll,
  savePluginConfig,
  savePluginConfigBatch,
  validatePluginConfig,
} from "../config";

export {
  isPluginEnabled,
  assertPluginEnabled,
  getPluginStatus,
} from "../manager";

export { userHasPluginPermission, getPluginPermissions } from "../permissions";
