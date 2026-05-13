import type { ColorSupportLevel } from "./types.js";

const DEFAULT_PALETTE = {
  bg: "#001b2e",
  fg: "#f4fbff",
  accent: "#ffd166",
  alert: "#ef476f",
  dim: "#6b8ca3",
} satisfies Record<string, string>;

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export type ColorValue = Rgb;
export interface PaletteCapabilities {
  truecolor: boolean;
  colorLevel?: ColorSupportLevel;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function normalizeHex(hex: string): string {
  return /^#[0-9a-f]{6}$/i.test(hex) ? hex.toLowerCase() : DEFAULT_PALETTE.fg;
}

function hexToRgb(hex: string): Rgb {
  const normalized = normalizeHex(hex).slice(1);
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((value) => clamp(value).toString(16).padStart(2, "0")).join("")}`;
}

export function formatColorValue(color: ColorValue): string {
  return `rgb(${color.r},${color.g},${color.b})`;
}

function dimRgb(rgb: Rgb): Rgb {
  return {
    r: clamp(rgb.r * 0.6),
    g: clamp(rgb.g * 0.6),
    b: clamp(rgb.b * 0.6),
  };
}

function supports256ColorFallback(): boolean {
  const term = process.env.TERM ?? "";
  return (
    /256(color)?/i.test(term) ||
    Boolean(process.env.WT_SESSION) ||
    Boolean(process.env.KONSOLE_VERSION)
  );
}

export class Palette {
  private readonly palette: Record<string, string>;
  private readonly colorLevel: Exclude<ColorSupportLevel, "none">;

  constructor(skinPalette: Record<string, string>, capabilities: PaletteCapabilities) {
    this.palette = {
      ...DEFAULT_PALETTE,
      ...skinPalette,
    };
    this.colorLevel = capabilities.truecolor
      ? "truecolor"
      : capabilities.colorLevel === "ansi256"
        ? "ansi256"
        : supports256ColorFallback()
          ? "ansi256"
          : "ansi16";
  }

  getColorLevel(): Exclude<ColorSupportLevel, "none"> {
    return this.colorLevel;
  }

  getEntries(): Record<string, string> {
    return { ...this.palette };
  }

  resolveTokenHex(token: string): string {
    if (token === "dim") {
      return normalizeHex(
        this.palette.dim ?? rgbToHex(dimRgb(hexToRgb(this.palette.fg ?? DEFAULT_PALETTE.fg))),
      );
    }

    const value = this.palette[token] ?? (token.startsWith("#") ? token : this.palette.fg);
    return normalizeHex(value);
  }

  resolve(token: string): ColorValue {
    const hex = this.resolveTokenHex(token);
    return hexToRgb(hex);
  }
}

export function describePalette(
  palette: Palette,
  tokens: string[] = Object.keys(palette.getEntries()),
): string[] {
  const entries = palette.getEntries();
  const rawSummary = tokens.map(
    (token) => `${token}=${entries[token] ?? palette.resolveTokenHex(token)}`,
  );
  const resolvedSummary = tokens.map(
    (token) =>
      `${token}=${palette.resolveTokenHex(token)}=>${formatColorValue(palette.resolve(token))}`,
  );

  return [
    `[DEBUG] palette mode=${palette.getColorLevel()} raw ${rawSummary.join(" ")}`,
    `[DEBUG] palette resolved ${resolvedSummary.join(" ")}`,
  ];
}

export { DEFAULT_PALETTE };
