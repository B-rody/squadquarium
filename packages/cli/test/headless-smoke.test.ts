import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(cliRoot, "..", "..");
const entry = path.join(cliRoot, "dist", "index.js");

describe("CLI — invocation contract", () => {
  it("prints help and exits 0", () => {
    const result = spawnSync(process.execPath, [entry, "--help"], {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: 10_000,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage:");
  });
});

describe("CLI — --headless-smoke flag", () => {
  it("boots the server, hits the WS endpoint, and exits 0 with a JSON result", () => {
    const result = spawnSync(process.execPath, [entry, "--headless-smoke", "--no-open"], {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: 30_000,
    });

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout.trim()) as { ok: boolean; durationMs: number };
    expect(parsed.ok).toBe(true);
    expect(parsed.durationMs).toBeGreaterThanOrEqual(0);
  });
});
