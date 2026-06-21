import { beforeEach, expect, test } from "vitest";
import { useChatStore } from "./chat";

beforeEach(() => useChatStore.getState().clear());

test("user + assistant streaming flow accumulates tokens", () => {
  const s = useChatStore.getState();
  s.addUserMessage("hi");
  s.startAssistant();
  useChatStore.getState().appendToken("Yo");
  useChatStore.getState().appendToken("!");

  const st = useChatStore.getState();
  expect(st.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
  expect(st.messages[1].content).toBe("Yo!");
  expect(st.streaming).toBe(true);

  useChatStore.getState().endStream();
  expect(useChatStore.getState().streaming).toBe(false);
});

test("setError stops streaming", () => {
  const s = useChatStore.getState();
  s.startAssistant();
  useChatStore.getState().setError("boom");
  const st = useChatStore.getState();
  expect(st.error).toBe("boom");
  expect(st.streaming).toBe(false);
});
