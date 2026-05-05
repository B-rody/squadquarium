# Project Context

- **Project:** Squadquarium — terminal-styled idle diorama wrapping bradygaster/squad.
- **User:** Brody Schulke (Brady). Solo dev + designer. **Windows-only host**; cross-platform validated in CI.
- **Stack:** TypeScript everywhere, pnpm 10.33.3 workspace, React 19 + Vite 7, Canvas2D, node-pty + xterm.js, `@bradygaster/squad-sdk` pinned to `0.9.4`, Node ≥ 22.5.
- **Repo layout:** `packages/{core,web,cli}` + `skins/{aquarium,office}` + `.squad/` (this team).
- **Created:** 2026-05-05.

## Core Context

- **My role:** Lead. I own scope, plan.md, and the architectural-review escalation lane. I do not write renderer or SDK code; I review and route.
- **The cut for v0:** the smallest thing that proves a glyph diorama reflects real Squad team activity. Two skins (Aquarium polished + Office intentionally minimal — the *schema* is the v0 deliverable, not Office polish). c′-split layout (habitat panel + log panel + terminal-styled chrome). Interactive mode delegates to the Coordinator via PTY.
- **Hard rules I enforce:** Squadquarium reads `.squad/` and never writes; mutations go through the Squad CLI via PTY. Loopback-only (127.0.0.1). `.squad/.scratch/squadquarium.lock` for any UI flow that nudges the Coordinator to mutate. Skin manifest schema **locks** before v0 ships.
- **Reviewer protocol:** Ripley owns strict-lockout reviews. Engineer A's PR rejected → engineer B fixes (or new specialist). Same author may not self-revise.

## Recent Updates

📌 2026-05-05 — Team cast (Alien universe). Phase 1 onboarding underway. Pre-v0 spikes next.

## Learnings

(empty — to be populated by my work)
