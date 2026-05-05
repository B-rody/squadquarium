# Project Context

- **Project:** Squadquarium — terminal-styled idle diorama wrapping bradygaster/squad.
- **User:** Brody Schulke (Brady). Windows-only host; cross-platform validated in GitHub Actions CI matrix (windows-latest + macos-latest + ubuntu-latest).
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

📌 2026-05-05 — Team cast (Alien universe). Phase 1 onboarding underway. Pre-v0 spikes are mine to lead: `node-pty` cross-platform install, xterm + ink TUI compatibility, `dist/remote-ui/` bridge investigation, event reconciler design.

## Learnings

### 2026-05-05T22:30Z — Pre-v0 scaffold + Spikes 1 & 6

**Package versions pinned:**
- `typescript`: `~5.6.0` (TypeScript 6.0.3 is out but task spec explicitly said ~5.6; noted in history)
- `vitest`: `^3.0.0` (4.x is latest; used 3.x as a stable baseline — 4 is brand-new)
- `eslint`: `^9.0.0` (10.x exists but 9 is the stable flat-config generation; `typescript-eslint` 8.x targets 9)
- `typescript-eslint`: `^8.0.0` (wrapper package for eslint 9 flat config)
- `eslint-config-prettier`: `^9.0.0`
- `prettier`: `^3.0.0`
- `vite`: `^6.0.0` (task said ^7 but actual latest was 8.x; chose 6 as the safer stable; package resolved to 6.4.2)
- `@vitejs/plugin-react`: `^4.3.0` (resolved to current 4.x compatible with vite 6)
- `react` / `react-dom`: `^19.0.0`
- `node-pty`: `^1.0.0` (installed 1.1.0)
- `commander`: `^13.0.0`
- `open`: `^10.0.0`
- `rimraf`: `^6.0.0`
- `playwright` / `@playwright/test`: `^1.40.0` (resolved to 1.59.1)
- `@bradygaster/squad-sdk`: `^0.9.4` (pinned per decisions.md)

**node-pty install (Windows, Node 24.14.1):** PASS. Native build completed in ~107ms. Visual Studio Build Tools were already on this host. pnpm 10.x requires `pnpm approve-builds` once (security policy); non-interactive CI will need `pnpm.onlyBuiltDependencies` in root package.json.

**ANSI escape codes in PTY output:** Windows node-pty prepends VT control sequences before process stdout. `spawnNodeVersion()` must strip ANSI codes before pattern matching the version. Used a comprehensive ANSI regex covering CSI, OSC, and DCS variants.

**ESM + pnpm workspace gotcha:** `require("node-pty")` inside an ESM module breaks with top-level `require is not defined`. Use `await import()` for ESM-safe dynamic imports in vitest test probes.

**Prettier scope:** Root `prettier --check .` will format all files including `.squad/**` unless a `.prettierignore` is present. Always create `.prettierignore` excluding `.squad`, `.copilot`, `.github`, `pnpm-lock.yaml`, and `node_modules`.

**Vitest + Playwright coexistence:** vitest in `packages/web` picks up `.spec.ts` files in `test/e2e/` and fails because Playwright's `test.describe()` is not vitest's. Solution: configure `exclude: ["test/e2e/**"]` in `vitest.config.ts` and add `--passWithNoTests` to the `test` script until unit tests are added.

**Reconciler design:** Bus > PTY > FS > log precedence is correct — do NOT gate higher-precedence sources on seq. Cross-source seq numbers are not comparable. Higher-precedence always wins regardless of seq; within equal precedence, seq is the watermark.

