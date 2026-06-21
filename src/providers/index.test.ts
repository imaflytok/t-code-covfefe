import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { ChatRequest } from "./types";

/**
 * OAuth/api-key request-routing tests for `buildRequest`/`streamChat`.
 *
 * `buildRequest` is internal, so we exercise it through `streamChat` and capture
 * the `args` ({ url, headers, body }) handed to the Rust `chat_stream` command.
 * Both `@tauri-apps/api/core` (invoke + Channel) and `../lib/oauth`
 * (getAccessToken) are mocked — no network, no real tokens, no keychain.
 */

// ---- Mocks -----------------------------------------------------------------
// `vi.mock` factories are hoisted above imports, so the shared spies live in a
// `vi.hoisted` block (also hoisted) that the factories can safely reference.

const { invoke, getAccessToken } = vi.hoisted(() => ({
  // Typed so `.mock.calls[n]` carries the cmd + payload tuple for assertions.
  invoke: vi.fn<(cmd: string, payload?: unknown) => Promise<unknown>>(
    async () => undefined,
  ),
  getAccessToken: vi.fn<
    (provider: string) => Promise<{ access_token: string; account_id: string }>
  >(async () => ({ access_token: "tok-abc", account_id: "acct-xyz" })),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke,
  // Minimal Channel stand-in: streamChat only assigns `onmessage` and passes the
  // instance through to invoke; we never push messages in these routing tests.
  Channel: class {
    onmessage: ((raw: string) => void) | null = null;
  },
}));

vi.mock("../lib/oauth", () => ({ getAccessToken }));

import { streamChat } from "./index";
import { CODEX_ENDPOINT } from "./codex";
import { CLAUDE_CODE_IDENTITY } from "./anthropic";

// ---- Helpers ---------------------------------------------------------------

const REQ: ChatRequest = {
  model: "the-model",
  system: "be trump",
  messages: [
    { id: "s", role: "system", content: "ignore me" },
    { id: "1", role: "user", content: "hi" },
  ],
};

/** Resolve the { url, headers, body } captured from the chat_stream invoke. */
function lastArgs(): {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
} {
  const call = invoke.mock.calls.find((c) => c[0] === "chat_stream");
  if (!call) throw new Error("chat_stream was not invoked");
  return (call[1] as { args: { url: string; headers: Record<string, string>; body: Record<string, unknown> } }).args;
}

beforeEach(() => {
  invoke.mockClear();
  getAccessToken.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---- anthropic OAuth -------------------------------------------------------

test("anthropic oauth uses Messages API with Bearer + beta headers and array system", async () => {
  await streamChat("anthropic", "UNUSED-KEY", REQ, () => {}, "oauth");

  expect(getAccessToken).toHaveBeenCalledWith("anthropic");
  const { url, headers, body } = lastArgs();

  expect(url).toBe("https://api.anthropic.com/v1/messages");
  expect(headers["authorization"]).toBe("Bearer tok-abc");
  expect(headers["anthropic-beta"]).toBe("oauth-2025-04-20");
  expect(headers["anthropic-version"]).toBe("2023-06-01");
  expect(headers["x-api-key"]).toBeUndefined();

  // Array-form system, Claude Code identity first.
  expect(body.system).toEqual([
    { type: "text", text: CLAUDE_CODE_IDENTITY },
    { type: "text", text: "be trump" },
  ]);
});

// ---- openai OAuth ----------------------------------------------------------

test("openai oauth targets the codex endpoint with the account-id header", async () => {
  await streamChat("openai", "UNUSED-KEY", REQ, () => {}, "oauth");

  expect(getAccessToken).toHaveBeenCalledWith("openai");
  const { url, headers, body } = lastArgs();

  expect(url).toBe(CODEX_ENDPOINT);
  expect(headers["authorization"]).toBe("Bearer tok-abc");
  expect(headers["ChatGPT-Account-Id"]).toBe("acct-xyz");
  expect(headers["content-type"]).toBe("application/json");
  expect(headers["x-api-key"]).toBeUndefined();

  // Responses-API body shape (instructions + input blocks).
  expect(body.instructions).toBe("be trump");
  expect(body.store).toBe(false);
  expect(body.stream).toBe(true);
});

// ---- xai OAuth falls back to the API-key path ------------------------------

test("xai oauth falls back to the api-key path (uses the api key, not the OAuth token)", async () => {
  await streamChat("xai", "xai-key-123", REQ, () => {}, "oauth");

  // xAI has no OAuth subscription path: it falls through to the api-key spec, so
  // the request must carry the API key — NOT the resolved OAuth bearer token.
  const { url, headers } = lastArgs();
  expect(url).toBe("https://api.x.ai/v1/chat/completions");
  expect(headers["Authorization"]).toBe("Bearer xai-key-123");
  expect(headers["Authorization"]).not.toBe("Bearer tok-abc");
});

// ---- API-key path is unchanged ---------------------------------------------

test("apiKey path uses the provider spec and never touches OAuth", async () => {
  await streamChat("anthropic", "real-key", REQ, () => {}, "apiKey");

  expect(getAccessToken).not.toHaveBeenCalled();
  const { url, headers, body } = lastArgs();

  expect(url).toBe("https://api.anthropic.com/v1/messages");
  // API-key headers (x-api-key), NOT the OAuth Bearer/beta headers.
  expect(headers["x-api-key"]).toBe("real-key");
  expect(headers["authorization"]).toBeUndefined();
  expect(headers["anthropic-beta"]).toBeUndefined();
  // Plain string system field (not the array form).
  expect(body.system).toBe("be trump");
});

test("default authMode (omitted) uses the api-key path", async () => {
  await streamChat("openai", "sk-default", REQ, () => {});

  expect(getAccessToken).not.toHaveBeenCalled();
  const { url, headers } = lastArgs();
  expect(url).toBe("https://api.openai.com/v1/chat/completions");
  expect(headers["Authorization"]).toBe("Bearer sk-default");
});
