# Hatchery Cross-Suggestion Design

**Status:** Design doc — not yet implemented. Lambert owns implementation in a future wave if Brady greenlights.  
**Date:** 2026-05-06T03:51:00Z  
**Author:** Dallas (Lead)  
**Phase:** v1 Polish Pass

---

## Summary

When the Hatchery PTY session (new agent creation) produces output that signals a needed skill, Squadquarium queues a Scriptorium session with a pre-seeded prompt for that skill. The user sees a single, non-blocking banner after the agent creation completes: "Found N skill opportunities. Open Scriptorium with these seeds? [yes / no / later]." They are never interrupted mid-creation.

The queue is Squadquarium-side Zustand state. The Coordinator knows nothing about it. This is purely a Squadquarium UI convenience layer on top of the normal PTY flow.

---

## 1 — Detection Signal

### Where to listen

The detection window is the Hatcher's PTY output stream — the raw text bytes that xterm.js renders into the embedded terminal. The signal is produced by the Coordinator or by `squad-grill-template` (when thorough mode is active) as a natural side-effect of its coherence walkthrough.

### Signal phrases (case-insensitive, partial-match)

```
"needed skill"          → a skill for X is explicitly flagged as missing
"would benefit from a skill"  → Coordinator notes X deserves a team-wide reusable pattern
"should be a skill"     → explicit Coordinator recommendation
"might want a skill"    → softer recommendation; still queued
"consider adding a skill"     → lowest-confidence signal; queued but ranked last
```

### Extraction

When a signal phrase is matched, extract the enclosing sentence (from prior period or line-start to next period or line-end). That sentence becomes the **raw seed candidate**. The extractor:

1. Strips ANSI escape codes before matching (xterm.js may not have cleaned the buffer).
2. De-duplicates — if the same skill concept appears multiple times, one entry per distinct concept.
3. Normalizes to a single clean line: trim whitespace, downcase, remove "you might want to", "I suggest", etc.

**Example raw PTY output:**

```
The agent you're adding will handle rate limiting. You might want a skill
for exponential backoff — that pattern is general enough to share across the team.
```

**Extracted seed:**

```
skill for exponential backoff — general-purpose retry pattern for rate-limited API calls
```

### False-positive guard

Signal phrases are only matched **outside** of code blocks (triple-backtick regions in the PTY stream). The Coordinator sometimes quotes skill names in code examples; those must not trigger queuing.

---

## 2 — Queue Mechanism

### Zustand state shape

Add to the root Zustand store (the same store used for `hatcheryMode`, `interactiveSession`, etc.):

```typescript
// packages/web/src/store.ts (or store/hatchery.ts — Lambert picks the split)

interface ScriptoriumSeed {
  id: string; // nanoid — stable across re-renders
  rawSeed: string; // verbatim extracted line from PTY
  sourceAgentName: string; // the agent being hatched when the signal appeared
  capturedAt: string; // ISO 8601 timestamp (use CURRENT_DATETIME pattern)
  status: "pending" | "opened" | "dismissed";
}

interface HatcheryCrossSuggestionState {
  pendingScriptoriumSeeds: ScriptoriumSeed[];
  addSeed: (seed: Omit<ScriptoriumSeed, "id" | "status">) => void;
  dismissSeed: (id: string) => void;
  openSeed: (id: string) => void; // marks as 'opened', caller launches Scriptorium
  clearAll: () => void;
}
```

### Queue lifecycle

| Event                                    | Action                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| Signal phrase detected in PTY stream     | `addSeed(...)` — status: `pending`                                        |
| Hatcher exits Interactive mode (success) | Banner appears showing pending seed count                                 |
| User clicks "yes"                        | `openSeed(id)` per seed, Scriptorium PTY sessions launch                  |
| User clicks "no"                         | `clearAll()` — seeds discarded, no Scriptorium session                    |
| User clicks "later"                      | Seeds remain `pending`; banner re-appears on next Hatchery exit           |
| User opens Scriptorium manually          | `pendingScriptoriumSeeds` displayed as draft seeds in Scriptorium sidebar |

### Persistence

`pendingScriptoriumSeeds` is **session-persistent only** (in-memory Zustand, not persisted to disk). If the user closes Squadquarium, the queue is lost. This is intentional: the seeds came from a specific conversation context; stale seeds from a past session are more confusing than useful.

---

## 3 — Handoff Trigger

### When

The banner fires when **all** of the following are true:

1. The Hatcher's PTY session has exited Interactive mode (the `squad` process exited 0 or the user pressed the "Done" affordance in the Hatchery UI).
2. `SquadObserver` has confirmed the new agent's files are on disk (`.squad/agents/{name}/charter.md` exists).
3. `pendingScriptoriumSeeds.filter(s => s.status === 'pending').length > 0`.

### Banner UI

Location: a dismissable toast at the bottom of the Hatchery panel (not a modal — never block the diorama).

```
┌──────────────────────────────────────────────────────────┐
│ 💡 Found 2 skill opportunities during Tessa's hatching.  │
│    Open Scriptorium with these seeds?                    │
│                                                          │
│    [Yes, open now]   [Later]   [Dismiss]                 │
└──────────────────────────────────────────────────────────┘
```

- **Yes, open now:** Scriptorium panel opens. Each pending seed is listed as a draft in the Scriptorium sidebar. The first seed is auto-selected as the active draft. Clicking a draft in the sidebar launches the Scriptorium PTY session pre-seeded with that seed's `rawSeed` line.
- **Later:** Toast dismisses. Seeds stay `pending`. A small badge (🌱) appears on the Scriptorium nav icon until the user returns.
- **Dismiss:** Seeds are cleared. No Scriptorium session.

### Copy/CLI parity line

Below the banner options, show the equivalent command the user could run manually:

```
squad add-skill "exponential backoff — general-purpose retry pattern..."
```

(If Squad doesn't have an `add-skill` command yet, show the seed as a copyable one-liner prefixed by `#` and labeled "Scriptorium seed".)

---

## 4 — Seed Format

### Contract

Each seed is a **single, self-contained sentence** that describes what the skill should do. It is fed verbatim as the user's first message in the Scriptorium PTY session (the pre-seed). The Coordinator reads it as if the user typed it.

**Seed sentence rules:**

1. One line. No newlines.
2. Describes the skill's purpose in plain English. Not a command. Not a code snippet.
3. Uses the user's vocabulary, not the Coordinator's paraphrase. The extracted sentence from the PTY output is preferred over any normalization.
4. Does NOT pre-answer template fields (name, domain, triggers) — those are the Coordinator's interview job. The seed is the _starting point_, not the full spec.

**Good seeds:**

```
skill for exponential backoff with jitter for rate-limited API calls
pattern for grounding all agent questions in real template files before writing
reusable JWT validation pattern for the auth layer
```

**Bad seeds:**

```
name: rate-limit-backoff; domain: resilience; triggers: [retry, 429]
```

(Pre-fills template fields — skips the Scriptorium interview entirely. Defeats the purpose.)

```
You mentioned that the team would benefit from a skill for handling rate-limited
API calls with exponential backoff and jitter, possibly using the token-bucket
algorithm or leaky bucket, depending on the upstream API's documented rate model.
```

(Too long. The Coordinator will start an interview about the seed, not the skill.)

### Passing the seed to the PTY session

The Scriptorium PTY session is spawned with the seed as the initial stdin payload — the same mechanism the Hatchery uses to pre-seed "add a new agent." The Coordinator reads it as a user message and begins its interview. If `thorough-mode: true` is set in the session context (user has thorough mode toggled on), `squad-grill-template` activates for the Scriptorium walkthrough.

---

## 5 — Out of Scope for This Wave

The following are intentionally excluded from the first implementation and should not be designed in:

- **Automatic seed extraction during non-Hatchery PTY sessions.** Only Hatchery output is watched. Detecting skill opportunities in general Coordinator sessions is a v2 feature.
- **Seed deduplication across sessions.** If the user runs the Hatchery twice and gets the same skill suggestion both times, they see two seeds. A deduplication pass against existing `.squad/skills/` is v2.
- **Skill creation without PTY.** The Scriptorium always delegates to the Coordinator via PTY. There is no "fill in a form and write SKILL.md directly" path. That would violate the Squadquarium-reads-Squad-writes boundary.
- **Persisting seeds to disk.** Seeds are session-only. If the user wants to track a skill idea across sessions, they write it in a notepad. This keeps the implementation simple and avoids introducing a new `.squad/` write path.

---

## 6 — Implementation Notes for Lambert

This design doc is the full spec. Lambert owns the implementation. Key touchpoints:

- **PTY stream tap:** The existing `InteractiveOverlay.tsx` / `LogPanel.tsx` already receives PTY output. Lambert adds a signal-phrase scanner as a thin subscriber on the same stream. No new PTY infrastructure needed.
- **Zustand slice:** Add a `hatcheryCrossSuggestion` slice to the existing store. Keep it separate from `hatcheryMode` to avoid coupling.
- **`SquadObserver` hook:** The hatching completion event (files on disk) is already fired by `SquadObserver`. The banner trigger wires to that event + the seeds queue check.
- **Scriptorium PTY seed mechanism:** Reuse the exact mechanism the Hatchery uses to pre-seed its PTY session. The Scriptorium already has this plumbing from v0's interactive mode.
- **CLI parity line:** The seed sentence is the copyable payload. No parsing needed — display it verbatim.

Lambert should reference `InteractiveOverlay.tsx`, the Zustand store root, and `HabitatPanel.tsx` as the three primary touchpoints. No new packages needed.
