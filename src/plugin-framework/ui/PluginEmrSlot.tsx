/**
 * Generic EMR Plugin Extension Point
 *
 * A Server Component that renders the EMR panel of every plugin which is:
 *   1. Statically registered in this build,
 *   2. Declaring ui.emrPanel.enabled and supplying components.emrPanel,
 *   3. ENABLED for the current doctor,
 *   4. Holding a non-blocked plugin license,
 *   5. Permitted to the current user via its declared triggerPermission.
 *
 * PPMS Core renders <PluginEmrSlot /> once and knows nothing about which
 * plugins exist. When no plugin qualifies, this renders nothing and the EMR
 * behaves exactly as it did before the framework existed.
 *
 * Failures here are contained: a broken plugin panel must never take down the
 * EMR page, so every per-plugin check is wrapped and skipped on error.
 */

import { requireUser, userCan } from "@/lib/rbac";
import { getAllRegisteredPlugins } from "../registry";
import { isPluginEnabled } from "../manager";
import { checkPluginLicense } from "../license";
import type { PluginEmrPanelProps } from "../types";

export async function PluginEmrSlot(props: PluginEmrPanelProps) {
  let panels: React.ReactNode[] = [];

  try {
    const user = await requireUser();
    const doctorId =
      user.role === "DOCTOR" ? user.profileId : (user.doctorId ?? null);
    if (!doctorId) return null;

    const candidates = getAllRegisteredPlugins().filter(
      (p) => p.manifest.ui.emrPanel?.enabled && p.components?.emrPanel,
    );
    if (candidates.length === 0) return null;

    const resolved = await Promise.all(
      candidates.map(async (plugin) => {
        try {
          const { pluginId } = plugin.manifest;
          const trigger = plugin.manifest.ui.emrPanel!.triggerPermission;

          if (!userCan(user, trigger)) return null;
          if (!(await isPluginEnabled(pluginId, doctorId))) return null;

          const license = await checkPluginLicense(pluginId, doctorId);
          if (license.isBlocked) return null;

          const Panel = plugin.components!.emrPanel!;
          return <Panel key={pluginId} {...props} />;
        } catch {
          // A misbehaving plugin is skipped, never surfaced to the doctor.
          return null;
        }
      }),
    );

    panels = resolved.filter(Boolean);
  } catch {
    return null;
  }

  if (panels.length === 0) return null;

  return <>{panels}</>;
}
