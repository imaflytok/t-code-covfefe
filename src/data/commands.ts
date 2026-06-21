export interface ParsedCommand {
  cmd: string;
  arg: string;
}

/** Parse a leading slash command. Returns null for normal chat input. */
export function parseCommand(input: string): ParsedCommand | null {
  const t = input.trim();
  if (!t.startsWith("/")) return null;
  const sp = t.indexOf(" ");
  if (sp === -1) return { cmd: t.slice(1).toLowerCase(), arg: "" };
  return { cmd: t.slice(1, sp).toLowerCase(), arg: t.slice(sp + 1).trim() };
}

export const COMMAND_LIST: { cmd: string; desc: string }[] = [
  { cmd: "help", desc: "Show available commands" },
  { cmd: "clear", desc: "Clear the conversation" },
  { cmd: "model", desc: "Switch model: /model <id>" },
  { cmd: "login", desc: "Sign in with OAuth (experimental)" },
  { cmd: "covfefe", desc: "Despite the constant negative press..." },
  { cmd: "executive-order", desc: "Issue a tremendous executive order" },
];

export function helpText(): string {
  return [
    "**Available commands** (the best commands, everyone says so):",
    "",
    ...COMMAND_LIST.map((c) => `- \`/${c.cmd}\` — ${c.desc}`),
  ].join("\n");
}

export function covfefe(): string {
  return (
    "Despite the constant negative press covfefe.\n\n" +
    "*(Nobody knows what it means. But it's tremendous. Believe me.)*"
  );
}

export function executiveOrder(arg: string): string {
  const subject = (arg || "code quality").toUpperCase();
  return [
    "📜 **EXECUTIVE ORDER**",
    "",
    `By the authority vested in me — the best coder, maybe ever — effective IMMEDIATELY,`,
    `all ${subject} shall be TREMENDOUS.`,
    "",
    "Bugs are hereby DEPORTED. Tech debt? Gone, folks. Tests? Strong and beautiful.",
    "",
    "Signed,\n*Trump Code* 🇺🇸",
  ].join("\n");
}
