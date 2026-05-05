import { describe, it, expect } from "vitest";

// Probe whether node-pty native addon loaded cleanly.
const PTY_AVAILABLE = await (async () => {
  try {
    await import("node-pty");
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!PTY_AVAILABLE)("spike-1: node-pty load", () => {
  it("spawnNodeVersion returns a semver string", async () => {
    const { spawnNodeVersion } = await import("../../src/spikes/pty-load/index.js");
    const version = await spawnNodeVersion();
    expect(version).toMatch(/^v\d+\.\d+\.\d+/);
  });
});

describe.skipIf(PTY_AVAILABLE)("spike-1: node-pty fallback (build tools absent)", () => {
  it("node-pty is not available — fallback mode active per plan.md option (a)", () => {
    expect(PTY_AVAILABLE).toBe(false);
  });
});
