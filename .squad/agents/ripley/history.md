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

### 2026-05-05T22:30Z — Spike 5: CI matrix + screenshot baseline scaffold

**CI matrix shape:** Three OSes (ubuntu-latest, windows-latest, macos-latest) × Node 22.5.0. Single node version for v0; multi-version grows in v1 per plan.md "CI strategy". macOS Playwright is intentionally skipped in the first pass — macOS runners are slowest and billed at 10× the minute rate; win + linux catch the overwhelming majority of Playwright regressions. macOS Playwright is added once those two are green (v1 milestone).

**Baseline storage convention:** Golden PNGs committed under `packages/web/test/e2e/__screenshots__/`. Per-OS baselines are separate committed files because font hinting and subpixel AA differ enough across runner OSes to produce false diffs. The `snapshotPathTemplate` in `playwright.config.ts` encodes project name and snapshot suffix to namespace per DPI and OS. CI never auto-updates — `--update-snapshots` is absent from the CI command by design.

**`continue-on-error` for pack-install-smoke:** At Spike 5, Parker's CLI scaffold does not yet implement `pnpm pack-all` or `--headless-smoke`. Rather than block the entire CI matrix on a not-yet-wired step, the `pack-install-smoke` job carries `continue-on-error: true` with a clearly marked `# TEMP` comment. Ripley owns flipping this off as part of the v0 "publish dry run" milestone task — it is a hard gate before any npm publish attempt. Using `continue-on-error` at job scope (not step scope) means the job shows amber (not blocking red) in the GitHub Actions UI, which is the correct signal: "wired but not yet runnable, watch this."

**Windows glob caveat:** `bash`-style glob expansion fails in PowerShell. The Windows tarball-install step uses `pwsh` + `Get-ChildItem` to resolve the `.tgz` path explicitly. Linux/macOS steps use native `bash` glob. This is a reusable pattern for any future workflow step that needs to install a packed artifact on Windows.
