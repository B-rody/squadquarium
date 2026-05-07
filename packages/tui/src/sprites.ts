import { readFile, readFileSync } from "node:fs";
import { promisify } from "node:util";

const readFileAsync = promisify(readFile);

export interface SpriteCell {
  glyph: string;
  fg: string;
  bg: string;
  blink?: boolean;
}

export interface SpriteFrame {
  cells: SpriteCell[][];
  _comment?: string;
}

export interface SpriteState {
  frames: SpriteFrame[];
}

export interface SpriteDef {
  states: Record<string, SpriteState>;
  _comment?: string;
}

export interface SpriteSheet {
  _comment?: string;
  roles: Record<string, SpriteDef>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function expectString(value: unknown, message: string): string {
  if (typeof value !== "string") {
    throw new TypeError(message);
  }

  return value;
}

function expectBoolean(value: unknown, message: string): boolean {
  if (typeof value !== "boolean") {
    throw new TypeError(message);
  }

  return value;
}

function validateCell(
  value: unknown,
  role: string,
  state: string,
  frameIndex: number,
  rowIndex: number,
  colIndex: number,
): SpriteCell {
  if (!isRecord(value)) {
    throw new TypeError(
      `Sprite cell ${role}.${state}[${frameIndex}].cells[${rowIndex}][${colIndex}] must be an object.`,
    );
  }

  return {
    glyph: expectString(
      value.glyph,
      `Sprite cell ${role}.${state}[${frameIndex}].cells[${rowIndex}][${colIndex}].glyph must be a string.`,
    ),
    fg: expectString(
      value.fg,
      `Sprite cell ${role}.${state}[${frameIndex}].cells[${rowIndex}][${colIndex}].fg must be a string.`,
    ),
    bg: expectString(
      value.bg,
      `Sprite cell ${role}.${state}[${frameIndex}].cells[${rowIndex}][${colIndex}].bg must be a string.`,
    ),
    ...(value.blink === undefined
      ? {}
      : {
          blink: expectBoolean(
            value.blink,
            `Sprite cell ${role}.${state}[${frameIndex}].cells[${rowIndex}][${colIndex}].blink must be a boolean.`,
          ),
        }),
  };
}

function validateFrame(
  value: unknown,
  role: string,
  state: string,
  frameIndex: number,
): SpriteFrame {
  if (!isRecord(value)) {
    throw new TypeError(`Sprite frame ${role}.${state}[${frameIndex}] must be an object.`);
  }

  if (!Array.isArray(value.cells) || value.cells.length === 0) {
    throw new TypeError(
      `Sprite frame ${role}.${state}[${frameIndex}].cells must be a non-empty 2D array.`,
    );
  }

  return {
    _comment:
      value._comment === undefined
        ? undefined
        : expectString(
            value._comment,
            `Sprite frame ${role}.${state}[${frameIndex}]._comment must be a string.`,
          ),
    cells: value.cells.map((row, rowIndex) => {
      if (!Array.isArray(row) || row.length === 0) {
        throw new TypeError(
          `Sprite frame ${role}.${state}[${frameIndex}].cells[${rowIndex}] must be a non-empty array.`,
        );
      }

      return row.map((cell, colIndex) =>
        validateCell(cell, role, state, frameIndex, rowIndex, colIndex),
      );
    }),
  };
}

function validateState(value: unknown, role: string, state: string): SpriteState {
  if (!isRecord(value)) {
    throw new TypeError(`Sprite state ${role}.${state} must be an object.`);
  }

  if (!Array.isArray(value.frames) || value.frames.length === 0) {
    throw new TypeError(`Sprite state ${role}.${state}.frames must be a non-empty array.`);
  }

  return {
    frames: value.frames.map((frame, frameIndex) => validateFrame(frame, role, state, frameIndex)),
  };
}

function validateRole(value: unknown, role: string): SpriteDef {
  if (!isRecord(value)) {
    throw new TypeError(`Sprite role ${role} must be an object.`);
  }

  if (!isRecord(value.states) || Object.keys(value.states).length === 0) {
    throw new TypeError(`Sprite role ${role}.states must be a non-empty object.`);
  }

  const states: Record<string, SpriteState> = {};
  for (const [stateName, stateValue] of Object.entries(value.states)) {
    states[stateName] = validateState(stateValue, role, stateName);
  }

  return {
    states,
    _comment:
      value._comment === undefined
        ? undefined
        : expectString(value._comment, `Sprite role ${role}._comment must be a string.`),
  };
}

export function validateSpriteSheet(value: unknown): SpriteSheet {
  if (!isRecord(value)) {
    throw new TypeError("Sprite sheet must be an object.");
  }

  if (!isRecord(value.roles) || Object.keys(value.roles).length === 0) {
    throw new TypeError("Sprite sheet.roles must be a non-empty object.");
  }

  const roles: Record<string, SpriteDef> = {};
  for (const [roleName, roleValue] of Object.entries(value.roles)) {
    roles[roleName] = validateRole(roleValue, roleName);
  }

  return {
    roles,
    _comment:
      value._comment === undefined
        ? undefined
        : expectString(value._comment, "Sprite sheet._comment must be a string."),
  };
}

export function parseSpriteSheet(json: string): SpriteSheet {
  return validateSpriteSheet(JSON.parse(json) as unknown);
}

export async function loadSprites(path: string): Promise<SpriteSheet> {
  const json = await readFileAsync(path, "utf8");
  return parseSpriteSheet(json);
}

export function loadSpritesSync(path: string): SpriteSheet {
  return parseSpriteSheet(readFileSync(path, "utf8"));
}
