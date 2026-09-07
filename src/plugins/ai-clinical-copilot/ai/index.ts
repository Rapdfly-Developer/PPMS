/**
 * AI Provider resolution.
 *
 * Reads the per-hospital plugin configuration and returns the configured
 * provider. Today only "anthropic" is implemented; the switch is the single
 * place a future OpenAIProvider or AzureOpenAIProvider gets wired in.
 */

import { AnthropicProvider, DEFAULT_ANTHROPIC_MODEL } from "./anthropic-provider";
import type { AIProvider } from "./provider";

export type ProviderId = "anthropic";

export type ResolvedProviderConfig = {
  provider: ProviderId;
  model: string;
  maxTokens: number;
};

/**
 * Build an AIProvider from resolved plugin configuration.
 * Unknown provider ids fall back to Anthropic rather than throwing, so a bad
 * config value degrades instead of breaking the Copilot entirely.
 */
export function createProvider(config: ResolvedProviderConfig): AIProvider {
  switch (config.provider) {
    case "anthropic":
    default:
      return new AnthropicProvider({ model: config.model });
  }
}

export { DEFAULT_ANTHROPIC_MODEL };
export * from "./provider";
