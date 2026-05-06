---
name: "squad-grill-template"
description: "Opt-in \"thorough mode\" for the Hatchery / Scriptorium / Ceremonies / Casting / MCP / Plugin marketplace flows. Walks every {placeholder} in the loaded template set; ensures cross-template coherence (charter ↔ routing ↔ roster); respects user-stated scope."
domain: "meta"
confidence: "low"
source: "manual"
triggers:
  - hatchery
  - scriptorium
  - add agent
  - add skill
  - ceremony
  - casting
  - mcp
  - plugin install
roles:
  - coordinator
  - lead
tools: []
---

## Context

`squad-grill-template` activates in **opt-in "thorough mode"** during Squadquarium's template-driven creation flows: the Hatchery (new agent), Scriptorium (new skill), Ceremonies (recurring rituals), Casting (persona assignment), MCP config (tool wiring), and Plugin marketplace (install + cite). It is **off by default** — the Coordinator's native interview is sufficient for most sessions. Users toggle it per session via a UI switch or a flag in the PTY seed message.

**Purpose:** completeness and coherence, not interrogation.

This skill exists because the Coordinator's interview is good at gathering information but inconsistent at (a) ensuring every `{placeholder}` in the full template set is filled and (b) verifying that the same fact (e.g., "Tessa owns auth") is consistently expressed across all related files (charter → routing → roster). These are mechanical, high-value checks that add no friction when the user already knows the answers — they're just a systematic walkthrough, not a philosophy seminar.

**Parameterized by template set.** The skill logic is identical regardless of which surface invokes it. The Hatchery loads `{ charter.md, history.md, roster.md, routing.md }`; the Scriptorium loads `{ skill.md }`; future surfaces (Ceremonies, Casting, MCP, Plugin) load their matching template set. Zero new skill code for new surfaces — the caller changes the template list, not the skill.

**Relationship to Matt Pocock's `grill-with-docs`.** This skill borrows the fail-closed discipline from Matt's [`grill-with-docs`](https://github.com/mattpocock/skills) — never invent content, always ground questions in real template files. Where his plugin goes further (adversarial sub-divide, granularity drills, nested scope expansion), this skill explicitly backs off. When `mattpocock/skills` is installed as a Squad plugin marketplace dependency, an additional **"deep-interview" toggle** becomes available that wires through to his stricter style for users who want it.

> **Supporting information:** [`mattpocock/skills`](https://github.com/mattpocock/skills) — Matt Pocock's squad skills collection. `grill-with-docs` is the canonical reference for fail-closed template grilling in the Squad ecosystem. `squad-grill-template` is Squadquarium's scope-respecting adaptation: completeness + coherence over adversarial depth. The Pocock pack co-authorship path (v2 roadmap) is the long-term upstream conversation.

## Patterns

### 1 — Scope-Respect Rule

**The user's stated scope is the ceiling, not the floor.**

When the user says "auth," the skill asks about auth. It does not ask "do you mean OAuth? SAML? JWT? session tokens? PKCE?" unless the user explicitly requests that granularity. Sub-divide probing is the primary failure mode of over-eager interview skills and the primary reason users turn thorough mode off forever.

Implementation:
- Extract the user's scope from the PTY seed message or the first Coordinator turn.
- Use that scope verbatim to label all template questions (e.g., "What should the `auth` agent own?" not "What specific auth subdomain?").
- If a template placeholder genuinely requires a sub-scope decision (e.g., `routing.md` needs a `work-type` category), name the specific field and the legal values, then stop. Do not editorialize about why they might want a different answer.
- If the Coordinator's interview has already established scope, defer to it. Never re-ask a question already answered.

### 2 — Required-Field Completeness Rule

**Walk every `{placeholder}` in the loaded template set. Ask only what is strictly needed to fill it. Stop when the set is exhausted.**

Template walkthroughs follow this procedure:

1. Load the template files for the current surface (provided by the calling flow — do not discover them autonomously).
2. Extract every `{placeholder}` by regex: `\{[a-z][a-z0-9-]*\}`.
3. For each placeholder, check whether the Coordinator has already established a value in the current session context.
4. For each unfilled placeholder, generate exactly one question — the most direct question that produces the needed value. No preamble, no explanation of why the field exists (unless the user asks).
5. Group related placeholders into a single question when their answers are naturally co-located (e.g., `{name}` and `{role}` → "What's the agent's name and role?").
6. Mark a placeholder as filled once the user provides a value — do not re-visit.
7. Declare completeness when all placeholders have values. Produce a preflight summary showing every filled placeholder before writing any file.

Ground every question in `squad.agent.md` (or the surface's canonical guide). If a placeholder's intent is ambiguous, quote the relevant line from the guide rather than paraphrasing. Fail closed: if a required field cannot be inferred or provided, stop and surface the gap — do not write a file with a blank or invented value.

### 3 — Cross-Template Coherence Rule

**The same fact must be expressed consistently across every template file that references it.**

Cross-template coherence checks run after all individual templates are filled but before any file is written. The check is mechanical — it is not about whether the user's choices are wise, only whether they are internally consistent.

Required coherence checks by surface:

**Hatchery (new agent):**
| Fact | charter.md location | routing.md location | roster.md location |
|------|---------------------|---------------------|--------------------|
| Agent name | `## Identity → Name:` | `| {name} \|` row | `| {name} \|` row |
| Role | `## Identity → Role:` | `work-type` column | `Role` column |
| What I Own | `## What I Own` bullets | routing patterns (if work-type matches) | (optional `Notes` column) |
| Active status | (presence of file) | routing row present | `✅ Active` |

If any fact is inconsistent, present a diff-style summary of the conflict and ask the user to confirm the canonical value before proceeding. Never silently pick one.

**Scriptorium (new skill):**
| Fact | SKILL.md location |
|------|-------------------|
| Name | frontmatter `name:` |
| Triggers | frontmatter `triggers:` list |
| Roles | frontmatter `roles:` list |
| Domain | frontmatter `domain:` |

Coherence check: verify that every trigger is a word or phrase plausibly matched by Squad's skill router (not a sentence; not a URL; not a camelCase symbol). Verify that every role in `roles:` matches a role that exists in `team.md` or is one of the seven SDK built-in roles (`lead`, `developer`, `tester`, `scribe`, `ralph`, `designer`, `architect`).

**Future surfaces (Ceremonies, Casting, MCP, Plugin):** Coherence checks are defined by the calling flow when it hands in the template set. The skill exposes a `coherence-checklist:` frontmatter extension point for future callers to declare their own checks without modifying this skill.

### 4 — Fail-Closed Rule

**Never write a file with an invented, inferred, or blank value. Surface the gap explicitly.**

This rule has three sub-cases:

**Sub-case A — Missing required value.** If the user cannot or does not provide a value for a required placeholder after one follow-up prompt, halt the write, list every unfilled field with its template location, and present three options: (1) fill now, (2) fill with a `TODO:` stub that `SquadObserver` will flag, (3) abandon this draft.

**Sub-case B — Ambiguous value.** If the user's answer could be interpreted two or more ways that produce materially different file content (e.g., "auth" as a routing work-type could be `feature-dev` or a new custom type), name both interpretations and ask the user to pick. Do not guess.

**Sub-case C — Coherence conflict.** If two templates contain conflicting values after the walkthroughs (e.g., charter says "Tessa owns auth" but routing.md row says "Taylor"), present the conflict as a blocking error, not a warning. Do not write either file until resolved.

The fail-closed posture is borrowed directly from Matt Pocock's `grill-with-docs`. It is what separates a useful interview skill from a cheerful file-writer that produces templates full of silent mistakes.

### 5 — Deep-Interview Toggle (Pocock integration)

When `mattpocock/skills` is installed as a Squad plugin marketplace dependency, the "deep-interview" toggle becomes available in the Hatchery/Scriptorium UI. When enabled:

- After the completeness walkthrough (Pattern 2), hand control to `grill-with-docs` for adversarial depth probing on scope-adjacent questions the user hasn't explicitly bounded.
- The Pocock plugin's output is fed back into the coherence check (Pattern 3) — if deep-interview produces new facts, they must be reconciled with already-filled placeholders.
- The toggle is surfaced as a secondary switch below the main "thorough mode" toggle — it is never on by default, even when the plugin is installed.
- If the plugin is not installed, the toggle renders as a grayed-out "Install Pocock pack from marketplace to enable deep-interview" affordance.

## Examples

### Hatchery — New Agent (thorough mode)

**Template set loaded:** `charter.md`, `history.md`, `roster.md`, `routing.md`

**Seed message:** "Add a new agent named Tessa who handles authentication."

**Skill walkthrough:**

```
[squad-grill-template] Thorough mode active. Walking charter.md placeholders.

1. Tessa's role title (charter → Identity → Role)?
   e.g., "Security Engineer", "Auth Lead", "Developer (Auth)"

2. Tessa's expertise — 2–3 specific skills (charter → Expertise)?
   Her scope is auth; what are the technical specifics?
   e.g., "JWT, session management, OAuth flow design"

3. Tessa's style (charter → Style)?
   One phrase. e.g., "Direct. Systematic. No shortcuts on token expiry."

4. What I Own: what does Tessa own in this repo?
   (Tip: squad.agent.md says "be specific — 'auth middleware' not 'security stuff'")

5. Tessa's voice (charter → Voice)?
   1–2 opinionated sentences. Must have OPINIONS.
   e.g., "Will refuse a PR that hardcodes a secret. Thinks bcrypt is the floor, not the ceiling."

[squad-grill-template] charter.md complete. Walking routing.md...

6. Tessa's work-type for routing (legal values: feature-dev, testing, documentation, architecture, design)?
   Most auth work is feature-dev — confirm or override.

7. Any additional routing patterns beyond the work-type?
   e.g., keywords: "auth", "login", "token", "session"

[squad-grill-template] Coherence check:
  charter → "Tessa owns auth middleware" ✅
  routing → work-type: feature-dev, patterns: [auth, login, token, session] ✅
  roster  → "✅ Active | Tessa | Auth Lead" ✅

All placeholders filled. No conflicts. Writing files.
```

### Scriptorium — New Skill (thorough mode)

**Template set loaded:** `skill.md`

**Seed message:** "Add a skill for handling rate-limit backoff."

**Skill walkthrough:**

```
[squad-grill-template] Thorough mode active. Walking skill.md placeholders.

1. Skill name (frontmatter → name)?
   Kebab-case. e.g., "rate-limit-backoff"

2. Description — what does this skill teach agents (frontmatter → description)?
   One sentence. e.g., "Exponential backoff with jitter for rate-limited API calls."

3. Domain (frontmatter → domain)?
   e.g., "api-design", "error-handling", "resilience"
   Existing domains in this repo: meta, team-workflow

4. Triggers (frontmatter → triggers)?
   Words/phrases Squad's router will match. e.g., [rate limit, 429, backoff, retry]
   (Avoid sentences or URLs — the router tokenizes by word.)

5. Roles (frontmatter → roles)?
   Which roles should this skill fire for?
   SDK built-ins: lead, developer, tester, scribe, ralph, designer, architect

[squad-grill-template] Coherence check:
  triggers format: all single words or short phrases ✅
  roles: "developer" exists in team.md ✅

Confidence set to "low" (first observation; bumps as the team earns it).
Source set to "manual".
All placeholders filled. Writing SKILL.md.
```

## Anti-Patterns

### ❌ Annoying drill-down

**What it looks like:** User says "auth." Skill asks "Do you mean OAuth 2.0, SAML 2.0, JWT, session-based auth, API key auth, or mTLS?" without the user requesting granularity.

**Why it's wrong:** The user has scoped the work. The skill's job is to fill template fields, not to educate the user about authentication topology. Sub-dividing uninvited is the primary reason teams disable thorough mode and never re-enable it.

**Fix:** Trust the scope. Use "auth" everywhere the template needs a label. If a specific field genuinely requires a sub-choice (e.g., routing work-type), name the field and its legal values. Stop there.

---

### ❌ Inventing fields

**What it looks like:** Skill produces a `charter.md` that includes `## Threat Model` or `## OKRs` because those seem relevant to an auth agent.

**Why it's wrong:** These fields don't exist in the template. Invented structure drifts from the Squad schema, breaks `parseSkillFile`, and surprises the next agent who reads the file.

**Fix:** Write only what the template defines. If the user wants a non-template section, they can add it after the skill exits. Fail closed on every field that isn't in the template.

---

### ❌ Silent coherence drift

**What it looks like:** Skill fills `charter.md` with "Tessa" and `routing.md` with "Taylor" because the user corrected the name mid-session and the skill updated only the current template.

**Why it's wrong:** The diorama renders the routing row as Taylor. The habitat renders the charter as Tessa. The team is now arguing about who owns auth.

**Fix:** Any correction to a fact that appears in multiple templates must trigger an immediate cross-template patch and a confirmation summary before writing.

---

### ❌ Re-asking answered questions

**What it looks like:** Coordinator already established "Tessa's role is Auth Lead." Skill asks "What is Tessa's role?" anyway.

**Why it's wrong:** Wastes the user's time. Signals the skill isn't reading the session context.

**Fix:** Before generating any question, scan the current session context for already-established values. Skip every placeholder that's already answered.

---

### ❌ Writing with blank or TODO-stub placeholders silently

**What it looks like:** Skill writes `charter.md` with `{voice}` still in the file because the user skipped the question and the skill didn't escalate.

**Why it's wrong:** The file is now invalid. `SquadObserver` may or may not flag it. Future agents reading the charter see `{voice}` and don't know what to do.

**Fix:** Fail closed. Surface the gap explicitly. Present the three-option menu (fill now / TODO stub with explicit flag / abandon draft). Never write a placeholder-containing file silently.

---

### ❌ Activating without an explicit opt-in

**What it looks like:** Skill fires on every `add agent` invocation because it's listed in `triggers`.

**Why it's wrong:** Thorough mode is opt-in by design. The Coordinator's native interview is sufficient for routine sessions. Activating uninvited turns a feature into a burden.

**Fix:** The calling flow (Hatchery UI, Scriptorium UI, seed message flag) must explicitly pass `thorough-mode: true` in the session context. The skill checks for this flag before running. If the flag is absent, the skill is a no-op.
