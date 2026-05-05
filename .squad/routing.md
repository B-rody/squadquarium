# Work Routing

How to decide who handles what.

## Routing Table

| Work Type | Route To | Examples |
|-----------|----------|----------|
| Scope, architecture, decisions, plan.md amendments | Dallas (Lead) | Decompose v0 milestones, resolve trade-offs, approve PRs, amend plan |
| Frontend / UI / glyph renderer / skins | Lambert | React 19 components, Canvas2D glyph cells, xterm.js wiring, skin loaders, PWA manifest |
| Backend / SDK integration / process model | Parker | `core` package, Squad SDK adapter, `SquadObserver`, `node-pty` pool, event reconciler, HTTP/WS server, CLI bin |
| Testing, validation, CI, screenshot baselines | Ripley | vitest suites, Playwright screenshot diffs, glyph-grid invariants, cross-platform PTY smoke, per-commit quality gate |
| Code review (cross-cutting) | Ripley primary, Dallas secondary | Ripley reviews engineering PRs first; Dallas reviews scope/architecture |
| Session logging, decisions merging, history archive | Scribe | Automatic — never needs routing |
| Watch / monitor (dormant v0) | Ralph | Reserved for v1+ ambient watchdog; do not spawn in v0 |

**Reviewer rejection lockout:** Ripley owns the strict-lockout reviewer rule. If Ripley rejects a PR/spike from an engineer, that engineer is **locked out** of producing the next revision — the Coordinator must route the fix to a different agent (typically the other engineer, or escalate to Dallas). See `.github/agents/squad.agent.md` → Reviewer Rejection Protocol.

**Dogfooding lens:** Whenever an agent feels friction with Squad's UX (a missing CLI, a confusing error, a gap that the diorama would have made obvious), append a one-line distilled pattern to `.squad/identity/wisdom.md`. This is a v0 deliverable.

## Issue Routing

| Label | Action | Who |
|-------|--------|-----|
| `squad` | Triage: analyze issue, assign `squad:{member}` label | Lead |
| `squad:{name}` | Pick up issue and complete the work | Named member |

### How Issue Assignment Works

1. When a GitHub issue gets the `squad` label, the **Lead** triages it — analyzing content, assigning the right `squad:{member}` label, and commenting with triage notes.
2. When a `squad:{member}` label is applied, that member picks up the issue in their next session.
3. Members can reassign by removing their label and adding another member's label.
4. The `squad` label is the "inbox" — untriaged issues waiting for Lead review.

## Rules

1. **Eager by default** — spawn all agents who could usefully start work, including anticipatory downstream work.
2. **Scribe always runs** after substantial work, always as `mode: "background"`. Never blocks.
3. **Quick facts → coordinator answers directly.** Don't spawn an agent for "what port does the server run on?"
4. **When two agents could handle it**, pick the one whose domain is the primary concern.
5. **"Team, ..." → fan-out.** Spawn all relevant agents in parallel as `mode: "background"`.
6. **Anticipate downstream work.** If a feature is being built, spawn the tester to write test cases from requirements simultaneously.
7. **Issue-labeled work** — when a `squad:{member}` label is applied to an issue, route to that member. The Lead handles all `squad` (base label) triage.


