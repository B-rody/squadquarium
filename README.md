# Squadquarium

> A no-click idle diorama for your AI dev team.

Watch your [Squad](https://github.com/bradygaster/squad) team work — in real time, in your browser, in glorious terminal aesthetic. The fish are real. The code commits are real. The vibes are immaculate.

[ ! demo gif goes here — out of scope for autonomous v0 build ]

---

## Quick start

```bash
npm install -g squadquarium
cd /path/to/your/squad/project
squadquarium
```

Open your personal/global squad:

```bash
squadquarium --personal
```

Point at an arbitrary repo:

```bash
squadquarium /path/to/repo
```

That's it. Your default browser opens to the diorama. No config, no accounts, no server to run.

---

## What it does

Squadquarium is a **local-only ambient dashboard** for a Squad project. It:

- **Habitat panel** — a Canvas2D glyph diorama, banded by role. Lead at the top (anglerfish `(°)>=<` with a flickering `*` lure), Frontend in the mood lagoon (seahorse), Backend at the engine reef (octopus), Tester in the test tank (pufferfish). Each creature animates in real time, driven by reconciled events from the Squad SDK.
- **Log panel** — real `squad watch` PTY output rendered through `xterm.js`. Read-only in Ambient mode so you can always see what's actually happening. Hyperlinks off by default; OSC sequences restricted to cursor/title only.
- **c′ split** — resizable, collapsible habitat + log panels in terminal-styled chrome (double-line border, phosphor palette, optional CRT scanlines + bloom). Click a creature → drill-in panel. Click a log line → camera pans to the agent.
- **Interactive mode** — click **Hatch new teammate**, **Inscribe new skill**, or **Open Coordinator** to switch the log panel into a live PTY session. The Squad Coordinator's React+ink TUI renders inside; you type responses there. ESC returns to ambient.
- **Skin toggle** — Aquarium (default, phosphor cyan-on-deep-teal) or Office (phosphor amber-on-near-black, `[¤]` figures at `╔═╗` desks). Restart-free via the command palette.
- **PWA** — modern browsers offer "Install app." The v0 manifest ships, so the affordance works even if the icons aren't polished yet.

---

## What it doesn't do

**Squadquarium may call `squad`; it must not become `squad`.**

| Layer        | Owns                                                                             |
| ------------ | -------------------------------------------------------------------------------- |
| Squad        | Agents, orchestration, CLI commands, repo state, `.squad/`, behavior             |
| Squadquarium | Install/setup UX, diorama rendering, status display, buttons that invoke `squad` |

Hard rules:

- Squadquarium reads `.squad/` continuously and **never writes** to it directly. All mutations go through the Squad CLI via PTY.
- Every management action maps to a visible/copyable `squad ...` command.
- The fun/game layer is visual interpretation only; it never changes what agents decide to do.
- No second runtime, no sidecar, no Rust binary in v0 — one Node process, loopback only.

---

## Requirements

- **Node ≥ 22.5.0** — hard fail below; Squad requires it.
- **pnpm 10+** — workspace toolchain for development.
- **`squad` CLI on PATH** — or accessible via `npx @bradygaster/squad-cli`. `squadquarium doctor` detects the situation and surfaces fix-up commands.
- Pinned to **Squad 0.9.4** for v0. Run `squadquarium doctor` before pointing at a newer Squad release.

---

## Install troubleshooting

Squadquarium depends on [`node-pty`](https://github.com/microsoft/node-pty) for live PTY output. On most systems this builds automatically at install time. If it doesn't:

**Windows** — you need the MSVC build tools:

```powershell
# In an admin PowerShell:
npm install -g windows-build-tools
# Then reinstall:
npm install -g squadquarium
```

**macOS / Linux** — ensure `python3` and a C++ compiler are available (usually already present via Xcode CLT or `build-essential`).

If `node-pty` still fails to build, Squadquarium falls back to **no-PTY log-tail mode**: it reads `orchestration-log/` and `log/` as static files instead of streaming live PTY. The diorama still animates; Interactive mode is unavailable until the PTY issue is resolved. `squadquarium doctor` surfaces the situation with a copyable fix-up command.

---

## Commands

| Command                         | Purpose                                                                                                                                                                                  |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `squadquarium [path]`           | Resolve squad context and launch the diorama in your default browser. `path` defaults to cwd; walks up to find `.squad/`; falls back to personal squad; shows empty-state if none found. |
| `squadquarium --personal`       | Force open the personal/global squad regardless of cwd.                                                                                                                                  |
| `squadquarium doctor`           | Detect Node ≥ 22.5, `squad` on PATH, `node-pty` load, port availability, last-opened state file. Calls `squad doctor` for squad-side checks.                                             |
| `squadquarium status`           | Concise one-screen status snapshot (agents, last decision, last bus event). No browser required.                                                                                         |
| `squadquarium --headless-smoke` | Boot the server, verify the WebSocket endpoint, fire a synthetic event burst, assert the web bundle responds, exit 0/non-zero. CI-friendly.                                              |

`sqq` is an alias for `squadquarium` for typing brevity.

---

## Skins

Two skins ship in v0:

| Skin                   | Palette                                        | Style                                                                                                      |
| ---------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Aquarium** (default) | Phosphor cyan `#00bfa5` on deep teal `#001f1c` | Literal ASCII fish, anglerfish Lead `(°)>=<` with `*` lure, kelp dressing, bioluminescent trench           |
| **Office** (alternate) | Phosphor amber on near-black                   | `[¤]` figures at `╔═╗` desks, server racks `▓▓▓` blinking, minimal content — proves the schema, not Polish |

Toggle via the command palette:

```
: skin office
: skin aquarium
```

No restart required. v2 opens the manifest format to community contributions — same bones, new glyphs (deep trench, cottage village, space station, fungus colony).

---

## Architecture

One Node process. No Rust. No sidecar. No electron.

```
squadquarium/
├── packages/
│   ├── core/   # Squad SDK adapter, SquadObserver, event reconciler,
│   │           # PTY pool, lock file. No UI. Node-only.
│   ├── web/    # React 19 + Vite + Canvas2D diorama (browser bundle)
│   └── cli/    # `squadquarium` / `sqq` binary: arg parsing,
│               # context resolution, HTTP/WS server, browser launch
├── skins/
│   ├── aquarium/   # manifest.json, sprites.json, habitat.json, …
│   └── office/
└── .squad/         # the Squad team building Squadquarium (dogfooding)
```

- **Transport** — single WebSocket on `127.0.0.1` between `web` and `core`. Framed messages with sequence numbers. Auto-reconnect on transient drops. `--host 0.0.0.0` is rejected with a hard error — loopback-only for v0.
- **Event reconciler** — four sources (`bus > pty > fs > log`) fused into a single `SquadquariumEvent` envelope with per-entity watermarks and a `(entityKey, causedBy, seq, source)` dedupe key. Divergence between the diorama and the log panel is treated as a v0 invariant, not a v1 hardening.
- **Renderer** — Canvas2D glyph atlas. Per-cell `(glyph, fg, bg, blink?)`. ~12 fps animation via glyph substitution. WebGL only if Canvas2D hits a perf wall (1k+ animated cells).
- **Terminal** — `xterm.js` + `@xterm/addon-fit`. No `WebLinksAddon` by default (ANSI trust boundary). OSC allowlist: cursor/title only.
- **State** — `@bradygaster/squad-sdk` (pinned `0.9.4`) for `SquadState` collections, `SquadObserver` (200ms debounce), and `EventBus` bridge.

---

## PWA

Modern browsers (Chrome, Edge, Arc) offer **"Install app"** when a PWA manifest is present. The v0 manifest ships at `packages/web/public/manifest.webmanifest` and a service worker precaches the bundle. Icon polish lands in v1; the affordance works in v0.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the per-commit quality gate (`pnpm lint && pnpm test && pnpm build && pnpm smoke` must be green) and the reviewer-rejection lockout.

**Skin authors**: read `skins/AUTHOR-CONTRACT.md` and validate your manifest against `skins/manifest.schema.json` before opening a PR. Run `node skins/validate.mjs` locally.

---

## Dogfooding

This repo is itself a Squad project. The team that builds Squadquarium is the team you see when you point it at this repo.

```bash
git clone https://github.com/B-rody/squadquarium
cd squadquarium
squadquarium .
```

The fish in the aquarium are the agents writing the aquarium. `decisions.md`, `orchestration-log/`, and per-agent `history.md` produced while building Squadquarium are the most authentic possible demo recording — see the commit history for receipts.

---

## License

MIT — see [LICENSE](./LICENSE) if present, or assume standard MIT for pre-1.0.

---

## Built with

- [`@bradygaster/squad-sdk`](https://github.com/bradygaster/squad) — the event bus, observer, and state facade that make the diorama possible.
- The full v0 roadmap, trade-offs, and architecture rationale: [plan.md](./plan.md).
- Squad 0.9.4 pinned. See [plan.md → Risks → Squad is alpha](./plan.md) before bumping.

---

## Status

**Alpha — v0.** Pinned to Squad 0.9.4. Built fully autonomously by an offline Brady + a Squad team (Dallas, Lambert, Parker, Ripley) in one session — see the commit history for the full story. Breaking changes expected until v1.

```
╔═ squadquarium · alpha ═══════════════════════ phosphor-cyan ═╗
║ ┌─ habitat ──────────────────┐ ┌─ logs · live ─────────────┐ ║
║ │     (°)>=<                 │ │ 22:30 dallas → lambert     │ ║
║ │       lighthouse perch     │ │   "ship the README"        │ ║
║ │  ╔═╦╗  coral garden        │ │ 22:30 lambert: ⚙ render    │ ║
║ │  ║║║║                      │ │ 22:31 parker:  ✓ WS ready  │ ║
║ │  ▲▼▲▼  engine reef         │ │ 22:31 ripley:  ✓ 47 passed │ ║
║ └────────────────────────────┘ └────────────────────────────┘ ║
║ > squad watch · streaming                           ▓▓░░░ 60% ║
╚══════════════════════════════════════════════════════════════╝
```
