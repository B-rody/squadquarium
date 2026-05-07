import { describe, expect, it } from "vitest";
import { InputLine } from "../src/input-line.js";

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
});
