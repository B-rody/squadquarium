# Lambert — History Archive

Archive of older learning entries from `history.md`. These represent completed work phases that remain technically relevant but are no longer active focus areas.

---

## 2026-05-05T22:30Z — Spike 4: Skin manifest schema lock

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

---

## 2026-05-05T22:30Z — Phase 3 Wave 2: Ritual layer, self-portrait, status fix

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

---

## 2026-05-06T03:51:00Z — Phase 5/6 Wave 2: Reach slice (Parts 1–7)

**Part 1 — Time-scrubber replay:**
- Wired `TimeScrubberPanel` to `snapshot.logTail` as replay substitute (Parker's `replay` frame not yet in 0.9.4). Graceful degrade: `console.warn` fires once. `setScrubbing(true/false)` pauses/resumes live event ingestion in the transport store. "● live" button at slider right edge returns to live mode. On unmount, `setScrubbing(false)` ensures ingestion resumes.

**Part 2 — Marketplace panel:**
- `<MarketplacePanel />` wired to WS frames (`marketplace-list-req`, `browse-req`, `install-req`). Shows per-plugin install status (idle/installing/done/error), output, and `from:{marketplace}` citation tag. Empty state with copyable CLI hint. `:marketplace` palette command opens it. Scriptorium inscription animation deferred (Wisdom Wing prop extension needed).

**Part 3 — Game mode:**
- `packages/web/src/game/store.ts`: pure `deriveGameState` function + `buildStandupEntries`, with cosmetics-only invariant enforced by comment block. `<GamePanel />` shows XP/level bar, skill tree, achievements, ideas counter (idle accrual at +1/min when ralph active), inventory, daily quest, boss fight, stand-up modal. 18 Vitest cases in `game.test.ts` enforce the isolation invariant.

**Part 4 — Multi-attach:**
- `enableMultiAttach` setting added. AppShell splits habitat panel horizontally when `enableMultiAttach && snapshot.attachedSquads.length > 1` (Parker adds `attachedSquads` to Snapshot). Falls back to single-squad rendering. Log panel tabs deferred.

**Part 5 — OBS mode:**
- `obsMode: 'off' | 'transparent' | 'chroma-green' | 'chroma-magenta'` in AppSettings. AppShell applies `document.body.style.background` override. `:obs <mode>` palette command. Status bar badge. 7 Vitest cases in `obsMode.test.ts`.

**Part 6 — Community skin packs:**
- `<SkinBrowser />` via `:skins` command. Local skins + 4 placeholder community packs (deep-trench, cottage-village, space-station, fungus-colony) marked `[available v2.x]`. Install stub → confirm dialog with copyable CLI hint. Manifest schema: typed `^x-signature$` patternProperty (Ed25519 base64url). `AUTHOR-CONTRACT.md`: "Future: Signed manifest verification" section added.

**Part 7 — Visiting agents animation:**
- `detectVisitorArrival()` + `useVisitorArrivals()` in `transport/store.ts`. `<VisitorAnimation />` overlay with Aquarium whaleshark dock glyph sequence and Office truck glyph. Guest sprite `(guest) {name}` appears at frame 3 and fades at 3s. Debug helper `window.__squadquarium__.__triggerVisitor(name)` registered in AppShell.

**Tactical notes:**
- Transport store `isScrubbing` flag is a clean hook: `appendEvent` early-returns when scrubbing, with no other changes to the event pipeline.
- Game store is a module-scoped pure function, NOT a Zustand store — this keeps the isolation unambiguous and testable. The cosmetics-only invariant is enforced by import graph structure, not just convention.
- The `window.__squadquarium__.__triggerVisitor` debug helper is registered in AppShell's mount effect — it dispatches directly to the store's `appendEvent`, which routes through the existing `useVisitorArrivals` hook for zero additional testing surface.
- Manifest schema's `x-signature` uses a separate `patternProperties` key so future schema validation tools can type-check it while remaining invisible to the engine (all `x-*` keys are ignored at runtime).
