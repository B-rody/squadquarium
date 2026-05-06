import { describe, expect, it } from "vitest";
import {
  parseDuration,
  renderDioramaFrame,
  renderSprite,
  type SpritesJson,
} from "../src/diorama.js";

const sprites: SpritesJson = {
  roles: {
    lead: { states: { idle: { frames: [{ cells: [[{ glyph: "<" }, { glyph: ">" }]] }] } } },
    frontend: { states: { idle: { frames: [{ cells: [[{ glyph: "F" }]] }] } } },
    backend: { states: { idle: { frames: [{ cells: [[{ glyph: "B" }]] }] } } },
    tester: { states: { idle: { frames: [{ cells: [[{ glyph: "T" }]] }] } } },
    scribe: { states: { idle: { frames: [{ cells: [[{ glyph: "S" }]] }] } } },
  },
};

describe("diorama rendering", () => {
  it("parses simple durations", () => {
    expect(parseDuration("200ms")).toBe(200);
    expect(parseDuration("2s")).toBe(2000);
    expect(parseDuration("50")).toBe(50);
    expect(parseDuration("bad")).toBe(0);
  });

  it("collapses sprite cell grids into glyph strings", () => {
    expect(renderSprite(sprites.roles?.lead, 0, false)).toEqual(["<>"]);
  });

  it("renders one band per active agent", () => {
    const output = renderDioramaFrame(sprites, 0, 80);

    expect(output).toContain("[Dallas] <>");
    expect(output).toContain("[Parker] B");
    expect(output.split("\n")).toHaveLength(5);
  });
});
