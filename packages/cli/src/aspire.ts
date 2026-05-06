import { execSync } from "node:child_process";
import open from "open";

export type ExecSyncLike = (command: string, options: { stdio: "pipe" }) => Buffer | string;
export type OpenLike = (target: string) => Promise<unknown>;

export function isAspirePresent(exec: ExecSyncLike = execSync): boolean {
  try {
    exec("squad aspire --help", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

export function extractUrl(output: string): string | null {
  return /https?:\/\/\S+/i.exec(output)?.[0] ?? null;
}

export async function runAspire(
  argv: string[] = [],
  deps: { exec?: ExecSyncLike; open?: OpenLike } = {},
): Promise<void> {
  void argv;
  const exec = deps.exec ?? execSync;
  const openFn = deps.open ?? open;

  if (!isAspirePresent(exec)) {
    console.log(
      "Aspire not installed. Run `npm install -g @bradygaster/squad-cli` (you may already have it) — and check `squad aspire --version`.",
    );
    return;
  }

  try {
    const raw = exec("squad aspire", { stdio: "pipe" });
    const output = Buffer.isBuffer(raw) ? raw.toString("utf8") : String(raw);
    const url = extractUrl(output);
    if (!url) {
      console.log(
        "squad aspire ran, but no URL was found in its output. TODO: surface Aspire launch details.",
      );
      return;
    }

    console.log(url);
    await openFn(url).catch(() => undefined);
  } catch {
    console.log(
      "Aspire not installed. Run `npm install -g @bradygaster/squad-cli` (you may already have it) — and check `squad aspire --version`.",
    );
  }
}
