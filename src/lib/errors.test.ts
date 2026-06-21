import { expect, test } from "vitest";
import { trumpError } from "./errors";

test("missing key message", () => {
  expect(trumpError("no-key").toLowerCase()).toContain("key");
});

test("api error classification", () => {
  expect(trumpError("api", "HTTP 401 invalid").toLowerCase()).toContain("disaster");
  expect(trumpError("api", "429 rate limit").toLowerCase()).toContain("rate-limiting");
  expect(trumpError("api", "error sending request")).toMatch(/internet/i);
  expect(trumpError("api", "weird thing")).toContain("weird thing");
});
