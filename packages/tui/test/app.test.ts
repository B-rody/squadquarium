import { describe, expect, it, vi } from "vitest";
import { ActivityLog } from "../src/activity-log.js";
import {
  completeSlashInput,
  createHelpMessages,
  createSlashCommandHelpMessages,
  createStartupMessages,
  detectPromptTargetAgentId,
  getSlashCompletionHint,
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
    expect(help.join("\n")).toContain("GitHub Copilot SDK");
    expect(help.join("\n")).toContain("/help");
    expect(help.join("\n")).toContain("/model");
  });

  it("lists local slash commands", () => {
    const help = createSlashCommandHelpMessages();
    expect(help.join("\n")).toContain("/help");
    expect(help.join("\n")).toContain("/models");
    expect(help.join("\n")).toContain("/model <id>");
    expect(help.join("\n")).toContain("/copy");
    expect(help.join("\n")).toContain("Tab");
  });

  it("detects explicit prompt-leading agent names for optimistic activity", () => {
    const rows = [
      { id: "dallas", name: "Dallas" },
      { id: "lambert", name: "Lambert" },
    ];

    expect(detectPromptTargetAgentId("dallas say hi", rows)).toBe("dallas");
    expect(detectPromptTargetAgentId("@lambert check this", rows)).toBe("lambert");
    expect(detectPromptTargetAgentId("ask dallas to say hi", rows)).toBeNull();
  });

  it("autocompletes local slash commands", () => {
    expect(completeSlashInput("/he")).toEqual({ kind: "complete", value: "/help " });
    expect(completeSlashInput("/m")).toEqual({ kind: "complete", value: "/model" });
    expect(completeSlashInput("/")).toMatchObject({ kind: "suggest" });
    expect(completeSlashInput("//literal")).toEqual({ kind: "none" });
  });

  it("builds inline slash completion hints", () => {
    expect(getSlashCompletionHint("/he")).toBe("lp ");
    expect(getSlashCompletionHint("/m")).toBe("odel");
    expect(getSlashCompletionHint("/model")).toBeNull();
  });

  it("autocompletes model ids when available", () => {
    expect(completeSlashInput("/model g", undefined, ["gpt-5.4", "claude-sonnet-4.6"])).toEqual({
      kind: "complete",
      value: "/model gpt-5.4",
    });
    expect(completeSlashInput("/model g", undefined, [])).toEqual({ kind: "need-models" });
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
