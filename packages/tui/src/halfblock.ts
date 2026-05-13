import type { Rgb } from "./palette.js";

/** A pixel is an RGB color or null (transparent). */
export type Pixel = Rgb | null;

const UPPER_HALF = "▀"; // U+2580

/**
 * Compare two pixel colors for value equality.
 * Two nulls are equal; null ≠ non-null.
 */
export function colorsEqual(a: Pixel, b: Pixel): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.r === b.r && a.g === b.g && a.b === b.b;
}

/**
 * A 2D pixel grid that renders using Unicode half-block characters (▀▄)
 * to achieve 2× vertical resolution. Each terminal cell represents two
 * vertically stacked pixels — foreground color for the top pixel,
 * background color for the bottom pixel.
 *
 * Usage:
 *   const canvas = new HalfBlockCanvas(cols, pixelRows);
 *   canvas.fill(bgColor);
 *   canvas.blitPixels(x, y, spritePixels);
 *   canvas.renderToBuffer(screenBuffer, fallbackBg);
 */
export class HalfBlockCanvas {
  readonly width: number;
  readonly pixelHeight: number;
  private readonly pixels: Pixel[][];

  constructor(width: number, pixelHeight: number) {
    this.width = Math.max(0, Math.floor(width));
    this.pixelHeight = Math.max(0, Math.floor(pixelHeight));
    this.pixels = Array.from({ length: this.pixelHeight }, () =>
      new Array<Pixel>(this.width).fill(null),
    );
  }

  /** Terminal rows needed (ceil(pixelHeight / 2)). */
  get cellHeight(): number {
    return Math.ceil(this.pixelHeight / 2);
  }

  getPixel(x: number, y: number): Pixel {
    if (x < 0 || x >= this.width || y < 0 || y >= this.pixelHeight) return null;
    return this.pixels[y][x];
  }

  setPixel(x: number, y: number, color: Pixel): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.pixelHeight) return;
    this.pixels[y][x] = color;
  }

  /** Fill all pixels with a solid color. */
  fill(color: Pixel): void {
    for (let y = 0; y < this.pixelHeight; y++) {
      for (let x = 0; x < this.width; x++) {
        this.pixels[y][x] = color;
      }
    }
  }

  /** Fill a rectangular region with a solid color. */
  drawRect(x: number, y: number, w: number, h: number, color: Pixel): void {
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        this.setPixel(px, py, color);
      }
    }
  }

  /**
   * Blit a 2D pixel grid (sprite) onto the canvas.
   * null pixels in the source are transparent (don't overwrite).
   */
  blitPixels(destX: number, destY: number, source: (Pixel | null)[][]): void {
    for (let sy = 0; sy < source.length; sy++) {
      const row = source[sy];
      if (!row) continue;
      for (let sx = 0; sx < row.length; sx++) {
        const px = row[sx];
        if (px === null || px === undefined) continue;
        this.setPixel(destX + sx, destY + sy, px);
      }
    }
  }

  /**
   * Render the pixel canvas into a ScreenBufferHD-like object.
   * Collapses every 2 pixel rows into 1 terminal row using half-block characters.
   *
   * @param buffer - A ScreenBufferHD (or compatible) to write cells into
   * @param fallbackBg - Color used when a pixel is null (transparent)
   */
  renderToBuffer(buffer: HalfBlockBuffer, fallbackBg: Rgb): void {
    for (let cellRow = 0; cellRow < this.cellHeight; cellRow++) {
      const topPixelY = cellRow * 2;
      const botPixelY = topPixelY + 1;

      for (let x = 0; x < this.width; x++) {
        const top = this.getPixel(x, topPixelY) ?? fallbackBg;
        const bot =
          botPixelY < this.pixelHeight ? (this.getPixel(x, botPixelY) ?? fallbackBg) : fallbackBg;

        let char: string;
        let fg: Rgb;
        let bg: Rgb;

        if (colorsEqual(top, bot)) {
          // Both same color — just use a space with that background
          char = " ";
          fg = top;
          bg = top;
        } else {
          // Different — use upper half-block: fg=top, bg=bottom
          char = UPPER_HALF;
          fg = top;
          bg = bot;
        }

        buffer.put(
          {
            x,
            y: cellRow,
            attr: { color: fg, bgColor: bg },
            wrap: false,
            dx: 0,
            dy: 0,
          },
          char,
        );
      }
    }
  }
}

/** Minimal buffer interface compatible with terminal-kit ScreenBufferHD. */
export interface HalfBlockBuffer {
  put(
    options: {
      x: number;
      y: number;
      attr: { color: Rgb; bgColor: Rgb };
      wrap?: boolean;
      dx?: number;
      dy?: number;
    },
    text: string,
  ): void;
}
