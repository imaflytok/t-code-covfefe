export interface SSEResult {
  /** JSON payload strings from `data:` lines (excluding `[DONE]`). */
  events: string[];
  /** True if a `[DONE]` sentinel was seen. */
  done: boolean;
  /** Trailing partial line to prepend to the next chunk. */
  rest: string;
}

/**
 * Parse a (possibly partial) chunk of an SSE / event-stream buffer.
 * The last line is returned as `rest` because it may be incomplete; the
 * caller should prepend it to the next chunk before calling again.
 */
export function parseSSE(buffer: string): SSEResult {
  const events: string[] = [];
  let done = false;
  const lines = buffer.split("\n");
  const rest = lines.pop() ?? "";
  for (const raw of lines) {
    const line = raw.replace(/\r$/, "");
    if (!line || line.startsWith(":")) continue; // blank or comment/keepalive
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trimStart();
    if (data === "[DONE]") {
      done = true;
      continue;
    }
    events.push(data);
  }
  return { events, done, rest };
}
