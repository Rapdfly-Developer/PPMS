/**
 * ExternalPluginSlot — Server Component
 *
 * Generic iframe integration point for any externally-deployed plugin registered
 * in this PPMS build. Parameterised by pluginId — works for AI Clinical Copilot,
 * Voice-to-EMR, and any future external plugin without modification.
 *
 * Renders nothing when:
 *   - the pluginId is not registered in this PPMS build
 *   - the plugin has no externalOrigin configured (in-process plugin)
 *   - the plugin is disabled for this doctor
 *   - the user does not hold the plugin's trigger permission
 *   - the license is blocked
 *   - PLUGIN_TOKEN_SECRET is not configured
 */

import { auth } from "@/auth";
import { userCan } from "@/lib/rbac";
import { isPluginEnabled } from "@/plugin-framework/manager";
import { checkPluginLicense } from "@/plugin-framework/license";
import { signPluginToken } from "@/lib/plugin-token";
import { isPluginRegistered, getPlugin } from "@/plugin-framework/registry";
import { ExternalPluginSlotClient } from "./ExternalPluginSlotClient";

type Props = {
  pluginId: string;
  triggerPermission: string;
  patientUdid: string;
  visitId: string;
};

export async function ExternalPluginSlot({
  pluginId,
  triggerPermission,
  patientUdid,
  visitId,
}: Props) {
  // Only render when PLUGIN_TOKEN_SECRET is configured
  if (!process.env.PLUGIN_TOKEN_SECRET || process.env.PLUGIN_TOKEN_SECRET.length < 32) {
    return null;
  }

  // Plugin must be registered and must declare an external deployment origin
  if (!isPluginRegistered(pluginId)) return null;
  const pluginRecord = getPlugin(pluginId);
  const pluginOrigin = pluginRecord.manifest.externalOrigin ?? null;
  if (!pluginOrigin) return null;
  const pluginName = pluginRecord.manifest.name;

  const session = await auth();
  if (!session?.user) return null;

  const user = session.user as {
    id: string;
    name?: string;
    role: string;
    profileId: string;
    doctorId?: string;
    hospitalId?: string;
    permissions?: string[];
  };

  const doctorId =
    user.role === "DOCTOR" ? user.profileId : (user.doctorId ?? null);
  const hospitalId = user.hospitalId ?? "";

  if (!doctorId) return null;

  // Permission check
  const userLike = {
    id: user.id,
    username: "",
    name: user.name ?? "",
    role: user.role,
    profileId: user.profileId,
    doctorId: user.doctorId,
    hospitalId: user.hospitalId,
    permissions: user.permissions ?? [],
  };
  if (!userCan(userLike, triggerPermission)) return null;

  // Plugin enabled check
  const enabled = await isPluginEnabled(pluginId, doctorId);
  if (!enabled) return null;

  // License check
  const license = await checkPluginLicense(pluginId, doctorId);
  if (license.isBlocked) return null;

  // Issue token server-side — never placed in the iframe URL
  let token: string;
  try {
    token = signPluginToken({
      doctorId,
      hospitalId,
      patientRef: patientUdid,
      visitId,
      pluginId,
      permissions: user.permissions ?? [],
    });
  } catch {
    return null;
  }

  return (
    <ExternalPluginSlotClient
      pluginOrigin={pluginOrigin}
      pluginName={pluginName}
      token={token}
      patientRef={patientUdid}
      visitId={visitId}
      pluginId={pluginId}
    />
  );
}
