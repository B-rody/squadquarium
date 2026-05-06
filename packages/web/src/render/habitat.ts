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

export interface RitualInput {
  type: "agent-hatched" | "skill-inscribed";
  name: string;
  role?: string;
  bandId?: string;
  at: number;
}

interface ActiveRitual {
  input: RitualInput;
  startMs: number;
  durationMs: number;
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
const RITUAL_DURATION_MS = 1500;

const DRIFT_OFFSETS = [0, 1, -1, 0, 1];

// Aquarium hatching glyph progression (plan.md §5 "Hatching ritual")
const HATCH_SEQUENCE = ["·", "o", "O", "(O)", "(°)", "(°)>=<"];
// Scribe inscription fill sequence (plan.md §5 "Inscription ritual")
const SCROLL_SEQUENCE = ["░", "▒", "▓", "█"];

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
  private activeRituals: ActiveRitual[] = [];

  /** Optional callback for the CSS camera pan — set by HabitatPanel. */
  onCameraPan?: (bandRow: number, durationMs: number) => void;

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

  /** Trigger a ~1.5 s band-local ritual animation and pan the camera. */
  playRitual(ritual: RitualInput) {
    this.activeRituals.push({
      input: ritual,
      startMs: Date.now(),
      durationMs: RITUAL_DURATION_MS,
    });

    // Trigger camera pan toward the target band.
    const habitatJson = this.skinAssets.habitat as HabitatJson;
    let rowAccum = 0;
    for (const band of habitatJson.bands ?? []) {
      if (this.bandMatchesRitual(band, ritual)) {
        this.onCameraPan?.(rowAccum, 600);
        break;
      }
      rowAccum += band.height;
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

    // Ritual overlay — drawn on top of normal render, expired rituals pruned.
    const now = Date.now();
    this.activeRituals = this.activeRituals.filter((r) => now - r.startMs < r.durationMs);
    for (const active of this.activeRituals) {
      this.renderRitualOverlay(active, now, habitatJson, resolveColor);
    }

    this.glyphCanvas.flush();
  }

  private bandMatchesRitual(band: Band, ritual: RitualInput): boolean {
    if (ritual.type === "agent-hatched" && ritual.role) {
      return band.role === ritual.role;
    }
    if (ritual.type === "skill-inscribed") {
      return band.role === "scribe" || band.role === "librarian" || band.role === "scriptorium";
    }
    return false;
  }

  private renderRitualOverlay(
    active: ActiveRitual,
    now: number,
    habitatJson: HabitatJson,
    resolveColor: (token: string) => string,
  ) {
    const elapsed = now - active.startMs;
    const progress = Math.min(elapsed / active.durationMs, 1);
    const { input } = active;

    // Find target band row — graceful no-op if no matching band.
    let targetRow = -1;
    let rowAccum = 0;
    for (const band of habitatJson.bands ?? []) {
      if (this.bandMatchesRitual(band, input)) {
        targetRow = rowAccum;
        break;
      }
      rowAccum += band.height;
    }
    if (targetRow < 0) return;

    const alertColor = resolveColor("alert");
    const accentColor = resolveColor("accent");
    const isOffice = this.skinAssets.manifest.name.toLowerCase().includes("office");

    if (input.type === "agent-hatched") {
      if (isOffice) {
        // Office: desk brightens then [¤] walks on from the lobby column.
        const deskColor = progress < 0.4 ? accentColor : alertColor;
        this.glyphCanvas.drawCell(targetRow, 0, "╔", deskColor, "bg");
        this.glyphCanvas.drawCell(targetRow, 1, "═", deskColor, "bg");
        this.glyphCanvas.drawCell(targetRow, 2, "╗", deskColor, "bg");
        if (progress > 0.5) {
          const walkCol = Math.min(Math.floor((progress - 0.5) * 8), 4);
          this.glyphCanvas.drawCell(targetRow, walkCol, "[", alertColor, "bg");
          this.glyphCanvas.drawCell(targetRow, walkCol + 1, "¤", alertColor, "bg");
          this.glyphCanvas.drawCell(targetRow, walkCol + 2, "]", alertColor, "bg");
        }
      } else {
        // Aquarium: o swells to (°)>=< glyph-by-glyph spawn sequence.
        const step = Math.min(
          Math.floor(progress * HATCH_SEQUENCE.length),
          HATCH_SEQUENCE.length - 1,
        );
        const seq = HATCH_SEQUENCE[step] ?? "·";
        const color = step >= HATCH_SEQUENCE.length - 2 ? alertColor : accentColor;
        // Draw each character of the sequence token across consecutive columns.
        for (let i = 0; i < seq.length; i++) {
          this.glyphCanvas.drawCell(targetRow, i, seq[i] ?? "·", color, "bg");
        }
      }
    } else {
      // skill-inscribed
      if (isOffice) {
        // Office: archive cabinet drawer flashes ▄▄▄ → ███
        const flashGlyph = progress < 0.5 ? "▄" : "█";
        const color = progress > 0.7 ? alertColor : accentColor;
        for (let c = 0; c < 3; c++) {
          this.glyphCanvas.drawCell(targetRow, c, flashGlyph, color, "bg");
        }
      } else {
        // Aquarium: blank scroll-glyph fills ░ → ▒ → ▓ → █
        const step = Math.min(
          Math.floor(progress * SCROLL_SEQUENCE.length),
          SCROLL_SEQUENCE.length - 1,
        );
        const glyph = SCROLL_SEQUENCE[step] ?? "░";
        const color = step >= SCROLL_SEQUENCE.length - 1 ? alertColor : accentColor;
        this.glyphCanvas.drawCell(targetRow, 0, glyph, color, "bg");
      }
    }
  }
}
