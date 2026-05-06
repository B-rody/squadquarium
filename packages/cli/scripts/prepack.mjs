#!/usr/bin/env node
/**
 * prepack.mjs — runs before `pnpm pack` (or `npm pack`) to stage the
 * publishable assets into packages/cli/:
 *
 *   web-dist/   ← packages/web/dist/  (Vite bundle, includes skins + fonts)
 *   skins/      ← <repo-root>/skins/  (raw skin sources for the CLI adapter)
 *
 * Decision: bundleDependencies for @squadquarium/core; web + skins via copy.
 * See .squad/decisions/inbox/ripley-publish-shape.md.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(cliDir, "..", "..");
const webDistSrc = path.resolve(repoRoot, "packages", "web", "dist");
const webDistDest = path.resolve(cliDir, "web-dist");
const skinsSrc = path.resolve(repoRoot, "skins");
const skinsDest = path.resolve(cliDir, "skins");

console.log("prepack: building @squadquarium/core …");
execSync("pnpm --filter @squadquarium/core build", {
  cwd: repoRoot,
  stdio: "inherit",
});

console.log("prepack: building @squadquarium/web …");
execSync("pnpm --filter @squadquarium/web build", {
  cwd: repoRoot,
  stdio: "inherit",
});

console.log(`prepack: copying web dist → ${path.relative(repoRoot, webDistDest)}`);
copyDir(webDistSrc, webDistDest);

console.log(`prepack: copying skins → ${path.relative(repoRoot, skinsDest)}`);
copyDir(skinsSrc, skinsDest);

console.log("prepack: done.");

// ─────────────────────────────────────────────────────────────────────────────

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
