import { expect, test } from "vitest";
import { openai } from "./openai";

test("openai builds chat body + decodes delta", () => {
  const body = openai.buildBody({
    model: "gpt-4o",
    system: "sys",
    messages: [{ id: "1", role: "user", content: "hi" }],
  }) as { model: string; stream: boolean; messages: unknown[] };

  expect(body.model).toBe("gpt-4o");
  expect(body.stream).toBe(true);
  expect(body.messages[0]).toEqual({ role: "system", content: "sys" });
  expect(body.messages[1]).toEqual({ role: "user", content: "hi" });

  expect(
    openai.decodeChunk({ choices: [{ delta: { content: "Yo" } }] }),
  ).toBe("Yo");
  expect(openai.decodeChunk({ choices: [{ delta: {} }] })).toBe("");
});

test("openai sets bearer auth header", () => {
  expect(openai.buildHeaders("sk-test").Authorization).toBe("Bearer sk-test");
});
