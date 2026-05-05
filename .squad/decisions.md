# Squad Decisions

## Active Decisions

### 2026-05-05T22:30Z — North star: ambient-by-default, drill-in on demand, CLI parity
**By:** Dallas (via Coordinator) — distilled from `plan.md` "North star"
**What:** Squadquarium is ambient by default (zero required interaction; glanceable from across a room), drill-in on demand, CLI-parity for management actions, optional cosmetic-only game layer, local-first (no network calls except those Squad itself makes).
**Why:** This is the design north star — every v0 trade-off resolves toward it. Logged here so future agents bind to it directly without re-reading 1300 lines of plan.md.

### 2026-05-05T22:30Z — Squad version pin: 0.9.4
**By:** Dallas (via Coordinator) — confirmed `squad --version` = 0.9.4 on host
**What:** `packages/core/package.json` declares `peerDependencies` and `engines.squad` against `0.9.4`. Newer Squad releases require a port window: re-run pre-v0 spikes (especially xterm + ink + remote-ui) before bumping.
**Why:** Squad is alpha; CHANGELOG warns of breaking changes. Pin per release is the documented mitigation in plan.md → Risks → "Squad is alpha."

### 2026-05-05T22:30Z — Casting universe: Alien
**By:** Dallas (via Coordinator)
**What:** v0 roster cast from the Alien universe (capacity 8): Dallas (Lead), Lambert (Frontend), Parker (Backend), Ripley (Tester). Scribe + Ralph are exempt per casting policy. Recorded in `.squad/casting/registry.json` and `.squad/casting/history.json`.
**Why:** Small-crew + isolated-vigilance tone matches a weekend-hack scope with an independent reviewer. Ripley reads naturally as the Tester — careful, "is this actually working?" voice — which is the autonomous-build linchpin.

### 2026-05-05T22:30Z — Pre-v0 spike order (gates, not parallel tracks)
**By:** Dallas + Parker (via Coordinator) — distilled from `plan.md` "Pre-v0 spikes"
**What:** Spikes run in this order (each can rescope v0):
  1. `node-pty` cross-platform load — Win/macOS/Linux via the CI matrix (Brady is Windows-only locally).
  2. xterm.js + Squad ink TUI compatibility (highest-uncertainty technical risk; Squad ships `patch-ink-rendering.mjs`).
  3. `dist/remote-ui/` bridge investigation — confirm whether a structured channel exists; if yes, becomes a fifth event source between `bus` and `pty`.
  4. Skin manifest schema lock at `manifestVersion: 1`.
  5. Cross-platform glyph render-diff test in CI.
  6. Event reconciler design + invariants (`packages/core/events.ts`) — implemented and tested before any UI work.
**Why:** Each spike can invalidate the v0 plan; running them as parallel tracks means we discover invalidation after the UI is wired. Sequential is correct.

### 2026-05-05T22:30Z — Source of truth for Squad state: `.squad/` is read-only from Squadquarium
**By:** Dallas (via Coordinator) — restated from `plan.md` "Product boundary" and "Concurrency model"
**What:** Squadquarium reads `.squad/` continuously and never writes to it directly. All mutations flow through Squad's Coordinator (PTY) or the `squad` CLI. The single-flow lock at `.squad/.scratch/squadquarium.lock` exists for any UI flow that nudges the Coordinator to mutate `.squad/`.
**Why:** Keeps Squad as the single source of truth and prevents Squadquarium from drifting into "a parallel Squad" — the Product Boundary hard rule.

### 2026-05-05T22:30Z — Default port: auto-pick (default 6280)
**By:** Parker (via Coordinator)
**What:** The CLI's HTTP server picks an open port starting at 6280 and incrementing on collision (Vite-style). Not Squad's 6277 (reserved for the SDK's WS bridge).
**Why:** Avoids collision with Squad's own bridge port. Multi-instance side-by-side is a v2 stretch; v0 = two independent Squadquarium instances on auto-picked ports.

### 2026-05-05T22:30Z — Loopback only (127.0.0.1) — `--host 0.0.0.0` rejected in v0
**By:** Parker + Dallas (via Coordinator) — restated from `plan.md` "ANSI trust boundary"
**What:** The CLI binds the HTTP / WebSocket server to `127.0.0.1`. `--host 0.0.0.0` is rejected with a clear error pointing at the README's trust-boundary section.
**Why:** Without same-origin policy and authentication (deferred to v1+), loopback-only is the only safe binding.

### 2026-05-05T22:30Z — Testing strategy
**By:** Ripley + Dallas (via Coordinator)
**What:**
  - **Vitest 2.x** for `packages/core` and `packages/cli` — engineers (Lambert/Parker) write unit tests for their own code; Ripley owns the cross-cutting integration suite.
  - **Playwright 1.x** for `packages/web` — glyph-grid invariants, palette token assertions, manifest-schema compliance, ANSI trust boundary, Interactive-mode focus toggle, screenshot baselines per skin per state per OS at 1× and 2× DPI.
  - Tester reviews engineers' PRs before commits land. Reviewer-rejection lockout is strict.
  - Goldens stored at `packages/web/test/__screenshots__/{skin}/{state}/{os}-{dpi}.png`. Updated only via explicit `pnpm test:web -u` from a clean run; CI never auto-updates.
**Why:** Brady is offline. Without an independent verification owner with teeth, regressions accumulate silently. Tester is the autonomous-build linchpin (recorded in `team.md` already; this is the contract).

### 2026-05-05T22:30Z — CI strategy
**By:** Ripley + Parker (via Coordinator)
**What:**
  - **GitHub Actions matrix** — `windows-latest` (Brady's only local platform), `macos-latest`, `ubuntu-latest`. Node 22.5 + Node 24 (current host).
  - **Per-push job:** `pnpm install --frozen-lockfile` → `pnpm lint` → `pnpm test` (Vitest workspace-wide) → `pnpm build` → `pnpm test:web` (Playwright on each OS) → `pnpm smoke` (`squadquarium --headless-smoke` on each OS).
  - **Pack-and-install smoke (release-candidate trigger):** `pnpm pack` → `npm install -g <tarball>` → `squadquarium --headless-smoke` on each OS runner. This is the `node-pty` cross-platform validation.
  - All jobs upload Playwright screenshot diffs as artifacts on failure.
**Why:** Brady develops on Windows only; cross-platform claims must be machine-verified, not asserted. Plan.md's pre-v0 spike for `node-pty` install only makes sense as a CI matrix.

### 2026-05-05T22:30Z — Sprite/visual validation
**By:** Ripley + Lambert (via Coordinator)
**What:**
  - **Playwright screenshot baselines** for each skin × each band-state combination, captured per OS at 1× and 2× DPI.
  - **Glyph-grid invariants:** asserted programmatically (cell-row alignment, integer cell offsets for drift, palette tokens used not raw colors, font-feature-settings disabling ligatures).
  - **Manifest schema compliance:** every skin's `manifest.json` validated against the v1 JSON Schema in CI.
  - **Glyph allowlist enforcement:** rendered text whitelisted against the active skin's `glyphAllowlist`; missing glyphs render `▢` and emit a dev-console warning. Both behaviors tested.
  - **v0 deliverable** — gating the Aquarium and Office skin shipping checkpoints.
**Why:** Without render-diff CI, "sprites break in Linux Chromium" turns into a v2 community-pack PR-rejection spiral. Plan.md flags this explicitly.

### 2026-05-05T22:30Z — Quality gate per commit
**By:** Ripley (via Coordinator)
**What:** Every commit must satisfy `pnpm lint && pnpm test && pnpm build && pnpm smoke` green before it lands. Tester (Ripley) enforces. Reviewer-rejection lockout: rejected PR → original author cannot revise; Coordinator routes the fix to a different engineer or escalates to Dallas. Recursively applies if the revision is also rejected.
**Why:** Autonomous build with no human gate makes the per-commit bar the only gate. "Will fix in next commit" is a failure mode we cannot afford while Brady is offline.

### 2026-05-05T22:30Z — `node-pty` install fallback chosen: option (a)
**By:** Parker + Dallas (via Coordinator)
**What:** If `npm install -g squadquarium` fails to build `node-pty` on a target OS, ship a no-PTY fallback for v0: read-only log tail of `orchestration-log/` and `log/` instead of live `squad watch`. Interactive mode is deferred to v1 on that platform. `squadquarium doctor` surfaces the situation with a copyable fix-up command (build-tools install instructions per OS).
**Why:** Plan.md "Open questions" already names (a) as the v0-friendly answer; (b) `prebuildify` is v1 polish; (c) a child-process line scrape is an architectural pivot we don't have time for.

### 2026-05-05T22:30Z — Sprite flavor: literal ASCII fish (Aquarium) / `[¤]` figures (Office)
**By:** Lambert + Dallas (via Coordinator)
**What:** Aquarium skin uses literal ASCII creatures exactly as plan.md describes (anglerfish `(°)>=<` Lead with `*` lure, seahorse Frontend, octopus Backend, pufferfish Tester puffs on red, squid Scribe). Office skin uses `[¤]` figures at `╔═╗` desks. Same sprite grid sizes for both.
**Why:** Plan.md describes the literal flavor in detail; abstract phosphor-pond is a v1+ stretch that the skin manifest separation makes cheap to swap in later.

### 2026-05-05T22:30Z — Naming: Hatchery (agents) + Scriptorium (skills) + Hatcher (sub-agent)
**By:** Dallas (via Coordinator)
**What:** Use these names throughout. Skin `vocab.json` handles label swaps at render time if Brady wants alternates later.
**Why:** Plan.md uses these names throughout; alternates (Bestiary/Codex; Pond/Library; Nursery/Atelier) are speculative.

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction


