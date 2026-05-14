import type { ScreenBufferHD } from "terminal-kit";
import { beforeEach, describe, expect, it } from "vitest";
import { Aquarium } from "../src/aquarium.js";
import { parseHalfBlockSheet } from "../src/halfblock-sprites.js";
import { loadSpritesSync } from "../src/sprites.js";
import { repoPath } from "./helpers/contracts.js";
import { createMockBuffer } from "./helpers/mock-screen-buffer.js";

const spriteSheet = loadSpritesSync(repoPath("skins", "aquarium", "sprites.json"));
const halfBlockOnlySprites = parseHalfBlockSheet(
  JSON.stringify({
    format: "halfblock",
    roles: {
      tester: {
        states: {
          idle: {
            frames: [
              {
                pixels: [
                  ["fg", "fg", null],
                  ["fg", "accent", null],
                  [null, "fg", null],
                ],
              },
            ],
          },
          working: {
            frames: [
              {
                pixels: [
                  ["accent", "fg", null],
                  ["fg", "accent", null],
                  [null, "fg", null],
                ],
              },
            ],
          },
        },
      },
    },
  }),
);

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

  it("supports distinct labels for multiple actors using the same sprite role", () => {
    const labeled = new Aquarium(50, 20, {
      spriteSheet,
      capabilities: { truecolor: true },
    });
    const first = labeled.addActor("lead", 5, 4);
    const second = labeled.addActor("lead", 30, 4);
    labeled.setActorLabel(first, { name: "Dallas", role: "Lead" });
    labeled.setActorLabel(second, { name: "Dana", role: "Lead" });
    const buffer = createMockBuffer(50, 20);

    labeled.render(buffer as unknown as ScreenBufferHD);

    const rendered = Array.from({ length: 20 }, (_, y) => buffer.readLine(y)).join("\n");
    expect(rendered).toContain("Dallas");
    expect(rendered).toContain("Dana");
  });

  it("sets actor state by stable label id", () => {
    const labeled = new Aquarium(40, 20, {
      spriteSheet,
      capabilities: { truecolor: true },
      autoCycleStates: false,
    });
    const actor = labeled.addActor("lead", 5, 4);
    labeled.setActorLabel(actor, { id: "dallas", name: "Dallas", role: "Lead" });

    expect(labeled.setActorStateById("dallas", "working")).toBe(true);
    labeled.tick();

    expect(actor.state).toBe("working");
  });

  it("renders thinking markers above working actors", () => {
    const labeled = new Aquarium(40, 20, {
      spriteSheet,
      capabilities: { truecolor: true },
      autoCycleStates: false,
    });
    const actor = labeled.addActor("lead", 5, 4, "working");
    labeled.setActorLabel(actor, { id: "dallas", name: "Dallas", role: "Lead" });
    const buffer = createMockBuffer(40, 20);

    labeled.render(buffer as unknown as ScreenBufferHD);

    const rendered = Array.from({ length: 20 }, (_, y) => buffer.readLine(y)).join("\n");
    expect(rendered).toContain("[Dallas BUSY]");
    expect(rendered).toContain("WORKING");
  });

  it("removes working markers when the actor returns to idle", () => {
    const labeled = new Aquarium(40, 20, {
      spriteSheet,
      capabilities: { truecolor: true },
      autoCycleStates: false,
    });
    const actor = labeled.addActor("lead", 5, 4, "working");
    labeled.setActorLabel(actor, { id: "dallas", name: "Dallas", role: "Lead" });
    labeled.setActorStateById("dallas", "idle");
    const buffer = createMockBuffer(40, 20);

    labeled.render(buffer as unknown as ScreenBufferHD);

    const rendered = Array.from({ length: 20 }, (_, y) => buffer.readLine(y)).join("\n");
    expect(rendered).toContain("[Dallas]");
    expect(rendered).not.toContain("[Dallas BUSY]");
    expect(rendered).not.toContain("WORKING");
  });

  it("does not auto-cycle states when externally driven", () => {
    const labeled = new Aquarium(40, 20, {
      spriteSheet,
      capabilities: { truecolor: true },
      autoCycleStates: false,
    });
    const actor = labeled.addActor("lead", 5, 4, "idle");

    for (let i = 0; i < 30; i += 1) {
      labeled.tick();
    }

    expect(actor.state).toBe("idle");
  });

  it("renders full half-block labels centered under actors", () => {
    const labeled = new Aquarium(40, 10, {
      spriteSheet,
      halfBlockSprites: halfBlockOnlySprites,
      capabilities: { truecolor: true },
    });
    const actor = labeled.addActor("tester", 10, 2);
    labeled.setActorLabel(actor, { name: "Dallas", role: "Lead" });
    const buffer = createMockBuffer(40, 10);

    labeled.render(buffer as unknown as ScreenBufferHD);

    const rendered = Array.from({ length: 10 }, (_, y) => buffer.readLine(y)).join("\n");
    expect(rendered).toContain("Dallas");
  });

  it("tints half-block actors by agent identity", () => {
    const labeled = new Aquarium(40, 10, {
      spriteSheet,
      halfBlockSprites: halfBlockOnlySprites,
      capabilities: { truecolor: true },
    });
    const first = labeled.addActor("tester", 4, 2);
    const second = labeled.addActor("tester", 18, 2);
    labeled.setActorLabel(first, { name: "Dallas", role: "Lead" });
    labeled.setActorLabel(second, { name: "Lambert", role: "Frontend" });
    const buffer = createMockBuffer(40, 10);

    labeled.render(buffer as unknown as ScreenBufferHD);

    expect(buffer.attrAt(4, 2)).not.toEqual(buffer.attrAt(18, 2));
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

  it("supports half-block-only sprite roles without requiring an ASCII fallback", () => {
    const halfBlockOnly = new Aquarium(20, 10, {
      spriteSheet,
      halfBlockSprites: halfBlockOnlySprites,
      capabilities: { truecolor: true },
    });
    const actor = halfBlockOnly.addActor("tester", 4, 2);
    const buffer = createMockBuffer(20, 10);

    expect(() => halfBlockOnly.tick()).not.toThrow();
    expect(() => halfBlockOnly.render(buffer as unknown as ScreenBufferHD)).not.toThrow();
    expect(() => halfBlockOnly.describeDebugRender()).not.toThrow();
    expect(halfBlockOnly.hitTest(4, 2)).toBe(actor);
  });
});
