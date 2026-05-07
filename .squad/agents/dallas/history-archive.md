# Dallas — History Archive

> Entries archived from history.md when file size exceeded 15 KB. Kept for reference; inactive during active phase.

## 2026-05-06 Phase 5 Wave 1–2

### 2026-05-05T22:30Z — Phase 3 Wave 2: README, CHANGELOG, plan.md audit

**README structure choices:**
- Led with the demo placeholder immediately after the tagline — "lead with the demo" is the brief. ASCII diorama at the bottom serves as in-repo illustration.
- "What it doesn't do" section carries explicit weight: product boundary is the hardest part of the story to land with a new user.
- Architecture section is prose + file tree — not an API reference. Goal is "would a competent Node dev understand where to start?"
- Troubleshooting for node-pty specific: Windows path is canonical option (a) from plan.md; no-PTY fallback named for clarity.
- Status section intentionally labeled "alpha" and includes "built fully autonomously" provenance — honest v0 positioning.

**plan.md audit gaps found:**
- Three Wave 2 items NOT on disk: hatching rituals (Lambert), self-portrait mode (Lambert), npm publish dry run (Ripley). All deferred as expected.
- xterm.js + Squad ink TUI compatibility spike remains unresolved pre-v0 spike; gates on Wave 2.
- Duplicate event reconciler item existed (lines ~1038–1041); flipped to [x] with audit trail note.

**Decisions.md cross-check:**
- All 14 active decisions reviewed against disk; no gaps found. Every architectural choice captured.
- No new decisions needed beyond dallas-wave2-audit.md documenting the three deferred items.

**Finding:** Squad CLI's dist/remote-ui/ is static web bundle (remote control UI), NOT structured event channel. EventBus already provides activity monitoring. No new event source to wire.

**Plan.md amendments:** None. Item 10 satisfied; items 4 & 5 verified correct priority.

---

### 2026-05-06T03:51:00Z — Phase 5 Wave 2: Dallas docs/audit slice

**Deliverables:**
- Updated README.md (211 lines); expanded Commands table (trace/why/inspect/diorama/aspire); Settings panel table; Wisdom Wing; Plugin marketplace; Game mode constraint explicit.
- `.github/CONTRIBUTING-UPSTREAM.md` — upstream PR prep guides with copyable git commands for squad-grill-template and Squadquarium-as-squad-ui proposals.
- `.github/POCOCK-PACK.md` — documents v2 Pocock pack item: what it is, why blocked (license), outreach plan, v3+ flow.
- `.squad/decisions/inbox/dallas-final-v1-v2-audit.md` — 18 v1 items + 8 v2 items. Master manifest: 10 [x], 6 [partial], 6 [parked], 5 [ ].
- `.squad/identity/wisdom.md` — two patterns appended.

**Audit findings:**
v1 shipped: trace/why/inspect/diorama/aspire, squad-grill-template, Wisdom Wing, Settings, voice-line samples, Aspire dashboard.
Partial: approval queue (client yes, server-clear no), time-scrubber (stub), Hatchery cross-suggestion (design only), marketplace (backend+palette; no UI), Office skin (files; parity unverified), community skins (manifest locked; no browser).
Parked: HookPipeline, Tauri, prebuildify.
v2: not yet designed.

---

### 2026-05-06T17:02:22Z — Ripley audit finding: README install instructions

Three READMEs instruct npm install -g, but package not published; dogfooding assumes packages/cli/dist/ exists (doesn't without pnpm -r build).

**Action:** Update root README "Quick start" with from-source flow. Same caveat for cli + vscode READMEs. Add build steps to "Dogfooding" section. Docs-only.

---

### 2026-05-06T17:19:47-07:00 — README pre-publish doc fix

**Deliverables:**
- README.md Quick Start: npm install → full build-from-source flow. Caveat added.
- README.md Dogfooding: pnpm install && pnpm -r build + optional tarball install required.
- packages/cli/README.md: caveat + build-from-source.
- packages/squadquarium-vscode/README.md: caveat + full flow.

**Decision filed:** dallas-readme-pre-publish-install.md

**Pattern:** READMEs written optimistically encode false future-state truths. Correct fix is "not yet on npm" caveat at call-site, not a separate section. Flip to clean one-liner ONLY after npmjs.org publication confirmed.

---

### 2026-05-06T17:37:39-07:00 — Husky pre-push gate pattern

Husky v9 at workspace root as devDependency, root prepare: "husky" for onboarding. Hook bodies plain shell — .husky/pre-push contains gate command only.

