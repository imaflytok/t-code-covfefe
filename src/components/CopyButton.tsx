import { useState } from "react";

export function CopyButton({ getText }: { getText: () => string }) {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(getText());
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <button
      type="button"
      aria-label="copy code"
      onClick={onClick}
      style={{
        background: "rgba(212,175,55,.12)",
        color: "var(--gold)",
        border: "1px solid var(--line)",
        borderRadius: 6,
        fontSize: 11,
        padding: "2px 8px",
        cursor: "pointer",
      }}
    >
      {copied ? "copied ✓" : "copy"}
    </button>
  );
}
