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
  type HalfBlockFrame,
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
  autoCycleStates?: boolean;
}

const DEFAULT_FALLBACKS = {
  working: "idle",
  blocked: "idle",
  celebrate: "working",
  celebrating: "celebrate",
} satisfies Record<string, string>;

export interface ActorLabel {
  id?: string;
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

function halfBlockContains(
  frame: HalfBlockFrame,
  x: number,
  y: number,
  actorX: number,
  actorY: number,
): boolean {
  const col = x - actorX;
  const cellRow = y - actorY;
  if (col < 0 || cellRow < 0) {
    return false;
  }

  const topPixelRow = cellRow * 2;
  const bottomPixelRow = topPixelRow + 1;
  return (
    (frame.pixels[topPixelRow]?.[col] ?? null) !== null ||
    (frame.pixels[bottomPixelRow]?.[col] ?? null) !== null
  );
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
  private readonly actorLabels = new WeakMap<Actor, ActorLabel>();
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
    this.actors = new ActorManager(width, height, { autoCycleStates: options.autoCycleStates });
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

  setActorLabel(actor: Actor, label: ActorLabel): void {
    this.actorLabels.set(actor, label);
  }

  setActorStateById(id: string, state: string): boolean {
    let changed = false;
    for (const actor of this.actors.getActors()) {
      const label = this.getActorLabel(actor);
      if (label?.id === id) {
        actor.setState(state);
        changed = true;
      }
    }
    return changed;
  }

  tick(): void {
    this.tickCount += 1;
    this.actors.tick((actor) => {
      // Use half-block frame count if available, else ASCII
      const halfBlockFrame = this.getCurrentHalfBlockFrame(actor);
      if (halfBlockFrame) {
        return halfBlockFrame.frameCount;
      }

      const asciiSprite = this.sprites.roles[actor.role];
      return asciiSprite ? this.getCurrentState(actor).frames.length : 1;
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
      const halfBlockFrame = this.getCurrentHalfBlockFrame(actor);
      if (!halfBlockFrame) continue;

      const frame = halfBlockFrame.frame;
      const pixels = this.tintPixels(resolveFramePixels(frame, this.palette), actor);
      // Actor y is in terminal rows; convert to pixel rows
      canvas.blitPixels(actor.x, actor.y * 2, pixels);
    }

    // Render canvas to buffer
    canvas.renderToBuffer(buffer, bg);

    // Overlay text labels (rendered directly to buffer, not through half-block canvas)
    for (const actor of this.actors.getActors()) {
      const halfBlockFrame = this.getCurrentHalfBlockFrame(actor);
      if (halfBlockFrame) {
        this.renderHalfBlockLabel(buffer, actor, bg);
        this.renderThinkingMarker(
          buffer,
          actor,
          this.getHalfBlockActorBounds(actor, halfBlockFrame.frame),
          bg,
        );
      } else if (this.sprites.roles[actor.role]) {
        this.renderAsciiActor(buffer, actor);
      }
    }
  }

  private renderHalfBlockBackdrop(canvas: HalfBlockCanvas, bg: Rgb): void {
    const dim = this.palette.resolve("dim");
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
      const kelp = this.palette.resolve("kelp");
      const kelpLight = this.palette.resolve("kelpLight");
      const kelpSpacing = Math.max(15, Math.floor(this.width / 3));
      for (let x = 5; x < this.width - 3; x += kelpSpacing) {
        const kelpHeight = Math.min(5, pixelHeight - 6);
        const baseY = pixelHeight - 4;
        for (let k = 0; k < kelpHeight; k++) {
          const sway = Math.sin((k + this.tickCount * 0.2) * 0.8) > 0 ? 1 : 0;
          canvas.setPixel(x + sway, baseY - k, k % 2 === 0 ? kelpLight : kelp);
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
    const label = this.getActorLabel(actor);
    if (!label) return;

    const hbDef = this.halfBlockSprites?.roles[actor.role];
    if (!hbDef) return;

    const stateName = resolveHalfBlockState(actor.state, hbDef.states);
    const state = hbDef.states[stateName];
    if (!state || state.frames.length === 0) return;

    const frame = state.frames[actor.frameIndex % state.frames.length];
    const bounds = this.getHalfBlockActorBounds(actor, frame);
    const labelY = bounds.y + bounds.height - 1;
    if (labelY >= this.height) return;

    const labelText = this.formatHalfBlockLabel(actor, label);
    const x = bounds.x;
    const labelColor = this.getActorTint(actor);

    this.put(buffer, x, labelY, labelText.slice(0, this.width - x), {
      color: labelColor,
      bgColor: actor.state === "working" ? mixRgb(bg, labelColor, 0.18) : bg,
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
      this.renderAsciiActor(buffer, actor);
    }
  }

  private renderAsciiActor(buffer: ScreenBufferHD, actor: Actor): void {
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
              color: this.resolveActorColor(actor, cell.fg),
              bgColor: this.resolveActorColor(actor, cell.bg),
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

  describeDebugRender(maxSamplesPerActor = 3): string[] {
    const bg = this.palette.resolve("bg");
    const fg = this.palette.resolve("fg");
    const lines = [
      `[DEBUG] render fill fg=${formatColorValue(fg)} bg=${formatColorValue(bg)} mode=${this.palette.getColorLevel()}`,
    ];

    for (const actor of this.actors.getActors()) {
      const halfBlockFrame = this.getCurrentHalfBlockFrame(actor);
      if (halfBlockFrame) {
        const samples = this.collectHalfBlockSamples(halfBlockFrame.frame, maxSamplesPerActor);
        const sampleSummary =
          samples.length === 0
            ? "all transparent"
            : samples
                .map(
                  (sample) =>
                    `${sample.token}@${sample.col},${sample.row}=${formatColorValue(this.palette.resolve(sample.token))}`,
                )
                .join(" ; ");
        lines.push(
          `[DEBUG] render ${actor.role}.${halfBlockFrame.stateName}[${halfBlockFrame.frameIndex}] halfblock ${sampleSummary}`,
        );
        continue;
      }

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
      const halfBlockFrame = this.getCurrentHalfBlockFrame(actor);
      if (halfBlockFrame) {
        if (halfBlockContains(halfBlockFrame.frame, x, y, actor.x, actor.y)) {
          return actor;
        }

        if (containsPoint(this.getHalfBlockActorBounds(actor, halfBlockFrame.frame), x, y)) {
          return actor;
        }
        continue;
      }

      if (!this.sprites.roles[actor.role]) {
        continue;
      }

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
      const kelp = this.palette.resolve("kelp");
      const kelpLight = this.palette.resolve("kelpLight");
      const kelpSpacing = Math.max(20, Math.floor(this.width / 3));
      for (let x = 6; x < this.width - 2; x += kelpSpacing) {
        const maxKelp = Math.min(3, this.height - 4);
        for (let k = 0; k < maxKelp; k += 1) {
          const glyph = (k + this.tickCount) % 2 === 0 ? ")" : "(";
          this.put(buffer, x, floorY - 1 - k, glyph, {
            color: k % 2 === 0 ? kelpLight : kelp,
            bgColor: bg,
          });
        }
      }
    }
  }

  private renderActorLabel(buffer: ScreenBufferHD, actor: Actor, frame: SpriteFrame): void {
    const label = this.getActorLabel(actor);
    if (!label) {
      return;
    }

    const bounds = this.getActorBounds(actor, frame);
    const bg = this.palette.resolve("bg");
    const labelText = this.formatActorLabel(actor, label);
    const x = bounds.x;
    const y = bounds.y + bounds.height - 1;

    this.put(buffer, x, y, labelText.slice(0, bounds.width), {
      color: this.palette.resolve("accent"),
      bgColor: actor.state === "working" ? mixRgb(bg, this.getActorTint(actor), 0.18) : bg,
    });
    this.renderThinkingMarker(buffer, actor, bounds, bg);
  }

  private getActorBounds(actor: Actor, frame = this.getCurrentFrame(actor)): ActorBounds {
    const label = this.getActorLabel(actor);
    const spriteWidth = Math.max(...frame.cells.map((row) => row.length), 1);
    const spriteHeight = frame.cells.length;
    const labelWidth = label ? this.formatActorLabel(actor, label).length : 0;
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

  private getHalfBlockActorBounds(actor: Actor, frame: HalfBlockFrame): ActorBounds {
    const label = this.getActorLabel(actor);
    const size = getFrameSize(frame);
    const spriteWidth = Math.max(size.width, 1);
    const spriteHeight = Math.max(Math.ceil(size.pixelHeight / 2), 1);
    const labelWidth = label ? this.formatHalfBlockLabel(actor, label).length : 0;
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

  private getActorLabel(actor: Actor): ActorLabel | undefined {
    return this.actorLabels.get(actor) ?? this.roleLabels[actor.role];
  }

  private formatActorLabel(actor: Actor, label: ActorLabel): string {
    return actor.state === "working" ? `[${label.name} BUSY]` : `[${label.name}]`;
  }

  private formatHalfBlockLabel(actor: Actor, label: ActorLabel): string {
    return this.formatActorLabel(actor, label);
  }

  private tintPixels(pixels: (Rgb | null)[][], actor: Actor): (Rgb | null)[][] {
    const fg = this.palette.resolve("fg");
    const dim = this.palette.resolve("dim");
    const tint = this.getActorTint(actor);
    const tintDim = mixRgb(tint, this.palette.resolve("bg"), 0.45);

    return pixels.map((row) =>
      row.map((pixel) => {
        if (!pixel) return null;
        if (rgbEquals(pixel, fg)) return tint;
        if (rgbEquals(pixel, dim)) return tintDim;
        return pixel;
      }),
    );
  }

  private resolveActorColor(actor: Actor, token: string): Rgb {
    if (token === "fg") return this.getActorTint(actor);
    if (token === "dim") return mixRgb(this.getActorTint(actor), this.palette.resolve("bg"), 0.45);
    return this.palette.resolve(token);
  }

  private getActorTint(actor: Actor): Rgb {
    const label = this.getActorLabel(actor);
    const key = `${label?.name ?? actor.role}:${label?.role ?? actor.state}`;
    const base = tintFromIdentity(key);
    return actor.state === "working" ? mixRgb(base, this.palette.resolve("accent"), 0.22) : base;
  }

  private renderThinkingMarker(
    buffer: ScreenBufferHD,
    actor: Actor,
    bounds: ActorBounds,
    bg: Rgb,
  ): void {
    if (actor.state !== "working") {
      return;
    }

    const marker = this.formatWorkingMarker(bounds.width);
    const travel = Math.max(1, bounds.width - marker.length);
    const phase = this.tickCount % (travel + 1);
    const x = clamp(bounds.x + phase, 0, Math.max(0, this.width - marker.length));
    const y = bounds.y > 0 ? bounds.y - 1 : bounds.y;
    this.put(buffer, x, y, marker, {
      color: this.palette.resolve("accent"),
      bgColor: mixRgb(bg, this.getActorTint(actor), 0.24),
    });
  }

  private formatWorkingMarker(width: number): string {
    if (width >= 15) return ">>> WORKING <<<";
    if (width >= 9) return "WORKING";
    return "***";
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

  private collectHalfBlockSamples(
    frame: HalfBlockFrame,
    limit: number,
  ): Array<{ token: string; row: number; col: number }> {
    const samples: Array<{ token: string; row: number; col: number }> = [];

    for (let row = 0; row < frame.pixels.length && samples.length < limit; row += 1) {
      const cells = frame.pixels[row] ?? [];
      for (let col = 0; col < cells.length && samples.length < limit; col += 1) {
        const token = cells[col];
        if (token === null || token === undefined) {
          continue;
        }

        samples.push({ token, row, col });
      }
    }

    return samples;
  }

  private getCurrentHalfBlockFrame(
    actor: Actor,
  ):
    | { stateName: string; frameIndex: number; frame: HalfBlockFrame; frameCount: number }
    | undefined {
    const sprite = this.halfBlockSprites?.roles[actor.role];
    if (!sprite) {
      return undefined;
    }

    const stateName = resolveHalfBlockState(actor.state, sprite.states);
    const state = sprite.states[stateName];
    if (!state || state.frames.length === 0) {
      return undefined;
    }

    const frameIndex = actor.frameIndex % state.frames.length;
    const frame = state.frames[frameIndex] ?? state.frames[0];
    return { stateName, frameIndex, frame, frameCount: state.frames.length };
  }

  private getCurrentStateName(actor: Actor): string {
    const sprite = this.sprites.roles[actor.role];
    if (!sprite) {
      return "idle";
    }

    return resolveStateName(actor.state, sprite.states, this.fallbacks);
  }

  private getCurrentState(actor: Actor): SpriteState {
    const sprite = this.sprites.roles[actor.role];
    if (!sprite) {
      throw new Error(`Unknown ASCII sprite role: ${actor.role}`);
    }

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

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

const IDENTITY_TINTS: Rgb[] = [
  { r: 126, g: 222, b: 255 },
  { r: 255, g: 186, b: 117 },
  { r: 176, g: 235, b: 127 },
  { r: 255, g: 136, b: 184 },
  { r: 164, g: 153, b: 255 },
  { r: 100, g: 226, b: 190 },
  { r: 255, g: 219, b: 109 },
  { r: 118, g: 176, b: 255 },
  { r: 255, g: 151, b: 122 },
  { r: 119, g: 232, b: 133 },
  { r: 231, g: 143, b: 255 },
  { r: 128, g: 211, b: 216 },
  { r: 244, g: 170, b: 211 },
  { r: 204, g: 229, b: 110 },
  { r: 148, g: 197, b: 255 },
  { r: 255, g: 199, b: 154 },
  { r: 151, g: 240, b: 208 },
  { r: 222, g: 172, b: 255 },
  { r: 165, g: 224, b: 147 },
  { r: 255, g: 169, b: 169 },
  { r: 117, g: 214, b: 255 },
  { r: 236, g: 216, b: 130 },
  { r: 191, g: 188, b: 255 },
  { r: 137, g: 232, b: 172 },
];

function tintFromIdentity(value: string): Rgb {
  const hash = hashString(value);
  const mixedHash = Math.imul(hash ^ (hash >>> 16), 2_654_435_761) >>> 0;
  return IDENTITY_TINTS[mixedHash % IDENTITY_TINTS.length] ?? hslToRgb(mixedHash % 360, 0.72, 0.68);
}

function hslToRgb(hue: number, saturation: number, lightness: number): Rgb {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const huePrime = hue / 60;
  const second = chroma * (1 - Math.abs((huePrime % 2) - 1));
  const [r1, g1, b1] =
    huePrime < 1
      ? [chroma, second, 0]
      : huePrime < 2
        ? [second, chroma, 0]
        : huePrime < 3
          ? [0, chroma, second]
          : huePrime < 4
            ? [0, second, chroma]
            : huePrime < 5
              ? [second, 0, chroma]
              : [chroma, 0, second];
  const match = lightness - chroma / 2;

  return {
    r: Math.round((r1 + match) * 255),
    g: Math.round((g1 + match) * 255),
    b: Math.round((b1 + match) * 255),
  };
}

function rgbEquals(a: Rgb, b: Rgb): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b;
}

function mixRgb(a: Rgb, b: Rgb, bWeight: number): Rgb {
  const aWeight = 1 - bWeight;
  return {
    r: Math.round(a.r * aWeight + b.r * bWeight),
    g: Math.round(a.g * aWeight + b.g * bWeight),
    b: Math.round(a.b * aWeight + b.b * bWeight),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
