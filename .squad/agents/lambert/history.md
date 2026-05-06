# Project Context

- **Project:** Squadquarium — terminal-styled idle diorama wrapping bradygaster/squad.
- **User:** Brody Schulke (Brady). Windows-only host; cross-platform via CI.
- **Stack:** React 19 + Vite 7 + TypeScript 5; Canvas2D for glyph rendering; xterm.js + `@xterm/addon-fit` + `@xterm/addon-web-links` (links **off** by default); JetBrains Mono woff2 bundled; PWA manifest + service worker; CSS-only CRT effects (bloom, scanlines, optional barrel distortion).
- **My package:** `packages/web/`. Talks to `packages/core/` over a single loopback WebSocket on `127.0.0.1`.
- **Created:** 2026-05-05.

## Core Context

- **The c′ split:** habitat panel (creatures, set-dressing, ambient drift) + log panel (real Squad PTY through xterm.js, read-only in Ambient mode). Resizable, each can collapse to full-bleed. **Creatures never trespass the log panel.**
- **Bands (Aquarium default):** Top=Lead, Mood lagoon=Frontend, Engine reef=Backend, Test tank=Tester, Sunken library=Scribe, Lobby reef=Coordinator/front desk, Deep trench=Ralph (visible only when watch is running, dormant in v0), Visitor cave=`squad link` guests. v0 ships **3–4 bands** (Lead, Frontend, Backend, Scribe).
- **Sprites:** N×M grid of glyph cells; per-cell `(glyph, fg, bg, blink?)`. Animation = glyph substitution + color easing at ~12 fps. Aquarium uses literal ASCII fish (anglerfish `(°)>=<` Lead with `*` lure, seahorse Frontend, octopus Backend, pufferfish Tester puffs on red, squid Scribe). Office uses `[¤]` figures at `╔═╗` desks. Same sprite grid sizes for both so loader doesn't reflow.
- **Skin manifest v1 (LOCKED before v0):** `manifestVersion: 1`, `name`, `version`, `engineVersion`, `license` (SPDX, required), `author`, `font` (with optional bundled woff2), `palette`, `glyphAllowlist`, `capabilities`, `fallbacks`, `x-*` extension namespace.
- **Modes:** Ambient (mouse, GUI primary, terminal read-only) vs Interactive (modal — terminal takes focus, runs real Squad CLI through node-pty + xterm.js, the Coordinator's React+ink TUI renders inside the panel). ESC exits Interactive.
- **ANSI trust boundary:** hyperlinks off (opt-in with confirm dialog); OSC allowlist (cursor/title only — no clipboard, no bell-spam, no system color); no clipboard write API binding; loopback-only (CLI rejects `--host 0.0.0.0` in v0).

## Recent Updates

📌 2026-05-05 — Team cast (Alien universe). Phase 1 onboarding underway. Skin manifest schema lock is on my plate as a pre-v0 spike.

## Learnings

### 2026-05-05T22:30Z — Spike 4: Skin manifest schema lock

**Schema choices:**
- Used JSON Schema draft 2020-12. `additionalProperties: false` + `patternProperties: { "^x-": {} }` correctly allows only `x-*` extensions — in draft 2020-12 `additionalProperties` does not apply to properties matched by `patternProperties`, so this works without needing `unevaluatedProperties`.
- `manifestVersion: const 1` (integer) as a schema version discriminant. The engine reads this first to route to the correct parser. Integer preferred over string to avoid `"1"` vs `"1.0"` ambiguity.
- `glyphAllowlist` uses `contains: { const: " " }` to enforce the space-must-be-present invariant — elegant, zero custom keywords.
- `capabilities` uses an `enum` on items (not freeform string) because unknown capabilities could activate unimplemented engine branches. Runtime leniency (engine ignores unknowns) is separate from schema strictness.
- `engineVersion` is a plain string (npm semver range). No bespoke constraint object — the semver package handles it.

**Glyph allowlist gotchas:**
- Include `▢` (U+25A2) in the allowlist explicitly — if the fallback glyph itself is not allowed, you get recursive warnings.
- Backslash `\` in JSON must be escaped as `"\\"`. The octopus tentacle `\` glyph appears as `"\\"` in sprites.json and `"\\"` in the glyphAllowlist array.
- `·` (middle dot U+00B7) and `.` (full stop U+002E) are different code points. Track them separately in the allowlist.
- `═` (U+2550 box double horizontal) and `─` (U+2500 box light horizontal) are different. The aquarium uses `═`; the office habitat uses both. Each skin's allowlist must include only what that skin uses.

**Sprite grid metric chosen:**
- 2 rows × 7 cols (6-char fish body + 1 padding). This accommodates `(°)>=<` (6 chars) with the `*` lure on row 0, and office `╔═╗` desk + `[¤]` figure in the same grid. Both skins share the grid so the loader never reflows.
- 2 frames per state (minimum for visible animation at ~12 fps).

**JetBrains Mono cell width assumption:**
- At 14px: ~9px wide × ~18px tall per cell (measured). tokens.css placeholder values match this. Engine overwrites via `measureText` before first render. Authors must not hard-code layout math against placeholder values.

**Parker's placeholder files:**
- Parker created manifest.json placeholders that were already valid against my schema (schema was designed to accept them). I updated both manifests to add: complete glyphAllowlist covering all sprite/habitat glyphs, proper fallbacks, author URL, font.asset, version bump 0.0.1→0.1.0, and x-skin-notes extension.
- sprites.json, habitat.json, vocab.json, tokens.css were empty `{}` / empty CSS — replaced entirely with full content.


### 2026-05-05T22:30Z — Phase 3 Wave 2: Ritual layer, self-portrait, status fix

**Ritual layer design:**
- Extracted `detectRitualEvent(event, knownAgents, knownSkills)` as a pure function from the store so it can be unit-tested without a React rendering harness. The hook `useRitualEvents()` wraps it with snapshot-seeded baseline sets and `processedCountRef` to process only newly-arrived events each effect run.
- `HabitatRenderer.playRitual(ritual)` adds `ActiveRitual` objects tracked by `Date.now()`. Each render frame, expired rituals are pruned and active ones draw a time-progressed glyph overlay in `renderRitualOverlay()`. Camera pan uses an `onCameraPan` callback that HabitatPanel maps to a CSS `translateY` transition on the container div — zero canvas repaint.
- Aquarium sequence: `·` → `o` → `O` → `(O)` → `(°)` → `(°)>=<` (6-step, accent → alert). Office agent-hatched: desk `╔═╗` brightens + `[¤]` walks on. Inscription: `░` → `▒` → `▓` → `█` (aquarium) / `▄▄▄` → `███` (office).
- Graceful no-op when no band matches the ritual's role.

**Self-portrait detection:**
- `useIsSelfPortrait()` splits `connection.squadRoot` on `/` and `\`, takes `parts[parts.length - 2]` (the repo dirname, parent of `.squad`), and compares case-insensitively to `"squadquarium"`. Zero ambiguity on this repo.
- Added `charterVoice?: string` to `AgentSummary` in the protocol and transport layer. `parseVoiceFromCharter()` in the adapter finds the first non-empty, non-heading line in the `## Voice` section. DrillIn shows it as italic accent text under "about this agent".

**Status display fix:**
- `parseAgentStatus(raw)` maps emoji-prefixed team.md status column values to `"active"` / `"dormant"` / `"retired"` / `"unknown"`. Exported from `@squadquarium/core` so CLI and test code can use it. Existing adapter.test.ts updated to use real-format status values.
- `parseVoiceFromCharter()` also exported — enables future tooling that wants to extract agent voice lines without loading a full charter.

**Validation:**
- `pnpm lint` — clean
- `pnpm -r build` — clean
- `pnpm -r test` — all 3 packages pass (core: 15+2 skipped, cli: 10 new status tests pass, web: 24 including 8 new ritual tests)
- HTTP smoke (`curl http://127.0.0.1:6280/`) — HTML contains "squadquarium"
- `--headless-smoke` — `{"ok":true}` exit 0

**Implementation decisions:**

- Added the web runtime dependencies for Zustand state, xterm.js terminal rendering, resizable panels, and static skin copying. Core now exports the shared WebSocket protocol types from `transport/protocol`.
- Served skins from `/skins/<name>/...` in both dev and build: Vite dev uses a local middleware, while production copies the workspace `skins` directory into `dist/skins`.
- Kept skin loading strict at runtime: manifest v1 requires the locked fields, palette hex tokens, and a space in `glyphAllowlist`; invalid manifests surface a visible load error and set `window.__squadquarium.skinManifestValid` for tests.
- Rendered habitat sprites on a glyph atlas Canvas2D path with allowlist fallback to `▢`; ambient drift runs at 12 fps and role state is derived from recent reconciled events.
- Kept the log terminal read-only in ambient mode. Interactive PTY mode is modal, toggles stdin only while active, exits via ESC, and intentionally does not load WebLinksAddon.
- Added the v0 PWA affordance (manifest + service worker) and vendored JetBrains Mono woff2 so glyph metrics are stable offline.
- Fixed Windows validation blockers in the CLI while running the full repo suite: absolute `C:\...` paths are parsed as root paths rather than subcommands, help exits 0, and shutdown terminates open WebSocket clients cleanly.

**Validation:**

- `pnpm install`
- `pnpm -r build`
- `pnpm -r test`
- `pnpm lint`
