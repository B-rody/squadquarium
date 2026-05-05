import { spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import { STATE_FILE } from "./context.js";

export interface DoctorCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface DoctorResult {
  ok: boolean;
  checks: DoctorCheck[];
}

export async function runDoctor(): Promise<DoctorResult> {
  const checks: DoctorCheck[] = [];

  checks.push({
    name: "node",
    ok: isSupportedNode(process.versions.node),
    detail: process.versions.node,
  });

  const squadVersion = spawnSync("squad", ["--version"], { encoding: "utf8", timeout: 5_000 });
  checks.push({
    name: "squad-path",
    ok: squadVersion.status === 0,
    detail:
      squadVersion.status === 0
        ? squadVersion.stdout.trim()
        : squadVersion.stderr.trim() || "squad not found on PATH",
  });

  checks.push(await checkNodePty());
  checks.push(await checkPort(6280));
  checks.push({
    name: "last-opened-state",
    ok: true,
    detail: fs.existsSync(STATE_FILE) ? STATE_FILE : "not created yet",
  });

  const squadDoctor = spawnSync("squad", ["doctor"], { encoding: "utf8", timeout: 10_000 });
  checks.push({
    name: "squad-doctor",
    ok: squadDoctor.status === 0,
    detail:
      squadDoctor.status === 0
        ? firstLine(squadDoctor.stdout) || "squad doctor passed"
        : firstLine(squadDoctor.stderr) || "squad doctor failed or is unavailable",
  });

  return { ok: checks.every((check) => check.ok), checks };
}

export function formatDoctor(result: DoctorResult): string {
  const lines = [`squadquarium doctor: ${result.ok ? "ok" : "issues found"}`];
  for (const check of result.checks) {
    lines.push(`${check.ok ? "✓" : "✗"} ${check.name}: ${check.detail}`);
  }
  return lines.join("\n");
}

function isSupportedNode(version: string): boolean {
  const major = Number.parseInt(version.split(".")[0] ?? "0", 10);
  return major >= 22;
}

async function checkNodePty(): Promise<DoctorCheck> {
  try {
    await import("@squadquarium/core");
    return { name: "node-pty", ok: true, detail: "loadable through @squadquarium/core" };
  } catch (err) {
    return {
      name: "node-pty",
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

function checkPort(port: number): Promise<DoctorCheck> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (err) => {
      resolve({ name: `port-${port}`, ok: false, detail: err.message });
    });
    server.once("listening", () => {
      server.close(() => resolve({ name: `port-${port}`, ok: true, detail: "available" }));
    });
    server.listen(port, "127.0.0.1");
  });
}

function firstLine(value: string): string {
  return value.trim().split(/\r?\n/)[0] ?? "";
}
