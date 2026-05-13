import { describe, expect, it } from "vitest";
import { calculateLayout } from "../src/layout.js";

const standardSizes = [
  { width: 80, height: 24 },
  { width: 120, height: 40 },
  { width: 200, height: 60 },
] as const;

function bottom(rect: { y: number; height: number }): number {
  return rect.y + rect.height;
}

describe("calculateLayout", () => {
  it.each(standardSizes)(
    "splits %ix%i with aquarium ~30%% and copilot ~70%%",
    ({ width, height }) => {
      const layout = calculateLayout(width, height);
      const total = layout.aquarium.height + layout.copilot.height;
      const aquariumRatio = total > 0 ? layout.aquarium.height / total : 0;

      expect(layout.width).toBe(width);
      expect(layout.height).toBe(height);
      expect(layout.aquarium.width).toBe(width - 2);
      expect(layout.copilot.width).toBe(width - 2);
      // Aquarium should be ~30% (between 25-35%)
      expect(aquariumRatio).toBeGreaterThanOrEqual(0.25);
      expect(aquariumRatio).toBeLessThanOrEqual(0.35);
      // Copilot pane gets the majority
      expect(layout.copilot.height).toBeGreaterThan(layout.aquarium.height);
      // Aquarium minimum
      expect(layout.aquarium.height).toBeGreaterThanOrEqual(5);
      // Copilot minimum
      expect(layout.copilot.height).toBeGreaterThanOrEqual(8);
      // No overlap: aquarium ends before copilot starts
      expect(bottom(layout.aquarium)).toBeLessThanOrEqual(layout.copilot.y);
      // Status bar at the bottom
      expect(layout.statusBar.y).toBe(height - 1);
      // Nothing overflows the terminal
      expect(bottom(layout.copilot)).toBeLessThanOrEqual(layout.statusBar.y);
    },
  );

  it("handles a very small terminal gracefully", () => {
    const layout = calculateLayout(40, 12);

    expect(layout.aquarium.width).toBe(38);
    expect(layout.copilot.width).toBe(38);
    // Both regions should have some height
    expect(layout.aquarium.height).toBeGreaterThan(0);
    expect(layout.copilot.height).toBeGreaterThan(0);
    // No overlap
    expect(bottom(layout.aquarium)).toBeLessThanOrEqual(layout.copilot.y);
    expect(bottom(layout.copilot)).toBeLessThanOrEqual(layout.statusBar.y);
  });

  it("handles a very wide terminal", () => {
    const layout = calculateLayout(300, 80);
    const total = layout.aquarium.height + layout.copilot.height;
    const aquariumRatio = layout.aquarium.height / total;

    expect(layout.aquarium.width).toBe(298);
    expect(layout.copilot.width).toBe(298);
    // Copilot dominates
    expect(layout.copilot.height).toBeGreaterThan(layout.aquarium.height);
    expect(aquariumRatio).toBeGreaterThanOrEqual(0.25);
    expect(aquariumRatio).toBeLessThanOrEqual(0.35);
  });

  it("regions never overlap", () => {
    for (const h of [10, 16, 24, 40, 80]) {
      const layout = calculateLayout(80, h);
      // aquarium must end before or at copilot start
      expect(bottom(layout.aquarium)).toBeLessThanOrEqual(layout.copilot.y);
      // copilot must end before or at status bar
      expect(bottom(layout.copilot)).toBeLessThanOrEqual(layout.statusBar.y);
    }
  });
});
