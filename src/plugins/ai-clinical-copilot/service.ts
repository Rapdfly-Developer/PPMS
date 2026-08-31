/**
 * Copilot request pipeline.
 *
 *   authorize (gateway) → tenant + patient scope check → capability permission
 *   → context build → prompt → provider → validation → audit + usage
 *
 * Both API routes call into this file, so the streaming and non-streaming
 * paths cannot diverge on security or auditing.
 */

import {
  authorizeGatewayRequest,
  assertPatientInScope,
  getPluginConfigAll,
  incrementPluginUsage,
  checkPluginLicense,
  writePluginAudit,
  type GatewayContext,
} from "@/plugin-framework/gateway";

import { manifest, PLUGIN_ID, COPILOT_PERMISSIONS, REQUIRED_CORE_PERMISSIONS } from "./manifest";
import { CAPABILITY_SCOPES, isCapability, type Capability } from "./capabilities";
import { buildPatientContext, type PatientContext } from "./context/builder";
import { buildSystemPrompt, buildUserMessage } from "./prompts";
import { validateResponse } from "./validation/response";
import {
  createProvider,
  AiProviderError,
  AI_ERROR_MESSAGES,
  DEFAULT_ANTHROPIC_MODEL,
  type AIProvider,
  type AiRequest,
  type ProviderId,
} from "./ai";

// ── Request / result shapes ───────────────────────────────────────────────

export type CopilotRequest = {
  capability: Capability;
  patientRef: string;
  visitId?: string;
  question?: string;
};

export type CopilotFailure = {
  ok: false;
  status: number;
  code: string;
  message: string;
};

export type PreparedRequest = {
  ok: true;
  ctx: GatewayContext;
  capability: Capability;
  provider: AIProvider;
  aiRequest: AiRequest;
  context: PatientContext;
  /** Whether streaming is enabled for this hospital. */
  streaming: boolean;
};

export type CopilotSuccess = {
  ok: true;
  text: string;
  warnings: string[];
  capability: Capability;
  producesDraft: boolean;
  meta: {
    provider: string;
    model: string;
    visitsIncluded: number;
    generatedAt: string;
  };
};

// ── Input parsing ─────────────────────────────────────────────────────────

const MAX_QUESTION_LENGTH = 1000;

export function parseCopilotRequest(
  body: unknown,
): CopilotRequest | CopilotFailure {
  if (typeof body !== "object" || body === null) {
    return badRequest("Request body must be a JSON object.");
  }

  const b = body as Record<string, unknown>;

  if (!isCapability(b.capability)) {
    return badRequest("Unknown or missing capability.");
  }
  if (typeof b.patientRef !== "string" || !b.patientRef.trim()) {
    return badRequest("A patient reference is required.");
  }
  if (b.visitId !== undefined && typeof b.visitId !== "string") {
    return badRequest("visitId must be a string.");
  }

  let question: string | undefined;
  if (b.question !== undefined) {
    if (typeof b.question !== "string") {
      return badRequest("question must be a string.");
    }
    question = b.question.trim();
    if (question.length > MAX_QUESTION_LENGTH) {
      return badRequest(
        `Question is too long (max ${MAX_QUESTION_LENGTH} characters).`,
      );
    }
  }

  if (b.capability === "QUESTION" && !question) {
    return badRequest("A question is required for this capability.");
  }

  return {
    capability: b.capability,
    patientRef: b.patientRef.trim(),
    visitId: typeof b.visitId === "string" ? b.visitId : undefined,
    question,
  };
}

function badRequest(message: string): CopilotFailure {
  return { ok: false, status: 400, code: "BAD_REQUEST", message };
}

/** Narrowing helper for callers of parseCopilotRequest(). */
export function isCopilotFailure(
  value: CopilotRequest | CopilotFailure,
): value is CopilotFailure {
  return "ok" in value && value.ok === false;
}

// ── Preparation (shared by both routes) ───────────────────────────────────

/**
 * Run every check and build everything needed for a provider call.
 * Returns a failure the route can serialise directly; never throws for an
 * expected condition.
 */
export async function prepareRequest(
  req: CopilotRequest,
): Promise<PreparedRequest | CopilotFailure> {
  const scope = CAPABILITY_SCOPES[req.capability];

  // 1-5. Session, permission, plugin enabled, license, tenant — all via gateway.
  //      The panel permission gates entry; the capability permission is checked
  //      immediately after, so a user with view-only access cannot call draft.
  const auth = await authorizeGatewayRequest(PLUGIN_ID, COPILOT_PERMISSIONS.VIEW);
  if (!auth.authorized) {
    const status =
      auth.code === "UNAUTHENTICATED" ? 401 :
      auth.code === "LICENSE_BLOCKED" ? 402 : 403;
    return { ok: false, status, code: auth.code, message: auth.message };
  }

  const ctx = auth.context;

  // 6. Capability-level permission.
  if (!hasPermission(ctx, scope.permission)) {
    return {
      ok: false,
      status: 403,
      code: "PERMISSION_DENIED",
      message: `You do not have permission to use ${scope.label}.`,
    };
  }

  // 7. Core PPMS permissions — the Copilot never widens a user's reach.
  for (const perm of REQUIRED_CORE_PERMISSIONS) {
    if (!hasPermission(ctx, perm)) {
      return {
        ok: false,
        status: 403,
        code: "PERMISSION_DENIED",
        message: "You do not have permission to read patient records.",
      };
    }
  }

  // 8. Patient must be inside this doctor + hospital tenant.
  try {
    await assertPatientInScope(ctx, req.patientRef);
  } catch {
    // Deliberately identical to a not-found response — a caller must not be
    // able to probe for the existence of another tenant's patients.
    return {
      ok: false,
      status: 404,
      code: "PATIENT_NOT_FOUND",
      message: "Patient not found in your records.",
    };
  }

  // 9. Usage metering before spending a provider call.
  const usage = await incrementPluginUsage(PLUGIN_ID, ctx.doctorId);
  if (!usage.allowed) {
    await writePluginAudit(ctx, {
      action: "COPILOT_QUOTA_EXCEEDED",
      entityId: req.patientRef,
      metadata: {
        capability: req.capability,
        usageCount: usage.usageCount,
        usageLimit: usage.usageLimit,
      },
    });
    return {
      ok: false,
      status: 429,
      code: "QUOTA_EXCEEDED",
      message: `Monthly Copilot limit reached (${usage.usageLimit} requests). It resets at the start of next month.`,
    };
  }

  // 10. Per-hospital configuration.
  const config = await resolveConfig(ctx);

  const provider = createProvider({
    provider: config.provider,
    model: config.model,
    maxTokens: scope.maxTokens,
  });

  if (!provider.isConfigured()) {
    return {
      ok: false,
      status: 503,
      code: "NOT_CONFIGURED",
      message: AI_ERROR_MESSAGES.NOT_CONFIGURED,
    };
  }

  // 11. Context — only the slices this capability declares.
  const context = await buildPatientContext({
    ctx,
    capability: req.capability,
    patientRef: req.patientRef,
    visitId: req.visitId,
  });

  if (!context) {
    return {
      ok: false,
      status: 404,
      code: "PATIENT_NOT_FOUND",
      message: "Patient not found in your records.",
    };
  }

  const aiRequest: AiRequest = {
    system: buildSystemPrompt(req.capability),
    messages: [
      { role: "user", content: buildUserMessage(context.text, req.question) },
    ],
    maxTokens: scope.maxTokens,
    temperature: 0,
  };

  return {
    ok: true,
    ctx,
    capability: req.capability,
    provider,
    aiRequest,
    context,
    streaming: config.streaming,
  };
}

// ── Non-streaming execution ───────────────────────────────────────────────

export async function runCopilot(
  prepared: PreparedRequest,
): Promise<CopilotSuccess | CopilotFailure> {
  const { ctx, capability, provider, aiRequest, context } = prepared;
  const scope = CAPABILITY_SCOPES[capability];
  const startedAt = Date.now();

  try {
    const result = await provider.complete(aiRequest);

    const validation = validateResponse({
      text: result.text,
      capability,
      stopReason: result.stopReason,
    });

    if (!validation.ok) {
      await auditFailure(ctx, capability, context, validation.code, {
        provider: result.provider,
        model: result.model,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
      });
      return {
        ok: false,
        status: 422,
        code: validation.code,
        message: validation.message,
      };
    }

    await writePluginAudit(ctx, {
      action: "COPILOT_REQUEST",
      entityType: "PATIENT",
      entityId: context.patientId,
      metadata: {
        capability,
        visitId: context.visitId,
        provider: result.provider,
        model: result.model,
        success: true,
        streamed: false,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        durationMs: Date.now() - startedAt,
        visitsIncluded: context.stats.visitsIncluded,
        warnings: validation.warnings.length,
      },
    });

    return {
      ok: true,
      text: validation.text,
      warnings: validation.warnings,
      capability,
      producesDraft: scope.producesDraft,
      meta: {
        provider: result.provider,
        model: result.model,
        visitsIncluded: context.stats.visitsIncluded,
        generatedAt: new Date().toISOString(),
      },
    };
  } catch (err) {
    const e =
      err instanceof AiProviderError
        ? err
        : new AiProviderError("UNKNOWN", "Unhandled failure.");

    await auditFailure(ctx, capability, context, e.code, {
      provider: provider.id,
      model: provider.model,
      durationMs: Date.now() - startedAt,
    });

    return {
      ok: false,
      status: e.code === "RATE_LIMITED" ? 429 : e.code === "TIMEOUT" ? 504 : 502,
      code: e.code,
      // Fixed message — vendor text never reaches the client.
      message: AI_ERROR_MESSAGES[e.code],
    };
  }
}

// ── Shared helpers ────────────────────────────────────────────────────────

export async function auditFailure(
  ctx: GatewayContext,
  capability: Capability,
  context: PatientContext,
  code: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  await writePluginAudit(ctx, {
    action: "COPILOT_REQUEST_FAILED",
    entityType: "PATIENT",
    entityId: context.patientId,
    metadata: {
      capability,
      visitId: context.visitId,
      success: false,
      failureCode: code,
      ...extra,
    },
  });
}

export async function auditStreamSuccess(
  ctx: GatewayContext,
  capability: Capability,
  context: PatientContext,
  meta: Record<string, unknown>,
): Promise<void> {
  await writePluginAudit(ctx, {
    action: "COPILOT_REQUEST",
    entityType: "PATIENT",
    entityId: context.patientId,
    metadata: {
      capability,
      visitId: context.visitId,
      success: true,
      streamed: true,
      visitsIncluded: context.stats.visitsIncluded,
      ...meta,
    },
  });
}

function hasPermission(ctx: GatewayContext, permission: string): boolean {
  return ctx.permissions.includes("*") || ctx.permissions.includes(permission);
}

/** Resolve per-hospital config, falling back to manifest defaults. */
async function resolveConfig(ctx: GatewayContext): Promise<{
  provider: ProviderId;
  model: string;
  streaming: boolean;
  maxHistoryVisits: number;
}> {
  let raw: Record<string, unknown> = {};
  try {
    if (ctx.hospitalId) {
      raw = await getPluginConfigAll(PLUGIN_ID, ctx.hospitalId, manifest.configuration);
    }
  } catch {
    // Config read failure falls through to manifest defaults.
  }

  return {
    provider: (typeof raw.provider === "string" ? raw.provider : "anthropic") as ProviderId,
    model:
      typeof raw.model === "string" && raw.model.trim()
        ? raw.model
        : DEFAULT_ANTHROPIC_MODEL,
    streaming: raw.streaming !== false,
    maxHistoryVisits:
      typeof raw.maxHistoryVisits === "number" ? raw.maxHistoryVisits : 8,
  };
}

/** Exposed for the settings UI and the panel's context indicator. */
export async function getCopilotStatus(ctx: GatewayContext) {
  const license = await checkPluginLicense(PLUGIN_ID, ctx.doctorId);
  return {
    usageCount: license.usageCount,
    usageLimit: license.usageLimit,
    licenseStatus: license.status,
  };
}
