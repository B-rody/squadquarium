# Project Context

- **Project:** Squadquarium — terminal-styled idle diorama wrapping bradygaster/squad.
- **User:** Brody Schulke (Brady). Windows-only host; cross-platform validation is **mine** via the GitHub Actions CI matrix.
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

(empty — to be populated by my work)
