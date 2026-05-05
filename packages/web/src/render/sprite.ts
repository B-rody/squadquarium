import { GlyphCanvas } from "./canvas.js";

export type SpriteState = "idle" | "working" | "blocked" | "celebrate";

interface SpriteCell {
  glyph: string;
  fg: string;
  bg: string;
  blink?: boolean;
}

interface SpriteFrame {
  rows?: number;
  cols?: number;
  cells?: SpriteCell[][];
}

type StateFrames = SpriteFrame[] | { frames?: SpriteFrame[] };

interface RoleSprites {
  states?: Record<string, StateFrames>;
  [state: string]: StateFrames | Record<string, StateFrames> | undefined;
}

export interface SpritesJson {
  roles?: Record<string, RoleSprites>;
  [role: string]: RoleSprites | Record<string, RoleSprites> | undefined;
}

interface SkinFallbacks {
  [state: string]: string;
}

const warnedGlyphs = new Set<string>();

function enforceAllowlist(glyph: string, allowlist: string[]): string {
  if (allowlist.includes(glyph)) return glyph;
  if (!warnedGlyphs.has(glyph)) {
    console.warn(
      `[squadquarium] glyph not in allowlist: U+${glyph.codePointAt(0)?.toString(16).toUpperCase().padStart(4, "0")} "${glyph}" — rendering ▢`,
    );
    warnedGlyphs.add(glyph);
    if (typeof window !== "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sq = (window as any).__squadquarium ?? {};
      sq.forbiddenGlyphCount = (sq.forbiddenGlyphCount ?? 0) + 1;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__squadquarium = sq;
    }
  }
  return "▢";
}

export function clearGlyphWarnCache(): void {
  warnedGlyphs.clear();
}

function getRoleData(spritesJson: SpritesJson, role: string): RoleSprites | undefined {
  const root = isRecord(spritesJson.roles)
    ? (spritesJson.roles as Record<string, RoleSprites>)
    : (spritesJson as Record<string, RoleSprites>);
  return root[role];
}

function getFramesForState(roleData: RoleSprites, state: string): SpriteFrame[] | undefined {
  const stateMap = isRecord(roleData.states)
    ? roleData.states
    : (roleData as Record<string, StateFrames>);
  const entry = stateMap[state];
  if (Array.isArray(entry)) return entry as SpriteFrame[];
  if (isRecord(entry) && Array.isArray(entry.frames)) return entry.frames as SpriteFrame[];
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function drawSprite(
  glyphCanvas: GlyphCanvas,
  spritesJson: SpritesJson,
  role: string,
  state: SpriteState,
  frame: number,
  originRow: number,
  originCol: number,
  glyphAllowlist: string[],
  fallbacks: SkinFallbacks = {},
): void {
  const roleData = getRoleData(spritesJson, role);
  if (!roleData) return;

  let resolvedState: string = state;
  if (!getFramesForState(roleData, resolvedState)) {
    resolvedState = fallbacks[state] ?? "idle";
  }
  if (!getFramesForState(roleData, resolvedState)) {
    resolvedState = "idle";
  }

  const frames = getFramesForState(roleData, resolvedState);
  if (!frames || frames.length === 0) return;

  const spriteFrame = frames[frame % frames.length];
  const cells = spriteFrame?.cells;
  if (!cells) return;
  for (let r = 0; r < cells.length; r++) {
    const row = cells[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (!cell) continue;
      const safeGlyph = enforceAllowlist(cell.glyph, glyphAllowlist);
      glyphCanvas.drawCell(originRow + r, originCol + c, safeGlyph, cell.fg, cell.bg, cell.blink);
    }
  }
}
