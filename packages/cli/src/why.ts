import fs from "node:fs";
import path from "node:path";
import { parseDecisionEntries, parseTimestampFromFilename, type DecisionBlock } from "./trace.js";
import { resolveSquadRoot } from "./resolve-squad-root.js";

export interface SkillSummary {
  name: string;
  path: string;
  domain?: string;
  triggers: string[];
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function findDecision(decisions: DecisionBlock[], id: string): DecisionBlock | null {
  const trimmed = id.trim();
  const numeric = /^\d+$/.test(trimmed) ? Number.parseInt(trimmed, 10) : null;
  if (numeric !== null) return decisions[numeric - 1] ?? null;

  const lower = trimmed.toLowerCase();
  return (
    decisions.find((decision) => decision.timestamp.startsWith(trimmed)) ??
    decisions.find(
      (decision) =>
        slugify(decision.title).includes(lower) || decision.title.toLowerCase().includes(lower),
    ) ??
    null
  );
}

export function findNearbyLogs(squadRoot: string, timestamp: string, hours: number): string[] {
  const center = new Date(timestamp).getTime();
  if (Number.isNaN(center)) return [];
  const windowMs = hours * 60 * 60 * 1000;
  const dir = path.join(squadRoot, "orchestration-log");

  return readFiles(dir)
    .filter((file) => {
      const parsed = parseTimestampFromFilename(file);
      if (!parsed) return false;
      return Math.abs(new Date(parsed).getTime() - center) <= windowMs;
    })
    .map((file) => path.join(dir, file));
}

export function findMatchingSkills(squadRoot: string, decision: DecisionBlock): SkillSummary[] {
  const keywords = extractKeywords(`${decision.title} ${decision.by} ${decision.raw}`);
  const skillRoot = path.join(squadRoot, "skills");

  return readSkillFiles(skillRoot)
    .map((file) => parseSkill(file))
    .filter((skill): skill is SkillSummary => Boolean(skill))
    .filter((skill) => {
      const values = [skill.domain, ...skill.triggers]
        .filter((value): value is string => Boolean(value))
        .map((value) => value.toLowerCase());
      return values.some((value) =>
        keywords.some((keyword) => value.includes(keyword) || keyword.includes(value)),
      );
    });
}

export function findRelatedDecisions(
  decisions: DecisionBlock[],
  decision: DecisionBlock,
): DecisionBlock[] {
  const center = new Date(decision.timestamp).getTime();
  const hasTime = !Number.isNaN(center);
  return decisions
    .filter((candidate) => candidate.index !== decision.index)
    .filter((candidate) => {
      if (candidate.by && decision.by && candidate.by.toLowerCase() === decision.by.toLowerCase())
        return true;
      if (!hasTime) return false;
      const candidateTime = new Date(candidate.timestamp).getTime();
      return !Number.isNaN(candidateTime) && Math.abs(candidateTime - center) <= 2 * 60 * 60 * 1000;
    })
    .slice(0, 5);
}

export async function runWhy(argv: string[]): Promise<void> {
  const decisionId = argv.find((arg) => !arg.startsWith("--"));
  if (!decisionId) {
    console.log("Usage: squadquarium why <decision-id>");
    process.exit(1);
  }

  const squadRoot = resolveSquadRoot();
  if (!squadRoot) {
    console.log("No .squad directory found. Run this command from inside a Squad project.");
    process.exit(1);
  }

  const decisionsPath = path.join(squadRoot, "decisions.md");
  const decisions = parseDecisionEntries(readText(decisionsPath));
  const decision = findDecision(decisions, decisionId);
  if (!decision) {
    console.log(`Decision not found: ${decisionId}`);
    process.exit(1);
  }

  const nearbyLogs = findNearbyLogs(squadRoot, decision.timestamp, 1);
  const skills = findMatchingSkills(squadRoot, decision);
  const related = findRelatedDecisions(decisions, decision);

  const output = [
    "# Decision",
    decision.raw,
    "",
    "# Orchestration log entries (±1 hour)",
    nearbyLogs.length
      ? nearbyLogs
          .map((file) => `## ${path.basename(file)}\n${readText(file).trim() || "(empty)"}`)
          .join("\n\n")
      : "- none",
    "",
    "# Matching skills",
    skills.length ? skills.map((skill) => `- ${skill.name} (${skill.path})`).join("\n") : "- none",
    "",
    "# See also",
    related.length
      ? related
          .map((entry) => `- ${entry.index}. ${entry.timestamp} — ${entry.title} (${entry.by})`)
          .join("\n")
      : "- none",
  ];

  console.log(output.join("\n"));
}

function extractKeywords(value: string): string[] {
  const stop = new Set(["that", "with", "from", "this", "into", "phase", "wave", "decision"]);
  return [...new Set(value.toLowerCase().match(/[a-z0-9-]{4,}/g) ?? [])].filter(
    (word) => !stop.has(word),
  );
}

function parseSkill(file: string): SkillSummary | null {
  const body = readText(file);
  const frontmatter = /^---\n([\s\S]*?)\n---/m.exec(body)?.[1];
  if (!frontmatter) return null;
  const name = readScalar(frontmatter, "name") ?? path.basename(path.dirname(file));
  return {
    name,
    path: file,
    domain: readScalar(frontmatter, "domain"),
    triggers: readList(frontmatter, "triggers"),
  };
}

function readScalar(frontmatter: string, key: string): string | undefined {
  return new RegExp(`^${key}:\\s*["']?([^"'\\n]+)["']?`, "im").exec(frontmatter)?.[1]?.trim();
}

function readList(frontmatter: string, key: string): string[] {
  const match = new RegExp(`^${key}:\\s*\\n([\\s\\S]*?)(?=^\\w+:|$)`, "im").exec(frontmatter);
  if (!match) return [];
  return (match[1] ?? "")
    .split("\n")
    .map((line) => /^\s*-\s*["']?([^"'\n]+)["']?/.exec(line)?.[1]?.trim())
    .filter((value): value is string => Boolean(value));
}

function readSkillFiles(dir: string): string[] {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((dirent) => {
      const child = path.join(dir, dirent.name);
      if (dirent.isFile() && /\.(md|ya?ml|json)$/i.test(dirent.name)) return [child];
      if (dirent.isDirectory()) return readSkillFiles(child);
      return [];
    });
  } catch {
    return [];
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

function readText(file: string): string {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}
