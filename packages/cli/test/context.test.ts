import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

const sdkMock = vi.hoisted(() => ({
  squadDir: null as string | null,
  personalDir: null as string | null,
}));

vi.mock("@bradygaster/squad-sdk", () => ({
  resolveSquad: () => sdkMock.squadDir,
  resolvePersonalSquadDir: () => sdkMock.personalDir,
}));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runtimeRoot = path.join(__dirname, ".runtime", "context-home");

afterEach(() => {
  sdkMock.squadDir = null;
  sdkMock.personalDir = null;
  vi.unstubAllEnvs();
  vi.resetModules();
  fs.rmSync(runtimeRoot, { recursive: true, force: true });
});

async function loadContext() {
  fs.mkdirSync(runtimeRoot, { recursive: true });
  vi.stubEnv("HOME", runtimeRoot);
  vi.stubEnv("USERPROFILE", runtimeRoot);
  return import("../src/context.js");
}

describe("resolveContext", () => {
  it("uses a project squad when one resolves from cwd", async () => {
    const projectRoot = path.join(runtimeRoot, "project");
    sdkMock.squadDir = path.join(projectRoot, ".squad");
    fs.mkdirSync(sdkMock.squadDir, { recursive: true });
    const { resolveContext } = await loadContext();

    const result = await resolveContext({ cwd: projectRoot });

    expect(result).toEqual({
      mode: "connected",
      squadRoot: sdkMock.squadDir,
      projectRoot,
      personal: false,
    });
  });

  it("honors personal squad mode", async () => {
    const personalRoot = path.join(runtimeRoot, "personal", ".squad");
    sdkMock.personalDir = personalRoot;
    fs.mkdirSync(personalRoot, { recursive: true });
    const { resolveContext } = await loadContext();

    const result = await resolveContext({ cwd: runtimeRoot, personal: true });

    expect(result).toEqual({
      mode: "connected",
      squadRoot: personalRoot,
      projectRoot: path.dirname(personalRoot),
      personal: true,
    });
  });

  it("returns empty-state when no squad can be resolved", async () => {
    const { resolveContext } = await loadContext();

    const result = await resolveContext({ cwd: runtimeRoot });

    expect(result).toEqual({
      mode: "empty-state",
      squadRoot: null,
      projectRoot: runtimeRoot,
      personal: false,
    });
  });
});
