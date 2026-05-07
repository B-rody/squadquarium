# Project Context

- **Project:** Squadquarium — terminal-styled idle diorama wrapping bradygaster/squad.
- **User:** Brody Schulke (Brody). Windows-only host; cross-platform validation is **mine** via the GitHub Actions CI matrix.
- **Test stack:** Vitest 2.x for `packages/core/` + `packages/cli/`; Playwright 1.x for `packages/web/` (screenshot baselines + DOM/canvas assertions); GitHub Actions matrix (windows-latest + macos-latest + ubuntu-latest) for PTY install smoke.
- **Quality gate per commit:** `pnpm lint && pnpm test && pnpm build && pnpm smoke` — all green or no commit.
- **Created:** 2026-05-05.

## Core Context

- **My owned suites:**
  - **Vitest (packages/core, packages/cli):** unit + integration. Targets: SDK adapter facade, reconciler envelope/precedence/watermark/dedupe, observer classifier, PTY pool lifecycle, lock file PID logic, context resolution, `squadquarium doctor` checks.
  - **Playwright (packages/web):** glyph-grid invariants (cell alignment 1× and 2×), palette token assertions, manifest-schema compliance, skin loader fallbacks, ANSI trust boundary (links off, OSC allowlist), Interactive-mode focus toggle, screenshot baselines per skin/state/OS.
  - **CI smoke:** `npm pack` → `npm install -g <tarball>` → `squadquarium --headless-smoke` on Win/macOS/Linux runners.
- **Engineer-owned tests:** Lambert and Parker each write their own unit tests for their code. I review them and own the cross-cutting suite.
- **Reviewer-rejection lockout:** strict. Rejected PR → original author CANNOT produce the next revision. Coordinator routes to a different engineer or escalates. The same rule applies recursively if the revision is also rejected.
- **Screenshot baselines:** stored under `packages/web/test/__screenshots__/{skin}/{state}/{os}-{dpi}.png`. Updated only via explicit `pnpm test:web -u` from a clean run; CI never auto-updates.
- **Glyph invariants:** every rendered character must be in the active skin's `glyphAllowlist`; missing glyphs render `▢` with a dev-console warning. Both behaviors asserted.
- **Headless smoke command:** `squadquarium --headless-smoke` boots the server, waits for `core` to report ready, hits the WS endpoint with a synthetic event burst, asserts the `web` bundle responds, and exits 0/non-zero. CI runs this on each platform.

## Recent Updates

📌 2026-05-05 — Team cast (Alien universe). Phase 1 onboarding underway. Plan.md is being amended to add explicit Testing strategy / CI strategy / Sprite-validation / Quality-gates sections — those are my contracts going forward.

## Learnings

### 2026-05-07T17:00Z — Phase 3 Wave 2: ship readiness

**esbuild bundling for private monorepo deps:** pnpm 10's `bundleDependencies`
field is incompatible with `nodeLinker: isolated` (the default). The correct
approach for publishing a CLI that depends on a private workspace package is to
use esbuild to inline the dependency at build time, marking all genuine runtime
deps as external. This is cleaner than `bundleDependencies` anyway — no
tarball-level `node_modules/` complexity.

**ESLint + prepack-copied directories:** `prepack` scripts that copy directories
into the package dir (e.g., `web-dist/`, `skins/`) will be linted unless explicitly
excluded. Add both `**/web-dist/**` and `**/skins/**` to ESLint ignores, and add
`**/web-dist` to `.prettierignore`. Playwright output dirs (`playwright-report/`,
`test-results/`) also need `.prettierignore` entries.

**Playwright screenshot flakiness:** `maxDiffPixels: 100` is too tight for a
UI with cursor blink / animation at load time. `maxDiffPixelRatio: 0.05` (5%)
is stable across consecutive runs and still catches major visual regressions.
The stabilisation wait (`waitForFunction` on `#skin-tokens` being non-empty)
is necessary but not sufficient on its own.

**doctor.ts null-safety on Windows:** `spawnSync` returns `{ stdout: null,
stderr: null }` when the command is not found. Always guard with
`(stdout ?? "").trim()` before calling string methods on spawn output.

**`--serve-only` for Playwright webServer:** The cleanest way to hold the CLI
server up for Playwright is a dedicated flag that skips smoke burst + auto-open.
Avoid overloading `--headless-smoke` with extra semantics.

**`pnpm pack-all` root script:** CI references `pnpm pack-all`. This must be
wired in root `package.json` as `"pack-all": "pnpm --filter squadquarium pack"`.
Without it, the `pack-install-smoke` CI job fails at the pack step.

### 2026-05-05T22:30Z — Spike 5: CI matrix + screenshot baseline scaffold

**CI matrix shape:** Three OSes (ubuntu-latest, windows-latest, macos-latest) × Node 22.5.0. Single node version for v0; multi-version grows in v1 per plan.md "CI strategy". macOS Playwright is intentionally skipped in the first pass — macOS runners are slowest and billed at 10× the minute rate; win + linux catch the overwhelming majority of Playwright regressions. macOS Playwright is added once those two are green (v1 milestone).

**Baseline storage convention:** Golden PNGs committed under `packages/web/test/e2e/__screenshots__/`. Per-OS baselines are separate committed files because font hinting and subpixel AA differ enough across runner OSes to produce false diffs. The `snapshotPathTemplate` in `playwright.config.ts` encodes project name and snapshot suffix to namespace per DPI and OS. CI never auto-updates — `--update-snapshots` is absent from the CI command by design.

**`continue-on-error` for pack-install-smoke:** At Spike 5, Parker's CLI scaffold does not yet implement `pnpm pack-all` or `--headless-smoke`. Rather than block the entire CI matrix on a not-yet-wired step, the `pack-install-smoke` job carries `continue-on-error: true` with a clearly marked `# TEMP` comment. Ripley owns flipping this off as part of the v0 "publish dry run" milestone task — it is a hard gate before any npm publish attempt. Using `continue-on-error` at job scope (not step scope) means the job shows amber (not blocking red) in the GitHub Actions UI, which is the correct signal: "wired but not yet runnable, watch this."

**Windows glob caveat:** `bash`-style glob expansion fails in PowerShell. The Windows tarball-install step uses `pwsh` + `Get-ChildItem` to resolve the `.tgz` path explicitly. Linux/macOS steps use native `bash` glob. This is a reusable pattern for any future workflow step that needs to install a packed artifact on Windows.

### 2026-05-06T17:02Z — README vs Reality audit (requested by Brody)

**Audit method used:** (1) read all READMEs + per-package READMEs; (2) cross-check every claim
against package.json / pnpm-workspace.yaml / source files; (3) run `npm view <package> version`
to confirm publish status; (4) `glob packages/*/dist/**` to confirm whether a build exists;
(5) grep for `writeFile|writeFileSync` across src to verify the "read-only .squad/" invariant.

**npm install — definitive broken**: `npm view squadquarium version` → E404. Package not on
the registry. decisions.md:716 confirms intentional; Brody must publish manually. The main README,
packages/cli/README.md, and packages/squadquarium-vscode/README.md all have `npm install -g
squadquarium` as if it works today. Misleading for anyone who clones the repo before Brody publishes.

**No build output exists**: `packages/cli/dist/` and `packages/web/dist/` do not exist. The
`smoke` root script (`node packages/cli/dist/index.js --headless-smoke`) and the dogfooding
section (`squadquarium .` after `git clone`) both require a prior `pnpm -r build`. README
does not document this prerequisite at all.

**--task flag undocumented**: `trace.ts:187` + `parseTraceArgs` support `--task id` but the
README commands table only shows `--since`. Minor omission, but worth a patch.

**pty-spawn has no server-side allowlist**: `server.ts` accepts `pty-spawn` frames with arbitrary
`cmd`/`args`. The "all mutations route through squad CLI via PTY" rule is enforced by the web UI
layer, not by the server. Not a duplication finding, but a trust boundary gap for v1 hardening.

**`SquadquariumLock` writes to `.squad/.scratch/`**: This is explicitly sanctioned by team.md.
Not a violation. All other FS writes are to `~/.squadquarium/state.json` (user home, not .squad/).

**Reusable audit checklist for doc-vs-reality on any monorepo CLI package:**
- `npm view <name> version` → registry confirmation
- `glob packages/*/dist/**` → build output confirmation
- grep `writeFile|writeFileSync` in src → mutation surface
- Compare README command table against argv.ts DIRECT_SUBCOMMANDS + Commander config
- Check per-package READMEs repeat the same install claim as the root README
- Cross-check engines field against team.md runtime spec

### 2026-05-06T00:00Z — Phase 5/6 Wave 2: Playwright e2e + Tauri scaffold

**Stale `cli/web-dist/` blocks Playwright tests:** The CLI's `startServer()` prefers `packages/cli/web-dist/` (prod location) over `packages/web/dist/` (dev build). When the `prepack` script has been run even once, `web-dist/` exists and is served exclusively — even if `pnpm -r build` has since produced a fresher `web/dist/`. The symptom is that active Playwright tests pass SKIN_READY (the old bundle serves OK) but then time out on locators for components that only exist in the new build (e.g., `[⚙]` settings button). **Fix:** after any `pnpm -r build` that touches the web package, re-run `node packages/cli/scripts/prepack.mjs` to propagate the new bundle to `web-dist/` before executing Playwright.

**Race condition in CommandPalette focus:** `CommandPalette` uses `setTimeout(() => inputRef.current?.focus(), 0)` to focus the input after the palette mounts. This is asynchronous. Playwright's `page.keyboard.press(":")` resolves before the `setTimeout` fires, so any subsequent `page.keyboard.type(...)` or `page.keyboard.press(...)` goes to the wrong element (body / canvas). **Fix:** dispatch the `:` keydown via `page.evaluate(() => window.dispatchEvent(...))` then explicitly `waitFor` the palette input to be visible, then `fill()` the full command string. This is deterministic regardless of event-loop timing.

**WisdomWing backdrop click coordinates:** `WisdomWing` renders with `position: absolute, inset: 24px` inside the main content area (below the ~36px header). Its inner panel is 520px wide and centered in the 1280px default viewport, placing it at x ≈ 380–900px. Clicking at `(10, 10)` hits the header, not the backdrop. The correct backdrop-click coordinates for chromium-1x are any `(x < 380, y > 60)` — e.g. `(50, 200)`.

**Tauri scaffold on Rust-less machines:** Brody has no Rust toolchain (offline-by-policy). The `build` script in `packages/squadquarium-app/package.json` uses an inline Node.js check (`node -e "try{require('child_process').execSync('cargo --version')}catch(e){process.exit(0)}"`). If `cargo` is absent, it exits 0 silently, so `pnpm -r build` passes. Documenting this here so future agents don't "fix" the graceful skip.

**Spec fixmes are decision artifacts:** The six new Playwright spec files each have a mix of ACTIVE tests (verified working) and `test.fixme(...)` tests (components partially landed but not UI-wired). Each fixme cluster represents a forward-looking contract, not a bug. Created five decision inbox entries pointing Lambert to the exact wiring gaps for marketplace panel, game-mode toggle, OBS mode palette command, and multi-attach URL param.

**2026-05-06T17:21Z — Audit findings actioned:** Top 3 README audit items landed (Dallas + Parker). Install docs now pre-publish-accurate; build deps fixed; trace --task documented; cmd-allowlist deferred-to-v1 with TODO comment. Audit loop closed.

### 2026-05-07T00:55Z — Husky pre-push gate deployed

**Note for next push:** Pre-push hook now exists at `.husky/pre-push` running `pnpm lint && pnpm -r build && pnpm -r test` on all local pushes. Bypass with `git push --no-verify` if needed.
