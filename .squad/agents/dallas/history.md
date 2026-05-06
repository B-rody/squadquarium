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

### 2026-05-05T22:30Z — Phase 3 Wave 2: README, CHANGELOG, plan.md audit

**README structure choices:**
- Led with the demo placeholder (`[ ! demo gif goes here ]`) immediately after the tagline — "lead with the demo" is the brief. ASCII diorama at the bottom serves as the in-repo illustration.
- "What it doesn't do" section carries explicit weight: the product boundary (`Squadquarium may call squad; it must not become squad`) is the hardest part of the story to land with a new user. It gets its own section, not a footnote.
- Architecture section is prose + file tree — not an API reference. The goal is "would a competent Node dev understand where to start?" not "is this exhaustive?"
- Troubleshooting for `node-pty` is specific: the Windows path is the canonical option (a) from plan.md; the no-PTY fallback is named so users understand what they're getting, not just that something failed.
- Status section is intentionally labeled "alpha" and includes the "built fully autonomously" provenance — this is the honest positioning for v0 and sets correct expectations.

**plan.md audit gaps found:**
- Three Wave 2 items were NOT on disk at audit time: hatching rituals (Lambert), self-portrait mode (Lambert), npm publish dry run (Ripley). All annotated as deferred. This was expected — the wave is in progress.
- The xterm.js + Squad ink TUI compatibility spike remains the only pre-v0 spike that is genuinely unresolved. The in-progress note is accurate; it gates on Wave 2.
- A duplicate event reconciler item existed in the pre-v0 spikes section (lines ~1038–1041) — the same item already `[x]`'d above it. Flipped to `[x]` with a "Duplicate entry" note rather than deleting, to preserve audit trail.

**Decisions.md cross-check:**
- All 14 active decisions in `.squad/decisions.md` were reviewed against what landed on disk. No gaps found — every architectural choice (loopback-only, port auto-pick, event reconciler, skin schema lock, Squad pin, node-pty fallback, testing strategy, CI strategy, quality gate, casting universe, north star, etc.) is captured.
- No new decisions needed from this audit beyond `dallas-wave2-audit.md` (which documents the three deferred items and the README scope choice).


**Finding:** Squad CLI's `dist/remote-ui/` is a static web bundle (Squad RC — a browser-based remote control UI). It is **not** a structured event channel for external subscribers. The underlying event broker is `RemoteBridge` from the SDK, which is for *remote control* (client→server commands), not for *activity monitoring* (server→client events). EventBus already provides the latter.

**Implication:** No new event source to wire. Squadquarium stays on PTY+bus+fs+log as planned. The spike's outcome is the negative-result path (plan.md item 10): "if not, we confirm PTY+bus+fs+log is the full menu and stop scheming."

**Architectural consequence:** RemoteBridge (for external clients) vs. EventBus (for internal activity) are orthogonal. If Squadquarium needs remote-control capabilities in v2+, that would be a separate RemoteBridge instance we start *inside* Squadquarium, not a subscription to Squad's RC infrastructure.

**Quality gate sanity check:** Testing infrastructure is solid. Vitest + Playwright + cross-platform CI + headless-smoke + reviewer lockout all documented and ready. No gaps detected for v0 Testing & Quality contract.

**Plan.md amendments:** None. Item 10 is satisfied; item 4 & 5 verified as correct priority.

### 2026-05-06T03:51:00Z — Phase 5 Wave 1: v1 design slice (Dallas)

**Deliverables produced:**
- `.squad/skills/squad-grill-template/SKILL.md` — Squadquarium's first authored skill. ~340 lines. Frontmatter-complete per Squad schema. Five named patterns (scope-respect, required-field completeness, cross-template coherence, fail-closed, deep-interview toggle). Six anti-patterns named explicitly. Hatchery + Scriptorium worked examples. Pocock `grill-with-docs` cited and linked. Domain `meta`; confidence `low` (first observation; bumps with real use).
- `packages/web/src/hatchery/CROSS-SUGGESTION-DESIGN.md` — design doc for Hatchery cross-suggestion queue. Fully specced: detection signal (PTY phrase matching + ANSI strip + false-positive guard), Zustand state shape (`pendingScriptoriumSeeds: ScriptoriumSeed[]`), three-condition handoff trigger, toast banner UI spec, seed format contract (single clean line), out-of-scope exclusions. Lambert-ready for Wave 2 implementation pending Brady greenlight.
- `.squad/decisions/inbox/dallas-v1-wave1-audit.md` — post-wave v1 checklist audit. Dallas's two items confirmed landed; 16 others deferred to Parker/Lambert audit or future waves.
- `.squad/identity/wisdom.md` — appended: "Skills that walk template placeholders must include a fail-closed clause."

## Learnings

**Skill design rationale:**
The scope-respect rule is the load-bearing rule. The entire risk of a "thorough mode" skill is that it becomes annoying — users turn it off and never look back. Naming the failure mode ("annoying drill-down") explicitly in Anti-Patterns, and making scope-respect Rule 1 (not Rule 5), is the architectural choice that makes the skill usable. The fail-closed rule is borrowed from Pocock's approach but adapted: his version is adversarial by design; ours is purely mechanical completeness. The two modes coexist via the deep-interview toggle, which is the correct integration seam.

**Hatchery cross-suggestion architecture:**
The key design insight is that the queue is Squadquarium-only Zustand state — the Coordinator knows nothing about it. This respects the "Squadquarium observes; mutations go through Squad CLI via PTY" boundary. The banner is a toast (not a modal) because modals block the diorama, and the diorama is the product. The seed format as a single clean line is critical: if the seed pre-fills template fields, it defeats the Scriptorium interview, which is the value of the Scriptorium flow.

**Audit findings:**
Dallas's two items landed. Parker + Lambert items cannot be audited from Dallas's context — they're in disjoint files. The Coordinator must do a second pass after their commits. The two items I can confirm as `[x]`-ready are the skill and the design doc. "Hatchery cross-suggestion" is `[x]`-able for the design phase; Lambert's implementation is a separate future checkbox.
