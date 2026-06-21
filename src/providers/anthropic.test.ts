import { expect, test } from "vitest";
import { anthropic, CLAUDE_CODE_IDENTITY } from "./anthropic";

test("anthropic body uses system field + user/assistant messages", () => {
  const body = anthropic.buildBody({
    model: "claude-sonnet-4-6",
    system: "sys",
    messages: [
      { id: "s", role: "system", content: "ignore me" },
      { id: "1", role: "user", content: "hi" },
    ],
  }) as { model: string; stream: boolean; system: string; messages: unknown[] };

  expect(body.model).toBe("claude-sonnet-4-6");
  expect(body.stream).toBe(true);
  expect(body.system).toBe("sys");
  expect(body.messages).toEqual([{ role: "user", content: "hi" }]);
});

test("anthropic decodes content_block_delta only", () => {
  expect(
    anthropic.decodeChunk({ type: "content_block_delta", delta: { text: "Yo" } }),
  ).toBe("Yo");
  expect(anthropic.decodeChunk({ type: "message_start" })).toBe("");
});

test("anthropic uses x-api-key header", () => {
  expect(anthropic.buildHeaders("k")["x-api-key"]).toBe("k");
});

test("anthropic oauth body uses array system with Claude Code identity first", () => {
  const body = anthropic.buildOAuthBody({
    model: "claude-opus-4-8",
    system: "be trump",
    messages: [
      { id: "s", role: "system", content: "ignore me" },
      { id: "1", role: "user", content: "hi" },
    ],
  }) as {
    system: { type: string; text: string }[];
    messages: unknown[];
  };

  expect(body.system).toEqual([
    { type: "text", text: CLAUDE_CODE_IDENTITY },
    { type: "text", text: "be trump" },
  ]);
  expect(body.system[0].text).toBe(CLAUDE_CODE_IDENTITY);
  expect(body.messages).toEqual([{ role: "user", content: "hi" }]);
});

test("anthropic oauth headers use Bearer + beta, no x-api-key", () => {
  const h = anthropic.buildOAuthHeaders("tok");
  expect(h["authorization"]).toBe("Bearer tok");
  expect(h["anthropic-beta"]).toBe("oauth-2025-04-20");
  expect(h["anthropic-version"]).toBe("2023-06-01");
  expect(h["x-api-key"]).toBeUndefined();
});
