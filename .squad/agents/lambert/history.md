# Project Context

- **Project:** Squadquarium — terminal-styled idle diorama wrapping bradygaster/squad.
- **User:** Brody Schulke (Brody). Windows-only host; cross-platform via CI.
- **Stack:** React 19 + Vite 7 + TypeScript 5; Canvas2D for glyph rendering; xterm.js + @xterm/addon-fit + @xterm/addon-web-links (links **off** by default); JetBrains Mono woff2 bundled; PWA manifest + service worker; CSS-only CRT effects (bloom, scanlines, optional barrel distortion).
- **My package:** packages/web/. Talks to packages/core/ over a single loopback WebSocket on 127.0.0.1.
- **Created:** 2026-05-05.

## Core Context

- **The c′ split:** habitat panel (creatures, set-dressing, ambient drift) + log panel (real Squad PTY through xterm.js, read-only in Ambient mode). Resizable, each can collapse to full-bleed. **Creatures never trespass the log panel.**
- **Bands (Aquarium default):** Top=Lead, Mood lagoon=Frontend, Engine reef=Backend, Test tank=Tester, Sunken library=Scribe, Lobby reef=Coordinator/front desk, Deep trench=Ralph (visible only when watch is running, dormant in v0), Visitor cave=squad link guests. v0 ships **3–4 bands** (Lead, Frontend, Backend, Scribe).
- **Sprites:** N×M grid of glyph cells; per-cell (glyph, fg, bg, blink?). Animation = glyph substitution + color easing at ~12 fps. Aquarium uses literal ASCII fish (anglerfish (°)>=< Lead with * lure, seahorse Frontend, octopus Backend, pufferfish Tester puffs on red, squid Scribe). Office uses [¤] figures at ╔═╗ desks. Same sprite grid sizes for both so loader doesn't reflow.
- **Skin manifest v1 (LOCKED before v0):** manifestVersion: 1, 
ame, ersion, ngineVersion, license (SPDX, required), uthor, ont (with optional bundled woff2), palette, glyphAllowlist, capabilities, allbacks, x-* extension namespace.
- **Modes:** Ambient (mouse, GUI primary, terminal read-only) vs Interactive (modal — terminal takes focus, runs real Squad CLI through node-pty + xterm.js, the Coordinator's React+ink TUI renders inside the panel). ESC exits Interactive.
- **ANSI trust boundary:** hyperlinks off (opt-in with confirm dialog); OSC allowlist (cursor/title only — no clipboard, no bell-spam, no system color); no clipboard write API binding; loopback-only (CLI rejects --host 0.0.0.0 in v0).

## Recent Updates

📌 2026-05-06T19:17 — **TUI-FIRST PIVOT LIVE.** You completed TUI library research (lambert-tui-library-research.md → decisions.md). Dallas finalized parallel architecture decision. Library choice: **terminal-kit** (mouse, truecolor, ScreenBuffer, animation-capable). Architectural call: custom sprite compositor + manual pane geometry (Yoga optional v1+). **v0 vs v1 cut:** TUI ships v0 (fullscreen, animated, truecolor, mouse on input), web dashboard dropped entirely per user directive. Your next task: aquarium sprite renderer implementation against terminal-kit ScreenBuffer. Proof-of-concept TypeScript sketch is in your research doc.

📌 2026-05-06 — **Repo is now public.** Coordinator made visibility change via gh repo edit. Three-layer safety defence adopted (husky + agent docs pre-push gate + CI). Dallas authored .github/copilot-instructions.md with Pre-Push Validation Gate section; remember to run pnpm lint && pnpm -r build && pnpm -r test before pushing from cloud environments.

📌 2026-05-05 — Team cast (Alien universe). Phase 1 onboarding underway. Skin manifest schema lock is on my plate as a pre-v0 spike.

## Learnings

### 2026-05-06T19:04:47-07:00 — TUI library research

**Renderer decision notes:**
- For a Windows-first animated TUI, 	erminal-kit is the strongest practical base: real mouse input, truecolor, off-screen buffers, and direct frame-loop control fit our 2×7 glyph sprites better than React-first CLI frameworks.
- Ink remains the safest React/Yoga option for keyboard-driven CLI chrome, but its lack of first-class mouse support is a hard blocker for clickable habitat elements.
- Glyph is the most interesting new entrant worth watching, but it is still too early to trust as the primary Windows renderer for a solo-dev product path.

**Terminal frontier notes:**
- Modern terminals now reliably give us truecolor, OSC 8, synchronized output, and strong keyboard/mouse protocol support; that is enough to make rich glyph-native animation feel premium without depending on raster images.
- Sixel and other image protocols are useful optional enhancements, but Squadquarium should treat them as capability-gated flourishes, not as the foundation of the aquarium renderer.

**Archive note:** Earlier learning entries (Spike 4: skin manifest, Phase 3 Wave 2: ritual/status, Phase 5/6 Wave 2: reach slice) are preserved in history-archive.md due to size threshold.
### 2026-05-06T19:17:29-07:00 — Aquarium renderer and animation engine

- Built `packages/tui` sprite plumbing around the locked skin format: validated sprite-sheet loading, palette token resolution, actor state/drift timing, and an `Aquarium` renderer that paints the aquarium skin onto `terminal-kit` `ScreenBufferHD` buffers.
- Wired the TUI app to the new aquarium scene so the headless smoke path and package tests now render real aquarium actors instead of placeholder strings; clicks hit-test actors and kick them into `celebrate`.
- Kept chrome and layout terminal-native: Unicode borders/separators, inverse status bar copy, and a tested 60/40-ish pane geometry that stays compatible with the new TUI package build/test gate.
