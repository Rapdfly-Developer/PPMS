/**
 * PPMS Plugin Lifecycle
 *
 * Runs plugin lifecycle hooks safely. A hook failure logs a warning but
 * never blocks the install/enable/disable operation — following the same
 * "best-effort, never block" pattern as writeAudit.
 *
 * Lifecycle order:
 *   INSTALL → REGISTER → VALIDATE → CONFIGURE → ENABLE → RUN → DISABLE → UPDATE → REMOVE
 */

import type {
  Plugin,
  PluginLifecycleHooks,
  InstallPayload,
  EnablePayload,
  DisablePayload,
  RemovePayload,
  UpdatePayload,
} from "./types";

type HookName = keyof PluginLifecycleHooks;

type HookPayloadMap = {
  onInstall: InstallPayload;
  onEnable:  EnablePayload;
  onDisable: DisablePayload;
  onRemove:  RemovePayload;
  onUpdate:  UpdatePayload;
};

/**
 * Run a single lifecycle hook for a plugin.
 * Errors are caught and logged to console — they never propagate to the caller.
 */
export async function runLifecycleHook<K extends HookName>(
  plugin: Plugin,
  hookName: K,
  payload: HookPayloadMap[K],
): Promise<void> {
  const hook = plugin.hooks?.[hookName] as
    | ((p: HookPayloadMap[K]) => Promise<void>)
    | undefined;

  if (!hook) return;

  try {
    await hook(payload);
  } catch (err) {
    // Lifecycle hook failures are non-fatal — log but never throw
    console.warn(
      `[PluginFramework] ${hookName} hook for "${plugin.manifest.pluginId}" failed:`,
      err,
    );
  }
}

/**
 * Run lifecycle hooks for multiple plugins in sequence.
 * If one hook fails the rest still execute.
 */
export async function runLifecycleHookForAll<K extends HookName>(
  plugins: Plugin[],
  hookName: K,
  payload: HookPayloadMap[K],
): Promise<void> {
  for (const plugin of plugins) {
    await runLifecycleHook(plugin, hookName, payload);
  }
}
