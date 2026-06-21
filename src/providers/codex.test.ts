import { expect, test } from "vitest";
import { codex, CODEX_DEFAULT_MODEL } from "./codex";

test("codex body uses Responses shape (instructions + input blocks)", () => {
  const body = codex.buildBody({
    model: "gpt-5",
    system: "be trump",
    messages: [
      { id: "s", role: "system", content: "ignore me" },
      { id: "1", role: "user", content: "hi" },
      { id: "2", role: "assistant", content: "yo" },
    ],
  }) as {
    model: string;
    instructions: string;
    input: { role: string; content: { type: string; text: string }[] }[];
    store: boolean;
    stream: boolean;
  };

  expect(body.model).toBe("gpt-5");
  expect(body.instructions).toBe("be trump");
  expect(body.store).toBe(false);
  expect(body.stream).toBe(true);
  expect(body.input).toEqual([
    { role: "user", content: [{ type: "input_text", text: "hi" }] },
    { role: "assistant", content: [{ type: "input_text", text: "yo" }] },
  ]);
});

test("codex body falls back to default model when empty", () => {
  const body = codex.buildBody({
    model: "",
    system: "s",
    messages: [],
  }) as { model: string };
  expect(body.model).toBe(CODEX_DEFAULT_MODEL);
});

test("codex headers carry bearer + account id, no x-api-key", () => {
  const h = codex.buildHeaders("tok123", "acct_9");
  expect(h["authorization"]).toBe("Bearer tok123");
  expect(h["ChatGPT-Account-Id"]).toBe("acct_9");
  expect(h["content-type"]).toBe("application/json");
  expect(h["x-api-key"]).toBeUndefined();
});

test("codex headers omit account id header when empty", () => {
  const h = codex.buildHeaders("tok123", "");
  expect(h["ChatGPT-Account-Id"]).toBeUndefined();
  expect(h["authorization"]).toBe("Bearer tok123");
});

test("codex decodes response.output_text.delta only", () => {
  expect(
    codex.decodeChunk({ type: "response.output_text.delta", delta: "He" }),
  ).toBe("He");
  expect(codex.decodeChunk({ type: "response.created" })).toBe("");
  expect(codex.decodeChunk({ type: "response.output_text.done" })).toBe("");
});

test("codex decodeChunk returns '' for a delta event missing the delta field", () => {
  // type matches but no `delta` string present — must not throw, yields "".
  expect(codex.decodeChunk({ type: "response.output_text.delta" })).toBe("");
});

test("codex decodeChunk ignores unknown / error event types", () => {
  expect(codex.decodeChunk({ type: "response.error", error: { message: "boom" } })).toBe("");
  expect(codex.decodeChunk({ type: "error" })).toBe("");
  expect(codex.decodeChunk({ type: "some.future.event" })).toBe("");
});

test("codex decodeChunk does not throw on null / non-object / empty input", () => {
  expect(codex.decodeChunk(null)).toBe("");
  expect(codex.decodeChunk(undefined)).toBe("");
  expect(codex.decodeChunk({})).toBe("");
  expect(codex.decodeChunk("just a string")).toBe("");
  expect(codex.decodeChunk(42)).toBe("");
});
