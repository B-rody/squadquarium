# Squad Decisions

## Active Decisions

### 2026-05-05 — `plan.md` is the north star

Every Squadquarium decision is rooted in `plan.md` at the repo root. Lead owns the plan. Frontend and Backend implement against the plan; if reality and the plan diverge, Lead amends `plan.md` *first*, then implementation follows. No code commits that contradict `plan.md` without a corresponding plan edit in the same PR.

### 2026-05-05 — Pre-v0 spikes ship before v0 milestones

The "Pre-v0 spikes" section of `plan.md` runs to completion before any v0 milestone code lands. Spike order, in priority:

1. **`node-pty` cross-platform load** (Backend) — verify macOS, Linux, Windows ConPTY can host Squad subprocesses without orphan PTYs.
2. **Skin manifest schema v1** (Frontend) — write the schema, the validator, and the reference Aquarium + Office skins.
3. **Packaging + startup** (Backend) — `npm install -g squadquarium` produces a working `squadquarium` binary that opens a browser.
4. **Loopback WebSocket protocol** (Backend + Frontend together) — define the event-reconciliation envelope, lock the schema before either side codes against it.

A spike that invalidates a plan assumption is a feature, not a failure. Lead rewrites the affected section and re-routes.

### 2026-05-05 — Roster

Lead, Frontend, Backend, Scribe (active). Ralph dormant — wakes in v1+ when the watch daemon ships. No additional roles added in v0 without Lead approval and a `plan.md` amendment.

### 2026-05-05 — Squad version pin

Pin to `@bradygaster/squad-cli` 0.9.4. Re-run the `node-pty` and packaging spikes before bumping.

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction

