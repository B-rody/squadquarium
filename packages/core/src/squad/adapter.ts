import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  FSStorageProvider,
  resolvePersonalSquadDir,
  resolveSquad,
  RuntimeEventBus,
  SquadState,
  VERSION,
} from "@bradygaster/squad-sdk";
import type { SquadEvent } from "@bradygaster/squad-sdk/runtime/event-bus";
import { SquadObserver } from "@bradygaster/squad-sdk/runtime/squad-observer";
import { EventReconciler, type SquadquariumEvent } from "../events.js";
import type { AgentSummary, DecisionEntry, LogEntry, Snapshot } from "../transport/protocol.js";

interface CreateOptions {
  cwd?: string;
  personal?: boolean;
  skinsDir?: string;
}

type Unsubscribe = () => void;

export class SquadStateAdapter {
  private readonly reconciler = new EventReconciler();
  private readonly subscribers = new Set<(ev: SquadquariumEvent) => void>();
  private readonly logWatchers: fs.FSWatcher[] = [];
  private readonly sessionId = createSessionId();
  private seq = 0;
  private unsubscribeBus: Unsubscribe | null = null;
  private logWatchersStarted = false;

  private constructor(
    private readonly squadDir: string,
    private readonly state: SquadState,
    private readonly bus: RuntimeEventBus,
    private readonly observer: SquadObserver,
    private readonly skinsDir?: string,
  ) {}

  static async create(opts: CreateOptions): Promise<SquadStateAdapter | null> {
    try {
      let squadDir: string | null = null;

      if (opts.personal) {
        squadDir = resolvePersonalSquadDir();
      } else {
        squadDir = resolveSquad(opts.cwd ?? process.cwd()) ?? resolvePersonalSquadDir();
      }

      if (!squadDir) return null;

      const parentDir = path.dirname(squadDir);
      const storage = new FSStorageProvider(parentDir);
      const state = await SquadState.create(storage, parentDir);
      const bus = new RuntimeEventBus();
      const observer = new SquadObserver({ squadDir, eventBus: bus, debounceMs: 200 });

      return new SquadStateAdapter(squadDir, state, bus, observer, opts.skinsDir);
    } catch {
      return null;
    }
  }

  async getSnapshot(): Promise<Snapshot> {
    const [agents, decisions, logTail, skinNames] = await Promise.all([
      this.getAgents(),
      this.getDecisions(),
      this.getLogTail(),
      this.getSkinNames(),
    ]);

    return { agents, decisions, logTail, skinNames };
  }

  subscribe(handler: (ev: SquadquariumEvent) => void): Unsubscribe {
    this.subscribers.add(handler);
    this.ensureSubscriptions();

    return () => {
      this.subscribers.delete(handler);
    };
  }

  async dispose(): Promise<void> {
    try {
      this.observer.stop();
    } catch {
      // Non-fatal during shutdown.
    }

    try {
      this.unsubscribeBus?.();
    } catch {
      // Non-fatal during shutdown.
    }
    this.unsubscribeBus = null;

    for (const watcher of this.logWatchers.splice(0)) {
      try {
        watcher.close();
      } catch {
        // Non-fatal during shutdown.
      }
    }
    this.logWatchersStarted = false;
    this.bus.clear();
    this.reconciler.clear();
    this.subscribers.clear();
  }

  getSquadRoot(): string {
    return this.squadDir;
  }

  getSquadVersion(): string | null {
    return VERSION ?? null;
  }

  private async getAgents(): Promise<AgentSummary[]> {
    try {
      const [names, team] = await Promise.all([
        this.state.agents.list().catch(() => [] as string[]),
        this.state.team.get().catch(() => null),
      ]);
      const members = team?.members ?? [];

      return Promise.all(
        names.map(async (name) => {
          const charterPath = path.join(this.squadDir, "agents", name, "charter.md");
          const historyPath = charterPath.replace(/charter\.md$/i, "history.md");
          const member = members.find((m) => m.name.toLowerCase() === name.toLowerCase());
          const charter = await this.state.agents
            .get(name)
            .charter()
            .catch(() => "");

          return {
            name,
            role: member?.role ?? parseRoleFromCharter(charter) ?? "",
            status: parseAgentStatus(member?.status),
            charterPath,
            historyPath,
            charterVoice: parseVoiceFromCharter(charter) ?? undefined,
          };
        }),
      );
    } catch {
      return [];
    }
  }

  private async getDecisions(): Promise<DecisionEntry[]> {
    try {
      const decisions = await this.state.decisions.list();
      return decisions.map((decision) => ({
        date: decision.date,
        by: decision.author,
        what: decision.title,
        why: decision.body,
      }));
    } catch {
      return [];
    }
  }

  private async getLogTail(): Promise<LogEntry[]> {
    const entries = await Promise.all([
      this.readLogDirectory("log"),
      this.readLogDirectory("orchestration-log"),
    ]);

    return entries
      .flat()
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp) || b.path.localeCompare(a.path))
      .slice(0, 10);
  }

  private async readLogDirectory(source: LogEntry["source"]): Promise<LogEntry[]> {
    const dir = path.join(this.squadDir, source);

    try {
      const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
      const files = dirents
        .filter((dirent) => dirent.isFile())
        .map((dirent) => dirent.name)
        .sort((a, b) => b.localeCompare(a))
        .slice(0, 10);

      const entries = await Promise.all(
        files.map(async (file) => {
          const absolutePath = path.join(dir, file);
          const body = await fs.promises.readFile(absolutePath, "utf8").catch(() => "");
          const parsed = parseLogMetadata(file, body);

          return {
            timestamp: parseTimestampFromFilename(file) ?? new Date().toISOString(),
            agent: parsed.agent,
            topic: parsed.topic,
            body: body.slice(0, 500),
            source,
            path: absolutePath,
          } satisfies LogEntry;
        }),
      );

      return entries;
    } catch {
      return [];
    }
  }

  private async getSkinNames(): Promise<string[]> {
    const dir = this.skinsDir ?? path.join(path.dirname(this.squadDir), "skins");

    try {
      const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
      return dirents
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name)
        .sort((a, b) => a.localeCompare(b));
    } catch {
      return [];
    }
  }

  private ensureSubscriptions(): void {
    if (!this.unsubscribeBus) {
      this.unsubscribeBus = this.bus.subscribeAll((event) => this.handleBusEvent(event));
    }

    try {
      if (!this.observer.isRunning) this.observer.start();
    } catch {
      // The adapter remains usable for snapshots and explicit log watchers.
    }

    if (!this.logWatchersStarted) {
      this.logWatchersStarted = true;
      this.watchLogDirectory("log");
      this.watchLogDirectory("orchestration-log");
    }
  }

  private handleBusEvent(event: SquadEvent): void {
    try {
      const payload = asRecord(event.payload);
      const isFileChange = payload?.action === "file_change";
      const file = typeof payload?.file === "string" ? payload.file : undefined;
      const source = isFileChange ? "fs" : "bus";
      const entityKey = isFileChange
        ? `fs:${file ?? event.type}`
        : `bus:${event.type}:${event.sessionId ?? "global"}`;

      this.emitIfAccepted({
        sessionId: event.sessionId ?? this.sessionId,
        source,
        seq: this.nextSeq(),
        entityKey,
        observedAt: Date.now(),
        payload: event,
      });
    } catch {
      // Ignore malformed runtime events.
    }
  }

  private watchLogDirectory(source: LogEntry["source"]): void {
    const dir = path.join(this.squadDir, source);

    try {
      if (!fs.existsSync(dir)) return;

      const watcher = fs.watch(dir, (changeType, filename) => {
        try {
          if (!filename) return;
          const file = filename.toString();
          this.emitIfAccepted({
            sessionId: this.sessionId,
            source: "log",
            seq: this.nextSeq(),
            entityKey: `log:${file}`,
            observedAt: Date.now(),
            payload: {
              action: "log_change",
              changeType,
              file,
              path: path.join(dir, file),
              source,
            },
          });
        } catch {
          // Ignore transient fs.watch errors.
        }
      });
      this.logWatchers.push(watcher);
    } catch {
      // Missing or unsupported watchers are non-fatal.
    }
  }

  private emitIfAccepted(event: SquadquariumEvent): void {
    const result = this.reconciler.ingest(event);
    if (!result.accepted) return;

    for (const subscriber of this.subscribers) {
      try {
        subscriber(event);
      } catch {
        // One subscriber cannot break the others.
      }
    }
  }

  private nextSeq(): number {
    this.seq += 1;
    return this.seq;
  }
}

function createSessionId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return Date.now().toString(36);
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

/** Maps raw team.md status strings ("✅ Active", "💤 Dormant (v1+)") to clean labels. */
export function parseAgentStatus(raw: string | undefined): string {
  if (!raw) return "unknown";
  const lower = raw.toLowerCase();
  if (lower.includes("active")) return "active";
  if (lower.includes("dormant")) return "dormant";
  if (lower.includes("retired")) return "retired";
  return "unknown";
}

/** Extracts the first meaningful line from the `## Voice` section of a charter. */
export function parseVoiceFromCharter(charter: string): string | null {
  const match = /^##\s+Voice\s*\n([\s\S]*?)(?=\n##|$)/m.exec(charter);
  if (!match) return null;
  const voiceBlock = match[1] ?? "";
  const firstLine = voiceBlock
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !l.startsWith("#"));
  return firstLine ?? null;
}

function parseRoleFromCharter(charter: string): string | null {
  const title = /^#\s+(.+)$/m.exec(charter)?.[1];
  if (!title) return null;

  const parts = title.split(/[—-]/).map((part) => part.trim());
  return parts.length > 1 ? (parts.at(-1) ?? null) : null;
}

function parseTimestampFromFilename(file: string): string | null {
  const match = /(\d{4}-\d{2}-\d{2}(?:[T_-]\d{2}[-:]\d{2}(?:[-:]\d{2})?(?:\.\d+)?Z?)?)/.exec(file);
  if (!match) return null;

  const candidate = match[1]
    .replace(/_(\d{2})[-:](\d{2})/, "T$1:$2")
    .replace(/T(\d{2})-(\d{2})-(\d{2})/, "T$1:$2:$3");
  const date = new Date(candidate);
  return Number.isNaN(date.getTime()) ? match[1] : date.toISOString();
}

function parseLogMetadata(file: string, body: string): { agent?: string; topic?: string } {
  const agent = /(?:^|\n)(?:agent|by):\s*([^\n]+)/i.exec(body)?.[1]?.trim();
  const topic = /(?:^|\n)(?:topic|title):\s*([^\n]+)/i.exec(body)?.[1]?.trim();
  const filenameParts = path
    .basename(file, path.extname(file))
    .split(/--|___|__|_/)
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    agent:
      agent ??
      filenameParts.find(
        (part) => /^[a-z][a-z0-9-]*$/i.test(part) && !/^\d{4}-\d{2}-\d{2}/.test(part),
      ),
    topic: topic ?? filenameParts.at(-1),
  };
}
