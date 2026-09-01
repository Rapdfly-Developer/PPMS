/**
 * ExternalPluginSlot — Server Component
 *
 * Generic iframe integration point for externally-deployed plugins.
 * Parameterised by pluginId so it works for any future external plugin,
 * not just the AI Copilot.
 *
 * Responsibilities:
 *   1. Check that the external plugin is enabled for this doctor.
 *   2. Check that the user holds the required trigger permission.
 *   3. Issue a short-lived signed plugin token (server-side, never in URL).
 *   4. Pass token + origin to the client component for postMessage delivery.
 *
 * Renders nothing if the plugin is disabled, permission is absent, or
 * NEXT_PUBLIC_COPILOT_ORIGIN is not configured.
 */

import { auth } from "@/auth";
import { userCan } from "@/lib/rbac";
import { isPluginEnabled } from "@/plugin-framework/manager";
import { checkPluginLicense } from "@/plugin-framework/license";
import { signPluginToken } from "@/lib/plugin-token";
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
  const copilotOrigin = process.env.NEXT_PUBLIC_COPILOT_ORIGIN;
  if (!copilotOrigin) return null;

  // Only render when PLUGIN_TOKEN_SECRET is configured
  if (!process.env.PLUGIN_TOKEN_SECRET || process.env.PLUGIN_TOKEN_SECRET.length < 32) {
    return null;
  }

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
    // PLUGIN_TOKEN_SECRET not configured — slot is unavailable
    return null;
  }

  return (
    <ExternalPluginSlotClient
      copilotOrigin={copilotOrigin}
      token={token}
      patientRef={patientUdid}
      visitId={visitId}
      pluginId={pluginId}
    />
  );
}
