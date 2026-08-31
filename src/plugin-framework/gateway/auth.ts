/**
 * Plugin Gateway — Authentication & Authorization
 *
 * The controlled entry point for all plugin requests.
 * Validates:
 *   1. The user is authenticated (valid PPMS session).
 *   2. The plugin is ENABLED for the session's doctor.
 *   3. The user holds the required permission.
 *   4. The session's tenant (doctor + hospital) is valid.
 *   5. The plugin license is not blocked.
 *
 * Never bypasses PPMS Core security. All checks reuse existing PPMS modules.
 */

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { userCan } from "@/lib/rbac";
import { isPluginEnabled } from "../manager";
import { checkPluginLicense } from "../license";
import type { GatewayContext } from "../types";
import type { AuthResult, TenantScope } from "./types";
// Error classes available for callers to import and use
export { PluginGatewayError, PluginDisabledError, PluginPermissionError } from "../types";

// ── Gateway authorization ─────────────────────────────────────────────────

/**
 * Authorize a gateway request from a Route Handler.
 *
 * Usage:
 *   const result = await authorizeGatewayRequest(pluginId, "ai.copilot.use");
 *   if (!result.authorized) return NextResponse.json({ error: result.message }, { status: 403 });
 *   const { context } = result;
 */
export async function authorizeGatewayRequest(
  pluginId: string,
  requiredPermission: string,
): Promise<AuthResult> {
  // 1. Session check
  const session = await auth();
  if (!session?.user) {
    return { authorized: false, code: "UNAUTHENTICATED", message: "Authentication required." };
  }

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
  const hospitalId = user.hospitalId ?? null;

  if (!doctorId) {
    return {
      authorized: false,
      code: "NO_DOCTOR_SCOPE",
      message: "No doctor scope available for this session.",
    };
  }

  // 2. Permission check (reuses PPMS userCan)
  const permissions = user.permissions ?? [];
  if (!userCan({ ...user, id: user.id, username: "", name: user.name ?? "", permissions }, requiredPermission)) {
    return {
      authorized: false,
      code: "PERMISSION_DENIED",
      message: `Missing permission: ${requiredPermission}`,
    };
  }

  // 3. Plugin enabled check
  const enabled = await isPluginEnabled(pluginId, doctorId);
  if (!enabled) {
    return {
      authorized: false,
      code: "PLUGIN_DISABLED",
      message: `Plugin is not enabled: ${pluginId}`,
    };
  }

  // 4. License check
  if (hospitalId) {
    const licenseInfo = await checkPluginLicense(pluginId, doctorId);
    if (licenseInfo.isBlocked) {
      return {
        authorized: false,
        code: "LICENSE_BLOCKED",
        message: `Plugin license is ${licenseInfo.status}. Please renew.`,
      };
    }
  }

  // 5. Tenant validation — hospitalId must be linked to this doctor
  if (hospitalId) {
    const linked = await prisma.doctorHospitalLink.findFirst({
      where: { doctorId, hospitalId, active: true },
      select: { id: true },
    });
    if (!linked) {
      return {
        authorized: false,
        code: "TENANT_MISMATCH",
        message: "Hospital is not linked to this doctor.",
      };
    }
  }

  const context: GatewayContext = {
    userId: user.id,
    role: user.role,
    doctorId,
    hospitalId: hospitalId ?? "",
    permissions,
    pluginId,
  };

  return { authorized: true, context };
}

// ── Tenant scope resolution ───────────────────────────────────────────────

/**
 * Resolve the full tenant scope for a doctor (all linked hospital IDs).
 * Used by plugins that need cross-hospital aggregation.
 */
export async function resolveTenantScope(doctorId: string): Promise<TenantScope> {
  const links = await prisma.doctorHospitalLink.findMany({
    where: { doctorId, active: true },
    select: { hospitalId: true },
  });
  const linkedHospitalIds = links.map((l) => l.hospitalId);

  return {
    doctorId,
    hospitalId: linkedHospitalIds[0] ?? "",
    linkedHospitalIds,
  };
}

// ── Server Action authorization (for use in "use server" actions) ─────────

/**
 * Authorize a plugin-scoped Server Action.
 * Accepts a pre-resolved SessionUser from requireUser().
 */
export function authorizePluginAction(opts: {
  user: { id: string; role: string; profileId: string; doctorId?: string; hospitalId?: string; permissions?: string[]; name: string; username: string };
  pluginId: string;
  requiredPermission: string;
}): { authorized: true; doctorId: string; hospitalId: string } | { authorized: false; error: string } {
  const { user, requiredPermission } = opts;

  const doctorId =
    user.role === "DOCTOR" ? user.profileId : (user.doctorId ?? null);
  const hospitalId = user.hospitalId ?? "";

  if (!doctorId) {
    return { authorized: false, error: "No doctor scope for this user." };
  }

  if (!userCan(user as Parameters<typeof userCan>[0], requiredPermission)) {
    return { authorized: false, error: `Missing permission: ${requiredPermission}` };
  }

  // pluginId is available to callers via the context they pass in opts
  return { authorized: true, doctorId, hospitalId };
}
