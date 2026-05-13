import { describe, expect, it } from "vitest";
import { InputLine } from "../src/input-line.js";
import { createMockBuffer } from "./helpers/mock-screen-buffer.js";

describe("InputLine", () => {
  it("emits commands on enter", () => {
    const input = new InputLine();
    const seen: string[] = [];
    input.on("command", (command) => seen.push(command));

    input.handleKey("h");
    input.handleKey("i");
    input.handleKey("ENTER");

    expect(seen).toEqual(["hi"]);
  });

  it("recalls history with arrow keys", () => {
    const input = new InputLine();
    input.handleKey("h");
    input.handleKey("i");
    input.handleKey("ENTER");
    input.handleKey("UP");

    expect(input.getValue()).toBe("hi");
  });

  it("renders prompt and hint with color attrs", () => {
    const colors = {
      promptColor: { r: 255, g: 209, b: 102 },
      textColor: { r: 244, g: 251, b: 255 },
      hintColor: { r: 107, g: 140, b: 163 },
      bgColor: { r: 0, g: 27, b: 46 },
    };
    const input = new InputLine("sqq> ");
    const buffer = createMockBuffer(48, 2);

    input.handleKey("h");
    input.handleKey("i");
    input.render(buffer, { x: 0, y: 0, width: 48, height: 2 }, colors);

    expect(buffer.putCalls[0]).toEqual(
      expect.objectContaining({
        attr: { color: colors.promptColor, bgColor: colors.bgColor },
        char: "sqq> ",
      }),
    );
    expect(buffer.putCalls[1]).toEqual(
      expect.objectContaining({
        attr: { color: colors.textColor, bgColor: colors.bgColor },
        char: "hi_",
      }),
    );
    expect(buffer.putCalls[2]).toEqual(
      expect.objectContaining({
        attr: { color: colors.hintColor, bgColor: colors.bgColor },
        char: expect.stringContaining("Enter=send  Try: inspect Lambert"),
      }),
    );
  });
});
