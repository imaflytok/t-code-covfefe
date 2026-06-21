import { render, screen, fireEvent, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

// --- Mock the Tauri boundary so nothing hits native code. ---
// App mounts -> hydrateKeys()/hydrateOauth() -> secrets/oauth -> invoke().
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(""),
  Channel: class {
    onmessage: ((m: unknown) => void) | null = null;
  },
}));

// Mock the secrets/oauth wrappers so hydration resolves cleanly without IPC.
vi.mock("./lib/secrets", () => ({
  getSecret: vi.fn().mockResolvedValue(""),
  setSecret: vi.fn().mockResolvedValue(undefined),
  deleteSecret: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./lib/oauth", () => ({
  startOauth: vi.fn().mockResolvedValue(undefined),
  oauthStatus: vi.fn().mockResolvedValue(false),
  oauthLogout: vi.fn().mockResolvedValue(undefined),
  getAccessToken: vi
    .fn()
    .mockResolvedValue({ access_token: "", account_id: "" }),
}));

import App from "./App";
import { useChatStore } from "./store/chat";

beforeEach(() => {
  // Reset the module-level chat store so each test starts clean.
  useChatStore.setState({ messages: [], streaming: false, error: null });
});

test("renders sidebar brand and welcome text", async () => {
  render(<App />);

  // Sidebar brand "TRUMP CODE" renders.
  expect(await screen.findByText(/TRUMP CODE/)).toBeInTheDocument();

  // Welcome text renders (appears in the header banner and the empty state).
  expect(
    screen.getAllByText(/Welcome to Trump Code/i).length,
  ).toBeGreaterThan(0);
});

test("/covfefe command produces a Trump message containing 'covfefe' (no network)", async () => {
  render(<App />);

  const input = await screen.findByPlaceholderText(/ask trump/i);
  fireEvent.change(input, { target: { value: "/covfefe" } });
  fireEvent.keyDown(input, { key: "Enter" });

  // The /covfefe command is handled fully client-side; assert the resulting
  // Trump message body (which contains "covfefe") appears. Match the
  // distinctive assistant response text to avoid the sidebar project name
  // and the echoed user input also containing "covfefe".
  expect(
    await screen.findByText(/negative press covfefe/i),
  ).toBeInTheDocument();
});

test("Settings button opens the SettingsModal", async () => {
  render(<App />);

  const settingsButton = await screen.findByRole("button", {
    name: /settings/i,
  });
  fireEvent.click(settingsButton);

  // The modal renders its own "Settings" heading plus provider controls.
  const dialog = await screen.findByText(/PROVIDER/);
  expect(dialog).toBeInTheDocument();
  expect(
    within(document.body).getByText(/stored in your OS keychain/i),
  ).toBeInTheDocument();
});
