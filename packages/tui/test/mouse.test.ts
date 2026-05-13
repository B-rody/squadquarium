import { describe, expect, it, vi } from "vitest";
import { MouseHandler } from "../src/mouse.js";

const regions = {
  aquarium: { x: 1, y: 1, width: 20, height: 10 },
  log: { x: 1, y: 12, width: 20, height: 5 },
  input: { x: 1, y: 18, width: 20, height: 2 },
};

describe("MouseHandler", () => {
  it("dispatches aquarium clicks on button press only", () => {
    const onAquariumClick = vi.fn();
    const handler = new MouseHandler({
      getRegions: () => regions,
      onAquariumClick,
      onLogScroll: vi.fn(),
      onInputFocus: vi.fn(),
    });

    expect(handler.dispatch("LEFT_BUTTON_PRESSED", { x: 5, y: 5 })).toBe(true);
    expect(handler.dispatch("LEFT_BUTTON_RELEASED", { x: 5, y: 5 })).toBe(false);
    expect(onAquariumClick).toHaveBeenCalledTimes(1);
  });
});
