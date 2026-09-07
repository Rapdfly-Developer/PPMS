/**
 * AnthropicProvider — AIProvider implementation backed by the Anthropic SDK.
 *
 * The only file in the Copilot that imports a vendor SDK. Everything above it
 * depends on the AIProvider interface, so a second provider can be added
 * without touching the context builder, prompts, validation, API or UI.
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  AiProviderError,
  type AIProvider,
  type AiRequest,
  type AiResult,
  type AiStreamEvent,
} from "./provider";

/** Default model. Overridable per hospital via plugin configuration. */
export const DEFAULT_ANTHROPIC_MODEL = "claude-opus-4-8";

/** Hard ceiling on how long a single Copilot request may run. */
const REQUEST_TIMEOUT_MS = 60_000;

export class AnthropicProvider implements AIProvider {
  readonly id = "anthropic";
  readonly model: string;

  private readonly apiKey: string | undefined;

  constructor(opts: { model?: string; apiKey?: string } = {}) {
    this.model = opts.model?.trim() || DEFAULT_ANTHROPIC_MODEL;
    this.apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
  }

  isConfigured(): boolean {
    return typeof this.apiKey === "string" && this.apiKey.length > 0;
  }

  private client(): Anthropic {
    if (!this.isConfigured()) {
      throw new AiProviderError(
        "NOT_CONFIGURED",
        "ANTHROPIC_API_KEY is not set.",
        this.id,
      );
    }
    return new Anthropic({
      apiKey: this.apiKey,
      timeout: REQUEST_TIMEOUT_MS,
      maxRetries: 1,
    });
  }

  async complete(req: AiRequest): Promise<AiResult> {
    const client = this.client();

    try {
      const response = await client.messages.create({
        model: this.model,
        max_tokens: req.maxTokens,
        temperature: req.temperature ?? 0,
        system: req.system,
        messages: req.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      const text = response.content
        .filter((b): b is { type: "text"; text: string; citations: never } => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();

      if (!text) {
        throw new AiProviderError(
          "EMPTY_RESPONSE",
          "Provider returned no text content.",
          this.id,
        );
      }

      return {
        text,
        model: this.model,
        provider: this.id,
        usage: {
          inputTokens: response.usage?.input_tokens ?? 0,
          outputTokens: response.usage?.output_tokens ?? 0,
        },
        stopReason: response.stop_reason ?? null,
      };
    } catch (err) {
      throw normalizeError(err, this.id);
    }
  }

  async *stream(req: AiRequest): AsyncIterable<AiStreamEvent> {
    let client: Anthropic;
    try {
      client = this.client();
    } catch (err) {
      const e = normalizeError(err, this.id);
      yield { type: "error", code: e.code, message: e.message };
      return;
    }

    let inputTokens = 0;
    let outputTokens = 0;
    let stopReason: string | null = null;
    let emittedAny = false;

    try {
      const stream = client.messages.stream({
        model: this.model,
        max_tokens: req.maxTokens,
        temperature: req.temperature ?? 0,
        system: req.system,
        messages: req.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta" &&
          event.delta.text
        ) {
          emittedAny = true;
          yield { type: "text", text: event.delta.text };
        } else if (event.type === "message_start") {
          inputTokens = event.message.usage?.input_tokens ?? 0;
        } else if (event.type === "message_delta") {
          outputTokens = event.usage?.output_tokens ?? outputTokens;
          stopReason = event.delta?.stop_reason ?? stopReason;
        }
      }

      if (!emittedAny) {
        yield {
          type: "error",
          code: "EMPTY_RESPONSE",
          message: "Provider returned no text content.",
        };
        return;
      }

      yield {
        type: "done",
        model: this.model,
        provider: this.id,
        usage: { inputTokens, outputTokens },
        stopReason,
      };
    } catch (err) {
      const e = normalizeError(err, this.id);
      yield { type: "error", code: e.code, message: e.message };
    }
  }
}

// ── Error normalisation ───────────────────────────────────────────────────

/**
 * Map any thrown value onto an AiProviderError with a stable code.
 * Vendor error text is intentionally discarded — the caller substitutes a
 * fixed doctor-facing message from AI_ERROR_MESSAGES.
 */
function normalizeError(err: unknown, provider: string): AiProviderError {
  if (err instanceof AiProviderError) return err;

  const status = (err as { status?: number })?.status;
  const name = (err as { name?: string })?.name ?? "";

  if (status === 429) {
    return new AiProviderError("RATE_LIMITED", "Rate limited.", provider);
  }
  if (status === 401 || status === 403) {
    return new AiProviderError(
      "NOT_CONFIGURED",
      "Provider rejected the credentials.",
      provider,
    );
  }
  if (typeof status === "number" && status >= 500) {
    return new AiProviderError("UNAVAILABLE", "Provider error.", provider);
  }
  if (name === "APIConnectionTimeoutError" || name === "AbortError") {
    return new AiProviderError("TIMEOUT", "Request timed out.", provider);
  }
  if (name === "APIConnectionError") {
    return new AiProviderError("UNAVAILABLE", "Could not reach provider.", provider);
  }

  return new AiProviderError("UNKNOWN", "Unhandled provider failure.", provider);
}
