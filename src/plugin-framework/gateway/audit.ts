/**
 * Plugin Gateway — Audit
 *
 * Plugins record activity through this module rather than calling writeAudit()
 * directly. That guarantees every plugin audit row carries the plugin id,
 * tenant scope and actor, and that plugins cannot forge rows for another
 * plugin or another user.
 *
 * Privacy: metadata only. Callers must not pass prompts, AI output, free-text
 * clinical notes or any other patient content — the metadata argument is
 * intended for identifiers, counts, model names and outcome flags. PPMS audit
 * rows are retained indefinitely, so clinical content does not belong here.
 */

import { writeAudit } from "@/lib/audit";
import type { GatewayContext } from "../types";

export type PluginAuditEntry = {
  /** Verb describing what happened, e.g. "COPILOT_REQUEST". */
  action: string;
  /** Subject the action applied to — a patient id, visit id or config key. */
  entityId: string;
  /** Optional PPMS entity type; defaults to "PLUGIN". */
  entityType?: string;
  /** Non-clinical metadata only. See the privacy note above. */
  metadata?: Record<string, unknown>;
};

/**
 * Write a plugin audit row. Fire-and-forget, mirrors writeAudit(): it never
 * throws and never blocks the calling workflow.
 */
export async function writePluginAudit(
  ctx: GatewayContext,
  entry: PluginAuditEntry,
): Promise<void> {
  try {
    await writeAudit(
      ctx.userId,
      entry.entityType ?? "PLUGIN",
      entry.entityId,
      entry.action,
      {
        pluginId: ctx.pluginId,
        ...(entry.metadata ?? {}),
      },
      {
        hospitalId: ctx.hospitalId || undefined,
        moduleName: "PLUGIN",
        actionType: entry.action,
      },
    );
  } catch {
    // Audit failures must never break a plugin request.
  }
}
