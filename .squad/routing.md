# Work Routing

How to decide who handles what.

## Routing Table

| Work Type                           | Route To  | Examples |
|-------------------------------------|-----------|----------|
| Plan amendments / scope decisions   | Lead      | Edit `plan.md`, cut a v0 feature, add a spike, sequence work |
| Browser / renderer / skins          | Frontend  | `packages/web/*`, skin manifest schema, ANSI display rendering, animation FSMs |
| Node CLI / process orchestration    | Backend   | `packages/core/*`, `node-pty`, WebSocket server, Squad event ingestion, ANSI parsing, CLI flags |
| Pre-v0 spikes (cross-platform PTY)  | Backend   | `node-pty` macOS/Linux/Windows ConPTY load test |
| Pre-v0 spikes (skin manifest schema)| Frontend  | Schema v1 spike, validator, reference Aquarium + Office skins |
| Pre-v0 spikes (packaging+startup)   | Backend   | `npm install -g`, single-binary launch, browser-open path |
| Code review                         | Lead      | Reviews PRs against `plan.md` intent first, code quality second |
| Scope & priorities                  | Lead      | What ships in v0 vs v1+, trade-offs, when to invalidate the plan |
| Session logging / decisions merge   | Scribe    | Automatic — never needs routing |
| Persistent memory across sessions   | Ralph     | Dormant in v0; activates in v1+ when the watch daemon ships |

## Issue Routing

| Label              | Action                                                            | Who    |
|--------------------|-------------------------------------------------------------------|--------|
| `squad`            | Triage: analyze issue, assign `squad:{member}` label              | Lead   |
| `squad:lead`       | Lead picks up the issue                                           | Lead   |
| `squad:frontend`   | Frontend picks up the issue                                       | Frontend |
| `squad:backend`    | Backend picks up the issue                                        | Backend |
| `squad:scribe`     | Scribe picks up the issue (docs / history work)                   | Scribe |

### How Issue Assignment Works

1. When a GitHub issue gets the `squad` label, the **Lead** triages it — analyzing content, assigning the right `squad:{member}` label, and commenting with triage notes.
2. When a `squad:{member}` label is applied, that member picks up the issue in their next session.
3. Members can reassign by removing their label and adding another member's label.
4. The `squad` label is the "inbox" — untriaged issues waiting for Lead review.

## Rules

1. **Eager by default** — spawn all agents who could usefully start work, including anticipatory downstream work.
2. **Scribe always runs** after substantial work, always as `mode: "background"`. Never blocks.
3. **Quick facts → coordinator answers directly.** Don't spawn an agent for "what port does the dev server run on?"
4. **When two agents could handle it**, pick the one whose domain is the primary concern.
5. **"Team, ..." → fan-out.** Spawn all relevant agents in parallel as `mode: "background"`.
6. **Anticipate downstream work.** If Backend exposes a new event shape, spawn Frontend in parallel to update the renderer.
7. **Plan invalidation is a Lead task.** If a spike result contradicts `plan.md`, route to Lead before any feature code lands.
8. **Issue-labeled work** — when a `squad:{member}` label is applied to an issue, route to that member. The Lead handles all `squad` (base label) triage.

