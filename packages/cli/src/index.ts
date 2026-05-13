import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startApp } from "@squadquarium/tui";
import type { PtyMode } from "@squadquarium/tui";
import { runAspire } from "./aspire.js";
import { checkDirectSubcommand, parseArgs } from "./argv.js";
import { runDiorama } from "./diorama.js";
import { formatDoctor, runDoctor } from "./doctor.js";
import { runInspect } from "./inspect.js";
import { printStatus } from "./status.js";
import { runTrace } from "./trace.js";
import { runWhy } from "./why.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

void main();

async function main(): Promise<void> {
  try {
    const directSub = checkDirectSubcommand();
    if (directSub === "trace") {
      await runTrace(process.argv.slice(3));
      return;
    }
    if (directSub === "why") {
      await runWhy(process.argv.slice(3));
      return;
    }
    if (directSub === "inspect") {
      await runInspect(process.argv.slice(3));
      return;
    }
    if (directSub === "diorama") {
      await runDiorama(process.argv.slice(3));
      return;
    }
    if (directSub === "aspire") {
      await runAspire(process.argv.slice(3));
      return;
    }
    // triage and loop: pass through to startApp with the right PTY mode
    if (directSub === "triage" || directSub === "loop") {
      const cwd = process.cwd();
      const skinsDir = resolveSkinsDir();
      await startApp({
        cwd,
        skinsDir,
        ptyMode: directSub as PtyMode,
        ptyExtraArgs: process.argv.slice(3),
      });
      return;
    }

    const args = parseArgs();
    const cwd = path.resolve(args.path);
    const skinsDir = resolveSkinsDir();

    if (args.subcommand === "doctor") {
      const result = await runDoctor();
      console.log(formatDoctor(result));
      process.exitCode = result.ok ? 0 : 1;
      return;
    }

    if (args.subcommand === "status") {
      process.exitCode = await printStatus({ cwd, personal: args.personal, skinsDir });
      return;
    }

    const startedAt = Date.now();
    await startApp({
      cwd,
      personal: args.personal,
      attachPaths: args.attachPaths,
      headless: args.headlessSmoke,
      smokeTest: args.headlessSmoke,
      skinsDir,
      debug: args.debug,
      debugLogPath: args.debugLogPath,
      ptyMode: "copilot",
      ptyExtraArgs: args.yolo ? ["--yolo"] : [],
    });

    if (args.headlessSmoke) {
      console.log(JSON.stringify({ ok: true, durationMs: Date.now() - startedAt }));
    }
  } catch (err) {
    console.error(`squadquarium: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  }
}

function resolveSkinsDir(): string {
  const packagedSkins = path.resolve(__dirname, "..", "skins");
  const monoSkins = path.resolve(__dirname, "..", "..", "..", "skins");
  const cwdSkins = path.resolve(process.cwd(), "skins");
  return fs.existsSync(packagedSkins)
    ? packagedSkins
    : fs.existsSync(monoSkins)
      ? monoSkins
      : cwdSkins;
}
