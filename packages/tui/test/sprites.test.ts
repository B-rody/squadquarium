import { beforeAll, describe, expect, it } from "vitest";
import { loadSprites, validateSpriteSheet, type SpriteSheet } from "../src/sprites.js";
import { repoPath } from "./helpers/contracts.js";

const SPRITES_PATH = repoPath("skins", "aquarium", "sprites.json");
const INVALID_SPRITES_PATH = repoPath(
  "packages",
  "tui",
  "test",
  "fixtures",
  "invalid-sprites.json",
);

let sheet: SpriteSheet;

beforeAll(async () => {
  sheet = await loadSprites(SPRITES_PATH);
});

describe("sprite loading", () => {
  it("loads the actual aquarium sprite sheet", () => {
    expect(Object.keys(sheet.roles)).toEqual(
      expect.arrayContaining(["lead", "frontend", "backend", "scribe"]),
    );
  });

  it("contains roles, states, and frames", () => {
    for (const role of Object.values(sheet.roles)) {
      expect(Object.keys(role.states).length).toBeGreaterThan(0);
      for (const state of Object.values(role.states)) {
        expect(state.frames.length).toBeGreaterThan(0);
      }
    }
  });

  it("uses 2x7 frames for the aquarium skin", () => {
    for (const role of Object.values(sheet.roles)) {
      for (const state of Object.values(role.states)) {
        for (const frame of state.frames) {
          expect(frame.cells).toHaveLength(2);
          frame.cells.forEach((row) => expect(row).toHaveLength(7));
        }
      }
    }
  });

  it("requires glyph, fg, and bg on every cell", () => {
    for (const role of Object.values(sheet.roles)) {
      for (const state of Object.values(role.states)) {
        for (const frame of state.frames) {
          for (const row of frame.cells) {
            for (const cell of row) {
              expect(cell.glyph).toEqual(expect.any(String));
              expect(cell.fg).toEqual(expect.any(String));
              expect(cell.bg).toEqual(expect.any(String));
            }
          }
        }
      }
    }
  });

  it("throws on invalid sprite data", async () => {
    await expect(loadSprites(INVALID_SPRITES_PATH)).rejects.toThrow();
    expect(() =>
      validateSpriteSheet({
        roles: {
          lead: {
            states: {
              idle: {
                frames: [{ cells: [[{ glyph: "(", fg: "fg" }]] }],
              },
            },
          },
        },
      }),
    ).toThrow();
  });
});
