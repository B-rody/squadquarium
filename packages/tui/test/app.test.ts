import { describe, expect, it, vi } from "vitest";
import { ActivityLog } from "../src/activity-log.js";
import {
  createHelpMessages,
  createStartupMessages,
  handleAquariumClick,
  startApp,
  stopApp,
} from "../src/app.js";

describe("app", () => {
  it("starts and stops in headless smoke mode", async () => {
    await expect(
      startApp({ headless: true, smokeTest: true, headlessSize: { width: 80, height: 24 } }),
    ).resolves.toBeUndefined();

    await expect(stopApp()).resolves.toBeUndefined();
  }, 15_000);

  it("builds friendly startup messages", () => {
    expect(
      createStartupMessages({ cwd: "C:\\Workspaces\\squadquarium", attachPaths: ["C:\\extra"] }, 4),
    ).toEqual([
      "Welcome to Squadquarium.",
      "Watching: C:\\Workspaces\\squadquarium",
      "4 agents swimming.",
      "1 extra squad linked.",
      "Tank ready. Type help for commands, clear to wipe the log, exit to leave.",
    ]);
  });

  it("lists help text one command per log line", () => {
    expect(createHelpMessages()).toEqual([
      "Commands:",
      "  help   Show this guide",
      "  status Show aquarium panel size",
      "  clear  Clear the activity log",
      "  exit   Close Squadquarium",
      "  quit   Same as exit",
    ]);
  });

  it("only logs aquarium clicks when an actor is hit", () => {
    const activityLog = new ActivityLog();
    const actor = { role: "backend", setState: vi.fn() };
    const aquarium = {
      hitTest: vi.fn().mockReturnValueOnce(undefined).mockReturnValueOnce(actor),
    };

    handleAquariumClick(aquarium as never, activityLog, 3, 4);
    expect(activityLog.getEntries()).toHaveLength(0);

    handleAquariumClick(aquarium as never, activityLog, 5, 6);
    expect(actor.setState).toHaveBeenCalledWith("celebrate");
    expect(activityLog.getEntries().map((entry) => entry.message)).toEqual([
      "Octopus flashed a curious wave!",
    ]);
  });
});
