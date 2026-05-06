# Questions for Brady

> Append-only log of decisions made under the **No-Ask Rule** during the autonomous v0 build (kickoff: 2026-05-05T22:30Z).
>
> Format per entry: question / chosen assumption / rationale / reversibility.
> If Brady disagrees later, the choice is reversible because it was logged here and in `.squad/decisions.md`.

---

## 2026-05-05T22:30Z — Casting universe

**Question:** Which universe should the v0 roster draw from?

**Chosen assumption:** **Alien**. Names: Dallas (Lead), Lambert (Frontend), Parker (Backend), Ripley (Tester).

**Rationale:** Small-crew (8 capacity) isolated-vigilance universe matches a weekend-hack scope with a single independent reviewer. Ripley reads naturally as the careful "is this actually working?" Tester voice that the autonomous build pivots on. Coherent sci-fi tone aligns with the terminal aesthetic without leaking literal role descriptions.

**Reversibility:** Trivial — `squad` casting registry can be rewritten and agent folders renamed. Charters are voice-styled but not character-impersonating; rename is mechanical.

---

## 2026-05-05T22:30Z — Tester voice strictness

**Question:** How adversarial should Ripley be? Light "nice-to-have" reviews or strict gatekeeper?

**Chosen assumption:** **Strict.** Ripley enforces the per-commit quality gate (lint + test + build + launch-smoke green) and exercises the reviewer-rejection lockout when an engineer's PR fails. No commit lands without sign-off.

**Rationale:** Brady is offline; the only safety net for "is this actually working?" is the Tester. Soft Tester → silent regressions accumulate while Brady can't catch them. Better to over-rotate on rigor while autonomous.

**Reversibility:** Lower the bar in v1 if it slows shipping; the gate logic is in CI, easy to relax.

---

## 2026-05-05T22:30Z — Web framework / build tool

**Question:** Confirm React 19 + Vite 7 (per plan.md) vs alternates.

**Chosen assumption:** **React 19 + Vite 7 + TypeScript 5**, exactly as plan.md specifies. No alternate considered.

**Rationale:** Plan.md is explicit. Deviation needs a plan amendment.

**Reversibility:** Heavy — would require rewriting `packages/web`. Don't deviate without strong cause.

---

## 2026-05-05T22:30Z — `node-pty` install fallback

**Question:** Plan.md "Open questions" lists three options if `node-pty` fails to build at install time on a target OS. Which do we pre-build for?

**Chosen assumption:** **(a)** — ship a no-PTY fallback for v0. If the spike confirms `node-pty` builds clean on Win/macOS/Linux via CI, we keep PTY+Interactive mode in v0. If it fails on any host, we re-scope per plan.md: log-tail diorama only, defer Interactive mode to v1.

**Rationale:** Plan.md already names (a) as the v0-friendly answer. (b) `prebuildify` is v1 polish. (c) is an architecture pivot we don't have time for.

**Reversibility:** The `core` adapter already wraps the event sources behind a facade — swapping the PTY path for a child-process line scrape is contained.

---

## 2026-05-05T22:30Z — Default port

**Question:** Auto-pick like Vite, or fixed like Squad's WS bridge (6277)?

**Chosen assumption:** **Auto-pick** (Vite-style: try a default, fall back if busy). Default to 6280.

**Rationale:** Plan.md says auto-pick for v0; multi-instance side-by-side is a v2 concern. 6280 chosen to not collide with Squad's own 6277 bridge port.

**Reversibility:** One constant in `packages/cli`.

---

## 2026-05-05T22:30Z — `node-pty` install fallback (CI-only validation gap)

**Question:** Brady dev's only on Windows. macOS / Linux validation only happens in CI — does that satisfy the "load spike" gate?

**Chosen assumption:** **Yes.** The CI matrix (Windows + macOS + Linux runners on GitHub Actions) running the `npm pack` + `npm install -g <tarball>` smoke counts as the cross-platform spike. We do not require Brady to procure mac/linux test hosts.

**Rationale:** Brady can't validate offline, and CI is the canonical multi-platform check anyway.

**Reversibility:** None needed — this is the standard pattern.

---

## 2026-05-05T22:30Z — Aquarium sprite flavor

**Question:** Plan.md "Open questions" — literal ASCII fish vs abstract phosphor-pond?

**Chosen assumption:** **Literal**. Anglerfish `(°)>=<` Lead with flickering `*` lure exactly as plan.md describes. Seahorse Frontend, octopus Backend, pufferfish Tester (puffs on red), squid Scribe.

**Rationale:** Plan.md describes the literal flavor in detail; abstract is a v1+ stretch.

**Reversibility:** Skin manifest separates sprites from data — swapping in abstract drift later costs a sprite-pass, not a refactor.

---

## 2026-05-05T22:30Z — Aquarium / Office naming choices

**Question:** Plan.md "Open questions" — confirm Hatchery (agents) + Scriptorium (skills) + Hatcher (sub-agent), or alternates (Bestiary/Codex; Pond/Library; Nursery/Atelier)?

**Chosen assumption:** **Hatchery + Scriptorium + Hatcher**. Plan.md uses these names throughout; alternates are speculative.

**Rationale:** Consistency with plan.md prose. Renaming inside skin vocab maps is cheap if Brady prefers an alternate later.

**Reversibility:** `vocab.json` per skin handles label swaps at render time; identifier rename is one find/replace pass.

---

## 2026-05-06T03:51:00Z — Phase 5 frontend polish defaults

**Question:** Should browser-visible toggles for Ambient SFX and Always-on-top call host/native APIs in Wave 1?

**Chosen assumption:** No. Persist the toggles now, but leave host/native behavior for a later bridge because the current web package has no trusted API for audio or window pinning.

**Rationale:** The user asked for settings UI and persistence; wiring native effects without an existing protocol would expand scope outside `packages/web`.

**Reversibility:** Add server/electron/tauri bridge handlers later and consume the already-persisted settings keys.
