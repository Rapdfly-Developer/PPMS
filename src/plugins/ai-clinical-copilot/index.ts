/**
 * AI Clinical Copilot — plugin entry point.
 *
 * Importing this module registers the plugin with the framework registry.
 * Registration is idempotent: registerPlugin() rejects duplicates, and Next.js
 * may evaluate this module once per server bundle, so the guard is required.
 */

import { registerPlugin, isPluginRegistered, type Plugin } from "@/plugin-framework";

import { manifest, PLUGIN_ID, COPILOT_PERMISSIONS } from "./manifest";
import { CopilotPanel } from "./ui/CopilotPanel";

export const aiClinicalCopilot: Plugin = {
  manifest,

  hooks: {
    async onInstall({ doctorId, version }) {
      console.info(
        `[Copilot] installed v${version} for doctor ${doctorId}`,
      );
    },
    async onEnable({ doctorId }) {
      // Surface a missing key at enable time rather than on the doctor's first
      // request. Never throws — the framework treats hooks as best-effort.
      if (!process.env.ANTHROPIC_API_KEY) {
        console.warn(
          `[Copilot] enabled for doctor ${doctorId} but ANTHROPIC_API_KEY is not set — requests will fail until it is configured.`,
        );
      }
    },
    async onDisable({ doctorId }) {
      console.info(`[Copilot] disabled for doctor ${doctorId}`);
    },
    async onUpdate({ fromVersion, toVersion }) {
      console.info(`[Copilot] updated ${fromVersion} → ${toVersion}`);
    },
  },

  components: {
    emrPanel: CopilotPanel,
  },
};

if (!isPluginRegistered(PLUGIN_ID)) {
  registerPlugin(aiClinicalCopilot);
}

export { PLUGIN_ID, COPILOT_PERMISSIONS, manifest };
