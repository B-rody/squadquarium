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
  it("appends lines from SDK output", () => {
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

  it("strips ANSI from tool output", () => {
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
    expect(buffer.readLine(8)).toContain("hello copilot");
    expect(buffer.readLine(9)).toContain(">");
  });

  it("clears all content", () => {
    const pane = new CopilotPane();
    pane.write("data\n");
    pane.clear();

    expect(pane.lineCount).toBe(0);
  });

  it("returns the logical transcript for pane-only copy", () => {
    const pane = new CopilotPane();
    pane.write("hello\n\nworld");

    expect(pane.getTranscriptText()).toBe("hello\n\nworld");
  });

  it("edits and consumes the prompt input", () => {
    const pane = new CopilotPane();
    pane.appendInput("hello");
    pane.backspaceInput();
    pane.appendInput("p");

    expect(pane.getInput()).toBe("hellp");
    expect(pane.consumeInput()).toBe("hellp");
    expect(pane.getInput()).toBe("");
  });

  it("sets prompt input directly for autocomplete", () => {
    const pane = new CopilotPane();
    pane.appendInput("/he");
    pane.setInput("/help ");

    expect(pane.getInput()).toBe("/help ");
  });

  it("renders modal input hints", () => {
    const pane = new CopilotPane();
    pane.setInputHint("Approve shell command? [y/n]");
    pane.setInputStatus("Copilot is thinking...");

    const buffer = createMockBuffer(40, 4);
    const colors = {
      fg: { r: 244, g: 251, b: 255 },
      bg: { r: 0, g: 27, b: 46 },
      dim: { r: 107, g: 140, b: 163 },
      accent: { r: 140, g: 220, b: 255 },
    };

    pane.render(buffer, { x: 0, y: 0, width: 40, height: 4 }, colors);
    expect(buffer.readLine(3)).toContain("Approve shell command?");
    expect(buffer.readLine(3)).not.toContain("thinking");
  });

  it("renders busy status without hiding typed input", () => {
    const pane = new CopilotPane();
    pane.appendInput("hello");
    pane.setInputStatus("Copilot is thinking...");

    const buffer = createMockBuffer(52, 4);
    const colors = {
      fg: { r: 244, g: 251, b: 255 },
      bg: { r: 0, g: 27, b: 46 },
      dim: { r: 107, g: 140, b: 163 },
      accent: { r: 140, g: 220, b: 255 },
    };

    pane.render(buffer, { x: 0, y: 0, width: 52, height: 4 }, colors);
    expect(buffer.readLine(3)).toContain("> hello");
    expect(buffer.readLine(3)).toContain("Copilot is thinking");
  });

  it("renders inline completion suggestions in dim text", () => {
    const pane = new CopilotPane();
    pane.appendInput("/he");
    pane.setInputSuggestion("lp ");

    const buffer = createMockBuffer(24, 3);
    const colors = {
      fg: { r: 244, g: 251, b: 255 },
      bg: { r: 0, g: 27, b: 46 },
      dim: { r: 107, g: 140, b: 163 },
      accent: { r: 140, g: 220, b: 255 },
    };

    pane.render(buffer, { x: 0, y: 0, width: 24, height: 3 }, colors);

    expect(buffer.readLine(2)).toContain("> /help");
    expect(buffer.attrAt(5, 2)).toEqual({ color: colors.dim, bgColor: colors.bg });
  });
});
