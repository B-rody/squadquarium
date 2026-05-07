# Squadquarium

> A no-click idle diorama for your AI dev team.

Watch your [Squad](https://github.com/bradygaster/squad) team work — in real time, in your browser, in glorious terminal aesthetic. The fish are real. The code commits are real. The vibes are immaculate.

[ ! demo gif goes here — out of scope for autonomous v0 build ]

---

## Quick start

> **Squadquarium is not yet published to npm. `npm install -g squadquarium` will be the install path once Brody publishes it; until then, build from source.**

**Build from source:**

```bash
git clone https://github.com/B-rody/squadquarium
cd squadquarium
pnpm install
pnpm -r build
node packages/cli/dist/index.js [path]
```

For a real `squadquarium` / `sqq` bin on PATH:

```bash
pnpm pack-all
npm install -g packages/cli/squadquarium-0.0.1.tgz
squadquarium [path]
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

| Command                                             | Purpose                                                                                                                                                                                  |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `squadquarium [path]`                               | Resolve squad context and launch the diorama in your default browser. `path` defaults to cwd; walks up to find `.squad/`; falls back to personal squad; shows empty-state if none found. |
| `squadquarium --personal`                           | Force open the personal/global squad regardless of cwd.                                                                                                                                  |
| `squadquarium doctor`                               | Detect Node ≥ 22.5, `squad` on PATH, `node-pty` load, port availability, last-opened state file. Calls `squad doctor` for squad-side checks.                                             |
| `squadquarium status`                               | Concise one-screen status snapshot (agents, last decision, last bus event). No browser required.                                                                                         |
| `squadquarium trace <agent> [--task <id>] [--since 24h\|7d\|30d]` | Time-ordered activity trail for an agent: stitches `history.md`, `orchestration-log/`, `log/`, and `decisions.md`. `--task` narrows to a specific task; `--since` limits the window. |
| `squadquarium why <decision-id>`                    | Expand a `decisions.md` entry: nearest orchestration log entries (±1 hour), matched skills, related decisions. Accepts index number, timestamp prefix, or title keyword.                 |
| `squadquarium inspect <agent>`                      | Compact agent card: charter role + voice line, recent history, skills matched by role, files touched in `orchestration-log/`. Good for quick context without opening the browser.        |
| `squadquarium diorama [--frames N] [--width N]`     | Render the current team's glyph sprites to stdout using the aquarium skin. Animates `N` frames in-place (TTY) or newline-separated (pipe). Smoke-tests skin asset loading.               |
| `squadquarium aspire`                               | Shell out to `squad aspire`, extract the Aspire dashboard URL from its output, and open it in the default browser. Prints install guidance if `squad aspire` is not found.               |
| `squadquarium --headless-smoke`                     | Boot the server, verify the WebSocket endpoint, fire a synthetic event burst, assert the web bundle responds, exit 0/non-zero. CI-friendly.                                              |

`sqq` is an alias for `squadquarium` for typing brevity.

### In-app command palette

Press `:` anywhere in the diorama to open the Vim-style command palette. Commands include:

```
: skin aquarium          # switch skin
: skin office
: hatch                  # open Hatchery (agent creation) in the PTY panel
: inscribe               # open Scriptorium (skill creation) in the PTY panel
: aspire                 # launch squad aspire dashboard
: marketplace            # list configured marketplaces
: marketplace browse <name>   # list plugins in a marketplace
: scrub                  # open the time-scrubber replay panel
: wisdom                 # open the Wisdom Wing panel
: settings               # open the settings panel
: ralph start / stop     # control the squad watch night-shift daemon
: trace <agent>          # equivalent to the CLI subcommand, shown in log panel
: why <id>               # equivalent to the CLI subcommand, shown in log panel
: inspect <agent>        # equivalent to the CLI subcommand, shown in log panel
```

---

## Skins

Two skins ship in v0/v1:

| Skin                   | Palette                                        | Style                                                                                                     |
| ---------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Aquarium** (default) | Phosphor cyan `#00bfa5` on deep teal `#001f1c` | Literal ASCII fish, anglerfish Lead `(°)>=<` with `*` lure, kelp dressing, bioluminescent trench          |
| **Office** (alternate) | Phosphor amber on near-black                   | `[¤]` figures at `╔═╗` desks, server racks `▓▓▓` blinking, vocab-mapped labels (`elevator`, `tube`, etc.) |

Toggle via the command palette or the skin selector in the status bar:

```
: skin office
: skin aquarium
```

No restart required.

**Community skin packs (roadmap — v2+):** the manifest format (`manifestVersion: 1`) will be opened to contributors once the schema stabilises. Planned themes: deep trench, cottage village, space station, fungus colony. An in-app skin browser is on the v2 roadmap; for now, drop a skin folder into `skins/` and restart.

---

## Settings panel

Press `:` then `settings`, or click `[⚙]` in the header, to open the settings panel. All toggles persist to `localStorage`.

| Setting       | Default | What it does                                              |
| ------------- | ------- | --------------------------------------------------------- |
| CRT Bloom     | off     | Phosphor bloom glow over the canvas                       |
| CRT Scanlines | off     | Horizontal scanline overlay                               |
| Voice Bubbles | on      | Per-agent speech bubbles with charter voice lines         |
| Mood Glyphs   | on      | Ambient glyph overlays reflecting agent activity state    |
| Ambient SFX   | off     | Optional ambient audio (requires browser autoplay policy) |
| Always on top | off     | Hint for PWA/Tauri window manager (best-effort)           |

The CRT mode cycles: `off → scanlines → bloom → all`. Click `[CRT:off]` in the header to cycle without opening the panel.

**OBS-friendly mode** (v2 roadmap): transparent/chroma-key canvas for streamers. Not yet shipped.

---

## Wisdom Wing

The Wisdom Wing panel (`: wisdom`) renders `identity/wisdom.md` from the active Squad project as a browsable museum:

- **Patterns** — each `**Pattern:** … **Context:** …` entry renders as a card.
- **Skills** — active skills with confidence levels shown as chips below the pattern list.

The panel is read-only. Wisdom entries are written by agents into `identity/wisdom.md` via the Squad CLI; Squadquarium only reads and displays them.

---

## Plugin marketplace

Squadquarium includes a plugin marketplace backend that reads from configured Squad marketplaces:

**Default marketplaces:** `anthropics/skills` and `awesome-copilot`.

**Add a marketplace:** create `.squad/plugins/marketplaces.json`:

```json
{
  "marketplaces": [
    { "name": "mattpocock/skills", "description": "Matt Pocock's type-safe skill library" }
  ]
}
```

**From the command palette:**

```
: marketplace               # list configured marketplaces
: marketplace browse <name> # list plugins from a marketplace's local index
```

Install happens via `squad plugin install <marketplace>/<plugin>` — the UI shells out to the Squad CLI and streams the output into the log panel. Squadquarium never writes to `.squad/` directly.

---

## Game mode (v2 roadmap — cosmetic only)

A game layer is planned for v2: XP, daily stand-up summary cartoons, cosmetic loot drops. **It is explicitly cosmetic.** The game layer never affects agent decisions, orchestration, or the Squad CLI. Agents do not receive XP bonuses, and no game mechanic routes an agent off-task. This is a deliberate architectural constraint enforced at the product boundary.

Game mode will be off by default and toggled via a settings switch.

---

## v1 + v2 added

Compared to the v0 release, v1 and v2 add (or plan to add) the following:

- **`trace`, `why`, `inspect`, `diorama`, `aspire` subcommands** — CLI diagnostics without launching the browser.
- **Settings panel** — CRT bloom/scanlines toggles, voice bubbles, mood glyphs, ambient SFX, always-on-top.
- **Wisdom Wing** — `identity/wisdom.md` rendered as a browsable pattern museum inside the diorama.
- **Plugin marketplace UX** — browse and install Squad plugins from configured marketplaces via the command palette.
- **Game mode** _(v2 roadmap, cosmetic-only)_ — XP + daily summaries. Does NOT affect agent behavior.
- **Multi-attach view** _(v2 roadmap)_ — `--attach <path>` flag to show personal squad + project squad as side-by-side habitats in the same window.
- **Skin browser + community skin packs** _(v2 roadmap)_ — in-app browser; signed manifests; community themes.
- **VS Code webview wrapper** _(v2 roadmap)_ — same web bundle wrapped as a VS Code extension, published as a separate package, opt-in.
- **Tauri desktop wrapper** _(v1+ roadmap)_ — always-on-top desktop window, system tray, global hotkey. Separate `squadquarium-app` package. Requires Rust toolchain to build from source; binary releases require code signing (gated on demand).
- **`prebuildify` prebuilds** _(v1 roadmap)_ — per-platform `node-pty` `.node` binaries shipped in the npm tarball so `node-gyp` is not required on install. Not yet shipped; fallback to the build-at-install path remains active.

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
pnpm install
pnpm -r build
# For a global bin (optional):
pnpm pack-all
npm install -g packages/cli/squadquarium-0.0.1.tgz
# Then run:
squadquarium .
# Or without installing globally:
node packages/cli/dist/index.js .
```

> **You must build first.** `packages/cli/dist/` does not exist until `pnpm -r build` runs.

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

**Alpha — v0.** Pinned to Squad 0.9.4. Built fully autonomously by an offline Brody + a Squad team (Dallas, Lambert, Parker, Ripley) in one session — see the commit history for the full story. Breaking changes expected until v1.

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
