import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveSquadRoot } from "./resolve-squad-root.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESET = "\x1B[0m";
const FG_COLORS: Record<string, string> = {
  accent: "\x1B[36m",
  alert: "\x1B[31m",
  dim: "\x1B[90m",
};

export interface SpriteCell {
  glyph?: string;
  fg?: string;
}

export interface SpriteFrame {
  cells?: SpriteCell[][];
}

export interface RoleSprite {
  states?: {
    idle?: {
      frames?: SpriteFrame[];
    };
  };
}

export interface SpritesJson {
  roles?: Record<string, RoleSprite>;
}

interface AgentBand {
  name: string;
  role: string;
  roleKey: string;
}

const AGENTS: AgentBand[] = [
  { name: "Dallas", role: "Lead", roleKey: "lead" },
  { name: "Lambert", role: "Frontend Dev", roleKey: "frontend" },
  { name: "Parker", role: "Backend Dev", roleKey: "backend" },
  { name: "Ripley", role: "Tester/Reviewer", roleKey: "tester" },
  { name: "Scribe", role: "Session Logger", roleKey: "scribe" },
];

export function parseDuration(value: string): number {
  const trimmed = value.trim().toLowerCase();
  const match = /^(\d+)(ms|s)?$/.exec(trimmed);
  if (!match) return 0;
  const amount = Number.parseInt(match[1] ?? "0", 10);
  return match[2] === "s" ? amount * 1000 : amount;
}

export function renderSprite(
  sprite: RoleSprite | undefined,
  frameIndex = 0,
  color = false,
): string[] {
  const frames = sprite?.states?.idle?.frames;
  const frame = frames?.[frames.length ? frameIndex % frames.length : 0];
  if (!frame?.cells?.length) return ["[~~~]"];

  return frame.cells.map((row) =>
    row
      .map((cell) => {
        const glyph = cell.glyph ?? " ";
        const ansi = cell.fg ? FG_COLORS[cell.fg] : undefined;
        return color && ansi ? `${ansi}${glyph}${RESET}` : glyph;
      })
      .join(""),
  );
}

export function renderBand(
  agent: AgentBand,
  sprites: SpritesJson,
  frameIndex: number,
  width: number,
): string {
  const spriteLines = renderSprite(
    sprites.roles?.[agent.roleKey],
    frameIndex,
    Boolean(process.stdout.isTTY),
  );
  const prefix = `[${agent.name}] `;
  const suffix = ` [${agent.role}]`;
  return spriteLines
    .map((spriteLine, index) => {
      const line =
        index === 0
          ? `${prefix}${spriteLine}${suffix}`
          : `${" ".repeat(prefix.length)}${spriteLine}`;
      return fitLine(line, width);
    })
    .join("\n");
}

export function renderDioramaFrame(sprites: SpritesJson, frameIndex = 0, width = 80): string {
  return AGENTS.map((agent) => renderBand(agent, sprites, frameIndex, width)).join("\n");
}

export async function runDiorama(argv: string[]): Promise<void> {
  const args = parseDioramaArgs(argv);
  const squadRoot = resolveSquadRoot();
  if (!squadRoot) {
    console.log("No .squad directory found. Run this command from inside a Squad project.");
    process.exit(1);
  }

  const sprites = readSprites(resolveSkinsDir());
  for (let frame = 0; frame < args.frames; frame += 1) {
    if (frame > 0) {
      process.stdout.write(process.stdout.isTTY ? "\x1B[2J\x1B[H" : "\n");
      await delay(parseDuration("200ms"));
    }
    process.stdout.write(`${renderDioramaFrame(sprites, frame, args.width)}\n`);
  }
}

function parseDioramaArgs(argv: string[]): { frames: number; width: number } {
  let frames = 1;
  let width = 80;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--frames") {
      frames = Math.max(1, Number.parseInt(argv[i + 1] ?? "1", 10));
      i += 1;
    } else if (argv[i] === "--width") {
      width = Math.max(20, Number.parseInt(argv[i + 1] ?? "80", 10));
      i += 1;
    }
  }
  return { frames, width };
}

function resolveSkinsDir(): string {
  const webDistSkins = path.resolve(__dirname, "..", "web-dist", "skins");
  const monoSkins = path.resolve(__dirname, "..", "..", "..", "skins");
  const cwdSkins = path.resolve(process.cwd(), "skins");
  return fs.existsSync(webDistSkins)
    ? webDistSkins
    : fs.existsSync(monoSkins)
      ? monoSkins
      : cwdSkins;
}

function readSprites(skinsDir: string): SpritesJson {
  const file = path.join(skinsDir, "aquarium", "sprites.json");
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as SpritesJson;
  } catch {
    return { roles: {} };
  }
}

function fitLine(line: string, width: number): string {
  if (line.length > width) return line.slice(0, width);
  return line.padEnd(width, " ");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
