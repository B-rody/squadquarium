import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SquadquariumLock, type LockContent } from "../src/lock/squadquarium-lock.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runtimeRoot = path.join(__dirname, ".runtime");
let squadRoot: string;

beforeEach(() => {
  squadRoot = path.join(runtimeRoot, `lock-${process.pid}-${Date.now()}`);
  fs.mkdirSync(squadRoot, { recursive: true });
});

afterEach(() => {
  fs.rmSync(squadRoot, { recursive: true, force: true });
});

describe("SquadquariumLock", () => {
  it("acquires a lock and writes lock content", async () => {
    const lock = new SquadquariumLock(squadRoot);
    const result = await lock.acquire({ purpose: "test" });

    expect(result.acquired).toBe(true);
    expect(fs.existsSync(lock.getLockPath())).toBe(true);
    const content = JSON.parse(fs.readFileSync(lock.getLockPath(), "utf8")) as LockContent;
    expect(content).toMatchObject({ pid: process.pid, purpose: "test" });

    if (result.acquired) result.release();
  });

  it("release removes the lock file", async () => {
    const lock = new SquadquariumLock(squadRoot);
    const result = await lock.acquire({ purpose: "release" });
    expect(result.acquired).toBe(true);

    if (result.acquired) result.release();

    expect(fs.existsSync(lock.getLockPath())).toBe(false);
  });

  it("reports an existing live lock", async () => {
    const lock = new SquadquariumLock(squadRoot);
    const first = await lock.acquire({ purpose: "first" });
    const second = await lock.acquire({ purpose: "second" });

    expect(second.acquired).toBe(false);
    if (!second.acquired) expect(second.held_by.purpose).toBe("first");

    if (first.acquired) first.release();
  });

  it("overwrites a stale lock", async () => {
    const lock = new SquadquariumLock(squadRoot);
    const stale: LockContent = {
      pid: 999999,
      startedAt: "2026-05-05T00:00:00.000Z",
      host: "stale-host",
      purpose: "stale",
    };
    fs.writeFileSync(lock.getLockPath(), JSON.stringify(stale), "utf8");

    const result = await lock.acquire({ purpose: "fresh" });

    expect(result.acquired).toBe(true);
    const content = JSON.parse(fs.readFileSync(lock.getLockPath(), "utf8")) as LockContent;
    expect(content).toMatchObject({ pid: process.pid, purpose: "fresh" });

    if (result.acquired) result.release();
  });
});
