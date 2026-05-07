import { describe, expect, it } from "vitest";
import { Actor, ActorManager } from "../src/actor.js";

describe("Actor state machine", () => {
  it("creates actors in the idle state by default", () => {
    const actor = new Actor("lead", 5, 4);

    expect(actor.state).toBe("idle");
    expect(actor.frameIndex).toBe(0);
  });

  it("advances frames and wraps around", () => {
    const manager = new ActorManager(40, 20);
    const actor = manager.addActor("lead", 5, 4, "working");

    manager.tick(() => 2);
    expect(actor.frameIndex).toBe(1);

    manager.tick(() => 2);
    expect(actor.frameIndex).toBe(0);
  });

  it("keeps drifting actors inside bounds", () => {
    const manager = new ActorManager(12, 4, {
      spriteWidth: 7,
      spriteHeight: 2,
      driftEveryTicks: 1,
    });
    const actor = manager.addActor("lead", 10, 3);
    actor.direction = 1;

    for (let tick = 0; tick < 10; tick += 1) {
      manager.tick(() => 1);
    }

    expect(actor.x).toBeGreaterThanOrEqual(0);
    expect(actor.x).toBeLessThanOrEqual(5);
    expect(actor.y).toBeGreaterThanOrEqual(0);
    expect(actor.y).toBeLessThanOrEqual(2);
  });

  it("transitions through idle, working, and celebrate states", () => {
    const manager = new ActorManager(40, 20, {
      idleDurationTicks: 1,
      workingDurationTicks: 1,
      celebrateDurationTicks: 1,
    });
    const actor = manager.addActor("lead", 5, 4);

    manager.tick(() => 2);
    expect(actor.state).toBe("working");

    manager.tick(() => 2);
    expect(actor.state).toBe("celebrate");

    manager.tick(() => 2);
    expect(actor.state).toBe("idle");
  });

  it("toggles blink visibility at 1Hz on the default 12-tick cadence", () => {
    const manager = new ActorManager(40, 20, { blinkEveryTicks: 12 });
    const actor = manager.addActor("lead", 5, 4);

    for (let tick = 0; tick < 11; tick += 1) {
      manager.tick(() => 1);
    }
    expect(actor.blinkVisible).toBe(true);

    manager.tick(() => 1);
    expect(actor.blinkVisible).toBe(false);

    for (let tick = 0; tick < 12; tick += 1) {
      manager.tick(() => 1);
    }
    expect(actor.blinkVisible).toBe(true);
  });
});
