import { expect, test } from "vitest";
import { buildSystemPrompt } from "./systemPrompt";

test("system prompt has persona AND a hard correctness rule", () => {
  const p = buildSystemPrompt().toLowerCase();
  expect(p).toContain("trump");
  expect(p).toContain("must");
  expect(p).toMatch(/correct|accurate/);
});
