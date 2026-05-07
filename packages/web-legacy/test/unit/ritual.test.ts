import { describe, it, expect } from "vitest";
import type { SquadquariumEvent } from "@squadquarium/core";
import { detectRitualEvent } from "../../src/transport/store.js";

function makeFsEvent(entityKey: string, at = 1000): SquadquariumEvent {
  return {
    sessionId: "test-session",
    source: "fs",
    seq: 1,
    entityKey,
    observedAt: at,
    payload: { action: "file_change", file: entityKey },
  };
}

describe("detectRitualEvent", () => {
  it("returns agent-hatched for a new charter.md under agents/", () => {
    const knownAgents = new Set<string>(["dallas", "lambert"]);
    const knownSkills = new Set<string>();
    const event = makeFsEvent("fs:.squad/agents/ripley/charter.md");
    const ritual = detectRitualEvent(event, knownAgents, knownSkills);
    expect(ritual).not.toBeNull();
    expect(ritual?.type).toBe("agent-hatched");
    expect(ritual?.name).toBe("ripley");
    expect(ritual?.at).toBe(1000);
  });

  it("ignores charter.md for agents already in the known set", () => {
    const knownAgents = new Set<string>(["dallas"]);
    const knownSkills = new Set<string>();
    const event = makeFsEvent("fs:.squad/agents/dallas/charter.md");
    expect(detectRitualEvent(event, knownAgents, knownSkills)).toBeNull();
  });

  it("returns skill-inscribed for a new SKILL.md under skills/", () => {
    const knownAgents = new Set<string>();
    const knownSkills = new Set<string>();
    const event = makeFsEvent("fs:.squad/skills/write-tests/SKILL.md", 2000);
    const ritual = detectRitualEvent(event, knownAgents, knownSkills);
    expect(ritual).not.toBeNull();
    expect(ritual?.type).toBe("skill-inscribed");
    expect(ritual?.name).toBe("write-tests");
    expect(ritual?.at).toBe(2000);
  });

  it("ignores SKILL.md for skills already in the known set", () => {
    const knownAgents = new Set<string>();
    const knownSkills = new Set<string>(["write-tests"]);
    const event = makeFsEvent("fs:.squad/skills/write-tests/SKILL.md");
    expect(detectRitualEvent(event, knownAgents, knownSkills)).toBeNull();
  });

  it("is case-insensitive for path matching", () => {
    const knownAgents = new Set<string>();
    const knownSkills = new Set<string>();
    const event = makeFsEvent("fs:.squad/agents/Parker/Charter.md");
    const ritual = detectRitualEvent(event, knownAgents, knownSkills);
    expect(ritual?.type).toBe("agent-hatched");
    expect(ritual?.name).toBe("Parker");
  });

  it("ignores non-fs events", () => {
    const event: SquadquariumEvent = {
      ...makeFsEvent("fs:.squad/agents/newcomer/charter.md"),
      source: "bus",
    };
    expect(detectRitualEvent(event, new Set(), new Set())).toBeNull();
  });

  it("ignores history.md (not charter.md)", () => {
    const knownAgents = new Set<string>();
    const event = makeFsEvent("fs:.squad/agents/newcomer/history.md");
    expect(detectRitualEvent(event, knownAgents, new Set())).toBeNull();
  });

  it("handles Windows-style backslash paths", () => {
    const knownAgents = new Set<string>();
    const event = makeFsEvent("fs:.squad\\agents\\harris\\charter.md");
    const ritual = detectRitualEvent(event, knownAgents, new Set());
    expect(ritual?.type).toBe("agent-hatched");
    expect(ritual?.name).toBe("harris");
  });
});
