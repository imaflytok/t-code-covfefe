/**
 * The model usually emits its own "PRO TIP:" lines. These are fallbacks the UI
 * can surface if none are present in a given answer.
 */
export const PRO_TIPS: string[] = [
  "Add unit tests. Even I like a good test. But keep 'em strong and simple.",
  "Name things clearly. Confusing names? Sad. Beautiful names? Tremendous.",
  "Commit often. Small commits. The best commits, frankly.",
  "Handle your errors. Don't let 'em sneak in like nobody's watching.",
  "Read the docs. The best people read the docs. Believe me.",
];

/** Extract a `PRO TIP:` line from assistant text, if present. */
export function extractProTip(content: string): string | null {
  const m = content.match(/^\s*PRO TIP:\s*(.+)$/im);
  return m ? m[1].trim() : null;
}
