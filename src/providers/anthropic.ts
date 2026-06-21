import type { ChatRequest, ProviderSpec } from "./types";

/**
 * Anthropic Messages API.
 * NOTE: verify model ids, `anthropic-version`, and event shapes against the
 * `claude-api` reference before release — they evolve.
 */
export const anthropic: ProviderSpec = {
  id: "anthropic",
  label: "Anthropic (Claude)",
  endpoint: "https://api.anthropic.com/v1/messages",
  models: [
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", context: 200000 },
    { id: "claude-opus-4-8", label: "Claude Opus 4.8", context: 200000 },
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", context: 200000 },
  ],
  buildBody(req: ChatRequest) {
    return {
      model: req.model,
      stream: true,
      max_tokens: 4096,
      system: req.system,
      messages: req.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content })),
    };
  },
  buildHeaders(apiKey: string) {
    return {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    };
  },
  decodeChunk(json: unknown) {
    const j = json as { type?: string; delta?: { text?: string } };
    if (j?.type === "content_block_delta") return j?.delta?.text ?? "";
    return "";
  },
};
