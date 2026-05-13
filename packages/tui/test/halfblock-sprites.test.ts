import { describe, expect, it } from "vitest";
import {
  parseHalfBlockSheet,
  resolveFramePixels,
  getFrameSize,
  resolveHalfBlockState,
} from "../src/halfblock-sprites.js";
import { Palette } from "../src/palette.js";

const MINIMAL_SHEET = JSON.stringify({
  format: "halfblock",
  roles: {
    lead: {
      states: {
        idle: {
          frames: [
            {
              pixels: [
                ["fg", "bg", null],
                ["accent", "fg", "bg"],
              ],
            },
          ],
        },
        working: {
          frames: [
            {
              pixels: [
                ["accent", "accent", null],
                ["fg", "fg", "bg"],
              ],
            },
          ],
        },
      },
    },
  },
});

describe("parseHalfBlockSheet", () => {
  it("parses a valid sheet", () => {
    const sheet = parseHalfBlockSheet(MINIMAL_SHEET);
    expect(sheet.format).toBe("halfblock");
    expect(Object.keys(sheet.roles)).toEqual(["lead"]);
    expect(sheet.roles.lead.states.idle.frames).toHaveLength(1);
    expect(sheet.roles.lead.states.idle.frames[0].pixels).toHaveLength(2);
  });

  it("rejects missing format", () => {
    expect(() => parseHalfBlockSheet('{"roles":{}}')).toThrow("halfblock");
  });

  it("preserves null tokens as transparent", () => {
    const sheet = parseHalfBlockSheet(MINIMAL_SHEET);
    expect(sheet.roles.lead.states.idle.frames[0].pixels[0][2]).toBeNull();
  });
});

describe("resolveFramePixels", () => {
  it("converts palette tokens to RGB values", () => {
    const sheet = parseHalfBlockSheet(MINIMAL_SHEET);
    const palette = new Palette({}, { truecolor: true });
    const pixels = resolveFramePixels(sheet.roles.lead.states.idle.frames[0], palette);
    // fg token → palette's fg color
    expect(pixels[0][0]).toEqual(palette.resolve("fg"));
    // bg token → palette's bg color
    expect(pixels[0][1]).toEqual(palette.resolve("bg"));
    // null stays null
    expect(pixels[0][2]).toBeNull();
    // accent token
    expect(pixels[1][0]).toEqual(palette.resolve("accent"));
  });
});

describe("getFrameSize", () => {
  it("returns width and height", () => {
    const sheet = parseHalfBlockSheet(MINIMAL_SHEET);
    const size = getFrameSize(sheet.roles.lead.states.idle.frames[0]);
    expect(size.width).toBe(3);
    expect(size.pixelHeight).toBe(2);
  });
});

describe("resolveHalfBlockState", () => {
  const states = { idle: { frames: [] }, working: { frames: [] } };

  it("returns requested state when it exists", () => {
    expect(resolveHalfBlockState("working", states)).toBe("working");
  });

  it("falls back through chain", () => {
    expect(resolveHalfBlockState("blocked", states)).toBe("idle");
  });

  it("falls back to idle for unknown states", () => {
    expect(resolveHalfBlockState("unknown", states)).toBe("idle");
  });

  it("returns celebrate → working when both exist", () => {
    const s = { idle: { frames: [] }, working: { frames: [] } };
    expect(resolveHalfBlockState("celebrate", s)).toBe("working");
  });
});
