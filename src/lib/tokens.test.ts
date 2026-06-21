import { expect, test } from "vitest";
import { contextPct, estimateTokens } from "./tokens";

test("estimateTokens ~ chars/4", () => {
  expect(estimateTokens("")).toBe(0);
  expect(estimateTokens("abcd")).toBe(1);
  expect(estimateTokens("abcde")).toBe(2);
});

test("contextPct rounds and clamps", () => {
  expect(contextPct(64000, 128000)).toBe(50);
  expect(contextPct(200000, 128000)).toBe(100);
  expect(contextPct(10, 0)).toBe(0);
});
