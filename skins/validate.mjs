#!/usr/bin/env node
/**
 * skins/validate.mjs
 *
 * Validates skins/aquarium/manifest.json and skins/office/manifest.json
 * against skins/manifest.schema.json (JSON Schema draft 2020-12).
 *
 * Requires: ajv@8 in devDependencies (ajv/dist/2020 entry point).
 *   pnpm add -D ajv          # or npm install --save-dev ajv
 *
 * Usage:
 *   node skins/validate.mjs
 *   # exits 0 on success, 1 on validation failure, 2 if ajv is not found
 *
 * Manual alternative (no Node required):
 *   npx ajv-cli validate -s skins/manifest.schema.json -d "skins/aquarium/manifest.json" --spec=draft2020
 *   npx ajv-cli validate -s skins/manifest.schema.json -d "skins/office/manifest.json"   --spec=draft2020
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const schemaPath = join(__dirname, "manifest.schema.json");
const manifestPaths = [
  join(__dirname, "aquarium", "manifest.json"),
  join(__dirname, "office", "manifest.json"),
];

// ---------- load JSON ---------------------------------------------------
function loadJson(p) {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    console.error(`[validate] Cannot read ${p}: ${e.message}`);
    process.exit(1);
  }
}

const schema = loadJson(schemaPath);
const manifests = manifestPaths.map((p) => ({ path: p, data: loadJson(p) }));

// ---------- load ajv ----------------------------------------------------
let Ajv;
try {
  // ajv 8.x — draft 2020-12 entry point
  const mod = await import("ajv/dist/2020.js").catch(() => import("ajv/dist/2020"));
  Ajv = mod.default ?? mod;
} catch {
  try {
    const mod = await import("ajv");
    Ajv = mod.default ?? mod;
    console.warn(
      "[validate] WARNING: loaded ajv default entry — draft 2020-12 keywords may not all be supported.",
    );
    console.warn("           Install ajv@8 for full draft 2020-12 support: pnpm add -D ajv@8");
  } catch {
    console.error("[validate] ajv not found. Install it:");
    console.error("           pnpm add -D ajv@8   (or npm install --save-dev ajv@8)");
    console.error("");
    console.error("           Manual validation without ajv:");
    console.error("           npx ajv-cli validate -s skins/manifest.schema.json \\");
    console.error("               -d skins/aquarium/manifest.json --spec=draft2020");
    console.error("           npx ajv-cli validate -s skins/manifest.schema.json \\");
    console.error("               -d skins/office/manifest.json --spec=draft2020");
    process.exit(2);
  }
}

const ajv = new Ajv({ strict: false, allErrors: true });

let validate;
try {
  validate = ajv.compile(schema);
} catch (e) {
  console.error(`[validate] Schema compilation failed: ${e.message}`);
  process.exit(1);
}

// ---------- validate each manifest -------------------------------------
let anyFailed = false;

for (const { path: p, data } of manifests) {
  const rel = p.replace(process.cwd() + "\\", "").replace(process.cwd() + "/", "");
  const valid = validate(data);
  if (valid) {
    console.log(`[OK]   ${rel}`);
  } else {
    console.error(`[FAIL] ${rel}`);
    for (const err of validate.errors) {
      console.error(`       ${err.instancePath || "(root)"} — ${err.message}`);
    }
    anyFailed = true;
  }
}

process.exit(anyFailed ? 1 : 0);
