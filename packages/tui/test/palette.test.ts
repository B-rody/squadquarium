import { afterEach, describe, expect, it, vi } from "vitest";
import { describePalette, formatColorValue, Palette } from "../src/palette.js";

const SKIN_PALETTE = {
  bg: "#001f1c",
  fg: "#00bfa5",
  accent: "#80cbc4",
  alert: "#ff5252",
  dim: "#004d40",
} as const;

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.slice(1);
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Palette", () => {
  it.each(Object.entries(SKIN_PALETTE))("resolves %s in truecolor mode", (token, expected) => {
    const palette = new Palette(SKIN_PALETTE, { truecolor: true });

    expect(palette.resolve(token)).toEqual(hexToRgb(expected));
  });

  it("keeps RGB values when truecolor detection is unavailable", () => {
    vi.stubEnv("TERM", "xterm-256color");
    const palette = new Palette(SKIN_PALETTE, { truecolor: false });

    expect(palette.getColorLevel()).toBe("ansi256");
    expect(palette.resolve("fg")).toEqual(hexToRgb(SKIN_PALETTE.fg));
    expect(palette.resolve("bg")).toEqual(hexToRgb(SKIN_PALETTE.bg));
    expect(palette.resolve("accent")).toEqual(hexToRgb(SKIN_PALETTE.accent));
    expect(palette.resolve("alert")).toEqual(hexToRgb(SKIN_PALETTE.alert));
    expect(palette.resolve("dim")).toEqual(hexToRgb(SKIN_PALETTE.dim));
  });

  it("falls back unknown tokens to fg", () => {
    const palette = new Palette(SKIN_PALETTE, { truecolor: true });

    expect(palette.resolve("unknown-token")).toEqual(hexToRgb(SKIN_PALETTE.fg));
  });

  it("describes raw and resolved palette values", () => {
    const palette = new Palette(SKIN_PALETTE, { truecolor: true, colorLevel: "truecolor" });

    expect(describePalette(palette, ["bg", "fg"])).toEqual([
      "[DEBUG] palette mode=truecolor raw bg=#001f1c fg=#00bfa5",
      "[DEBUG] palette resolved bg=#001f1c=>rgb(0,31,28) fg=#00bfa5=>rgb(0,191,165)",
    ]);
    expect(formatColorValue({ r: 1, g: 2, b: 3 })).toBe("rgb(1,2,3)");
  });
});
