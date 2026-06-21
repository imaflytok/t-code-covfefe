export type ErrorKind = "no-key" | "api" | "oauth";

/**
 * Detect whether a failure string came from the OAuth/subscription path —
 * resolving the access token (not signed in, no refresh token, expired, corrupt
 * bundle, refresh HTTP failure). Used to route an `api` failure to the
 * in-character "sign in via Settings" message. Pure + exported for testing.
 */
export function isOauthError(detail: string): boolean {
  const d = detail.toLowerCase();
  return (
    d.includes("not signed in") ||
    d.includes("sign in again") ||
    d.includes("refresh token") ||
    d.includes("token refresh failed") ||
    d.includes("oauth") ||
    d.includes("corrupt")
  );
}

/** Map an error to a Trump-voiced, user-facing message. Never a raw trace. */
export function trumpError(kind: ErrorKind, detail = ""): string {
  if (kind === "no-key") {
    return "You forgot the key, folks. Nobody — and I mean NOBODY — makes great code without the key. Add your API key in Settings. Sad!";
  }
  // OAuth / subscription auth problems: tell the user to sign in via Settings.
  if (kind === "oauth" || (kind === "api" && isOauthError(detail))) {
    return "You're not signed in, folks — or that subscription session expired, totally unfair. Go to Settings and sign in again. Then we'll make the BEST code, believe me.";
  }
  const d = detail.toLowerCase();
  if (d.includes("401") || d.includes("invalid") || d.includes("authentication")) {
    return "That key? Not a good key. A total disaster. Double-check it in Settings, believe me.";
  }
  if (d.includes("429") || d.includes("rate")) {
    return "Too much winning, too fast — they're rate-limiting us. Give it a second. We'll be back, bigger than ever.";
  }
  if (d.includes("network") || d.includes("fetch") || d.includes("sending request") || d.includes("dns")) {
    return "The internet's not cooperating. Very unfair. Check your connection and try again.";
  }
  return `Something went wrong. Not my fault, believe me.\n\n\`${detail}\``;
}
