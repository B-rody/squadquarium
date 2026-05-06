# Changelog

All notable changes to Squadquarium are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning: [Semantic Versioning](https://semver.org/).

---

## [Unreleased] — v0.2.0 (v2)

---

## [0.2.0] — 2026-05-06 · v2 — "Reach"

> v2 built autonomously by the Squadquarium Squad team (Dallas, Lambert, Parker, Ripley).
> Lambert + Parker shipping frontend/backend wave; Ripley on test/audit.

### Added

- **Settings panel** (`packages/web/src/components/SettingsPanel.tsx`): toggle Ambient SFX,
  Always on Top, CRT Bloom, CRT Scanlines, Voice Bubbles, Mood Glyphs. Opens via `[⚙]` button
  or `:settings` palette command. Persisted to `localStorage`. _(Lambert)_
- **Wisdom Wing** (`packages/web/src/components/WisdomWing.tsx`): overlay displaying team wisdom
  patterns (parsed from `.squad/identity/wisdom.md` format) and skill chips. Opens via `:wisdom`.
  _(Lambert)_
- **Time Scrubber** (`packages/web/src/components/TimeScrubberPanel.tsx`): slider UI for
  scrubbing the event timeline. Opens via `:scrub`. Replay logic deferred. _(Lambert)_
- **Marketplace UX** (`packages/web/src/components/MarketplacePanel.tsx` — Lambert v2 in-flight):
  plugin marketplace panel. Opens via `:marketplace`. Shows empty state or plugin cards depending
  on `.squad/plugins/marketplaces.json`. CLI install via `squad plugin install <name>`.
- **Game-mode panel** (Lambert v2 in-flight): cosmetic XP / Level / Ideas overlay. Toggle in
  Settings panel. Hard rule: cosmetic-only — game values never affect reconciler state.
- **OBS mode** (Lambert v2 in-flight): `:obs <mode>` palette command sets body background
  for streaming capture (`green-screen` / `transparent` / `dark` / `off`).
- **Skin browser** (Lambert v2 in-flight): `:skins` opens a visual skin picker.
- **Multi-attach layout** (Lambert + Parker v2 in-flight): `--attach <path>` flag (repeatable);
  web UI renders one habitat panel per root in a horizontal split.
- **New CLI subcommands**: `trace`, `why`, `inspect`, `diorama`, `aspire`.
- **New palette verbs**: `:scrub`, `:wisdom`, `:settings`, `:marketplace`, `:obs`,
  `:skins`, `:standup`, `:ralph start`, `:ralph stop`.
- **Tauri 2 native window wrapper** (`packages/squadquarium-app/`): opt-in scaffold for
  frameless/transparent native OS window. Requires Rust toolchain (https://rustup.rs/).
  `pnpm --filter squadquarium-app dev` / `build`. _(Ripley — scaffold only)_
- **VS Code webview wrapper** (`packages/squadquarium-vscode/`): opt-in VS Code extension
  wrapping the same web bundle. `pnpm --filter squadquarium-vscode build`. _(Lambert)_
- **Playwright e2e specs** for v1+v2 UI surfaces: `settings-panel.spec.ts`,
  `wisdom-wing.spec.ts`, `marketplace.spec.ts`, `game-mode.spec.ts`, `obs-mode.spec.ts`,
  `multi-attach.spec.ts`. Active tests cover Settings + Wisdom Wing; others `test.fixme()`
  pending Lambert's v2 component landing. _(Ripley)_
- **CONTRIBUTING.md** updated: prebuildify pipeline, Tauri + VS Code wrapper prereqs, new
  CLI subcommands, new palette verbs, multi-attach flag, game-mode invariant, marketplace
  workflow, updated screenshot baseline policy. _(Ripley)_

### Changed

- `CommandPalette` now handles `:trace`, `:why`, `:inspect`, `:diorama`, `:aspire`,
  `:marketplace`, `:ralph start`, `:ralph stop`. _(Lambert)_
- `AppShell` CRT mode is now derived from settings (crtBloom + crtScanlines booleans)
  rather than a standalone cycle. The `[CRT:xxx]` header button still cycles for quick
  access. _(Lambert)_
- Screenshot baseline policy extended to cover all skins × all states × all OS variants,
  deferred until v2 visuals stabilize. _(Ripley)_

---

## [0.1.0] — 2026-05-05 · v0 + v1 — "Weekend Hack"

> Alpha. Pinned to Squad 0.9.4. Built fully autonomously by Brady + the Squad team
> (Dallas, Lambert, Parker, Ripley) in one offline session.

### Added — Phase 1: Roster, charters, decisions, plan.md

- Cast the v0 roster from the Alien universe: Dallas (Lead), Lambert (Frontend),
  Parker (Backend), Ripley (Tester). Scribe + Ralph seeded but dormant.
- Wrote charters for all four active agents under `.squad/agents/{name}/charter.md`.
- Recorded all founding architectural decisions in `.squad/decisions.md` — 14 entries
  covering: Squad version pin, casting universe, pre-v0 spike order, loopback-only
  boundary, default port (6280), node-pty fallback strategy, testing strategy, CI
  strategy, sprite/visual validation, quality gate, concurrency model, event reconciler
  design, skin manifest lock, and north star.
- `plan.md` authored end-to-end (1300+ lines): product boundary, north star, form factor,
  visual style, skins, modes, activity grammar, drill-in panel, Hatcher/Scriptorium, game
  layer toggle, tech stack, testing/CI contracts, full v0/v1/v2 roadmap, risks, open
  questions. _(Dallas)_

### Added — Phase 2: Monorepo scaffold, spikes, CI

- Monorepo wired: `pnpm-workspace.yaml`, `packages/{core,web,cli}`, `skins/{aquarium,office}`,
  shared `tsconfig.base.json`, `.editorconfig`, `.prettierrc.json`, root `eslint.config.js`.
- **Spike 1 — node-pty load (Windows PASS):** `node-pty@1.1.0` built in 107ms with VS Build
  Tools. `spawnNodeVersion()` via PTY returns valid semver.
- **Spike 3 — dist/remote-ui/ bridge investigation:** `dist/remote-ui/` is a static PWA for
  Squad RC, not an event channel. `EventBus` stays the only `bus` source.
- **Spike 4 — Skin manifest schema lock (`manifestVersion: 1`):** `skins/manifest.schema.json`
  (JSON Schema draft 2020-12) locked. `additionalProperties: false` + `patternProperties: ^x-`
  extension namespace. Both stock skins validate clean. `skins/AUTHOR-CONTRACT.md` and
  `skins/validate.mjs` delivered.
- **Spike 5 — CI matrix + screenshot baseline scaffold:** `.github/workflows/ci.yml`
  (windows-latest + ubuntu-latest; macOS deferred). Per-push: `pnpm install
--frozen-lockfile` → lint → test → build → `test:web` → smoke.
- **Spike 6 — Event reconciler design + invariants:** `packages/core/src/events.ts` —
  `SquadquariumEvent` envelope, `SOURCE_PRECEDENCE` map (`bus > pty > fs > log`),
  per-entity watermark, dedupe key `(entityKey, causedBy, seq, source)`. 7 invariants green.
- Skin content: complete `sprites.json`, `habitat.json`, `vocab.json`, `tokens.css` for both
  Aquarium and Office skins. 2×7 sprite grid. 2 frames per state minimum.

### Added — Phase 3 Wave 1: Full backend + full web bundle

**CLI (`packages/cli`):**

- `squadquarium [path]` — context resolution, HTTP/WebSocket server on `127.0.0.1`
  (auto-pick port starting at 6280), browser launch via `open` package.
- `--personal` flag against Squad's standard personal location.
- `--host 0.0.0.0` hard-rejected with loopback trust-boundary error.
- `squadquarium doctor` — Node ≥ 22.5 check, `squad` on PATH, `node-pty` load, port
  availability, calls `squad doctor`, surfaces fix-up commands.
- `squadquarium status` — one-screen concise snapshot. No browser required.
- `squadquarium --headless-smoke` — boots server, waits for hello + snapshot + fs event
  roundtrip + pong, exits 0/non-zero. CI-friendly.
- Windows absolute path fix: `C:\...` paths parsed as project root, not subcommand.
- Last-opened squad root persisted in `~/.squadquarium/state.json`.

**Core (`packages/core`):**

- Squad SDK adapter facade — wraps `SquadState`, `SquadObserver` (200ms debounce),
  `EventBus` bridge. Only package that imports `@bradygaster/squad-sdk`.
- PTY pool — `node-pty` lifecycle, stream-to-WebSocket, resize events.
- Lock file — `.squad/.scratch/squadquarium.lock` with PID + start time; stale-PID
  auto-clear.
- Event reconciler wired to all four sources: bus, pty, fs (SquadObserver), log tail.
- WebSocket protocol types exported from `packages/core/src/transport/protocol.ts`.

**Web (`packages/web`):**

- React 19 + Vite 7 bundle served as static assets by the CLI's HTTP server.
- `AppShell.tsx` — resizable habitat + log panels, terminal-styled chrome, command palette.
- `HabitatPanel.tsx` — Canvas2D glyph atlas renderer, 3–4 bands, role-state inferred from
  reconciled events, ambient drift at ~12 fps.
- `LogPanel.tsx` — `xterm.js` + `@xterm/addon-fit`, read-only ambient, OSC allowlist.
- `InteractiveOverlay.tsx` — PTY modal with `[ESC]` return to ambient.
- `DrillIn.tsx` — per-agent panel: charter, live trace, history, decisions, skills.
- `CommandPalette.tsx` — vim-style `:` palette with `:skin <name>` toggle and v0 verbs.
- Skin loader — manifest v1 strict validation at runtime; glyph allowlist fallback to `▢`.
- Transport — WebSocket client with auto-reconnect, Zustand store, shared protocol types.
- PWA manifest + service worker.
- JetBrains Mono woff2 vendored. `font-feature-settings: "liga" 0`.
- Hatching/inscription rituals: `RitualInput`/`ActiveRitual` overlay in `HabitatRenderer`.
  Camera pan via CSS `translateY`, not canvas repaint. _(Lambert)_
- Self-portrait mode: `useIsSelfPortrait()` — `[ self-portrait ]` badge + augmented DrillIn
  labels when squad root parent dir is named `squadquarium`. _(Lambert)_

### Added — Phase 3 Wave 2: Hatching rituals, self-portrait, README, CHANGELOG

- **README.md**: full install/quick-start/architecture/skins/commands doc. ASCII diorama.
  Demo placeholder. _(Dallas)_
- **CHANGELOG.md**: v0/v1 entry covering all phases. _(Dallas + Ripley)_
- **plan.md audit**: v0 checklist reviewed; deferred items annotated. _(Dallas)_

### Fixed

- `doctor.ts` null-safety on Windows: `spawnSync` returns `{ stdout: null }` when command
  not found; guard with `(stdout ?? "").trim()` before string methods. _(Ripley finding)_
- ESLint + prepack-copied directories: added `**/web-dist/**` and `**/skins/**` to ESLint
  ignores; `**/web-dist` to `.prettierignore`. _(Ripley)_

### Deprecated

- `continue-on-error: true` on `pack-install-smoke` CI job — marked `# TEMP` at Spike 5.
  Flip to `false` before any npm publish attempt (Ripley owns this gate).

---

[Unreleased]: https://github.com/B-rody/squadquarium/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/B-rody/squadquarium/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/B-rody/squadquarium/releases/tag/v0.1.0
