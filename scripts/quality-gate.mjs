#!/usr/bin/env node
/**
 * quality-gate.mjs — per-commit quality gate for Squadquarium.
 *
 * Runs: lint → test (Vitest workspace-wide) → build → smoke (headless).
 * Each step must exit 0; the first failure stops the pipeline and this script
 * exits with the union non-zero code.
 *
 * Usage (from repo root):
 *   node scripts/quality-gate.mjs
 *
 * Or via the root package.json script:
 *   pnpm smoke          ← wired to: node scripts/quality-gate.mjs
 *
 * Per-commit rule: every commit must pass this gate before landing. CI runs
 * it on each push; engineers are expected to run it locally before pushing.
 *
 * CI note: in the GitHub Actions matrix this script is called indirectly via
 * the individual `pnpm lint`, `pnpm -r test`, `pnpm -r build`, and
 * `pnpm -r test:web` steps. This script exists as the canonical *local*
 * gate so engineers can run one command and match what CI checks.
 */

import { execSync } from "node:child_process";

const steps = [
  { label: "lint", cmd: "pnpm lint" },
  { label: "test (Vitest)", cmd: "pnpm -r test" },
  { label: "build", cmd: "pnpm -r build" },
  { label: "smoke (headless)", cmd: "pnpm -r test:web" },
];

let anyFailed = false;

for (const { label, cmd } of steps) {
  process.stdout.write(`\n▶ [quality-gate] ${label}  →  ${cmd}\n`);
  try {
    execSync(cmd, { stdio: "inherit" });
    process.stdout.write(`✓ [quality-gate] ${label} passed\n`);
  } catch (err) {
    process.stderr.write(`✗ [quality-gate] ${label} FAILED (exit ${err.status ?? 1})\n`);
    anyFailed = true;
    // Stop on first failure — don't mask downstream errors with cascade noise.
    break;
  }
}

if (anyFailed) {
  process.stderr.write(
    "\n✗ quality gate FAILED — commit blocked until all steps are green.\n"
  );
  process.exit(1);
} else {
  process.stdout.write(
    "\n✓ quality gate PASSED — lint · test · build · smoke all green.\n"
  );
  process.exit(0);
}
