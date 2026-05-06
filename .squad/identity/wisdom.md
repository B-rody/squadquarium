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

**Pattern:** Skills that walk template placeholders must include a fail-closed clause: never write a file with an invented, inferred, or blank `{placeholder}` value — surface the gap explicitly and offer (fill now / TODO stub / abandon). **Context:** any Squad skill that interviews the user to populate template files (Hatchery, Scriptorium, Ceremonies, Casting, MCP, Plugin marketplace).


**Pattern:** New CLI subcommands that do not share the server launch option model should dispatch before Commander parses legacy args. **Context:** Commander is configured with `allowExcessArguments(false)`, so standalone commands like trace/why/inspect/diorama/aspire need `checkDirectSubcommand()` before `parseArgs()`.

**Pattern:** For alpha SDK hooks, probe for the real API first and keep the fallback observable, bounded, and de-duplicated. **Context:** SDK 0.9.4 lacks HookPipeline pre-hooks; Squadquarium polls `.squad/orchestration-log/`, seeds existing filenames, and emits synthetic fs-sourced `tool:start` events only for newly appearing files.

**Pattern:** Keep renderer overlay lifecycle keyed by stable signal identity, not by array index. **Context:** Canvas2D animations driven by append-only event/store arrays where React re-renders can reorder or truncate inputs.

**Pattern:** Export pure command parsing and completion helpers before adding modal keyboard behavior. **Context:** Vim-style command palettes that need Vitest coverage without depending on full Playwright interaction tests.

**Pattern:** Upstream PR prep docs with copyable git commands are a deliverable, not a post-ship task. Write them when the code lands so the path from "it works here" to "it lives upstream" is never blocked on memory. **Context:** any project with an explicit upstream-PR roadmap item (skill filing, squad ui subcommand, Tauri wrapper, etc.).

**Pattern:** Classify externally-blocked roadmap items as `[parked]` (not `[ ]`) in audit manifests. `[ ]` implies "someone on the team can unblock this." `[parked]` makes the Brady-action explicit. **Context:** any audit pass over plan.md items that depend on license confirmation, external repo maintainer response, or code-signing infrastructure.

**Pattern:** VS Code webview extensions cannot open raw TCP sockets from the renderer. Route WS frames through cquireVsCodeApi().postMessage with a window.WebSocket shim injected into the webview HTML. The extension process holds the real ws.WebSocket and relays frames in both directions. **Context:** Any VS Code extension wrapping a WS-backed web UI.

**Pattern:** When shipping a repeatable CLI option with Commander, use the accumulator callback pattern: .option('--attach <path>', 'desc', (val, prev: string[]) => [...prev, val], [] as string[]). Commander's built-in collect is fine for simple cases; the explicit accumulator makes the initial value typeable. **Context:** Any Commander option that needs to be specified multiple times.

**Pattern:** For WS protocol replay (time-scrubber, history review), return events as a single bounded batch frame rather than streaming them as live events. Use a cap (e.g. 1000 events) and ms-epoch rom/	o filters. Do NOT route replay events through the reconciler — they are historical reads, not live state updates. **Context:** Any WS server that needs to serve event history alongside a live subscription.
**Pattern:** Isolate purely cosmetic "game layer" state by making it a pure derivation function (no Zustand store, no React context) imported only by its own UI component. Import graph isolation is a stronger invariant than a comment — if the game store has no import from `transport/store.ts`, the reconciler path provably cannot read game state even if a future developer tries. **Context:** Any overlay feature that must be cosmetics-only and not allowed to influence core agent behavior.

**Pattern:** When a settings enum type grows beyond boolean flags, export the type from the settings module and import it into components — never redeclare it inline. This keeps the type a single source of truth and prevents drift when new values are added. **Context:** Settings types like `ObsMode` that are consumed by both `SettingsPanel` and `CommandPalette`.

**Pattern:** When a Prettier `--write` on Windows doesn't fix the check, the root cause is usually Unicode characters stored with Windows-1252 encoding. Use `node -e "require('prettier').format(content, opts).then(f => fs.writeFileSync(path, f, 'utf8'))"` to force UTF-8 output. **Context:** Any cross-platform project where spec files were generated on Windows with wrong encoding.

**Pattern:** A CLI that has a `prepack` script copying a web build into `web-dist/` will serve THAT copy in preference to the dev-built `web/dist/` — even after `pnpm -r build` produces a fresher build. Always run the prepack script (or delete `web-dist/`) after any build that modifies the web package, before running Playwright. **Context:** Any CLI monorepo where the server falls back to dev-build only when the prod-copy directory is absent.

**Pattern:** When a React component's mount-time auto-focus uses `setTimeout(..., 0)`, Playwright's `keyboard.press()` → `keyboard.type()` sequence races with the focus transfer. Fix: dispatch the open trigger via `page.evaluate(() => window.dispatchEvent(...))`, then `waitFor` the target input to be visible, then `locator.fill()` the full value. `fill()` focuses the element before typing and is atomic. **Context:** Any Playwright test for a palette or modal that auto-focuses its input via setTimeout.

**Pattern:** WisdomWing (and analogous backdrop-click panels) use `position: absolute, inset: Npx` — they do not cover the header or viewport edges. Backdrop-click tests must use coordinates that fall within the panel's bounding box but outside any child panels. Clicking at `(10, 10)` typically hits the header, not the backdrop. **Context:** Any Playwright test for a modal/overlay with inset positioning inside a content area.