import fs from "node:fs";
import path from "node:path";
import { resolveSquadRoot } from "./resolve-squad-root.js";

export type TraceSource = "history" | "orchestration-log" | "log" | "decisions";

export interface TimelineEntry {
  timestamp: string;
  source: TraceSource;
  title: string;
  body: string;
  path?: string;
}

export interface DecisionBlock {
  timestamp: string;
  title: string;
  by: string;
  body: string;
  raw: string;
  index: number;
}

const SOURCE_COLORS: Record<TraceSource, string> = {
  history: "\x1B[36m",
  "orchestration-log": "\x1B[33m",
  log: "",
  decisions: "\x1B[32m",
};
const RESET = "\x1B[0m";

export function parseSince(value: string | undefined, now = Date.now()): number | null {
  if (!value) return null;
  const match = /^(\d+)([hd])$/i.exec(value.trim());
  if (!match) return null;
  const amount = Number.parseInt(match[1] ?? "0", 10);
  const unit = (match[2] ?? "").toLowerCase();
  const millis = unit === "h" ? amount * 60 * 60 * 1000 : amount * 24 * 60 * 60 * 1000;
  return now - millis;
}

export function parseTimestampFromFilename(file: string): string | null {
  const name = path.basename(file);
  const dateTime = /(\d{4}-\d{2}-\d{2}T\d{2})[-:](\d{2})(?:[-:](\d{2}))?Z/.exec(name);
  if (dateTime) {
    const iso = `${dateTime[1]}:${dateTime[2]}:${dateTime[3] ?? "00"}Z`;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const dateOnly = /(\d{4}-\d{2}-\d{2})/.exec(name)?.[1];
  if (!dateOnly) return null;
  const date = new Date(`${dateOnly}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function parseDecisionEntries(markdown: string): DecisionBlock[] {
  const headers = [...markdown.matchAll(/^###\s+([^\n—]+?)\s+—\s+(.+)$/gm)];
  return headers.map((header, i) => {
    const start = header.index ?? 0;
    const end =
      i + 1 < headers.length ? (headers[i + 1]?.index ?? markdown.length) : markdown.length;
    const raw = markdown.slice(start, end).trim();
    const by = /^\*\*By:\*\*\s*(.+)$/m.exec(raw)?.[1]?.trim() ?? "";
    const timestamp = (header[1] ?? "").trim();
    return {
      timestamp,
      title: (header[2] ?? "").trim(),
      by,
      body: raw,
      raw,
      index: i + 1,
    };
  });
}

export function findDecisionsByAgent(squadRoot: string, agent: string): TimelineEntry[] {
  const decisionsPath = path.join(squadRoot, "decisions.md");
  const body = readText(decisionsPath);
  if (!body) return [];
  const lowerAgent = agent.toLowerCase();

  return parseDecisionEntries(body)
    .filter((entry) => entry.by.toLowerCase().includes(lowerAgent))
    .map((entry) => ({
      timestamp: normalizeTimestamp(entry.timestamp),
      source: "decisions" as const,
      title: entry.title,
      body: entry.raw,
      path: decisionsPath,
    }));
}

export function findHistoryEntries(squadRoot: string, agent: string): TimelineEntry[] {
  const agentDir = findAgentDir(squadRoot, agent);
  if (!agentDir) return [];
  const historyPath = path.join(agentDir, "history.md");
  const body = readText(historyPath);
  if (!body) return [];

  return parseLearningBlocks(body).map((block) => ({
    timestamp: normalizeTimestamp(block.timestamp),
    source: "history" as const,
    title: block.title,
    body: block.raw,
    path: historyPath,
  }));
}

export function findOrchestrationEntries(
  squadRoot: string,
  agent: string,
  taskFilter?: string,
): TimelineEntry[] {
  const dir = path.join(squadRoot, "orchestration-log");
  const lowerAgent = agent.toLowerCase();
  return readFiles(dir)
    .filter((file) => {
      const stem = path.basename(file, path.extname(file)).toLowerCase();
      return stem.endsWith(`-${lowerAgent}`) || stem.includes(`-${lowerAgent}-`);
    })
    .flatMap((file) => {
      const absolutePath = path.join(dir, file);
      const body = readText(absolutePath);
      if (taskFilter && !body.toLowerCase().includes(taskFilter.toLowerCase())) return [];
      return [
        {
          timestamp:
            parseTimestampFromFilename(file) ?? extractTimestamp(body) ?? new Date(0).toISOString(),
          source: "orchestration-log" as const,
          title: path.basename(file, path.extname(file)),
          body,
          path: absolutePath,
        },
      ];
    });
}

export function findLogEntries(squadRoot: string, agent: string): TimelineEntry[] {
  const dir = path.join(squadRoot, "log");
  const lowerAgent = agent.toLowerCase();
  return readFiles(dir).flatMap((file) => {
    const absolutePath = path.join(dir, file);
    const body = readText(absolutePath);
    if (!body.toLowerCase().includes(lowerAgent)) return [];
    return [
      {
        timestamp:
          parseTimestampFromFilename(file) ?? extractTimestamp(body) ?? new Date(0).toISOString(),
        source: "log" as const,
        title: path.basename(file, path.extname(file)),
        body,
        path: absolutePath,
      },
    ];
  });
}

export function formatTimeline(
  entries: TimelineEntry[],
  color = Boolean(process.stdout.isTTY),
): string {
  if (entries.length === 0) return "No trace entries found.";

  return entries
    .map((entry) => {
      const label = `[${entry.source}]`;
      const coloredLabel =
        color && SOURCE_COLORS[entry.source]
          ? `${SOURCE_COLORS[entry.source]}${label}${RESET}`
          : label;
      const location = entry.path ? `\n  ${entry.path}` : "";
      const excerpt = entry.body
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 6)
        .join("\n  ");
      return `${entry.timestamp} ${coloredLabel} ${entry.title}${location}\n  ${excerpt}`.trimEnd();
    })
    .join("\n\n");
}

export async function runTrace(argv: string[]): Promise<void> {
  const { agent, since, task } = parseTraceArgs(argv);
  if (!agent) {
    console.log("Usage: squadquarium trace <agent> [--task id] [--since 24h|7d|30d]");
    process.exit(1);
  }

  const squadRoot = resolveSquadRoot();
  if (!squadRoot) {
    console.log("No .squad directory found. Run this command from inside a Squad project.");
    process.exit(1);
  }

  const cutoff = parseSince(since);
  if (since && cutoff === null) {
    console.log("Invalid --since value. Use durations like 24h, 7d, or 30d.");
    process.exit(1);
  }

  const entries = [
    ...findHistoryEntries(squadRoot, agent),
    ...findOrchestrationEntries(squadRoot, agent, task),
    ...findLogEntries(squadRoot, agent),
    ...findDecisionsByAgent(squadRoot, agent),
  ]
    .filter((entry) => cutoff === null || new Date(entry.timestamp).getTime() >= cutoff)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  console.log(formatTimeline(entries));
}

function parseTraceArgs(argv: string[]): { agent?: string; since?: string; task?: string } {
  let agent: string | undefined;
  let since: string | undefined;
  let task: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === "--since") {
      since = argv[i + 1];
      i += 1;
    } else if (value === "--task") {
      task = argv[i + 1];
      i += 1;
    } else if (!agent && value && !value.startsWith("--")) {
      agent = value;
    }
  }

  return { agent, since, task };
}

function parseLearningBlocks(
  markdown: string,
): Array<{ timestamp: string; title: string; raw: string }> {
  const headers = [...markdown.matchAll(/^###\s+([^\n—]+?)\s+—\s+(.+)$/gm)];
  return headers.map((header, i) => {
    const start = header.index ?? 0;
    const end =
      i + 1 < headers.length ? (headers[i + 1]?.index ?? markdown.length) : markdown.length;
    return {
      timestamp: (header[1] ?? "").trim(),
      title: (header[2] ?? "").trim(),
      raw: markdown.slice(start, end).trim(),
    };
  });
}

function extractTimestamp(body: string): string | null {
  const frontmatter = /^---\n([\s\S]*?)\n---/m.exec(body)?.[1] ?? body;
  const raw = /(?:timestamp|date):\s*["']?([^"'\n]+)["']?/i.exec(frontmatter)?.[1]?.trim();
  return raw ? normalizeTimestamp(raw) : null;
}

function normalizeTimestamp(value: string): string {
  const trimmed = value.trim();
  const date = new Date(trimmed);
  if (!Number.isNaN(date.getTime())) return date.toISOString();
  const dateOnly = /^(\d{4}-\d{2}-\d{2})$/.exec(trimmed)?.[1];
  if (dateOnly) return `${dateOnly}T00:00:00.000Z`;
  return trimmed;
}

function findAgentDir(squadRoot: string, agent: string): string | null {
  const agentsDir = path.join(squadRoot, "agents");
  const lowerAgent = agent.toLowerCase();
  const match = readDirs(agentsDir).find((dir) => dir.toLowerCase() === lowerAgent);
  return match ? path.join(agentsDir, match) : null;
}

function readText(file: string): string {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function readFiles(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isFile())
      .map((d) => d.name);
  } catch {
    return [];
  }
}

function readDirs(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }
}
