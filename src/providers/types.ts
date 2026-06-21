import type { ChatMessage, ModelInfo, ProviderId } from "../types";

export interface ChatRequest {
  model: string;
  system: string;
  messages: ChatMessage[];
}

export interface ProviderSpec {
  id: ProviderId;
  label: string;
  models: ModelInfo[];
  endpoint: string;
  /** Build the JSON request body for this provider. */
  buildBody(req: ChatRequest): unknown;
  /** Build auth + content headers for an API-key request. */
  buildHeaders(apiKey: string): Record<string, string>;
  /** Decode one parsed SSE JSON event into a text delta ("" if none). */
  decodeChunk(json: unknown): string;
}
