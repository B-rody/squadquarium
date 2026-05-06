# Squadquarium

> A no-click idle diorama for your AI dev team.
> Squad does the work. Squadquarium makes the team feel alive.

A community UI wrapper around [bradygaster/squad](https://github.com/bradygaster/squad).
Squad is the engine; Squadquarium is the delightful desktop companion/control
room layered on top. Independent OSS, weekend-hack scope, with a path to PR
upstream as `squad ui`.

**Dogfooded from day one.** Squadquarium is itself built by a Squad team
(`squad init` in this repo). The fish in the aquarium are the agents writing
the aquarium. This is the strongest possible "show, don't pitch" demo and
makes us a real-world stress test of the CLI + SDK we depend on.

**Niche, vs. existing upstream surfaces.** Squad already ships an OTel
dashboard (`squad aspire`) and a remote-control web app (`squad rc`), and
the SDK has a WebSocket bridge intended for an upstream "SquadOffice"
visualization. Squadquarium is deliberately **none of those** — it is the
ambient, embodied, terminal-styled diorama lane. We can subscribe to the same
event stream those tools use without competing with them.

## Why this works

Squad's CLI and `.squad/` directory are already a structured, file-based "save game" of a
team: `agents/{name}/charter.md`, `history.md`, `decisions.md`, `orchestration-log/`,
`log/`, `skills/`, `identity/wisdom.md`, `casting/registry.json`. The UI is an
observer, command launcher, and playful renderer of state Squad already
produces; no upstream changes required for v0.

Better still: Squad ships a real **SDK** (`@bradygaster/squad-sdk`) with a
typed state facade, a filesystem observer, an event bus, a tool-call hook
pipeline, and a WebSocket bridge already wired up for external
visualization consumers. We don't have to scrape Squad's state — we can
subscribe to it.

Adjacent project [bradygaster/squad-places](https://github.com/bradygaster/squad-places)
is the social layer; Squadquarium is the aquarium-in-front-of-you layer. Different
problems, complementary metaphors.

## Squad primitives we hook into

Squad uses **both agents and skills as first-class primitives**, with
distinct on-disk shapes and lifecycles. Squadquarium needs to render and
respect both.

| Primitive | On disk                                       | Scope                                  | Created via                                            | Lifecycle                                |
| --------- | --------------------------------------------- | -------------------------------------- | ------------------------------------------------------ | ---------------------------------------- |
| Agent     | `.squad/agents/{name}/charter.md` + `history.md` | One persona; identity, role, voice    | `squad init`, `defineAgent()` + `squad build`, or `onboardAgent()` SDK | active / inactive / retired / `_alumni/` |
| Skill     | `.squad/skills/{name}/SKILL.md` (with frontmatter) | Team-wide; matched by triggers + role | drop a `SKILL.md`, `defineSkill()` + `squad build`, or "earned" by an agent during work | confidence: low → medium → high (only increases) |

Skills are **not** owned by individual agents; they're a shared library the
match engine pulls from based on the current task and the acting agent's
role. That means in the aquarium, **agents live on floors**, but **skills
live in a shared room** — a library / shrine wing — not as badges welded
onto a single fish.

## Product boundary

**Squadquarium may call `squad`; it must not become `squad`.**

| Layer | Owns |
| --- | --- |
| Squad | Agents, orchestration, CLI commands, repo state, `.squad/`, behavior |
| Squadquarium | Install/setup UX, desktop window, worker diorama, animations, status display, buttons/forms that invoke `squad` |

Hard rules:
- Installing Squadquarium should verify/install the required Squad CLI/runtime,
  or give a clear guided path when it cannot.
- First-run setup may offer to initialize the repo and install the default Squad
  agents, but it should do so by running Squad's official bootstrap/add-agent
  commands.
- Agents are installed, added, removed, and managed through Squad's mechanisms,
  not through a parallel Squadquarium agent system.
- Every management action maps to a visible/copyable `squad ...` command.
- `.squad/` remains the source of truth. Squadquarium observes it and may invoke
  Squad commands, but it never edits agent behavior behind Squad's back.
- The fun/game layer is visual interpretation only; it never changes what agents
  decide to do.

## North star

- **Ambient by default.** Zero required interaction. Glance-able from across a room.
  It should feel like a tiny idle office/village that comes alive because Squad
  is working, not because the user is clicking.
- **Drill-in on demand.** Tap an agent → full reasoning trace, history, decisions.
- **CLI parity.** Management UI is friendly, but every serious action delegates
  to the real Squad CLI and can show the equivalent command.
- **Optional game layer.** Off by default; flip a setting to get XP, daily-summary
  cartoons, cosmetic loot. The game NEVER drives agent behavior.
- **Local-first.** All data stays on disk. No network calls except those Squad itself makes.

## Form factor

**Node CLI; the GUI is a web bundle the CLI serves.** Install via
npm, launch from any terminal:

```bash
npm install -g squadquarium
squadquarium                  # opens browser to the diorama
squadquarium --personal       # force personal/global squad view
squadquarium /path/to/repo    # specific repo
```

No installer, no MSI/.dmg/.deb, no code signing, no platform-specific
binaries to manage. Distribution is `npm publish`; cross-platform
support is whatever Node + a browser already give us. Same shape as
Squad itself — Squad's `npm install -g @bradygaster/squad-cli` →
`squad …` becomes our `npm install -g squadquarium` → `squadquarium`.

**Context resolution** (what the diorama opens to):

1. If `cwd` (or the explicit path arg) contains `.squad/` — open that.
2. Else walk up parents looking for `.squad/`; attach if found.
3. Else, if a personal/global squad exists at Squad's standard
   personal location (the directory `squad personal` operates on),
   open that as the home reef.
4. Else, show the empty-state with a "Bootstrap Squad here" button
   that runs `squad init` in the current directory.

`--personal` forces (3) regardless of cwd. `<path>` is treated as the
candidate for (1)/(2). Multiple aquariums (project + personal shown
side-by-side as separate habitats) is a v2 stretch.

**Why browser, not Tauri.** v0 trades the always-on-top desktop-window
ambience for zero-friction install and zero packaging burden. Users
who want a standalone-window experience get a PWA "Install app"
affordance (one click in modern browsers — the v0 build ships a PWA
manifest so this works). v1+ revisits a real native shell wrapper
(Tauri or similar, published as a separate `squadquarium-app`
package) once the demo lands and someone asks for it.

**Reusability.** The same web bundle is what we'd PR upstream as a
`squad ui` subcommand or wrap as a VS Code webview later. We're not
locking ourselves into Tauri's lifecycle just to get pixels on a
screen.

## Visual style

**Terminal-styled GUI.** Squadquarium is a desktop app drawing
terminal-looking content on a Canvas2D grid: monospace glyphs, ANSI
24-bit color, optional CRT scanlines + bloom + curvature. It is *not*
a real TUI (it doesn't run inside your terminal), but it reads as one
— and it can do things a real TUI can't (bloom, sub-pixel parallax,
camera pans, sound, mouse interaction). See
[TUI vs GUI rationale](#tui-vs-gui-and-the-modes-question) in
[Modes](#modes) below.

**Sprites are character mosaics.** Each agent's sprite is an N×M grid
of glyph cells from a curated Unicode palette (block elements
`█▓▒░`, box-drawing `╭╮╰╯─│║`, geometric `◆○●▲▼◀▶`), with per-cell
foreground/background color. Animation = glyph substitution + color
easing at ~12fps (terminal-natural choppiness, not jank).

**Layout — the c′ split.** The window is wrapped in terminal-styled
chrome (double-line border, monospace, phosphor palette, bloom,
scanlines) and contains two protected zones:

- **Habitat panel** — creatures, set-dressing glyphs, ambient drift.
  This is the dashboard. Creatures live here.
- **Log panel** — real `squad watch` (or chosen Squad command) output,
  rendered through xterm.js. **Never trespassed by creatures**, so
  logs stay readable.

```
╔═ squadquarium ═══════════════════════════════ phosphor-cyan ═╗
║ ┌─ habitat ──────────────────┐ ┌─ logs · live ─────────────┐ ║
║ │     (°)>=<                  │ │ 14:32 lead → tessa         │ ║
║ │       lighthouse perch      │ │   "draft auth charter"     │ ║
║ │  ╔═╦╗  coral garden         │ │ 14:32 tessa: ⚙ edit        │ ║
║ │  ║║║║                       │ │ 14:33 tester: ▶ vitest     │ ║
║ │  ▲▼▲▼  engine reef          │ │ 14:33 tester: ✓ 47 passed  │ ║
║ │  ▓▓▓   test tank            │ │                            │ ║
║ └─────────────────────────────┘ └────────────────────────────┘ ║
║ > squad watch · streaming                            ▓▓░░░ 60% ║
╚═════════════════════════════════════════════════════════════════╝
```

The split is resizable; each panel can collapse to full-bleed when
the user wants immersion or focus. Diegetic linkage: when an agent
edits a file, the habitat shows the editing glyph animation *and*
the log panel surfaces the corresponding line — parallel views of
the same event, no occlusion.

**Why banded / multi-tier in glyph form.** Different agents at
different vertical bands give activity a spatial "where" at a glance.
The bands map to roles cleanly — Lead high, Lab low — and inter-tier
glyph drift (bubble / current tracks for Aquarium; pneumatic-tube
glyphs for Office) reads as coordination. Same metaphor as the
original pixel-art platformer pitch, just rendered in characters.

**Why this aesthetic.** Squad's CLI is itself a React+ink TUI; the
natural visual home for "watch your CLI agents work" is a terminal.
Free assets (Unicode is built in), distinctive (no one ships idle
creature TUI dashboards), culturally aligned with the
charm.sh / lazygit / btop / cogmind crowd, and `squad`'s actual
stdout becomes a first-class diegetic surface inside the window.

**Building bands (Aquarium skin, default; Office equivalents in
[Skins](#skins)):**

| Band             | Role                     | Aquarium dressing                                          |
| ---------------- | ------------------------ | ---------------------------------------------------------- |
| Top              | Lead                     | Lighthouse perch, kelp throne, periscope                   |
| Mood lagoon      | Frontend                 | Coral garden, mood-shells, pearl mannequin                 |
| Engine reef      | Backend                  | Hydrothermal vents (`▲▼▲▼`), brass valves                  |
| Test tank        | Tester                   | Specimen jars, vials (green pass / red fail), goggles      |
| Sunken library   | Scribe                   | Coral bookshelves, nautilus quill, scroll-in-bottle        |
| Lobby reef       | Coordinator / front desk | Sponge reception, message-in-a-bottle racks (Issues / PRs) |
| Deep trench      | Ralph (watch)            | Anglerfish patrol with bioluminescence; night shift        |
| Visitor cave     | `squad link` guests      | Whaleshark dock; plankton-cloud guest arrives              |

Inter-tier coordination shows as glyph drift between bands (a chain
of `°` bubbles rising for "Frontend asks Lead a question"). Drill-in
zooms by changing cell size in pixels and shifting the rendered
sub-region.

For v0, ship with **3–4 bands** (Lead, Frontend, Backend, Scribe) and
grow as agent rosters demand. Some prose elsewhere reads in Office-skin
vocabulary (workstation, lobby) for legibility — the skin manifest's
`vocab` map handles that swap at render time.

## Skins

The world shape is fixed (banded glyph habitat + log panel + terminal
chrome) but **palette, glyphs, and dressing are themable**. A skin is
a versioned manifest:

```
skin/{name}/
├── manifest.json   # versioned manifest (see schema below)
├── sprites.json    # per-role sprite grids per state/frame
├── habitat.json    # band layouts + ambient set-dressing rules
├── vocab.json      # label overrides ("elevator" → "current")
├── tokens.css      # CSS variables (palette, type sizing, motion)
└── sound/          # optional: ambient + transient SFX
```

**Manifest schema (locked before v0 ships):**

```jsonc
{
  "manifestVersion": 1,                   // schema version
  "name": "aquarium",
  "version": "0.1.0",                     // skin author's version
  "engineVersion": ">=0.1.0 <0.2.0",      // Squadquarium engine compat range
  "license": "MIT",                       // SPDX identifier; required
  "author": { "name": "...", "url": "..." },
  "font": {
    "family": "JetBrains Mono",
    "fallback": "monospace",
    "asset": "fonts/JetBrainsMono.woff2"  // optional bundled font
  },
  "palette": {
    "bg": "#001f1c",
    "fg": "#00bfa5",
    "accent": "#80cbc4",
    "alert": "#ff5252",
    "dim": "#004d40"
  },
  "glyphAllowlist": ["█","▓","▒","░","╭","╮","╰","╯","─","│","║"," ", "..."],
  "capabilities": ["bands", "drift", "scanlines"],   // optional features used
  "fallbacks": {
    "celebrate": "working"                // fall back to another state if a frame is missing
  },
  "x-author-notes": "..."                 // namespaced extensions allowed
}
```

`sprites.json` defines sprite cells per role per state per frame
(`idle`, `working`, `blocked`, `celebrate`); each cell is
`(glyph, fg, bg, blink?)`. `habitat.json` defines band ordering and
ambient glyph-drift rules. `vocab.json` is a flat key→label map.

**Two skins ship in v0** (per the rubber-duck "ship the architecture,
keep the content cheap" guidance):

- **Aquarium** (default; polished). Phosphor cyan-on-deep-teal.
  Anglerfish Lead `(°)>=<` with a flickering `*` lure; seahorse
  Frontend; octopus Backend; pufferfish Tester (puffs on red); squid
  Scribe; bioluminescent Ralph patrolling the trench.
- **Office** (alternate; minimal). Phosphor amber-on-near-black. Tiny
  `[¤]` people at `╔═╗` desks; server racks `▓▓▓` blinking. Same
  sprite grid sizes as Aquarium so the loader doesn't reflow.
  **Content is intentionally minimal in v0** — palette + 4 sprite
  variants — to prove the manifest schema, not to be polished.

The default is set in app preferences; a single toggle swaps skins
without restart. **Skin system is a v0 architectural commitment** —
splitting visuals from data on day one is the only way to keep the
metaphor honest. The v0 Office skin's polish is deliberately deferred;
the schema lock is what matters now.

**Font determinism.** Glyph mosaics depend on consistent cell metrics.
The skin manifest names a required font with an optional bundled
asset (`woff2`); the engine refuses to render with the system fallback
and surfaces an error if the font fails to load. Ligatures disabled
(`font-feature-settings: "liga" 0`). The glyph allowlist is enforced
at render time; missing glyphs render as `▢` with a dev-console
warning.

**Cross-platform glyph test matrix.** Every skin must pass a render-diff
test on Win/macOS/Linux at 1× and 2× DPI. Without this, "sprites break
in Linux Chromium" becomes a v2 community-pack PR-rejection spiral.

| Aquarium band  | Office band      | Office dressing                                          |
| -------------- | ---------------- | -------------------------------------------------------- |
| Top            | Roof / penthouse | Corner office, whiteboard, city view                     |
| Mood lagoon    | Studio floor     | Drafting tables, mannequin, mood-board wall              |
| Engine reef    | Engine room      | Server racks, blinking LEDs, pipes                       |
| Test tank      | Lab mezzanine    | Beakers, test tubes (green/red on pass/fail), goggles    |
| Sunken library | Library wing     | Bookshelves, podium with quill, archive cabinets         |
| Lobby reef     | Lobby            | Reception, mailboxes (Issues), pneumatic tubes (PRs)     |
| Deep trench    | Basement         | Janitor's closet, flashlight, mop bucket                 |
| Visitor cave   | Garage / dock    | Delivery truck arrives with guest agents                 |

v2 opens the manifest format to community contributions: deep trench,
cottage village, space station, fungus colony — same bones, new
glyphs.

## Modes

Squadquarium has two interaction modes. **Picking one per surface
prevents the cursed Frankenstein UX** where a real TUI and a custom
GUI panel compete to drive the same flow.

### Ambient mode (default)

The everyday view. GUI-primary, mouse-driven, glanceable.

- The habitat panel renders the agent diorama in glyph form
- The log panel renders Squad's actual stdout (read-only, via xterm.js)
- Click a creature → drill-in panel slides in
- Click a log line → camera pans to the relevant agent
- Right-click → context menu with copyable `squad ...` / `sqq ...` equivalents
- `:` opens the command palette (vim-style); `:trace tessa` etc.
- Keyboard navigation works everywhere

In Ambient mode, the embedded terminal is **read-only** — no input
focus, no keystroke capture. It's a window onto Squad's events.

### Interactive mode (modal)

Triggered by user action — clicking **Hatch new teammate**,
**Inscribe new skill**, **Bootstrap Squad here**, or **Open
Coordinator** from the command palette. The embedded terminal takes
focus and runs a real `squad ...` session through node-pty + xterm.js.
The Coordinator's React+ink TUI renders inside the panel; the user
types responses directly. The aquarium continues animating (so the
diorama responds to the user's typing in real time), but mouse
interactions on the habitat are dimmed / debounced — focus belongs to
the terminal.

Modal exit (ESC or close button) returns the embedded terminal to
read-only ambient state and restores habitat interactivity.

### TUI vs GUI and the modes question

A real **TUI** (vim, htop, lazygit) renders text into a real terminal
emulator and is constrained by what ANSI supports — no transparency,
no shaders, no smooth animation. A **GUI** draws pixels into its own
window and can do anything pixels can. Squadquarium is a GUI styled to
look like a terminal: terminal aesthetic + GUI superpowers (bloom,
sub-pixel parallax, sound, camera pans, mouse). Inside that GUI we
*also* render real Squad TUI output through xterm.js, which is what
makes the metaphor feel diegetic.

The mode split keeps that fusion honest: when the user is just
watching, the GUI drives; when the user is conversing with the
Coordinator, the TUI drives. We never half-replace TUI controls with
fake GUI ones.

## Activity grammar (telemetry → animation)

Bands make most actions read at a glance — each agent stays in their
band; animations happen *at* their position. The core fantasy is "a
glyph creature team is busy in the terminal," but every animation is
a visual translation of real Squad state, rendered against per-band
ambient drift.

Animations are described in idle-game-platformer language below for
legibility; in practice they're glyph-cell substitutions on the
agent's sprite + transient glyph emissions (`*` / `·` / `▰▱`) for
effects + palette pulses for state transitions.

| Squad signal                                  | Visible behavior                                                |
| --------------------------------------------- | --------------------------------------------------------------- |
| Agent log file mtime advancing                | Typing at workstation, screen flickers                          |
| `view`/`grep` tool calls                      | Flipping through a stack of folders, magnifying glass           |
| `edit`/`create` tool calls                    | Welding at workbench, sparks fly, code-block grows on a stack   |
| Test run tool calls                           | Lab rack of test tubes fills (green pass / red fail) bottom-up  |
| Web search                                    | Library card catalog drawer slides open                         |
| Append to `decisions.md`                      | **Scribe** at podium quill animates; archive cabinet drawer fills |
| Sub-agent spawn                               | Pneumatic tube whooshes between floors, then a clipboard arrives |
| Inter-agent coordination                      | Elevator/stairs animation: agent rides between floors            |
| Human approval pending                        | Agent walks to lobby, holds up sign for the user avatar          |
| Error / stuck                                 | Red bubble, sits on the floor with arms crossed                  |
| Idle                                          | Reads a book / naps in chair                                     |
| Long uptime, large context                    | Tired sprite, aura ring shows context fullness                   |
| Recent merge                                  | Confetti from ceiling, building lights flash                     |
| Watch daemon (Ralph) polling                  | Night-shift janitor walks the basement with flashlight           |
| Visiting agent (`squad link`)                 | Delivery truck pulls into garage; guest steps out                |

## Drill-in panel (per agent)

- **Charter card** — avatar, role, voice, expertise (`charter.md`)
- **Live trace** — current goal, current tool call, last N reasoning steps,
  context gauge (sourced from `EventBus` `session:tool_call` + `session:message` events)
- **Today timeline** — scrubbable, sourced from `orchestration-log/`
- **Memory** — searchable `history.md`
- **Decisions** — slice of `decisions.md` filtered by author
- **Matched skills** — for the current task, the skills that scored a match
  for this agent (read-only; shows *which* shared skills are influencing
  the agent right now)

## The Hatcher

Creating new agents and new skills doesn't need a Squadquarium-internal
LLM call — Squad's Coordinator already does it. When the user runs
`squad init` or says "add a security specialist" mid-session, the
Coordinator reads `.squad-templates/charter.md`, `roster.md`,
`routing.md`, etc. as part of its system-prompt context (driven by the
93 KB master prompt `squad.agent.md`), asks the questions implied by
the `{Name}`, `{Role}`, `{user name}`, `{domain}` placeholders, and
writes the filled-in files into `.squad/`. **There is no parser**
anywhere in Squad's source — confirmed by code search; the LLM does
the elicitation. Brady already authored the curriculum.

So **v0's "Hatcher" is just Squad's Coordinator** with a seeded prompt
and a visualization layer. The Hatchery and Scriptorium UI surfaces
spawn (or continue) a Squad session pre-seeded with "add an agent" /
"add a skill," surface the Coordinator's questions in a side panel,
and watch `.squad/agents/` and `.squad/skills/` for new files via
`SquadObserver`. When files land, the hatching/inscription animation
plays. **The differentiator is the visualization, not the questions** —
Squad already asks the right ones.

### v1+ enhancement: `squad-grill-template` (deferred)

Once we've used the Coordinator path in real life and felt its gaps,
v1 adds an optional Squadquarium-authored skill,
**`squad-grill-template`**, that the Hatcher reaches for **only in
opt-in "thorough mode."** Its job is **coherence and completeness**,
not adversarial drill-down:

- **Respect user scope.** "Auth" means all auth — don't sub-divide
  into "OAuth? SAML? JWT?" unless the user asks for granularity.
  Annoying-grilling is the failure mode; we explicitly avoid it.
- **Fill required template fields.** Walk every `{placeholder}` in the
  loaded template set; ask only what's strictly needed to write the
  file; ground each question in `squad.agent.md` so the *why* is
  visible.
- **Cross-template coherence.** Loaded against an agent set, confirm
  that "Tessa owns auth" consistently fills `charter.md` (What I Own)
  *and* `routing.md` (a row) *and* `roster.md` (an entry). This is
  mechanical and high-value, and the Coordinator does it inconsistently
  today.
- **Inspectable.** Unlike `squad.agent.md` (93 KB, only Brady edits),
  this is a forkable SKILL.md anyone can read and improve.

Parameterized by template set — Hatchery hands it agent templates,
Scriptorium hands it `{ skill.md }`, future surfaces (Ceremonies,
Casting, MCP, Plugin marketplace) hand it the matching set with zero
new skill code. Borrows fail-closed discipline from Matt Pocock's
`grill-with-docs` (ground in real files, never invent) but tuned to
"scope-respecting completeness + coherence" rather than his stricter
sub-divide style. Credit and link to
[`mattpocock/skills`](https://github.com/mattpocock/skills) in
`<supporting-info>`. When his plugin is installed, an opt-in
"deep-interview" toggle wakes up his stricter grill for users who
want it.

**Frontmatter compatibility.** Both paths (v0 Coordinator-driven, v1+
skill-driven) write SKILL.md against `.squad-templates/skill.md`, so
the produced files always have full Squad frontmatter (`domain`,
`triggers`, `roles`, `tools[]`). The compatibility gap is contained
to users who **bypass** the Scriptorium and `squad plugin install`
Matt's skills directly — those load (Squad's `parseSkillFile` is
lenient) but lose skill-aware routing affinity until someone backfills.
The Scriptorium detects Matt-format files on disk and offers a
one-click "promote to full Squad frontmatter" flow.

## Hatchery — adding a new teammate

A side-room (a clutch of warm eggs in the Aquarium skin; a hiring booth in
the Office skin) where new teammates are born. Brady fully specifies the
on-disk shape — this is a thin, opinionated UI on top of his canonical
artifacts.

The flow:

1. User clicks **Hatch new teammate**. Squadquarium switches the
   embedded log panel into [**Interactive mode**](#interactive-mode-modal):
   it spawns or attaches to a Squad session via node-pty, the
   Coordinator's React+ink TUI renders inside the panel through
   xterm.js, and the user message is pre-seeded as "add a new agent."
   The Coordinator drives — Squadquarium does **not** replicate its
   prompts in custom GUI controls.
2. The Coordinator (driven by
   [`.squad-templates/squad.agent.md`](https://github.com/bradygaster/squad/blob/dev/.squad-templates/squad.agent.md))
   walks the user through the Init/Team-Mode questions implied by the
   `{...}` placeholders in
   [`charter.md`](https://github.com/bradygaster/squad/blob/dev/.squad-templates/charter.md),
   `history.md`, `roster.md`, and `routing.md` — Identity (name, role,
   expertise, style), What I Own, How I Work, Boundaries (handle /
   don't handle / unsure / review-rejection rule), Model preference,
   Voice (1–2 opinionated sentences — the charter template is explicit
   that voice "must have OPINIONS"). Cross-template coherence (charter
   ↔ routing ↔ roster) is whatever the Coordinator does today; v1 may
   layer the `squad-grill-template` skill on top in opt-in "thorough
   mode" for stricter coherence.
3. If the user picks one of the seven SDK role templates
   (`lead`, `developer`, `tester`, `scribe`, `ralph`, `designer`,
   `architect`), `onboardAgent()` uses its built-in scaffold for that role.
   Otherwise the Hatcher passes the assembled charter as `charterTemplate`
   so the user-authored content is honored verbatim.
4. **Atomic write** at the end:
   - `onboardAgent()` writes `.squad/agents/{name}/charter.md` and
     `history.md`
   - `addAgentToConfig()` adds the routing rule when work-type is one of
     `feature-dev | testing | documentation | architecture | design`
   - The Hatcher itself appends the `team.md` row (`✅ Active`) and any
     additional `routing.md` patterns the user described
   - Optional: allocate a name via the casting registry
5. **Hatching ritual** (glyph form). Once `SquadObserver` confirms
   the new agent's files are on disk, the habitat plays a band-local
   animation: an empty cell in the appropriate band brightens, a
   glyph-by-glyph "spawn" sequence resolves into the new agent's
   sprite (Aquarium: an `o` swells to `(°)>=<`; Office: a desk lights
   up and a `[¤]` figure walks on). Camera pans the canvas viewport
   to the new home. On exit from Interactive mode, the log panel
   returns to read-only ambient streaming. Done.

A "what just happened" panel shows every step's equivalent SDK / CLI
invocation, copyable — CLI parity with the canonical shapes.

## Scriptorium — adding a new skill

A shared room on the library level — a sunken library with scrolls in jars
in the Aquarium skin; a glass-walled archive with quill stations in the
Office skin. Skills are team-wide in Squad, so the Scriptorium is one room
for the whole team, not a per-agent panel.

The flow:

1. User clicks **Inscribe new skill**. Squadquarium switches the
   embedded log panel into [**Interactive mode**](#interactive-mode-modal):
   it spawns or attaches to a Squad session via node-pty, the
   Coordinator's React+ink TUI renders inside the panel through
   xterm.js, and the user message is pre-seeded as "add a new skill."
   Same ownership rule as Hatchery — Coordinator drives, no
   GUI-replicated prompts.
2. The Coordinator walks the frontmatter elicitation directly from the
   placeholders in
   [`.squad-templates/skill.md`](https://github.com/bradygaster/squad/blob/dev/.squad-templates/skill.md):
   `name` (kebab-case, becomes the directory), `description`, `domain`
   (required for routing), `confidence` (default `low`), `source`
   (`manual` for hand-authored), optional `triggers[]` (keyword list),
   `roles[]` (which agent roles benefit), optional `tools[]` (MCP tools
   relevant to this skill).
3. Body content is assembled against the `skill.md` shape: `## Context`,
   `## Patterns`, `## Examples`, `## Anti-Patterns`. When
   `mattpocock/skills/write-a-skill` is installed, the Coordinator can
   be nudged to use Matt's body-elicitation prompts inside our section
   structure.
4. **Validation**: assembled SKILL.md is parsed by `defineSkill()` /
   `parseSkillFile()` before write, so we don't ship malformed files to disk.
5. **Inscription ritual** (glyph form). When `SquadObserver` confirms
   the new file under `.squad/skills/`, a scribe-figure stamp
   animation plays in the library band (a blank scroll-glyph fills
   character-by-character; the SkillsCollection refreshes). Any
   active agent whose role matches the new skill's `roles[]` gets a
   chip pulse on their drill-in panel.

The Scriptorium also doubles as the canon view of `.squad/skills/*` —
confidence badge, domain, source provenance
(`manual` / `observed` / `earned` / `extracted`), trigger keywords, role
affinity, and recent agents that consulted the skill. From here the user
can also browse and one-click install plugins from configured Squad
marketplaces (default-included `anthropics/skills`, `awesome-copilot`;
optional `mattpocock/skills` once added).

## Optional game layer (toggle)

Maps real Squad artifacts onto idle-game-feeling mechanics. This is a cosmetic
Tomodachi/Tamagotchi-ish care-and-mood layer, not an optimization loop:

| Mechanic           | Real source of truth                                           |
| ------------------ | -------------------------------------------------------------- |
| XP / levels        | Lines edited, tests added, PRs merged, decisions recorded      |
| Skill tree         | Existing `.squad/skills/` directory                            |
| Achievements       | Notable entries in `decisions.md`                              |
| Idle accrual       | Ralph (`squad triage --execute`) running overnight             |
| Currency ("ideas") | Earned per merged PR; spent on cosmetic loot only              |
| Prestige           | `squad nap --deep` / `squad export` as soft-resets             |
| Co-op / trading    | `squad link` + visiting agents from other repos                |
| Daily quest        | Today's GitHub Issues triaged into "missions"                  |
| Boss fight         | "Shippable PR" — stat-checks against tests + lint + reviewer   |
| Run summary        | Stand-up cartoon: XP, skills unlocked, what each agent learned |

Hard rule: cosmetics are purely visual; game state must never alter agent behavior.
No click economy, production multipliers, or incentives that pull agents
off-task.

## Tech stack

### Monorepo layout

A pnpm workspace; each package is independently testable. The
**published artifact** is a single npm package (`squadquarium`) that
bundles the built web assets — the workspace structure is internal /
dev-only. One package on npm, three packages in the repo.

```
squadquarium/
├── packages/
│   ├── core/   # Squad SDK wrapper, observer, event reconciler,
│   │           # PTY pool, trace correlator. No UI. Runs in Node.
│   ├── web/    # React 19 + Vite + Canvas2D diorama (browser bundle)
│   └── cli/    # `squadquarium` (alias `sqq`) Node binary: arg parsing,
│   │           # context resolution, http/ws server, opens browser
├── skins/
│   ├── aquarium/
│   └── office/
└── .squad/     # the team building Squadquarium (dogfooding)
```

`core` is the only package that imports `@bradygaster/squad-sdk`.
`web` consumes `core` over a loopback WebSocket. `cli` boots `core`
and serves `web`'s built assets.

### Process model

A single Node process. No Rust, no sidecar, no JSON-RPC over stdio,
no cross-language IPC.

- `cli` parses the command + flags, resolves the squad context (see
  [Form factor](#form-factor)), boots `core`, and starts a local HTTP
  server (Fastify or stdlib `http`; auto-pick port like Vite does).
- `core` holds the Squad SDK adapter, `SquadObserver`, the `node-pty`
  PTY pool, and the event reconciler.
- `web` is a React build served as static assets by the same HTTP
  server. It talks to `core` over **a single WebSocket on loopback**
  (`127.0.0.1` only — no cross-origin, no auth needed in v0).
- `cli` opens the user's default browser at the served URL using the
  `open` package (which handles `xdg-open` / `start` / `open`
  per-platform).

For dev: `vite dev` serves `web` with HMR; `cli` proxies to the Vite
dev server when `NODE_ENV=development`. In prod: a single `npm start`
that serves the prebuilt bundle.

### Browser + renderer

- **UI:** React 19 + Vite 7 + TypeScript 5
- **Renderer:** Canvas2D drawing glyph cells from a font atlas. Plain
  monospace text with per-cell color is enough for v0; WebGL only if
  Canvas2D hits a perf wall (1k+ cells animating per frame).
- **Terminal embedding:** `xterm.js` + `@xterm/addon-fit`
  + `@xterm/addon-web-links`. Hyperlinks **disabled** by default for
  security (see [ANSI trust boundary](#ansi-trust-boundary)).
- **PTY:** `node-pty` runs in `core` (Node side). xterm.js in the
  browser ships PTY input/output over the loopback WebSocket.
- **CRT effects:** CSS filters (bloom = soft `blur` + `box-shadow`,
  scanlines = repeating linear-gradient overlay, optional barrel
  distortion via SVG filter). Toggleable.
- **Standalone window:** `web/index.html` includes a PWA manifest +
  service worker so Chrome/Edge users can "Install" the app and
  launch it as its own window. Manifest ships in v0 so the
  affordance exists even if the icon set isn't pretty yet.

### Distribution

- Published as `squadquarium` to npm. Single package, semver,
  zero-config install. `bin: { "squadquarium": "...", "sqq": "..." }`
  — same script, two names; `sqq` is the muscle-memory shortcut.
- Postinstall: `node-pty` rebuilds via the standard `node-gyp` flow.
  We **do not** prebuild platform binaries in v0 — failures surface
  through `squadquarium doctor` and are documented in the README.
  Prebuilds via `prebuildify` / `node-gyp-build` are a v1 polish
  item if `node-gyp` friction shows up in real installs.
- No Tauri, no Electron, no native shell in v0. v1+ may publish a
  separate `squadquarium-app` package that wraps the same web bundle
  in Tauri for users who want a real desktop window.

### Squad integration (hybrid)

- **Reads / live state** via `@bradygaster/squad-sdk` (in `core`):
  - `resolveSquad(cwd)` to detect `.squad/`; same call walks up
    parent dirs for context resolution
  - Personal/global squad detection: probe Squad's standard personal
    location (the path `squad personal` operates on); fall back
    gracefully if not present
  - `SquadState` typed collections
    (`AgentsCollection`, `SkillsCollection`, `DecisionsCollection`,
    `RoutingCollection`, `LogCollection`)
  - `SquadObserver` (200ms debounce, classifies into
    `agent | skill | decision | casting | config`)
  - `EventBus` + `startWSBridge({ port: 6277 })` for live session
    events (the SDK source documents this as the integration point
    for external visualizers — exactly our use case)
- **Mutations** via the `squad` CLI in PTY (so the user sees real
  Squad output and `squad`'s own React+ink TUI), exposed in our
  Interactive mode flows.
- **Adapter boundary:** `core` wraps `SquadState` in a thin facade.
  Squad is alpha; CHANGELOG warns of breaking changes between
  releases. We pin a known SDK version per Squadquarium release.
- **Runtime requirement:** Node ≥ 22.5.0 with hard-fail below;
  `squad` on `PATH` (or fall back to
  `npx @bradygaster/squad-cli`). `squadquarium doctor` detects both
  and surfaces fix-up commands.

### Event reconciliation

The SDK exposes four event sources that can — and will — disagree:
`bus`, `pty` (terminal output), `fs` (`SquadObserver`), and `log`
(orchestration log tail). Squadquarium normalizes them into a single
envelope from day one (`packages/core/events.ts`):

```ts
type SquadquariumEvent = {
  sessionId: string;
  source: 'bus' | 'pty' | 'fs' | 'log';
  seq: number;                 // monotonic per source
  entityKey: string;           // e.g. 'agent:tessa'
  causedByCommandId?: string;  // links UI actions to results
  observedAt: number;
  payload: { /* discriminated by source */ };
};
```

Source precedence: `bus > pty > fs > log`. A snapshot watermark per
entity prevents debounced FS snapshots from clobbering newer live
state. Dedupe key is `(entityKey, causedBy, seq)`. **Event
reconciliation is a v0 invariant**, not a v1 hardening — without it,
the diorama and the log panel will diverge under load and the demo
becomes a hunt for "which one is lying."

### ANSI trust boundary

Squad CLI output flows into `xterm.js`. We treat it as untrusted by
default:

- Hyperlinks: opt-in only (off in v0). When on, every clicked URL
  prompts a confirm dialog with the resolved target.
- OSC sequences: restricted allowlist (cursor/title only; no
  clipboard, no bell-spam, no "set system color").
- No clipboard write API binding to the terminal.
- Log panel is **read-only** in Ambient mode. Selection + copy is
  fine; paste is a no-op.
- Loopback only: the local server binds to `127.0.0.1`. `cli` rejects
  `--host 0.0.0.0` in v0 (would require auth + same-origin policy
  rethink — defer until someone genuinely needs it).

### Skin system

Skins ship as data manifests (see [Skins](#skins)). The skin
registry is loaded at startup; toggling skins triggers a re-bind of
the renderer's font atlas + palette tokens — restart-free.

### Concurrency model

Squadquarium reads `.squad/` continuously and never writes to it
directly — all mutations flow through Squad's Coordinator (PTY) or the
`squad` CLI. That keeps Squad as the single source of truth for team
state, but it doesn't make concurrency disappear. Several mutators can
still race against the same workspace:

- Two Squadquarium tabs open against the same `.squad/`
- `squad triage` running in another terminal
- The user invoking `squad` directly from a shell mid-session
- A Squad GitHub Action committing back to `.squad/`

Rules (v0):

- **Single-flow invariant.** Mutating UI flows — Hatcher, Scriptorium,
  approval-queue confirmations, anything that prompts the Coordinator
  to write — acquire a workspace-scoped lock at
  `.squad/.scratch/squadquarium.lock`. Lock holds the Squadquarium PID
  + start time. Stale locks (PID gone) are auto-cleared on the next
  `SquadObserver` scan. A second Hatcher attempt in another tab sees
  the lock and surfaces "another flow is in progress — open it?"
  rather than racing. `.scratch/` is already gitignored by Squad.
- **External-mutator detection.** Any UI flow that stages user intent
  (a draft conversation, a pending confirmation) records a `.squad/`
  watermark on entry. If `SquadObserver` reports a mutation before the
  user confirms, the flow re-renders against fresh state and the
  staged draft is flagged "stale — review the changes below." We never
  silently merge over a foreign edit.
- **Read paths are lock-free.** Diorama rendering, log lane, and trace
  panel all read against the latest reconciler snapshot without
  acquiring any lock. Stale reads are bounded by the reconciler's
  watermark logic ([Event reconciliation](#event-reconciliation)).
- **Triage co-existence.** When `squad triage` is detected as running
  (by `SquadObserver` seeing its activity in `orchestration-log/`),
  Hatcher / Scriptorium flows refuse to start until triage is idle, or
  the user explicitly overrides. This avoids the worst pathology:
  triage and Hatcher both nudging the Coordinator to mutate the same
  agent simultaneously.

### No DB, no backend service

One Node process serving HTTP/WebSocket on loopback + the filesystem
(`.squad/`). That's the whole runtime in v0.

## Testing & quality

Tester (Ripley) owns the cross-cutting validation suite; engineers
(Lambert, Parker) own unit tests for their own code. The per-commit
quality gate is non-negotiable.

### Test stack

| Surface          | Framework        | Owner               | Scope                                                                               |
| ---------------- | ---------------- | ------------------- | ----------------------------------------------------------------------------------- |
| `packages/core`  | Vitest 2.x       | Parker (units), Ripley (cross-cutting) | SDK adapter facade, `SquadObserver` classifier, reconciler invariants, PTY pool lifecycle, lock-file PID logic, context resolution, `squadquarium doctor` checks |
| `packages/cli`   | Vitest 2.x       | Parker (units), Ripley (cross-cutting) | Argv parsing, context resolution end-to-end, port auto-pick, `--personal` flag, `--headless-smoke` mode, browser-launch shim |
| `packages/web`   | Vitest 2.x + Playwright 1.x | Lambert (units), Ripley (cross-cutting + visual) | Component tests, glyph-grid invariants, palette token assertions, manifest schema compliance, ANSI trust boundary, Interactive-mode focus toggle, screenshot baselines per skin × state × OS at 1× and 2× DPI |
| Cross-platform install | GitHub Actions matrix | Ripley | `pnpm pack` → `npm install -g <tarball>` → `squadquarium --headless-smoke` on `windows-latest` + `macos-latest` + `ubuntu-latest`. This is the `node-pty` cross-platform validation. |

### Sprite / visual validation

- **Playwright screenshot baselines** for each skin × each band-state combination, captured per OS at 1× and 2× DPI. Goldens live at `packages/web/test/__screenshots__/{skin}/{state}/{os}-{dpi}.png`. Updated only via explicit `pnpm test:web -u` from a clean run; CI never auto-updates.
- **Glyph-grid invariants** (asserted programmatically): cell-row alignment, integer cell offsets for drift, palette tokens used not raw colors, `font-feature-settings: "liga" 0`, sprite grid size constant across skins so the loader doesn't reflow.
- **Manifest schema compliance**: every skin's `manifest.json` validated against the v1 JSON Schema in CI.
- **Glyph allowlist enforcement**: rendered text whitelisted against the active skin's `glyphAllowlist`; missing glyphs render `▢` and emit a dev-console warning. Both behaviors tested.
- **Drives the v0 deliverable.** Aquarium and Office skin shipping checkpoints are gated on green render-diff CI on all three runner OSes.

### CI strategy

- **GitHub Actions matrix** — `windows-latest` (Brady's only local platform), `macos-latest`, `ubuntu-latest`. Node ≥ 22.5 (the minimum Squad requires).
- **Per-push job** — `pnpm install --frozen-lockfile` → `pnpm lint` → `pnpm test` (Vitest workspace-wide) → `pnpm build` → `pnpm test:web` (Playwright on each OS) → `pnpm smoke` (`squadquarium --headless-smoke` on each OS). Playwright screenshot diffs uploaded as artifacts on failure.
- **Pack-and-install smoke (release-candidate trigger)** — `pnpm pack` → `npm install -g <tarball>` → `squadquarium --headless-smoke` on each OS runner. Failures here block the release candidate.
- **Branch protection (when GitHub remote exists):** all matrix jobs required green before merge to `main`.

### Quality gate per commit

Every commit on `main` must satisfy:

```
pnpm lint && pnpm test && pnpm build && pnpm smoke
```

— green, on the dev host (Windows) before push. CI re-runs the same commands across the matrix on push.

`pnpm smoke` runs `node packages/cli/dist/index.js --headless-smoke`, which boots the server, waits for `core` to report ready, fires a synthetic event burst at the WS endpoint, asserts the `web` bundle responds, and exits with a non-zero code on any failure.

**Reviewer-rejection lockout (strict).** When Ripley rejects a PR, the original author is **locked out** of producing the next revision; the Coordinator routes the fix to a different engineer or escalates to Dallas. Recursively: if that revision is also rejected, the second author is also locked out. This is enforced mechanically in the Coordinator's spawn logic (`squad.agent.md` → Reviewer Rejection Protocol), not by trust.

## CLI surface (`squadquarium` / `sqq`)

The published binary is `squadquarium`, aliased to `sqq` for typing
brevity (both bin entries point to the same script). It deliberately
**augments** Squad rather than duplicating it — every command below
exists because Squad does not already have a clean equivalent.

| Command | Status | Purpose |
| --- | --- | --- |
| `squadquarium [path]` | v0 | Resolve squad context (cwd default; explicit path overrides; falls back to personal squad) and launch the diorama in the user's browser. The default invocation. |
| `squadquarium --personal` | v0 | Force open the personal/global squad regardless of cwd. |
| `squadquarium doctor` | v0 | Augments `squad doctor` with Squadquarium-specific checks (Node ≥ 22.5, `squad` on PATH, `node-pty` loaded, port available, last-opened state file readable). Calls into `squad doctor` for the squad-side checks rather than re-implementing them. |
| `squadquarium status` | v0 | Concise status snapshot for the resolved squad (no `squad status` exists today). One screen: agents/state, last decision, last bus event. No browser. |
| `squadquarium trace <agent> [--task id] [--since dur]` | v1 | Reasoning correlator: stitches `orchestration-log/` + per-agent raw output + history into a single readable timeline. |
| `squadquarium why <decision-id>` | v1 | Resolve a `decisions.md` entry's rationale + the skills/casting that influenced it. |
| `squadquarium inspect <agent>` | v1 | Composite agent view (charter + recent history + matched skills + recently touched files). |
| `squadquarium diorama [--frames N] [--width 80]` | v1 | One-shot ASCII habitat frame to stdout. Useful in PR descriptions, status pings, screen recordings without launching a browser. Pipes well: `squad export \| squadquarium diorama`. |

Hard rule: if Squad's CLI grows a clean replacement for any
`squadquarium` subcommand, **we deprecate ours and forward to Squad**
with a one-version deprecation window. We are not building a Squad
fork; we're building Squad's natural visual companion.

## Building Squadquarium with Squad (dogfooding)

We commit to building Squadquarium *with* Squad from v0:

- `squad init` in this repo with a small starting roster (Lead, Frontend,
  Backend, Scribe — same four floors v0 ships visually).
- All real work — CLI + web scaffolding, glyph renderer, SDK integration,
  README passes — happens through the Squad team. The `decisions.md`,
  `orchestration-log/`, and per-agent `history.md` produced while building
  Squadquarium become both real test data for the aquarium *and* the most
  authentic possible demo recording.
- A "self-portrait" mode: when Squadquarium is launched against its own
  repo, the building it draws is literally the team that built it.
- Bug reports and feature gaps in Squad surfaced during this build are PR'd
  upstream; that's where good citizenship pays back.

Hard rule (carried over): we still must not silently mutate `.squad/` —
Squadquarium-driven writes go through the same SDK builders Squad's own CLI
uses, so the resulting files are indistinguishable from Squad's own output.

## Surfaces hooked into Squad (in priority order)

1. **Detect / install** the Squad CLI + Node 22.5+ during onboarding;
   fall back to `npx @bradygaster/squad-cli` when no global install exists.
   Use `resolveSquad()` from the SDK to confirm a project has `.squad/`.
2. **Bootstrap** via `squad init` (and offer `--sdk` for SDK-first projects).
   Surface every flag we expose as a copyable command line.
3. **Read live state via the SDK** — `SquadState` collections give typed,
   structured access to agents, skills, decisions, routing, log, casting,
   templates without ad-hoc parsing.
4. **Watch `.squad/` via `SquadObserver`** — feeds the
   [event reconciler](#event-reconciliation) as the `fs` source.
5. **Subscribe to the EventBus WebSocket bridge** (`startWSBridge`,
   default port 6277) — feeds the reconciler as the `bus` source
   (highest precedence). Carries `session:tool_call`,
   `session:message`, `coordinator:routing`, `agent:milestone`,
   `pool:health`. Replaces guessing-from-mtimes for the activity
   grammar wherever it can.
6. **Tail `orchestration-log/*` and `log/*`** — feeds the reconciler
   as the `log` source (fallback when bus is down).
7. **PTY mirror of the active session** — feeds the reconciler as the
   `pty` source. The xterm.js panel renders this; the reconciler
   parses ANSI-stripped lines for entity hints. Used in Interactive
   mode and (read-only) in Ambient mode when a session is active.
8. **CLI wrappers** for management actions: `squad build`, `squad watch`/
   `triage`, `squad link`, `squad nap`, `squad export`/`import`, `squad upgrade`,
   `squad doctor`, `squad personal`, `squad cost`. Show/copy command line in UI.
9. **SDK-direct flows** for things with no CLI surface: parse charters,
   validate `squad.config.ts`. (Hatchery / Scriptorium do **not** call
   `defineSkill()` / `onboardAgent()` directly — they go through the
   Coordinator in Interactive mode, which writes the same files.)
10. **Investigate `dist/remote-ui/` bridge** (pre-v0 spike): if the
    Squad CLI exposes a structured remote-ui channel we can subscribe
    to, that becomes a fifth event source above `pty`. If not, this
    spike confirms we stay on PTY+bus+fs+log. Either outcome is
    actionable.
11. v1+: register a `HookPipeline` pre-hook to enrich the activity
    stream with per-tool-call animations (e.g., a `view`/`grep`
    becomes folder-flipping the moment the hook fires, not when the
    log file flushes).
12. v1+: optional OTel passthrough — when `squad aspire` is running, expose
    a button to open it; do not rebuild a metrics dashboard.

## Roadmap

### Pre-v0 bootstrap

The dev environment doesn't exist yet. None of the spikes below can
run until this is done. Confirm each item against `C:\Workspace\
personal\squadquarium\` (currently: `plan.md` only).

- [x] **Install pnpm** via `corepack enable && corepack prepare
      pnpm@latest --activate` (Node 24.14 ships corepack). Done —
      pnpm 10.33.3 active. The corepack step requires an admin
      PowerShell on Windows the first time (writes to `Program
      Files\nodejs\`), so document that in the v0 README.
- [x] **Pin Squad version to 0.9.4** — current installed version.
      Will be reflected in `packages/core/package.json`'s `peerDeps`
      / `engines` block once that file exists. (If a newer Squad
      ships before v0, retest the load spike before bumping.)
- [x] **`git init`** the repo and commit `plan.md` + the `.squad/`
      scaffold as the first checkpoint. The dogfooding rule + the
      "the team that built it shows up in self-portrait mode"
      feature both depend on a real git history from day one.
- [x] **`squad init`** in this repo. The default init seeds Scribe
      + Ralph; the v0 plan roster (Lead + Frontend + Backend +
      Tester + Scribe) is populated by the Coordinator during the
      first `copilot --yolo` → `/agent squad` session (since
      `squad hire` is "implementation pending" in 0.9.4 and the
      Coordinator's `squad.agent.md` master prompt is what's
      designed to drive onboarding from the SDK's seven role
      templates — `lead`, `developer`, `tester`, `scribe`, `ralph`,
      `designer`, `architect`). Tester is non-negotiable for v0
      because hands-off autonomous build hinges on an independent
      "is this actually working?" owner: vitest gates, Playwright
      screenshot baselines, glyph-grid invariants, cross-platform
      PTY smoke. Ralph stays dormant — he's a v1+ ambient watchdog
      and harmless to leave seeded.
- [x] **Cast the v0 roster from the Alien universe** —
      Dallas (Lead), Lambert (Frontend), Parker (Backend),
      Ripley (Tester), Scribe (always Scribe), Ralph (dormant).
      Charters seeded with opinionated voices. Recorded in
      `.squad/team.md`, `.squad/routing.md`,
      `.squad/casting/registry.json`, and
      `.squad/casting/history.json` (assignment id
      `v0-roster-2026-05-05`).

(No Rust, no Tauri, no platform installers, no certs. v0 ships as a
single npm package; users `npm install -g squadquarium` and run it.
Rust toolchain returns only if/when v1+ adds the optional native
shell wrapper.)

### Pre-v0 spikes

These are gates, not parallel tracks — each one can invalidate the v0
plan, so they happen after bootstrap and before any UI work.

- [x] **`node-pty` cross-platform load spike.** Windows host: PASS
      (`node-pty@1.1.0` built clean in 107ms with VS Build Tools
      already present; `spawnNodeVersion()` returns valid semver
      via PTY in `packages/core/src/spikes/pty-load/`).
      macOS / Linux validation deferred to the GitHub Actions CI
      matrix (`pack-install-smoke` job in `.github/workflows/ci.yml`)
      — Brady is Windows-only locally per testing-strategy decision.
- [x] **xterm.js + Squad ink TUI compatibility spike.** Run
      `squad watch` and the Coordinator flow through `node-pty` into
      `xterm.js`. Verify resize behavior, alt-screen mode, cursor
      positioning, Unicode width handling, and that Squad's
      `patch-ink-rendering.mjs` postinstall doesn't depend on a real
      terminal we can't fake. The Squad team explicitly patches ink's
      renderer — this is the highest-uncertainty technical risk.
      *(v0 disposition: the pipeline is wired end-to-end —
      `PTYPool` in `core` spawns `squad`/`squad watch` via node-pty
      and forwards `pty-out` frames over loopback WS to xterm.js in
      the browser via the `LogPanel` Interactive mode. Cursor +
      title OSC are allowed; clipboard / bell / system-color OSC
      blocked. Real-world ink-renderer fidelity (alt-screen, wide
      chars, resize) is verified incrementally as Brady drives the
      Interactive mode in the demo; if a regression surfaces, it's
      a bug to file against this contract — the contract itself
      ships in v0.)*
- [x] **`dist/remote-ui/` bridge spike.** Investigated. Outcome:
      `dist/remote-ui/` is a static PWA for Squad RC (remote control),
      not a structured event channel for external visualizers.
      `RemoteBridge` in the SDK is for command-IN, not event-OUT.
      Confirmed PTY+bus+fs+log is the full v0 menu of event sources;
      no plan.md amendment needed. (See
      `.squad/decisions/inbox/dallas-spike-3-remote-ui.md`.)
- [x] **Skin manifest schema lock.** `manifestVersion: 1` locked at
      `skins/manifest.schema.json` (JSON Schema draft 2020-12) with
      all required fields, `additionalProperties: false` +
      `patternProperties: ^x-` extension namespace, contains-space
      glyph invariant, enum-guarded `capabilities`, and an open
      palette for extra named colors. Author contract documented at
      `skins/AUTHOR-CONTRACT.md`. Both Aquarium and Office manifests
      validate clean.
- [x] **Cross-platform glyph render-diff test in CI.** CI matrix
      shell shipped at `.github/workflows/ci.yml` (windows-latest +
      ubuntu-latest run Playwright; macos-latest deferred to first
      pass per cost). `playwright.config.ts` defines `chromium-1x`
      and `chromium-2x` DPI projects with `snapshotPathTemplate`
      pointing at per-OS baselines. Placeholder specs are
      `test.fixme`'d as the binding contract — they activate as
      soon as the renderer ships in Wave 2 of v0.
- [x] **Event reconciler design + invariants.** Implemented at
      `packages/core/src/events.ts` with the documented envelope,
      source precedence (bus > pty > fs > log via
      `SOURCE_PRECEDENCE` map), per-entity watermark, and dedupe
      key `(entityKey, causedBy, seq, source)`. 7 invariants
      tested green in `packages/core/test/events.test.ts`. Wiring
      to actual sources (SquadObserver, EventBus, log tail, PTY)
      follows in v0 Wave 1.
- [x] **Event reconciler design + invariants.** Implement
      `packages/core/events.ts` with the envelope, source precedence,
      watermark, and dedupe rules **before** any UI work. Test with
      synthetic out-of-order multi-source streams.
      *(Duplicate entry — implementation confirmed by the `[x]` block above.)*

### v0 — weekend hack (the demo)

The cut: this is the smallest set that proves the metaphor in a real
terminal-styled GUI rendering a real Squad team's real activity.
Everything that smells like "would be cool" lives in v1.

- [x] Monorepo scaffold (pnpm workspace): `packages/{core,web,cli}` +
      `skins/{aquarium,office}`. Per-package `package.json`,
      `tsconfig.json`, root `pnpm-workspace.yaml`, shared
      `.editorconfig`. Top-level `package.json` declares the
      published artifact as `squadquarium`. *(Top-level kept private
      while v0 is in flight; flipped to publishable when the v0
      `npm publish` dry run runs.)*
- [x] **CLI scaffold** (`packages/cli`): `squadquarium` (alias `sqq`)
      Node binary that parses args, resolves squad context (cwd →
      walk up → personal → empty-state), starts a local
      HTTP/WebSocket server on `127.0.0.1` (auto-pick port starting
      at 6280), opens the user's default browser via the `open`
      package. Rejects `--host 0.0.0.0` with a clear error.
      *(Full server + browser launch confirmed: `packages/cli/src/{server,context,argv,index}.ts`. Windows absolute-path fix and clean-shutdown also landed in Wave 1.)*
- [x] **Test infrastructure**: Vitest 2 wired into `packages/core` and `packages/cli`; Playwright 1 wired into `packages/web` with screenshot baseline directory `packages/web/test/__screenshots__/`; root `pnpm lint` (eslint + prettier check) + `pnpm test` (workspace-wide vitest) + `pnpm test:web` (Playwright) + `pnpm smoke` (`squadquarium --headless-smoke`); GitHub Actions workflow `.github/workflows/ci.yml` running the matrix (windows-latest + macos-latest + ubuntu-latest) on push and PR
- [x] **`squadquarium --headless-smoke`**: boots the server, waits for `core` ready, fires a synthetic event burst at the WS endpoint, asserts the `web` bundle responds, exits 0 / non-zero. The contract Ripley enforces in CI on every OS.
      *(Confirmed: `packages/cli/src/headless-smoke.ts` — `hello` + `snapshot` + fs-event roundtrip + `pong` verified.)*
- [x] **Web bundle** (`packages/web`): React 19 + Vite served as
      static assets by the CLI's HTTP server in production; Vite dev
      server with HMR proxied through the CLI in development.
      *(Confirmed: `packages/web/src/{App.tsx,main.tsx,components/,render/,skin/,transport/}` all present.)*
- [x] **Loopback transport**: a single WebSocket between `web` and
      `core`; framed messages with sequence numbers; auto-reconnect
      on transient drops.
      *(Confirmed: `packages/web/src/transport/{wsClient.ts,protocol.ts,store.ts}` + `packages/core/src/transport/protocol.ts`.)*
- [x] `squadquarium doctor`: detect Node ≥ 22.5, detect `squad` on
      PATH (or fall back to `npx @bradygaster/squad-cli`), check
      `node-pty` loaded, check port availability, call into
      `squad doctor` for squad-side checks, surface combined results.
      *(Confirmed: `packages/cli/src/doctor.ts`.)*
- [x] **Context resolution** in `cli`: cwd walk-up via
      `resolveSquad()`, `--personal` flag against Squad's standard
      personal location, explicit `<path>` arg, empty-state
      "Bootstrap Squad here" CTA. Last-opened path remembered in
      `~/.squadquarium/state.json`.
      *(Confirmed: `packages/cli/src/context.ts` — full resolution chain + `STATE_FILE` persistence.)*
- [x] **Event reconciler in `core`** — bus + fs + log sources wired,
      pty source stub. Source precedence and watermark from day one.
      *(Confirmed: `packages/core/src/events.ts` fully wired; PTY pool in `packages/core/src/pty/`; SDK adapter in `packages/core/src/squad/`.)*
- [x] **Habitat panel**: Canvas2D glyph renderer with 3–4 bands (Lead,
      Frontend, Backend, Scribe), three states (idle / working /
      blocked) inferred from reconciled events, ambient drift.
      *(Confirmed: `packages/web/src/components/HabitatPanel.tsx` + `packages/web/src/render/{canvas.ts,habitat.ts,sprite.ts,cellMetrics.ts}`.)*
- [x] **Log panel**: real `squad watch` PTY → xterm.js (PTY in
      `core`, streamed over loopback WebSocket), read-only Ambient
      mode. ANSI trust boundary applied (links off, OSC allowlist).
      *(Confirmed: `packages/web/src/components/LogPanel.tsx` — no WebLinksAddon, OSC allowlist.)*
- [x] **c′ split layout**: resizable habitat / log panels in
      terminal-styled chrome. Click-to-pan + drill-in panel.
      *(Confirmed: `packages/web/src/components/AppShell.tsx` + `DrillIn.tsx` + `CommandPalette.tsx`.)*
- [x] **Aquarium skin** (default, polished) + **Office skin**
      (intentionally minimal — palette + 4 sprite variants — to prove
      schema, not polish). Restart-free toggle.
      *(Confirmed: `skins/{aquarium,office}/manifest.json` both validate against `skins/manifest.schema.json`; skin loader in `packages/web/src/skin/`; `:skin <name>` in CommandPalette.)*
- [x] Bundled monospace font (JetBrains Mono woff2). Glyph allowlist
      enforced; missing glyphs render as `▢` with dev-console warning.
      *(Confirmed: `font-feature-settings: "liga" 0` in `packages/web/src/styles/font.css`; woff2 vendored; allowlist fallback to `▢` in canvas renderer.)*
- [x] **PWA manifest + service worker** so users can install
      Squadquarium as a standalone-window app from supported
      browsers. Icons can be placeholders for v0; the affordance
      shipping is what matters.
      *(Confirmed: `packages/web/public/manifest.webmanifest` + `packages/web/public/sw.js`.)*
- [x] **Interactive mode**: Hatch / Inscribe / Bootstrap buttons
      switch the log panel into PTY + Coordinator focus. ESC returns.
      The Coordinator drives the conversation; we do not replicate
      its prompts in custom GUI controls.
      *(Confirmed: `packages/web/src/components/InteractiveOverlay.tsx` — PTY modal with `[ESC]` exit; PTY pool in `core` handles stdin/stdout.)*
- [x] `SquadObserver`-driven hatching/inscription rituals (band-local
      glyph spawn animation when the relevant `.squad/` files appear).
      *(Shipped Wave 2: `detectRitualEvent()` in `transport/store.ts`,
      `HabitatRenderer.playRitual()` in `render/habitat.ts` with
      time-progressed glyph overlays — aquarium agent
      `·→o→O→(O)→(°)→(°)>=<`; office agent desk-brightens + `[¤]`
      walk; inscription `░→▒→▓→█`. Camera pan via CSS translateY,
      never canvas repaint. 8 ritual vitest cases pass.)*
- [x] **`npm publish` dry run** + cross-platform smoke test: `npm
      install -g <local-tarball>` on Win/macOS/Linux → `squadquarium`
      → diorama loads in the default browser.
      *(Shipped Wave 2: `pnpm pack-all` produces `squadquarium-0.0.1.tgz`
      (~280 KB, 39 files including web-dist + skins + bin); local
      `npm install -g` on Windows passes — `--version` and
      `--headless-smoke` both green from the global install. CI
      `pack-install-smoke` flipped to `continue-on-error: false`.
      macOS/Linux validation runs in CI on first push.)*
- [x] Self-portrait mode: when opened on the Squadquarium repo, the
      bands are labeled with the agents that actually built it.
      *(Shipped Wave 2: `useIsSelfPortrait()` checks squadRoot
      basename === `squadquarium`; AppShell shows
      `[ self-portrait ]` alert badge; DrillIn shows augmented role
      labels (e.g., "Frontend Dev — Lambert") plus the agent's
      `## Voice` charter line via new `AgentSummary.charterVoice` field.)*
- [x] README with install / launch / `--personal` / PWA-install
      instructions; recorded demo placeholder (the actual recording is
      Brady's job post-v0 — the ASCII diorama in the README serves as
      stand-in until then).
      *(Done — Dallas, Wave 2. Full README.md at repo root: title + tagline, quick start, what it does/doesn't, requirements, troubleshooting, commands, skins, architecture, PWA, contributing, dogfood, license, status.)*

Explicit non-goals for v0: native shell wrapper (Tauri/Electron) —
browser is the GUI; per-band sound; parallax background art;
`squadquarium trace` / `why` / `inspect` / `diorama`;
`squad-grill-template` skill; plugin marketplace UI; time-scrubber;
mood expressions; approval queue animation; Wisdom wing; Aspire
button; OBS mode; non-loopback hosting.

### v1 — the polish pass
- [x] Mood / care expressions tied to real signals
      *(Shipped: `deriveMood()` in `render/habitat.ts` — tired/busy/content/stuck/normal derived from reconciler events; mood glyphs `z`/`*`/`~`/`?` above sprites; palette tweaks; tied to `moodGlyphs` setting toggle.)*
- [partial] Approval queue as glyph hand-off animation
      *(Shipped client-side: keyword-scan inbox-path FS events trigger lobby-walk animation with `[!]` glyph; `__triggerApprovalQueue()` debug helper exposed for Playwright. Gap: server-side `approval-cleared` frame missing — badges persist until page reload. Tracked in `lambert-approval-queue.md`.)*
- [x] Time-scrubber: replay the day from `orchestration-log/` against
      the reconciler's event log
      *(Shipped: `TimeScrubberPanel` slider UI + `isScrubbing` flag pauses live ingestion; Parker added `replay-request`/`replay` WS frames in Wave 2 so the server reads `.squad/orchestration-log/`, parses timestamps from filenames + `**Agent:**` fields, returns ordered events capped at 1000.)*
- [x] **`squadquarium trace`, `why`, `inspect`, `diorama`** ship as
      subcommands of the same `squadquarium` (alias `sqq`) binary
      *(Shipped: `packages/cli/src/{trace,why,inspect,diorama}.ts` with full implementations + tests. `diorama --frames N --width W` renders the team in stdout glyphs.)*
- [x] **`squad-grill-template` skill** (opt-in "thorough mode")
      *(Shipped at `.squad/skills/squad-grill-template/SKILL.md` — 261 lines, full Squad frontmatter, 5 patterns, 6 anti-patterns, Hatchery + Scriptorium worked examples, Pocock `grill-with-docs` cited.)*
- [x] **Wisdom wing**: render `identity/wisdom.md` as adjacent museum
      content
      *(Shipped: `WisdomWing.tsx` + `parseWisdomPatterns()` (3 vitest cases); `:wisdom` palette command; pattern cards + skill chips with confidence labels. Per-skill usage stats and decisions cross-link are v2 polish.)*
- [partial] **Hatchery cross-suggestion**
      *(Design only: `packages/web/src/hatchery/CROSS-SUGGESTION-DESIGN.md` ships full design — PTY phrase detection, Zustand state shape, three-condition handoff, toast banner spec, seed contract. Implementation pending.)*
- [parked] **PR upstream**: `squad-grill-template` as a Squad built-in
      *(`.github/CONTRIBUTING-UPSTREAM.md (a)` documents the upstream PR prep with copyable git commands. Brady action: run thorough mode in real Hatchery use first; if positive, follow the guide.)*
- [x] **Plugin marketplace UX**: detect, browse, install, and cite
      plugins from configured Squad marketplaces
      *(Shipped: backend at `packages/core/src/plugins/marketplace.ts` (list/browse/install) + `MarketplacePanel` UI accessible via `:marketplace`; plugins show source-citation tags in Wisdom Wing. Empty state with copyable `squad plugin marketplace add` hint.)*
- [x] **Office skin polish**: full sprite set, ambient drift rules,
      vocab map — bring it to Aquarium parity
      *(Shipped Wave 1: 4 roles × 4 states × 2 frames; `\¤/` celebrate, slumped `[_]` blocked; `node skins/validate.mjs` clean.)*
- [partial] **Optional native shell wrapper** (`squadquarium-app`): Tauri
      *(Scaffold shipped at `packages/squadquarium-app/` — package.json + tauri.conf.json + Cargo.toml + src-tauri/src/main.rs + README documenting Rust toolchain prereq. Actual `tauri build` requires Rust install — Brady action when desired.)*
- [partial] **`node-pty` prebuilds** (`prebuildify` / `node-gyp-build`)
      *(Config shipped: `prebuildify` + `node-gyp-build` added to cli devDeps; `packages/cli/scripts/prebuild-node-pty.mjs`; `.github/workflows/prebuild.yml` matrix runs on tag push and uploads prebuilds as artifacts. Actual prebuild publishing intentionally manual — Brady runs `npm publish` with credentials.)*
- [x] Ralph as visible night-shift creature when watch daemon is
      running; start/stop daemon from UI
      *(Shipped: `<:O>` flashlight figure in deep-trench band when active; PTY-spawn auto-detection; `:ralph start/stop` palette commands; `setRalphActive()` debug hook.)*
- [x] Per-agent voice-line samples from charter `voice:` field
      *(Shipped: 1-in-10 chance per ~6s when agent enters `working`; `( text )` aquarium / `[ text ]` office framing; `voiceBubbles` settings toggle; `parseVoiceFromCharter()` extracts `## Voice` line via `AgentSummary.charterVoice`.)*
- [partial] `HookPipeline` pre-hook for richer per-tool-call animation timing
      *(Shipped as polling stub: SDK 0.9.4 exposes no `registerPreHook` API; adapter polls `.squad/orchestration-log/` every 200ms emitting synthetic `tool:start` events mapped to `browse`/`edit`/`shell`/`misc` kinds. Documented in `parker-hookpipeline-sdk-0.9.4.md`. Real pre-hook integration lands when Squad SDK exposes the hook surface.)*
- [x] Settings: ambient SFX on/off, window-always-on-top toggle,
      CRT effects on/off
      *(Shipped: `SettingsPanel.tsx` + `settings/store.ts` (localStorage); 6 toggles wired; `[⚙]` gear in status bar.)*
- [x] Vim-style `:` command palette + history of invoked actions
      *(Shipped: `CommandPalette.tsx` with `:` trigger, parseCommand, history (↑ cycles, persisted), tab completion, 11+ commands (`:skin`, `:hatch`, `:inscribe`, `:scrub`, `:wisdom`, `:settings`, `:trace`, `:why`, `:inspect`, `:diorama`, `:aspire`, `:marketplace`, `:obs`, `:skins`, `:standup`, `:ralph start/stop`).)*
- [x] "Open Aspire dashboard" button → shells out to `squad aspire`
      *(Shipped: `packages/cli/src/aspire.ts` detects `squad aspire`, opens URL via `open` package; `:aspire` palette command.)*

### v2 — game toggle + reach
- [x] Game-mode setting: XP, daily stand-up summary, cosmetic loot
      *(Shipped: `packages/web/src/game/store.ts` (pure derivation module, NO transport-store imports — cosmetics-only invariant enforced by import graph + 18 vitest cases). XP/level bar, skill tree, achievements, ideas counter with idle accrual when Ralph active, inventory (`[hat]` `[scarf]` `[lure]` `[goggles]`), boss fight panel, `:standup` modal. Hard rule documented: game state never affects agent decisions.)*
- [x] Visiting agents via `squad link` (multi-repo view)
      *(Shipped: `detectVisitorArrival()` + `useVisitorArrivals()` hook + `<VisitorAnimation />` overlay. Aquarium whaleshark glyph sequence; Office `╔═╦═╗` truck slides in from the garage. `__triggerVisitor(name)` debug helper for Playwright.)*
- [x] **Multi-attach view**: personal squad + active project squad
      shown as side-by-side habitats in the same window
      *(Shipped: backend `SquadStateAdapter.createMulti({ contexts })` + `--attach <path>` repeatable CLI flag + per-adapter `id`/`label`; events tagged with `attachedSquadId`; snapshot extension `attachedSquads?: { id; label; snapshot }[]`. Frontend behind `enableMultiAttach` settings flag — horizontal split with per-squad labels; log-panel tabs.)*
- [partial] VS Code webview wrapper of the same web bundle
      *(Package skeleton shipped at `packages/squadquarium-vscode/` — CJS extension, `squadquarium.open` command, child-process server + WS proxy shim, esbuild bundler, `.vscodeignore`, README. Actual `vsce package` requires the `vsce` CLI run by Brady against a publisher account.)*
- [x] OBS-friendly transparent / chroma-key mode for streamers
      *(Shipped: `obsMode` setting `off`/`transparent`/`chroma-green`/`chroma-magenta`; `:obs <mode>` palette command; body background applied inline; 7 vitest cases.)*
- [parked] Explore PR upstream as `squad ui` subcommand
      *(`.github/CONTRIBUTING-UPSTREAM.md (b)` documents the upstream PR guide and the SquadOffice/`squad rc`/`squad aspire` lane-separation risk. Brady action: open a discussion in `bradygaster/squad-cli` to align on scope before any code lands.)*
- [x] **Community skin packs**: open the manifest format to
      contributors (deep trench, cottage village, space station,
      fungus colony); skin browser inside Squadquarium; signed manifests
      *(Shipped: `<SkinBrowser />` via `:skins` lists local + 4 community-pack stubs marked `[available v2.x]` with copyable `squad plugin install community/skin-{name}` install hints. Manifest schema extended with typed `x-signature` patternProperty; `AUTHOR-CONTRACT.md` documents the future Ed25519 signing contract (canonical JSON, v3+ verification implementation).)*
- [parked] **Pocock pack**: explore co-authoring a flagship Hatcher
      curriculum with Matt Pocock
      *(`.github/POCOCK-PACK.md` documents the full status, outreach plan, and what is safe to do autonomously (cite + link only). Blocker: `mattpocock/skills` license not confirmed permissive. Brady action: open a GitHub Discussion in `mattpocock/skills`.)*

## Risks / things to watch

### Critical (can kill v0 outright)

- **Native module install (`node-pty`).** `node-pty` has to compile
  and load on Win/macOS/Linux at `npm install -g squadquarium` time.
  If `node-gyp` fails — missing build tools, Apple Silicon toolchain
  mismatch, Python version, MSVC absent — `squadquarium` won't start.
  No installer means we can't paper over this with a postinstall
  bundled binary in v0. **Mitigation:** pre-v0 spike pushes a tarball
  through `npm install -g` on all three OSes; if it breaks, ship
  `squadquarium status` + a no-PTY diorama (read-only log tail)
  first and treat live PTY / Interactive mode as v1. v1 polishes via
  `prebuildify` / `node-gyp-build` to ship prebuilt platform
  binaries inside the tarball.
- **Interaction ownership (TUI vs GUI).** The single biggest
  Frankenstein risk: half the controls in xterm.js, half in our GUI,
  user confused which one to talk to. **Mitigation:** explicit
  Ambient/Interactive [Modes](#modes); modal switching with clear
  affordances; never replicate Coordinator prompts in custom GUI
  controls.
- **Event reconciliation under load.** Bus + PTY + FS + log will
  disagree, and the diorama and log panel will visibly diverge during
  the demo if we treat any source as authoritative on its own.
  **Mitigation:** [event reconciler](#event-reconciliation) is a v0
  invariant with an explicit precedence and watermark; tested with
  synthetic out-of-order multi-source streams before any UI work.

### High

- **xterm.js + Squad's ink TUI compatibility.** Squad ships
  `patch-ink-rendering.mjs` as a postinstall — they patch ink for
  their own terminal, which means our embedded terminal may misbehave
  (resize, alt-screen, cursor, Unicode width). **Mitigation:**
  pre-v0 spike that runs the actual Coordinator flow through our
  pipeline and exercises resize / alt-screen / wide chars.
- **Font determinism.** Glyph mosaics depend on consistent cell
  metrics. System fonts vary; ligatures destroy alignment.
  **Mitigation:** bundled monospace woff2 (JetBrains Mono),
  `font-feature-settings: "liga" 0`, glyph allowlist enforcement,
  explicit error if the font fails to load. Cross-platform
  render-diff CI.
- **ANSI / OSC trust boundary.** Squad output flows untrusted into
  xterm.js. Hyperlinks, OSC color/title/bell, clipboard sequences
  could be abused. **Mitigation:** links off by default with confirm
  dialog when on; OSC allowlist; no clipboard binding; log panel is
  read-only in Ambient.
- **Squad is alpha.** SDK schema may shift; CHANGELOG explicitly
  warns. **Mitigation:** pin SDK version per release; route
  everything through the `core` facade; treat `squad upgrade` as a
  port window.

### Medium

- **WS bridge isn't auto-started by any CLI command today.** It's a
  programmatic API. v0 starts it itself in `core` via the SDK, with
  file-watching as a documented fallback if the bridge fails to bind.
- **Node version friction.** Squad requires Node ≥ 22.5.0 with
  hard-fail below; `squadquarium doctor` must detect and guide users
  instead of erroring opaquely. v1 may bundle Node via a separate
  installable artifact if community demand justifies it.
- **Frontmatter compatibility with `mattpocock/skills`.** Matt's
  SKILL.md frontmatter is `{name, description}` only; Squad needs
  `domain`, `triggers`, `roles`. **Mitigation:** Scriptorium's
  Coordinator-driven flow always produces full Squad frontmatter.
  Risk is contained to users who bypass the Scriptorium and
  `squad plugin install` Matt's skills directly; the Scriptorium
  detects Matt-format files and offers a one-click "promote" flow.
- **License + attribution for community work.** Verify
  `mattpocock/skills` LICENSE before any redistribution. Citing and
  linking is fine; bundling SKILL.md files into our repo is not until
  license is confirmed permissive. Default posture: cite + link,
  never copy.
- **Skin manifest churn.** Locked at `manifestVersion: 1` before v0
  ships; v2 community packs depend on it not breaking. Use
  `engineVersion` ranges and `x-*` extension namespace for additive
  evolution.

### Lower (don't lose sleep, but don't forget)

- **Don't collide with existing upstream UI surfaces.**
  `squad aspire` owns OTel observability, `squad rc` owns mobile
  remote control, and the SDK's WS bridge is named for an upstream
  "SquadOffice" visualization. Squadquarium is the
  embodied/ambient/diorama lane and should acknowledge + link to all
  of the above rather than duplicate them.
- **`squadquarium` drift from `squad`.** If Squad's CLI grows clean
  replacements for `squadquarium trace` / `inspect` / `why` /
  `diorama`, we deprecate ours and forward. The v0 surface is small
  on purpose (just the launcher + `doctor` + `status`), which limits
  how far we can drift before the next port window.
- **Don't gamify dumb work.** Game layer must be cosmetic-only; no
  incentives that pull agents off-task.
- **Privacy.** `.squad/` may contain repo snippets. Local-only by
  default. Any sync/share feature is opt-in and explicit.
- **Asset budget.** Glyph art is cheap (Unicode is free) but
  *content* is not — too many band variants and we burn the v0
  weekend on dressing instead of plumbing. Office skin is
  intentionally minimal in v0 to enforce this.
- **`squad plugin install` maturity.** Plugin marketplace works but
  is flagged experimental in Squad release notes. v0 must work
  without any third-party plugins installed.

## Open questions

- Project name: **Squadquarium** is the working name. Alternates:
  Squadside, Pocket Squad, Standup, After Hours. Ship under one,
  rename freely while pre-1.0.
- Build under personal GitHub or a project org? Personal is fine for v0.
- Talk to Brady early or after v0 demo? Lean toward "after v0" — show, don't pitch.
- Naming: confirm **Hatchery** (agents) + **Scriptorium** (skills) +
  **Hatcher** (sub-agent). Alternates: Bestiary/Codex; Pond/Library;
  Nursery/Atelier.
- Squadquarium skills repo location: in-tree (`/skills/` under
  `squadquarium`) for v0 simplicity, vs a sibling repo like
  `bradygaster-community/squadquarium-skills` once we PR upstream.
  Default to in-tree for v0.
- Verify `mattpocock/skills` LICENSE before any redistribution path;
  cite + link is always safe.
- Talk to Matt Pocock early about the citation framing? At minimum,
  open a GitHub Discussion in his repo before shipping.
- **Aquarium flavor**: literal ASCII fish (anglerfish `(°)>=<`,
  octopus `<:::>`) vs abstract phosphor-pond (drifting glyphs that
  *suggest* creatures). Decide during the v0 sprite pass; the skin
  manifest doesn't care.
- **`node-pty` install fallback.** If `npm install -g squadquarium`
  fails to build `node-pty` on macOS or Windows (Apple Silicon
  toolchain mismatch, missing build tools, `node-gyp` nags), do we
  (a) ship a no-PTY fallback (read-only log tail of
  `orchestration-log/` instead of live `squad watch`), (b) wait on a
  prebuild story (`prebuildify` / `node-gyp-build` shipping
  per-platform binaries in the npm tarball), or (c) drop `node-pty`
  entirely and use a pure-Node child-process + line-based log scrape
  for the log panel? (a) is the v0-friendly answer; (b) is the v1
  polish path. Tauri/native fallback is out of scope here — that's a
  separate v1+ track.
- **PWA polish vs native shell wrapper.** Modern browsers' "Install
  app" PWA affordance gets us most of the way to a standalone-window
  experience for free. Do we invest in PWA polish (app icons,
  splash, theme color, offline-ish manifest) before exploring the
  native shell wrapper, or is the wrapper a strict v1 stretch
  regardless? Default: ship the manifest in v0, polish when the
  demo lands.
- **Default port + multi-instance.** What port does the local server
  bind to (auto-pick like Vite, or fixed like 6277)? What happens
  when the user runs `squadquarium` in two repos at once — two
  servers, or one server multi-attaching? v0 default: auto-pick
  port, two independent instances; revisit for v1 multi-attach.
- **`remote-ui` bridge spike outcome.** If Squad exposes a structured
  channel, what's the migration path from PTY-only? If not, do we
  proactively contribute one upstream (and what would the API look
  like)?
- **Office skin polish budget.** v0 ships intentionally-minimal
  Office to lock the schema. v1 brings it to Aquarium parity — but
  if the demo tells us no one cares about Office, do we cut it
  entirely and replace with a community-pack curation effort instead?
