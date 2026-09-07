import { AnthropicProvider, DEFAULT_ANTHROPIC_MODEL } from "./anthropic-provider";
import { GeminiProvider, DEFAULT_GEMINI_MODEL } from "./gemini-provider";
import type { AIProvider } from "./provider";

export type ProviderId = "anthropic" | "gemini";

export type ResolvedProviderConfig = {
  provider: ProviderId;
  model: string;
  maxTokens: number;
};

export function createProvider(config: ResolvedProviderConfig): AIProvider {
  switch (config.provider) {
    case "gemini":
      return new GeminiProvider({ model: config.model });
    case "anthropic":
    default:
      return new AnthropicProvider({ model: config.model });
  }
}

export { DEFAULT_ANTHROPIC_MODEL, DEFAULT_GEMINI_MODEL };
export * from "./provider";
