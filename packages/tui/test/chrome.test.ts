import type { ScreenBufferHD } from "terminal-kit";
import { describe, expect, it } from "vitest";

import { drawChrome } from "../src/chrome.js";
import type { Layout } from "../src/layout.js";
import { createMockBuffer } from "./helpers/mock-screen-buffer.js";

const statusColor = { r: 244, g: 251, b: 255 };
const chromeColor = { r: 107, g: 140, b: 163 };
const labelColor = { r: 255, g: 209, b: 102 };
const chromeBgColor = { r: 0, g: 27, b: 46 };

const layout: Layout = {
  width: 80,
  height: 24,
  aquarium: { x: 1, y: 1, width: 78, height: 6 },
  copilot: { x: 1, y: 8, width: 53, height: 14 },
  commandCenter: { x: 55, y: 8, width: 24, height: 14 },
  log: { x: 1, y: 8, width: 53, height: 14 },
  input: { x: 1, y: 21, width: 53, height: 1 },
  statusBar: { x: 0, y: 23, width: 80, height: 1 },
};

describe("drawChrome", () => {
  it("uses box-drawing characters for the outer chrome", () => {
    const buffer = createMockBuffer(80, 24);

    drawChrome(buffer as unknown as ScreenBufferHD, layout, {
      teamName: "Squadquarium",
      skinName: "aquarium",
      agentCount: 4,
    });

    expect(buffer.charAt(0, 23)).toBe("└");
    expect(buffer.charAt(79, 23)).toBe("┘");
    expect(buffer.charAt(0, 5)).toBe("│");
    expect(buffer.charAt(79, 5)).toBe("│");
    expect(buffer.readLine(23)).toContain("─");
  });

  it("draws the aquarium separator at the expected row", () => {
    const buffer = createMockBuffer(80, 24);

    drawChrome(buffer as unknown as ScreenBufferHD, layout, {
      teamName: "Squadquarium",
      skinName: "aquarium",
      agentCount: 4,
    });

    const line = buffer.readLine(layout.copilot.y - 1);
    expect(line.startsWith("├")).toBe(true);
    expect(line.endsWith("┤")).toBe(true);
    expect(line).toContain("COPILOT");
    expect(line).toContain("COMMAND");
  });

  it("draws the command center vertical separator", () => {
    const buffer = createMockBuffer(80, 24);

    drawChrome(buffer as unknown as ScreenBufferHD, layout, {
      teamName: "Squadquarium",
      skinName: "aquarium",
      agentCount: 4,
    });

    expect(buffer.charAt(layout.commandCenter.x - 1, layout.commandCenter.y)).toBe("│");
  });

  it("renders status bar content", () => {
    const buffer = createMockBuffer(80, 24);

    drawChrome(buffer as unknown as ScreenBufferHD, layout, {
      teamName: "Squadquarium",
      skinName: "aquarium",
      agentCount: 4,
      statusBarPosition: "bottom",
      color: statusColor,
      bgColor: chromeBgColor,
      chromeColor,
      labelColor,
    });

    expect(buffer.readLine(23)).toContain("Squadquarium · skin:aquarium · agents:4");
  });

  it("applies distinct attrs to borders, labels, and status bar", () => {
    const buffer = createMockBuffer(80, 24);

    drawChrome(buffer as unknown as ScreenBufferHD, layout, {
      teamName: "Squadquarium",
      skinName: "aquarium",
      agentCount: 4,
      statusBarPosition: "bottom",
      color: statusColor,
      bgColor: chromeBgColor,
      chromeColor,
      labelColor,
    });

    // Border uses chromeColor
    expect(buffer.attrAt(0, 22)).toEqual({ color: chromeColor, bgColor: chromeBgColor });
    // Label uses labelColor
    expect(buffer.attrAt(2, layout.copilot.y - 1)).toEqual({
      color: labelColor,
      bgColor: chromeBgColor,
    });
    // Status bar uses inverse
    expect(buffer.attrAt(0, 23)).toEqual({
      inverse: true,
      color: statusColor,
      bgColor: chromeBgColor,
    });
  });
});
