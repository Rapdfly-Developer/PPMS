/**
 * POST /api/v1/plugin-audit
 *
 * Receives audit events from any registered external plugin and persists them
 * via writePluginAudit(). External plugins must never write to AuditLog
 * directly — this endpoint is the only permitted path.
 *
 * Authentication: Bearer plugin token (any registered, enabled plugin).
 * Privacy: clinical content (transcripts, AI output, notes) must not be
 *          included. Only identifiers, counts, labels, and outcome flags
 *          are accepted. Object-valued metadata fields are stripped.
 *
 * Action format: any string matching ^[A-Z][A-Z0-9_]{0,63}$
 *   Copilot examples: COPILOT_REQUEST, COPILOT_DRAFT_CONFIRMED
 *   Voice-to-EMR examples: VOICE_TRANSCRIBE_START, VOICE_DRAFT_CREATED
 */

import { NextResponse } from "next/server";
import { verifyPluginToken } from "@/lib/plugin-token";
import { isPluginEnabled } from "@/plugin-framework/manager";
import { writePluginAudit } from "@/plugin-framework/gateway/audit";
import type { GatewayContext } from "@/plugin-framework/types";

// Capitalized alphanumeric + underscore, max 64 chars.
// Intentionally broad: each plugin uses its own namespace prefix by convention
// (COPILOT_*, VOICE_*, etc.) but PPMS does not enforce the prefix.
const ACTION_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;

export async function POST(req: Request) {
  // 1. Verify token — signature, expiry, jti replay
  const verified = verifyPluginToken(req.headers.get("authorization"));
  if (!verified.ok) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { payload } = verified;

  // 2. Live plugin-enabled check — token may predate a disable event
  const enabled = await isPluginEnabled(payload.pluginId, payload.doctorId);
  if (!enabled) {
    return NextResponse.json({ error: "Plugin is disabled." }, { status: 403 });
  }

  const ctx: GatewayContext = {
    userId: payload.doctorId,
    role: "DOCTOR",
    doctorId: payload.doctorId,
    hospitalId: payload.hospitalId,
    permissions: payload.permissions,
    pluginId: payload.pluginId,
  };

  // 3. Parse body
  let body: { action?: string; entityId?: string; entityType?: string; metadata?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { action, entityId, entityType, metadata } = body;

  if (!action || typeof action !== "string") {
    return NextResponse.json({ error: "action is required." }, { status: 400 });
  }

  // 4. Action format validation
  if (!ACTION_PATTERN.test(action)) {
    return NextResponse.json(
      { error: "action must match ^[A-Z][A-Z0-9_]{0,63}$ (e.g. PLUGIN_DRAFT_CONFIRMED)." },
      { status: 400 },
    );
  }

  if (!entityId || typeof entityId !== "string") {
    return NextResponse.json({ error: "entityId is required." }, { status: 400 });
  }

  // 5. Scrub any field that looks like clinical content — only primitives accepted
  const cleanMetadata: Record<string, unknown> = {};
  if (metadata && typeof metadata === "object") {
    for (const [k, v] of Object.entries(metadata)) {
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
        cleanMetadata[k] = v;
      }
    }
  }

  await writePluginAudit(ctx, {
    action,
    entityId,
    entityType: typeof entityType === "string" ? entityType : "PLUGIN",
    metadata: cleanMetadata,
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
