/**
 * AI Clinical Copilot — Plugin Manifest
 *
 * Uses the Phase 1 Plugin Contract verbatim. No second manifest system.
 */

import type { PluginManifest } from "@/plugin-framework";

export const PLUGIN_ID = "ppms.plugin.ai-clinical-copilot";

/** Permission keys, in PPMS dot-notation convention (cf. "patients.view"). */
export const COPILOT_PERMISSIONS = {
  /** See the Copilot panel at all. */
  VIEW: "ai.copilot.view",
  /** Run the summarisation capabilities. */
  SUMMARIZE: "ai.copilot.summarize",
  /** Ask free-text questions about the patient record. */
  ASK: "ai.copilot.ask",
  /** Generate consultation-note drafts for review. */
  DRAFT: "ai.copilot.draft",
} as const;

/**
 * PPMS core permissions the caller must ALSO hold. The Copilot never widens a
 * user's reach: if you cannot open the patient record in PPMS, you cannot read
 * it through the Copilot either.
 */
export const REQUIRED_CORE_PERMISSIONS = ["patients.view"];

export const manifest: PluginManifest = {
  pluginId: PLUGIN_ID,
  name: "AI Clinical Copilot",
  description:
    "Decision-support assistant that summarises a patient's history, medications, investigations and timeline, answers questions about the record, and drafts consultation notes for doctor review.",
  version: "1.0.0",
  author: "PPMS",
  minPpmsVersion: "16.2.0",

  permissions: [
    COPILOT_PERMISSIONS.VIEW,
    COPILOT_PERMISSIONS.SUMMARIZE,
    COPILOT_PERMISSIONS.ASK,
    COPILOT_PERMISSIONS.DRAFT,
  ],

  // Doctor gets everything. Hospital admins get nothing by default — the
  // Copilot reads clinical detail, so access is granted deliberately, not
  // inherited. An administrator can widen this in Role Manager afterwards.
  defaultPermissions: {
    DOCTOR: ["*"],
  },

  requiredApis: [
    "patient.demographics",
    "visit.context",
    "visit.history",
    "patient.timeline",
    "appointment.history",
  ],

  configuration: [
    {
      key: "provider",
      label: "AI Provider",
      type: "select",
      description: "Which AI service the Copilot calls.",
      options: ["anthropic"],
      default: "anthropic",
      required: true,
    },
    {
      key: "model",
      label: "Model",
      type: "select",
      description: "Model used for Copilot requests.",
      options: ["claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5"],
      default: "claude-opus-4-8",
      required: true,
    },
    {
      key: "maxHistoryVisits",
      label: "Max History Visits",
      type: "number",
      description:
        "Upper bound on how many past visits may be included in a request. Lower values reduce cost and data exposure.",
      min: 1,
      max: 20,
      default: 8,
    },
    {
      key: "streaming",
      label: "Stream Responses",
      type: "boolean",
      description: "Show the response as it is generated instead of all at once.",
      default: true,
    },
  ],

  dependencies: [],

  apiRoutes: [
    {
      method: "POST",
      path: "/api/plugins/ai-clinical-copilot/generate",
      permission: COPILOT_PERMISSIONS.VIEW,
      description: "Run a Copilot capability and return the validated response.",
    },
    {
      method: "POST",
      path: "/api/plugins/ai-clinical-copilot/stream",
      permission: COPILOT_PERMISSIONS.VIEW,
      description: "Run a Copilot capability and stream the response.",
    },
  ],

  ui: {
    emrPanel: {
      enabled: true,
      triggerPermission: COPILOT_PERMISSIONS.VIEW,
    },
    settingsPage: true,
  },

  licensing: {
    featureKey: "AI_COPILOT",
    trialDays: 14,
    monthlyUsageLimit: 500,
  },

  externalOrigin: process.env.NEXT_PUBLIC_COPILOT_ORIGIN ?? null,
};
