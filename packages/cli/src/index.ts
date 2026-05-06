import open from "open";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { SquadStateAdapter } from "@squadquarium/core";
import { runAspire } from "./aspire.js";
import { checkDirectSubcommand, parseArgs } from "./argv.js";
import { resolveContext } from "./context.js";
import { runDiorama } from "./diorama.js";
import { formatDoctor, runDoctor } from "./doctor.js";
import { runHeadlessSmoke } from "./headless-smoke.js";
import { runInspect } from "./inspect.js";
import { startServer, type ServerInstance } from "./server.js";
import { printStatus } from "./status.js";
import { runTrace } from "./trace.js";
import { runWhy } from "./why.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

void main();

async function main(): Promise<void> {
  let server: ServerInstance | null = null;
  let adapter: SquadStateAdapter | null = null;

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

    const args = parseArgs();
    const cwd = path.resolve(args.path);

    // Resolve skins dir: prefer bundled web-dist/skins/ (prod global install),
    // fall back to monorepo root skins/ (dev), then cwd/skins.
    const webDistSkins = path.resolve(__dirname, "..", "web-dist", "skins");
    const monoSkins = path.resolve(__dirname, "..", "..", "..", "skins");
    const cwdSkins = path.resolve(process.cwd(), "skins");
    const skinsDir = fs.existsSync(webDistSkins)
      ? webDistSkins
      : fs.existsSync(monoSkins)
        ? monoSkins
        : cwdSkins;

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
    adapter = context.squadRoot
      ? await SquadStateAdapter.create({
          cwd: context.projectRoot,
          personal: context.personal,
          skinsDir,
        })
      : null;
    const mode = adapter ? context.mode : "empty-state";
    const squadRoot = adapter?.getSquadRoot() ?? context.squadRoot;

    server = await startServer({
      adapter,
      port: args.port,
      host: args.host,
      squadVersion: adapter?.getSquadVersion() ?? null,
      squadRoot,
      mode,
      skinsDir,
    });

    if (args.headlessSmoke && !args.serveOnly) {
      const result = await runHeadlessSmoke({ url: server.url, squadRoot });
      console.log(JSON.stringify(result));
      return;
    }

    console.log(`squadquarium: listening at ${server.url}`);
    if (args.open && !args.serveOnly) {
      await open(server.url).catch(() => undefined);
    }

    await waitForShutdown();
  } catch (err) {
    console.error(`squadquarium: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  } finally {
    await server?.close().catch(() => undefined);
    await adapter?.dispose().catch(() => undefined);
  }
}

function waitForShutdown(): Promise<void> {
  return new Promise((resolve) => {
    process.once("SIGINT", resolve);
    process.once("SIGTERM", resolve);
  });
}
