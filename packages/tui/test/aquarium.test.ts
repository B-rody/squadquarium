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

    expect(aquarium.hitTest(0, 0)).toBeUndefined();
    expect(aquarium.hitTest(5, 4)).toBeUndefined();
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
    expect(buffer.putCalls.length).toBeGreaterThan(0);
  });
});
