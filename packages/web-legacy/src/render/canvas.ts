import type { CellMetrics } from "./cellMetrics.js";

type ColorResolver = (token: string) => string;

interface AtlasKey {
  glyph: string;
  fg: string;
}

function atlasKeyStr(k: AtlasKey): string {
  return `${k.glyph}::${k.fg}`;
}

export class GlyphCanvas {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly atlas = new Map<string, OffscreenCanvas>();
  private readonly dpr: number;
  private readonly fontSize: number;
  private readonly resolveColor: ColorResolver;
  metrics: CellMetrics;

  constructor(
    public readonly canvas: HTMLCanvasElement,
    metrics: CellMetrics,
    fontSize: number,
    resolveColor: ColorResolver,
  ) {
    this.metrics = metrics;
    this.fontSize = fontSize;
    this.resolveColor = resolveColor;
    this.dpr = window.devicePixelRatio ?? 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Cannot get 2d context from canvas");
    this.ctx = ctx;
  }

  resize(cols: number, rows: number) {
    const { cellW, cellH } = this.metrics;
    this.canvas.width = Math.round(cols * cellW * this.dpr);
    this.canvas.height = Math.round(rows * cellH * this.dpr);
    this.canvas.style.width = `${cols * cellW}px`;
    this.canvas.style.height = `${rows * cellH}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  clear() {
    const bg = this.resolveColor("bg");
    this.ctx.fillStyle = bg;
    this.ctx.fillRect(0, 0, this.canvas.width / this.dpr, this.canvas.height / this.dpr);
  }

  flush() {
    // Reserved for future double-buffering.
  }

  drawCell(row: number, col: number, glyph: string, fg: string, bg: string, blink?: boolean) {
    void blink;
    const { cellW, cellH, baseline } = this.metrics;
    const x = Math.round(col * cellW);
    const y = Math.round(row * cellH);

    const bgColor = this.resolveColor(bg);
    this.ctx.fillStyle = bgColor;
    this.ctx.fillRect(x, y, Math.ceil(cellW), Math.ceil(cellH));

    if (glyph === " ") return;

    const fgColor = this.resolveColor(fg);
    const key = atlasKeyStr({ glyph, fg: fgColor });
    let atlasTile = this.atlas.get(key);

    if (!atlasTile) {
      atlasTile = this.renderToAtlas(glyph, fgColor, cellW, cellH, baseline);
      this.atlas.set(key, atlasTile);
    }

    this.ctx.drawImage(atlasTile, x, y, Math.ceil(cellW), Math.ceil(cellH));
  }

  private renderToAtlas(
    glyph: string,
    fg: string,
    w: number,
    h: number,
    baseline: number,
  ): OffscreenCanvas {
    const oc = new OffscreenCanvas(Math.ceil(w), Math.ceil(h));
    const ctx = oc.getContext("2d")!;
    ctx.clearRect(0, 0, Math.ceil(w), Math.ceil(h));
    ctx.font = `${this.fontSize}px "JetBrains Mono", monospace`;
    ctx.fillStyle = fg;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(glyph, 0, baseline);
    return oc;
  }

  invalidateAtlas() {
    this.atlas.clear();
  }
}
