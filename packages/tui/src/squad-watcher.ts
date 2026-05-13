import fs from "node:fs";
import path from "node:path";
import { EventEmitter } from "node:events";

export interface AgentInfo {
  name: string;
  role: string;
  status: "active" | "inactive";
}

export interface SquadState {
  squadRoot: string | null;
  agents: AgentInfo[];
  teamName: string;
  focus: string;
  recentDecision: string;
}

export interface SquadWatcherEvents {
  change: [SquadState];
}

/**
 * Watches `.squad/` for changes and emits parsed team state.
 * Pure filesystem observation — no SDK imports.
 */
export class SquadWatcher extends EventEmitter<SquadWatcherEvents> {
  private watcher: fs.FSWatcher | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private readonly debounceMs: number;
  readonly squadRoot: string | null;

  constructor(cwd: string, debounceMs = 300) {
    super();
    this.debounceMs = debounceMs;
    this.squadRoot = findSquadRoot(cwd);
  }

  get detected(): boolean {
    return this.squadRoot !== null;
  }

  start(): void {
    if (!this.squadRoot || this.watcher) return;

    try {
      this.watcher = fs.watch(this.squadRoot, { recursive: true }, () => {
        this.scheduleRefresh();
      });
    } catch {
      // Non-fatal — squad dir may not exist yet
    }

    // Emit initial state
    this.emitState();
  }

  stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  /** Read current state synchronously (for initial render). */
  readState(): SquadState {
    if (!this.squadRoot) {
      return { squadRoot: null, agents: [], teamName: "No Squad", focus: "", recentDecision: "" };
    }

    return {
      squadRoot: this.squadRoot,
      agents: readAgents(this.squadRoot),
      teamName: readTeamName(this.squadRoot),
      focus: readFocus(this.squadRoot),
      recentDecision: readRecentDecision(this.squadRoot),
    };
  }

  private scheduleRefresh(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.emitState(), this.debounceMs);
  }

  private emitState(): void {
    this.emit("change", this.readState());
  }
}

// --- Pure file parsers (no SDK) ---

function findSquadRoot(cwd: string): string | null {
  let dir = path.resolve(cwd);
  const root = path.parse(dir).root;

  while (dir !== root) {
    const candidate = path.join(dir, ".squad");
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
    dir = path.dirname(dir);
  }
  return null;
}

function readAgents(squadRoot: string): AgentInfo[] {
  const agentsDir = path.join(squadRoot, "agents");
  if (!fs.existsSync(agentsDir)) return [];

  try {
    const entries = fs.readdirSync(agentsDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => {
        const charterPath = path.join(agentsDir, e.name, "charter.md");
        const role = parseRoleFromCharter(charterPath);
        return { name: e.name, role, status: "active" as const };
      });
  } catch {
    return [];
  }
}

function parseRoleFromCharter(charterPath: string): string {
  try {
    const content = fs.readFileSync(charterPath, "utf8");
    // Look for "Role: ..." or "- **Role:** ..." patterns
    const roleMatch =
      content.match(/^#\s+\w+\s+[—–-]\s+(.+)$/m) ??
      content.match(/\*\*Role:\*\*\s*(.+)/i) ??
      content.match(/^-\s+\*\*Expertise:\*\*\s*(.+)/m);
    return roleMatch?.[1]?.trim() ?? "Agent";
  } catch {
    return "Agent";
  }
}

function readTeamName(squadRoot: string): string {
  const teamPath = path.join(squadRoot, "team.md");
  try {
    const content = fs.readFileSync(teamPath, "utf8");
    const nameMatch = content.match(/^#\s+(.+)/m);
    return nameMatch?.[1]?.trim() ?? "Squad Team";
  } catch {
    return "Squad Team";
  }
}

function readFocus(squadRoot: string): string {
  const nowPath = path.join(squadRoot, "identity", "now.md");
  try {
    const content = fs.readFileSync(nowPath, "utf8");
    return (
      content
        .split("\n")
        .find((line) => line.trim().length > 0)
        ?.trim() ?? ""
    );
  } catch {
    return "";
  }
}

function readRecentDecision(squadRoot: string): string {
  const decisionsPath = path.join(squadRoot, "decisions.md");
  try {
    const content = fs.readFileSync(decisionsPath, "utf8");
    // Find the most recent ### heading
    const headings = content.match(/^### .+$/gm);
    return headings?.[0]?.replace(/^###\s*/, "").trim() ?? "";
  } catch {
    return "";
  }
}

export {
  findSquadRoot,
  readAgents,
  readTeamName,
  readFocus,
  readRecentDecision,
  parseRoleFromCharter,
};
