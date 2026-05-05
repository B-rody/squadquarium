import { describe, it, expect } from "vitest";

describe("core smoke", () => {
  it("exports EventReconciler from index", async () => {
    const { EventReconciler } = await import("../src/index.js");
    expect(EventReconciler).toBeDefined();
    const r = new EventReconciler();
    expect(typeof r.ingest).toBe("function");
  });
});
