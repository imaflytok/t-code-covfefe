import { describe, expect, test } from "vitest";
import { parseSSE } from "./sse";

describe("parseSSE", () => {
  test("extracts data payloads, skips comments/blank, stops at [DONE]", () => {
    const chunk = 'data: {"a":1}\n\n: ping\n\ndata: [DONE]\n\n';
    const { events, done } = parseSSE(chunk);
    expect(events).toEqual(['{"a":1}']);
    expect(done).toBe(true);
  });

  test("returns trailing partial line as rest", () => {
    const { events, rest } = parseSSE('data: {"a":1}\n\ndata: {"b":2');
    expect(events).toEqual(['{"a":1}']);
    expect(rest).toBe('data: {"b":2');
  });

  test("handles CRLF line endings", () => {
    const { events } = parseSSE('data: {"x":9}\r\n\r\n');
    expect(events).toEqual(['{"x":9}']);
  });
});
