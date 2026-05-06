# Contributing upstream — two guides

Squadquarium produces work that belongs upstream. This document covers the two
most likely PRs: filing the `squad-grill-template` skill as a Squad built-in,
and proposing Squadquarium as a `squad ui` subcommand of the Squad CLI.

---

## (a) Filing `squad-grill-template` as a Squad built-in skill

### What you're proposing

The skill lives at `.squad/skills/squad-grill-template/SKILL.md`. It is an
opt-in "thorough mode" Hatcher skill: walks every `{placeholder}` in the loaded
template set, grounded in `.squad-templates/squad.agent.md`, and enforces
required-field completeness and cross-template coherence without adversarial
sub-division. It borrows fail-closed discipline from Matt Pocock's
`grill-with-docs` and cites it. It activates a deeper interview mode when his
plugin is installed. Off by default — users opt in per session.

This is the skill's first real use. Squadquarium is the dogfood evidence.

### Steps

```bash
# 1. Fork bradygaster/squad
gh repo fork bradygaster/squad --clone

# 2. Create the target path (check upstream's .squad-templates/ layout first)
mkdir -p bradygaster-squad/.squad-templates/skills/squad-grill-template

# 3. Copy the skill file
cp .squad/skills/squad-grill-template/SKILL.md \
   bradygaster-squad/.squad-templates/skills/squad-grill-template/SKILL.md

# 4. Check if Squad's CONTRIBUTING.md requires a pre-PR issue
#    If yes, file one first — title: "New built-in skill: squad-grill-template (thorough mode)"
gh issue create \
  --repo bradygaster/squad \
  --title "New built-in skill: squad-grill-template (thorough mode)" \
  --body "See the PR body for dogfood evidence and design rationale."

# 5. Branch, commit, push
cd bradygaster-squad
git checkout -b feat/squad-grill-template-builtin
git add .squad-templates/skills/squad-grill-template/SKILL.md
git commit -m "Add squad-grill-template as built-in skill (opt-in thorough mode)"
git push -u origin feat/squad-grill-template-builtin

# 6. Open the PR
gh pr create \
  --repo bradygaster/squad \
  --title "Add squad-grill-template built-in skill (opt-in thorough mode)" \
  --body "$(cat <<'EOF'
## Summary

`squad-grill-template` is a thorough-mode Hatcher skill that walks every
`{placeholder}` in the loaded template set and enforces required-field
completeness and cross-template coherence. It is opt-in (off by default) and
respects user-stated scope — it never sub-divides "auth" into OAuth-vs-SAML
pedantry without being asked.

## Dogfood evidence

This skill was authored and first exercised during Squadquarium's own v1
build. Squadquarium is a Squad project (dogfooded from day one), and the
Hatchery and Scriptorium flows are its primary agent/skill management UX.
Commit history: https://github.com/B-rody/squadquarium

## Pocock credit

The skill borrows fail-closed discipline from Matt Pocock's `grill-with-docs`:
https://github.com/mattpocock/skills — cited and linked in the skill body.
The deep-interview mode activates when his plugin is installed; this skill
does not bundle or redistribute any of his content.

<supporting-info>
  Credit: Matt Pocock / mattpocock/skills — grill-with-docs pattern.
  Cite + link policy; no redistribution without license confirmation.
</supporting-info>

## Nature of the change

v1+ enhancement. Opt-in only. No changes to default Squad behavior.
EOF
)"
```

### After the PR lands

Bump `squad-grill-template`'s confidence from `low` to `medium` in your local
`.squad/skills/squad-grill-template/SKILL.md` once Brady has run thorough mode
in at least one real Hatchery session and reported it useful.

---

## (b) Proposing Squadquarium as a `squad ui` subcommand

### What you're proposing

The Squadquarium web bundle + CLI serve could become a `squad ui` subcommand
of `bradygaster/squad-cli`. That would make `squad ui` an alias for the
diorama launcher flow — no separate global install required for Squad users.

### Coordination first — open a discussion

Before any code, open a GitHub Discussion in `bradygaster/squad-cli`:

```bash
gh discussion create \
  --repo bradygaster/squad-cli \
  --title "Proposal: squad ui subcommand — ambient diorama launcher (Squadquarium)" \
  --body "$(cat <<'EOF'
## Proposal

Squadquarium (https://github.com/B-rody/squadquarium) is a local-only ambient
diorama for Squad teams. It already uses the Squad SDK, reads `.squad/`, and
delegates all mutations to the Squad CLI via PTY. The web bundle is the same
bundle that could be wrapped as a VS Code webview or a Tauri app.

## Ask

Would the Squad CLI team be open to `squad ui` as an alias for the
Squadquarium launcher flow? This would:

- Vendor-import or peer-import the `@squadquarium/core` + `@squadquarium/web`
  packages from `packages/squad-cli/src/commands/ui.ts`.
- Register `squad ui` as the launch command.
- Coordinate naming so we don't collide with the existing `squad rc`
  (remote control) or the SDK's SquadOffice WS bridge.

## Risk flag

The SDK source references an upstream "SquadOffice" visualization effort.
We want to be the ambient/embodied/diorama lane, not compete with SquadOffice.
We need alignment on lane ownership before committing to a `squad ui` surface.

## Squadquarium scope lanes we do NOT claim

- `squad aspire` — OTel dashboard (we link to it, we don't replace it)
- `squad rc` — mobile remote control (orthogonal)
- SquadOffice WS bridge — upstream visualization (we subscribe; we don't host it)
EOF
)"
```

### Steps (after discussion confirms alignment)

```bash
# 1. Fork bradygaster/squad-cli
gh repo fork bradygaster/squad-cli --clone

# 2. Add the ui command stub
mkdir -p bradygaster-squad-cli/packages/squad-cli/src/commands
cat > bradygaster-squad-cli/packages/squad-cli/src/commands/ui.ts << 'EOF'
// squad ui — launches the Squadquarium diorama for the current squad context.
// Vendors or peer-imports @squadquarium/cli; coordinates with SquadOffice lane.
// TODO: fill in after upstream alignment discussion resolves.
export {};
EOF

# 3. Branch, commit, push
cd bradygaster-squad-cli
git checkout -b feat/squad-ui-subcommand
git add packages/squad-cli/src/commands/ui.ts
git commit -m "Stub: squad ui subcommand (Squadquarium diorama launcher)"
git push -u origin feat/squad-ui-subcommand

# 4. Open a draft PR (link to the discussion)
gh pr create \
  --repo bradygaster/squad-cli \
  --draft \
  --title "[Draft] squad ui — ambient diorama launcher (Squadquarium)" \
  --body "Companion to discussion #<N>. Stub only — implementation follows once alignment is confirmed."
```

### Naming risk

The SDK source names the WS bridge after an upstream "SquadOffice"
visualization. Do not ship anything that uses the name `SquadOffice` or
claims the `squad office` command surface without explicit sign-off from the
Squad RC team. Squadquarium's lane is **ambient / embodied / diorama** — not
remote control, not OTel, not the SquadOffice lane.
