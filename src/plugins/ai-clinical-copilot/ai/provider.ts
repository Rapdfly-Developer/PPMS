/**
 * AI Provider Abstraction
 *
 * The Copilot never talks to a vendor SDK directly — it talks to AIProvider.
 * Adding OpenAIProvider or AzureOpenAIProvider later means implementing this
 * interface and registering it in ./index.ts; no other Copilot file changes.
 */

export type AiRole = "user" | "assistant";

export type AiMessage = {
  role: AiRole;
  content: string;
};

export type AiRequest = {
  /** System instruction — safety rules and output contract. */
  system: string;
  messages: AiMessage[];
  maxTokens: number;
  /** Deterministic output is preferred for clinical summarisation. */
  temperature?: number;
};

export type AiUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type AiResult = {
  text: string;
  model: string;
  provider: string;
  usage: AiUsage;
  stopReason: string | null;
};

/** Events emitted while streaming. */
export type AiStreamEvent =
  | { type: "text"; text: string }
  | { type: "done"; model: string; provider: string; usage: AiUsage; stopReason: string | null }
  | { type: "error"; code: AiErrorCode; message: string };

export type AiErrorCode =
  | "NOT_CONFIGURED"
  | "UNAVAILABLE"
  | "TIMEOUT"
  | "RATE_LIMITED"
  | "MALFORMED_RESPONSE"
  | "EMPTY_RESPONSE"
  | "UNKNOWN";

/**
 * Provider errors carry a stable code and a message that is safe to show a
 * doctor. Vendor messages are deliberately not forwarded — they can contain
 * request echoes, and therefore patient content.
 */
export class AiProviderError extends Error {
  constructor(
    public readonly code: AiErrorCode,
    message: string,
    public readonly provider?: string,
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}

/** Doctor-facing message for each failure mode. Never includes vendor text. */
export const AI_ERROR_MESSAGES: Record<AiErrorCode, string> = {
  NOT_CONFIGURED:
    "The AI provider is not configured for this installation. Contact your administrator.",
  UNAVAILABLE:
    "The AI service is temporarily unavailable. Please try again shortly.",
  TIMEOUT: "The AI service took too long to respond. Please try again.",
  RATE_LIMITED:
    "The AI service is rate limited right now. Please wait a moment and retry.",
  MALFORMED_RESPONSE:
    "The AI returned a response that could not be validated. Nothing has been saved.",
  EMPTY_RESPONSE: "The AI returned an empty response. Please try again.",
  UNKNOWN: "The AI request could not be completed. Please try again.",
};

export interface AIProvider {
  /** Stable provider id recorded in audit and usage rows. */
  readonly id: string;
  /** Model identifier this provider instance will call. */
  readonly model: string;
  /** False when required credentials are absent — checked before any request. */
  isConfigured(): boolean;
  /** Single-shot completion. */
  complete(req: AiRequest): Promise<AiResult>;
  /** Incremental completion. */
  stream(req: AiRequest): AsyncIterable<AiStreamEvent>;
}
