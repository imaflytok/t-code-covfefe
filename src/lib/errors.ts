export type ErrorKind = "no-key" | "api";

/** Map an error to a Trump-voiced, user-facing message. Never a raw trace. */
export function trumpError(kind: ErrorKind, detail = ""): string {
  if (kind === "no-key") {
    return "You forgot the key, folks. Nobody — and I mean NOBODY — makes great code without the key. Add your API key in Settings. Sad!";
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
