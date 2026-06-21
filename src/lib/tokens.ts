/** Rough token estimate (~4 chars/token). Good enough for a UI counter. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/** Percentage of a model's context window consumed, clamped to [0, 100]. */
export function contextPct(usedTokens: number, contextWindow: number): number {
  if (contextWindow <= 0) return 0;
  return Math.min(100, Math.round((usedTokens / contextWindow) * 100));
}
