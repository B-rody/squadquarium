import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { parseDecisionEntries } from "../src/trace.js";
import {
  findDecision,
  findMatchingSkills,
  findNearbyLogs,
  findRelatedDecisions,
  slugify,
} from "../src/why.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = path.join(__dirname, ".runtime", "why-fixtures");
const squadRoot = path.join(fixtureRoot, ".squad");

const decisionsMarkdown = [
  "### 2026-05-05T22:30Z — Casting universe",
  "**By:** Parker",
  "Choose Alien-inspired backend language.",
  "",
  "### 2026-05-05T23:30Z — Marketplace plugin flow",
  "**By:** Parker",
  "Use skill routing for plugin install.",
  "",
  "### 2026-05-06T03:00Z — Frontend pass",
  "**By:** Lambert",
  "Canvas work.",
].join("\n");

afterEach(() => {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
});

describe("why utilities", () => {
  it("slugifies titles", () => {
    expect(slugify("Casting universe!")).toBe("casting-universe");
  });

  it("finds decisions by numeric index, date prefix, or slug fragment", () => {
    const decisions = parseDecisionEntries(decisionsMarkdown);

    expect(findDecision(decisions, "1")?.title).toBe("Casting universe");
    expect(findDecision(decisions, "2026-05-05T23")?.title).toBe("Marketplace plugin flow");
    expect(findDecision(decisions, "casting-universe")?.title).toBe("Casting universe");
  });

  it("finds nearby orchestration logs", () => {
    const dir = path.join(squadRoot, "orchestration-log");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "2026-05-05T22-45Z-parker.md"), "near");
    fs.writeFileSync(path.join(dir, "2026-05-06T02-45Z-parker.md"), "far");

    const nearby = findNearbyLogs(squadRoot, "2026-05-05T22:30:00.000Z", 1);

    expect(nearby).toHaveLength(1);
    expect(nearby[0]).toContain("22-45Z");
  });

  it("matches skills by decision keywords", () => {
    const skillDir = path.join(squadRoot, "skills", "plugin-flow");
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, "SKILL.md"),
      [
        "---",
        'name: "plugin-flow"',
        'domain: "marketplace"',
        "triggers:",
        "  - plugin install",
        "---",
      ].join("\n"),
    );
    const decision = parseDecisionEntries(decisionsMarkdown)[1]!;

    expect(findMatchingSkills(squadRoot, decision).map((skill) => skill.name)).toEqual([
      "plugin-flow",
    ]);
  });

  it("suggests related decisions by author or nearby timestamp", () => {
    const decisions = parseDecisionEntries(decisionsMarkdown);
    const related = findRelatedDecisions(decisions, decisions[0]!);

    expect(related.map((decision) => decision.title)).toContain("Marketplace plugin flow");
  });
});
