export type Role = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
}

export type ProviderId = "openai" | "anthropic" | "xai";

export interface ModelInfo {
  id: string;
  label: string;
  context: number;
}
