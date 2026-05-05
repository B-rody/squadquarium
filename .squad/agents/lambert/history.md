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

(empty — to be populated by my work)
