/**
 * Shared token verification helper for /api/v1/* route handlers.
 *
 * Extracts and verifies the plugin token from the Authorization header,
 * enforces generic data-scope authorization, constructs a GatewayContext,
 * and returns a typed result. Callers must check ok before proceeding.
 *
 * Authorization layers (in order):
 *   1. Valid HMAC-SHA256 signature
 *   2. Token not expired
 *   3. jti not replayed
 *   4. pluginId is registered in this PPMS build
 *   5. Plugin is ENABLED for the doctor (live DB check)
 *   6. Token carries the required data scope for this endpoint
 *
 * The data scope check replaces the legacy "ai.copilot.view" permission
 * check. Scopes are derived from manifest.requiredApis at token-issuance
 * time and are HMAC-signed — they cannot be forged by the client.
 */

import { NextResponse } from "next/server";
import { verifyPluginToken } from "@/lib/plugin-token";
import { isPluginRegistered } from "@/plugin-framework/registry";
import { isPluginEnabled } from "@/plugin-framework/manager";
import type { GatewayContext } from "@/plugin-framework/types";

export type TokenAuthResult =
  | { ok: true; ctx: GatewayContext; patientRef: string; visitId: string }
  | { ok: false; response: NextResponse };

/**
 * Verify the plugin Bearer token from `req` and enforce the six-layer
 * authorization chain. Returns a GatewayContext ready for gateway/data.ts.
 *
 * @param requiredScope - The data scope this endpoint requires, e.g.
 *   "patient.demographics", "visit.history", "visit.context",
 *   "appointment.history", or "patient.timeline".
 */
export async function authorizeTokenRequest(
  req: Request,
  requiredScope: string,
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

  // Build-time registry check — reject tokens whose plugin was removed from
  // this PPMS build after the token was issued.
  if (!isPluginRegistered(payload.pluginId)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
    };
  }

  // Live plugin-enabled check — token may have been issued before the doctor
  // disabled the plugin; honour that decision immediately.
  const enabled = await isPluginEnabled(payload.pluginId, payload.doctorId);
  if (!enabled) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Plugin is disabled." }, { status: 403 }),
    };
  }

  // Data-scope check — the token must carry the specific scope required by
  // this endpoint. Scopes are set by the server at issuance (manifest.requiredApis)
  // and signed into the token; a client cannot add or change them without
  // invalidating the HMAC signature.
  const hasScope = payload.dataScopes.includes(requiredScope);
  if (!hasScope) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden." }, { status: 403 }),
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
