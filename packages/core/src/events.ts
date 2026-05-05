export type EventSource = "bus" | "pty" | "fs" | "log";

export interface SquadquariumEvent {
  sessionId: string;
  source: EventSource;
  seq: number;
  entityKey: string;
  causedByCommandId?: string;
  observedAt: number;
  payload: unknown;
}

export const SOURCE_PRECEDENCE: Record<EventSource, number> = {
  bus: 4,
  pty: 3,
  fs: 2,
  log: 1,
};

export type IngestResult =
  | { accepted: true }
  | { accepted: false; reason: "duplicate" | "stale-seq" | "lower-precedence" };

type ChangeListener = (event: SquadquariumEvent) => void;

interface EntityState {
  lastSeq: number;
  lastSourcePrecedence: number;
  lastPayload: unknown;
  dedupeSet: Set<string>;
}

export class EventReconciler {
  private readonly state = new Map<string, EntityState>();
  private readonly listeners = new Set<ChangeListener>();

  ingest(ev: SquadquariumEvent): IngestResult {
    const dedupeKey = `${ev.entityKey}|${ev.causedByCommandId ?? ""}|${ev.seq}|${ev.source}`;
    const existing = this.state.get(ev.entityKey);

    if (existing?.dedupeSet.has(dedupeKey)) {
      return { accepted: false, reason: "duplicate" };
    }

    if (!existing) {
      this.state.set(ev.entityKey, {
        lastSeq: ev.seq,
        lastSourcePrecedence: SOURCE_PRECEDENCE[ev.source],
        lastPayload: ev.payload,
        dedupeSet: new Set([dedupeKey]),
      });
      this.emit(ev);
      return { accepted: true };
    }

    const incomingPrecedence = SOURCE_PRECEDENCE[ev.source];

    if (incomingPrecedence > existing.lastSourcePrecedence) {
      existing.lastSeq = Math.max(existing.lastSeq, ev.seq);
      existing.lastSourcePrecedence = incomingPrecedence;
      existing.lastPayload = ev.payload;
      existing.dedupeSet.add(dedupeKey);
      this.emit(ev);
      return { accepted: true };
    }

    if (incomingPrecedence === existing.lastSourcePrecedence) {
      if (ev.seq > existing.lastSeq) {
        existing.lastSeq = ev.seq;
        existing.lastPayload = ev.payload;
        existing.dedupeSet.add(dedupeKey);
        this.emit(ev);
        return { accepted: true };
      }
      // same or lower seq — mark as seen then drop
      existing.dedupeSet.add(dedupeKey);
      return { accepted: false, reason: "stale-seq" };
    }

    // lower precedence source — drop without marking dedupe (not the same as a replay)
    return { accepted: false, reason: "lower-precedence" };
  }

  snapshot(entityKey: string): unknown {
    return this.state.get(entityKey)?.lastPayload;
  }

  clear(): void {
    this.state.clear();
  }

  on(listener: ChangeListener): void {
    this.listeners.add(listener);
  }

  off(listener: ChangeListener): void {
    this.listeners.delete(listener);
  }

  private emit(ev: SquadquariumEvent): void {
    for (const listener of this.listeners) {
      listener(ev);
    }
  }
}
