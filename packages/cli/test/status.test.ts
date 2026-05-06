import { describe, it, expect } from "vitest";
import { parseAgentStatus, parseVoiceFromCharter } from "@squadquarium/core";

describe("parseAgentStatus", () => {
  it('maps "✅ Active" to "active"', () => {
    expect(parseAgentStatus("✅ Active")).toBe("active");
  });

  it('maps "💤 Dormant (v1+)" to "dormant"', () => {
    expect(parseAgentStatus("💤 Dormant (v1+)")).toBe("dormant");
  });

  it('maps "🪦 Retired" to "retired"', () => {
    expect(parseAgentStatus("🪦 Retired")).toBe("retired");
  });

  it('returns "unknown" for undefined', () => {
    expect(parseAgentStatus(undefined)).toBe("unknown");
  });

  it('returns "unknown" for unrecognised strings', () => {
    expect(parseAgentStatus("on leave")).toBe("unknown");
  });

  it("is case-insensitive", () => {
    expect(parseAgentStatus("ACTIVE")).toBe("active");
    expect(parseAgentStatus("Dormant")).toBe("dormant");
  });
});

// Fixture team.md Members table (mirrors the real .squad/team.md format).
const FIXTURE_TEAM_MD = `
# Squad Team

## Members

| Name    | Role              | Charter                                         | Status             |
|---------|-------------------|-------------------------------------------------|--------------------|
| Dallas  | Lead              | [agents/dallas/charter.md](...)                 | ✅ Active          |
| Lambert | Frontend Dev      | [agents/lambert/charter.md](...)                | ✅ Active          |
| Ralph   | Work Monitor      | [agents/ralph/charter.md](...)                  | 💤 Dormant (v1+)  |
`.trim();

describe("parseAgentStatus — team.md fixture", () => {
  it("extracts clean labels from the Members table", () => {
    // Parse the fixture: find the Status column values.
    const rows = FIXTURE_TEAM_MD.split("\n").filter((line) => line.startsWith("|"));
    // Skip the header row and separator row.
    const dataRows = rows.slice(2);
    const statuses = dataRows.map((row) => {
      const cells = row
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);
      return cells[3] ?? ""; // Status column (0-indexed after name/role/charter)
    });

    expect(parseAgentStatus(statuses[0])).toBe("active"); // Dallas
    expect(parseAgentStatus(statuses[1])).toBe("active"); // Lambert
    expect(parseAgentStatus(statuses[2])).toBe("dormant"); // Ralph
  });
});

describe("parseVoiceFromCharter", () => {
  it("extracts the first line of the ## Voice section", () => {
    const charter = `
# Dallas — Lead

## Identity
- Name: Dallas

## Voice

Captain mindset. Calm under pressure.

Doesn't panic when the system is on fire.
`.trim();
    expect(parseVoiceFromCharter(charter)).toBe("Captain mindset. Calm under pressure.");
  });

  it("returns null when there is no ## Voice section", () => {
    expect(parseVoiceFromCharter("# No Voice\n\n## Identity\n- Name: Test\n")).toBeNull();
  });

  it("skips blank lines and returns the first non-empty text line", () => {
    const charter = `# Agent\n\n## Voice\n\n\nFirst real line.\n`;
    expect(parseVoiceFromCharter(charter)).toBe("First real line.");
  });
});
