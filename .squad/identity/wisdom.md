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

**Pattern:** Squad's `dist/remote-ui/` is a static PWA for the RC tool, not an event channel — visualizers should subscribe to EventBus + SquadObserver, not scrape `dist/`. **Context:** confirmed during Spike 3; `RemoteBridge` is for remote-control (client→server commands), not activity monitoring (server→client events). EventBus (`startWSBridge`, port 6277) is the canonical live-activity source.

**Pattern:** When a Canvas2D renderer needs both a time-bounded overlay animation AND a viewport-level camera pan, keep them in separate layers: canvas draw stays in the renderer class (progress-based glyph substitution), CSS `translateY` transform delegates via a callback to the React wrapper. Never repaint canvas for layout effects. **Context:** Any Canvas2D renderer with ritual/transition effects where layout motion must not block the raster pipeline.

**Pattern:** When a monorepo CLI needs to publish a private workspace dependency inline, prefer **esbuild bundling** over `bundleDependencies`. pnpm 10's `nodeLinker: isolated` (default) blocks `bundleDependencies` for workspace symlinks. esbuild inlines the private dep at build time; genuine runtime deps stay external and install from npm normally. **Context:** Any workspace CLI that depends on a private sibling package that is not published separately.

**Pattern:** When a `prepack` script copies directories into the package folder (e.g., web build output, skins), those directories will be picked up by ESLint and Prettier unless explicitly ignored. Add `**/web-dist/**` and `**/skins/**` to ESLint ignores; add `**/web-dist` and Playwright output dirs to `.prettierignore`. Run `pnpm lint` after wiring any prepack step to catch new violations. **Context:** Any monorepo package with a prepack script that materialises generated or vendored directories.

**Pattern:** Playwright screenshot `maxDiffPixels: 100` is too tight for UIs with cursor blink or CSS transitions at load time. Use `maxDiffPixelRatio: 0.05` (5%) instead — stable across consecutive runs, still catches major visual regressions. Pair with a `page.waitForFunction` to confirm a stable-state DOM sentinel before screenshotting. **Context:** Any Playwright screenshot baseline for a UI that has animation or async skin loading.

## v0 dogfood synthesis (autonomous build, 2026-05-05)

The Squadquarium v0 build was the most demanding stress test the Squad CLI / SDK has been subjected to: a single, offline-user, fully-autonomous session producing ~12,000 lines of TypeScript + React + skin assets + CI infra + governance, dispatched across ~10 specialist agent spawns. Patterns that emerged that future Squad / Squadquarium maintainers should remember:

**Pattern:** Squad's `decisions/inbox/` drop-box pattern is the linchpin of safe parallel agent work. Engineering agents writing files in parallel cannot safely share `.squad/decisions.md` without a merge step; the inbox + Scribe-merge pattern eliminates the conflict. Squadquarium should visualize this on the diorama (a "pneumatic tube" between agent bands and the Scribe library) — it's the one operation that makes parallel fan-out safe and it's currently invisible. **Context:** any multi-agent Squad session that fans out to 2+ engineers.

**Pattern:** The "no-ask rule + log-and-pivot" protocol works *only* if the assumption log (`.squad/QUESTIONS-FOR-HUMAN.md`) is genuinely append-only and human-readable on return. If it accumulates as opaque task IDs, the offline user can't audit. Squadquarium should surface this file as a first-class drill-in in the diorama (a "messages-in-a-bottle" rack at the lobby reef) — it's the user's only return-from-vacation interface. **Context:** any Squad-driven autonomous build where the human is offline mid-session.

**Pattern:** Charters with genuinely opinionated voices (per the charter template's "voice must have OPINIONS" guidance) materially improve sub-agent output quality. Charters that say "I am skeptical and will reject PRs without screenshots" produce sub-agents that actually reject PRs without screenshots; charters with generic responsibilities produce generic work. Squadquarium's drill-in panel should foreground the `## Voice` line as the agent's "headline" — it's the highest-signal field on a charter. **Context:** any time a coordinator dispatches to a charter-driven agent.

**Pattern:** The CRLF/LF line-ending warning storm during `git add` on Windows was visually noisy but harmless. A single `.gitattributes` rule (`* text=auto eol=lf`) at the repo root would silence it. Future Squadquarium repos templated by the Squad CLI should ship this default. **Context:** Any cross-platform git project where Windows contributors and macOS/Linux CI runners share a working tree.

**Pattern:** `pnpm pack` from a monorepo workspace creates the tarball at the workspace ROOT, not in the package directory — surprising on first encounter, documented poorly upstream. Scripts that consume the tarball (CI install jobs, doctor checks) must look at both locations. **Context:** any monorepo CLI publish flow using pnpm.

**Pattern:** Skin schema `additionalProperties: false` + `patternProperties: ^x-` is strictly safer than `unevaluatedProperties` for forward-compat extension namespaces. AJV validation of the former is unambiguous; the latter has subtle interaction with `$ref` and composition keywords. **Context:** any community-extensible JSON manifest format.

**Pattern:** A Tester role with strict reviewer-rejection lockout (rejected author may NOT self-revise) is the ONLY safety mechanism that keeps an autonomous build honest when the human is offline. Without it, the Coordinator silently re-routes a failure back to the same agent who shipped the bug. With it, the Coordinator MUST find a different specialist or escalate, which surfaces the friction visibly. **Context:** any autonomous Squad build longer than a single agent turn.

