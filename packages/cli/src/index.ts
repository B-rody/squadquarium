import open from "open";
import path from "node:path";
import { SquadStateAdapter } from "@squadquarium/core";
import { parseArgs } from "./argv.js";
import { resolveContext } from "./context.js";
import { formatDoctor, runDoctor } from "./doctor.js";
import { runHeadlessSmoke } from "./headless-smoke.js";
import { startServer, type ServerInstance } from "./server.js";
import { printStatus } from "./status.js";

void main();

async function main(): Promise<void> {
  let server: ServerInstance | null = null;
  let adapter: SquadStateAdapter | null = null;

  try {
    const args = parseArgs();
    const cwd = path.resolve(args.path);
    const skinsDir = path.resolve(process.cwd(), "skins");

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

    if (args.headlessSmoke) {
      const result = await runHeadlessSmoke({ url: server.url, squadRoot });
      console.log(JSON.stringify(result));
      return;
    }

    console.log(`squadquarium: listening at ${server.url}`);
    if (args.open) {
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
