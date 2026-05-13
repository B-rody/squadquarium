import type { Capabilities, ColorSupportLevel } from "./types.js";

function detectColorLevel(
  env: NodeJS.ProcessEnv,
  term: string,
  termProgram: string,
  colorTerm: string,
): ColorSupportLevel {
  const windowsTerminal = Boolean(env.WT_SESSION) || termProgram === "windowsterminal";
  if (
    colorTerm.includes("truecolor") ||
    colorTerm.includes("24bit") ||
    termProgram === "wezterm" ||
    windowsTerminal
  ) {
    return "truecolor";
  }

  if (
    /256(color)?/i.test(term) ||
    colorTerm.includes("256") ||
    Boolean(env.KONSOLE_VERSION) ||
    windowsTerminal
  ) {
    return "ansi256";
  }

  return term === "" || term === "dumb" ? "none" : "ansi16";
}

export function detectCapabilities(env: NodeJS.ProcessEnv = process.env): Capabilities {
  const colorTerm = `${env.COLORTERM ?? ""}`.toLowerCase();
  const termProgram = `${env.TERM_PROGRAM ?? ""}`.toLowerCase();
  const locale = `${env.LC_ALL ?? env.LC_CTYPE ?? env.LANG ?? ""}`.toLowerCase();
  const term = `${env.TERM ?? ""}`.toLowerCase();
  const windowsTerminal = Boolean(env.WT_SESSION) || termProgram === "windowsterminal";
  const colorLevel = detectColorLevel(env, term, termProgram, colorTerm);

  return {
    truecolor: colorLevel === "truecolor",
    colorLevel,
    mouse: term !== "dumb" && !(`${env.CI ?? ""}`.toLowerCase() === "true"),
    unicode: locale.includes("utf-8") || locale.includes("utf8") || process.platform === "win32",
    termProgram,
    windowsTerminal,
  };
}
