import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolvePersonalSquadDir, resolveSquad } from "@bradygaster/squad-sdk";

export type ContextMode = "connected" | "empty-state";

export interface ResolvedContext {
  mode: ContextMode;
  squadRoot: string | null;
  projectRoot: string;
  personal: boolean;
}

const STATE_FILE = path.join(os.homedir(), ".squadquarium", "state.json");

interface StateFile {
  lastSquadRoot?: string;
}

export async function resolveContext(opts: {
  cwd?: string;
  personal?: boolean;
}): Promise<ResolvedContext> {
  const cwd = opts.cwd ?? process.cwd();

  if (opts.personal) {
    const personalDir = resolvePersonalSquadDir();
    if (personalDir) {
      const resolved = {
        mode: "connected" as const,
        squadRoot: personalDir,
        projectRoot: path.dirname(personalDir),
        personal: true,
      };
      writeState(personalDir);
      return resolved;
    }

    return { mode: "empty-state", squadRoot: null, projectRoot: cwd, personal: true };
  }

  const squadDir = resolveSquad(cwd);
  if (squadDir) {
    const resolved = {
      mode: "connected" as const,
      squadRoot: squadDir,
      projectRoot: path.dirname(squadDir),
      personal: false,
    };
    writeState(squadDir);
    return resolved;
  }

  const personalDir = resolvePersonalSquadDir();
  if (personalDir) {
    const resolved = {
      mode: "connected" as const,
      squadRoot: personalDir,
      projectRoot: path.dirname(personalDir),
      personal: true,
    };
    writeState(personalDir);
    return resolved;
  }

  const lastRoot = readState();
  if (lastRoot && fs.existsSync(lastRoot)) {
    return {
      mode: "connected",
      squadRoot: lastRoot,
      projectRoot: path.dirname(lastRoot),
      personal: false,
    };
  }

  return { mode: "empty-state", squadRoot: null, projectRoot: cwd, personal: false };
}

function writeState(squadRoot: string): void {
  try {
    const dir = path.dirname(STATE_FILE);
    fs.mkdirSync(dir, { recursive: true });
    const data: StateFile = { lastSquadRoot: squadRoot };
    fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch {
    // Non-fatal.
  }
}

function readState(): string | null {
  try {
    const raw = fs.readFileSync(STATE_FILE, "utf8");
    const data = JSON.parse(raw) as StateFile;
    return data.lastSquadRoot ?? null;
  } catch {
    return null;
  }
}

export { STATE_FILE };
