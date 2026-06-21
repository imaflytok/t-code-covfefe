import { beforeEach, expect, test, vi } from "vitest";

// The settings store transitively imports the Tauri API (via secrets/oauth
// wrappers). We never exercise those network/keychain paths here — we only test
// the pure authMode persistence logic — so stub invoke to a harmless no-op.
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => undefined),
  Channel: class {},
}));

import {
  useSettings,
  resolveAuthMode,
  setAuthModeIn,
  type AuthMode,
} from "./settings";

const LS = "trumpcode.settings";

beforeEach(() => {
  localStorage.clear();
  // Reset the store's authMode to a known-empty baseline between tests.
  useSettings.setState({ authMode: {} });
});

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

test("resolveAuthMode defaults to apiKey when provider has no explicit choice", () => {
  expect(resolveAuthMode({}, "anthropic")).toBe("apiKey");
  expect(resolveAuthMode({ openai: "oauth" }, "anthropic")).toBe("apiKey");
});

test("resolveAuthMode returns the explicit per-provider choice", () => {
  const map: Partial<Record<"openai" | "anthropic" | "xai", AuthMode>> = {
    anthropic: "oauth",
    openai: "apiKey",
  };
  expect(resolveAuthMode(map, "anthropic")).toBe("oauth");
  expect(resolveAuthMode(map, "openai")).toBe("apiKey");
});

test("setAuthModeIn returns a new map with the provider set, without mutating input", () => {
  const before = { openai: "apiKey" } as Partial<
    Record<"openai" | "anthropic" | "xai", AuthMode>
  >;
  const after = setAuthModeIn(before, "anthropic", "oauth");

  expect(after).toEqual({ openai: "apiKey", anthropic: "oauth" });
  // Input is untouched (immutability).
  expect(before).toEqual({ openai: "apiKey" });
  expect(after).not.toBe(before);
});

test("setAuthModeIn overwrites an existing provider choice", () => {
  const after = setAuthModeIn({ anthropic: "apiKey" }, "anthropic", "oauth");
  expect(after.anthropic).toBe("oauth");
});

// ---------------------------------------------------------------------------
// Store-level persistence behaviour
// ---------------------------------------------------------------------------

test("getAuthMode defaults to apiKey then reflects setAuthMode", () => {
  expect(useSettings.getState().getAuthMode("anthropic")).toBe("apiKey");

  useSettings.getState().setAuthMode("anthropic", "oauth");
  expect(useSettings.getState().getAuthMode("anthropic")).toBe("oauth");
  // Other providers stay at the default.
  expect(useSettings.getState().getAuthMode("openai")).toBe("apiKey");
});

test("setAuthMode persists the authMode map to localStorage", () => {
  useSettings.getState().setAuthMode("openai", "oauth");

  const raw = localStorage.getItem(LS);
  expect(raw).toBeTruthy();
  const persisted = JSON.parse(raw as string) as {
    provider: string;
    model: string;
    authMode: Record<string, AuthMode>;
  };
  expect(persisted.authMode.openai).toBe("oauth");
  // The provider/model are persisted alongside the authMode map.
  expect(persisted.provider).toBeTruthy();
  expect(persisted.model).toBeTruthy();
});
