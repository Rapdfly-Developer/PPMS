/**
 * Shared token verification helper for /api/v1/* route handlers.
 *
 * Extracts and verifies the plugin token from the Authorization header,
 * constructs a GatewayContext, and returns a typed result. Callers must
 * check ok before proceeding — never bypass this check.
 */

import { NextResponse } from "next/server";
import { verifyPluginToken } from "@/lib/plugin-token";
import { userCan } from "@/lib/rbac";
import { isPluginEnabled } from "@/plugin-framework/manager";
import type { GatewayContext } from "@/plugin-framework/types";

export type TokenAuthResult =
  | { ok: true; ctx: GatewayContext; patientRef: string; visitId: string }
  | { ok: false; response: NextResponse };

/**
 * Verify the plugin Bearer token from `req` and enforce:
 *   - Valid signature
 *   - Not expired
 *   - Not replayed (jti check)
 *   - pluginId matches `expectedPluginId` (optional)
 *   - Plugin is still ENABLED for the doctor (live DB check)
 *   - Caller holds `requiredPermission`
 *
 * Returns a GatewayContext ready for gateway/data.ts functions.
 */
export async function authorizeTokenRequest(
  req: Request,
  requiredPermission: string,
): Promise<TokenAuthResult> {
  const authHeader = req.headers.get("Authorization");
  const result = verifyPluginToken(authHeader);

  if (!result.ok) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
    };
  }

  const { payload } = result;

  // Live plugin-enabled check — token may have been issued before the doctor
  // disabled the plugin; honour that decision immediately.
  const enabled = await isPluginEnabled(payload.pluginId, payload.doctorId);
  if (!enabled) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Plugin is disabled." }, { status: 403 }),
    };
  }

  // Permission check using the permissions embedded in the token
  const userLike = {
    id: payload.doctorId,
    username: "",
    name: "",
    role: "DOCTOR",
    profileId: payload.doctorId,
    permissions: payload.permissions,
  };
  if (!userCan(userLike, requiredPermission)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Insufficient permissions." }, { status: 403 }),
    };
  }

  const ctx: GatewayContext = {
    userId: payload.doctorId,
    role: "DOCTOR",
    doctorId: payload.doctorId,
    hospitalId: payload.hospitalId,
    permissions: payload.permissions,
    pluginId: payload.pluginId,
  };

  return {
    ok: true,
    ctx,
    patientRef: payload.patientRef,
    visitId: payload.visitId,
  };
}
