import type { Capabilities } from "./types.js";

export function detectCapabilities(env: NodeJS.ProcessEnv = process.env): Capabilities {
  const colorTerm = `${env.COLORTERM ?? ""}`.toLowerCase();
  const termProgram = `${env.TERM_PROGRAM ?? ""}`.toLowerCase();
  const locale = `${env.LC_ALL ?? env.LC_CTYPE ?? env.LANG ?? ""}`.toLowerCase();
  const term = `${env.TERM ?? ""}`.toLowerCase();
  const windowsTerminal = Boolean(env.WT_SESSION) || termProgram === "windowsterminal";

  return {
    truecolor:
      colorTerm.includes("truecolor") ||
      colorTerm.includes("24bit") ||
      termProgram === "wezterm" ||
      windowsTerminal,
    mouse: term !== "dumb" && !(`${env.CI ?? ""}`.toLowerCase() === "true"),
    unicode: locale.includes("utf-8") || locale.includes("utf8") || process.platform === "win32",
    termProgram,
    windowsTerminal,
  };
}
