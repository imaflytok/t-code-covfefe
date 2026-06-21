import type { ChatRequest, ProviderSpec } from "./types";
import type { ModelInfo, ProviderId } from "../types";

/**
 * Factory for OpenAI-compatible chat providers (OpenAI, xAI, and friends).
 * Keeps the body/header/decode logic DRY across compatible APIs.
 */
export function openAICompatible(opts: {
  id: ProviderId;
  label: string;
  endpoint: string;
  models: ModelInfo[];
}): ProviderSpec {
  return {
    id: opts.id,
    label: opts.label,
    endpoint: opts.endpoint,
    models: opts.models,
    buildBody(req: ChatRequest) {
      return {
        model: req.model,
        stream: true,
        messages: [
          { role: "system", content: req.system },
          ...req.messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      };
    },
    buildHeaders(apiKey: string) {
      return {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      };
    },
    decodeChunk(json: unknown) {
      const j = json as { choices?: { delta?: { content?: string } }[] };
      return j?.choices?.[0]?.delta?.content ?? "";
    },
  };
}

export const openai = openAICompatible({
  id: "openai",
  label: "OpenAI",
  endpoint: "https://api.openai.com/v1/chat/completions",
  models: [
    { id: "gpt-4o", label: "GPT-4o", context: 128000 },
    { id: "gpt-4o-mini", label: "GPT-4o mini", context: 128000 },
  ],
});
