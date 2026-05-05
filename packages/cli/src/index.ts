import { Command } from "commander";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Resolve version from package.json without relying on import assertions (ESM compat)
const pkgPath = path.resolve(__dirname, "..", "package.json");
const pkg = require(pkgPath) as { version: string };

const program = new Command();

program
  .name("squadquarium")
  .description("Ambient terminal diorama for squad agent status")
  .version(pkg.version, "-V, --version")
  .argument("[path]", "path to the squad project directory", process.cwd())
  .option("--personal", "show only your own sessions")
  .option("--headless-smoke", "boot, verify, then exit 0 (CI smoke use)")
  .action((projectPath: string, opts: { personal?: boolean; headlessSmo: boolean }) => {
    if (opts.headlessSmo || process.argv.includes("--headless-smoke")) {
      // Smoke mode: verify the CLI can parse args and exit clean.
      // Server boot is a v0 milestone — not yet wired.
      console.log("squadquarium smoke: ok");
      process.exit(0);
    }

    // Full boot is wired in a later v0 milestone.
    console.log(`squadquarium: resolving squad project at ${path.resolve(projectPath)}`);
    if (opts.personal) {
      console.log("squadquarium: --personal mode active");
    }
    console.log("squadquarium: server boot not yet implemented (pre-v0 scaffold)");
  });

program.parse();
