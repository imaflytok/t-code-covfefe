import { useEffect, useRef } from "react";
import { useChatStore } from "../store/chat";
import { Message } from "./Message";
import { ThinkingFaces } from "./ThinkingFaces";

function EmptyState() {
  return (
    <div style={{ color: "var(--muted)" }} className="text-sm py-10">
      <div style={{ color: "var(--gold)" }} className="mb-2">
        ★ Welcome to Trump Code (Make Code Great Again Edition) ★
      </div>
      Ask me anything about code. I know the best code. Type{" "}
      <code>/help</code> for commands.
    </div>
  );
}

export function MessageList() {
  const messages = useChatStore((s) => s.messages);
  const streaming = useChatStore((s) => s.streaming);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  return (
    <div className="flex-1 overflow-y-auto tc-scroll px-6 py-4">
      {messages.length === 0 && <EmptyState />}
      {messages.map((m) => {
        const isWaiting =
          streaming && m.role === "assistant" && m.content.length === 0;
        if (isWaiting) {
          return (
            <div key={m.id} className="mb-5">
              <div style={{ color: "var(--gold)" }} className="font-bold mb-1">
                Trump&gt;
              </div>
              <ThinkingFaces phase="waiting" />
            </div>
          );
        }
        return <Message key={m.id} msg={m} />;
      })}
      <div ref={bottomRef} />
    </div>
  );
}
