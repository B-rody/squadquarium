# Copilot Coding Agent — Squadquarium Instructions

You are working on **Squadquarium** — a terminal-styled idle diorama that wraps the [bradygaster/squad](https://github.com/bradygaster/squad) AI team framework. Read this file before starting any work.

---

## ⚠️ Pre-Push Validation Gate

**Before pushing ANY commit, you MUST run the full validation gate:**

```
pnpm lint && pnpm -r build && pnpm -r test
```

This is the same gate that husky enforces locally for human contributors via `.husky/pre-push`. **The cloud coding agent and other AI agents do NOT have husky hooks installed in their environment**, so this rule must be followed manually — it is not optional.

- If `pnpm lint` fails → fix all lint errors before proceeding.
- If `pnpm -r build` fails → fix all build errors before proceeding.
- If `pnpm -r test` fails → fix all test failures before proceeding.
- **Do NOT push broken code to `main`.** A red CI on main blocks everyone.

**If your changes touch the install path** (anything in `packages/cli`, the `prepack` script, `bundleDependencies`, or the tarball output), also replicate the `pack-install-smoke` job from `.github/workflows/ci.yml` locally:

```
pnpm -r build
pnpm pack-all
# Windows:
$tarball = Get-ChildItem -Path packages/cli -Filter "squadquarium-*.tgz" | Select-Object -First 1 -ExpandProperty FullName
npm install -g $tarball
squadquarium --headless-smoke
# Linux / macOS:
# npm install -g packages/cli/squadquarium-*.tgz && squadquarium --headless-smoke
```

Reference: `README.md` → "CI → Local pre-push gate" explains why this gate exists and what it covers.

---

## Team Context

This project uses **Squad**, an AI team framework. Before starting work on any issue:

1. Read `.squad/team.md` for the team roster, member roles, and your capability profile.
2. Read `.squad/routing.md` for work routing rules.
3. If the issue has a `squad:{member}` label, read that member's charter at `.squad/agents/{member}/charter.md` to understand their domain expertise and coding style — work in their voice.

**Key boundaries to know:**

- Squadquarium **reads** `.squad/` and **never writes** to it. Mutations go through the Squad CLI via PTY.
- Network is loopback-only (`127.0.0.1`). No external network calls from the diorama process.
- Skin manifest schema locks before v0 ships — do not change it without a `squad:dallas` decision.

---

## Capability Self-Check

Before starting work, check your capability profile in `.squad/team.md` under the **Coding Agent → Capabilities** section.

- **🟢 Good fit** — proceed autonomously.
- **🟡 Needs review** — proceed, but note in the PR description that a squad member should review.
- **🔴 Not suitable** — do NOT start work. Instead, comment on the issue:
  ```
  🤖 This issue doesn't match my capability profile (reason: {why}). Suggesting reassignment to a squad member.
  ```

---

## Branch Naming

Use the squad branch convention:
```
squad/{issue-number}-{kebab-case-slug}
```
Example: `squad/42-fix-login-validation`

---

## PR Guidelines

When opening a PR:
- Reference the issue: `Closes #{issue-number}`
- If the issue had a `squad:{member}` label, mention the member: `Working as {member} ({role})`
- If this is a 🟡 needs-review task, add to the PR description: `⚠️ This task was flagged as "needs review" — please have a squad member review before merging.`
- Follow any project conventions in `.squad/decisions.md`
- **Ensure CI is green before requesting merge — see Pre-Push Validation Gate above.**

---

## Decisions

If you make a decision that affects other team members, write it to:
```
.squad/decisions/inbox/copilot-{brief-slug}.md
```
The Scribe will merge it into the shared decisions file.
