# `@squadquarium/web` — web UI package

> Owner: Lambert (Frontend Engineer)
> Reviewer: Ripley (Tester / Reviewer)

`@squadquarium/web` is the React 19 + Vite 7 + TypeScript 5 front-end that
renders the terminal-styled diorama in the browser. It subscribes to the
WebSocket bridge exposed by the CLI (via `@squadquarium/core`) and renders the
live Squad team state as an animated ASCII aquarium or office-floor grid,
depending on the active skin. The package owns the skin loader (reads
`manifest.json`, validates against the v1 JSON Schema, applies CSS custom
property palette tokens), the glyph renderer (integer-aligned cell grid,
glyph allowlist enforcement, `▢` fallback for missing glyphs), and the
Interactive-mode focus overlay. This package is not published to npm; it is
compiled to `dist/` by Vite and bundled into the `squadquarium` CLI package.
The Playwright e2e suite lives at `test/e2e/` and is owned by Ripley.
