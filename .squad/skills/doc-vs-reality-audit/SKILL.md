---
name: doc-vs-reality-audit
domain: testing
triggers:
  - README accuracy
  - documentation audit
  - install instructions
  - npm publish
  - package published
  - dist missing
  - command table
---

# Skill: doc-vs-reality-audit

> Verify that a project's README and per-package documentation match the
> actual repository state. Applies to any monorepo with a published CLI package.

## When to use

- Before a release or major PR: "does our README match what actually ships?"
- After a batch of new commands are added: "is the command table complete?"
- When a user reports install friction: "does the install flow actually work?"
- After any long autonomous session: drift between docs and code is expected.

## Checklist

### 1. npm/registry check
```bash
npm view <package-name> version
```
E404 → package not published; install instructions in README are premature.

### 2. Build output check
```glob
packages/*/dist/**
```
Empty glob → no build has been run; any README path referencing `dist/` is
broken. `smoke` and CLI commands that invoke `dist/index.js` will fail.

### 3. Mutation surface check
```grep
writeFile|writeFileSync|appendFile|fs\.write
```
in `packages/*/src/` — cross-check every hit against the project's "read-only
.squad/" invariant. Lock files and user-home state files are permitted.

### 4. Command table completeness
- Read `packages/cli/src/argv.ts` — list `DIRECT_SUBCOMMANDS` + Commander
  subcommands (`doctor`, `status`).
- Read the README commands table.
- Diff: missing commands → undocumented; extra commands → stale docs.
- Also check for undocumented flags (e.g., `--task` on `trace`).

### 5. Per-package README propagation
Every per-package README that repeats the global install command must be
checked: one broken sentence gets copy-pasted to three places.

### 6. Version pin consistency
Cross-check: `engines.node` in root `package.json` ↔ README "Requirements"
↔ `team.md` "Runtime" line. Same for pnpm version and Squad SDK pin.

### 7. Paths and files claimed in README
- Demo gifs, screenshots, skins/*, manifest files — `glob` or `view` each one.
- Links to CONTRIBUTING.md, LICENSE — verify the files exist.

## Output format

Verdict-style sections (one per major claim area):
- **Verdict**: ✅ accurate / ⚠ stale / ❌ broken / 🟡 partial
- **Evidence**: file:line citations only — no "I think"
- **Recommendation**: what to fix + who owns it

## Severity ranking (for Top N fixes list)
❌ broken → ⚠ stale → 🟡 partial → ✅ accurate

## Known patterns from past audits (Squadquarium, 2026-05-06)

- `npm install -g <package>` in README while package is pre-publish → ❌
- Dogfooding section omitting the mandatory `pnpm -r build` step → ⚠
- Architecture diagram listing only core packages, omitting scaffold-only ones → 🟡
- Undocumented flags in a CLI command (`--task` on `trace`) → 🟡
- `pty-spawn` no server-side allowlist → trust boundary gap, not duplication
