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

  it("builds startup messages with agent count", () => {
    const messages = createStartupMessages({ cwd: "C:\\Workspaces\\squadquarium" }, 4);
    expect(messages).toContain("Welcome to Squadquarium.");
    expect(messages).toEqual(expect.arrayContaining([expect.stringContaining("4 agent")]));
  });

  it("lists help text", () => {
    const help = createHelpMessages();
    expect(help.length).toBeGreaterThan(0);
    expect(help.join("\n")).toContain("/status");
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
    expect(activityLog.getEntries()).toHaveLength(1);
  });
});
