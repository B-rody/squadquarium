#!/usr/bin/env node
/**
 * bundle.mjs — builds dist/extension.js via esbuild for the VS Code extension.
 *
 * VS Code extensions must be CommonJS (not ESM). The output is a CJS bundle
 * with `vscode` marked external (it is injected by the VS Code runtime) and
 * `ws` left as an external npm dependency that ships in the extension's
 * node_modules.
 */
import { build } from "esbuild";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "dist");

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: [path.join(root, "src", "extension.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  outfile: path.join(outDir, "extension.js"),
  external: [
    // Injected by VS Code runtime — never bundle
    "vscode",
    // npm dep shipped in extension node_modules
    "ws",
  ],
  logLevel: "warning",
});

console.log("bundle: dist/extension.js written");
