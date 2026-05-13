import { describe, expect, it } from "vitest";
import { checkDirectSubcommand, parseArgs } from "../src/argv.js";

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
  });
});
