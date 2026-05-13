declare module "node-pty" {
  export function spawn(
    cmd: string,
    args: string[],
    options: {
      name?: string;
      cols: number;
      rows: number;
      cwd?: string;
      env?: Record<string, string>;
    },
  ): IPty;

  export interface IPty {
    onData(listener: (data: string) => void): void;
    onExit(listener: (event: { exitCode: number; signal?: number }) => void): void;
    write(data: string): void;
    resize(cols: number, rows: number): void;
    kill(signal?: string): void;
    pid: number;
  }
}
