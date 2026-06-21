import { expect, test } from "vitest";
import { anthropic } from "./anthropic";

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
