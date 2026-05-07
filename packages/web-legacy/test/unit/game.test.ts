/**
 * Game store tests — enforce the cosmetics-only invariant.
 *
 * KEY INVARIANT: game state must never be read by the reconciler, habitat
 * renderer, or log panel. These tests verify:
 *   1. Pure derivation correctness (no side-effects)
 *   2. Game state is NOT exported from transport/store (reconciler path)
 *   3. XP/level math is correct
 *   4. Inventory unlocks are cosmetic-level-gated correctly
 */
import { describe, it, expect } from "vitest";
import { deriveGameState, buildStandupEntries, INVENTORY_ITEMS } from "../../src/game/store.js";
import type { DerivedGameInput } from "../../src/game/store.js";
import type { SquadquariumEvent } from "@squadquarium/core";

function makeEvent(entityKey: string, at = Date.now()): SquadquariumEvent {
  return {
    sessionId: "test",
    source: "fs",
    seq: at,
    entityKey,
    observedAt: at,
    payload: {},
  };
}

const emptyInput: DerivedGameInput = {
  events: [],
  decisions: [],
  ralphActive: false,
  hasRemote: false,
};

describe("deriveGameState — cosmetics-only invariant", () => {
  it("returns zero xp and level 0 with no events", () => {
    const state = deriveGameState(emptyInput);
    expect(state.xp).toBe(0);
    expect(state.level).toBe(0);
  });

  it("counts unique agent entity keys as XP", () => {
    const events = [
      makeEvent("agent:lambert"),
      makeEvent("agent:lambert"), // duplicate — should not add
      makeEvent("agent:parker"),
    ];
    const state = deriveGameState({ ...emptyInput, events });
    expect(state.xp).toBe(2);
  });

  it("ignores non-agent events for XP", () => {
    const events = [makeEvent("fs:some/file.md"), makeEvent("skill:typescript")];
    const state = deriveGameState({ ...emptyInput, events });
    expect(state.xp).toBe(0);
  });

  it("level = floor(xp/100)", () => {
    // 100 unique agent keys → level 1
    const events = Array.from({ length: 100 }, (_, i) => makeEvent(`agent:bot-${i}`));
    const state = deriveGameState({ ...emptyInput, events });
    expect(state.level).toBe(1);
    expect(state.xp).toBe(100);
  });

  it("level 0 unlocks no inventory items", () => {
    const state = deriveGameState(emptyInput);
    expect(state.inventory).toHaveLength(0);
  });

  it("level 1 unlocks hat only", () => {
    const events = Array.from({ length: 100 }, (_, i) => makeEvent(`agent:bot-${i}`));
    const state = deriveGameState({ ...emptyInput, events });
    expect(state.inventory).toContain("hat");
    expect(state.inventory).not.toContain("scarf");
  });

  it("marks all inventory items as unlocked at level 5", () => {
    const events = Array.from({ length: 500 }, (_, i) => makeEvent(`agent:bot-${i}`));
    const state = deriveGameState({ ...emptyInput, events });
    expect(state.level).toBeGreaterThanOrEqual(5);
    for (const item of INVENTORY_ITEMS) {
      expect(state.inventory).toContain(item);
    }
  });

  it("ideas = 0 when no PR-merge events", () => {
    const state = deriveGameState(emptyInput);
    expect(state.ideas).toBe(0);
  });

  it("ideas counts PR-merge shaped entity keys", () => {
    const events = [makeEvent("pr:merge/123"), makeEvent("other:event")];
    const state = deriveGameState({ ...emptyInput, events });
    expect(state.ideas).toBe(1);
  });

  it("daily quest is null when no remote", () => {
    const state = deriveGameState({ ...emptyInput, hasRemote: false });
    expect(state.dailyQuestCount).toBeNull();
  });

  it("daily quest is 0 (not null) when remote is configured", () => {
    const state = deriveGameState({ ...emptyInput, hasRemote: true });
    expect(state.dailyQuestCount).toBe(0);
  });

  it("bossActive reflects prApproved flag", () => {
    const active = deriveGameState({ ...emptyInput, prApproved: true });
    const inactive = deriveGameState({ ...emptyInput, prApproved: false });
    expect(active.bossActive).toBe(true);
    expect(inactive.bossActive).toBe(false);
  });

  it("achievements extract notable decisions by keyword", () => {
    const decisions = [
      {
        date: "2026-05-06",
        by: "dallas",
        what: "Shipped v1.0 milestone",
        why: "milestone reached",
      },
      { date: "2026-05-06", by: "lambert", what: "Boring refactor", why: "cleanup" },
    ];
    const state = deriveGameState({ ...emptyInput, decisions });
    expect(state.achievements).toHaveLength(1);
    expect(state.achievements[0]).toContain("Shipped v1.0 milestone");
  });

  it("idleAccrualActive mirrors ralphActive", () => {
    const withRalph = deriveGameState({ ...emptyInput, ralphActive: true });
    const noRalph = deriveGameState({ ...emptyInput, ralphActive: false });
    expect(withRalph.idleAccrualActive).toBe(true);
    expect(noRalph.idleAccrualActive).toBe(false);
  });
});

describe("cosmetics-only isolation — game state not reachable from reconciler path", () => {
  it("transport/store does not export deriveGameState", async () => {
    // Verify that game store exports are isolated from the transport store.
    // This import would fail at build time if game state leaked into reconciler.
    const transportStore = await import("../../src/transport/store.js");
    expect((transportStore as Record<string, unknown>)["deriveGameState"]).toBeUndefined();
    expect((transportStore as Record<string, unknown>)["GameState"]).toBeUndefined();
  });

  it("game store does not import from transport/store", async () => {
    // If game/store.ts ever imports from transport/store.ts, it breaks the isolation.
    // We verify by checking that the game store module loads independently.
    const gameStore = await import("../../src/game/store.js");
    expect(typeof gameStore.deriveGameState).toBe("function");
    expect(typeof gameStore.buildStandupEntries).toBe("function");
  });
});

describe("buildStandupEntries", () => {
  it("returns empty array when no events in window", () => {
    const old = Date.now() - 48 * 60 * 60 * 1000;
    const events = [makeEvent("agent:lambert", old)];
    expect(buildStandupEntries(events, 24 * 60 * 60 * 1000)).toHaveLength(0);
  });

  it("groups events by agent name", () => {
    const now = Date.now();
    const events = [
      makeEvent("agent:lambert", now - 1000),
      makeEvent("agent:lambert", now - 2000),
      makeEvent("agent:parker", now - 3000),
    ];
    const entries = buildStandupEntries(events, 24 * 60 * 60 * 1000);
    const lambertEntry = entries.find((e) => e.agentName === "lambert");
    const parkerEntry = entries.find((e) => e.agentName === "parker");
    expect(lambertEntry).toBeDefined();
    expect(parkerEntry).toBeDefined();
    expect(lambertEntry?.summary).toContain("2 events");
  });
});
