#!/usr/bin/env node
/**
 * prebuild-node-pty.mjs
 *
 * Builds native prebuilt binaries for node-pty for the current platform using
 * `prebuildify`. Outputs go into packages/cli/prebuilds/{platform}-{arch}/.
 *
 * Usage:
 *   node packages/cli/scripts/prebuild-node-pty.mjs
 *
 * The prebuilds/ directory is then included in the npm tarball by prepack.mjs.
 *
 * ─── Isolation note ──────────────────────────────────────────────────────────
 * pnpm 10 uses an isolated nodeLinker (node_modules are hoisted only within
 * workspace boundaries). prebuildify runs node-gyp against the target package's
 * source. Because node-pty is a dependency of packages/cli it should be present
 * at packages/cli/node_modules/node-pty (or hoisted to the workspace root).
 *
 * If prebuildify cannot locate node-pty (e.g. pnpm symlinks confuse the CWD
 * resolution), run with:
 *   NODE_PTY_DIR=$(pnpm why node-pty --json | ...) node this-script.mjs
 * or see .squad/decisions/inbox/parker-prebuilds.md for the workaround.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliDir = path.resolve(__dirname, "..");

// Locate node-pty source (works for both hoisted and isolated layouts).
function resolveNodePtyDir() {
  // Try local workspace copy first.
  const local = path.join(cliDir, "node_modules", "node-pty");
  if (fs.existsSync(path.join(local, "binding.gyp"))) return local;

  // Try hoisted root.
  const root = path.resolve(cliDir, "..", "..", "node_modules", "node-pty");
  if (fs.existsSync(path.join(root, "binding.gyp"))) return root;

  // Fallback: resolve via require.resolve from the cli package.
  try {
    const { createRequire } = await import("node:module");
    const req = createRequire(path.join(cliDir, "package.json"));
    return path.dirname(req.resolve("node-pty/package.json"));
  } catch {
    return null;
  }
}

const nodePtyDir = await resolveNodePtyDir();
if (!nodePtyDir) {
  console.error(
    "prebuild-node-pty: could not locate node-pty source.\n" +
    "See .squad/decisions/inbox/parker-prebuilds.md for workaround.",
  );
  process.exit(1);
}

const prebuildsDir = path.join(cliDir, "prebuilds");
fs.mkdirSync(prebuildsDir, { recursive: true });

console.log(`prebuild-node-pty: building from ${nodePtyDir}`);
console.log(`prebuild-node-pty: output → ${prebuildsDir}`);

try {
  // Resolve prebuildify bin from the cli's node_modules.
  const prebuildifyBin = path.join(cliDir, "node_modules", ".bin", "prebuildify");
  const fallbackBin = path.join(cliDir, "..", "..", "node_modules", ".bin", "prebuildify");
  const bin = fs.existsSync(prebuildifyBin) ? prebuildifyBin : fallbackBin;

  execFileSync(
    "node",
    [
      bin,
      "--napi",
      "--strip",
      `--out=${prebuildsDir}`,
      "--target", `${process.versions.node}`,
    ],
    {
      cwd: nodePtyDir,
      stdio: "inherit",
      env: process.env,
    },
  );

  console.log("prebuild-node-pty: done.");
} catch (err) {
  console.error(
    `prebuild-node-pty: prebuildify failed — ${err instanceof Error ? err.message : String(err)}\n` +
    "See .squad/decisions/inbox/parker-prebuilds.md for the pnpm 10 workaround.",
  );
  process.exit(1);
}
