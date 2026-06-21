import type { ChatRequest } from "./types";
import type { ModelInfo } from "../types";

/**
 * ChatGPT / Codex "WHAM" backend adapter (OAuth subscription path).
 *
 * EXPERIMENTAL — REVERSE-ENGINEERED AND UNVERIFIED.
 * ------------------------------------------------
 * This is the ChatGPT subscription backend used by the Codex CLI, NOT the
 * public `api.openai.com` REST API. It speaks the Responses-API *shape* but
 * lives under `chatgpt.com/backend-api`. None of this has been validated
 * against a live account here; a real round-trip requires an active ChatGPT
 * subscription and must be exercised manually. The request-building and
 * SSE-decoding logic below IS unit-tested (see codex.test.ts) so the wire
 * shape we send is at least pinned and reviewable.
 *
 * Endpoint choice: the OAuth spec gives the base `https://chatgpt.com/backend-api/wham`
 * and a Responses-API body shape, so the Responses collection is the most
 * likely path. We therefore target `…/wham/responses`. If the live backend
 * rejects this, the alternative observed in the wild is `…/codex/responses`;
 * swap CODEX_ENDPOINT if so. Marked EXPERIMENTAL accordingly.
 */
export const CODEX_ENDPOINT =
  "https://chatgpt.com/backend-api/wham/responses";

/**
 * Default model for the Codex/WHAM path. We pick `gpt-5`: the Codex
 * subscription backend is the coding-focused surface and `gpt-5` is its
 * current default family (the public `gpt-4o` ids are an api.openai.com
 * concept and are not guaranteed to resolve on this backend). EXPERIMENTAL.
 */
export const CODEX_DEFAULT_MODEL = "gpt-5";

export const CODEX_MODELS: ModelInfo[] = [
  { id: "gpt-5", label: "GPT-5 (Codex)", context: 256000 },
  { id: "gpt-5-codex", label: "GPT-5 Codex", context: 256000 },
];

/**
 * A ProviderSpec-like adapter for the Codex/WHAM backend. It deliberately does
 * NOT implement the API-key `ProviderSpec` interface (no `buildHeaders(apiKey)`):
 * this path is OAuth-only, so its header builder needs the access token and the
 * ChatGPT account id instead.
 */
export interface CodexSpec {
  id: "openai";
  label: string;
  endpoint: string;
  models: ModelInfo[];
  /** Build the Responses-API request body. */
  buildBody(req: ChatRequest): unknown;
  /** Build OAuth + content headers. `accountId` may be "" if unavailable. */
  buildHeaders(token: string, accountId: string): Record<string, string>;
  /** Decode one parsed SSE JSON event into a text delta ("" if none). */
  decodeChunk(json: unknown): string;
}

export const codex: CodexSpec = {
  id: "openai",
  label: "ChatGPT (Codex)",
  endpoint: CODEX_ENDPOINT,
  models: CODEX_MODELS,

  buildBody(req: ChatRequest) {
    // Responses-API shape (NOT chat/completions). The system prompt is carried
    // in `instructions`; conversation turns go in `input` as typed content
    // blocks. We only forward non-system messages (the persona lives in
    // `instructions`). store:false keeps the turn off the account history;
    // stream:true gives us SSE deltas.
    return {
      model: req.model || CODEX_DEFAULT_MODEL,
      instructions: req.system,
      input: req.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role,
          content: [{ type: "input_text", text: m.content }],
        })),
      store: false,
      stream: true,
    };
  },

  buildHeaders(token: string, accountId: string) {
    const headers: Record<string, string> = {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    };
    // Only send the account header when we actually have an id.
    if (accountId) headers["ChatGPT-Account-Id"] = accountId;
    return headers;
  },

  decodeChunk(json: unknown) {
    // Text deltas arrive as `response.output_text.delta` events carrying a
    // `delta` string. Everything else (response.created, *.done, etc.) yields "".
    const j = json as { type?: string; delta?: string };
    if (j?.type === "response.output_text.delta") return j?.delta ?? "";
    return "";
  },
};
