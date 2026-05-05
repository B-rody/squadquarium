import { describe, expect, it } from "vitest";
import { parseArgs } from "../src/argv.js";

describe("parseArgs", () => {
  it("parses server options", () => {
    const args = parseArgs([
      "node",
      "squadquarium",
      "C:\\Workspace\\personal\\squadquarium",
      "--personal",
      "--port",
      "6285",
      "--host",
      "localhost",
      "--no-open",
      "--headless-smoke",
    ]);

    expect(args).toMatchObject({
      path: "C:\\Workspace\\personal\\squadquarium",
      personal: true,
      port: 6285,
      host: "localhost",
      open: false,
      headlessSmoke: true,
      subcommand: null,
    });
  });

  it("parses doctor and status subcommands", () => {
    expect(parseArgs(["node", "squadquarium", "doctor"]).subcommand).toBe("doctor");
    expect(parseArgs(["node", "squadquarium", "status"]).subcommand).toBe("status");
  });
});
