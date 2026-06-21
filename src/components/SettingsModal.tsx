import { useState } from "react";
import { useSettings } from "../store/settings";
import { allProviders, getProvider } from "../providers";
import type { ProviderId } from "../types";

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { provider, model, keys, setProvider, setModel, setKey } = useSettings();
  const [keyInput, setKeyInput] = useState(keys[provider] ?? "");
  const [saved, setSaved] = useState(false);

  const onProvider = (p: ProviderId) => {
    setProvider(p);
    setKeyInput(useSettings.getState().keys[p] ?? "");
    setSaved(false);
  };

  const onSave = async () => {
    if (keyInput.trim()) await setKey(provider, keyInput.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: "rgba(0,0,0,.6)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--panel)",
          border: "1px solid var(--line)",
          width: 460,
        }}
        className="rounded-xl p-6"
      >
        <div
          style={{ color: "var(--gold)" }}
          className="font-bold text-lg mb-4"
        >
          ⚙ Settings
        </div>

        <div style={{ color: "var(--muted)" }} className="text-xs mb-1">
          PROVIDER
        </div>
        <div className="flex gap-2 mb-4">
          {allProviders().map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onProvider(p.id)}
              style={{
                border: "1px solid var(--line)",
                background:
                  provider === p.id ? "rgba(212,175,55,.15)" : "transparent",
                color: provider === p.id ? "var(--gold)" : "var(--text)",
              }}
              className="rounded px-3 py-1 text-xs"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div style={{ color: "var(--muted)" }} className="text-xs mb-1">
          MODEL
        </div>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          style={{
            background: "var(--code-bg)",
            border: "1px solid var(--line)",
            color: "var(--text)",
          }}
          className="w-full rounded px-2 py-1 text-sm mb-4"
        >
          {getProvider(provider).models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>

        <div style={{ color: "var(--muted)" }} className="text-xs mb-1">
          API KEY ({provider}) — stored in your OS keychain
        </div>
        <input
          type="password"
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          placeholder="sk-..."
          style={{
            background: "var(--code-bg)",
            border: "1px solid var(--line)",
            color: "var(--text)",
          }}
          className="w-full rounded px-2 py-1 text-sm mb-2 font-mono"
        />

        <div
          style={{ color: "var(--muted)" }}
          className="text-[10px] mb-4 leading-relaxed"
        >
          OAuth login (Anthropic / ChatGPT) is experimental and coming soon —
          API keys are the recommended path.
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            style={{ color: "var(--muted)" }}
            className="px-3 py-1 text-sm"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onSave}
            style={{
              background: "var(--gold)",
              color: "#1a1206",
            }}
            className="rounded px-4 py-1 text-sm font-bold"
          >
            {saved ? "Saved ✓" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
