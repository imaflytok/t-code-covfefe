import { useChatStore } from "../store/chat";
import { useSettings } from "../store/settings";
import { streamChat } from "../providers";
import { buildSystemPrompt } from "../data/systemPrompt";
import {
  covfefe,
  executiveOrder,
  helpText,
  parseCommand,
} from "../data/commands";
import { trumpError, isOauthError } from "./errors";

/** Handle a slash command locally. Returns true if it was a command. */
function handleCommand(text: string): boolean {
  const cmd = parseCommand(text);
  if (!cmd) return false;
  const chat = useChatStore.getState();
  const settings = useSettings.getState();

  switch (cmd.cmd) {
    case "clear":
      chat.clear();
      return true;
    case "help":
      chat.addUserMessage(text);
      chat.addAssistantMessage(helpText());
      return true;
    case "covfefe":
      chat.addUserMessage(text);
      chat.addAssistantMessage(covfefe());
      return true;
    case "executive-order":
      chat.addUserMessage(text);
      chat.addAssistantMessage(executiveOrder(cmd.arg));
      return true;
    case "model":
      chat.addUserMessage(text);
      if (cmd.arg) {
        settings.setModel(cmd.arg);
        chat.addAssistantMessage(
          `You got it. Model is now **${cmd.arg}**. A great choice. Maybe the best.`,
        );
      } else {
        chat.addAssistantMessage(
          `Current model: **${settings.model}** (${settings.provider}). Use \`/model <id>\` to switch.`,
        );
      }
      return true;
    case "login":
      chat.addUserMessage(text);
      chat.addAssistantMessage(
        "OAuth login is experimental and coming soon, folks. For now add an API key in Settings — the safest, most tremendous option.",
      );
      return true;
    default:
      return false; // unknown slash -> treat as normal chat
  }
}

/** Entry point used by the input bar. */
export async function sendMessage(text: string): Promise<void> {
  if (handleCommand(text)) return;

  const settings = useSettings.getState();
  const chat = useChatStore.getState();
  const key = settings.keys[settings.provider];
  const authMode = settings.getAuthMode(settings.provider);

  chat.addUserMessage(text);

  // OAuth uses the keychain-stored subscription token (no API key needed);
  // the API-key path still requires a key.
  if (authMode !== "oauth" && !key) {
    chat.addAssistantMessage(trumpError("no-key"));
    return;
  }

  const history = useChatStore.getState().messages.slice();
  chat.startAssistant();

  try {
    await streamChat(
      settings.provider,
      key ?? "",
      {
        model: settings.model,
        system: buildSystemPrompt(),
        messages: history,
      },
      (t) => useChatStore.getState().appendToken(t),
      authMode,
    );
    useChatStore.getState().endStream();
  } catch (e) {
    console.error("[trump-code] request failed:", e);
    // An OAuth failure (resolving/refreshing the subscription token) surfaces an
    // in-character "sign in via Settings" message; everything else is an `api`
    // error. When OAuth is the chosen auth mode, a token failure is the most
    // likely cause, so treat it as OAuth.
    const detail = String(e);
    const kind =
      authMode === "oauth" && isOauthError(detail) ? "oauth" : "api";
    const msg = trumpError(kind, detail);
    const cur = useChatStore.getState();
    cur.appendToken((cur.messages.at(-1)?.content ? "\n\n" : "") + msg);
    cur.endStream();
  }
}
