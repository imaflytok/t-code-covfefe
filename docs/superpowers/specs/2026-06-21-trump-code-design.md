# Trump Code — Design Spec

**Date:** 2026-06-21
**Status:** Approved design → ready for implementation plan
**Tagline:** *Make Code Great Again*

---

## 1. Overview

Trump Code is an open-source **desktop application** (Windows + macOS) — a Trump-themed AI
coding assistant. The user brings their own provider credentials (OpenAI / Anthropic / xAI),
asks coding questions, and gets **genuinely correct, useful answers wrapped in maximum Trump
voice**, complete with the signature ASCII-Trump "thinking" faces from the reference mockup.

The personality is a *wrapper*: tone is maximally Trump (superlatives, swagger,
self-aggrandizement, catchphrases), but the underlying code and technical advice must remain
**accurate and useful**. People should be able to laugh *and* ship.

## 2. Goals / Non-goals

**Goals**
- A polished, distinctive desktop coding-chat app with strong comedic personality.
- Multi-provider: OpenAI, Anthropic, xAI — switchable.
- Two auth paths: **API key (stable)** and **OAuth login (experimental)** for Anthropic and
  ChatGPT/Codex.
- Faithful reproduction of the reference "thinking faces."
- Clean, open-source-ready repo (MIT), easy for others to build and contribute to.

**Non-goals (v1)**
- No real agentic tools (no executing `bash`/editing the user's filesystem). The mockup's
  `TOOLS` sidebar is **themed status flavor**, not functional tooling.
- No web/SSR deployment target (desktop only; UI is kept portable but not a shipped web build).
- No mobile.
- No multi-user/cloud sync.

## 3. Platform & stack

- **Shell:** Tauri v2 (Rust core + OS native webview). Small installers, secure by default,
  native HTTP (no CORS), first-class OAuth/keychain support.
- **Frontend:** React + Vite + TypeScript, **Tailwind** with CSS variables for theming,
  **Zustand** for state.
- **Markdown/code:** `react-markdown` + `remark-gfm`; syntax highlighting via `rehype-highlight`
  (highlight.js) with a gold-tinted theme; per-block **copy button**.
- **Targets:** Windows (`.msi`/`.exe` via WiX/NSIS) and macOS (`.dmg`/`.app`). Code signing
  documented as a release step (unsigned dev builds are fine).

## 4. High-level architecture

```
┌─────────────────────────── Tauri app ───────────────────────────┐
│  Webview (React UI)                                              │
│    components, Zustand stores, provider client (TS interface)    │
│        │  invoke() / Channel events                              │
│        ▼                                                         │
│  Rust core (commands)                                            │
│    • chat_stream(provider, model, messages, auth) -> Channel     │
│    • oauth_login(provider) / oauth_logout / oauth_status         │
│    • secret_set/get/delete  (OS keychain via `keyring`)          │
│    • native HTTPS to provider APIs (reqwest, streaming SSE)      │
└──────────────────────────────────────────────────────────────────┘
```

**Why the network calls live in Rust:** native HTTP bypasses browser CORS entirely and keeps
secrets out of the webview. The Rust side streams provider tokens back to the UI over a
`tauri::ipc::Channel`.

## 5. Provider layer

A single TypeScript interface in the UI, backed by Rust adapters:

```ts
interface ChatProvider {
  id: 'openai' | 'anthropic' | 'xai';
  streamChat(req: ChatRequest, onToken: (t: string) => void): Promise<ChatResult>;
  listModels(): ModelInfo[];
}
```

- **OpenAI / xAI:** OpenAI-compatible `/v1/chat/completions`, SSE streaming.
- **Anthropic:** `/v1/messages`, SSE streaming (native HTTP, so the browser-access header is
  irrelevant). Exact model IDs/params verified against the **claude-api** reference at build time.
- **Default models** (configurable; verified at build):
  - OpenAI: `gpt-4o` (alts: `gpt-4o-mini`, o-series)
  - Anthropic: `claude-sonnet-4-6` (alts: `claude-opus-4-8`, `claude-haiku-4-5`)
  - xAI: latest Grok (e.g. `grok-2`/`grok-3`)

### Auth strategy (per provider)

```ts
type AuthStrategy =
  | { kind: 'apiKey'; key: string }       // stored in OS keychain
  | { kind: 'oauth'; tokens: TokenSet };  // stored in OS keychain
```

## 6. Authentication

**API keys — stable, supported, ToS-clean.** Entered in Settings, stored in the **OS keychain**
(Windows Credential Manager / macOS Keychain via the `keyring` crate). Never written to disk in
plaintext, never in the JSON store.

**OAuth — experimental, opt-in.** For **Anthropic** and **ChatGPT/Codex** logins:
- Flow: app starts a temporary **loopback HTTP listener** on a random localhost port →
  opens the **system browser** to the provider's authorize URL (PKCE) → captures the redirect
  code → exchanges for tokens natively → stores tokens in the keychain → auto-refreshes.
- This is the same loopback-redirect pattern Claude Code and Codex CLI use.

> **⚠️ Honesty / ToS:** These subscription OAuth logins are **first-party flows used
> unofficially** by a third-party app. They may change or break without notice, and using
> subscription auth this way is a **ToS gray area** that could flag accounts. The README and the
> in-app OAuth screen will warn loudly. **API keys are the default and recommended path.** OAuth
> is clearly labeled "experimental — use at your own risk."

## 7. Signature feature — ASCII Trump "thinking" faces

- The 10 reference faces (2 sets of 5) are **extracted pixel-perfect from the user's reference
  art**, background keyed to transparent. Shipped as bundled image assets (a sprite sheet or
  per-face PNGs under `assets/faces/`). Conversion to live-text ASCII was evaluated and rejected:
  the reference is low-res rasterized ASCII, so re-conversion degrades it — **sprites are the
  faithful artifact.**
- `ThinkingFaces` component: while awaiting the first token, shows a **row of 5 faces chosen
  from the library** with their captions (Set 1 = "answering", Set 2 = "appraising the
  question"); subtle bob animation. On first streamed token it collapses to a single inline
  status line.
- Caption sets:
  - **Set 1:** thinking… / tremendous thinking… / very busy… making it perfect / this is easy.
    believe me. / almost done… it's going to be beautiful
  - **Set 2:** very smart question / one of the best questions ever / people don't ask this…
    sad! / I know the best answer. always. / here it comes… huge answer

## 8. Trump personality

- **System prompt:** maximal Trump voice with a hard rule that code and technical content stay
  correct and useful. Lives in `data/systemPrompt.ts`, versioned and easy to tune.
- **Flourishes (all included in v1):**
  - **Rotating sidebar quotes** — a library of Trump-style coding quotes cycles in the sidebar.
  - **"PRO TIP" callouts** — occasional Trump-voiced tip boxes after answers (as in the mockup).
  - **Rates your question/code** — grades the user's input ("tremendous question", "one of the
    best") and can appraise code quality ("tremendous" / "total disaster, sad"). Driven by the
    system prompt.
  - **Easter eggs** — slash commands incl. `/covfefe`, `/executive-order` (mock decree), plus
    utility commands below.

## 9. UI / layout (Mar-a-Lago Gold theme)

Black + glowing gold (chosen direction "B"). Window chrome native to each OS.

- **Sidebar:** ★ TRUMP CODE ★ logo + "Make Code Great Again" • PROJECT/SESSION info • token
  count + context % • themed TOOLS list (flavor) • rotating quote.
- **Main:** welcome/help bar • scrolling message list (user + Trump messages, syntax-highlighted
  code blocks with copy buttons, PRO TIP boxes, the thinking-faces row) • input box (textarea,
  Enter to send, Shift+Enter for newline).

## 10. Persistence

- **Sessions & settings:** local app-data dir as JSON via `tauri-plugin-store` — **multiple
  saved sessions** listed in the sidebar (id, title, createdAt, messages), plus app settings
  (active provider, model, auth mode, theme).
- **Secrets (API keys, OAuth tokens):** OS keychain only — never in the JSON store.
- **Counters:** best-effort token count (lightweight tokenizer/heuristic) and context % vs the
  selected model's window.

## 11. Slash commands

`/help`, `/clear`, `/model` (switch model/provider), `/login` (start OAuth), `/covfefe`,
`/executive-order`. Commands are intercepted client-side before any API call.

## 12. Error handling

Provider/network errors surfaced in **Trump voice**, e.g. missing key →
*"You forgot the key, folks. Nobody makes great code without the key. Sad!"* Covers: missing/
invalid credentials, network failures, rate limits, and stream-parse errors. Errors render as a
Trump message or a toast; never a raw stack trace.

## 13. Security considerations

- Secrets in OS keychain; never logged, never in the store file.
- All provider traffic is HTTPS from the Rust core.
- Tauri allowlist/capabilities locked to the minimum (http to provider hosts, keychain, shell
  open for OAuth, deep-link/loopback).
- OAuth ToS risk documented (§6).

## 14. Testing strategy

- **Unit (Vitest):** provider adapters (mocked transport, incl. SSE parsing), command parser,
  system-prompt builder, storage/session logic, token/context estimator.
- **Component (React Testing Library):** message rendering, code block + copy, thinking-faces
  state transitions, input behavior (Enter vs Shift+Enter).
- **Rust:** unit tests for OAuth PKCE helpers and the streaming command (mocked HTTP).
- **E2E (Playwright on the webview, or Tauri's WebDriver):** one smoke test of a full
  ask→stream→render flow against a mocked provider.

## 15. Build & distribution

- `npm run tauri dev` for development; `npm run tauri build` for installers.
- Windows: `.msi`/NSIS `.exe`. macOS: `.dmg`. Code signing + notarization (macOS) documented as
  release steps; CI via GitHub Actions matrix (windows-latest, macos-latest).

## 16. Open-source

- **MIT license.** README with screenshots/GIF, build instructions, the OAuth experimental
  warning, and contributing notes. No secrets ever committed. Issue/PR templates optional.

## 17. Repo structure (proposed)

```
trump-code/
  src/                      # React UI
    components/             # Sidebar, MessageList, Message, CodeBlock, ProTip,
                            #   ThinkingFaces, InputBar, SettingsModal
    providers/              # openai.ts, anthropic.ts, xai.ts, index.ts (TS client wrappers)
    store/                  # settings, sessions, chat (Zustand)
    data/                   # systemPrompt, quotes, protips, commands, faces (sprite manifest)
    theme/                  # gold theme tokens
  assets/faces/             # extracted face sprites (set1_0..4, set2_0..4)
  src-tauri/                # Rust core
    src/                    # commands: chat_stream, oauth_*, secret_*
    capabilities/           # locked-down permissions
  docs/superpowers/specs/   # this spec
  .github/workflows/        # build matrix
```

## 18. Build order (high level — detailed plan next)

1. Scaffold Tauri + React/Vite/TS/Tailwind; gold theme; base layout from mockup.
2. Provider layer + Rust `chat_stream` (API-key path first) for one provider, end-to-end stream.
3. Message UI: markdown, code blocks + copy, input, streaming render.
4. Thinking-faces component + sprite assets.
5. System prompt + flourishes (quotes, PRO TIP, ratings, easter-egg commands).
6. Sessions/settings persistence + keychain secrets; all three providers.
7. OAuth (experimental) for Anthropic + ChatGPT/Codex.
8. Errors, polish, tests, packaging/signing, README.

## 19. Future / out of scope for now

- Optional real tools (sandboxed code run, web fetch).
- Web build (BYO-key only).
- SQLite if session volume warrants it.
- Themes beyond Gold (the faces would need recolored sprite variants).
