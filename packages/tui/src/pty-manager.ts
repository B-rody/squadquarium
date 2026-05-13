import { EventEmitter } from "node:events";

/**
 * Resolve the command + args for a given sqq mode.
 * Returns the executable and argument list to pass to the PTY spawner.
 */
export function resolveCommand(
  mode: PtyMode,
  extraArgs: string[],
): { cmd: string; args: string[] } {
  switch (mode) {
    case "copilot":
      return { cmd: "copilot", args: ["--agent", "squad", ...extraArgs] };
    case "triage":
      return { cmd: "squad", args: ["triage", ...extraArgs] };
    case "loop":
      return { cmd: "squad", args: ["loop", ...extraArgs] };
  }
}

export type PtyMode = "copilot" | "triage" | "loop";

export interface PtyManagerOptions {
  mode: PtyMode;
  cwd: string;
  cols: number;
  rows: number;
  extraArgs?: string[];
  env?: Record<string, string>;
}

export interface PtyManagerEvents {
  data: [string];
  exit: [number, string | undefined];
}

/**
 * Manages a single PTY child process for the copilot/squad session.
 * Thin wrapper — spawn, write, resize, kill.
 */
export class PtyManager extends EventEmitter<PtyManagerEvents> {
  private proc: import("node-pty").IPty | null = null;
  private _exited = false;

  get running(): boolean {
    return this.proc !== null && !this._exited;
  }

  async spawn(options: PtyManagerOptions): Promise<void> {
    if (this.proc) {
      throw new Error("PTY already running");
    }

    const pty = await import("node-pty");
    const { cmd, args } = resolveCommand(options.mode, options.extraArgs ?? []);

    this.proc = pty.spawn(cmd, args, {
      name: "xterm-256color",
      cols: options.cols,
      rows: options.rows,
      cwd: options.cwd,
      env: { ...process.env, ...options.env } as Record<string, string>,
    });

    this._exited = false;

    this.proc.onData((data: string) => {
      this.emit("data", data);
    });

    this.proc.onExit(({ exitCode, signal }: { exitCode: number; signal?: number }) => {
      this._exited = true;
      this.proc = null;
      this.emit("exit", exitCode, signal === undefined ? undefined : String(signal));
    });
  }

  write(data: string): void {
    this.proc?.write(data);
  }

  resize(cols: number, rows: number): void {
    if (this.proc && !this._exited) {
      this.proc.resize(cols, rows);
    }
  }

  kill(signal?: string): void {
    if (this.proc && !this._exited) {
      this.proc.kill(signal);
      this.proc = null;
      this._exited = true;
    }
  }
}
