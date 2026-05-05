import { create } from "zustand";
import type { Snapshot, LogEntry } from "./protocol.js";
import type { SquadquariumEvent } from "@squadquarium/core";
import type { WsStatus } from "./wsClient.js";

const MAX_EVENTS = 200;

export interface ConnectionState {
  status: WsStatus;
  squadRoot: string | null;
  squadVersion: string | null;
  mode: "connected" | "empty-state" | null;
  squadquariumVersion: string | null;
}

export interface AppStore {
  snapshot: Snapshot | null;
  events: SquadquariumEvent[];
  entityState: Map<string, unknown>;
  connection: ConnectionState;
  logLines: LogEntry[];

  setSnapshot: (s: Snapshot) => void;
  appendEvent: (e: SquadquariumEvent) => void;
  setConnection: (c: Partial<ConnectionState>) => void;
  appendLogLine: (l: LogEntry) => void;
}

export const useStore = create<AppStore>((set) => ({
  snapshot: null,
  events: [],
  entityState: new Map(),
  connection: {
    status: "connecting",
    squadRoot: null,
    squadVersion: null,
    mode: null,
    squadquariumVersion: null,
  },
  logLines: [],

  setSnapshot: (snapshot) =>
    set((s) => ({
      snapshot,
      logLines: snapshot.logTail,
      entityState: new Map(s.entityState),
    })),

  appendEvent: (event) =>
    set((s) => {
      const events = [...s.events, event].slice(-MAX_EVENTS);
      const entityState = new Map(s.entityState);
      entityState.set(event.entityKey, event.payload);
      return { events, entityState };
    }),

  setConnection: (c) => set((s) => ({ connection: { ...s.connection, ...c } })),

  appendLogLine: (l) => set((s) => ({ logLines: [...s.logLines, l].slice(-500) })),
}));
