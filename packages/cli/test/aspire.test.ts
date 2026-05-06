import { describe, expect, it, vi } from "vitest";
import { extractUrl, isAspirePresent, runAspire, type ExecSyncLike } from "../src/aspire.js";

describe("aspire helpers", () => {
  it("detects whether squad aspire is present", () => {
    const ok: ExecSyncLike = vi.fn(() => "help");
    const missing: ExecSyncLike = vi.fn(() => {
      throw new Error("missing");
    });

    expect(isAspirePresent(ok)).toBe(true);
    expect(isAspirePresent(missing)).toBe(false);
  });

  it("extracts the first URL from output", () => {
    expect(extractUrl("Aspire listening at http://127.0.0.1:5050/home")).toBe(
      "http://127.0.0.1:5050/home",
    );
  });

  it("opens the detected Aspire URL", async () => {
    const exec = vi
      .fn()
      .mockReturnValueOnce("help")
      .mockReturnValueOnce("started http://127.0.0.1:5050");
    const open = vi.fn().mockResolvedValue(undefined);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await runAspire([], { exec, open });

    expect(open).toHaveBeenCalledWith("http://127.0.0.1:5050");
    log.mockRestore();
  });
});
