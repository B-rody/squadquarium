import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  findSquadRoot,
  readAgents,
  readTeamName,
  readFocus,
  readRecentDecision,
  SquadWatcher,
} from "../src/squad-watcher.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sqq-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function setupSquad(): string {
  const squadDir = path.join(tmpDir, ".squad");
  fs.mkdirSync(path.join(squadDir, "agents", "dallas"), { recursive: true });
  fs.mkdirSync(path.join(squadDir, "agents", "lambert"), { recursive: true });
  fs.mkdirSync(path.join(squadDir, "identity"), { recursive: true });

  fs.writeFileSync(
    path.join(squadDir, "agents", "dallas", "charter.md"),
    "# Dallas — Lead\n\n- **Expertise:** Architecture, decisions\n",
  );
  fs.writeFileSync(
    path.join(squadDir, "agents", "lambert", "charter.md"),
    "# Lambert — Frontend Dev\n\n- **Expertise:** React, UI\n",
  );
  fs.writeFileSync(path.join(squadDir, "team.md"), "# Platform Squad\n\n## Members\n...\n");
  fs.writeFileSync(path.join(squadDir, "identity", "now.md"), "Building the login page\n");
  fs.writeFileSync(
    path.join(squadDir, "decisions.md"),
    "# Decisions\n\n### 2026-05-12 — Use JWT for auth\n\nReason: ...\n",
  );

  return squadDir;
}

describe("findSquadRoot", () => {
  it("finds .squad/ in the given directory", () => {
    setupSquad();
    expect(findSquadRoot(tmpDir)).toBe(path.join(tmpDir, ".squad"));
  });

  it("walks up parent directories", () => {
    setupSquad();
    const nested = path.join(tmpDir, "packages", "cli");
    fs.mkdirSync(nested, { recursive: true });
    expect(findSquadRoot(nested)).toBe(path.join(tmpDir, ".squad"));
  });

  it("returns null when no .squad/ exists", () => {
    expect(findSquadRoot(os.tmpdir())).toBeNull();
  });
});

describe("readAgents", () => {
  it("reads agent names and roles from charter files", () => {
    const squadDir = setupSquad();
    const agents = readAgents(squadDir);

    expect(agents).toHaveLength(2);
    expect(agents.map((a) => a.name).sort()).toEqual(["dallas", "lambert"]);
    expect(agents.find((a) => a.name === "dallas")?.role).toBe("Lead");
    expect(agents.find((a) => a.name === "lambert")?.role).toBe("Frontend Dev");
  });

  it("returns empty array when agents dir is missing", () => {
    const emptySquad = path.join(tmpDir, ".squad-empty");
    fs.mkdirSync(emptySquad);
    expect(readAgents(emptySquad)).toEqual([]);
  });
});

describe("readTeamName", () => {
  it("parses team name from team.md heading", () => {
    const squadDir = setupSquad();
    expect(readTeamName(squadDir)).toBe("Platform Squad");
  });

  it("returns default when team.md is missing", () => {
    expect(readTeamName(path.join(tmpDir, "nonexistent"))).toBe("Squad Team");
  });
});

describe("readFocus", () => {
  it("reads focus from identity/now.md", () => {
    const squadDir = setupSquad();
    expect(readFocus(squadDir)).toBe("Building the login page");
  });
});

describe("readRecentDecision", () => {
  it("reads the most recent decision heading", () => {
    const squadDir = setupSquad();
    expect(readRecentDecision(squadDir)).toContain("Use JWT for auth");
  });
});

describe("SquadWatcher", () => {
  it("readState returns full state when .squad/ exists", () => {
    setupSquad();
    const watcher = new SquadWatcher(tmpDir);

    expect(watcher.detected).toBe(true);
    const state = watcher.readState();
    expect(state.agents).toHaveLength(2);
    expect(state.teamName).toBe("Platform Squad");
    expect(state.focus).toBe("Building the login page");
    expect(state.recentDecision).toContain("Use JWT for auth");
  });

  it("readState returns empty state when no .squad/", () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "sqq-empty-"));
    try {
      const watcher = new SquadWatcher(emptyDir);
      expect(watcher.detected).toBe(false);
      const state = watcher.readState();
      expect(state.agents).toEqual([]);
      expect(state.teamName).toBe("No Squad");
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });
});
