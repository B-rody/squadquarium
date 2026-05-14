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
  model?: string;
  yolo: boolean;
  enableMouse: boolean;
  subcommand: "doctor" | "status" | null;
  version: boolean;
  attachPaths: string[];
  /** Extra args to pass through to the child process (e.g. --execute, --interval 5) */
  passthrough: string[];
}

export interface ParsedSdkWorkflowArgs {
  model?: string;
  yolo: boolean;
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
    .option("--mouse", "enable TUI mouse capture for aquarium clicks and pane scrolling", false)
    .option("--model <id>", "Copilot model id to use for the SDK session")
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
    mouse: boolean;
    debugLog?: string;
    model?: string;
    attach: string[];
  }>();

  return {
    path: subcommand ? process.cwd() : (program.args[0] ?? process.cwd()),
    personal: opts.personal,
    headlessSmoke: opts.headlessSmoke,
    debug: opts.debug,
    debugLogPath: opts.debugLog,
    model: opts.model,
    yolo: opts.yolo,
    enableMouse: opts.mouse,
    subcommand,
    version: false,
    attachPaths: opts.attach ?? [],
    passthrough: [],
  };
}

export function parseSdkWorkflowArgs(args: string[]): ParsedSdkWorkflowArgs {
  const passthrough: string[] = [];
  let model: string | undefined;
  let yolo = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? "";
    if (arg === "--yolo") {
      yolo = true;
      continue;
    }
    if (arg === "--model") {
      const value = args[i + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--model requires a model id.");
      }
      model = value;
      i += 1;
      continue;
    }
    if (arg.startsWith("--model=")) {
      const value = arg.slice("--model=".length).trim();
      if (!value) {
        throw new Error("--model requires a model id.");
      }
      model = value;
      continue;
    }
    passthrough.push(arg);
  }

  return { model, yolo, passthrough };
}
