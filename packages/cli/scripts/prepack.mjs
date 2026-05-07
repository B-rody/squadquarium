#!/usr/bin/env node
/**
 * prepack.mjs — runs before `pnpm pack` (or `npm pack`) to stage publishable
 * CLI assets into packages/cli/.
 *
 *   skins/ ← <repo-root>/skins/ (raw skin sources for the CLI + diorama flows)
 *
 * The TUI library is bundled into dist/index.js by esbuild, so only skins and
 * optional node-pty prebuilds need staging here.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(cliDir, "..", "..");
const skinsSrc = path.resolve(repoRoot, "skins");
const skinsDest = path.resolve(cliDir, "skins");

console.log("prepack: building @squadquarium/core …");
execSync("pnpm --filter @squadquarium/core build", {
  cwd: repoRoot,
  stdio: "inherit",
});

console.log("prepack: building @squadquarium/tui …");
execSync("pnpm --filter @squadquarium/tui build", {
  cwd: repoRoot,
  stdio: "inherit",
});

console.log(`prepack: copying skins → ${path.relative(repoRoot, skinsDest)}`);
copyDir(skinsSrc, skinsDest);

console.log("prepack: done.");

const prebuildsSrc = path.resolve(cliDir, "prebuilds");
if (fs.existsSync(prebuildsSrc)) {
  console.log(`prepack: prebuilds/ present — included in tarball (${prebuildsSrc})`);
} else {
  console.log("prepack: no prebuilds/ dir — skipping (node-gyp will run on install).");
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    throw new Error(`prepack: source directory not found: ${src}`);
  }
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
