import { create } from "zustand";
import type { ChatMessage } from "../types";

let counter = 0;
const newId = () => `m${Date.now().toString(36)}_${counter++}`;

interface ChatState {
  messages: ChatMessage[];
  streaming: boolean;
  error: string | null;
  addUserMessage: (content: string) => void;
  addAssistantMessage: (content: string) => void;
  startAssistant: () => void;
  appendToken: (t: string) => void;
  endStream: () => void;
  setError: (e: string | null) => void;
  clear: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  streaming: false,
  error: null,

  addUserMessage: (content) =>
    set((s) => ({
      messages: [...s.messages, { id: newId(), role: "user", content }],
    })),

  addAssistantMessage: (content) =>
    set((s) => ({
      messages: [...s.messages, { id: newId(), role: "assistant", content }],
    })),

  startAssistant: () =>
    set((s) => ({
      streaming: true,
      error: null,
      messages: [...s.messages, { id: newId(), role: "assistant", content: "" }],
    })),

  appendToken: (t) =>
    set((s) => {
      const messages = s.messages.slice();
      const last = messages[messages.length - 1];
      if (last && last.role === "assistant") {
        messages[messages.length - 1] = { ...last, content: last.content + t };
      }
      return { messages };
    }),

  endStream: () => set({ streaming: false }),
  setError: (e) => set({ error: e, streaming: false }),
  clear: () => set({ messages: [], error: null, streaming: false }),
}));
