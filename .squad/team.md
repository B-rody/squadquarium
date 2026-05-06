# Squad Team

> squadquarium — an ambient terminal-styled diorama for AI dev teams.

## Coordinator

| Name | Role | Notes |
|------|------|-------|
| Squad | Coordinator | Routes work, enforces handoffs and reviewer gates. |

## Members

| Name | Role | Charter | Status |
|------|------|---------|--------|
| Dallas  | Lead              | [agents/dallas/charter.md](agents/dallas/charter.md)  | ✅ Active |
| Lambert | Frontend Dev      | [agents/lambert/charter.md](agents/lambert/charter.md) | ✅ Active |
| Parker  | Backend Dev       | [agents/parker/charter.md](agents/parker/charter.md)  | ✅ Active |
| Ripley  | Tester / Reviewer | [agents/ripley/charter.md](agents/ripley/charter.md)  | ✅ Active |
| Scribe  | Session Logger    | [agents/scribe/charter.md](agents/scribe/charter.md)  | ✅ Active |
| Ralph   | Work Monitor      | [agents/ralph/charter.md](agents/ralph/charter.md)    | 💤 Dormant (v1+) |

## Project Context

- **Project:** squadquarium
- **What:** A no-click idle diorama for your AI dev team. A terminal-styled GUI wrapper around bradygaster/squad — the engine is Squad; we are the dogfood-able ambient companion that makes the team feel alive.
- **User:** Brody Schulke (Brody) — the human. Solo developer + designer. Dev environment is **Windows-only**; cross-platform validation comes from CI.
- **Created:** 2026-05-05
- **Casting universe:** Alien (small-crew, isolated, vigilance-coded — fits a weekend hack with one independent reviewer)
- **Squad version pin:** 0.9.4 (alpha — pin per Squadquarium release; treat `squad upgrade` as a port window)
- **Runtime:** Node ≥ 22.5.0 (current host: 24.14.1); pnpm 10.33.3 workspace; TypeScript everywhere in `packages/`
- **Form factor:** Single Node process. CLI (`squadquarium` / `sqq`) serves a React+Vite+Canvas2D web bundle over a loopback HTTP/WS server (127.0.0.1 only). No Tauri, no Electron, no Rust in v0.
- **Repo layout:** `packages/{core,web,cli}` + `skins/{aquarium,office}` + `.squad/` (this team).
- **North star:** Ambient by default. Drill-in on demand. CLI parity. Local-first. Skin manifest schema is a v0 architectural commitment.
- **Hard rules:** `.squad/` is read-only from Squadquarium — all mutations route through the real Squad CLI via PTY. Loopback-only network. Single-flow lock at `.squad/.scratch/squadquarium.lock` for any UI flow that mutates `.squad/`. Hatcher delegates to the Coordinator (i.e., to *us*) — Squadquarium does NOT introduce its own LLM client / tool-call surface.
- **Dogfood pact:** Every friction point with Squad's UX gets logged to `.squad/identity/wisdom.md`. We are our own most-demanding user.

## Issue Source

Not connected to a GitHub remote yet for issue triage. v0 work is plan.md-driven.

