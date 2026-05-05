import { Command } from "commander";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const pkg = require(path.resolve(__dirname, "..", "package.json")) as { version: string };

export interface ParsedArgs {
  path: string;
  personal: boolean;
  port: number | undefined;
  host: string;
  open: boolean;
  headlessSmoke: boolean;
  subcommand: "doctor" | "status" | null;
  version: boolean;
}

const ALLOWED_HOSTS = ["127.0.0.1", "localhost"];

export function parseArgs(argv: string[] = process.argv): ParsedArgs {
  let subcommand: "doctor" | "status" | null = null;

  const program = new Command();
  program
    .name("squadquarium")
    .description("Ambient terminal diorama for squad agent status")
    .version(pkg.version, "-V, --version")
    .argument(
      "[pathOrCommand]",
      "path to the squad project directory, or doctor/status",
      process.cwd(),
    )
    .option("--personal", "force personal squad", false)
    .option("--port <port>", "override default port (auto-pick from 6280 if not set)", (value) =>
      Number.parseInt(value, 10),
    )
    .option("--host <host>", "bind host (loopback only in v0)", "127.0.0.1")
    .option("--no-open", "do not auto-open browser")
    .option("--headless-smoke", "boot, run synthetic smoke, then exit 0", false)
    .allowExcessArguments(false)
    .addHelpText(
      "after",
      "\nCommands:\n  doctor            Check system prerequisites for squadquarium\n  status            Print current squad status and exit",
    );

  program.parse(argv);

  const positional = program.args[0];
  if (positional === "doctor" || positional === "status") {
    subcommand = positional;
  }

  const opts = program.opts<{
    personal: boolean;
    port?: number;
    host: string;
    open: boolean;
    headlessSmoke: boolean;
  }>();

  if (!ALLOWED_HOSTS.includes(opts.host)) {
    console.error(
      "squadquarium: --host must be 127.0.0.1 or localhost in v0 (trust boundary; see README).",
    );
    process.exit(1);
  }

  return {
    path: subcommand ? process.cwd() : (program.args[0] ?? process.cwd()),
    personal: opts.personal,
    port: opts.port,
    host: opts.host,
    open: opts.open !== false,
    headlessSmoke: opts.headlessSmoke,
    subcommand,
    version: false,
  };
}
