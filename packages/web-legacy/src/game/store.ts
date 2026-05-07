/**
 * ████████████████████████████████████████████████████████████████████████████
 *  COSMETICS-ONLY INVARIANT — READ THIS BEFORE TOUCHING GAME STATE
 *
 *  Game state in this module MUST NEVER be read by:
 *    - The reconciler  (transport/store.ts event processing)
 *    - The habitat renderer (render/HabitatRenderer.ts, HabitatPanel.tsx)
 *    - The log panel  (LogPanel.tsx)
 *    - Any agent communication path (wsClient.ts, transport/protocol.ts)
 *    - The command palette execution path
 *
 *  Game state is a DECORATIVE OVERLAY derived from Squad artifacts.
 *  It MUST NOT influence what Squad does, how agents behave, or what decisions
 *  are made. No XP-driven gating, no productivity multipliers, no behavior
 *  changes of any kind. Decorative only.
 *
 *  Tests that enforce this: packages/web/test/unit/game.test.ts
 * ████████████████████████████████████████████████████████████████████████████
 */

import type { SquadquariumEvent } from "@squadquarium/core";
import type { DecisionEntry } from "../transport/protocol.js";

// ── Cosmetic inventory items (cosmetic only — no effect on agents) ────────────
export const INVENTORY_ITEMS = ["hat", "scarf", "lure", "goggles"] as const;
export type InventoryItem = (typeof INVENTORY_ITEMS)[number];

export interface GameState {
  xp: number;
  level: number;
  ideas: number;
  achievements: string[];
  inventory: InventoryItem[];
  idleAccrualActive: boolean;
  dailyQuestCount: number | null; // null = hidden (no remote configured)
  bossActive: boolean; // transient: PR approved + CI green
}

export interface DerivedGameInput {
  events: SquadquariumEvent[];
  decisions: DecisionEntry[];
  ralphActive: boolean;
  hasRemote: boolean;
  prApproved?: boolean;
}

// ── Pure derivation — no side-effects, testable in isolation ─────────────────

const ACHIEVEMENT_KEYWORDS = ["milestone", "shipped", "complete", "launched", "released"];

/** Pure function. Derives cosmetic game state from Squad artifacts. */
export function deriveGameState(input: DerivedGameInput): GameState {
  const { events, decisions, ralphActive, hasRemote, prApproved = false } = input;

  // XP = unique agent entity keys observed in recent events
  const uniqueAgentKeys = new Set(
    events.filter((e) => e.entityKey.startsWith("agent:")).map((e) => e.entityKey),
  );
  const xp = uniqueAgentKeys.size;
  const level = Math.floor(xp / 100);

  // Ideas = events that look like merged PRs (pr-merge shaped entity keys)
  const ideas = events.filter((e) => /pr[:/]merge|pull[:/]merged|merged/i.test(e.entityKey)).length;

  // Achievements = notable decisions entries
  const achievements = decisions
    .filter((d) => {
      const haystack = (d.why + " " + d.what).toLowerCase();
      return ACHIEVEMENT_KEYWORDS.some((kw) => haystack.includes(kw));
    })
    .map((d) => d.what.slice(0, 60));

  // Cosmetic inventory — unlocks are level-derived cosmetics only
  const inventory: InventoryItem[] = [];
  if (level >= 1) inventory.push("hat");
  if (level >= 2) inventory.push("scarf");
  if (level >= 3) inventory.push("lure");
  if (level >= 5) inventory.push("goggles");

  return {
    xp,
    level,
    ideas,
    achievements,
    inventory,
    idleAccrualActive: ralphActive,
    dailyQuestCount: hasRemote ? 0 : null,
    bossActive: prApproved,
  };
}

// ── Idle accrual ticker — cosmetic counter, no agent side-effects ─────────────

/** Returns a cleanup fn. Calls onTick every 60 s when ralphActive is true. */
export function startIdleAccrualTicker(getIsActive: () => boolean, onTick: () => void): () => void {
  const interval = setInterval(() => {
    if (getIsActive()) onTick();
  }, 60_000);
  return () => clearInterval(interval);
}

// ── Stand-up cartoon entry ────────────────────────────────────────────────────

export interface StandupEntry {
  agentName: string;
  summary: string;
  at: number;
}

const STANDUP_SPEECH_GLYPHS = ["(·)", "(o)", "(O)", "(°)", "(·)"] as const;

export function buildStandupEntries(
  events: SquadquariumEvent[],
  windowMs = 24 * 60 * 60 * 1000,
): StandupEntry[] {
  const cutoff = Date.now() - windowMs;
  const recent = events.filter((e) => e.observedAt >= cutoff);
  const byAgent = new Map<string, SquadquariumEvent[]>();

  for (const e of recent) {
    const agentMatch = /agent[:/]([^:/]+)/i.exec(e.entityKey);
    if (!agentMatch) continue;
    const name = agentMatch[1] ?? "unknown";
    if (!byAgent.has(name)) byAgent.set(name, []);
    byAgent.get(name)!.push(e);
  }

  return [...byAgent.entries()].map(([name, evts], i) => ({
    agentName: name,
    summary: `${STANDUP_SPEECH_GLYPHS[i % STANDUP_SPEECH_GLYPHS.length]} ${evts.length} event${evts.length === 1 ? "" : "s"} in 24 h`,
    at: evts[evts.length - 1]?.observedAt ?? Date.now(),
  }));
}
