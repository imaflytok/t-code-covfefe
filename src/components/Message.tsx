import { useRef, type ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/atom-one-dark.css";
import { CopyButton } from "./CopyButton";
import { ProTip } from "./ProTip";
import { extractProTip } from "../data/protips";
import type { ChatMessage } from "../types";

function Pre(props: ComponentPropsWithoutRef<"pre">) {
  const ref = useRef<HTMLPreElement>(null);
  return (
    <div className="relative my-3">
      <div className="absolute right-2 top-2 z-10">
        <CopyButton getText={() => ref.current?.textContent ?? ""} />
      </div>
      <pre
        ref={ref}
        {...props}
        style={{
          background: "var(--code-bg)",
          border: "1px solid var(--line)",
          borderRadius: 8,
          padding: "12px 14px",
          overflowX: "auto",
          fontSize: 13,
        }}
      />
    </div>
  );
}

export function Message({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  const tip = isUser ? null : extractProTip(msg.content);
  const body = tip
    ? msg.content.replace(/^\s*PRO TIP:.*$/im, "").trimEnd()
    : msg.content;

  return (
    <div className="mb-5">
      <div
        style={{ color: isUser ? "var(--user)" : "var(--gold)" }}
        className="font-bold mb-1"
      >
        {isUser ? "You>" : "Trump>"}
      </div>
      <div className="tc-md leading-relaxed" style={{ fontSize: 15 }}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={{ pre: Pre }}
        >
          {body || (isUser ? "" : "…")}
        </ReactMarkdown>
      </div>
      {tip && <ProTip text={tip} />}
    </div>
  );
}
