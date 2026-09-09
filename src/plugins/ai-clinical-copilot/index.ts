/**
 * AI Clinical Copilot — plugin entry point.
 *
 * Registers the plugin manifest with the framework so that:
 *   - ExternalPluginSlot can resolve the plugin, sign a scoped token, and
 *     render the externally-deployed Copilot inside the EMR iframe.
 *   - The plugin token API (/api/v1/plugin-token) can issue tokens restricted
 *     to this plugin's declared requiredApis (data scopes).
 *
 * There is no in-process AI implementation here. The actual Copilot logic
 * (Claude API calls, prompts, UI) lives in the separately deployed Vercel
 * project pointed to by NEXT_PUBLIC_COPILOT_ORIGIN.
 */

import { registerPlugin, isPluginRegistered, type Plugin } from "@/plugin-framework";

import { manifest, PLUGIN_ID, COPILOT_PERMISSIONS } from "./manifest";

export const aiClinicalCopilot: Plugin = {
  manifest,

  hooks: {
    async onInstall({ doctorId, version }) {
      console.info(`[Copilot] installed v${version} for doctor ${doctorId}`);
    },
    async onEnable({ doctorId }) {
      console.info(`[Copilot] enabled for doctor ${doctorId}`);
    },
    async onDisable({ doctorId }) {
      console.info(`[Copilot] disabled for doctor ${doctorId}`);
    },
    async onUpdate({ fromVersion, toVersion }) {
      console.info(`[Copilot] updated ${fromVersion} → ${toVersion}`);
    },
  },

  // No in-process emrPanel component — the Copilot renders via ExternalPluginSlot
  // as an iframe loaded from NEXT_PUBLIC_COPILOT_ORIGIN.
};

if (!isPluginRegistered(PLUGIN_ID)) {
  registerPlugin(aiClinicalCopilot);
}

export { PLUGIN_ID, COPILOT_PERMISSIONS, manifest };
