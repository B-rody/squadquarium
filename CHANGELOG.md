# Changelog

All notable changes to Squadquarium are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning: [Semantic Versioning](https://semver.org/).

---

## [Unreleased] — v0.1.0 · 2026-05-05

> Alpha. Pinned to Squad 0.9.4. Built fully autonomously by an offline Brady + the Squad team (Dallas, Lambert, Parker, Ripley) in one session.

### Phase 1 — Roster, charters, decisions, plan.md

- Cast the v0 roster from the Alien universe: Dallas (Lead), Lambert (Frontend), Parker (Backend), Ripley (Tester). Scribe + Ralph seeded but dormant.
- Wrote charters for all four active agents under `.squad/agents/{name}/charter.md`.
- Recorded all founding architectural decisions in `.squad/decisions.md` — 14 entries covering: Squad version pin, casting universe, pre-v0 spike order, loopback-only boundary, default port (6280), node-pty fallback strategy, testing strategy, CI strategy, sprite/visual validation, quality gate, concurrency model, event reconciler design, skin manifest lock, and north star.
- `plan.md` authored end-to-end (1300+ lines): product boundary, north star, form factor, visual style, skins, modes, activity grammar, drill-in panel, Hatcher/Scriptorium, game layer toggle, tech stack, testing/CI contracts, full v0/v1/v2 roadmap, risks, open questions.

### Phase 2 — Monorepo scaffold, spikes, CI

- Monorepo wired: `pnpm-workspace.yaml`, `packages/{core,web,cli}`, `skins/{aquarium,office}`, shared `tsconfig.base.json`, `.editorconfig`, `.prettierrc.json`, root `eslint.config.js`.
- **Spike 1 — node-pty load (Windows PASS):** `node-pty@1.1.0` built clean in 107ms with VS Build Tools. `spawnNodeVersion()` via PTY returns valid semver. Cross-platform deferred to CI matrix.
- **Spike 3 — dist/remote-ui/ bridge investigation:** `dist/remote-ui/` is a static PWA for Squad RC, not a structured event channel. `RemoteBridge` is for remote control (client→server), not activity monitoring (server→client). EventBus stays the only `bus` source. No plan.md amendment needed.
- **Spike 4 — Skin manifest schema lock (`manifestVersion: 1`):** `skins/manifest.schema.json` (JSON Schema draft 2020-12) locked. `additionalProperties: false` + `patternProperties: ^x-` extension namespace. `glyphAllowlist` space invariant enforced with `contains: { const: " " }`. Both stock skins validate clean. `skins/AUTHOR-CONTRACT.md` and `skins/validate.mjs` delivered.
- **Spike 5 — CI matrix + screenshot baseline scaffold:** `.github/workflows/ci.yml` (windows-latest + ubuntu-latest; macOS deferred). Per-push: `pnpm install --frozen-lockfile` → lint → test → build → `test:web` → smoke. Pack-install-smoke job with `continue-on-error: true` (`# TEMP`) until CLI pack target lands. `playwright.config.ts` with per-OS baselines at `packages/web/test/e2e/__screenshots__/`.
- **Spike 6 — Event reconciler design + invariants:** `packages/core/src/events.ts` — `SquadquariumEvent` envelope, `SOURCE_PRECEDENCE` map (`bus > pty > fs > log`), per-entity watermark, dedupe key `(entityKey, causedBy, seq, source)`. 7 invariants green in `packages/core/test/events.test.ts`.
- Stub argv parser for `packages/cli` (Phase 2 scaffold). Full server lands in Phase 3 Wave 1.
- Skin content authored: complete `sprites.json`, `habitat.json`, `vocab.json`, `tokens.css` for both Aquarium and Office skins. 2×7 sprite grid (accommodates `(°)>=<` and `[¤]` in same loader). 2 frames per state minimum.

### Phase 3 Wave 1 — Full backend + full web bundle

**CLI (`packages/cli`):**

- `squadquarium [path]` — context resolution (cwd walk-up → personal → last-opened → empty-state via `resolveSquad()` + `resolvePersonalSquadDir()`), HTTP/WebSocket server on `127.0.0.1` (auto-pick port starting at 6280), browser launch via `open` package.
- `--personal` flag against Squad's standard personal location.
- `--host 0.0.0.0` hard-rejected with loopback trust-boundary error.
- `squadquarium doctor` — Node ≥ 22.5 check, `squad` on PATH, `node-pty` load, port availability, calls `squad doctor` for squad-side checks, surfaces fix-up commands.
- `squadquarium status` — one-screen concise snapshot (agents, last decision, last bus event). No browser required.
- `squadquarium --headless-smoke` — boots server, waits for `hello` + `snapshot` + filesystem event roundtrip + `pong`, exits 0/non-zero. CI-friendly.
- Windows absolute path fix: `C:\...` paths parsed as project root, not subcommand.
- Help exits 0. Shutdown terminates open WebSocket clients cleanly.
- Last-opened squad root persisted in `~/.squadquarium/state.json`.

**Core (`packages/core`):**

- Squad SDK adapter facade (`packages/core/src/squad/`) — wraps `SquadState`, `SquadObserver` (200ms debounce), `EventBus` bridge. Only package that imports `@bradygaster/squad-sdk`.
- PTY pool (`packages/core/src/pty/`) — `node-pty` lifecycle, stream-to-WebSocket, resize events.
- Lock file (`packages/core/src/lock/`) — `.squad/.scratch/squadquarium.lock` with PID + start time; stale-PID auto-clear.
- Event reconciler wired to all four sources: bus, pty, fs (SquadObserver), log tail.
- WebSocket protocol types exported from `packages/core/src/transport/protocol.ts` (shared with web bundle).

**Web (`packages/web`):**

- React 19 + Vite 7 bundle served as static assets by the CLI's HTTP server.
- `AppShell.tsx` — c′ split layout: resizable habitat + log panels, terminal-styled chrome (double-line border), command palette (`:` key).
- `HabitatPanel.tsx` — Canvas2D glyph atlas renderer, 3–4 bands (Lead, Frontend, Backend, Scribe), role-state inferred from reconciled events, ambient drift at ~12 fps.
- `LogPanel.tsx` — `xterm.js` + `@xterm/addon-fit`, read-only in Ambient mode, no `WebLinksAddon`, OSC allowlist applied.
- `InteractiveOverlay.tsx` — PTY modal: switches log panel to stdin-enabled PTY session, `[ESC]` returns to ambient. Coordinator's React+ink TUI renders inside.
- `DrillIn.tsx` — per-agent drill-in panel: charter, live trace, history, decisions, matched skills.
- `CommandPalette.tsx` — vim-style `:` palette with `:skin <name>` toggle.
- Skin loader (`packages/web/src/skin/loader.ts`) — manifest v1 strict validation at runtime; invalid manifests surface visible load error and set `window.__squadquarium.skinManifestValid` for test assertions. Glyph allowlist fallback to `▢`.
- Transport (`packages/web/src/transport/`) — WebSocket client with auto-reconnect, Zustand store, shared protocol types.
- Skins served from `/skins/<name>/…` in both dev (Vite middleware) and production (`dist/skins/` copied at build time).
- PWA manifest (`packages/web/public/manifest.webmanifest`) + service worker (`packages/web/public/sw.js`) — "Install app" affordance in modern browsers.
- JetBrains Mono woff2 vendored for stable glyph metrics offline. `font-feature-settings: "liga" 0`.
- Glyph allowlist enforced at render time; missing glyphs render `▢` with dev-console warning.

### Phase 3 Wave 2 — Hatching rituals, self-portrait, npm pack dry run, README

- **README.md** (this entry): full install/quick-start/architecture/skins/commands documentation at repo root. Demo ASCII diorama. Dogfood + contributing instructions. _(Dallas — Lead)_
- **CHANGELOG.md** (this file): v0 entry covering all four phases. _(Dallas — Lead)_
- **plan.md audit**: v0 checklist reviewed and updated against actual on-disk files. Deferred items annotated. _(Dallas — Lead)_
- `SquadObserver`-driven hatching/inscription rituals _(deferred — Lambert Wave 2 not yet landed; see plan.md)_
- `npm publish` dry run + cross-platform smoke _(deferred — Ripley Wave 2 not yet landed; see plan.md)_
- Self-portrait mode _(deferred — Lambert Wave 2 not yet landed; see plan.md)_

---

[Unreleased]: https://github.com/B-rody/squadquarium/compare/HEAD...HEAD
