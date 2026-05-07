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

### 2026-05-05T22:30Z — Phase 3 Wave 1: Full v0 backend

**SDK adapter:** SDK's SquadObserver SKIPS orchestration-log/ changes by design (see squad-observer.js:88-90). Must use a separate fs.watch for orchestration-log/. SquadObserver emits agent:milestone events with payload { action: 'file_change' } — subscribe via EventBus.subscribeAll() and filter by payload.action to distinguish fs source from bus source. SDK Agent.charterPath is set by the collection; historyPath must be derived by replacing 'charter.md' with 'history.md'.

**PTY pool:** node-pty.spawn() is synchronous; wrap in async for API consistency. EventEmitter used for data/exit routing per ptyId. Pool cap = 4; PtyPoolFullError carries code: 'pty-pool-full' so the WS server can send the right error code to the client.

**Lock file:** process.kill(pid, 0) is cross-platform for liveness check (throws if process doesn't exist). Stale lock detection uses this. Lock file lives at {squadRoot}/.scratch/squadquarium.lock; mkdirSync with recursive:true ensures .scratch/ exists.

**Headless smoke:** WS client uses the same 'ws' package. smoke test writes a temp file to decisions/inbox/ and waits for the SquadObserver FS event. Cleanup removes the file after the test regardless of outcome.

**WS server:** Used http.createServer + WebSocketServer({ noServer: true }) pattern for fine-grained upgrade control. Origin validation rejects anything that isn't 127.0.0.1, localhost, or file:// (electron use case). serverSeq is per-connection (not global) — each connection gets its own counter starting at 0.

**Static serving:** packages/web/dist/ is resolved relative to import.meta.url of server.ts using path.resolve. Falls back gracefully when web bundle doesn't exist yet (404 for static assets; WS path still works).


### 2026-05-06T03:51Z — Phase 5 Wave 1 backend slice

**CLI diagnostics:** Added direct pre-Commander subcommands for trace/why/inspect/diorama/aspire. The key compatibility point is to call `checkDirectSubcommand()` before `parseArgs()` so legacy Commander strict argument handling does not reject the new standalone command argv shapes.

**HookPipeline fallback:** Squad SDK 0.9.4 does not expose a HookPipeline API in this adapter surface. The safe v1 fallback is to seed existing orchestration-log filenames, poll `.squad/orchestration-log/` every 200ms, and emit synthetic `tool:start` events only for new files using filename keyword mapping to browse/edit/shell/misc.

**Marketplace backend:** Core marketplace support is intentionally filesystem-first: defaults merge with `.squad/plugins/marketplaces.json`, browse reads `.squad/plugins/{marketplace}/index.json`, and install delegates to `squad plugin install` via child_process spawn.

### 2026-05-06T03:51Z — Phase 5 Wave 2: Replay frame, Multi-attach, VSCode wrapper, prebuilds

**Replay WS frame:** `replay-request` client frame + `replay` server frame added to protocol. Server reads orchestration-log/ files best-effort (timestamp from filename regex, agent from `**Agent:**` markdown field), sorts by observedAt, caps at 1000 events. `from`/`to` filter is ms-since-epoch matching `SquadquariumEvent.observedAt`.

**Multi-attach:** `SquadStateAdapter` gains public `id` and `label` fields. `createMulti({ contexts })` is the multi-squad factory — creates adapters in parallel, filters nulls. CLI `--attach <path>` is a repeatable Commander accumulator option. Server snapshot frame gains `attachedSquads` (optional); event frames gain `attachedSquadId` (optional). Each attached adapter runs its own observer/bus subscription; events are tagged with `attachedSquadId` and forwarded over the shared `serverSeq` counter. All attached adapters are disposed in the CLI's `finally` block.

**VS Code webview wrapper:** New `packages/squadquarium-vscode/` CJS package (engines.vscode `^1.85.0`). `activate()` registers `squadquarium.open`; command handler spawns `squadquarium --serve-only` on first use, creates a webview panel, and proxies WS via `acquireVsCodeApi().postMessage`. A JS shim patches `window.WebSocket` in the renderer. Built with esbuild (`format: "cjs"`, `vscode` external). `@types/vscode ^1.85.0` provides types; `@ts-expect-error` guards the `import type` line. `vsce package` is a manual Brody step.

**node-pty prebuilds:** `prebuildify` + `node-gyp-build` added to cli devDependencies. Script `packages/cli/scripts/prebuild-node-pty.mjs` resolves node-pty source through three fallback paths (local → hoisted → require.resolve). `.github/workflows/prebuild.yml` runs the matrix (windows/macos/ubuntu) on tag push; prebuilds uploaded as artifacts; publish step intentionally omitted. `prebuilds/` added to cli `files` array. `continue-on-error: true` on the prebuild step guards against pnpm 10 isolated nodeLinker resolution issues until validated; see `.squad/decisions/inbox/parker-prebuilds.md` for the workaround.

### 2026-05-06T17:02:22Z — Ripley audit finding: trace command README missing --task flag

**Ripley audit identified:** `squadquarium trace` supports `--task <name>` filter for narrowing history to a specific agent task. README example shows only `--since`; the `--task` flag is not documented. Action: Update README trace example to show `squadquarium trace --since 2h --task diorama` (or similar example with both filters).

