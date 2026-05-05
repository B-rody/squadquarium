import { describe, expect, it, vi } from "vitest";

vi.mock("node-pty", () => ({
  spawn: vi.fn(() => ({
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    onData: vi.fn(() => ({ dispose: vi.fn() })),
    onExit: vi.fn(() => ({ dispose: vi.fn() })),
  })),
}));

describe("PTYPool", () => {
  it("throws PtyPoolFullError when more than four PTYs are spawned", async () => {
    const { PTYPool, PtyPoolFullError } = await import("../src/pty/pool.js");
    const pool = new PTYPool();

    for (let i = 0; i < 4; i += 1) {
      await pool.spawn("node", ["--version"], { cols: 80, rows: 24 });
    }

    await expect(pool.spawn("node", ["--version"], { cols: 80, rows: 24 })).rejects.toBeInstanceOf(
      PtyPoolFullError,
    );
    expect(pool.size).toBe(4);
    pool.disposeAll();
  });

  it.skip("integration: spawns a real shell and streams output");
});
