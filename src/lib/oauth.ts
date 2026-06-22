import { invoke } from "@tauri-apps/api/core";
import type { ProviderId } from "../types";

/** OAuth needs the native Tauri backend; a plain browser tab has no IPC bridge. */
function inTauri(): boolean {
  return (
    typeof (window as unknown as { __TAURI_INTERNALS__?: unknown })
      .__TAURI_INTERNALS__ !== "undefined"
  );
}

const NOT_DESKTOP =
  "OAuth sign-in only works in the Trump Code desktop app, not a browser tab. Launch the app (npm run tauri dev) and use its window.";

/**
 * Thin TS wrappers over the Rust OAuth commands defined in
 * `src-tauri/src/oauth.rs`. The Rust core owns the loopback PKCE flow, the
 * keychain-persisted token bundle, and transparent refresh; the webview only
 * triggers the flow and reads back a usable access token.
 *
 * Command surface (must match oauth.rs exactly):
 *   oauth_start(provider)        -> ()                        : interactive login
 *   oauth_status(provider)       -> bool                      : bundle exists?
 *   oauth_logout(provider)       -> ()                        : delete bundle
 *   oauth_access_token(provider) -> { access_token, account_id } (refreshes first)
 */

/** Shape returned by the Rust `oauth_access_token` command. */
export interface OAuthAccessToken {
  access_token: string;
  /** ChatGPT account id (OpenAI only; empty string otherwise). */
  account_id: string;
}

/**
 * Begin the interactive OAuth login for `provider`. Resolves once the Rust side
 * has captured the redirect, exchanged the code, and persisted the bundle.
 * Rejects if the user cancels or the exchange fails.
 */
export async function startOauth(provider: ProviderId): Promise<void> {
  if (!inTauri()) throw new Error(NOT_DESKTOP);
  await invoke("oauth_start", { provider });
}

/** Return whether a stored OAuth bundle exists for `provider`. */
export async function oauthStatus(provider: ProviderId): Promise<boolean> {
  if (!inTauri()) return false; // browser/dev fallback: never "connected"
  return invoke<boolean>("oauth_status", { provider });
}

/** Delete the stored OAuth bundle for `provider` (no-op if absent). */
export async function oauthLogout(provider: ProviderId): Promise<void> {
  if (!inTauri()) return;
  await invoke("oauth_logout", { provider });
}

/**
 * Fetch a usable access token (and ChatGPT account id, when applicable) for
 * `provider`. The Rust side refreshes the token first if it is near expiry.
 */
export async function getAccessToken(
  provider: ProviderId,
): Promise<OAuthAccessToken> {
  if (!inTauri()) throw new Error(NOT_DESKTOP);
  return invoke<OAuthAccessToken>("oauth_access_token", { provider });
}
