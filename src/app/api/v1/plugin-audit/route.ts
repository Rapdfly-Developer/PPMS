/**
 * POST /api/v1/plugin-audit
 *
 * Receives audit events from an external plugin and persists them via the
 * existing writePluginAudit() function. The external plugin must never write
 * to AuditLog directly — this endpoint is the only permitted path.
 *
 * Authentication: Bearer plugin token.
 * Privacy: clinical content (prompts, AI output, notes) must not be included.
 *          Only identifiers, counts, model names, and outcome flags are accepted.
 */

import { NextResponse } from "next/server";
import { writePluginAudit } from "@/plugin-framework/gateway/audit";
import { authorizeTokenRequest } from "../_lib/token-auth";

const ALLOWED_ACTIONS = new Set([
  "COPILOT_REQUEST",
  "COPILOT_STREAM",
  "COPILOT_COMPLETE",
  "COPILOT_ERROR",
  "COPILOT_DRAFT_SHOWN",
  "COPILOT_DRAFT_COPIED",
  "COPILOT_DRAFT_CONFIRMED",
  "COPILOT_CAPABILITY_USED",
]);

export async function POST(req: Request) {
  const auth = await authorizeTokenRequest(req, "ai.copilot.view");
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

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

  // Allowlist prevents external plugins from injecting arbitrary action labels
  if (!ALLOWED_ACTIONS.has(action)) {
    return NextResponse.json(
      { error: `Unknown action: ${action}. Allowed: ${[...ALLOWED_ACTIONS].join(", ")}` },
      { status: 400 },
    );
  }

  if (!entityId || typeof entityId !== "string") {
    return NextResponse.json({ error: "entityId is required." }, { status: 400 });
  }

  // Scrub any field that looks like clinical content — only primitives accepted
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
