/**
 * Generic PPMS Plugin Framework — Core Types
 *
 * All plugin code and the framework itself depend only on this file.
 * No AI, voice, or feature-specific logic lives here.
 */

import type { ComponentType } from "react";

// ── Plugin status (mirrors the Prisma enum) ───────────────────────────────

export type PluginStatus = "INSTALLED" | "ENABLED" | "DISABLED";

export type PluginLicenseStatus = "TRIAL" | "ACTIVE" | "EXPIRED" | "SUSPENDED";

// ── Configuration field schema (declared by the plugin manifest) ──────────

export type ConfigFieldType = "string" | "number" | "boolean" | "select" | "secret";

export type ConfigField = {
  key: string;
  label: string;
  type: ConfigFieldType;
  description?: string;
  default?: string | number | boolean;
  required?: boolean;
  // For type "select"
  options?: string[];
  // For type "number"
  min?: number;
  max?: number;
};

// ── API route declaration (advertises endpoints this plugin mounts) ───────

export type RouteSpec = {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  /** Relative path, e.g. "/api/plugins/my-plugin/health" */
  path: string;
  /** Permission key that must be held by the caller */
  permission: string;
  description?: string;
};

// ── UI surface declarations ───────────────────────────────────────────────

export type UiSurface = {
  /**
   * Inject a panel into the EMR tab shell.
   * The plugin provides the React component; the framework conditionally
   * renders it when the plugin is ENABLED and the user holds triggerPermission.
   */
  emrPanel?: {
    enabled: boolean;
    triggerPermission: string;
  };
  /** Whether this plugin has a dedicated settings/config page. */
  settingsPage?: boolean;
  /** Whether this plugin adds a sidebar nav entry. */
  sidebarEntry?: {
    label: string;
    href: string;
    permission: string;
  };
};

// ── Licensing requirements (declared by the plugin) ───────────────────────

export type PluginLicensingSpec = {
  /** Unique key for this plugin's license (e.g. "AI_COPILOT"). */
  featureKey: string;
  /** If set, plugin can only be enabled on this plan or higher. */
  requiredPlan?: "TRIAL" | "MONTHLY" | "YEARLY";
  /** Default trial duration in days (default: 14). */
  trialDays?: number;
  /** Monthly usage cap for metered plugins (null = unlimited). */
  monthlyUsageLimit?: number;
};

// ── Dependency declaration ────────────────────────────────────────────────

export type PluginDependency = {
  pluginId: string;
  /** Semver range string, e.g. "^1.0.0" */
  versionRange: string;
};

// ── The Plugin Manifest — the single source of truth for a plugin ─────────

export type PluginManifest = {
  /** Reverse-DNS style unique ID: "ppms.plugin.ai-clinical-copilot" */
  pluginId: string;
  name: string;
  description: string;
  /** Semver: "1.0.0" */
  version: string;
  author: string;
  /** Minimum PPMS version this plugin requires (semver: "16.2.0") */
  minPpmsVersion: string;

  /**
   * Permission keys this plugin declares. They are upserted into the PPMS
   * Permission table on install and assigned to roles per defaultPermissions.
   */
  permissions: string[];
  /**
   * Default role → permissions mapping applied on first install.
   * { DOCTOR: ["*"] } grants the doctor full access to all plugin permissions.
   */
  defaultPermissions: Record<string, string[]>;

  /** Framework APIs this plugin requires (e.g. ["patient.context", "visit.context"]). */
  requiredApis: string[];

  /** Configuration fields the plugin accepts. */
  configuration: ConfigField[];

  /** Other plugins this plugin depends on (currently informational only). */
  dependencies: PluginDependency[];

  /** Routes this plugin mounts under /api/plugins/<pluginId>/. */
  apiRoutes: RouteSpec[];

  /** Which UI surfaces this plugin uses. */
  ui: UiSurface;

  /** Plugin licensing spec. */
  licensing: PluginLicensingSpec;
};

// ── Runtime plugin record (Manifest + DB state) ───────────────────────────

export type PluginRecord = {
  manifest: PluginManifest;
  /** DB registration row id, undefined if never installed. */
  registrationId?: string;
  status: PluginStatus | "NOT_INSTALLED";
  /** Version string from DB at install time. */
  installedVersion?: string;
  installedAt?: Date;
  updatedAt?: Date;
};

// ── Gateway request context ───────────────────────────────────────────────

export type GatewayContext = {
  /** Session user making the request. */
  userId: string;
  role: string;
  doctorId: string;
  hospitalId: string;
  permissions: string[];
  /** The plugin making the gateway call. */
  pluginId: string;
};

// ── Plugin lifecycle hook payloads ────────────────────────────────────────

export type InstallPayload = { doctorId: string; version: string };
export type EnablePayload  = { doctorId: string; hospitalId?: string };
export type DisablePayload = { doctorId: string };
export type RemovePayload  = { doctorId: string };
export type UpdatePayload  = { doctorId: string; fromVersion: string; toVersion: string };

// ── Plugin lifecycle hook interface ───────────────────────────────────────

export type PluginLifecycleHooks = {
  onInstall?: (payload: InstallPayload) => Promise<void>;
  onEnable?:  (payload: EnablePayload)  => Promise<void>;
  onDisable?: (payload: DisablePayload) => Promise<void>;
  onRemove?:  (payload: RemovePayload)  => Promise<void>;
  onUpdate?:  (payload: UpdatePayload)  => Promise<void>;
};

// ── UI component contracts ────────────────────────────────────────────────

/**
 * Props every EMR panel plugin component receives from the generic EMR slot.
 * The slot supplies only identifiers already visible on the EMR page — the
 * plugin must fetch anything further through the gateway, under its own
 * permission checks.
 */
export type PluginEmrPanelProps = {
  patientUdid: string;
  patientName: string;
  visitId: string;
  /** True when the visit is CLOSED — panels should render read-only. */
  visitClosed: boolean;
};

/**
 * React components a plugin contributes to PPMS UI extension points.
 * Kept separate from the manifest because the manifest is serialisable data
 * while these are live component references.
 */
export type PluginComponents = {
  /** Rendered by the generic EMR slot when ui.emrPanel.enabled is true. */
  emrPanel?: ComponentType<PluginEmrPanelProps>;
};

// ── The full Plugin definition (manifest + hooks + components) ────────────

export type Plugin = {
  manifest: PluginManifest;
  hooks?: PluginLifecycleHooks;
  components?: PluginComponents;
};

// ── Error types ───────────────────────────────────────────────────────────

export class PluginError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly pluginId?: string,
  ) {
    super(message);
    this.name = "PluginError";
  }
}

export class PluginNotFoundError extends PluginError {
  constructor(pluginId: string) {
    super(`Plugin not found: ${pluginId}`, "PLUGIN_NOT_FOUND", pluginId);
  }
}

export class PluginVersionError extends PluginError {
  constructor(pluginId: string, detail: string) {
    super(`Plugin version incompatible: ${detail}`, "VERSION_INCOMPATIBLE", pluginId);
  }
}

export class PluginPermissionError extends PluginError {
  constructor(pluginId: string, permission: string) {
    super(
      `Missing permission '${permission}' for plugin '${pluginId}'`,
      "PERMISSION_DENIED",
      pluginId,
    );
  }
}

export class PluginDisabledError extends PluginError {
  constructor(pluginId: string) {
    super(`Plugin is not enabled: ${pluginId}`, "PLUGIN_DISABLED", pluginId);
  }
}

export class PluginGatewayError extends PluginError {
  constructor(message: string, code = "GATEWAY_ERROR", pluginId?: string) {
    super(message, code, pluginId);
    this.name = "PluginGatewayError";
  }
}
