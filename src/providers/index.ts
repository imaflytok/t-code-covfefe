import { Channel, invoke } from "@tauri-apps/api/core";
import { parseSSE } from "./sse";
import { openai } from "./openai";
import { xai } from "./xai";
import { anthropic } from "./anthropic";
import type { ChatRequest, ProviderSpec } from "./types";
import type { ProviderId } from "../types";

export const PROVIDERS: Record<ProviderId, ProviderSpec> = {
  openai,
  xai,
  anthropic,
};

export function getProvider(id: ProviderId): ProviderSpec {
  return PROVIDERS[id];
}

export function allProviders(): ProviderSpec[] {
  return [openai, anthropic, xai];
}

/**
 * Stream a chat completion. The Rust `chat_stream` command makes the native
 * HTTP request (no CORS) and pushes raw response bytes back over a Channel;
 * we buffer + parse SSE here and surface text deltas via `onToken`.
 */
export async function streamChat(
  id: ProviderId,
  apiKey: string,
  req: ChatRequest,
  onToken: (t: string) => void,
): Promise<void> {
  const spec = PROVIDERS[id];
  const channel = new Channel<string>();
  let buf = "";

  channel.onmessage = (raw) => {
    buf += raw;
    const { events, rest } = parseSSE(buf);
    buf = rest;
    for (const ev of events) {
      try {
        const json = JSON.parse(ev);
        const delta = spec.decodeChunk(json);
        if (delta) onToken(delta);
      } catch {
        // non-JSON keepalive / partial — ignore
      }
    }
  };

  await invoke("chat_stream", {
    args: {
      url: spec.endpoint,
      headers: spec.buildHeaders(apiKey),
      body: spec.buildBody(req),
    },
    onEvent: channel,
  });
}
