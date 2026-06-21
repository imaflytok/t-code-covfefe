import { Channel, invoke } from "@tauri-apps/api/core";
import { parseSSE } from "./sse";
import { openai } from "./openai";
import { xai } from "./xai";
import { anthropic } from "./anthropic";
import { codex } from "./codex";
import type { ChatRequest, ProviderSpec } from "./types";
import type { ProviderId } from "../types";
import { getAccessToken } from "../lib/oauth";
import type { AuthMode } from "../store/settings";

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
 * Resolve the concrete request (url + headers + body) for a given provider and
 * auth mode. For `oauth` we fetch a fresh access token (the Rust side refreshes
 * it transparently) and switch to the subscription calling path.
 */
async function buildRequest(
  id: ProviderId,
  apiKey: string,
  req: ChatRequest,
  authMode: AuthMode,
): Promise<{ url: string; headers: Record<string, string>; body: unknown; decode: (j: unknown) => string }> {
  // ---- API-key path (default, unchanged) ----------------------------------
  if (authMode !== "oauth") {
    const spec = PROVIDERS[id];
    return {
      url: spec.endpoint,
      headers: spec.buildHeaders(apiKey),
      body: spec.buildBody(req),
      decode: (j) => spec.decodeChunk(j),
    };
  }

  // ---- OAuth (subscription) path ------------------------------------------
  const { access_token, account_id } = await getAccessToken(id);

  if (id === "anthropic") {
    // Claude subscription via the Messages API with the OAuth token.
    // CLAUDE-CODE-COMPAT: array-form system (Claude Code identity first), Bearer
    // auth + oauth beta header, and NO x-api-key (see anthropic.ts).
    return {
      url: anthropic.endpoint,
      headers: anthropic.buildOAuthHeaders(access_token),
      body: anthropic.buildOAuthBody(req),
      decode: (j) => anthropic.decodeChunk(j),
    };
  }

  if (id === "openai") {
    // ChatGPT subscription via the Codex/WHAM Responses backend. EXPERIMENTAL —
    // see codex.ts. Different endpoint + body shape from api.openai.com.
    return {
      url: codex.endpoint,
      headers: codex.buildHeaders(access_token, account_id),
      body: codex.buildBody(req),
      decode: (j) => codex.decodeChunk(j),
    };
  }

  // xAI (and any other provider) has no OAuth path — fall back to API key.
  const spec = PROVIDERS[id];
  return {
    url: spec.endpoint,
    headers: spec.buildHeaders(apiKey),
    body: spec.buildBody(req),
    decode: (j) => spec.decodeChunk(j),
  };
}

/**
 * Stream a chat completion. The Rust `chat_stream` command makes the native
 * HTTP request (no CORS) and pushes raw response bytes back over a Channel;
 * we buffer + parse SSE here and surface text deltas via `onToken`.
 *
 * When `authMode === 'oauth'` we resolve the OAuth access token (and ChatGPT
 * account id) up front and switch to the provider's subscription calling path;
 * otherwise the API-key path is used unchanged. `apiKey` is ignored for OAuth.
 */
export async function streamChat(
  id: ProviderId,
  apiKey: string,
  req: ChatRequest,
  onToken: (t: string) => void,
  authMode: AuthMode = "apiKey",
): Promise<void> {
  const { url, headers, body, decode } = await buildRequest(
    id,
    apiKey,
    req,
    authMode,
  );

  const channel = new Channel<string>();
  let buf = "";

  channel.onmessage = (raw) => {
    buf += raw;
    const { events, rest } = parseSSE(buf);
    buf = rest;
    for (const ev of events) {
      try {
        const json = JSON.parse(ev);
        const delta = decode(json);
        if (delta) onToken(delta);
      } catch {
        // non-JSON keepalive / partial — ignore
      }
    }
  };

  await invoke("chat_stream", {
    args: { url, headers, body },
    onEvent: channel,
  });
}
