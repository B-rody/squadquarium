import type { SquadquariumEvent } from "../events.js";
import type { MarketplaceEntry, PluginMeta } from "../plugins/marketplace.js";

export interface AgentSummary {
  name: string;
  role: string;
  status: string;
  charterPath: string;
  historyPath: string;
  charterVoice?: string;
}

export interface DecisionEntry {
  date: string;
  by: string;
  what: string;
  why: string;
}

export interface LogEntry {
  timestamp: string;
  agent?: string;
  topic?: string;
  body: string;
  source: "orchestration-log" | "log";
  path: string;
}

export interface Snapshot {
  agents: AgentSummary[];
  decisions: DecisionEntry[];
  logTail: LogEntry[];
  skinNames: string[];
}

export type ServerFrame =
  | {
      kind: "hello";
      serverSeq: 0;
      squadquariumVersion: string;
      squadVersion: string | null;
      squadRoot: string | null;
      mode: "connected" | "empty-state";
    }
  | { kind: "snapshot"; serverSeq: number; snapshot: Snapshot }
  | { kind: "event"; serverSeq: number; event: SquadquariumEvent }
  | { kind: "marketplace-list"; serverSeq: number; marketplaces: MarketplaceEntry[] }
  | {
      kind: "marketplace-browse";
      serverSeq: number;
      marketplace: string;
      plugins: PluginMeta[];
    }
  | {
      kind: "marketplace-install";
      serverSeq: number;
      marketplace: string;
      plugin: string;
      output: string;
      exitCode?: number;
    }
  | {
      kind: "pty-spawned";
      serverSeq: number;
      ptyId: string;
      replyTo: number;
    }
  | { kind: "pty-out"; serverSeq: number; ptyId: string; data: string }
  | {
      kind: "pty-exit";
      serverSeq: number;
      ptyId: string;
      code: number;
      signal?: string;
    }
  | {
      kind: "error";
      serverSeq: number;
      replyTo?: number;
      message: string;
      code: string;
    }
  | { kind: "pong"; serverSeq: number; clientSeq: number };

export type ClientFrame =
  | {
      kind: "pty-spawn";
      clientSeq: number;
      cmd: string;
      args: string[];
      cwd?: string;
      cols: number;
      rows: number;
    }
  | { kind: "pty-write"; clientSeq: number; ptyId: string; data: string }
  | {
      kind: "pty-resize";
      clientSeq: number;
      ptyId: string;
      cols: number;
      rows: number;
    }
  | { kind: "pty-kill"; clientSeq: number; ptyId: string }
  | { kind: "ping"; clientSeq: number }
  | { kind: "marketplace-list-req"; clientSeq: number }
  | { kind: "marketplace-browse-req"; clientSeq: number; marketplace: string }
  | { kind: "marketplace-install-req"; clientSeq: number; marketplace: string; plugin: string };
