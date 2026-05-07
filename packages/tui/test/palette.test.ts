import { afterEach, describe, expect, it, vi } from "vitest";
import { Palette } from "../src/palette.js";

const SKIN_PALETTE = {
  bg: "#001f1c",
  fg: "#00bfa5",
  accent: "#80cbc4",
  alert: "#ff5252",
  dim: "#004d40",
} as const;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Palette", () => {
  it.each(Object.entries(SKIN_PALETTE))("resolves %s in truecolor mode", (token, expected) => {
    const palette = new Palette(SKIN_PALETTE, { truecolor: true });

    expect(palette.resolve(token)).toBe(expected);
  });

  it("uses 256-color fallback when truecolor is unavailable", () => {
    vi.stubEnv("TERM", "xterm-256color");
    const palette = new Palette(SKIN_PALETTE, { truecolor: false });

    expect(palette.resolve("fg")).toEqual(expect.any(Number));
    expect(palette.resolve("bg")).toEqual(expect.any(Number));
    expect(palette.resolve("accent")).toEqual(expect.any(Number));
    expect(palette.resolve("alert")).toEqual(expect.any(Number));
    expect(palette.resolve("dim")).toEqual(expect.any(Number));
  });

  it("falls back unknown tokens to fg", () => {
    const palette = new Palette(SKIN_PALETTE, { truecolor: true });

    expect(palette.resolve("unknown-token")).toBe(SKIN_PALETTE.fg);
  });
});
