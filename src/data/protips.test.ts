import { expect, test } from "vitest";
import { extractProTip } from "./protips";

test("extracts a PRO TIP line", () => {
  const text = "Here's the fix.\n\nPRO TIP: Add unit tests, folks.";
  expect(extractProTip(text)).toBe("Add unit tests, folks.");
});

test("returns null when absent", () => {
  expect(extractProTip("just some code")).toBeNull();
});
