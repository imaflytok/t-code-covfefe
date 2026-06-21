import { useState } from "react";
import { useSettings } from "../store/settings";
import { allProviders, getProvider } from "../providers";
import type { ProviderId } from "../types";

/** Providers that support an OAuth subscription login. */
const OAUTH_CAPABLE: ProviderId[] = ["openai", "anthropic"];

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const {
    provider,
    model,
    keys,
    authMode,
    oauthConnected,
    setProvider,
    setModel,
    setKey,
    setAuthMode,
    loginOauth,
    logoutOauth,
  } = useSettings();
  const [keyInput, setKeyInput] = useState(keys[provider] ?? "");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [oauthError, setOauthError] = useState("");

  const mode = authMode[provider] ?? "apiKey";
  const canOauth = OAUTH_CAPABLE.includes(provider);
  const connected = !!oauthConnected[provider];

  const onProvider = (p: ProviderId) => {
    setProvider(p);
    setKeyInput(useSettings.getState().keys[p] ?? "");
    setSaved(false);
    setOauthError("");
  };

  const onLogin = async () => {
    setBusy(true);
    setOauthError("");
    try {
      await loginOauth(provider);
    } catch (e) {
      setOauthError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const onLogout = async () => {
    setBusy(true);
    setOauthError("");
    try {
      await logoutOauth(provider);
    } catch (e) {
      setOauthError(String(e));
    } finally {
      setBusy(false);
    }
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
          AUTH
        </div>
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => setAuthMode(provider, "apiKey")}
            style={{
              border: "1px solid var(--line)",
              background:
                mode === "apiKey" ? "rgba(212,175,55,.15)" : "transparent",
              color: mode === "apiKey" ? "var(--gold)" : "var(--text)",
            }}
            className="rounded px-3 py-1 text-xs"
          >
            API Key
          </button>
          <button
            type="button"
            disabled={!canOauth}
            onClick={() => canOauth && setAuthMode(provider, "oauth")}
            style={{
              border: "1px solid var(--line)",
              background:
                mode === "oauth" ? "rgba(212,175,55,.15)" : "transparent",
              color: !canOauth
                ? "var(--muted)"
                : mode === "oauth"
                  ? "var(--gold)"
                  : "var(--text)",
              opacity: canOauth ? 1 : 0.5,
            }}
            className="rounded px-3 py-1 text-xs"
          >
            OAuth (Subscription)
          </button>
        </div>

        {mode === "apiKey" ? (
          <>
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
              className="w-full rounded px-2 py-1 text-sm mb-4 font-mono"
            />
          </>
        ) : (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              {connected ? (
                <>
                  <span style={{ color: "var(--gold)" }} className="text-xs">
                    Connected ✓
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={onLogout}
                    style={{ border: "1px solid var(--line)", color: "var(--text)" }}
                    className="rounded px-3 py-1 text-xs"
                  >
                    {busy ? "…" : "Sign out"}
                  </button>
                </>
              ) : (
                <>
                  <span style={{ color: "var(--muted)" }} className="text-xs">
                    Not connected
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={onLogin}
                    style={{ background: "var(--gold)", color: "#1a1206" }}
                    className="rounded px-3 py-1 text-xs font-bold"
                  >
                    {busy
                      ? "Opening browser…"
                      : provider === "openai"
                        ? "Sign in with ChatGPT"
                        : "Sign in with Claude"}
                  </button>
                </>
              )}
            </div>
            <div
              style={{
                color: "var(--gold)",
                border: "1px solid var(--line)",
                background: "rgba(212,175,55,.08)",
              }}
              className="text-[10px] rounded px-2 py-1.5 leading-relaxed"
            >
              ⚠ OAuth sign-in is experimental and uses your{" "}
              {provider === "openai" ? "ChatGPT" : "Claude"} subscription rather
              than a metered API key. The token is stored in your OS keychain.
            </div>
            {oauthError && (
              <div className="text-[10px] mt-2" style={{ color: "#ff6b6b" }}>
                {oauthError}
              </div>
            )}
          </div>
        )}

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
