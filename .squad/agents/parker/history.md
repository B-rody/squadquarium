# Project Context

- **Project:** Squadquarium — terminal-styled idle diorama wrapping bradygaster/squad.
- **User:** Brody Schulke (Brody). Windows-only host; cross-platform validated in GitHub Actions CI matrix (windows-latest + macos-latest + ubuntu-latest).
- **Stack:** TypeScript 5, Node ≥ 22.5 (current host: 24.14.1), pnpm 10.33.3 workspace, `@bradygaster/squad-sdk` pinned to `0.9.4`, `node-pty` (rebuilt via `node-gyp` at install), Fastify or stdlib `http`, `ws` for the loopback WebSocket, `open` package for browser launch.
- **My packages:** `packages/core/` (no UI; runs in Node) and `packages/cli/` (`squadquarium` / `sqq` bin entries).
- **Created:** 2026-05-05.

## Core Context

- **Squad integration is hybrid:** *reads* via the SDK (`SquadState`, `SquadObserver`, `EventBus`, `startWSBridge`); *mutations* via the `squad` CLI in PTY so the user sees real Squad output and ink TUI.
- **Five candidate event sources:** bus, pty, fs, log, and a **possible** fifth (`dist/remote-ui/` bridge — pre-v0 spike confirms whether this is real). Source precedence: `bus > pty > fs > log`. If `remote-ui` is real and structured, it slots between `bus` and `pty`.
- **Adapter boundary:** Squad is alpha. Pin SDK version per Squadquarium release. Treat `squad upgrade` as a port window. All SDK calls flow through `packages/core/`'s facade — Lambert never imports `@bradygaster/squad-sdk`.
- **Process model:** ONE Node process. CLI parses args, resolves context, boots `core`, starts an HTTP server (Vite-style auto-pick port; default 6280; not Squad's 6277), serves the prebuilt web bundle, opens browser via `open`. In dev, `vite dev` serves `web` with HMR; CLI proxies through.
- **Concurrency invariants:** Single-flow lock at `.squad/.scratch/squadquarium.lock` for any UI flow that mutates `.squad/`. External-mutator detection: every staging UI flow records a `.squad/` watermark on entry and re-renders against fresh state if `SquadObserver` reports a foreign mutation. Read paths are lock-free.
- **Triage co-existence:** When `squad triage` is detected as running (via `orchestration-log/` activity), Hatcher / Scriptorium flows refuse to start until triage is idle, or the user explicitly overrides.
- **`node-pty` install fallback:** If `npm install -g squadquarium` fails to build `node-pty` on a target OS, plan.md option **(a)** is the chosen path: ship a no-PTY fallback (read-only log tail) and defer Interactive mode to v1 for that platform. CI confirms cross-platform install.

## Recent Updates

📌 2026-05-07T17:17 — **TUI Visual Fix Sprint (background batch).** Three agents spawned for visual enhancements. You are working on click event debounce and startup message improvements. Orchestration log: `.squad/orchestration-log/2026-05-07T17-17-parker.md`. Session: `.squad/log/2026-05-07T17-17-tui-visual-fix.md`.

📌 2026-05-06T19:17 — **TUI-FIRST PIVOT LIVE.**Dallas finalized architecture decision, Lambert completed TUI library research. **New package:** `packages/tui/` (terminal-kit renderer library). **Removed:** `packages/web/` → `packages/web-legacy/` (parked, not built). **CLI scope changes:** CLI becomes TUI host, not server. Default `squadquarium` launches fullscreen TUI (aquarium + activity log + input line via three composited ScreenBuffer regions). `--serve` (web dashboard) deferred to v1+. Update your scaffold accordingly: TUI app init, not web-server init. Two user directives captured: TUI-first pivot + drop web entirely.

📌 2026-05-06 — **Repo is now public.** Coordinator made visibility change via `gh repo edit`. Three-layer safety defence adopted (husky + agent docs pre-push gate + CI). Dallas authored `.github/copilot-instructions.md` with Pre-Push Validation Gate section; you're covered by both husky (local) and docs gate (cloud agent).

📌 2026-05-05 — Team cast (Alien universe). Phase 1 onboarding underway. Pre-v0 spikes are mine to lead: `node-pty` cross-platform install, xterm + ink TUI compatibility, `dist/remote-ui/` bridge investigation, event reconciler design.

## Learnings

### 2026-05-07T17:49:29-07:00 — TUI color-debug instrumentation

**On-screen diagnostics:** `packages/tui/src/app.ts` now routes `--debug` startup diagnostics into the activity log pane, so terminal capability detection, `terminal-kit` support flags, `ScreenBufferHD` buffer creation inputs, palette summaries, sprite previews, and aquarium render samples are visible inside the TUI instead of disappearing behind fullscreen mode.

**Reusable renderer probes:** `packages/tui/src/palette.ts` exports `describePalette()` + `formatColorValue()`, `packages/tui/src/sprites.ts` exports parsed sprite preview helpers, and `packages/tui/src/aquarium.ts` exposes `describeDebugRender()` so color-token mapping and sample fg/bg attr resolution can be tested without a live terminal.

**Brody preference:** For renderer regressions, keep the evidence in the activity log panel with a `[DEBUG]` prefix. That makes Windows terminal color failures inspectable at startup without tailing stdout or attaching an external logger.

### 2026-05-06T19:17:29-07:00 — TUI package + CLI pivot

**TUI package:** `packages/tui/` now owns the fullscreen renderer shell using `terminal-kit` `ScreenBufferHD`, with three composited regions (aquarium, activity log, input), resize handling, mouse dispatch, and headless smoke coverage via Vitest.

**CLI default path:** `packages/cli/src/index.ts` no longer boots the browser/server flow for `sqq` with no args. The default command now launches `startApp()` from `@squadquarium/tui`; text subcommands (`doctor`, `status`, `trace`, `why`, `inspect`, `diorama`, `aspire`) stay stdout-first.

**Packaging / CI:** `packages/web/` is parked as `packages/web-legacy/` and excluded from the workspace. CI now runs lint + recursive build + recursive vitest only; the browser/Playwright path is removed from the main gate, while `--headless-smoke` remains as a non-interactive TUI bootstrap check for install-path validation.

### 2026-05-06T17:02:22Z — Ripley audit finding: trace command README missing --task flag

**Ripley audit identified:** `squadquarium trace` supports `--task <name>` filter for narrowing history to a specific agent task. README example shows only `--since`; the `--task` flag is not documented. Action: Update README trace example to show `squadquarium trace --since 2h --task diorama` (or similar example with both filters).

### 2026-05-06T17:19:47-07:00 — Ripley audit: cmd-allowlist gap (v1 hardening item)

**Known v1 hardening gap:** `packages/cli/src/server.ts` `pty-spawn` handler does `pool.spawn(frame.cmd, frame.args, ...)` without validating that `frame.cmd` is in an allowlist. The "all mutations route through the squad CLI" invariant is currently enforced only by the web UI, not the server. Loopback-only binding (`127.0.0.1`) is the v0 mitigation. A TODO comment was planted at the spawn call site (see Ripley audit 2026-05-06). v1 work: add an allowlist check (minimum: assert `frame.cmd === "squad"`) before dispatching to the PTY pool.

### 2026-05-07T00:55Z — Husky pre-push gate deployed

**Note for next push:** Pre-push hook now exists at `.husky/pre-push` running `pnpm lint && pnpm -r build && pnpm -r test` on all local pushes. Bypass with `git push --no-verify` if needed.

### 2026-05-07T17:49:29-07:00 — TUI debug diagnostics flag (background batch)

**Feature:** `--debug` flag now writes [DEBUG] diagnostic entries to the TUI activity log. Terminal capability detection, palette token resolution, sprite parsing, ScreenBufferHD buffer state, and sample foreground/background attribute mapping are now captured inside the fullscreen TUI instead of disappearing behind the rendering context.

**Orchestration:** `.squad/orchestration-log/2026-05-07T17-49-parker.md` — background spawn, full gate green.

**Session:** `.squad/log/2026-05-07T17-49-tui-debug-logs.md`.

**Reusable exports:** `packages/tui/src/palette.ts` exports `describePalette()` + `formatColorValue()` helpers for palette introspection; `packages/tui/src/sprites.ts` provides parsed sprite preview utilities; `packages/tui/src/aquarium.ts` exposes `describeDebugRender()` for color-token mapping and fg/bg resolution testability outside a live terminal.

**Brody usage:** For renderer regressions, keep diagnostic evidence in the activity log with [DEBUG] prefix. Avoids tail+grep overhead and surfaces Windows terminal color failures at startup.

---

> Archived entries (pre-v0 backend spikes, package scaffolding, reconciler design, Phase 5 Wave 2 backend) moved to `history-archive.md` on 2026-05-07T17:49:29-07:00 after reaching 15 KB size threshold.

