import { useMemo } from "react";
import { pickRow, type Face } from "../data/faces";

export function ThinkingFaces({
  phase,
  seed,
}: {
  phase: "waiting" | "streaming";
  seed?: number;
}) {
  const row = useMemo<Face[]>(() => pickRow(seed), [seed]);

  if (phase === "streaming") {
    return (
      <div style={{ color: "var(--gold)" }} className="font-mono text-sm py-2">
        Trump is winning…
      </div>
    );
  }

  return (
    <div className="flex gap-2 py-3" data-testid="thinking-row">
      {row.map((f, i) => (
        <div key={i} className="flex-1 text-center">
          <img
            src={f.src}
            alt=""
            className="tc-bob inline-block"
            style={{
              height: 72,
              imageRendering: "pixelated",
              animationDelay: `${i * 0.12}s`,
            }}
          />
          <div style={{ color: "var(--muted)" }} className="text-[10px] mt-2">
            ( {f.caption} )
          </div>
        </div>
      ))}
    </div>
  );
}
