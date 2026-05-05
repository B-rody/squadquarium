import { describe, it, expect } from "vitest";
import { EventReconciler } from "../src/events.js";
import type { SquadquariumEvent } from "../src/events.js";

function ev(
  entityKey: string,
  source: SquadquariumEvent["source"],
  seq: number,
  payload: unknown = null,
  causedByCommandId?: string,
): SquadquariumEvent {
  return {
    sessionId: "s1",
    source,
    seq,
    entityKey,
    causedByCommandId,
    observedAt: Date.now(),
    payload,
  };
}

describe("EventReconciler", () => {
  it("in-order single source: 3 events accepted, snapshot returns latest payload", () => {
    const r = new EventReconciler();
    expect(r.ingest(ev("agent:dallas", "fs", 1, "a")).accepted).toBe(true);
    expect(r.ingest(ev("agent:dallas", "fs", 2, "b")).accepted).toBe(true);
    expect(r.ingest(ev("agent:dallas", "fs", 3, "c")).accepted).toBe(true);
    expect(r.snapshot("agent:dallas")).toBe("c");
  });

  it("out-of-order single source: seq 1,3,2 — seq 2 is dropped as stale", () => {
    const r = new EventReconciler();
    r.ingest(ev("agent:dallas", "fs", 1, "a"));
    r.ingest(ev("agent:dallas", "fs", 3, "c"));
    const result = r.ingest(ev("agent:dallas", "fs", 2, "b"));
    expect(result).toEqual({ accepted: false, reason: "stale-seq" });
    expect(r.snapshot("agent:dallas")).toBe("c");
  });

  it("lower-precedence source loses to stored higher: fs stored, log dropped", () => {
    const r = new EventReconciler();
    r.ingest(ev("agent:dallas", "fs", 5, "fs-payload"));
    const result = r.ingest(ev("agent:dallas", "log", 10, "log-payload"));
    expect(result).toEqual({ accepted: false, reason: "lower-precedence" });
    expect(r.snapshot("agent:dallas")).toBe("fs-payload");
  });

  it("higher-precedence overrides regardless of seq: fs seq 100 beaten by bus seq 1", () => {
    const r = new EventReconciler();
    r.ingest(ev("agent:dallas", "fs", 100, "fs-payload"));
    const result = r.ingest(ev("agent:dallas", "bus", 1, "bus-payload"));
    expect(result).toEqual({ accepted: true });
    expect(r.snapshot("agent:dallas")).toBe("bus-payload");
  });

  it("equal precedence + same seq + same source = duplicate, dropped", () => {
    const r = new EventReconciler();
    const e = ev("agent:dallas", "pty", 7, "x", "cmd-1");
    r.ingest(e);
    const result = r.ingest({ ...e });
    expect(result).toEqual({ accepted: false, reason: "duplicate" });
  });

  it("different entityKey isolation: dallas and ripley are independent", () => {
    const r = new EventReconciler();
    r.ingest(ev("agent:dallas", "bus", 1, "dallas-payload"));
    r.ingest(ev("agent:ripley", "log", 1, "ripley-payload"));
    expect(r.snapshot("agent:dallas")).toBe("dallas-payload");
    expect(r.snapshot("agent:ripley")).toBe("ripley-payload");
  });

  it("listener fires on accept, does not fire on drop", () => {
    const r = new EventReconciler();
    const calls: SquadquariumEvent[] = [];
    const listener = (e: SquadquariumEvent) => calls.push(e);
    r.on(listener);

    r.ingest(ev("agent:dallas", "fs", 1, "a")); // accepted
    r.ingest(ev("agent:dallas", "fs", 1, "a")); // duplicate, dropped
    r.ingest(ev("agent:dallas", "log", 99, "b")); // lower-precedence, dropped
    r.ingest(ev("agent:dallas", "fs", 2, "c")); // accepted

    expect(calls.length).toBe(2);
    r.off(listener);
  });
});
