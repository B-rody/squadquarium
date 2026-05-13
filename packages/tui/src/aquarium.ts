import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ScreenBufferHD } from "terminal-kit";

import { Actor, ActorManager } from "./actor.js";
import { HalfBlockCanvas } from "./halfblock.js";
import {
  getFrameSize,
  resolveFramePixels,
  resolveHalfBlockState,
  type HalfBlockSpriteSheet,
} from "./halfblock-sprites.js";
import {
  DEFAULT_PALETTE,
  formatColorValue,
  Palette,
  type PaletteCapabilities,
  type Rgb,
} from "./palette.js";
import {
  loadSpritesSync,
  type SpriteCell,
  type SpriteFrame,
  type SpriteSheet,
  type SpriteState,
} from "./sprites.js";

interface SkinManifest {
  name?: string;
  palette?: Record<string, string>;
  fallbacks?: Record<string, string>;
}

export interface AquariumOptions {
  spriteSheet?: SpriteSheet;
  halfBlockSprites?: HalfBlockSpriteSheet;
  skinPalette?: Record<string, string>;
  fallbacks?: Record<string, string>;
  capabilities?: PaletteCapabilities;
  roleLabels?: Record<string, ActorLabel>;
}

const DEFAULT_FALLBACKS = {
  working: "idle",
  blocked: "idle",
  celebrate: "working",
  celebrating: "celebrate",
} satisfies Record<string, string>;

export interface ActorLabel {
  name: string;
  role: string;
}

interface ActorBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

function defaultRepoRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
}

function readSkinManifestSync(manifestPath: string): SkinManifest {
  if (!existsSync(manifestPath)) {
    return {};
  }

  return JSON.parse(readFileSync(manifestPath, "utf8")) as SkinManifest;
}

function detectCapabilities(): { truecolor: boolean } {
  const colorTerm = (process.env.COLORTERM ?? "").toLowerCase();
  return {
    truecolor:
      colorTerm.includes("truecolor") ||
      colorTerm.includes("24bit") ||
      Boolean(process.env.WT_SESSION),
  };
}

function resolveStateName(
  requestedState: string,
  states: Record<string, SpriteState>,
  fallbacks: Record<string, string>,
): string {
  if (states[requestedState]) {
    return requestedState;
  }

  const visited = new Set<string>([requestedState]);
  let current = requestedState;

  while (fallbacks[current] && !visited.has(fallbacks[current])) {
    current = fallbacks[current];
    if (states[current]) {
      return current;
    }
    visited.add(current);
  }

  return states.idle ? "idle" : (Object.keys(states)[0] ?? requestedState);
}

function spriteContains(
  cell: SpriteCell,
  x: number,
  y: number,
  actorX: number,
  actorY: number,
  col: number,
  row: number,
): boolean {
  if (cell.glyph === " ") {
    return false;
  }

  return x === actorX + col && y === actorY + row;
}

function renderGlyph(glyph: string): string {
  return glyph === " " ? "·" : glyph;
}

export class Aquarium {
  readonly width: number;
  readonly height: number;
  private readonly sprites: SpriteSheet;
  private readonly halfBlockSprites: HalfBlockSpriteSheet | null;
  private readonly palette: Palette;
  private readonly actors: ActorManager;
  private readonly fallbacks: Record<string, string>;
  private readonly roleLabels: Record<string, ActorLabel>;
  private tickCount = 0;

  constructor(width: number, height: number, options: AquariumOptions = {}) {
    this.width = width;
    this.height = height;

    const repoRoot = defaultRepoRoot();
    const manifestPath = resolve(repoRoot, "skins", "aquarium", "manifest.json");
    const spritesPath = resolve(repoRoot, "skins", "aquarium", "sprites.json");
    const manifest = readSkinManifestSync(manifestPath);

    this.sprites = options.spriteSheet ?? loadSpritesSync(spritesPath);
    this.halfBlockSprites = options.halfBlockSprites ?? null;
    this.fallbacks = {
      ...DEFAULT_FALLBACKS,
      ...(manifest.fallbacks ?? {}),
      ...(options.fallbacks ?? {}),
    };
    this.palette = new Palette(
      options.skinPalette ?? manifest.palette ?? DEFAULT_PALETTE,
      options.capabilities ?? detectCapabilities(),
    );
    this.roleLabels = options.roleLabels ?? {};
    this.actors = new ActorManager(width, height);
  }

  addActor(role: string, x: number, y: number, state = "idle"): Actor {
    // Accept role if it's in either sprite set
    const hasAscii = Boolean(this.sprites.roles[role]);
    const hasHalfBlock = Boolean(this.halfBlockSprites?.roles[role]);
    if (!hasAscii && !hasHalfBlock) {
      throw new Error(`Unknown sprite role: ${role}`);
    }

    return this.actors.addActor(role, x, y, state);
  }

  tick(): void {
    this.tickCount += 1;
    this.actors.tick((actor) => {
      // Use half-block frame count if available, else ASCII
      if (this.halfBlockSprites?.roles[actor.role]) {
        const hbDef = this.halfBlockSprites.roles[actor.role];
        const stateName = resolveHalfBlockState(actor.state, hbDef.states);
        const state = hbDef.states[stateName];
        return state?.frames.length ?? 1;
      }
      return this.getCurrentState(actor).frames.length;
    });
  }

  getActors(): readonly Actor[] {
    return this.actors.getActors();
  }

  render(buffer: ScreenBufferHD): void {
    if (this.halfBlockSprites) {
      this.renderHalfBlock(buffer);
      return;
    }
    this.renderAscii(buffer);
  }

  /** Half-block pixel rendering — 2× vertical resolution via ▀▄ characters. */
  private renderHalfBlock(buffer: ScreenBufferHD): void {
    const bg = this.palette.resolve("bg");
    const pixelHeight = this.height * 2; // 2 pixels per terminal row
    const canvas = new HalfBlockCanvas(this.width, pixelHeight);
    canvas.fill(bg);

    // Backdrop: water gradient + seabed
    this.renderHalfBlockBackdrop(canvas, bg);

    // Sprites
    for (const actor of this.actors.getActors()) {
      const hbDef = this.halfBlockSprites!.roles[actor.role];
      if (!hbDef) continue;

      const stateName = resolveHalfBlockState(actor.state, hbDef.states);
      const state = hbDef.states[stateName];
      if (!state || state.frames.length === 0) continue;

      const frame = state.frames[actor.frameIndex % state.frames.length];
      const pixels = resolveFramePixels(frame, this.palette);
      // Actor y is in terminal rows; convert to pixel rows
      canvas.blitPixels(actor.x, actor.y * 2, pixels);
    }

    // Render canvas to buffer
    canvas.renderToBuffer(buffer, bg);

    // Overlay text labels (rendered directly to buffer, not through half-block canvas)
    for (const actor of this.actors.getActors()) {
      this.renderHalfBlockLabel(buffer, actor, bg);
    }
  }

  private renderHalfBlockBackdrop(canvas: HalfBlockCanvas, bg: Rgb): void {
    const dim = this.palette.resolve("dim");
    const accent = this.palette.resolve("accent");
    const pixelHeight = canvas.pixelHeight;

    // Water gradient: slightly lighter at top, darker at bottom
    const waterLight: Rgb = { r: bg.r + 8, g: bg.g + 12, b: bg.b + 16 };
    const waterDark: Rgb = { r: Math.max(0, bg.r - 4), g: Math.max(0, bg.g - 4), b: bg.b };

    for (let y = 0; y < pixelHeight; y++) {
      const t = pixelHeight > 1 ? y / (pixelHeight - 1) : 0;
      const waterColor: Rgb = {
        r: Math.round(waterLight.r + t * (waterDark.r - waterLight.r)),
        g: Math.round(waterLight.g + t * (waterDark.g - waterLight.g)),
        b: Math.round(waterLight.b + t * (waterDark.b - waterLight.b)),
      };
      for (let x = 0; x < this.width; x++) {
        canvas.setPixel(x, y, waterColor);
      }
    }

    // Waterline — wave pattern at top (pixels 0-1)
    if (this.width > 4) {
      const waveColor: Rgb = {
        r: Math.min(255, dim.r + 20),
        g: Math.min(255, dim.g + 30),
        b: Math.min(255, dim.b + 40),
      };
      for (let x = 0; x < this.width; x++) {
        const wave = Math.sin((x + this.tickCount * 0.3) * 0.4);
        const py = wave > 0.3 ? 0 : 1;
        canvas.setPixel(x, py, waveColor);
      }
    }

    // Seabed — sandy bottom (last 3-4 pixel rows)
    const sand: Rgb = { r: 80, g: 60, b: 30 };
    const sandLight: Rgb = { r: 100, g: 80, b: 45 };
    if (pixelHeight >= 6) {
      const floorStart = pixelHeight - 3;
      for (let y = floorStart; y < pixelHeight; y++) {
        for (let x = 0; x < this.width; x++) {
          const isBump = (x + y) % 5 === 0;
          canvas.setPixel(x, y, isBump ? sandLight : sand);
        }
      }
    }

    // Kelp — small vertical strands
    if (pixelHeight >= 10 && this.width >= 12) {
      const kelpSpacing = Math.max(15, Math.floor(this.width / 3));
      for (let x = 5; x < this.width - 3; x += kelpSpacing) {
        const kelpHeight = Math.min(5, pixelHeight - 6);
        const baseY = pixelHeight - 4;
        for (let k = 0; k < kelpHeight; k++) {
          const sway = Math.sin((k + this.tickCount * 0.2) * 0.8) > 0 ? 1 : 0;
          canvas.setPixel(x + sway, baseY - k, accent);
        }
      }
    }

    // Bubbles — sparse, floating upward
    const bubbleCount = Math.max(1, Math.floor(this.width / 30));
    for (let i = 0; i < bubbleCount; i++) {
      const bx = ((i * 17 + Math.floor(this.tickCount / 2)) % Math.max(1, this.width - 2)) + 1;
      const by = 2 + ((this.tickCount + i * 11) % Math.max(1, pixelHeight - 6));
      if (by > 1 && by < pixelHeight - 4) {
        canvas.setPixel(bx, by, dim);
      }
    }
  }

  private renderHalfBlockLabel(buffer: ScreenBufferHD, actor: Actor, bg: Rgb): void {
    const label = this.roleLabels[actor.role];
    if (!label) return;

    const hbDef = this.halfBlockSprites?.roles[actor.role];
    if (!hbDef) return;

    const stateName = resolveHalfBlockState(actor.state, hbDef.states);
    const state = hbDef.states[stateName];
    if (!state || state.frames.length === 0) return;

    const frame = state.frames[actor.frameIndex % state.frames.length];
    const size = getFrameSize(frame);
    // Label goes below the sprite (in terminal rows)
    const spriteTermRows = Math.ceil(size.pixelHeight / 2);
    const labelY = actor.y + spriteTermRows;
    if (labelY >= this.height) return;

    const labelText = `${label.name}`;
    const x = Math.max(0, Math.min(actor.x, this.width - labelText.length));

    this.put(buffer, x, labelY, labelText.slice(0, this.width - x), {
      color: this.palette.resolve("accent"),
      bgColor: bg,
    });
  }

  /** ASCII sprite rendering — original path, kept for fallback. */
  private renderAscii(buffer: ScreenBufferHD): void {
    const bg = this.palette.resolve("bg");
    const fg = this.palette.resolve("fg");

    buffer.fill({
      char: " ",
      attr: {
        color: fg,
        bgColor: bg,
      },
    });

    this.renderBackdrop(buffer);

    for (const actor of this.actors.getActors()) {
      const frame = this.getCurrentFrame(actor);
      for (let row = 0; row < frame.cells.length; row += 1) {
        const cells = frame.cells[row] ?? [];
        for (let col = 0; col < cells.length; col += 1) {
          const cell = cells[col];
          const targetX = actor.x + col;
          const targetY = actor.y + row;

          if (
            !cell ||
            targetX < 0 ||
            targetX >= this.width ||
            targetY < 0 ||
            targetY >= this.height
          ) {
            continue;
          }

          const glyph = cell.blink && !this.isBlinkVisible() ? " " : cell.glyph;
          buffer.put(
            {
              x: targetX,
              y: targetY,
              attr: {
                color: this.palette.resolve(cell.fg),
                bgColor: this.palette.resolve(cell.bg),
              },
              wrap: false,
              dx: 0,
              dy: 0,
            },
            glyph,
          );
        }
      }
      this.renderActorLabel(buffer, actor, frame);
    }
  }

  describeDebugRender(maxSamplesPerActor = 3): string[] {
    const bg = this.palette.resolve("bg");
    const fg = this.palette.resolve("fg");
    const lines = [
      `[DEBUG] render fill fg=${formatColorValue(fg)} bg=${formatColorValue(bg)} mode=${this.palette.getColorLevel()}`,
    ];

    for (const actor of this.actors.getActors()) {
      const stateName = this.getCurrentStateName(actor);
      const state = this.getCurrentState(actor);
      const frameIndex = actor.frameIndex % state.frames.length;
      const frame = state.frames[frameIndex] ?? state.frames[0];
      const samples = this.collectCellSamples(frame, maxSamplesPerActor);
      const sampleSummary =
        samples.length === 0
          ? "all blank"
          : samples
              .map(
                (sample) =>
                  `${renderGlyph(sample.glyph)}@${sample.col},${sample.row} fg ${sample.fg}=${formatColorValue(this.palette.resolve(sample.fg))} bg ${sample.bg}=${formatColorValue(this.palette.resolve(sample.bg))}${sample.blink ? " blink" : ""}`,
              )
              .join(" ; ");
      lines.push(`[DEBUG] render ${actor.role}.${stateName}[${frameIndex}] ${sampleSummary}`);
    }

    return lines;
  }

  hitTest(x: number, y: number): Actor | undefined {
    const actors = [...this.actors.getActors()].reverse();
    for (const actor of actors) {
      const frame = this.getCurrentFrame(actor);
      for (let row = 0; row < frame.cells.length; row += 1) {
        const cells = frame.cells[row] ?? [];
        for (let col = 0; col < cells.length; col += 1) {
          const cell = cells[col];
          if (cell && spriteContains(cell, x, y, actor.x, actor.y, col, row)) {
            return actor;
          }
        }
      }

      if (containsPoint(this.getActorBounds(actor, frame), x, y)) {
        return actor;
      }
    }

    return undefined;
  }

  private renderBackdrop(buffer: ScreenBufferHD): void {
    const dim = this.palette.resolve("dim");
    const accent = this.palette.resolve("accent");
    const bg = this.palette.resolve("bg");

    // Waterline — subtle wave at top
    if (this.width > 4 && this.height > 2) {
      const wave = Array.from({ length: this.width - 2 }, (_, i) =>
        (i + this.tickCount) % 6 < 3 ? "~" : "≈",
      ).join("");
      this.put(buffer, 1, 0, wave, { color: dim, bgColor: bg });
    }

    // Gentle bubbles — fewer, slower
    const bubbleCount = Math.max(1, Math.floor(this.width / 40));
    for (let i = 0; i < bubbleCount; i += 1) {
      const x = ((i * 23 + Math.floor(this.tickCount / 3)) % Math.max(1, this.width - 2)) + 1;
      const y = 1 + ((this.tickCount + i * 7) % Math.max(1, this.height - 3));
      if (y > 0 && y < this.height - 1) {
        this.put(buffer, x, y, "°", { color: dim, bgColor: bg });
      }
    }

    // Seabed
    const floorY = this.height - 1;
    if (floorY >= 2) {
      const seabed = Array.from({ length: this.width }, (_, i) =>
        i % 3 === 0 ? "." : i % 5 === 0 ? "," : "_",
      ).join("");
      this.put(buffer, 0, floorY, seabed, { color: dim, bgColor: bg });
    }

    // Kelp — only if pane is tall enough
    if (this.height >= 6) {
      const kelpSpacing = Math.max(20, Math.floor(this.width / 3));
      for (let x = 6; x < this.width - 2; x += kelpSpacing) {
        const maxKelp = Math.min(3, this.height - 4);
        for (let k = 0; k < maxKelp; k += 1) {
          const glyph = (k + this.tickCount) % 2 === 0 ? ")" : "(";
          this.put(buffer, x, floorY - 1 - k, glyph, { color: accent, bgColor: bg });
        }
      }
    }
  }

  private renderActorLabel(buffer: ScreenBufferHD, actor: Actor, frame: SpriteFrame): void {
    const label = this.roleLabels[actor.role];
    if (!label) {
      return;
    }

    const bounds = this.getActorBounds(actor, frame);
    const bg = this.palette.resolve("bg");
    const labelText = `${label.name} - ${label.role}`;
    const x = bounds.x;
    const y = bounds.y + bounds.height - 1;

    this.put(buffer, x, y, labelText.slice(0, bounds.width), {
      color: this.palette.resolve("accent"),
      bgColor: bg,
    });
  }

  private getActorBounds(actor: Actor, frame = this.getCurrentFrame(actor)): ActorBounds {
    const label = this.roleLabels[actor.role];
    const spriteWidth = Math.max(...frame.cells.map((row) => row.length), 1);
    const spriteHeight = frame.cells.length;
    const labelWidth = label ? `${label.name} - ${label.role}`.length : 0;
    const width = Math.min(this.width, Math.max(spriteWidth, labelWidth) + 2);
    const spriteCenter = actor.x + Math.floor(spriteWidth / 2);
    const x = clamp(spriteCenter - Math.floor(width / 2), 0, Math.max(0, this.width - width));
    const labelFitsBelow = actor.y + spriteHeight < this.height;
    const y = clamp(
      labelFitsBelow ? actor.y : actor.y - 1,
      0,
      Math.max(0, this.height - spriteHeight - 1),
    );

    return { x, y, width, height: spriteHeight + 1 };
  }

  private put(
    buffer: ScreenBufferHD,
    x: number,
    y: number,
    text: string,
    attr: Record<string, unknown>,
  ): void {
    if (text.length === 0 || y < 0 || y >= this.height || x >= this.width) {
      return;
    }

    const safeX = Math.max(0, x);
    const clipped = text.slice(0, Math.max(0, this.width - safeX));
    buffer.put({ x: safeX, y, attr, wrap: false, dx: 0, dy: 0 }, clipped);
  }

  private collectCellSamples(
    frame: SpriteFrame,
    limit: number,
  ): Array<SpriteCell & { row: number; col: number }> {
    const samples: Array<SpriteCell & { row: number; col: number }> = [];

    for (let row = 0; row < frame.cells.length && samples.length < limit; row += 1) {
      const cells = frame.cells[row] ?? [];
      for (let col = 0; col < cells.length && samples.length < limit; col += 1) {
        const cell = cells[col];
        if (!cell || cell.glyph === " ") {
          continue;
        }

        samples.push({ ...cell, row, col });
      }
    }

    return samples;
  }

  private getCurrentStateName(actor: Actor): string {
    return resolveStateName(actor.state, this.sprites.roles[actor.role].states, this.fallbacks);
  }

  private getCurrentState(actor: Actor): SpriteState {
    const sprite = this.sprites.roles[actor.role];
    const stateName = this.getCurrentStateName(actor);
    return sprite.states[stateName];
  }

  private getCurrentFrame(actor: Actor): SpriteFrame {
    const state = this.getCurrentState(actor);
    return state.frames[actor.frameIndex % state.frames.length] ?? state.frames[0];
  }

  private isBlinkVisible(): boolean {
    return Math.floor(this.tickCount / 2) % 2 === 0;
  }
}

function containsPoint(bounds: ActorBounds, x: number, y: number): boolean {
  return (
    x >= bounds.x && y >= bounds.y && x < bounds.x + bounds.width && y < bounds.y + bounds.height
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
