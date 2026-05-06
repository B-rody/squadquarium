# Pocock Pack — status and outreach plan

**Status: PARKED — requires Brady to initiate.**  
**Last reviewed: 2026-05-06T03:51Z (Dallas, Phase 5 Wave 2)**

---

## What it is

The "Pocock pack" is a v2+ stretch goal: explore co-authoring a flagship
Hatcher curriculum with [Matt Pocock](https://github.com/mattpocock) as a
Squad plugin marketplace bundle.

In concrete terms, this would be a bundle named `squad-grill-pocock-pack`
(or a name agreed with Matt) that ships inside the Squadquarium plugin
marketplace browser as a curated, installable collection of SKILL.md files
for TypeScript-heavy teams — structured around Matt's `grill-with-docs`
approach but extended with Squad's full frontmatter schema, Hatchery
integration, and the Scriptorium promotion flow.

Squadquarium's existing `squad-grill-template` skill already cites and links
`mattpocock/skills` and activates a deeper interview mode when his plugin
is installed. The Pocock pack is the natural next step if co-authoring is
on the table.

---

## Why it is blocked

[`mattpocock/skills`](https://github.com/mattpocock/skills) does not have a
clearly confirmed permissive license at the time of this writing. The plan.md
default posture is: **cite + link is always safe; copy or redistribute is not
until the license is confirmed.**

Bundling any of Matt's SKILL.md content into a Squadquarium-distributed plugin
pack would be redistribution. That requires an explicit permissive license
(MIT, Apache 2.0, CC-BY, or similar) or direct co-authoring agreement.
Neither exists yet.

The `squad-grill-template` skill is safe as written: it cites and links to
his work without copying any of his content.

---

## Outreach plan

Brady initiates. Autonomous action is not appropriate here.

**Step 1 — open a GitHub Discussion** in `mattpocock/skills`:

> **Title:** Co-authoring / license question — Squad plugin integration
>
> **Body:** Hi Matt — I'm building Squadquarium, an ambient diorama UI for
> bradygaster/squad teams. My `squad-grill-template` skill already cites your
> `grill-with-docs` approach and links to your repo. I'd love to explore:
>
> 1. License: would you be open to licensing `mattpocock/skills` under MIT (or
>    CC-BY) so downstream tools can redistribute your SKILL.md files with
>    attribution?
> 2. Co-authoring: would you be interested in co-authoring a flagship
>    TypeScript curriculum as a Squad plugin marketplace bundle
>    (`squad-grill-pocock-pack`), with full attribution and co-author credit?
>
> Happy to start with a discussion and go from there. No pressure either way.
> The cite + link is already there regardless.

**Step 2 — wait for response** before any bundle work begins.

**Step 3 — if co-authoring lands:**

- Bundle as `squad-grill-pocock-pack` in the Squadquarium marketplace.
- Full attribution: `author: { name: "Matt Pocock", url: "https://github.com/mattpocock" }` in every SKILL.md.
- Co-author credit in `manifest.json`.
- Parker wires the marketplace backend to surface the pack by default.
- Lambert adds a marketplace entry card in the diorama's marketplace browser.

---

## v3+ timeline

This item is explicitly v3+. It depends on:

1. Brady initiating the conversation.
2. License or co-authoring agreement landing.
3. Squadquarium's plugin marketplace browser shipping (v2 roadmap).

Do not treat this as a v2 deliverable. Do not begin any bundling or
redistribution work before Brady confirms the license situation.

---

## What is safe to do right now (no outreach required)

- **Cite and link:** ✅ already done in `squad-grill-template`.
- **Mention in docs:** ✅ this file + CONTRIBUTING-UPSTREAM.md do that.
- **Offer `mattpocock/skills` as an opt-in marketplace source** in
  `squadquarium doctor` / first-run setup: ✅ safe (we're pointing at their
  repo, not copying content).

---

*This file is a coordination artifact. Brady owns the action. Dallas owns the
doc. Coordinator archives once the conversation is initiated.*
