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

(empty — to be populated by my work)
