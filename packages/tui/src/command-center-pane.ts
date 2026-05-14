import type { ColorValue } from "./palette.js";
import type { AgentInfo } from "./squad-watcher.js";
import type { Rect } from "./types.js";

export type AgentWorkStatus = "idle" | "working" | "error";

export interface CommandCenterColors {
  fg: ColorValue;
  bg: ColorValue;
  dim: ColorValue;
  accent?: ColorValue;
  error?: ColorValue;
}

export interface AgentStatusUpdate {
  name: string;
  displayName?: string;
  role?: string;
  status: AgentWorkStatus;
  task?: string;
  model?: string;
}

export interface AgentCommandRow {
  id: string;
  name: string;
  role: string;
  status: AgentWorkStatus;
  task: string;
  model?: string;
  activeCount: number;
}

const SPINNER = ["-", "\\", "|", "/"];

export class CommandCenterPane {
  private rows: AgentCommandRow[] = [];

  constructor(agents: AgentInfo[] = []) {
    this.updateRoster(agents);
  }

  updateRoster(agents: AgentInfo[]): void {
    const existing = new Map(this.rows.map((row) => [row.id, row]));
    this.rows = agents.map((agent) => {
      const id = normalizeAgentId(agent.name);
      const previous = existing.get(id);
      return {
        id,
        name: capitalize(agent.name),
        role: agent.role || "Agent",
        status: previous?.status ?? "idle",
        task: previous?.task ?? "standing by",
        model: previous?.model,
        activeCount: previous?.activeCount ?? 0,
      };
    });

    for (const [id, row] of existing) {
      if (!this.rows.some((current) => current.id === id) && row.status !== "idle") {
        this.rows.push(row);
      }
    }
  }

  applyUpdate(update: AgentStatusUpdate): void {
    const id = normalizeAgentId(update.name);
    let row = this.rows.find((candidate) => candidate.id === id);
    if (!row) {
      row = {
        id,
        name: update.displayName ?? capitalize(update.name),
        role: update.role ?? "Sub-agent",
        status: "idle",
        task: "standing by",
        model: update.model,
        activeCount: 0,
      };
      this.rows.push(row);
    }

    row.name = update.displayName ?? row.name;
    row.role = update.role ?? row.role;
    row.model = update.model ?? row.model;

    if (update.status === "working") {
      row.activeCount += 1;
      row.status = "working";
      row.task = update.task ?? "delegated by Copilot";
      return;
    }

    row.activeCount = Math.max(0, row.activeCount - 1);
    row.status = row.activeCount > 0 ? "working" : update.status;
    row.task =
      update.task ??
      (row.status === "working"
        ? "delegated by Copilot"
        : update.status === "error"
          ? "failed"
          : "standing by");
  }

  completeWorking(task = "standing by"): void {
    for (const row of this.rows) {
      if (row.status === "working") {
        row.status = "idle";
        row.activeCount = 0;
        row.task = task;
      }
    }
  }

  getRows(): readonly AgentCommandRow[] {
    return this.rows;
  }

  render(buffer: BufferWriter, rect: Rect, colors: CommandCenterColors, frame: number): void {
    buffer.fill({
      char: " ",
      attr: { color: colors.fg, bgColor: colors.bg },
      region: { x: 0, y: 0, width: rect.width, height: rect.height },
    });

    if (rect.width <= 0 || rect.height <= 0) return;

    const title = "Agent Command";
    buffer.put(
      { x: 0, y: 0, attr: { color: colors.accent ?? colors.fg, bgColor: colors.bg } },
      title.slice(0, rect.width),
    );

    if (this.rows.length === 0) {
      buffer.put(
        { x: 0, y: 2, attr: { color: colors.dim, bgColor: colors.bg } },
        "No agents detected.".slice(0, rect.width),
      );
      return;
    }

    const maxRows = Math.max(0, Math.floor((rect.height - 2) / 3));
    for (let i = 0; i < Math.min(maxRows, this.rows.length); i += 1) {
      const row = this.rows[i]!;
      const y = 2 + i * 3;
      const status = statusGlyph(row, frame);
      const statusColor =
        row.status === "error"
          ? (colors.error ?? colors.accent ?? colors.fg)
          : (colors.accent ?? colors.fg);
      const nameLine =
        row.status === "working" ? `${status} [WORKING] ${row.name}` : `${status} ${row.name}`;
      buffer.put(
        { x: 0, y, attr: { color: statusColor, bgColor: colors.bg } },
        nameLine.slice(0, rect.width),
      );
      buffer.put(
        { x: 2, y: y + 1, attr: { color: colors.dim, bgColor: colors.bg } },
        row.role.slice(0, Math.max(0, rect.width - 2)),
      );
      const task = row.status === "working" && row.model ? `${row.task} · ${row.model}` : row.task;
      buffer.put(
        { x: 2, y: y + 2, attr: { color: colors.fg, bgColor: colors.bg } },
        task.slice(0, Math.max(0, rect.width - 2)),
      );
    }
  }
}

interface BufferWriter {
  fill(options?: unknown): void;
  put(options: { x: number; y: number; attr?: Record<string, unknown> }, text?: string): void;
}

export function normalizeAgentId(name: string): string {
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "agent";
}

function statusGlyph(row: AgentCommandRow, frame: number): string {
  if (row.status === "working") return SPINNER[frame % SPINNER.length] ?? "-";
  if (row.status === "error") return "!";
  return ".";
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
