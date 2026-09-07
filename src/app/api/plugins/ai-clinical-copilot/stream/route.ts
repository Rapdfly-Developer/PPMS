/**
 * POST /api/plugins/ai-clinical-copilot/stream
 *
 * Streaming Copilot request, delivered as newline-delimited JSON events:
 *
 *   {"type":"text","text":"..."}      incremental output
 *   {"type":"warning","warnings":[]}  post-validation cautions
 *   {"type":"done","meta":{...}}      stream completed and validated
 *   {"type":"error","code","message"} failed — client discards rendered text
 *
 * Validation runs on the accumulated text after the stream closes. If it
 * fails, an error event instructs the client to discard what it rendered, so
 * unvalidated content is never left standing in the UI.
 */

import "@/plugins";
import {
  parseCopilotRequest,
  isCopilotFailure,
  prepareRequest,
  auditFailure,
  auditStreamSuccess,
} from "@/plugins/ai-clinical-copilot/service";
import { CAPABILITY_SCOPES } from "@/plugins/ai-clinical-copilot/capabilities";
import { validateStreamedResponse } from "@/plugins/ai-clinical-copilot/validation/response";
import { AI_ERROR_MESSAGES } from "@/plugins/ai-clinical-copilot/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, code: string, status: number) {
  return new Response(JSON.stringify({ error: message, code }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", "BAD_REQUEST", 400);
  }

  const parsed = parseCopilotRequest(body);
  if (isCopilotFailure(parsed)) {
    return jsonError(parsed.message, parsed.code, parsed.status);
  }

  const prepared = await prepareRequest(parsed);
  if (!prepared.ok) {
    return jsonError(prepared.message, prepared.code, prepared.status);
  }

  const { ctx, capability, provider, aiRequest, context } = prepared;
  const scope = CAPABILITY_SCOPES[capability];
  const startedAt = Date.now();

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(JSON.stringify(payload) + "\n"));
      };

      let accumulated = "";
      let stopReason: string | null = null;
      let model = provider.model;
      let providerId = provider.id;
      let inputTokens = 0;
      let outputTokens = 0;
      let failed = false;

      try {
        for await (const event of provider.stream(aiRequest)) {
          if (event.type === "text") {
            accumulated += event.text;
            send({ type: "text", text: event.text });
          } else if (event.type === "done") {
            stopReason = event.stopReason;
            model = event.model;
            providerId = event.provider;
            inputTokens = event.usage.inputTokens;
            outputTokens = event.usage.outputTokens;
          } else if (event.type === "error") {
            failed = true;
            send({
              type: "error",
              code: event.code,
              message: AI_ERROR_MESSAGES[event.code],
              discard: true,
            });
            await auditFailure(ctx, capability, context, event.code, {
              provider: providerId,
              model,
              streamed: true,
              durationMs: Date.now() - startedAt,
            });
            break;
          }
        }

        if (!failed) {
          const validation = validateStreamedResponse({
            text: accumulated,
            capability,
            stopReason,
          });

          if (!validation.ok) {
            send({
              type: "error",
              code: validation.code,
              message: validation.message,
              discard: true,
            });
            await auditFailure(ctx, capability, context, validation.code, {
              provider: providerId,
              model,
              streamed: true,
              inputTokens,
              outputTokens,
              durationMs: Date.now() - startedAt,
            });
          } else {
            if (validation.warnings.length) {
              send({ type: "warning", warnings: validation.warnings });
            }
            send({
              type: "done",
              meta: {
                provider: providerId,
                model,
                visitsIncluded: context.stats.visitsIncluded,
                generatedAt: new Date().toISOString(),
                producesDraft: scope.producesDraft,
              },
            });
            await auditStreamSuccess(ctx, capability, context, {
              provider: providerId,
              model,
              inputTokens,
              outputTokens,
              durationMs: Date.now() - startedAt,
              warnings: validation.warnings.length,
            });
          }
        }
      } catch {
        send({
          type: "error",
          code: "UNKNOWN",
          message: AI_ERROR_MESSAGES.UNKNOWN,
          discard: true,
        });
        await auditFailure(ctx, capability, context, "UNKNOWN", {
          streamed: true,
          durationMs: Date.now() - startedAt,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
