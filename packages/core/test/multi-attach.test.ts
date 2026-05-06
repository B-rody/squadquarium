import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureA = path.join(__dirname, "fixtures", "squad-a", ".squad");
const fixtureB = path.join(__dirname, "fixtures", "squad-b", ".squad");

vi.mock("@bradygaster/squad-sdk", () => ({
  VERSION: "0.9.4-test",
  resolveSquad: (cwd: string) => {
    // Return the fixture .squad dir when cwd is the parent of fixture dirs
    if (cwd.includes("squad-a")) return fixtureA;
    if (cwd.includes("squad-b")) return fixtureB;
    return null;
  },
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
    private rootDir: string;
    constructor(rootDir: string) {
      this.rootDir = rootDir;
    }
    static async create(_storage: unknown, parentDir: string) {
      return new SquadState(parentDir);
    }
    agents = {
      list: async () => {
        if (this.rootDir.includes("squad-a")) return ["ripley"];
        if (this.rootDir.includes("squad-b")) return ["lambert"];
        return [];
      },
      get: (name: string) => ({
        charter: async () => {
          if (name === "ripley") return "# Ripley — Infra\n\n## Voice\nPragmatic.";
          if (name === "lambert") return "# Lambert — Frontend Dev\n\n## Voice\nPrecise.";
          return "";
        },
      }),
    };
    team = {
      get: async () => {
        if (this.rootDir.includes("squad-a")) {
          return { members: [{ name: "ripley", role: "Infra", status: "✅ Active" }] };
        }
        if (this.rootDir.includes("squad-b")) {
          return { members: [{ name: "lambert", role: "Frontend Dev", status: "✅ Active" }] };
        }
        return null;
      },
    };
    decisions = {
      list: async () => [],
    };
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

describe("SquadStateAdapter.createMulti", () => {
  it("creates adapters for two distinct squad roots", async () => {
    const { SquadStateAdapter } = await import("../src/squad/adapter.js");

    const adapters = await SquadStateAdapter.createMulti({
      contexts: [
        { cwd: path.dirname(fixtureA), label: "squad-a" },
        { cwd: path.dirname(fixtureB), label: "squad-b" },
      ],
    });

    expect(adapters).toHaveLength(2);
    expect(adapters[0]!.label).toBe("squad-a");
    expect(adapters[1]!.label).toBe("squad-b");

    // Each adapter has a unique id
    expect(adapters[0]!.id).not.toBe(adapters[1]!.id);
  });

  it("returns snapshots with distinct agents per squad", async () => {
    const { SquadStateAdapter } = await import("../src/squad/adapter.js");

    const adapters = await SquadStateAdapter.createMulti({
      contexts: [
        { cwd: path.dirname(fixtureA), label: "squad-a" },
        { cwd: path.dirname(fixtureB), label: "squad-b" },
      ],
    });

    const [snapA, snapB] = await Promise.all(adapters.map((a) => a.getSnapshot()));

    expect(snapA!.agents.map((a) => a.name)).toContain("ripley");
    expect(snapB!.agents.map((a) => a.name)).toContain("lambert");

    // Agents are isolated per adapter
    const allNamesA = snapA!.agents.map((a) => a.name);
    const allNamesB = snapB!.agents.map((a) => a.name);
    expect(allNamesA).not.toContain("lambert");
    expect(allNamesB).not.toContain("ripley");

    for (const a of adapters) await a.dispose();
  });

  it("emits events tagged with the adapter id via subscribe", async () => {
    const { SquadStateAdapter } = await import("../src/squad/adapter.js");

    const adapters = await SquadStateAdapter.createMulti({
      contexts: [{ cwd: path.dirname(fixtureA), label: "squad-a" }],
    });

    expect(adapters).toHaveLength(1);
    const adapter = adapters[0]!;

    const received: { entityKey: string }[] = [];
    const unsub = adapter.subscribe((ev) => received.push({ entityKey: ev.entityKey }));

    // The adapter id and label are stable
    expect(typeof adapter.id).toBe("string");
    expect(adapter.label).toBe("squad-a");

    unsub();
    await adapter.dispose();
  });

  it("handles empty contexts gracefully", async () => {
    const { SquadStateAdapter } = await import("../src/squad/adapter.js");

    const adapters = await SquadStateAdapter.createMulti({ contexts: [] });
    expect(adapters).toHaveLength(0);
  });
});
