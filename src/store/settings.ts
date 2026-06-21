import { create } from "zustand";
import type { ProviderId } from "../types";
import { getProvider } from "../providers";
import { getSecret, setSecret } from "../lib/secrets";

const LS = "trumpcode.settings";

interface Persisted {
  provider: ProviderId;
  model: string;
}

function load(): Persisted {
  try {
    const j = JSON.parse(localStorage.getItem(LS) ?? "");
    if (j?.provider && j?.model) return j as Persisted;
  } catch {
    /* ignore */
  }
  return { provider: "openai", model: "gpt-4o" };
}

function save(p: Persisted) {
  localStorage.setItem(LS, JSON.stringify(p));
}

interface SettingsState {
  provider: ProviderId;
  model: string;
  keys: Partial<Record<ProviderId, string>>;
  setProvider: (p: ProviderId) => void;
  setModel: (m: string) => void;
  setKey: (p: ProviderId, key: string) => Promise<void>;
  hydrateKeys: () => Promise<void>;
}

export const useSettings = create<SettingsState>((set, get) => {
  const init = load();
  return {
    provider: init.provider,
    model: init.model,
    keys: {},

    setProvider: (p) => {
      const model = getProvider(p).models[0].id;
      set({ provider: p, model });
      save({ provider: p, model });
    },

    setModel: (m) => {
      set({ model: m });
      save({ provider: get().provider, model: m });
    },

    setKey: async (p, key) => {
      await setSecret(`apikey:${p}`, key);
      set((s) => ({ keys: { ...s.keys, [p]: key } }));
    },

    hydrateKeys: async () => {
      const ids: ProviderId[] = ["openai", "anthropic", "xai"];
      const entries = await Promise.all(
        ids.map(async (p) => [p, await getSecret(`apikey:${p}`)] as const),
      );
      set({
        keys: Object.fromEntries(entries.filter(([, v]) => v)) as Partial<
          Record<ProviderId, string>
        >,
      });
    },
  };
});
