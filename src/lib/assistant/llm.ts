/**
 * AI Chat model access.
 *
 * Two OpenAI-compatible providers behind one call: the primary answers, and
 * the other takes over when the primary is rate limited, fails or has no key.
 * This file has no PPMS imports on purpose, so it can move into an external
 * plugin later without changes.
 *
 * Environment:
 *   GROQ_API_KEY, GEMINI_API_KEY   one or both
 *   GROQ_MODEL, GEMINI_MODEL       optional model overrides
 *   ASSISTANT_PRIMARY              "groq" (default) or "gemini"
 */

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type ProviderName = "groq" | "gemini";

/** A tool the model may call instead of answering. It takes no arguments. */
export type ChatTool = { name: string; description: string };

export type ChatEvent =
  | { type: "provider"; name: ProviderName }
  | { type: "text"; text: string }
  | { type: "tool"; name: string };

type Provider = { name: ProviderName; url: string; apiKey: string; model: string };

/** Thrown when no provider could answer. `code` tells the caller why. */
export class AssistantError extends Error {
  constructor(public code: "not_configured" | "unavailable", message: string) {
    super(message);
  }
}

const REQUEST_TIMEOUT_MS = 90_000;

function configuredProviders(): Provider[] {
  const groq: Provider | null = process.env.GROQ_API_KEY
    ? {
        name: "groq",
        url: "https://api.groq.com/openai/v1/chat/completions",
        apiKey: process.env.GROQ_API_KEY,
        model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
      }
    : null;
  const gemini: Provider | null = process.env.GEMINI_API_KEY
    ? {
        name: "gemini",
        url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        apiKey: process.env.GEMINI_API_KEY,
        model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
      }
    : null;
  const order = process.env.ASSISTANT_PRIMARY === "gemini" ? [gemini, groq] : [groq, gemini];
  return order.filter((p): p is Provider => p !== null);
}

export function assistantConfigured(): boolean {
  return configuredProviders().length > 0;
}

/** Reads one provider's server-sent event stream as text and tool events. */
async function* readStream(body: ReadableStream<Uint8Array>, allowTool: boolean): AsyncGenerator<ChatEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        let delta: { content?: unknown; tool_calls?: Array<{ function?: { name?: string } }> } | undefined;
        try {
          delta = JSON.parse(data)?.choices?.[0]?.delta;
        } catch {
          continue;
        }
        if (!delta) continue;
        const toolName = delta.tool_calls?.find((t) => t.function?.name)?.function?.name;
        if (toolName) {
          // A model can imitate a tool call it was never offered; skip those.
          if (!allowTool) continue;
          yield { type: "tool", name: toolName };
          return;
        }
        if (typeof delta.content === "string" && delta.content) {
          yield { type: "text", text: delta.content };
        }
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}

/**
 * Streams one answer. Tries each configured provider in order and moves to the
 * next when a provider refuses the request or fails before producing anything.
 * Emits a "tool" event and stops when the model asks for the tool.
 */
export async function* streamChat(opts: {
  system: string;
  messages: ChatMessage[];
  tool?: ChatTool;
}): AsyncGenerator<ChatEvent> {
  const providers = configuredProviders();
  if (providers.length === 0) {
    throw new AssistantError("not_configured", "No AI provider key is configured.");
  }

  for (const provider of providers) {
    let produced = false;
    try {
      const res = await fetch(provider.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({
          model: provider.model,
          stream: true,
          temperature: 0.3,
          messages: [{ role: "system", content: opts.system }, ...opts.messages],
          ...(opts.tool
            ? {
                tools: [
                  {
                    type: "function",
                    function: {
                      name: opts.tool.name,
                      description: opts.tool.description,
                      parameters: { type: "object", properties: {} },
                    },
                  },
                ],
              }
            : {}),
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok || !res.body) {
        const detail = (await res.text().catch(() => "")).slice(0, 300);
        console.error(`[assistant] ${provider.name} answered ${res.status}; trying the next provider. ${detail}`);
        continue;
      }
      for await (const event of readStream(res.body, !!opts.tool)) {
        if (!produced) {
          produced = true;
          yield { type: "provider", name: provider.name };
        }
        yield event;
      }
      if (produced) return;
      console.error(`[assistant] ${provider.name} returned an empty answer; trying the next provider`);
    } catch (err) {
      // Once part of an answer is out, a second provider would repeat it.
      if (produced) throw err;
      console.error(`[assistant] ${provider.name} failed; trying the next provider`, err);
    }
  }

  throw new AssistantError("unavailable", "No AI provider could answer.");
}
