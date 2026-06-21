import { openAICompatible } from "./openai";

export const xai = openAICompatible({
  id: "xai",
  label: "xAI (Grok)",
  endpoint: "https://api.x.ai/v1/chat/completions",
  models: [
    { id: "grok-2", label: "Grok 2", context: 131072 },
    { id: "grok-2-mini", label: "Grok 2 mini", context: 131072 },
  ],
});
