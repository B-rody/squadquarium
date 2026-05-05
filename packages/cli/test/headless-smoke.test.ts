import { describe, it } from "vitest";

/**
 * Headless-smoke tests for the `squadquarium` CLI.
 *
 * These tests verify the CLI's --headless-smoke contract: boot the server,
 * confirm the web bundle responds, and exit 0. They use the built artifact
 * (packages/cli/dist) rather than importing source so that we catch
 * packaging issues alongside logic bugs.
 *
 * Parker's CLI scaffold must implement:
 *   squadquarium             → exits non-zero (usage error) if no args and no
 *                              .squad/ directory detected
 *   squadquarium --headless-smoke → boots, runs smoke assertions, exits 0
 *
 * Mark items it.todo until the CLI flag exists.
 */

describe("CLI — invocation contract", () => {
  it.todo(
    "exits non-zero when invoked with no arguments and no .squad/ directory present",
    // Once Parker lands the CLI entry point, implement as:
    // const result = spawnSync("node", ["dist/index.js"], {
    //   cwd: new URL("..", import.meta.url).pathname,
    //   env: { ...process.env, HOME: someEmptyTempDir },
    //   timeout: 5000,
    // });
    // expect(result.status).not.toBe(0);
  );

  it.todo(
    "prints a usage message to stderr when invoked with no arguments",
    // Same setup as above; assert result.stderr.toString() contains "Usage" or
    // similar. Do not assert the exact string — Parker owns the wording.
  );
});

describe("CLI — --headless-smoke flag", () => {
  it.todo(
    "--headless-smoke boots the server, hits the WS endpoint, and exits 0",
    // Once Parker lands the flag:
    // const result = spawnSync(
    //   "node",
    //   ["dist/index.js", "--headless-smoke"],
    //   {
    //     cwd: new URL("..", import.meta.url).pathname,
    //     timeout: 30_000, // allow 30s for server boot + smoke run
    //   }
    // );
    // expect(result.status).toBe(0);
  );

  it.todo(
    "--headless-smoke exits non-zero if the server does not become ready within 30s",
    // Assert timeout path: mock or block the server so it never emits "ready",
    // confirm the process exits 1 (not hangs) within the timeout window.
  );

  it.todo(
    "--headless-smoke result object includes { ok: true, durationMs: number }",
    // The smoke exit code alone is insufficient for CI diagnostics; the CLI
    // should also write a JSON result object to stdout so the CI step can
    // surface timing data. Assert the shape of that object.
  );
});

describe("CLI — squadquarium doctor", () => {
  it.todo(
    "doctor detects Node version and reports it in the result",
    // Parker + Lambert own the implementation; Ripley owns this cross-cutting
    // integration test once the command exists.
  );

  it.todo("doctor detects squad on PATH and reports a clear error when missing");

  it.todo("doctor detects node-pty load success/failure and reports the no-PTY fallback path");

  it.todo("doctor detects port availability for default port 6280");
});
