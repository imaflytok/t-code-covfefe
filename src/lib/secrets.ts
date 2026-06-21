import { invoke } from "@tauri-apps/api/core";

const SERVICE = "trump-code";

function inTauri(): boolean {
  return typeof (window as unknown as { __TAURI_INTERNALS__?: unknown })
    .__TAURI_INTERNALS__ !== "undefined";
}

/** Read a secret from the OS keychain (Tauri) or localStorage (web/dev fallback). */
export async function getSecret(account: string): Promise<string> {
  if (inTauri()) {
    try {
      return (await invoke<string>("secret_get", { service: SERVICE, account })) ?? "";
    } catch {
      return "";
    }
  }
  return localStorage.getItem(`secret:${account}`) ?? "";
}

export async function setSecret(account: string, value: string): Promise<void> {
  if (inTauri()) {
    await invoke("secret_set", { service: SERVICE, account, value });
    return;
  }
  localStorage.setItem(`secret:${account}`, value);
}

export async function deleteSecret(account: string): Promise<void> {
  if (inTauri()) {
    try {
      await invoke("secret_delete", { service: SERVICE, account });
    } catch {
      /* ignore */
    }
    return;
  }
  localStorage.removeItem(`secret:${account}`);
}
