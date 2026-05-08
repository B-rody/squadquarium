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

📌 2026-05-07T17:17 — **TUI Visual Fix Sprint (background batch).** Three agents spawned for visual enhancements. You are working on test updates for palette format change and new visual test coverage. Orchestration log: `.squad/orchestration-log/2026-05-07T17-17-ripley.md`. Session: `.squad/log/2026-05-07T17-17-tui-visual-fix.md`. ⚠️ Your history.md exceeds 15KB gate — summarization completed (see history-archive.md).

📌 2026-05-06T19:17 — **TUI-FIRST PIVOT LIVE.** Dallas finalized, Lambert researched. **Architecture:** terminal-kit renderer, split-pane TUI (aquarium + activity log + input), custom sprite compositor, animated sprites at ~12–20 fps. **Removed from v0 scope:** `packages/web/`, `--serve` flag, web dashboard. (`packages/web-legacy/` preserved for potential v1). **Impact on your test strategy:** TUI now replaces web as the primary UI. Pre-v0 spike was "xterm + ink compatibility"; that's obsolete. New TUI test harness focus: verify terminal-kit mouse events, color/palette rendering, frame sync (no flicker with synchronized-output wrapping). Headless smoke (`squadquarium --headless-smoke`) likely needs a TUI variant (render to off-screen ScreenBuffer, assert aquarium/log/input buffers contain expected glyphs). Two user directives: TUI-first + drop web entirely.

📌 2026-05-06 — **Repo is now public.** Coordinator made visibility change via `gh repo edit`. Three-layer safety defence adopted (husky + agent docs pre-push gate + CI). Affects your CI validation charter — no changes needed; CI remains the post-push catch-all on all branches.

📌 2026-05-05 — Team cast (Alien universe). Phase 1 onboarding underway. Plan.md is being amended to add explicit Testing strategy / CI strategy / Sprite-validation / Quality-gates sections — those are my contracts going forward.

## Active Learnings

### 2026-05-06T19:17:29-07:00 — TUI harness contracts

**Layout contract:** `calculateLayout()` should reserve a 1-cell outer border, keep the input band fixed at 2 rows, target an aquarium/log split of roughly 60/40 within the remaining content height, and degrade gracefully on cramped terminals.

**Mock buffer requirement:** terminal-kit-facing tests need a ScreenBuffer mock that expands multi-character `put()` calls into per-cell state. The chrome/status bar code writes full strings, so single-call recording is not enough for assertions.

**Validation gate:** the repo-wide gate `pnpm lint && pnpm -r build && pnpm -r test` now includes `@squadquarium/tui` and passes with the TUI package in the workspace.

### 2026-05-07T17:17:37-07:00 — Truecolor attr contract + aquarium miss-click UX

**Palette contract:** in TUI truecolor mode, `Palette.resolve()` must return `{ r, g, b }` objects, not hex strings. ScreenBufferHD attr payloads accept RGB objects directly; asserting on strings masks the exact integration bug Lambert was fixing.

**Render coverage:** chrome, activity log, and input line tests should assert `put()` attr payloads, not just rendered glyphs. The real regression surface is whether terminal-kit receives color attrs on each write.

**Aquarium click UX:** a miss in aquarium space should be silent. Logging only on actor hit prevents click-spam noise in the activity pane and keeps the log signal useful during mouse exploration.

---

**Archive note:** Earlier detailed learning entries (Spike 5, Phase 5/6 Wave 2 audit findings, README dogfood) have been moved to history-archive.md on 2026-05-07 due to size threshold (15KB gate).


