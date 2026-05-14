import { describe, expect, it } from "vitest";
import { CommandCenterPane, normalizeAgentId } from "../src/command-center-pane.js";
import { createMockBuffer } from "./helpers/mock-screen-buffer.js";

const colors = {
  fg: { r: 244, g: 251, b: 255 },
  bg: { r: 0, g: 27, b: 46 },
  dim: { r: 107, g: 140, b: 163 },
  accent: { r: 140, g: 220, b: 255 },
};

describe("CommandCenterPane", () => {
  it("renders roster rows", () => {
    const pane = new CommandCenterPane([{ name: "dallas", role: "Lead", status: "active" }]);
    const buffer = createMockBuffer(32, 8);

    pane.render(buffer, { x: 0, y: 0, width: 32, height: 8 }, colors, 0);

    expect(buffer.readLine(0)).toContain("Agent Command");
    expect(buffer.readLine(2)).toContain("Dallas");
    expect(buffer.readLine(3)).toContain("Lead");
    expect(buffer.readLine(4)).toContain("standing by");
  });

  it("shows working spinner and task details", () => {
    const pane = new CommandCenterPane([{ name: "lambert", role: "Frontend", status: "active" }]);
    pane.applyUpdate({
      name: "lambert",
      status: "working",
      task: "delegated by Copilot",
      model: "gpt-5.4",
    });
    const buffer = createMockBuffer(40, 8);

    pane.render(buffer, { x: 0, y: 0, width: 40, height: 8 }, colors, 1);

    expect(buffer.readLine(2)).toContain("\\ [WORKING] Lambert");
    expect(buffer.readLine(4)).toContain("delegated by Copilot");
    expect(buffer.readLine(4)).toContain("gpt-5.4");
  });

  it("hides model details after work completes", () => {
    const pane = new CommandCenterPane([{ name: "parker", role: "Backend", status: "active" }]);
    pane.applyUpdate({
      name: "parker",
      status: "working",
      task: "responding to prompt",
      model: "claude-opus-4.6-1m",
    });
    pane.applyUpdate({ name: "parker", status: "idle", task: "completed in 1.2s" });
    const buffer = createMockBuffer(40, 8);

    pane.render(buffer, { x: 0, y: 0, width: 40, height: 8 }, colors, 1);

    expect(buffer.readLine(4)).toContain("completed in 1.2s");
    expect(buffer.readLine(4)).not.toContain("claude-opus");
  });

  it("preserves active status across roster refreshes", () => {
    const pane = new CommandCenterPane([{ name: "parker", role: "Backend", status: "active" }]);
    pane.applyUpdate({ name: "parker", status: "working" });
    pane.updateRoster([{ name: "parker", role: "API", status: "active" }]);

    expect(pane.getRows()[0]).toMatchObject({
      name: "Parker",
      role: "API",
      status: "working",
      task: "delegated by Copilot",
    });
  });

  it("tracks duplicate starts before returning idle", () => {
    const pane = new CommandCenterPane([{ name: "scribe", role: "Scribe", status: "active" }]);
    pane.applyUpdate({ name: "scribe", status: "working" });
    pane.applyUpdate({ name: "scribe", status: "working" });
    pane.applyUpdate({ name: "scribe", status: "idle" });

    expect(pane.getRows()[0]?.status).toBe("working");

    pane.applyUpdate({ name: "scribe", status: "idle" });
    expect(pane.getRows()[0]).toMatchObject({ status: "idle", task: "standing by" });
  });

  it("normalizes SDK agent identifiers", () => {
    expect(normalizeAgentId("Dallas Lead")).toBe("dallas-lead");
    expect(normalizeAgentId("")).toBe("agent");
  });
});
