import type { ScreenBufferHD } from "terminal-kit";
import { describe, expect, it } from "vitest";
import { drawChrome } from "../src/chrome.js";
import type { Layout } from "../src/layout.js";
import { createMockBuffer } from "./helpers/mock-screen-buffer.js";

const layout: Layout = {
  width: 80,
  height: 24,
  aquarium: { x: 1, y: 1, width: 78, height: 12 },
  log: { x: 1, y: 14, width: 78, height: 6 },
  input: { x: 1, y: 21, width: 78, height: 2 },
  statusBar: { x: 0, y: 0, width: 80, height: 1 },
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

    const line = buffer.readLine(layout.log.y - 1);
    expect(line.startsWith("├")).toBe(true);
    expect(line.endsWith("┤")).toBe(true);
    expect(line).toContain("AQUARIUM");
  });

  it("renders status bar content", () => {
    const buffer = createMockBuffer(80, 24);

    drawChrome(buffer as unknown as ScreenBufferHD, layout, {
      teamName: "Squadquarium",
      skinName: "aquarium",
      agentCount: 4,
      color: "#00bfa5",
      bgColor: "#001f1c",
    });

    expect(buffer.readLine(0)).toContain("Squadquarium · skin:aquarium · agents:4");
  });
});
