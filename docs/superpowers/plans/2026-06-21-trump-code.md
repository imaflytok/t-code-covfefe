# Trump Code Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Trump Code — a Tauri desktop app (Windows + macOS) that is a Trump-themed, multi-provider AI coding assistant with the signature ASCII-Trump thinking faces.

**Architecture:** React+TS webview inside a Tauri v2 shell. All network + secrets handling lives in the Rust core (native HTTP = no CORS, OS keychain for secrets). Provider streaming is bridged to the UI via a Tauri `Channel`. Personality is a system-prompt wrapper over genuinely-correct answers.

**Tech Stack:** Tauri v2 (Rust), React 18 + Vite + TypeScript, Tailwind, Zustand, react-markdown + rehype-highlight, Vitest + React Testing Library, reqwest (Rust), keyring (Rust), tauri-plugin-store.

---

## File Structure

```
trump-code/
  src/
    main.tsx, App.tsx
    theme/gold.css                      # CSS variables for Mar-a-Lago Gold
    types.ts                            # ChatMessage, Provider, ModelInfo, etc.
    providers/
      types.ts                          # ChatProvider interface, request/result types
      sse.ts                            # SSE/event-stream line parser (pure, tested)
      openai.ts  xai.ts  anthropic.ts   # request builders + chunk decoders (pure, tested)
      index.ts                          # provider registry + streamChat dispatcher (calls Rust)
    store/
      settings.ts  sessions.ts  chat.ts # Zustand stores
    data/
      systemPrompt.ts                   # Trump persona prompt builder
      quotes.ts  protips.ts             # static libraries
      commands.ts                       # slash-command parser (pure, tested)
      faces.ts                          # sprite manifest + caption sets
    components/
      Sidebar.tsx  Main.tsx
      MessageList.tsx  Message.tsx  CodeBlock.tsx  ProTip.tsx
      ThinkingFaces.tsx  InputBar.tsx  SettingsModal.tsx
    lib/tokens.ts                       # token/context estimator (pure, tested)
  assets/faces/                         # set1_0..4.png, set2_0..4.png (already committed)
  src-tauri/
    src/main.rs  lib.rs
    src/chat.rs                         # chat_stream command (reqwest SSE -> Channel)
    src/secrets.rs                      # keyring get/set/delete commands
    src/oauth.rs                        # loopback PKCE flow (Phase 7)
    tauri.conf.json  capabilities/default.json  Cargo.toml
  README.md
  .github/workflows/build.yml
```

---

## Phase 0 — Scaffold

### Task 0.1: Scaffold Vite React-TS app into the repo

**Files:** Create `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`.

- [ ] **Step 1:** Scaffold Vite (the dir already has `docs/`, `assets/`, `.git`):
  ```bash
  npm create vite@latest . -- --template react-ts
  # if prompted about non-empty dir, choose "Ignore files and continue"
  npm install
  ```
- [ ] **Step 2:** Verify dev server boots: `npm run dev` → open the printed URL, see the Vite splash. Ctrl-C.
- [ ] **Step 3:** Commit: `git add -A && git commit -m "chore: scaffold vite react-ts app"`

### Task 0.2: Add Tauri v2

- [ ] **Step 1:** `npm install -D @tauri-apps/cli@^2 && npm install @tauri-apps/api@^2`
- [ ] **Step 2:** `npx tauri init` — app name `Trump Code`, window title `Trump Code`, frontend dev URL `http://localhost:5173`, dev command `npm run dev`, build command `npm run build`, dist dir `../dist`.
- [ ] **Step 3:** Add scripts to `package.json`: `"tauri": "tauri"`. Run `npx tauri dev` once to confirm the native window opens with the Vite app. (First run compiles Rust — slow.)
- [ ] **Step 4:** Commit: `git add -A && git commit -m "chore: add tauri v2 shell"`

### Task 0.3: Tailwind + Vitest + RTL

- [ ] **Step 1:** `npm install -D tailwindcss @tailwindcss/postcss postcss autoprefixer vitest @testing-library/react @testing-library/jest-dom jsdom`
- [ ] **Step 2:** Configure Tailwind (`tailwind.config.js` content globs to `./index.html`, `./src/**/*.{ts,tsx}`), add directives to `src/index.css`.
- [ ] **Step 3:** Add `vitest` config (environment `jsdom`, setup file importing `@testing-library/jest-dom`), and `"test": "vitest"` script.
- [ ] **Step 4:** Write a trivial passing test `src/smoke.test.ts` (`expect(1+1).toBe(2)`), run `npm test -- --run`, expect PASS.
- [ ] **Step 5:** Commit: `git add -A && git commit -m "chore: tailwind + vitest"`

---

## Phase 1 — Theme & layout

### Task 1.1: Mar-a-Lago Gold theme tokens

**Files:** Create `src/theme/gold.css`; import in `main.tsx`.

- [ ] **Step 1:** Define CSS variables on `:root`:
  ```css
  :root{
    --bg:#0c0a07; --panel:#15110a; --line:rgba(212,175,55,.25);
    --gold:#e8c352; --gold-dim:#b9962f; --skin:#efe2c2; --text:#e9e2d0;
    --muted:#bfae7a; --user:#c9a227; --code-bg:#080705;
    --font-mono:"Cascadia Code",Consolas,"SF Mono",monospace;
  }
  body{background:var(--bg);color:var(--text);font-family:var(--font-mono);}
  ```
- [ ] **Step 2:** Render a full-bleed black window with gold text "★ TRUMP CODE ★" to confirm theme loads. Commit.

### Task 1.2: App shell — Sidebar + Main split

**Files:** Create `src/components/Sidebar.tsx`, `src/components/Main.tsx`; modify `src/App.tsx`.

- [ ] **Step 1:** `App.tsx` renders a flex row: `<Sidebar/>` (fixed ~230px) + `<Main/>` (flex-1).
- [ ] **Step 2:** `Sidebar`: logo + "Make Code Great Again", PROJECT/SESSION placeholders, TOOLS list (bash/edit/web_fetch as flavor), a quote slot. `Main`: header welcome bar, empty message area, input placeholder. Style with the theme to match the mockup.
- [ ] **Step 3:** Visual check via `npx tauri dev`. Commit: `git commit -am "feat: app shell + gold theme"`

---

## Phase 2 — Provider layer + streaming (API-key path, OpenAI first)

### Task 2.1: Core types

**Files:** Create `src/types.ts`, `src/providers/types.ts`.

- [ ] **Step 1:** Define:
  ```ts
  // src/types.ts
  export type Role = 'user' | 'assistant' | 'system';
  export interface ChatMessage { id: string; role: Role; content: string; }
  export type ProviderId = 'openai' | 'anthropic' | 'xai';
  export interface ModelInfo { id: string; label: string; context: number; }
  ```
  ```ts
  // src/providers/types.ts
  import { ChatMessage, ModelInfo, ProviderId } from '../types';
  export interface ChatRequest { model: string; messages: ChatMessage[]; system: string; }
  export interface ProviderSpec {
    id: ProviderId; label: string; models: ModelInfo[];
    endpoint: string;
    buildBody(req: ChatRequest): unknown;
    buildHeaders(apiKey: string): Record<string,string>;
    decodeChunk(json: unknown): string;     // returns text delta or ''
    isDone(line: string): boolean;
  }
  ```
- [ ] **Step 2:** Commit.

### Task 2.2: SSE line parser (TDD)

**Files:** Create `src/providers/sse.ts`, `src/providers/sse.test.ts`.

- [ ] **Step 1: Failing test:**
  ```ts
  import { parseSSE } from './sse';
  test('extracts data payloads, skips comments/blank, stops at [DONE]', () => {
    const chunk = 'data: {"a":1}\n\n: ping\n\ndata: [DONE]\n\n';
    const { events, done } = parseSSE(chunk);
    expect(events).toEqual(['{"a":1}']);
    expect(done).toBe(true);
  });
  ```
- [ ] **Step 2:** Run `npm test -- --run src/providers/sse.test.ts` → FAIL.
- [ ] **Step 3: Implement** `parseSSE(buffer: string): {events: string[]; done: boolean; rest: string}` — split on `\n`, collect `data: ` lines, treat `[DONE]` as done, return trailing partial line as `rest`.
- [ ] **Step 4:** Run test → PASS. Commit.

### Task 2.3: OpenAI provider spec (TDD)

**Files:** Create `src/providers/openai.ts`, `src/providers/openai.test.ts`.

- [ ] **Step 1: Failing test:**
  ```ts
  import { openai } from './openai';
  test('builds chat body + decodes delta', () => {
    const body:any = openai.buildBody({model:'gpt-4o', system:'sys',
      messages:[{id:'1',role:'user',content:'hi'}]});
    expect(body.model).toBe('gpt-4o');
    expect(body.stream).toBe(true);
    expect(body.messages[0]).toEqual({role:'system',content:'sys'});
    expect(openai.decodeChunk(JSON.parse('{"choices":[{"delta":{"content":"Yo"}}]}'))).toBe('Yo');
  });
  ```
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement** `openai` ProviderSpec: endpoint `https://api.openai.com/v1/chat/completions`; body `{model, stream:true, messages:[{role:'system',content:system}, ...messages.map(m=>({role:m.role,content:m.content}))]}`; headers `{Authorization:`Bearer ${key}`,'Content-Type':'application/json'}`; `decodeChunk` reads `choices[0].delta.content ?? ''`. Models: gpt-4o (128000), gpt-4o-mini (128000).
- [ ] **Step 4:** Run → PASS. Commit.

### Task 2.4: xAI + Anthropic specs (TDD)

**Files:** `src/providers/xai.ts` (+test), `src/providers/anthropic.ts` (+test).

- [ ] **Step 1:** xAI test mirrors OpenAI (endpoint `https://api.x.ai/v1/chat/completions`, OpenAI-compatible). Implement by reusing an `openAICompatible(endpoint, models)` factory to stay DRY. Models: `grok-2` (131072).
- [ ] **Step 2:** Anthropic test: body `{model, stream:true, max_tokens:4096, system, messages:[{role,content}] (user/assistant only)}`; endpoint `https://api.anthropic.com/v1/messages`; headers `{'x-api-key':key,'anthropic-version':'2023-06-01','content-type':'application/json'}`; `decodeChunk` handles `{"type":"content_block_delta","delta":{"text":"..."}}` → text. **At build time consult the `claude-api` skill** to confirm current model IDs (e.g. `claude-sonnet-4-6`), `anthropic-version`, and event shapes. Models: `claude-sonnet-4-6`, `claude-opus-4-8`, `claude-haiku-4-5`.
- [ ] **Step 3:** Run tests → PASS. Commit.

### Task 2.5: Rust `chat_stream` command

**Files:** Create `src-tauri/src/chat.rs`; modify `src-tauri/src/lib.rs`, `Cargo.toml`.

- [ ] **Step 1:** Add deps to `Cargo.toml`: `reqwest = { version="0.12", features=["json","stream"] }`, `tokio = { version="1", features=["full"] }`, `serde`, `serde_json`, `futures-util`.
- [ ] **Step 2:** Implement command:
  ```rust
  #[derive(serde::Deserialize)]
  pub struct ChatArgs { url:String, headers:std::collections::HashMap<String,String>, body:serde_json::Value }
  #[tauri::command]
  pub async fn chat_stream(args: ChatArgs, on_event: tauri::ipc::Channel<String>) -> Result<(), String> {
    let client = reqwest::Client::new();
    let mut req = client.post(&args.url).json(&args.body);
    for (k,v) in args.headers { req = req.header(k, v); }
    let resp = req.send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
      let s = resp.status(); let t = resp.text().await.unwrap_or_default();
      return Err(format!("{}: {}", s, t));
    }
    use futures_util::StreamExt;
    let mut stream = resp.bytes_stream();
    while let Some(chunk) = stream.next().await {
      let bytes = chunk.map_err(|e| e.to_string())?;
      on_event.send(String::from_utf8_lossy(&bytes).to_string()).map_err(|e| e.to_string())?;
    }
    Ok(())
  }
  ```
- [ ] **Step 3:** Register in `lib.rs` `invoke_handler![chat_stream]`. Build via `npx tauri dev` (compiles). Commit.

### Task 2.6: TS dispatcher wiring Rust ↔ provider specs

**Files:** Create `src/providers/index.ts`.

- [ ] **Step 1:** Implement `streamChat(providerId, apiKey, req, onToken)`:
  ```ts
  import { Channel, invoke } from '@tauri-apps/api/core';
  // pick spec, build url/headers/body, create Channel<string>,
  // accumulate raw text -> parseSSE -> spec.decodeChunk -> onToken(delta)
  ```
  Maintain a rolling buffer across channel messages, feed through `parseSSE`, JSON.parse each event, call `spec.decodeChunk`, emit non-empty deltas, stop on done.
- [ ] **Step 2:** Manual smoke: temporary button in `App.tsx` that calls `streamChat('openai', <test key from env>, {...})` and logs tokens. Confirm streaming in the Tauri window console. Remove the temp button. Commit.

---

## Phase 3 — Message UI

### Task 3.1: chat store (TDD)

**Files:** `src/store/chat.ts` (+test).

- [ ] **Step 1: Failing test:** create store, `addUserMessage('hi')` adds a user msg + an empty assistant msg with `streaming:true`; `appendToken('x')` appends to the last assistant msg; `endStream()` clears streaming flag.
- [ ] **Step 2:** Implement Zustand store with `messages`, `addUserMessage`, `appendToken`, `endStream`, `setError`. Run test → PASS. Commit.

### Task 3.2: Message + CodeBlock + copy

**Files:** `src/components/Message.tsx`, `CodeBlock.tsx`, `MessageList.tsx`.

- [ ] **Step 1:** Install `react-markdown remark-gfm rehype-highlight highlight.js`.
- [ ] **Step 2:** `CodeBlock`: renders highlighted code with a gold "copy" button (writes to clipboard, shows "copied ✓"). Test: render, click copy, assert `navigator.clipboard.writeText` called.
- [ ] **Step 3:** `Message`: user vs Trump styling (`You>` blue-gold / `Trump>` gold). Markdown via react-markdown with `rehype-highlight`, code fences routed to `CodeBlock`. `MessageList` maps the store.
- [ ] **Step 4:** Visual check + commit.

### Task 3.3: InputBar

**Files:** `src/components/InputBar.tsx`.

- [ ] **Step 1:** Textarea: Enter submits, Shift+Enter newline; on submit → `addUserMessage`, then call `streamChat` with `appendToken`/`endStream`. Placeholder "Ask Trump anything about code…".
- [ ] **Step 2:** Test the keydown logic (Enter calls onSubmit, Shift+Enter does not). Commit.

---

## Phase 4 — Thinking faces

### Task 4.1: faces manifest

**Files:** `src/data/faces.ts`; ensure `assets/faces/*` import.

- [ ] **Step 1:** Export `SET1`/`SET2` arrays of `{src, caption}` (import the 10 PNGs via Vite asset imports). Captions per spec §7.
- [ ] **Step 2:** Pure helper `pickFaces(set, n=5)` returns n faces with their captions (sequential for the 5-caption rows). Test it. Commit.

### Task 4.2: ThinkingFaces component

**Files:** `src/components/ThinkingFaces.tsx`.

- [ ] **Step 1:** Props `{phase:'waiting'|'streaming'}`. When `waiting`: render a row of 5 sprites + captions (bob animation). When `streaming`: inline status "Trump is winning…". Drive from chat store (assistant msg streaming + no tokens yet → waiting; tokens arrived → collapse).
- [ ] **Step 2:** Test the state transition (waiting shows 5 imgs; streaming shows status). Wire into `MessageList`. Commit.

---

## Phase 5 — Personality

### Task 5.1: system prompt builder (TDD)

**Files:** `src/data/systemPrompt.ts` (+test).

- [ ] **Step 1: Failing test:** `buildSystemPrompt()` returns a string containing the persona rules AND the hard correctness rule (assert it includes "must" + "correct"/"accurate").
- [ ] **Step 2:** Implement: maximal-Trump voice instructions (superlatives, catchphrases, self-aggrandizement, rate the user's question, occasional PRO TIP) + explicit rule: *code and technical content must be correct and genuinely useful; never sacrifice accuracy for the bit.* Run → PASS. Commit.

### Task 5.2: slash-command parser (TDD)

**Files:** `src/data/commands.ts` (+test).

- [ ] **Step 1: Failing test:**
  ```ts
  import { parseCommand } from './commands';
  expect(parseCommand('/covfefe')).toEqual({cmd:'covfefe', arg:''});
  expect(parseCommand('hello')).toBeNull();
  expect(parseCommand('/model gpt-4o')).toEqual({cmd:'model', arg:'gpt-4o'});
  ```
- [ ] **Step 2:** Implement parser + a `runCommand` map: `/help`, `/clear`, `/model`, `/login`, `/covfefe` (returns a covfefe gag message), `/executive-order` (mock decree generator). Commands return either a local assistant message or an action. Run → PASS. Commit.

### Task 5.3: quotes, protips, ratings wiring

**Files:** `src/data/quotes.ts`, `src/data/protips.ts`; modify `Sidebar.tsx`, `Message.tsx`.

- [ ] **Step 1:** `quotes.ts` (≥10 Trump-style coding quotes); Sidebar rotates one every ~12s. `protips.ts` library; `ProTip` box shown when a Trump message contains a `PRO TIP:` marker (the system prompt emits these inline) — parse and render as a gold callout. Test the rotation hook + protip extraction. Commit.

---

## Phase 6 — Persistence + all providers + secrets

### Task 6.1: secrets in keychain (Rust)

**Files:** `src-tauri/src/secrets.rs`; modify `lib.rs`, `Cargo.toml`.

- [ ] **Step 1:** Add `keyring = "3"` dep. Commands `secret_set(service,account,value)`, `secret_get`, `secret_delete` using `keyring::Entry`. Register in invoke handler.
- [ ] **Step 2:** TS wrapper `lib/secrets.ts` (`getKey(provider)`, `setKey(provider,key)`). Commit.

### Task 6.2: settings + sessions stores

**Files:** `src/store/settings.ts`, `src/store/sessions.ts`; install `@tauri-apps/plugin-store`.

- [ ] **Step 1:** `tauri-plugin-store` for non-secret persistence (active provider, model, theme, sessions list). Keys go to keychain (Task 6.1), never the store.
- [ ] **Step 2:** `sessions` store: `newSession`, `switchSession`, `renameSession`, `deleteSession`, persisted; sidebar lists them. Tests for reducer logic (pure functions extracted). Commit.

### Task 6.3: SettingsModal + provider switching

**Files:** `src/components/SettingsModal.tsx`.

- [ ] **Step 1:** Modal: choose provider, model, enter/save API key (to keychain), auth mode. Token/context counter via `lib/tokens.ts` (estimator: ~chars/4; context% vs model.context) — TDD the estimator. Wire `/model` to it.
- [ ] **Step 2:** End-to-end: switch among OpenAI/xAI/Anthropic with real keys, confirm streaming each. Commit.

---

## Phase 7 — OAuth (experimental)

### Task 7.1: PKCE helpers (TDD, Rust)

**Files:** `src-tauri/src/oauth.rs`.

- [ ] **Step 1:** Unit-test `verifier()`/`challenge(verifier)` (S256: base64url(sha256(verifier)) with no padding). Add `sha2`, `base64`, `rand`, `tiny_http` deps.
- [ ] **Step 2:** Implement. Run `cargo test` → PASS. Commit.

### Task 7.2: loopback OAuth flow

**Files:** `src-tauri/src/oauth.rs`; `lib/oauth.ts`.

- [ ] **Step 1:** Command `oauth_login(provider)`: start a `tiny_http` loopback server on a random port, open the system browser (`tauri-plugin-shell`/`opener`) to the provider authorize URL (PKCE, redirect=`http://localhost:<port>/callback`), capture `code`, exchange for tokens, store via keychain. `oauth_status`, `oauth_logout`.
- [ ] **Step 2:** Wire Anthropic + ChatGPT/Codex provider configs (authorize/token URLs, client_id, scopes). **Mark experimental**; behind a clearly-labeled UI toggle with the ToS warning. Manual test each. Commit.

> Note: subscription OAuth endpoints/client-ids are first-party + unofficial; isolate them in one config block so they're easy to update when they change.

---

## Phase 8 — Errors, packaging, README

### Task 8.1: Trump-voiced error handling

- [ ] **Step 1:** Map error classes (missing key, 401, 429, network, stream-parse) to Trump-voiced messages (TDD the mapper). Surface as a Trump message/toast; never a raw trace. Commit.

### Task 8.2: CI build matrix

**Files:** `.github/workflows/build.yml`.

- [ ] **Step 1:** GH Actions matrix (windows-latest, macos-latest): setup node+rust, `npm ci`, `npm test -- --run`, `npx tauri build`; upload installers as artifacts. Commit.

### Task 8.3: Funny README

**Files:** `README.md`.

- [ ] **Step 1:** Write a deliberately over-the-top Trump-voiced README: hero line, screenshot/GIF slot, "Tremendous Features", install/build (Win+macOS, Rust+Node prereqs), BYO-key setup, **experimental OAuth + ToS warning**, the easter-egg commands, MIT license, contributing ("Only the best PRs. Believe me."). Commit.

### Task 8.4: Final polish

- [ ] **Step 1:** Welcome/help bar copy, empty-state, keyboard shortcuts, app icon (gold ★). Run full `npm test -- --run` + `npx tauri build` on Windows. Commit + push to `imaflytok/t-code-covfefe`.

---

## Self-Review notes
- Every spec section maps to a phase (providers→P2, faces→P4, personality→P5, persistence/secrets→P6, OAuth→P7, errors/testing/packaging/README→P8, UI/theme→P1).
- Logic units (SSE, provider specs, prompt, commands, tokens, PKCE, error map, store reducers) are TDD with concrete tests; UI/scaffold are concrete build tasks.
- Type names consistent (`ProviderSpec`, `ChatRequest`, `streamChat`, `chat_stream`, `decodeChunk`).
- Anthropic specifics flagged to verify against the `claude-api` skill at build time.
