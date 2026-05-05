import { GlyphCanvas } from "./canvas.js";
import { drawSprite, type SpriteState, type SpritesJson } from "./sprite.js";
import type { SkinAssets } from "../skin/loader.js";
import type { SquadquariumEvent } from "@squadquarium/core";

export interface AgentRoleMap {
  [agentName: string]: string;
}

export interface HabitatState {
  agentRoles: AgentRoleMap;
  recentEvents: SquadquariumEvent[];
}

interface DressingItem {
  cell: { row: number; col: number };
  glyph: string;
  color: string;
  drift: boolean;
}

interface Band {
  id: string;
  role: string;
  height: number;
  dressing: DressingItem[];
}

interface HabitatJson {
  bands: Band[];
}

const DRIFT_FPS = 12;
const FRAME_INTERVAL_MS = Math.round(1000 / DRIFT_FPS);

const DRIFT_OFFSETS = [0, 1, -1, 0, 1];

function deriveAgentState(
  role: string,
  agentRoles: AgentRoleMap,
  recentEvents: SquadquariumEvent[],
): SpriteState {
  const agentName = Object.entries(agentRoles).find(([, r]) => r === role)?.[0];
  if (!agentName) return "idle";

  const recent = recentEvents.filter((e) => e.entityKey.includes(agentName));
  if (recent.length === 0) return "idle";

  const last = recent[recent.length - 1];
  if (!last) return "idle";
  const payload = last.payload as Record<string, unknown> | null;
  if (payload && typeof payload === "object") {
    if (payload.status === "blocked" || payload.error) return "blocked";
    if (
      payload.status === "merged" ||
      payload.status === "decided" ||
      payload.status === "celebrate"
    ) {
      return "celebrate";
    }
    if (payload.status === "working" || payload.status === "active") {
      return "working";
    }
  }
  return "idle";
}

export class HabitatRenderer {
  private frame = 0;
  private driftTick = 0;
  private animTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly glyphCanvas: GlyphCanvas,
    private readonly skinAssets: SkinAssets,
    private readonly cols: number,
  ) {}

  start(onFrame: () => void) {
    if (this.animTimer) return;
    this.animTimer = setInterval(() => {
      this.frame++;
      this.driftTick++;
      onFrame();
    }, FRAME_INTERVAL_MS);
  }

  stop() {
    if (this.animTimer) {
      clearInterval(this.animTimer);
      this.animTimer = null;
    }
  }

  render(state: HabitatState) {
    const { manifest, sprites, habitat } = this.skinAssets;
    const habitatJson = habitat as HabitatJson;
    const spritesJson = sprites as SpritesJson;
    const { glyphAllowlist, fallbacks = {}, palette } = manifest;

    const resolveColor = (token: string): string => palette[token] ?? token;

    this.glyphCanvas.clear();

    let bandRow = 0;
    for (const band of habitatJson.bands ?? []) {
      for (const item of band.dressing ?? []) {
        const absRow = bandRow + item.cell.row;
        let col = item.cell.col;
        if (item.drift) {
          col = (col + DRIFT_OFFSETS[this.driftTick % DRIFT_OFFSETS.length]) % this.cols;
        }
        const color = resolveColor(item.color);
        this.glyphCanvas.drawCell(absRow, col, item.glyph, color, "bg");
      }

      const agentState = deriveAgentState(band.role, state.agentRoles, state.recentEvents);

      drawSprite(
        this.glyphCanvas,
        spritesJson,
        band.role,
        agentState,
        this.frame,
        bandRow,
        0,
        glyphAllowlist,
        fallbacks,
      );

      bandRow += band.height;
    }

    this.glyphCanvas.flush();
  }
}
