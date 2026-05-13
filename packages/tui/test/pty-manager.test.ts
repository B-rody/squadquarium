import { describe, expect, it } from "vitest";
import { resolveCommand } from "../src/pty-manager.js";

describe("resolveCommand", () => {
  it("resolves copilot mode", () => {
    expect(resolveCommand("copilot", [])).toEqual({
      cmd: "copilot",
      args: ["--agent", "squad"],
    });
  });

  it("resolves copilot mode with --yolo", () => {
    expect(resolveCommand("copilot", ["--yolo"])).toEqual({
      cmd: "copilot",
      args: ["--agent", "squad", "--yolo"],
    });
  });

  it("resolves triage mode", () => {
    expect(resolveCommand("triage", ["--execute", "--interval", "5"])).toEqual({
      cmd: "squad",
      args: ["triage", "--execute", "--interval", "5"],
    });
  });

  it("resolves loop mode", () => {
    expect(resolveCommand("loop", ["--init"])).toEqual({
      cmd: "squad",
      args: ["loop", "--init"],
    });
  });
});
