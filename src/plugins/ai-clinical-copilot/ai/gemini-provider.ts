import {
  GoogleGenerativeAI,
  GoogleGenerativeAIFetchError,
} from "@google/generative-ai";
import {
  AiProviderError,
  type AIProvider,
  type AiRequest,
  type AiResult,
  type AiStreamEvent,
} from "./provider";

export const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";

const REQUEST_TIMEOUT_MS = 120_000;

// Only Gemini 2.5+ thinking models support thinkingConfig.
// Passing it to gemini-2.0-flash causes a 400 API error.
function isThinkingModel(model: string): boolean {
  return model.includes("2.5") || model.includes("thinking");
}

export class GeminiProvider implements AIProvider {
  readonly id = "gemini";
  readonly model: string;

  private readonly client: GoogleGenerativeAI | null;

  constructor(opts: { model?: string; apiKey?: string } = {}) {
    this.model = opts.model?.trim() || DEFAULT_GEMINI_MODEL;
    const key = opts.apiKey ?? process.env.GEMINI_API_KEY;
    this.client = key ? new GoogleGenerativeAI(key) : null;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async complete(req: AiRequest): Promise<AiResult> {
    const client = this.requireClient();
    const geminiModel = this.buildModel(client, req);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const result = await geminiModel.generateContent(
        {
          contents: req.messages.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
        },
        { signal: controller.signal },
      );

      const text = result.response.text().trim();
      if (!text) {
        throw new AiProviderError("EMPTY_RESPONSE", "Provider returned no text content.", this.id);
      }

      return {
        text,
        model: this.model,
        provider: this.id,
        usage: {
          inputTokens: result.response.usageMetadata?.promptTokenCount ?? 0,
          outputTokens: result.response.usageMetadata?.candidatesTokenCount ?? 0,
        },
        stopReason: mapFinishReason(result.response.candidates?.[0]?.finishReason as string | undefined),
      };
    } catch (err) {
      throw normalizeError(err, this.id);
    } finally {
      clearTimeout(timer);
    }
  }

  async *stream(req: AiRequest): AsyncIterable<AiStreamEvent> {
    let client: GoogleGenerativeAI;
    try {
      client = this.requireClient();
    } catch (err) {
      const e = normalizeError(err, this.id);
      yield { type: "error", code: e.code, message: e.message };
      return;
    }

    const geminiModel = this.buildModel(client, req);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let emittedAny = false;

    try {
      const streamResult = await geminiModel.generateContentStream(
        {
          contents: req.messages.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
        },
        { signal: controller.signal },
      );

      for await (const chunk of streamResult.stream) {
        const text = chunk.text();
        if (text) {
          emittedAny = true;
          yield { type: "text", text };
        }
      }

      clearTimeout(timer);

      if (!emittedAny) {
        yield { type: "error", code: "EMPTY_RESPONSE", message: "Provider returned no text content." };
        return;
      }

      const final = await streamResult.response;
      yield {
        type: "done",
        model: this.model,
        provider: this.id,
        usage: {
          inputTokens: final.usageMetadata?.promptTokenCount ?? 0,
          outputTokens: final.usageMetadata?.candidatesTokenCount ?? 0,
        },
        stopReason: mapFinishReason(final.candidates?.[0]?.finishReason as string | undefined),
      };
    } catch (err) {
      clearTimeout(timer);
      const e = normalizeError(err, this.id);
      yield { type: "error", code: e.code, message: e.message };
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private requireClient(): GoogleGenerativeAI {
    if (!this.client) {
      throw new AiProviderError("NOT_CONFIGURED", "GEMINI_API_KEY is not set.", this.id);
    }
    return this.client;
  }

  private buildModel(client: GoogleGenerativeAI, req: AiRequest) {
    const thinking = isThinkingModel(this.model);
    const thinkingBudget = thinking ? 8192 : 0;
    return client.getGenerativeModel({
      model: this.model,
      systemInstruction: req.system,
      generationConfig: {
        maxOutputTokens: req.maxTokens + thinkingBudget,
        temperature: req.temperature ?? 0,
        ...(thinking && { thinkingConfig: { thinkingBudget } }),
      } as Record<string, unknown>,
    });
  }
}

function mapFinishReason(reason: string | undefined): string {
  switch (reason) {
    case "STOP": return "end_turn";
    case "MAX_TOKENS": return "max_tokens";
    case "SAFETY": return "content_filtered";
    default: return reason ?? "end_turn";
  }
}

function normalizeError(err: unknown, provider: string): AiProviderError {
  if (err instanceof AiProviderError) return err;

  if (err instanceof Error && err.name === "AbortError") {
    return new AiProviderError("TIMEOUT", "Request timed out.", provider);
  }

  if (err instanceof GoogleGenerativeAIFetchError) {
    const s = err.status;
    if (s === 400) return new AiProviderError("UNKNOWN", "Invalid request to AI provider.", provider);
    if (s === 429) return new AiProviderError("RATE_LIMITED", "Rate limited.", provider);
    if (s === 401 || s === 403) return new AiProviderError("NOT_CONFIGURED", "Provider rejected credentials.", provider);
    if (typeof s === "number" && s >= 500) return new AiProviderError("UNAVAILABLE", "Provider error.", provider);
  }

  return new AiProviderError("UNKNOWN", "Unhandled provider failure.", provider);
}
