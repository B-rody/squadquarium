import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  findDecisionsByAgent,
  findOrchestrationEntries,
  parseSince,
  parseTimestampFromFilename,
} from "../src/trace.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = path.join(__dirname, ".runtime", "trace-fixtures");
const squadRoot = path.join(fixtureRoot, ".squad");

afterEach(() => {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
});

describe("trace utilities", () => {
  it("parses since durations", () => {
    const now = Date.parse("2026-05-06T00:00:00Z");
    expect(parseSince("24h", now)).toBe(Date.parse("2026-05-05T00:00:00Z"));
    expect(parseSince("7d", now)).toBe(Date.parse("2026-04-29T00:00:00Z"));
    expect(parseSince("nope", now)).toBeNull();
  });

  it("extracts orchestration timestamps from agent filenames", () => {
    expect(parseTimestampFromFilename("2026-05-05T23-30Z-parker.md")).toBe(
      "2026-05-05T23:30:00.000Z",
    );
  });

  it("finds decisions where By contains the agent name", () => {
    fs.mkdirSync(squadRoot, { recursive: true });
    fs.writeFileSync(
      path.join(squadRoot, "decisions.md"),
      [
        "### 2026-05-05T22:30Z — Backend slice",
        "**By:** Parker (Backend Dev)",
        "Use a standalone parser.",
        "",
        "### 2026-05-05T23:00Z — UI slice",
        "**By:** Lambert",
        "Render it.",
      ].join("\n"),
    );

    const entries = findDecisionsByAgent(squadRoot, "parker");

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ source: "decisions", title: "Backend slice" });
  });

  it("filters orchestration entries by task text", () => {
    const dir = path.join(squadRoot, "orchestration-log");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "2026-05-05T23-30Z-parker.md"), "Rationale: task-123");
    fs.writeFileSync(path.join(dir, "2026-05-05T23-31Z-parker.md"), "Rationale: other");

    const entries = findOrchestrationEntries(squadRoot, "Parker", "task-123");

    expect(entries).toHaveLength(1);
    expect(entries[0]?.title).toContain("23-30Z-parker");
  });
});
