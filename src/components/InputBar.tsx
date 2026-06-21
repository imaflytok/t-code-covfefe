import { useState, type KeyboardEvent } from "react";
import { sendMessage } from "../lib/send";

export function InputBar({
  onSend = sendMessage,
}: {
  onSend?: (text: string) => void;
}) {
  const [value, setValue] = useState("");

  const submit = () => {
    const t = value.trim();
    if (!t) return;
    onSend(t);
    setValue("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="px-6 pb-5">
      <div
        style={{ border: "1px solid var(--line)", background: "var(--panel)" }}
        className="rounded-lg px-3 py-2"
      >
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          placeholder="Ask Trump anything about code..."
          className="w-full resize-none bg-transparent outline-none"
          style={{ color: "var(--text)", fontFamily: "var(--font-mono)" }}
        />
        <div style={{ color: "var(--muted)" }} className="text-[11px] mt-1">
          You&gt; &nbsp;Enter to send · Shift+Enter for a new line
        </div>
      </div>
    </div>
  );
}
