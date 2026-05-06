import { useState, useEffect, useRef } from "react";
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

export interface ApprovalPendingSignal {
  agentName: string;
  fileName: string;
  detectedAt: number;
}

export interface AppStore {
  snapshot: Snapshot | null;
  events: SquadquariumEvent[];
  entityState: Map<string, unknown>;
  connection: ConnectionState;
  logLines: LogEntry[];
  approvalPending: ApprovalPendingSignal[];

  setSnapshot: (s: Snapshot) => void;
  appendEvent: (e: SquadquariumEvent) => void;
  setConnection: (c: Partial<ConnectionState>) => void;
  appendLogLine: (l: LogEntry) => void;
  addApprovalSignal: (s: ApprovalPendingSignal) => void;
}

function detectApprovalPendingSignal(event: SquadquariumEvent): ApprovalPendingSignal | null {
  const match = /\.squad[/\\]decisions[/\\]inbox[/\\]([^/\\]+)$/i.exec(event.entityKey);
  if (!match) return null;

  let payload = "";
  try {
    payload = JSON.stringify(event.payload ?? "").toLowerCase();
  } catch {
    payload = String(event.payload ?? "").toLowerCase();
  }
  if (!payload.includes("approval") && !payload.includes("review")) return null;

  const fileName = match[1] ?? "approval.md";
  const agentName = fileName.replace(/\.[^.]+$/, "").split(/[-_]/)[0] || "unknown";
  return { agentName, fileName, detectedAt: event.observedAt };
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
  approvalPending: [],

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
      const approvalSignal = detectApprovalPendingSignal(event);
      const approvalPending = approvalSignal
        ? [...s.approvalPending, approvalSignal].slice(-20)
        : s.approvalPending;
      return { events, entityState, approvalPending };
    }),

  setConnection: (c) => set((s) => ({ connection: { ...s.connection, ...c } })),

  appendLogLine: (l) => set((s) => ({ logLines: [...s.logLines, l].slice(-500) })),

  addApprovalSignal: (signal) =>
    set((s) => ({ approvalPending: [...s.approvalPending, signal].slice(-20) })),
}));

// ── Ritual Events ────────────────────────────────────────────────────────────

export type RitualEvent =
  | { type: "agent-hatched"; name: string; role: string; at: number }
  | { type: "skill-inscribed"; name: string; at: number };

/**
 * Pure detection function — testable without React.
 * Returns a RitualEvent if the event represents a new agent/skill that is not
 * in the provided known sets; null otherwise.
 */
export function detectRitualEvent(
  event: SquadquariumEvent,
  knownAgents: Set<string>,
  knownSkills: Set<string>,
): RitualEvent | null {
  if (event.source !== "fs") return null;

  const key = event.entityKey;

  const agentMatch = /agents[/\\]([^/\\]+)[/\\]charter\.md$/i.exec(key);
  if (agentMatch) {
    const name = agentMatch[1] ?? "";
    if (name && !knownAgents.has(name.toLowerCase())) {
      return { type: "agent-hatched", name, role: "", at: event.observedAt };
    }
    return null;
  }

  const skillMatch = /skills[/\\]([^/\\]+)[/\\]SKILL\.md$/i.exec(key);
  if (skillMatch) {
    const name = skillMatch[1] ?? "";
    if (name && !knownSkills.has(name.toLowerCase())) {
      return { type: "skill-inscribed", name, at: event.observedAt };
    }
    return null;
  }

  return null;
}

/** Emits typed ritual events driven by SquadObserver fs events in the store. */
export function useRitualEvents(): RitualEvent[] {
  const knownAgentsRef = useRef<Set<string> | null>(null);
  const knownSkillsRef = useRef<Set<string>>(new Set());
  const processedCountRef = useRef(0);
  const [rituals, setRituals] = useState<RitualEvent[]>([]);

  const snapshot = useStore((s) => s.snapshot);
  const events = useStore((s) => s.events);

  // Seed agent baseline from the initial snapshot (once).
  useEffect(() => {
    if (snapshot && knownAgentsRef.current === null) {
      knownAgentsRef.current = new Set(snapshot.agents.map((a) => a.name.toLowerCase()));
    }
  }, [snapshot]);

  // Process newly arrived events for ritual triggers.
  useEffect(() => {
    if (knownAgentsRef.current === null) return; // wait for snapshot baseline

    const newEvents = events.slice(processedCountRef.current);
    if (newEvents.length === 0) return;
    processedCountRef.current = events.length;

    const newRituals: RitualEvent[] = [];
    for (const event of newEvents) {
      const raw = detectRitualEvent(event, knownAgentsRef.current, knownSkillsRef.current);
      if (!raw) continue;

      if (raw.type === "agent-hatched") {
        const nameLower = raw.name.toLowerCase();
        const role = snapshot?.agents.find((a) => a.name.toLowerCase() === nameLower)?.role ?? "";
        newRituals.push({ ...raw, role });
        knownAgentsRef.current.add(nameLower);
      } else {
        newRituals.push(raw);
        knownSkillsRef.current.add(raw.name.toLowerCase());
      }
    }

    if (newRituals.length > 0) {
      setRituals((prev) => [...prev, ...newRituals]);
    }
  }, [events, snapshot]);

  return rituals;
}

// ── Self-Portrait Detection ───────────────────────────────────────────────────

/**
 * True when Squadquarium is opened against its own repo.
 * Detected by checking that the parent directory of the squad root is named
 * "squadquarium" (case-insensitive).
 */
export function useIsSelfPortrait(): boolean {
  const squadRoot = useStore((s) => s.connection.squadRoot);
  if (!squadRoot) return false;
  // squadRoot = e.g. C:\Workspace\personal\squadquarium\.squad
  // Normalise to forward slashes, split, take the second-to-last segment.
  const parts = squadRoot.replace(/\\/g, "/").split("/").filter(Boolean);
  const repoBasename = parts.length >= 2 ? (parts[parts.length - 2] ?? "") : "";
  return repoBasename.toLowerCase() === "squadquarium";
}
