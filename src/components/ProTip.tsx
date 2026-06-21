export function ProTip({ text }: { text: string }) {
  return (
    <div
      style={{
        borderLeft: "3px solid var(--gold)",
        background: "rgba(212,175,55,.08)",
      }}
      className="mt-3 rounded-r px-3 py-2 text-sm"
    >
      <span style={{ color: "var(--gold)" }} className="font-bold">
        🦅 PRO TIP:{" "}
      </span>
      <span style={{ color: "var(--muted)" }}>{text}</span>
    </div>
  );
}
