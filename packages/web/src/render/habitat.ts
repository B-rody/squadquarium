import { GlyphCanvas } from "./canvas.js";
import { drawSprite, type SpriteState, type SpritesJson } from "./sprite.js";
import type { SkinAssets } from "../skin/loader.js";
import type { ApprovalPendingSignal } from "../transport/store.js";
import type { SquadquariumEvent } from "@squadquarium/core";

export interface AgentRoleMap {
  [agentName: string]: string;
}

export type AgentMood = "tired" | "busy" | "content" | "stuck" | "normal";

export interface AgentRenderState {
  agentName?: string;
  spriteState: SpriteState;
  mood: AgentMood;
}

export interface RalphState {
  active: boolean;
  col: number;
  lastMoveMs: number;
}

export interface HabitatState {
  agentRoles: AgentRoleMap;
  recentEvents: SquadquariumEvent[];
  approvalPending?: ApprovalPendingSignal[];
  agentVoices?: Record<string, string>;
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

interface ActiveSpeechBubble {
  agentName: string;
  text: string;
  startMs: number;
  durationMs: 2000;
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
const TIRED_MS = 604_800_000;
const BUSY_MS = 30_000;
const STUCK_MS = 180_000;
const BUBBLE_CHECK_MS = 6000;
const BUBBLE_DURATION_MS = 2000 as const;
const APPROVAL_WALK_MS = 2000;

const DRIFT_OFFSETS = [0, 1, -1, 0, 1];
const MOOD_GLYPHS: Partial<Record<AgentMood, string>> = {
  tired: "z",
  busy: "*",
  content: "~",
  stuck: "?",
};
const MOOD_COLOR_TOKEN: Record<AgentMood, string> = {
  tired: "dim",
  busy: "accent",
  content: "fg",
  stuck: "alert",
  normal: "fg",
};

// Aquarium hatching glyph progression (plan.md §5 "Hatching ritual")
const HATCH_SEQUENCE = ["·", "o", "O", "(O)", "(°)", "(°)>=<"];
// Scribe inscription fill sequence (plan.md §5 "Inscription ritual")
const SCROLL_SEQUENCE = ["░", "▒", "▓", "█"];

function payloadRecord(event: SquadquariumEvent): Record<string, unknown> | null {
  return typeof event.payload === "object" && event.payload !== null
    ? (event.payload as Record<string, unknown>)
    : null;
}

function payloadText(event: SquadquariumEvent): string {
  try {
    return JSON.stringify(event.payload ?? "").toLowerCase();
  } catch {
    return String(event.payload ?? "").toLowerCase();
  }
}

function eventMatchesAgent(event: SquadquariumEvent, agentName: string): boolean {
  const name = agentName.toLowerCase();
  if (event.entityKey.toLowerCase().includes(name)) return true;
  const payload = payloadRecord(event);
  return [payload?.agentName, payload?.agent, payload?.name, payload?.by].some(
    (value) => typeof value === "string" && value.toLowerCase() === name,
  );
}

function eventKind(event: SquadquariumEvent): string {
  const payload = payloadRecord(event);
  const raw = payload?.type ?? payload?.kind ?? payload?.event ?? payload?.action ?? "";
  return typeof raw === "string" ? raw.toLowerCase() : "";
}

function isToolStart(event: SquadquariumEvent): boolean {
  const kind = eventKind(event);
  const key = event.entityKey.toLowerCase();
  return kind === "tool:start" || kind === "tool-start" || key.includes("tool:start");
}

function isFileOutput(event: SquadquariumEvent): boolean {
  const kind = eventKind(event);
  const key = event.entityKey.toLowerCase();
  const text = payloadText(event);
  return (
    kind === "file-output" ||
    kind === "file:output" ||
    key.includes("file-output") ||
    text.includes("file-output")
  );
}

function hasStatus(event: SquadquariumEvent, statuses: string[]): boolean {
  const payload = payloadRecord(event);
  return typeof payload?.status === "string" && statuses.includes(payload.status);
}

export function deriveMood(
  agentName: string,
  recentEvents: SquadquariumEvent[],
  now: number,
): AgentMood {
  const agentEvents = recentEvents.filter((event) => eventMatchesAgent(event, agentName));
  const recentAgentEvents = agentEvents.filter((event) => now - event.observedAt <= TIRED_MS);
  if (recentAgentEvents.length === 0) return "tired";

  const toolStarts3m = agentEvents.filter(
    (event) => isToolStart(event) && now - event.observedAt <= STUCK_MS,
  );
  const startsByEntity = new Map<string, SquadquariumEvent[]>();
  for (const event of toolStarts3m) {
    const events = startsByEntity.get(event.entityKey) ?? [];
    events.push(event);
    startsByEntity.set(event.entityKey, events);
  }
  for (const [entityKey, starts] of startsByEntity) {
    if (starts.length < 3) continue;
    const lastStartAt = Math.max(...starts.map((event) => event.observedAt));
    const hasLaterOutput = agentEvents.some(
      (event) =>
        event.entityKey === entityKey && event.observedAt > lastStartAt && isFileOutput(event),
    );
    if (!hasLaterOutput) return "stuck";
  }

  const toolStarts30s = agentEvents.filter(
    (event) => isToolStart(event) && now - event.observedAt <= BUSY_MS,
  );
  if (toolStarts30s.length >= 3) return "busy";

  if (agentEvents.some((event) => hasStatus(event, ["merged", "decided"]))) return "content";

  return "normal";
}

export function deriveAgentState(
  role: string,
  agentRoles: AgentRoleMap,
  recentEvents: SquadquariumEvent[],
  now = Date.now(),
): AgentRenderState {
  const agentName = Object.entries(agentRoles).find(([, r]) => r === role)?.[0];
  if (!agentName) return { spriteState: "idle", mood: "normal" };

  const recent = recentEvents.filter((event) => eventMatchesAgent(event, agentName));
  const mood = deriveMood(agentName, recentEvents, now);
  if (recent.length === 0) return { agentName, spriteState: "idle", mood };

  const last = recent[recent.length - 1];
  if (!last) return { agentName, spriteState: "idle", mood };
  const payload = payloadRecord(last);
  if (payload) {
    if (payload.status === "blocked" || payload.error)
      return { agentName, spriteState: "blocked", mood };
    if (
      payload.status === "merged" ||
      payload.status === "decided" ||
      payload.status === "celebrate"
    ) {
      return { agentName, spriteState: "celebrate", mood };
    }
    if (payload.status === "working" || payload.status === "active") {
      return { agentName, spriteState: "working", mood };
    }
  }
  return { agentName, spriteState: "idle", mood };
}

export class HabitatRenderer {
  private frame = 0;
  private driftTick = 0;
  private animTimer: ReturnType<typeof setInterval> | null = null;
  private activeRituals: ActiveRitual[] = [];
  private activeApprovalWalks = new Map<string, number>();
  private activeSpeechBubbles: ActiveSpeechBubble[] = [];
  private lastBubbleCheckMs = 0;

  moodGlyphsEnabled = true;
  voiceBubblesEnabled = true;
  ralphState: RalphState = { active: false, col: 0, lastMoveMs: 0 };

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

  setRalphActive(active: boolean) {
    this.ralphState.active = active;
    if (active && this.ralphState.lastMoveMs === 0) this.ralphState.lastMoveMs = Date.now();
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
    const now = Date.now();

    const resolveColor = (token: string): string => palette[token] ?? token;

    this.glyphCanvas.clear();

    const agentStates = new Map<string, AgentRenderState>();

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

      const agentState = deriveAgentState(band.role, state.agentRoles, state.recentEvents, now);
      if (agentState.agentName) agentStates.set(agentState.agentName, agentState);
      const moodColor = resolveColor(MOOD_COLOR_TOKEN[agentState.mood]);

      drawSprite(
        this.glyphCanvas,
        spritesJson,
        band.role,
        agentState.spriteState,
        this.frame,
        bandRow,
        0,
        glyphAllowlist,
        fallbacks,
        moodColor,
      );

      this.renderMoodGlyph(agentState.mood, bandRow, glyphAllowlist, moodColor);

      bandRow += band.height;
    }

    this.maybeSpawnSpeechBubbles(state, agentStates, now);
    this.renderSpeechBubbles(habitatJson, state.agentRoles, glyphAllowlist, resolveColor, now);
    this.renderApprovalWalks(
      state.approvalPending ?? [],
      habitatJson,
      state.agentRoles,
      glyphAllowlist,
      resolveColor,
      now,
    );
    this.renderRalph(habitatJson, glyphAllowlist, resolveColor, now);

    // Ritual overlay — drawn on top of normal render, expired rituals pruned.
    this.activeRituals = this.activeRituals.filter((r) => now - r.startMs < r.durationMs);
    for (const active of this.activeRituals) {
      this.renderRitualOverlay(active, now, habitatJson, resolveColor);
    }

    this.glyphCanvas.flush();
  }

  private bandRowForAgent(
    agentName: string,
    habitatJson: HabitatJson,
    agentRoles: AgentRoleMap,
  ): number | null {
    const role = agentRoles[agentName];
    if (!role) return null;
    let row = 0;
    for (const band of habitatJson.bands ?? []) {
      if (band.role === role) return row;
      row += band.height;
    }
    return null;
  }

  private renderMoodGlyph(
    mood: AgentMood,
    bandRow: number,
    glyphAllowlist: string[],
    color: string,
  ) {
    if (!this.moodGlyphsEnabled || mood === "normal" || bandRow <= 0) return;
    const glyph = MOOD_GLYPHS[mood];
    if (!glyph || !glyphAllowlist.includes(glyph)) return;
    this.glyphCanvas.drawCell(bandRow - 1, 0, glyph, color, "bg");
  }

  private maybeSpawnSpeechBubbles(
    state: HabitatState,
    agentStates: Map<string, AgentRenderState>,
    now: number,
  ) {
    if (!this.voiceBubblesEnabled || now - this.lastBubbleCheckMs < BUBBLE_CHECK_MS) return;
    this.lastBubbleCheckMs = now;
    for (const [agentName, agentState] of agentStates) {
      if (agentState.spriteState !== "working") continue;
      if (this.activeSpeechBubbles.some((bubble) => bubble.agentName === agentName)) continue;
      if (Math.random() >= 0.1) continue;
      const text = this.pickVoicePhrase(state.agentVoices?.[agentName]);
      if (!text) continue;
      this.activeSpeechBubbles.push({
        agentName,
        text,
        startMs: now,
        durationMs: BUBBLE_DURATION_MS,
      });
    }
  }

  private pickVoicePhrase(voice?: string): string | null {
    if (!voice) return null;
    const phrases = voice
      .split(/\.\s+|,/)
      .map((phrase) => phrase.trim())
      .filter((phrase) => phrase.length > 0 && phrase.length < 20);
    const phrase = phrases[0] ?? voice.trim();
    return phrase.slice(0, 16).trim() || null;
  }

  private renderSpeechBubbles(
    habitatJson: HabitatJson,
    agentRoles: AgentRoleMap,
    glyphAllowlist: string[],
    resolveColor: (token: string) => string,
    now: number,
  ) {
    this.activeSpeechBubbles = this.activeSpeechBubbles.filter(
      (bubble) => now - bubble.startMs < bubble.durationMs,
    );
    if (!this.voiceBubblesEnabled) return;
    const isOffice = this.skinAssets.manifest.name.toLowerCase().includes("office");
    for (const bubble of this.activeSpeechBubbles) {
      const row = this.bandRowForAgent(bubble.agentName, habitatJson, agentRoles);
      if (row === null || row <= 0) continue;
      const framed = isOffice ? `[ ${bubble.text} ]` : `( ${bubble.text} )`;
      this.drawText(row - 1, 2, framed, resolveColor("accent"), "bg", glyphAllowlist, false);
    }
  }

  private renderApprovalWalks(
    signals: ApprovalPendingSignal[],
    habitatJson: HabitatJson,
    agentRoles: AgentRoleMap,
    glyphAllowlist: string[],
    resolveColor: (token: string) => string,
    now: number,
  ) {
    const liveKeys = new Set<string>();
    const alert = resolveColor("alert");
    const accent = resolveColor("accent");
    for (const signal of signals) {
      const key = `${signal.agentName}:${signal.fileName}:${signal.detectedAt}`;
      liveKeys.add(key);
      if (!this.activeApprovalWalks.has(key))
        this.activeApprovalWalks.set(key, signal.detectedAt || now);
      const start = this.activeApprovalWalks.get(key) ?? now;
      const row = this.bandRowForAgent(signal.agentName, habitatJson, agentRoles);
      if (row === null) continue;
      const elapsed = now - start;
      if (elapsed < APPROVAL_WALK_MS) {
        const progress = Math.max(0, Math.min(elapsed / APPROVAL_WALK_MS, 1));
        const col = Math.max(0, Math.min(Math.floor(progress * (this.cols - 4)), this.cols - 4));
        this.drawText(row, col, "[¤]", accent, "bg", glyphAllowlist, true);
        this.drawText(
          row,
          Math.min(col + 4, this.cols - 3),
          "[!]",
          alert,
          "bg",
          glyphAllowlist,
          true,
        );
      } else {
        this.drawText(row, Math.max(this.cols - 3, 0), "[!]", alert, "bg", glyphAllowlist, true);
      }
    }
    for (const key of this.activeApprovalWalks.keys()) {
      if (!liveKeys.has(key)) this.activeApprovalWalks.delete(key);
    }
  }

  private renderRalph(
    habitatJson: HabitatJson,
    glyphAllowlist: string[],
    resolveColor: (token: string) => string,
    now: number,
  ) {
    if (!this.ralphState.active) return;
    if (now - this.ralphState.lastMoveMs >= 2000) {
      this.ralphState.col = (this.ralphState.col + 1) % Math.max(this.cols - 5, 1);
      this.ralphState.lastMoveMs = now;
    }

    let row = 0;
    let fallbackRow = 0;
    for (const band of habitatJson.bands ?? []) {
      if (band.id === "deep-trench") {
        fallbackRow = row;
        break;
      }
      fallbackRow = row;
      row += band.height;
    }
    const col = Math.min(this.ralphState.col, Math.max(this.cols - 5, 0));
    this.drawText(fallbackRow, col, "<:O>*", resolveColor("accent"), "bg", glyphAllowlist, true);
  }

  private drawText(
    row: number,
    col: number,
    text: string,
    fg: string,
    bg: string,
    glyphAllowlist: string[],
    enforceAllowlist: boolean,
  ) {
    for (let i = 0; i < text.length && col + i < this.cols; i++) {
      const glyph = text[i] ?? " ";
      if (enforceAllowlist && !glyphAllowlist.includes(glyph)) continue;
      this.glyphCanvas.drawCell(row, col + i, glyph, fg, bg);
    }
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
