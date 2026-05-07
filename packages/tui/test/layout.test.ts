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
    "splits %ix%i into aquarium, log, and input regions",
    ({ width, height }) => {
      const layout = calculateLayout(width, height);
      const ratio = layout.aquarium.height / (layout.aquarium.height + layout.log.height);

      expect(layout.width).toBe(width);
      expect(layout.height).toBe(height);
      expect(layout.aquarium.width).toBe(width - 2);
      expect(layout.log.width).toBe(width - 2);
      expect(layout.input.width).toBe(width - 2);
      expect(ratio).toBeGreaterThanOrEqual(0.55);
      expect(ratio).toBeLessThanOrEqual(0.65);
      expect(layout.aquarium.height).toBeGreaterThanOrEqual(8);
      expect(layout.log.height).toBeGreaterThanOrEqual(4);
      expect(layout.input.height).toBe(2);
      expect(bottom(layout.input)).toBeLessThanOrEqual(height - 1);
    },
  );

  it("handles a very small terminal gracefully", () => {
    const layout = calculateLayout(40, 12);

    expect(layout.aquarium.width).toBe(38);
    expect(layout.log.width).toBe(38);
    expect(layout.input.height).toBe(2);
    expect(layout.aquarium.height).toBeGreaterThan(0);
    expect(layout.log.height).toBeGreaterThanOrEqual(0);
    expect(bottom(layout.input)).toBeLessThanOrEqual(11);
  });

  it("handles a very wide terminal", () => {
    const layout = calculateLayout(300, 80);
    const ratio = layout.aquarium.height / (layout.aquarium.height + layout.log.height);

    expect(layout.aquarium.width).toBe(298);
    expect(layout.log.width).toBe(298);
    expect(layout.input.width).toBe(298);
    expect(layout.input.height).toBe(2);
    expect(layout.aquarium.height).toBeGreaterThan(layout.log.height);
    expect(ratio).toBeGreaterThanOrEqual(0.55);
    expect(ratio).toBeLessThanOrEqual(0.65);
  });
});
