import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

const sdkMock = vi.hoisted(() => ({
  fixtureSquadDir: "",
}));

vi.mock("@bradygaster/squad-sdk", () => ({
  VERSION: "0.9.4-test",
  resolveSquad: () => sdkMock.fixtureSquadDir,
  resolvePersonalSquadDir: () => null,
  FSStorageProvider: class FSStorageProvider {
    constructor(readonly rootDir?: string) {}
  },
  RuntimeEventBus: class RuntimeEventBus {
    subscribeAll() {
      return () => undefined;
    }

    clear() {
      return undefined;
    }
  },
  SquadState: class SquadState {
    static async create() {
      return {
        agents: {
          list: async () => ["dallas"],
          get: () => ({ charter: async () => "# Dallas — Lead" }),
        },
        team: {
          get: async () => ({
            projectContext: "fixture",
            members: [{ name: "dallas", role: "Lead", status: "✅ Active" }],
          }),
        },
        decisions: {
          list: async () => [
            {
              date: "2026-05-05",
              title: "Test decision",
              author: "Dallas",
              body: "Fixture decision body.",
              configRelevant: false,
            },
          ],
        },
      };
    }
  },
}));

vi.mock("@bradygaster/squad-sdk/runtime/squad-observer", () => ({
  SquadObserver: class SquadObserver {
    isRunning = false;
    start() {
      this.isRunning = true;
    }
    stop() {
      this.isRunning = false;
    }
  },
}));

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function createAdapter() {
  sdkMock.fixtureSquadDir = path.join(__dirname, "fixtures", "squad", ".squad");
  const { SquadStateAdapter } = await import("../src/squad/adapter.js");
  return SquadStateAdapter.create({ cwd: path.dirname(sdkMock.fixtureSquadDir) });
}

describe("SquadStateAdapter", () => {
  it("getSnapshot returns agents, decisions, log tail, and skins", async () => {
    const adapter = await createAdapter();
    expect(adapter).not.toBeNull();

    const snapshot = await adapter!.getSnapshot();

    expect(snapshot.agents).toMatchObject([
      {
        name: "dallas",
        role: "Lead",
        status: "active",
        charterPath: path.join(sdkMock.fixtureSquadDir, "agents", "dallas", "charter.md"),
        historyPath: path.join(sdkMock.fixtureSquadDir, "agents", "dallas", "history.md"),
      },
    ]);
    expect(snapshot.decisions[0]).toMatchObject({ by: "Dallas", what: "Test decision" });
    expect(snapshot.logTail[0]).toMatchObject({ agent: "dallas", topic: "adapter", source: "log" });
    expect(snapshot.skinNames).toEqual([]);

    await adapter!.dispose();
  });
});
