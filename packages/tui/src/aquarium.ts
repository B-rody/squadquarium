import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ScreenBufferHD } from "terminal-kit";

import { Actor, ActorManager } from "./actor.js";
import { DEFAULT_PALETTE, Palette } from "./palette.js";
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
  skinPalette?: Record<string, string>;
  fallbacks?: Record<string, string>;
  capabilities?: {
    truecolor: boolean;
  };
}

const DEFAULT_FALLBACKS = {
  working: "idle",
  blocked: "idle",
  celebrate: "working",
  celebrating: "celebrate",
} satisfies Record<string, string>;

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

export class Aquarium {
  readonly width: number;
  readonly height: number;
  private readonly sprites: SpriteSheet;
  private readonly palette: Palette;
  private readonly actors: ActorManager;
  private readonly fallbacks: Record<string, string>;
  private tickCount = 0;

  constructor(width: number, height: number, options: AquariumOptions = {}) {
    this.width = width;
    this.height = height;

    const repoRoot = defaultRepoRoot();
    const manifestPath = resolve(repoRoot, "skins", "aquarium", "manifest.json");
    const spritesPath = resolve(repoRoot, "skins", "aquarium", "sprites.json");
    const manifest = readSkinManifestSync(manifestPath);

    this.sprites = options.spriteSheet ?? loadSpritesSync(spritesPath);
    this.fallbacks = {
      ...DEFAULT_FALLBACKS,
      ...(manifest.fallbacks ?? {}),
      ...(options.fallbacks ?? {}),
    };
    this.palette = new Palette(
      options.skinPalette ?? manifest.palette ?? DEFAULT_PALETTE,
      options.capabilities ?? detectCapabilities(),
    );
    this.actors = new ActorManager(width, height);
  }

  addActor(role: string, x: number, y: number, state = "idle"): Actor {
    if (!this.sprites.roles[role]) {
      throw new Error(`Unknown sprite role: ${role}`);
    }

    return this.actors.addActor(role, x, y, state);
  }

  tick(): void {
    this.tickCount += 1;
    this.actors.tick((actor) => this.getCurrentState(actor).frames.length);
  }

  getActors(): readonly Actor[] {
    return this.actors.getActors();
  }

  render(buffer: ScreenBufferHD): void {
    const bg = this.palette.resolve("bg");
    const fg = this.palette.resolve("fg");

    buffer.fill({
      char: " ",
      attr: {
        color: fg,
        bgColor: bg,
      },
    });

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
    }
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
    }

    return undefined;
  }

  private getCurrentState(actor: Actor): SpriteState {
    const sprite = this.sprites.roles[actor.role];
    const stateName = resolveStateName(actor.state, sprite.states, this.fallbacks);
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
