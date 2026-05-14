#!/usr/bin/env node
/**
 * bundle.mjs — builds dist/index.js via esbuild, inlining workspace code.
 * Runtime deps remain external so binary packages and large SDK dependencies
 * install normally from npm.
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
  entryPoints: [path.join(root, "src", "index.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outfile: path.join(outDir, "index.js"),
  external: [
    // native / binary-linked
    "node-pty",
    // runtime npm deps
    "ws",
    "open",
    "commander",
    "terminal-kit",
    "@bradygaster/squad-sdk",
    "@github/copilot-sdk",
  ],
  // suppress "use of eval" warnings from @xterm or other deps
  logLevel: "warning",
});

console.log("bundle: dist/index.js written");
