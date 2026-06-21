import { create } from "zustand";
import type { ProviderId } from "../types";
import { getProvider } from "../providers";
import { getSecret, setSecret } from "../lib/secrets";
import { oauthStatus, startOauth, oauthLogout } from "../lib/oauth";

const LS = "trumpcode.settings";

/** Per-provider authentication strategy. */
export type AuthMode = "apiKey" | "oauth";

const ALL_PROVIDERS: ProviderId[] = ["openai", "anthropic", "xai"];
/** Providers that actually support an OAuth subscription path. */
const OAUTH_PROVIDERS: ProviderId[] = ["openai", "anthropic"];

interface Persisted {
  provider: ProviderId;
  model: string;
  /** Per-provider chosen auth strategy. */
  authMode: Partial<Record<ProviderId, AuthMode>>;
}

/**
 * Resolve the effective auth mode for a provider given the persisted per-provider
 * map. Pure: defaults to `'apiKey'` when the provider has no explicit choice.
 * Extracted so the default/override logic is unit-testable without the store.
 */
export function resolveAuthMode(
  authMode: Partial<Record<ProviderId, AuthMode>>,
  provider: ProviderId,
): AuthMode {
  return authMode[provider] ?? "apiKey";
}

/**
 * Apply a single provider's auth-mode choice to the persisted map, returning a
 * NEW map (does not mutate the input). Pure so persistence behaviour can be
 * unit-tested without the zustand store or localStorage.
 */
export function setAuthModeIn(
  authMode: Partial<Record<ProviderId, AuthMode>>,
  provider: ProviderId,
  mode: AuthMode,
): Partial<Record<ProviderId, AuthMode>> {
  return { ...authMode, [provider]: mode };
}

function load(): Persisted {
  try {
    const j = JSON.parse(localStorage.getItem(LS) ?? "");
    if (j?.provider && j?.model) {
      return {
        provider: j.provider,
        model: j.model,
        authMode: (j.authMode ?? {}) as Partial<Record<ProviderId, AuthMode>>,
      };
    }
  } catch {
    /* ignore */
  }
  return { provider: "openai", model: "gpt-4o", authMode: {} };
}

function save(p: Persisted) {
  localStorage.setItem(LS, JSON.stringify(p));
}

interface SettingsState {
  provider: ProviderId;
  model: string;
  keys: Partial<Record<ProviderId, string>>;
  /** Chosen auth strategy per provider (defaults to 'apiKey'). */
  authMode: Partial<Record<ProviderId, AuthMode>>;
  /** Whether an OAuth bundle currently exists per provider (hydrated on load). */
  oauthConnected: Partial<Record<ProviderId, boolean>>;
  setProvider: (p: ProviderId) => void;
  setModel: (m: string) => void;
  setKey: (p: ProviderId, key: string) => Promise<void>;
  /** Resolve the effective auth mode for a provider (defaults to 'apiKey'). */
  getAuthMode: (p: ProviderId) => AuthMode;
  setAuthMode: (p: ProviderId, mode: AuthMode) => void;
  hydrateKeys: () => Promise<void>;
  /** Refresh OAuth connection status for all OAuth-capable providers. */
  hydrateOauth: () => Promise<void>;
  /** Run the interactive OAuth login for a provider, then refresh status. */
  loginOauth: (p: ProviderId) => Promise<void>;
  /** Log out of OAuth for a provider, then refresh status. */
  logoutOauth: (p: ProviderId) => Promise<void>;
}

export const useSettings = create<SettingsState>((set, get) => {
  const init = load();

  const persist = () =>
    save({
      provider: get().provider,
      model: get().model,
      authMode: get().authMode,
    });

  return {
    provider: init.provider,
    model: init.model,
    keys: {},
    authMode: init.authMode,
    oauthConnected: {},

    setProvider: (p) => {
      const model = getProvider(p).models[0].id;
      set({ provider: p, model });
      persist();
    },

    setModel: (m) => {
      set({ model: m });
      persist();
    },

    setKey: async (p, key) => {
      await setSecret(`apikey:${p}`, key);
      set((s) => ({ keys: { ...s.keys, [p]: key } }));
    },

    getAuthMode: (p) => resolveAuthMode(get().authMode, p),

    setAuthMode: (p, mode) => {
      set((s) => ({ authMode: setAuthModeIn(s.authMode, p, mode) }));
      persist();
    },

    hydrateKeys: async () => {
      const entries = await Promise.all(
        ALL_PROVIDERS.map(
          async (p) => [p, await getSecret(`apikey:${p}`)] as const,
        ),
      );
      set({
        keys: Object.fromEntries(entries.filter(([, v]) => v)) as Partial<
          Record<ProviderId, string>
        >,
      });
    },

    hydrateOauth: async () => {
      const entries = await Promise.all(
        OAUTH_PROVIDERS.map(async (p) => {
          try {
            return [p, await oauthStatus(p)] as const;
          } catch {
            return [p, false] as const;
          }
        }),
      );
      set({
        oauthConnected: Object.fromEntries(entries) as Partial<
          Record<ProviderId, boolean>
        >,
      });
    },

    loginOauth: async (p) => {
      await startOauth(p);
      await get().hydrateOauth();
    },

    logoutOauth: async (p) => {
      await oauthLogout(p);
      await get().hydrateOauth();
    },
  };
});
