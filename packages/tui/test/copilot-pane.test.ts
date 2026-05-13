import { describe, expect, it } from "vitest";
import { CopilotPane, stripAnsi } from "../src/copilot-pane.js";
import { createMockBuffer } from "./helpers/mock-screen-buffer.js";

describe("stripAnsi", () => {
  it("removes SGR color codes", () => {
    expect(stripAnsi("\x1B[32mgreen\x1B[0m")).toBe("green");
  });

  it("removes cursor movement", () => {
    expect(stripAnsi("\x1B[2J\x1B[Hhello")).toBe("hello");
  });

  it("removes OSC sequences", () => {
    expect(stripAnsi("\x1B]0;title\x07text")).toBe("text");
  });

  it("removes carriage returns", () => {
    expect(stripAnsi("line1\rline2")).toBe("line1line2");
  });

  it("passes plain text through", () => {
    expect(stripAnsi("hello world")).toBe("hello world");
  });
});

describe("CopilotPane", () => {
  it("appends lines from PTY output", () => {
    const pane = new CopilotPane();
    pane.write("line1\nline2\nline3\n");

    expect(pane.lineCount).toBe(3);
    expect(pane.getVisibleLines(10)).toEqual(["line1", "line2", "line3"]);
  });

  it("handles partial lines across writes", () => {
    const pane = new CopilotPane();
    pane.write("hel");
    pane.write("lo\nworld\n");

    expect(pane.getVisibleLines(10)).toEqual(["hello", "world"]);
  });

  it("strips ANSI from PTY output", () => {
    const pane = new CopilotPane();
    pane.write("\x1B[1m\x1B[32m◆ Loading Squad shell...\x1B[0m\n");

    expect(pane.getVisibleLines(10)).toEqual(["◆ Loading Squad shell..."]);
  });

  it("scrolls up and shows indicator", () => {
    const pane = new CopilotPane();
    for (let i = 0; i < 20; i++) {
      pane.write(`line ${i}\n`);
    }

    pane.scroll(5);
    const visible = pane.getVisibleLines(10);
    // Should show lines 5-14 (not the last 5)
    expect(visible).toHaveLength(10);
    expect(visible[0]).toBe("line 5");
    expect(visible[9]).toBe("line 14");
  });

  it("renders into a mock buffer", () => {
    const pane = new CopilotPane();
    pane.write("hello copilot\n");

    const buffer = createMockBuffer(40, 10);
    const colors = {
      fg: { r: 244, g: 251, b: 255 },
      bg: { r: 0, g: 27, b: 46 },
      dim: { r: 107, g: 140, b: 163 },
    };

    pane.render(buffer, { x: 0, y: 0, width: 40, height: 10 }, colors);
    expect(buffer.readLine(9)).toContain("hello copilot");
  });

  it("clears all content", () => {
    const pane = new CopilotPane();
    pane.write("data\n");
    pane.clear();

    expect(pane.lineCount).toBe(0);
  });
});
