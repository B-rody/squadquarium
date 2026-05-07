import { describe, it, expect } from "vitest";

describe("cellMetrics", () => {
  it("returns fallback metrics when document is unavailable", async () => {
    const { getCellMetrics } = await import("../../src/render/cellMetrics.js");
    const m = getCellMetrics(14);
    expect(m.cellW).toBeGreaterThan(0);
    expect(m.cellH).toBeGreaterThan(0);
    expect(m.baseline).toBeGreaterThan(0);
  });

  it("returns different metrics for different font sizes", async () => {
    const { getCellMetrics } = await import("../../src/render/cellMetrics.js");
    const m14 = getCellMetrics(14);
    const m16 = getCellMetrics(16);
    expect(m14).toBeDefined();
    expect(m16).toBeDefined();
  });
});
