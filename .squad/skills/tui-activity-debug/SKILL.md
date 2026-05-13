---
name: "tui-activity-debug"
description: "Surface renderer diagnostics inside the TUI activity log during startup debugging."
domain: "debugging"
confidence: "medium"
source: "earned"
triggers:
  - tui
  - terminal-kit
  - screenbuffer
  - palette
  - sprites
  - color bug
  - activity log
roles:
  - backend
  - frontend
---

## Context

Fullscreen TUIs hide stdout once the renderer takes over the terminal, so "just console.log it" is the wrong debugging tool for startup color bugs. In Squadquarium, the useful move is to push diagnostics into the activity log panel so the operator can inspect terminal detection, palette data, sprite parsing, and render attrs without leaving the app.

## Patterns

- Prefix every diagnostic line with `[DEBUG]` and append the batch after normal startup copy so the newest lines are on screen immediately.
- Snapshot both layers of terminal detection: our env-based capability probe and terminal-kit's own `terminal.appId` / `generic` / `termconfigFile` / `support` view. Color regressions often come from disagreement between those two stories.
- Log `ScreenBufferHD` creation inputs (`width`, `height`, `dst`, `x`, `y`) and explicitly note that color mode is driven by cell attrs plus terminal support, not by a special `create()` color flag.
- Summarize palette raw hex tokens, resolved color values, parsed sprite previews, and representative actor render samples so Brody can see whether fg/bg data survived parsing and attr mapping.
- Keep the diagnostic builders pure (`describePalette()`, `describeSpriteSheet()`, `Aquarium.describeDebugRender()`) so Vitest can verify the output without a real TTY session.

## Examples

- `packages/tui/src/app.ts` collects terminal capability summaries, buffer metadata, palette diagnostics, sprite diagnostics, and aquarium render samples, then writes them with `ActivityLog.addMany(...)` during `--debug` startup.
- `packages/tui/src/palette.ts` exports `describePalette()` and `formatColorValue()` so raw skin tokens and resolved ScreenBuffer attr values use one formatting path.
- `packages/tui/src/sprites.ts` exports `describeSpriteFrame()` / `describeSpriteSheet()` to show exactly what the parsed sprite frames look like, including space-as-`·` previews and discovered color tokens.

## Anti-Patterns

- Printing fullscreen renderer diagnostics only to stdout or stderr.
- Logging every frame forever instead of capturing startup state plus a representative render sample.
- Debugging color bugs from `COLORTERM` alone without checking terminal-kit's own support table.
