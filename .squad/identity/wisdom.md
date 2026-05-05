---
last_updated: 2026-05-05T22:30:00Z
---

# Team Wisdom

Reusable patterns and heuristics learned through work. NOT transcripts — each entry is a distilled, actionable insight.

## Patterns

<!-- Append entries below. Format: **Pattern:** description. **Context:** when it applies. -->

**Pattern:** Always run `pnpm install --frozen-lockfile` in CI (not bare `pnpm install`); it fails fast on lockfile drift rather than silently upgrading packages. **Context:** Every CI job that installs deps.

**Pattern:** pnpm 10.x blocks native build scripts (node-pty, esbuild, etc.) until `pnpm approve-builds` is run once interactively. Pre-approve in `package.json > pnpm.onlyBuiltDependencies` for non-interactive CI environments. **Context:** Any project that depends on native addons.

**Pattern:** In vitest configs for packages that share a directory with Playwright e2e specs, always `exclude: ["test/e2e/**"]` to prevent Playwright's `test.describe()` from crashing vitest's test runner. **Context:** packages/web and any future UI package.


**Pattern:** On Windows CI runners, `bash`-style glob expansion fails in PowerShell. When a workflow step needs to reference a file matched by glob (e.g., a packed `.tgz` tarball), use `shell: pwsh` + `Get-ChildItem` to resolve the path, and `shell: bash` with a native glob on Linux/macOS. Do not use a single cross-platform step for this case. **Context:** any GitHub Actions workflow step that installs a packed artifact on Windows (e.g., `npm install -g packages/cli/squadquarium-*.tgz`).

**Pattern:** Use `continue-on-error: true` at **job** scope (not step scope) for workflow jobs whose upstream code is not yet wired. This produces amber (non-blocking) in the GitHub Actions UI — the correct "wired but not runnable yet" signal — rather than a red failure that blocks the matrix or a silent skip that hides the gap. Always mark with a `# TEMP` comment and a named milestone task to flip it off. **Context:** scaffolded CI jobs that depend on CLI features or build targets that are still in-flight from another engineer (e.g., `pack-install-smoke` before the CLI pack target exists).
**Pattern:** When authoring a JSON Schema that must allow only declared properties plus `x-*` extension keys, use `additionalProperties: false` together with `patternProperties: { "^x-": {} }`. In JSON Schema draft 2020-12 (and earlier drafts), `additionalProperties` does not apply to properties matched by `patternProperties` — so `x-*` keys pass through cleanly. No need for `unevaluatedProperties`. **Context:** Any schema where you want a closed set of known fields plus an open extension namespace, without needing the more powerful (and subtler) `unevaluatedProperties` keyword.

**Pattern:** In a multi-skin glyph renderer, the sprite grid dimensions (rows × cols) must be identical across all skins that share a loader, otherwise the loader must reflow the layout on skin switch. Lock the canonical grid size in a decision doc, enforce it in the skin author contract, and test it in CI with a programmatic invariant rather than a schema constraint (schema cannot know about sibling skins). **Context:** Any skin/theme system that uses a fixed-cell-grid renderer (Canvas2D, xterm.js) where layout reflow has visible cost or causes dimension mismatch bugs.
 Ship green on ubuntu + windows first; add macOS once the suite is stable. macOS GitHub-hosted runners bill at 10× the minute rate and are 2–3× slower. The win + linux pair catches font-rendering and CSS differences that matter most. **Context:** any Playwright matrix at project inception where macOS has not been validated yet.

**Pattern:** Squad's bundled `dist/` directories (e.g., `dist/remote-ui/`) lack inline docs explaining their wire-protocol intent and consumer API surface. Consider: propose a `SQUAD-INTEGRATION.md` or equivalent upstream documenting `RemoteBridge` message schema, event types, and the architectural boundary between remote control (rc, RemoteBridge) vs. internal activity streams (EventBus). **Context:** When integrating with bundled SDK artifacts, always check the Squad CLI source code and SDK exports first; docs lag implementation. **Dogfood note:** This ambiguity would have delayed the Spike 3 remote-ui investigation; a clear integration guide would accelerate both upstream consumer adoption and v1+ features (e.g., HookPipeline, per-tool-call animations).
