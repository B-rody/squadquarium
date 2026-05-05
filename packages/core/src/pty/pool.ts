import { EventEmitter } from "node:events";
import * as pty from "node-pty";

export class PtyPoolFullError extends Error {
  readonly code = "pty-pool-full" as const;

  constructor() {
    super("PTY pool is full (max 4 concurrent)");
    this.name = "PtyPoolFullError";
  }
}

export interface PtySpawnOptions {
  cwd?: string;
  cols: number;
  rows: number;
  env?: Record<string, string>;
}

const MAX_POOL_SIZE = 4;

export class PTYPool {
  private readonly ptys = new Map<string, pty.IPty>();
  private readonly emitter = new EventEmitter();
  private idCounter = 0;

  async spawn(cmd: string, args: string[], opts: PtySpawnOptions): Promise<{ ptyId: string }> {
    if (this.ptys.size >= MAX_POOL_SIZE) throw new PtyPoolFullError();

    const ptyId = `pty-${++this.idCounter}-${Date.now().toString(36)}`;
    const proc = pty.spawn(cmd, args, {
      name: "xterm-256color",
      cols: opts.cols,
      rows: opts.rows,
      cwd: opts.cwd ?? process.cwd(),
      env: { ...process.env, ...opts.env } as Record<string, string>,
    });

    this.ptys.set(ptyId, proc);
    proc.onData((data) => this.emitter.emit(`data:${ptyId}`, data));
    proc.onExit(({ exitCode, signal }) => {
      this.ptys.delete(ptyId);
      this.emitter.emit(
        `exit:${ptyId}`,
        exitCode,
        signal === undefined ? undefined : String(signal),
      );
    });

    return { ptyId };
  }

  write(ptyId: string, data: string): void {
    this.ptys.get(ptyId)?.write(data);
  }

  resize(ptyId: string, cols: number, rows: number): void {
    this.ptys.get(ptyId)?.resize(cols, rows);
  }

  kill(ptyId: string, signal?: string): void {
    const proc = this.ptys.get(ptyId);
    if (!proc) return;

    proc.kill(signal);
    this.ptys.delete(ptyId);
  }

  onData(ptyId: string, listener: (data: string) => void): () => void {
    const event = `data:${ptyId}`;
    this.emitter.on(event, listener);
    return () => this.emitter.off(event, listener);
  }

  onExit(ptyId: string, listener: (code: number, signal?: string) => void): () => void {
    const event = `exit:${ptyId}`;
    this.emitter.on(event, listener);
    return () => this.emitter.off(event, listener);
  }

  get size(): number {
    return this.ptys.size;
  }

  disposeAll(): void {
    for (const [ptyId] of this.ptys) this.kill(ptyId);
  }
}
