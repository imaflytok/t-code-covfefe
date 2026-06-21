import { useEffect, useState, type ReactNode } from "react";
import { quoteAt } from "../data/quotes";
import { useSettings } from "../store/settings";
import { useChatStore } from "../store/chat";
import { getProvider } from "../providers";
import { contextPct, estimateTokens } from "../lib/tokens";

const TOOLS = ["bash", "edit", "web_fetch"];

function Label({ children }: { children: ReactNode }) {
  return (
    <div
      style={{ color: "var(--gold-dim)" }}
      className="text-[10px] tracking-[2px] mt-5 mb-1"
    >
      {children}
    </div>
  );
}

export function Sidebar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const [qi, setQi] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setQi((i) => i + 1), 12000);
    return () => clearInterval(id);
  }, []);

  const provider = useSettings((s) => s.provider);
  const model = useSettings((s) => s.model);
  const messages = useChatStore((s) => s.messages);

  const ctx =
    getProvider(provider).models.find((m) => m.id === model)?.context ?? 128000;
  const used = estimateTokens(messages.map((m) => m.content).join("\n"));
  const pct = contextPct(used, ctx);

  return (
    <div
      style={{
        width: 234,
        background: "var(--panel)",
        borderRight: "1px solid var(--line)",
      }}
      className="h-full flex flex-col px-4 py-4 text-[11px] shrink-0"
    >
      <div
        style={{ color: "var(--gold)", textShadow: "0 0 12px rgba(212,175,55,.4)" }}
        className="font-bold tracking-wider text-[14px]"
      >
        ★ TRUMP CODE ★
      </div>
      <div style={{ color: "var(--muted)" }} className="text-[9px] mb-1">
        Make Code Great Again
      </div>

      <Label>PROJECT</Label>
      <div style={{ color: "var(--text)" }}>t-code-covfefe</div>
      <div style={{ color: "var(--muted)" }}>~/trump-code</div>

      <Label>SESSION</Label>
      <div>Tokens: {used.toLocaleString()}</div>
      <div>Context: {pct}%</div>
      <div style={{ color: "var(--muted)" }}>
        {provider} · {model}
      </div>

      <Label>TOOLS</Label>
      {TOOLS.map((t) => (
        <div key={t}>• {t}</div>
      ))}

      <div className="flex-1" />

      <div
        style={{ color: "var(--muted)", borderTop: "1px solid var(--line)" }}
        className="text-[9px] italic pt-3 leading-relaxed"
      >
        {quoteAt(qi)}
      </div>

      <button
        type="button"
        onClick={onOpenSettings}
        style={{ border: "1px solid var(--line)", color: "var(--gold)" }}
        className="mt-3 rounded px-2 py-1 text-[11px] hover:opacity-80"
      >
        ⚙ Settings
      </button>
    </div>
  );
}
