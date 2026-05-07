import { describe, it, expect, beforeEach, vi } from "vitest";
import type { GlyphCanvas } from "../../src/render/canvas.js";

const ALLOWLIST = [" ", "a", "b", "c", "▢"];

const mockCanvas = {
  drawCell: vi.fn(),
  metrics: { cellW: 9, cellH: 18, baseline: 14 },
  canvas: {} as HTMLCanvasElement,
  clear: vi.fn(),
  flush: vi.fn(),
  resize: vi.fn(),
  invalidateAtlas: vi.fn(),
} as unknown as GlyphCanvas;

describe("sprite glyph allowlist enforcement", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const { clearGlyphWarnCache } = await import("../../src/render/sprite.js");
    clearGlyphWarnCache();
    if (typeof window !== "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__squadquarium = {};
    }
  });

  it("renders allowed glyphs without warning", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { drawSprite } = await import("../../src/render/sprite.js");
    const sprites = {
      lead: {
        idle: [
          {
            rows: 1,
            cols: 2,
            cells: [
              [
                { glyph: "a", fg: "fg", bg: "bg" },
                { glyph: "b", fg: "fg", bg: "bg" },
              ],
            ],
          },
        ],
      },
    };
    drawSprite(mockCanvas, sprites, "lead", "idle", 0, 0, 0, ALLOWLIST, {});
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("substitutes ▢ and warns for glyphs not in allowlist", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { drawSprite } = await import("../../src/render/sprite.js");
    const sprites = {
      lead: {
        idle: [
          {
            rows: 1,
            cols: 1,
            cells: [[{ glyph: "X", fg: "fg", bg: "bg" }]],
          },
        ],
      },
    };
    drawSprite(mockCanvas, sprites, "lead", "idle", 0, 0, 0, ALLOWLIST, {});
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("not in allowlist"));
    expect(mockCanvas.drawCell).toHaveBeenCalledWith(0, 0, "▢", "fg", "bg", undefined);
    consoleSpy.mockRestore();
  });

  it("warns only once per glyph", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { drawSprite } = await import("../../src/render/sprite.js");
    const sprites = {
      lead: {
        idle: [
          {
            rows: 1,
            cols: 1,
            cells: [[{ glyph: "Z", fg: "fg", bg: "bg" }]],
          },
        ],
      },
    };
    drawSprite(mockCanvas, sprites, "lead", "idle", 0, 0, 0, ALLOWLIST, {});
    drawSprite(mockCanvas, sprites, "lead", "idle", 0, 0, 0, ALLOWLIST, {});
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    consoleSpy.mockRestore();
  });

  it("renders skin manifest sprites with roles/states/frames nesting", async () => {
    const { drawSprite } = await import("../../src/render/sprite.js");
    const sprites = {
      roles: {
        lead: {
          states: {
            idle: {
              frames: [
                {
                  cells: [[{ glyph: "c", fg: "fg", bg: "bg" }]],
                },
              ],
            },
          },
        },
      },
    };
    drawSprite(mockCanvas, sprites, "lead", "idle", 0, 1, 2, ALLOWLIST, {});
    expect(mockCanvas.drawCell).toHaveBeenCalledWith(1, 2, "c", "fg", "bg", undefined);
  });

  it("resolves state via fallbacks", async () => {
    const { drawSprite } = await import("../../src/render/sprite.js");
    const sprites = {
      lead: {
        idle: [
          {
            rows: 1,
            cols: 1,
            cells: [[{ glyph: "a", fg: "fg", bg: "bg" }]],
          },
        ],
      },
    };
    drawSprite(mockCanvas, sprites, "lead", "working", 0, 0, 0, ALLOWLIST, { working: "idle" });
    expect(mockCanvas.drawCell).toHaveBeenCalledWith(0, 0, "a", "fg", "bg", undefined);
  });
});
