import { expect, test } from "vitest";
import { trumpError, isOauthError } from "./errors";

test("missing key message", () => {
  expect(trumpError("no-key").toLowerCase()).toContain("key");
});

test("api error classification", () => {
  expect(trumpError("api", "HTTP 401 invalid").toLowerCase()).toContain("disaster");
  expect(trumpError("api", "429 rate limit").toLowerCase()).toContain("rate-limiting");
  expect(trumpError("api", "error sending request")).toMatch(/internet/i);
  expect(trumpError("api", "weird thing")).toContain("weird thing");
});

// ---------------------------------------------------------------------------
// OAuth-specific error mapping
// ---------------------------------------------------------------------------

test("isOauthError recognises token/auth failures from the Rust side", () => {
  expect(isOauthError("not signed in to anthropic")).toBe(true);
  expect(isOauthError("openai access token expired ... sign in again")).toBe(true);
  expect(isOauthError("no refresh token is available")).toBe(true);
  expect(isOauthError("token refresh failed: HTTP 400: invalid_grant")).toBe(true);
  expect(isOauthError("stored OAuth token bundle is corrupt")).toBe(true);
});

test("isOauthError ignores plain api/network failures", () => {
  expect(isOauthError("HTTP 401 invalid")).toBe(false);
  expect(isOauthError("429 rate limit")).toBe(false);
  expect(isOauthError("error sending request")).toBe(false);
  expect(isOauthError("weird thing")).toBe(false);
});

test("oauth kind always yields the sign-in message", () => {
  const msg = trumpError("oauth");
  expect(msg.toLowerCase()).toContain("signed in");
  expect(msg.toLowerCase()).toContain("settings");
  // Never leaks a raw trace.
  expect(msg).not.toContain("`");
});

test("api kind routes OAuth-shaped failures to the sign-in message", () => {
  const msg = trumpError("api", "not signed in to anthropic");
  expect(msg.toLowerCase()).toContain("signed in");
  expect(msg.toLowerCase()).toContain("settings");
});

test("api kind routes a refresh HTTP failure to the sign-in message", () => {
  const msg = trumpError("api", "token refresh failed: HTTP 400: invalid_grant");
  expect(msg.toLowerCase()).toContain("signed in");
  // Does NOT fall through to the generic raw-detail branch.
  expect(msg).not.toContain("invalid_grant");
});
