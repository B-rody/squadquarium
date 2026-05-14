import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startApp } from "@squadquarium/tui";
import { runAspire } from "./aspire.js";
import { checkDirectSubcommand, parseArgs, parseSdkWorkflowArgs } from "./argv.js";
import { resolveContext } from "./context.js";
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
    // triage and loop: start the SDK TUI with an initial workflow prompt.
    if (directSub === "triage" || directSub === "loop") {
      const cwd = process.cwd();
      const skinsDir = resolveSkinsDir();
      const workflowArgs = parseSdkWorkflowArgs(process.argv.slice(3));
      const context = await resolveContext({ cwd });
      await startApp({
        cwd: context.projectRoot,
        personal: context.personal,
        skinsDir,
        sdkMode: directSub,
        sdkExtraArgs: workflowArgs.passthrough,
        yolo: workflowArgs.yolo,
        model: workflowArgs.model,
        enableMouse: false,
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

    const context = await resolveContext({ cwd, personal: args.personal });
    const startedAt = Date.now();
    await startApp({
      cwd: context.projectRoot,
      personal: context.personal,
      attachPaths: args.attachPaths,
      headless: args.headlessSmoke,
      smokeTest: args.headlessSmoke,
      skinsDir,
      debug: args.debug,
      debugLogPath: args.debugLogPath,
      sdkMode: "chat",
      yolo: args.yolo,
      model: args.model,
      enableMouse: args.enableMouse,
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
