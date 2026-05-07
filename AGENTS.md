# Agent Instructions

This repository uses a structured agent-instruction system. AI agents working on this codebase should read:

1. `.github/copilot-instructions.md` — primary instructions for autonomous coding agents
2. `.squad/team.md` — team roster and routing
3. `.squad/decisions.md` — accumulated team decisions

Before pushing any commit, run the full validation gate: `pnpm lint && pnpm -r build && pnpm -r test`.
