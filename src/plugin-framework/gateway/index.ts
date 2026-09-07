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
 *   - Authorized, tenant-scoped clinical data access (never raw Prisma)
 *   - Audit writing
 *   - Config read/write
 *   - License checks and usage metering
 *   - Plugin status checks
 */

export { authorizeGatewayRequest, authorizePluginAction, resolveTenantScope } from "./auth";
export type { AuthResult, GatewayRequest, GatewayResult, TenantScope } from "./types";
export type { GatewayContext } from "../types";

// Authorized clinical data access — the only data path available to plugins
export {
  assertPatientInScope,
  getPatient,
  getVisits,
  getAppointments,
  getPatientTimeline,
} from "./data";
export type {
  PatientDTO,
  VisitDTO,
  MedicationDTO,
  DiagnosisDTO,
  InvestigationDTO,
  AppointmentDTO,
  TimelineEventDTO,
} from "./data";

// Audit
export { writePluginAudit } from "./audit";
export type { PluginAuditEntry } from "./audit";

// Errors plugins are expected to catch and map to responses
export {
  PluginError,
  PluginGatewayError,
  PluginDisabledError,
  PluginPermissionError,
} from "../types";

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
