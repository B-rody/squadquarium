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
  headlessSmoke: boolean;
  debug: boolean;
  debugLogPath?: string;
  yolo: boolean;
  subcommand: "doctor" | "status" | null;
  version: boolean;
  attachPaths: string[];
  /** Extra args to pass through to the child process (e.g. --execute, --interval 5) */
  passthrough: string[];
}

const DIRECT_SUBCOMMANDS = [
  "trace",
  "why",
  "inspect",
  "diorama",
  "aspire",
  "triage",
  "loop",
] as const;

export type DirectSubcommand = (typeof DIRECT_SUBCOMMANDS)[number];

export function checkDirectSubcommand(argv: string[] = process.argv): DirectSubcommand | null {
  const command = argv[2];
  return DIRECT_SUBCOMMANDS.includes(command as DirectSubcommand)
    ? (command as DirectSubcommand)
    : null;
}

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
    .option("--headless-smoke", "boot the TUI once without terminal control, then exit 0", false)
    .option(
      "--debug",
      "show on-screen TUI diagnostics (terminal, palette, sprites, buffers)",
      false,
    )
    .option("--yolo", "pass --yolo to copilot (auto-approve tool calls)", false)
    .option("--debug-log <path>", "write TUI diagnostics to a file")
    .option(
      "--attach <path>",
      "additional squad root to attach (repeatable)",
      (value: string, previous: string[]) => [...previous, value],
      [] as string[],
    )
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
    headlessSmoke: boolean;
    debug: boolean;
    yolo: boolean;
    debugLog?: string;
    attach: string[];
  }>();

  return {
    path: subcommand ? process.cwd() : (program.args[0] ?? process.cwd()),
    personal: opts.personal,
    headlessSmoke: opts.headlessSmoke,
    debug: opts.debug,
    debugLogPath: opts.debugLog,
    yolo: opts.yolo,
    subcommand,
    version: false,
    attachPaths: opts.attach ?? [],
    passthrough: [],
  };
}
