import type { ScreenBufferHD } from "terminal-kit";
import { beforeEach, describe, expect, it } from "vitest";
import { Aquarium } from "../src/aquarium.js";
import { loadSpritesSync } from "../src/sprites.js";
import { repoPath } from "./helpers/contracts.js";
import { createMockBuffer } from "./helpers/mock-screen-buffer.js";

const spriteSheet = loadSpritesSync(repoPath("skins", "aquarium", "sprites.json"));

let aquarium: Aquarium;

beforeEach(() => {
  aquarium = new Aquarium(40, 20, {
    spriteSheet,
    capabilities: { truecolor: true },
  });
});

describe("Aquarium", () => {
  it("places actors at the requested position", () => {
    const actor = aquarium.addActor("lead", 5, 4);

    expect(actor.x).toBe(5);
    expect(actor.y).toBe(4);
  });

  it("hitTest returns the actor for visible sprite coordinates", () => {
    const actor = aquarium.addActor("lead", 5, 4);

    expect(aquarium.hitTest(5, 5)).toBe(actor);
  });

  it("hitTest returns undefined for empty space", () => {
    aquarium.addActor("lead", 5, 4);

    expect(aquarium.hitTest(0, 19)).toBeUndefined();
    expect(aquarium.hitTest(30, 2)).toBeUndefined();
  });

  it("hitTest accepts the actor label and card bounds when labels are configured", () => {
    const labeled = new Aquarium(40, 20, {
      spriteSheet,
      capabilities: { truecolor: true },
      roleLabels: { lead: { name: "Dallas", role: "Lead" } },
    });
    const actor = labeled.addActor("lead", 5, 4);

    expect(labeled.hitTest(3, 6)).toBe(actor);
  });

  it("tick advances all actor frames", () => {
    const actorA = aquarium.addActor("lead", 5, 4, "working");
    const actorB = aquarium.addActor("backend", 15, 8, "working");

    aquarium.tick();

    expect(actorA.frameIndex).toBe(1);
    expect(actorB.frameIndex).toBe(1);
  });

  it("renders into a mock ScreenBuffer without throwing", () => {
    aquarium.addActor("lead", 5, 4);
    const buffer = createMockBuffer(40, 20);

    expect(() => aquarium.render(buffer as unknown as ScreenBufferHD)).not.toThrow();
    expect(buffer.fillCalls).toHaveLength(1);
    expect(buffer.fillCalls[0]?.attr).toEqual({
      color: { r: 244, g: 251, b: 255 },
      bgColor: { r: 0, g: 27, b: 46 },
    });
    expect(buffer.putCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          attr: expect.objectContaining({
            color: expect.objectContaining({
              r: expect.any(Number),
              g: expect.any(Number),
              b: expect.any(Number),
            }),
            bgColor: expect.objectContaining({
              r: expect.any(Number),
              g: expect.any(Number),
              b: expect.any(Number),
            }),
          }),
        }),
      ]),
    );
  });

  it("describes the colorized render plan for debug logging", () => {
    aquarium.addActor("lead", 5, 4);

    expect(aquarium.describeDebugRender()).toEqual(
      expect.arrayContaining([
        "[DEBUG] render fill fg=rgb(244,251,255) bg=rgb(0,27,46) mode=truecolor",
        expect.stringContaining("[DEBUG] render lead.idle[0]"),
        expect.stringContaining("fg alert=rgb(239,71,111)"),
      ]),
    );
  });
});
