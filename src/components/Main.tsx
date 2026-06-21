import { MessageList } from "./MessageList";
import { InputBar } from "./InputBar";

export function Main() {
  return (
    <div className="flex-1 flex flex-col min-w-0 h-full">
      <div
        style={{ borderBottom: "1px solid var(--line)", color: "var(--gold)" }}
        className="px-6 py-3 text-sm shrink-0"
      >
        ★ Welcome to Trump Code (Make Code Great Again Edition) — type your
        request or try <code>/help</code>
      </div>
      <MessageList />
      <InputBar />
    </div>
  );
}
