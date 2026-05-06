import fs from "node:fs";
import path from "node:path";
import { resolveSquadRoot } from "./resolve-squad-root.js";

export interface CharterCard {
  title: string;
  role: string;
  voiceLine: string;
}

export interface InspectView {
  charter: CharterCard;
  learnings: string[];
  skills: string[];
  touchedFiles: string[];
}

export function parseCharterCard(charter: string): CharterCard {
  const title = /^#\s+(.+)$/m.exec(charter)?.[1]?.trim() ?? "Unknown agent";
  const role =
    /^\*\*Role:\*\*\s*(.+)$/im.exec(charter)?.[1]?.trim() ??
    title.split(/[—-]/).at(-1)?.trim() ??
    "Unknown role";
  const voiceBlock = /^##\s+Voice\s*\n([\s\S]*?)(?=\n##|$)/m.exec(charter)?.[1] ?? "";
  const voiceLine =
    voiceBlock
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0 && !line.startsWith("#")) ?? "No voice line found.";
  return { title, role, voiceLine };
}

export function parseRecentLearnings(history: string, limit = 10): string[] {
  const learnings = /^##\s+Learnings\s*\n([\s\S]*)$/m.exec(history)?.[1] ?? history;
  const headers = [...learnings.matchAll(/^###\s+(.+)$/gm)];
  return headers
    .map((header, i) => {
      const start = header.index ?? 0;
      const end =
        i + 1 < headers.length ? (headers[i + 1]?.index ?? learnings.length) : learnings.length;
      return learnings.slice(start, end).trim();
    })
    .filter(Boolean)
    .slice(-limit);
}

export function findSkillsForRole(squadRoot: string, role: string): string[] {
  const lowerRole = role.toLowerCase();
  return readSkillFiles(path.join(squadRoot, "skills"))
    .filter((file) =>
      parseRoles(readText(file)).some((candidate) => candidate.toLowerCase() === lowerRole),
    )
    .map((file) => path.relative(squadRoot, file));
}

export function findTouchedFiles(squadRoot: string, agent: string): string[] {
  const dir = path.join(squadRoot, "orchestration-log");
  const lowerAgent = agent.toLowerCase();
  const files = new Set<string>();

  for (const file of readFiles(dir)) {
    const stem = path.basename(file, path.extname(file)).toLowerCase();
    if (!stem.endsWith(`-${lowerAgent}`) && !stem.includes(`-${lowerAgent}-`)) continue;
    for (const touched of parseFilesWritten(readText(path.join(dir, file)))) files.add(touched);
  }

  return [...files].sort((a, b) => a.localeCompare(b));
}

export function parseFilesWritten(markdown: string): string[] {
  const sections = [
    ...markdown.matchAll(/^#{1,4}\s+Files written\s*\n([\s\S]*?)(?=^#{1,4}\s+|(?![\s\S]))/gim),
  ];
  const files = new Set<string>();

  for (const section of sections) {
    for (const line of (section[1] ?? "").split("\n")) {
      const value =
        /^\s*[-*]\s+`?([^`\n]+?)`?\s*$/.exec(line)?.[1]?.trim() ??
        /^\s*`([^`]+)`\s*$/.exec(line)?.[1]?.trim();
      if (value) files.add(value);
    }
  }

  return [...files];
}

export function formatInspectView(agent: string, view: InspectView): string {
  return [
    `# ${agent}`,
    "",
    "## Charter card",
    `Title: ${view.charter.title}`,
    `Role: ${view.charter.role}`,
    `Voice: ${view.charter.voiceLine}`,
    "",
    "## Recent history",
    view.learnings.length
      ? view.learnings.map((entry) => `- ${firstLine(entry)}`).join("\n")
      : "- none",
    "",
    "## Matched skills",
    view.skills.length ? view.skills.map((skill) => `- ${skill}`).join("\n") : "- none",
    "",
    "## Recently touched files",
    view.touchedFiles.length ? view.touchedFiles.map((file) => `- ${file}`).join("\n") : "- none",
  ].join("\n");
}

export async function runInspect(argv: string[]): Promise<void> {
  const agent = argv.find((arg) => !arg.startsWith("--"));
  if (!agent) {
    console.log("Usage: squadquarium inspect <agent>");
    process.exit(1);
  }

  const squadRoot = resolveSquadRoot();
  if (!squadRoot) {
    console.log("No .squad directory found. Run this command from inside a Squad project.");
    process.exit(1);
  }

  const agentDir = findAgentDir(squadRoot, agent);
  if (!agentDir) {
    console.log(`Agent not found: ${agent}`);
    process.exit(1);
  }

  const charter = parseCharterCard(readText(path.join(agentDir, "charter.md")));
  const view: InspectView = {
    charter,
    learnings: parseRecentLearnings(readText(path.join(agentDir, "history.md"))),
    skills: findSkillsForRole(squadRoot, charter.role),
    touchedFiles: findTouchedFiles(squadRoot, agent),
  };

  console.log(formatInspectView(agent, view));
}

function parseRoles(markdown: string): string[] {
  const frontmatter = /^---\n([\s\S]*?)\n---/m.exec(markdown)?.[1];
  if (!frontmatter) return [];
  const match = /^roles:\s*\n([\s\S]*?)(?=^\w+:|$)/im.exec(frontmatter);
  return (match?.[1] ?? "")
    .split("\n")
    .map((line) => /^\s*-\s*["']?([^"'\n]+)["']?/.exec(line)?.[1]?.trim())
    .filter((value): value is string => Boolean(value));
}

function firstLine(value: string): string {
  return (
    value
      .split("\n")
      .find((line) => line.trim().length > 0)
      ?.trim() ?? value
  );
}

function findAgentDir(squadRoot: string, agent: string): string | null {
  const agentsDir = path.join(squadRoot, "agents");
  const lowerAgent = agent.toLowerCase();
  const match = readDirs(agentsDir).find((dir) => dir.toLowerCase() === lowerAgent);
  return match ? path.join(agentsDir, match) : null;
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
