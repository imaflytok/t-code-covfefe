import type { ChatRequest, ProviderSpec } from "./types";

/**
 * The Claude Code identity string. When calling the Messages API with a Claude
 * Code OAuth token (subscription auth, not an API key), the request's `system`
 * field MUST be the array form and its FIRST block must be EXACTLY this string.
 *
 * CLAUDE-CODE-COMPAT REQUIREMENT (load-bearing): Claude Code OAuth tokens are
 * scoped to the Claude Code client; the backend rejects / mis-handles requests
 * whose first system block is not this identity. The real Trump persona is sent
 * as a SECOND system block after it. Do not reorder or alter this string.
 */
export const CLAUDE_CODE_IDENTITY =
  "You are Claude Code, Anthropic's official CLI for Claude.";

/** Anthropic spec extended with OAuth (Claude subscription) body/header builders. */
export interface AnthropicSpec extends ProviderSpec {
  /**
   * Build the Messages API body for the OAuth (Claude Code) path. The `system`
   * field uses the array form with the Claude Code identity as the first block.
   */
  buildOAuthBody(req: ChatRequest): unknown;
  /**
   * Build headers for the OAuth path: Bearer access token + the oauth beta
   * header, and NO `x-api-key`.
   */
  buildOAuthHeaders(token: string): Record<string, string>;
}

/**
 * Anthropic Messages API.
 * NOTE: verify model ids, `anthropic-version`, and event shapes against the
 * `claude-api` reference before release — they evolve.
 */
export const anthropic: AnthropicSpec = {
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
  buildOAuthBody(req: ChatRequest) {
    return {
      model: req.model,
      stream: true,
      max_tokens: 4096,
      // CLAUDE-CODE-COMPAT: array-form `system`; first block MUST be the Claude
      // Code identity, the real Trump persona follows as a second block.
      system: [
        { type: "text", text: CLAUDE_CODE_IDENTITY },
        { type: "text", text: req.system },
      ],
      messages: req.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content })),
    };
  },
  buildOAuthHeaders(token: string) {
    // OAuth (subscription) auth: Bearer token + oauth beta header. NO x-api-key.
    return {
      authorization: `Bearer ${token}`,
      "anthropic-beta": "oauth-2025-04-20",
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
