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

### 2026-05-06T03:51:00Z — Phase 5 Wave 2: Dallas docs/audit slice

**Deliverables produced:**

- `README.md` — updated from 211 lines to reflect v1+v2 reality. New sections: expanded Commands table (trace/why/inspect/diorama/aspire), in-app command palette reference, Settings panel table (CRT/voice bubbles/mood glyphs/SFX/always-on-top), Wisdom Wing, Plugin marketplace, Game mode (cosmetic-only constraint explicit), v1+v2 added bullet list (shipped vs parked). Skins section updated with community skin packs roadmap note. No marketing fluff added; spirit of v0 README preserved.
- `.github/CONTRIBUTING-UPSTREAM.md` — new file. Two upstream PR prep guides with copyable git commands: (a) filing `squad-grill-template` as a Squad built-in skill (fork, copy, issue, PR, body template including Pocock credit block); (b) proposing Squadquarium as `squad ui` subcommand (discussion-first approach, naming risk section for SquadOffice/squad rc collision, stub PR flow).
- `.github/POCOCK-PACK.md` — new file. Documents the v2 Pocock pack item: what it is, why it's blocked (license not confirmed permissive), outreach plan (Brady-only action: GitHub Discussion in mattpocock/skills), v3+ flow if co-authoring lands, what is safe to do autonomously right now (cite + link only).
- `.squad/decisions/inbox/dallas-final-v1-v2-audit.md` — final v1+v2 plan.md audit, 18 v1 items + 8 v2 items. Per-item verdict with artifact citations. Coordinator summary table: 10 items to flip `[x]`, 6 items to mark `[partial]`, 6 items to mark `[parked]`, 5 items to hold at `[ ]`. This is the master manifest for the Coordinator's plan.md checkpoint pass.
- `.squad/identity/wisdom.md` — two patterns appended: upstream PR prep docs as deliverable (not post-ship), and `[parked]` vs `[ ]` classification discipline in audit manifests.

**Audit findings (summary):**

v1 shipped items confirmed: `trace`/`why`/`inspect`/`diorama`/`aspire` CLI subcommands, `squad-grill-template` skill, Wisdom Wing component, Settings panel (CRT/voice/mood/SFX/always-on-top), Vim-style `:` command palette with history, Ralph night-shift creature + daemon controls, per-agent voice-line samples from charter, Open Aspire dashboard. Partial: approval queue (client badge yes, server-clear frame no), time-scrubber (stub; replay deferred), Hatchery cross-suggestion (design only), plugin marketplace (backend + palette; no browse panel UI), Office skin polish (files present; Aquarium parity unverified), community skin packs (manifest locked; no in-app browser). Parked: HookPipeline (not attempted), Tauri wrapper (demand gate), prebuildify (friction gate). v2 items: all not yet designed/implemented; Pocock pack and upstream PR are externally gated.

**Decisions recorded:**

- `.squad/decisions/inbox/dallas-final-v1-v2-audit.md` is the definitive checkpoint manifest.
- `.github/CONTRIBUTING-UPSTREAM.md` and `.github/POCOCK-PACK.md` are the two new governance artifacts that unlock Brady-gated upstream actions.

## Learnings

**Audit discipline:**
The distinction between `[parked]` and `[ ]` proved important. Five v2 items are `[ ]` (not designed, no external blocker — just not done yet). Six items are `[parked]` (externally gated: Brady must initiate a conversation, or audience demand must appear, or a license must be confirmed). Mixing the two classifications would hide which items require Brady action and which are just in the queue.

**Upstream PR prep as a deliverable:**
Writing CONTRIBUTING-UPSTREAM.md before the upstream PRs are filed makes the path from "working on our end" to "living upstream" concrete. The friction of forgetting the exact fork/copy/PR-body steps is higher than the cost of writing it now. This pattern should apply to any future Squadquarium feature that has a known upstream home.

**Game mode constraint:**
The "cosmetic-only" constraint for game mode is the single most important product guardrail in the v2 section. It belongs in the README, in plan.md, and in any future settings UI that exposes the toggle — not just in plan.md prose. Added it to README explicitly.


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
