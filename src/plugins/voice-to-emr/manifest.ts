/**
 * Voice-to-EMR AI — Plugin Manifest
 *
 * Minimal manifest-only entry. All business logic (voice capture, transcription,
 * AI formatting) lives in the separately-deployed Voice-to-EMR repository.
 * PPMS Core knows nothing about the implementation — only what the plugin
 * declares here: its identity, permissions, and deployment origin.
 */

import type { PluginManifest } from "@/plugin-framework";

export const PLUGIN_ID = "ppms.plugin.voice-to-emr";

export const VOICE_EMR_PERMISSIONS = {
  /** See the Voice-to-EMR panel at all. */
  VIEW: "ai.voice-emr.view",
  /** Capture and transcribe voice recordings. */
  TRANSCRIBE: "ai.voice-emr.transcribe",
  /** Generate an EMR draft from a transcription for doctor review. */
  CREATE_DRAFT: "ai.voice-emr.create-draft",
} as const;

export const manifest: PluginManifest = {
  pluginId: PLUGIN_ID,
  name: "Voice-to-EMR AI",
  description:
    "Converts voice recordings into structured EMR entries. Records dictated consultations, transcribes them, and generates a formatted draft for doctor review and confirmation. The doctor must explicitly approve before anything is written to the record.",
  version: "1.0.0",
  author: "PPMS",
  minPpmsVersion: "16.2.0",

  permissions: [
    VOICE_EMR_PERMISSIONS.VIEW,
    VOICE_EMR_PERMISSIONS.TRANSCRIBE,
    VOICE_EMR_PERMISSIONS.CREATE_DRAFT,
  ],

  defaultPermissions: {
    DOCTOR: ["*"],
  },

  requiredApis: ["patient.demographics", "visit.context"],

  configuration: [
    {
      key: "language",
      label: "Transcription Language",
      type: "select",
      description: "Primary spoken language for voice recognition.",
      options: ["en", "ta", "hi", "te", "ml", "kn"],
      default: "en",
      required: true,
    },
    {
      key: "autoCapitalize",
      label: "Auto-Capitalize Medical Terms",
      type: "boolean",
      description: "Automatically capitalize recognized drug names and diagnoses.",
      default: true,
    },
  ],

  dependencies: [],
  apiRoutes: [],

  ui: {
    emrPanel: {
      enabled: true,
      triggerPermission: VOICE_EMR_PERMISSIONS.VIEW,
    },
    settingsPage: false,
  },

  licensing: {
    featureKey: "VOICE_TO_EMR",
    trialDays: 14,
    monthlyUsageLimit: 200,
  },

  externalOrigin: process.env.NEXT_PUBLIC_VOICE_EMR_ORIGIN ?? null,
};
