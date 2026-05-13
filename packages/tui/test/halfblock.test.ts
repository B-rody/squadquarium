import { describe, expect, it } from "vitest";
import {
  HalfBlockCanvas,
  colorsEqual,
  type Pixel,
  type HalfBlockBuffer,
} from "../src/halfblock.js";

const BLUE: Pixel = { r: 0, g: 27, b: 46 };
const WHITE: Pixel = { r: 244, g: 251, b: 255 };
const YELLOW: Pixel = { r: 255, g: 209, b: 102 };
const RED: Pixel = { r: 239, g: 71, b: 111 };

describe("colorsEqual", () => {
  it("returns true for identical RGB", () => {
    expect(colorsEqual({ r: 10, g: 20, b: 30 }, { r: 10, g: 20, b: 30 })).toBe(true);
  });

  it("returns false for different RGB", () => {
    expect(colorsEqual({ r: 10, g: 20, b: 30 }, { r: 10, g: 20, b: 31 })).toBe(false);
  });

  it("returns true for two nulls", () => {
    expect(colorsEqual(null, null)).toBe(true);
  });

  it("returns false for null vs non-null", () => {
    expect(colorsEqual(null, BLUE)).toBe(false);
    expect(colorsEqual(BLUE, null)).toBe(false);
  });
});

describe("HalfBlockCanvas", () => {
  it("creates with given dimensions", () => {
    const canvas = new HalfBlockCanvas(10, 6);
    expect(canvas.width).toBe(10);
    expect(canvas.pixelHeight).toBe(6);
    expect(canvas.cellHeight).toBe(3); // 6 pixels / 2 = 3 terminal rows
  });

  it("cellHeight rounds up for odd pixelHeight", () => {
    const canvas = new HalfBlockCanvas(5, 7);
    expect(canvas.cellHeight).toBe(4); // ceil(7/2) = 4
  });

  it("fills with a solid color", () => {
    const canvas = new HalfBlockCanvas(3, 4);
    canvas.fill(BLUE);
    // All pixels should be BLUE
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 3; x++) {
        expect(canvas.getPixel(x, y)).toEqual(BLUE);
      }
    }
  });

  it("setPixel and getPixel work", () => {
    const canvas = new HalfBlockCanvas(5, 4);
    canvas.fill(BLUE);
    canvas.setPixel(2, 1, WHITE);
    expect(canvas.getPixel(2, 1)).toEqual(WHITE);
    expect(canvas.getPixel(2, 0)).toEqual(BLUE);
  });

  it("setPixel ignores out-of-bounds", () => {
    const canvas = new HalfBlockCanvas(3, 4);
    canvas.fill(BLUE);
    canvas.setPixel(-1, 0, WHITE); // should not throw
    canvas.setPixel(3, 0, WHITE); // should not throw
    canvas.setPixel(0, 4, WHITE); // should not throw
    canvas.setPixel(0, -1, WHITE); // should not throw
  });

  it("getPixel returns null for out-of-bounds", () => {
    const canvas = new HalfBlockCanvas(3, 4);
    expect(canvas.getPixel(-1, 0)).toBeNull();
    expect(canvas.getPixel(3, 0)).toBeNull();
  });

  it("drawRect fills a rectangular region", () => {
    const canvas = new HalfBlockCanvas(6, 4);
    canvas.fill(BLUE);
    canvas.drawRect(1, 1, 3, 2, YELLOW);
    expect(canvas.getPixel(0, 0)).toEqual(BLUE);
    expect(canvas.getPixel(1, 1)).toEqual(YELLOW);
    expect(canvas.getPixel(2, 2)).toEqual(YELLOW);
    expect(canvas.getPixel(3, 2)).toEqual(YELLOW);
    expect(canvas.getPixel(4, 1)).toEqual(BLUE); // outside rect
  });

  it("blitPixels draws a 2D pixel grid onto canvas", () => {
    const canvas = new HalfBlockCanvas(6, 6);
    canvas.fill(BLUE);
    const sprite: (Pixel | null)[][] = [
      [WHITE, YELLOW, WHITE],
      [YELLOW, RED, YELLOW],
      [null, YELLOW, null], // null = transparent, don't overwrite
    ];
    canvas.blitPixels(1, 1, sprite);
    expect(canvas.getPixel(1, 1)).toEqual(WHITE);
    expect(canvas.getPixel(2, 1)).toEqual(YELLOW);
    expect(canvas.getPixel(2, 2)).toEqual(RED);
    expect(canvas.getPixel(1, 3)).toEqual(BLUE); // null = transparent, keep original
    expect(canvas.getPixel(2, 3)).toEqual(YELLOW);
    expect(canvas.getPixel(3, 3)).toEqual(BLUE); // null = transparent
  });

  describe("renderToBuffer", () => {
    function createMockBuffer(): HalfBlockBuffer & {
      cells: Array<{ x: number; y: number; char: string; fg: Pixel; bg: Pixel }>;
    } {
      const cells: Array<{ x: number; y: number; char: string; fg: Pixel; bg: Pixel }> = [];
      return {
        cells,
        put(opts, text) {
          for (let i = 0; i < text.length; i++) {
            cells.push({
              x: opts.x + i,
              y: opts.y,
              char: text[i],
              fg: opts.attr.color,
              bg: opts.attr.bgColor,
            });
          }
        },
      };
    }

    it("renders solid color as spaces (or full blocks)", () => {
      const canvas = new HalfBlockCanvas(2, 2);
      canvas.fill(BLUE);
      const buf = createMockBuffer();
      canvas.renderToBuffer(buf, BLUE);
      // 2 pixels tall = 1 terminal row, both top and bottom are BLUE
      expect(buf.cells.length).toBe(2); // 2 columns
      for (const cell of buf.cells) {
        expect(cell.y).toBe(0);
        // When both halves are same color, should use space with that bg
        expect(cell.char).toBe(" ");
        expect(cell.bg).toEqual(BLUE);
      }
    });

    it("renders different top/bottom as ▀ half-block", () => {
      const canvas = new HalfBlockCanvas(1, 2);
      canvas.setPixel(0, 0, WHITE); // top pixel
      canvas.setPixel(0, 1, BLUE); // bottom pixel
      const buf = createMockBuffer();
      canvas.renderToBuffer(buf, BLUE);
      expect(buf.cells.length).toBe(1);
      expect(buf.cells[0].char).toBe("▀");
      expect(buf.cells[0].fg).toEqual(WHITE); // foreground = top pixel
      expect(buf.cells[0].bg).toEqual(BLUE); // background = bottom pixel
    });

    it("handles odd pixel height (last row has no bottom pair)", () => {
      const canvas = new HalfBlockCanvas(1, 3);
      canvas.fill(BLUE);
      canvas.setPixel(0, 0, WHITE);
      canvas.setPixel(0, 2, YELLOW); // row 2 has no row 3 pair
      const buf = createMockBuffer();
      canvas.renderToBuffer(buf, BLUE);
      // Cell row 0: top=WHITE, bottom=BLUE → ▀
      // Cell row 1: top=YELLOW, bottom=fallback → ▀
      expect(buf.cells.length).toBe(2);
      expect(buf.cells[0].char).toBe("▀");
      expect(buf.cells[0].fg).toEqual(WHITE);
      expect(buf.cells[1].char).toBe("▀");
      expect(buf.cells[1].fg).toEqual(YELLOW);
    });

    it("renders full canvas (3×4 pixels → 3×2 cells)", () => {
      const canvas = new HalfBlockCanvas(3, 4);
      canvas.fill(BLUE);
      // Top-left quadrant = white
      canvas.setPixel(0, 0, WHITE);
      canvas.setPixel(0, 1, WHITE);
      const buf = createMockBuffer();
      canvas.renderToBuffer(buf, BLUE);
      expect(buf.cells.length).toBe(6);
      // Cell (0,0): top=WHITE, bottom=WHITE → both same → space + bgColor=WHITE
      const topLeft = buf.cells.find((c) => c.x === 0 && c.y === 0);
      expect(topLeft).toBeDefined();
      expect(topLeft!.bg).toEqual(WHITE);
      expect(topLeft!.char).toBe(" ");
    });
  });
});
