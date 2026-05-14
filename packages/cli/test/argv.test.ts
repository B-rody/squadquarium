import { describe, expect, it } from "vitest";
import { checkDirectSubcommand, parseArgs, parseSdkWorkflowArgs } from "../src/argv.js";

describe("parseArgs", () => {
  it("parses TUI options", () => {
    const args = parseArgs([
      "node",
      "squadquarium",
      "C:\\Workspace\\personal\\squadquarium",
      "--personal",
      "--headless-smoke",
      "--debug",
      "--debug-log",
      "C:\\Temp\\sqq-debug.log",
      "--model",
      "gpt-5.4",
      "--mouse",
      "--attach",
      "C:\\Workspace\\team-a",
      "--attach",
      "C:\\Workspace\\team-b",
    ]);

    expect(args).toMatchObject({
      path: "C:\\Workspace\\personal\\squadquarium",
      personal: true,
      headlessSmoke: true,
      debug: true,
      debugLogPath: "C:\\Temp\\sqq-debug.log",
      model: "gpt-5.4",
      enableMouse: true,
      subcommand: null,
      attachPaths: ["C:\\Workspace\\team-a", "C:\\Workspace\\team-b"],
    });
  });

  it("parses doctor and status subcommands", () => {
    expect(parseArgs(["node", "squadquarium", "doctor"]).subcommand).toBe("doctor");
    expect(parseArgs(["node", "squadquarium", "status"]).subcommand).toBe("status");
  });

  it("detects standalone direct subcommands before Commander parsing", () => {
    expect(checkDirectSubcommand(["node", "squadquarium", "trace", "Parker"])).toBe("trace");
    expect(checkDirectSubcommand(["node", "squadquarium", "triage", "--execute"])).toBe("triage");
    expect(checkDirectSubcommand(["node", "squadquarium", "loop"])).toBe("loop");
    expect(checkDirectSubcommand(["node", "squadquarium", "serve"])).toBeNull();
  });

  it("parses --yolo flag", () => {
    const args = parseArgs(["node", "squadquarium", "--yolo"]);
    expect(args.yolo).toBe(true);
    expect(args.enableMouse).toBe(false);
  });

  it("parses SDK workflow flags without passing them through", () => {
    const args = parseSdkWorkflowArgs(["--model", "gpt-5.4", "--yolo", "--execute"]);
    expect(args).toEqual({
      model: "gpt-5.4",
      yolo: true,
      passthrough: ["--execute"],
    });
  });

  it("parses --model=value for SDK workflow flags", () => {
    const args = parseSdkWorkflowArgs(["--model=claude-sonnet-4.6", "--interval", "5"]);
    expect(args).toEqual({
      model: "claude-sonnet-4.6",
      yolo: false,
      passthrough: ["--interval", "5"],
    });
  });
});
