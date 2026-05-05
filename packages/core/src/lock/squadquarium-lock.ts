import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface LockContent {
  pid: number;
  startedAt: string;
  host: string;
  purpose: string;
}

export type AcquireResult =
  | { acquired: true; release(): void }
  | { acquired: false; held_by: LockContent };

export class SquadquariumLock {
  private readonly lockPath: string;

  constructor(squadRoot: string) {
    const scratchDir = path.join(squadRoot, ".scratch");
    fs.mkdirSync(scratchDir, { recursive: true });
    this.lockPath = path.join(scratchDir, "squadquarium.lock");
  }

  async acquire({ purpose }: { purpose: string }): Promise<AcquireResult> {
    try {
      const raw = fs.readFileSync(this.lockPath, "utf8");
      const existing = JSON.parse(raw) as LockContent;
      const alive = isPidAlive(existing.pid);
      if (alive) {
        return { acquired: false, held_by: existing };
      }
    } catch {
      // Missing, stale, or unreadable locks are overwritten below.
    }

    const content: LockContent = {
      pid: process.pid,
      startedAt: new Date().toISOString(),
      host: os.hostname(),
      purpose,
    };
    fs.writeFileSync(this.lockPath, JSON.stringify(content, null, 2), "utf8");

    const lockPath = this.lockPath;
    return {
      acquired: true,
      release() {
        try {
          fs.unlinkSync(lockPath);
        } catch {
          // Already gone.
        }
      },
    };
  }

  getLockPath(): string {
    return this.lockPath;
  }
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
