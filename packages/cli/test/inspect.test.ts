import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  findSkillsForRole,
  findTouchedFiles,
  parseCharterCard,
  parseFilesWritten,
  parseRecentLearnings,
} from "../src/inspect.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = path.join(__dirname, ".runtime", "inspect-fixtures");
const squadRoot = path.join(fixtureRoot, ".squad");

afterEach(() => {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
});

describe("inspect utilities", () => {
  it("parses charter title, role, and voice line", () => {
    const card = parseCharterCard(
      "# Parker — Backend Dev\n\n## Voice\n\nShip reliable adapters.\n",
    );

    expect(card).toEqual({
      title: "Parker — Backend Dev",
      role: "Backend Dev",
      voiceLine: "Ship reliable adapters.",
    });
  });

  it("returns the last 10 learning entries", () => {
    const history = [
      "# History",
      "",
      "## Learnings",
      ...Array.from(
        { length: 12 },
        (_, i) => `### 2026-05-${String(i + 1).padStart(2, "0")}T00:00Z — Entry ${i + 1}`,
      ),
    ].join("\n");

    const learnings = parseRecentLearnings(history);

    expect(learnings).toHaveLength(10);
    expect(learnings[0]).toContain("Entry 3");
    expect(learnings.at(-1)).toContain("Entry 12");
  });

  it("matches skills whose roles include the agent role", () => {
    const skillDir = path.join(squadRoot, "skills", "backend-flow");
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, "SKILL.md"),
      ["---", 'name: "backend-flow"', "roles:", "  - Backend Dev", "---"].join("\n"),
    );

    expect(findSkillsForRole(squadRoot, "backend dev")).toEqual([
      path.join("skills", "backend-flow", "SKILL.md"),
    ]);
  });

  it("extracts files written sections and aggregates by agent", () => {
    expect(
      parseFilesWritten("## Files written\n- `packages/cli/src/trace.ts`\n- README.md\n"),
    ).toEqual(["packages/cli/src/trace.ts", "README.md"]);

    const dir = path.join(squadRoot, "orchestration-log");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "2026-05-05T23-30Z-parker.md"),
      "## Files written\n- `packages/core/src/plugins/marketplace.ts`\n",
    );

    expect(findTouchedFiles(squadRoot, "parker")).toEqual([
      "packages/core/src/plugins/marketplace.ts",
    ]);
  });
});
