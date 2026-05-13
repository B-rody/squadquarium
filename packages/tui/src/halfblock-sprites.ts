import { readFileSync } from "node:fs";
import type { Pixel } from "./halfblock.js";
import type { Palette } from "./palette.js";

/** A single frame of half-block pixel art. Each row is an array of palette tokens (null = transparent). */
export interface HalfBlockFrame {
  pixels: (string | null)[][];
}

export interface HalfBlockState {
  frames: HalfBlockFrame[];
}

export interface HalfBlockSpriteDef {
  states: Record<string, HalfBlockState>;
}

export interface HalfBlockSpriteSheet {
  format: "halfblock";
  roles: Record<string, HalfBlockSpriteDef>;
}

/**
 * Load and validate a half-block sprite sheet from JSON.
 */
export function loadHalfBlockSpritesSync(filePath: string): HalfBlockSpriteSheet {
  const raw = JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
  return validateHalfBlockSheet(raw);
}

export function parseHalfBlockSheet(json: string): HalfBlockSpriteSheet {
  return validateHalfBlockSheet(JSON.parse(json) as Record<string, unknown>);
}

function validateHalfBlockSheet(raw: Record<string, unknown>): HalfBlockSpriteSheet {
  if (raw.format !== "halfblock") {
    throw new Error('Half-block sprite sheet must have format: "halfblock"');
  }
  const roles = raw.roles as Record<string, unknown>;
  if (!roles || typeof roles !== "object") {
    throw new Error("Half-block sprite sheet must have roles object");
  }

  const validated: Record<string, HalfBlockSpriteDef> = {};
  for (const [role, def] of Object.entries(roles)) {
    validated[role] = validateSpriteDef(def as Record<string, unknown>, role);
  }

  return { format: "halfblock", roles: validated };
}

function validateSpriteDef(raw: Record<string, unknown>, role: string): HalfBlockSpriteDef {
  const states = raw.states as Record<string, unknown>;
  if (!states || typeof states !== "object") {
    throw new Error(`Half-block sprite ${role} must have states object`);
  }

  const validated: Record<string, HalfBlockState> = {};
  for (const [state, stateVal] of Object.entries(states)) {
    const sv = stateVal as Record<string, unknown>;
    const frames = sv.frames as unknown[];
    if (!Array.isArray(frames) || frames.length === 0) {
      throw new Error(`Half-block sprite ${role}.${state} must have non-empty frames array`);
    }
    validated[state] = {
      frames: frames.map((f, i) => validateFrame(f as Record<string, unknown>, role, state, i)),
    };
  }

  return { states: validated };
}

function validateFrame(
  raw: Record<string, unknown>,
  role: string,
  state: string,
  index: number,
): HalfBlockFrame {
  const pixels = raw.pixels as unknown[][];
  if (!Array.isArray(pixels) || pixels.length === 0) {
    throw new Error(`Half-block frame ${role}.${state}[${index}] must have non-empty pixels array`);
  }

  return {
    pixels: pixels.map((row) => {
      if (!Array.isArray(row)) {
        throw new Error(`Half-block frame ${role}.${state}[${index}] pixel row must be an array`);
      }
      return row.map((cell) => (cell === null ? null : String(cell)));
    }),
  };
}

/** Default state fallback chain. */
const STATE_FALLBACKS: Record<string, string> = {
  working: "idle",
  blocked: "idle",
  celebrate: "working",
  celebrating: "celebrate",
};

/**
 * Resolve a half-block sprite frame to a 2D array of resolved RGB pixels.
 * null tokens remain null (transparent).
 */
export function resolveFramePixels(frame: HalfBlockFrame, palette: Palette): (Pixel | null)[][] {
  return frame.pixels.map((row) =>
    row.map((token) => (token === null ? null : palette.resolve(token))),
  );
}

/** Get the sprite dimensions (max width across all pixel rows, and pixel row count). */
export function getFrameSize(frame: HalfBlockFrame): { width: number; pixelHeight: number } {
  const pixelHeight = frame.pixels.length;
  const width = Math.max(...frame.pixels.map((row) => row.length), 0);
  return { width, pixelHeight };
}

/** Resolve a state name with fallback chain (like the ASCII sprite renderer). */
export function resolveHalfBlockState(
  requestedState: string,
  states: Record<string, HalfBlockState>,
): string {
  if (states[requestedState]) return requestedState;

  const visited = new Set<string>([requestedState]);
  let current = requestedState;
  while (STATE_FALLBACKS[current] && !visited.has(STATE_FALLBACKS[current])) {
    current = STATE_FALLBACKS[current];
    if (states[current]) return current;
    visited.add(current);
  }

  return states.idle ? "idle" : (Object.keys(states)[0] ?? requestedState);
}
