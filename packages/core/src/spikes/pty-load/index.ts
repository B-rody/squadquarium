import * as pty from "node-pty";

// Matches ANSI/VT escape sequences including OSC, CSI, and DCS variants
const ANSI_STRIP_RE = /\x1b(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1b\\))/g;

export async function spawnNodeVersion(): Promise<string> {
  return new Promise((resolve, reject) => {
    // Use the absolute path to the running Node binary so pty.spawn never
    // needs to resolve "node" through PATH — which is unreliable on macOS CI
    // runners where Homebrew's bin dir may not be in the inherited environment.
    const shell = process.execPath;
    const term = pty.spawn(shell, ["--version"], {
      name: "xterm-color",
      cols: 80,
      rows: 30,
      cwd: process.cwd(),
      env: process.env as Record<string, string>,
    });

    let output = "";
    term.onData((data) => {
      output += data;
    });

    term.onExit(({ exitCode }) => {
      const cleaned = output
        .replace(ANSI_STRIP_RE, "")
        .replace(/\r/g, "")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => /^v\d+\.\d+\.\d+/.test(l))[0];

      if (exitCode === 0 || exitCode == null) {
        resolve(cleaned ?? output.trim());
      } else {
        reject(new Error(`node --version exited with code ${exitCode}`));
      }
    });
  });
}
