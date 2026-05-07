# Skill: Agent Docs Pre-Push Gate

**Domain:** DevOps / AI Agent Safety
**Confidence:** medium (pattern proven in Squadquarium; first extraction)
**Created:** 2026-05-06T18:09:58-07:00
**Author:** Dallas (Lead)

---

## Problem

Husky (or any local git hook system) enforces pre-push validation for human contributors who clone the repo normally. However, AI coding agents (e.g., GitHub Copilot coding agent) operate in fresh, ephemeral clone environments where `npm install` / `pnpm install` may not run the `prepare` script that installs hooks, and where the agent's push path bypasses the git hook entirely.

The result: AI agents can push broken code to the main branch even when humans cannot.

Server-side branch protection (GitHub rulesets, classic branch protection) closes this gap permanently — but it requires GitHub Pro for private repos, and not every project has it.

## Pattern: Docs-as-Gate

When server-side branch protection is unavailable or not justified, use a **prominent instruction section** in the agent-facing docs file to make the validation requirement explicit.

### Required Artifacts

1. **`.github/copilot-instructions.md`** — must contain a visually prominent section (⚠️ heading, emoji, or both) near the top of the file. The section must:
   - State the exact command to run: `pnpm lint && pnpm -r build && pnpm -r test` (or equivalent for the project's toolchain)
   - Explain *why* husky doesn't apply in the agent's environment
   - Specify what to do on failure (fix before pushing; do NOT push broken code)
   - Reference the CI workflow for any special jobs (e.g., pack-install-smoke) so the agent can replicate them locally when touching the install path
   - Link to a human-readable explanation (e.g., README CI section)

2. **`AGENTS.md`** at repo root — a one-paragraph pointer for agents that look for AGENTS.md specifically. Must repeat the gate command verbatim.

### Placement Rule

The Pre-Push Validation Gate section belongs **before Team Context** — it must be the first substantive content an agent reads after the title. An agent skimming the file should hit the ⚠️ before anything else.

### Wording Pattern

```markdown
## ⚠️ Pre-Push Validation Gate

**Before pushing ANY commit, you MUST run the full validation gate:**

\`\`\`
{lint-command} && {build-command} && {test-command}
\`\`\`

This is the same gate that husky enforces locally for human contributors via `.husky/pre-push`.
**The cloud coding agent and other AI agents do NOT have husky hooks installed in their environment**,
so this rule must be followed manually — it is not optional.

- If any step fails → fix before pushing.
- **Do NOT push broken code to `main`.**

Reference: `README.md` → "{section name}" explains why this gate exists.
```

## Anti-Patterns

- **Burying the gate in a footnote or bottom section.** Agents skim from the top. If it's not near the top, it's invisible.
- **Omitting the exact command.** "Run your tests" is not enough. Agents need the literal invocation.
- **Not explaining the husky gap.** Without explaining *why* the manual rule exists, a future agent may assume husky covers it and skip the check.
- **Using docs-as-gate as a permanent substitute for server-side protection.** This pattern is appropriate for solo/small projects or when Pro plan is unavailable. For team repos with multiple contributors and a Pro plan, add branch protection rulesets too — docs-as-gate is a complement, not a replacement.

## When to Use This Pattern

- Solo or small-team project without GitHub Pro (or equivalent) branch protection
- Any repo where AI coding agents (Copilot, Devin, etc.) are expected to open PRs autonomously
- As a belt-and-suspenders addition even when server-side protection is enabled, because docs are cheap

## Upgrade Path

When the project moves to an org with GitHub Team/Pro:
1. Add a branch ruleset requiring all CI status checks before merge
2. Keep the Pre-Push Validation Gate section — it still provides value as an explanation
3. Update the section to note that server-side protection is also active
