# Contributing to Squadquarium

> Last updated: 2026-05-06 — Ripley (Tester / Reviewer)

---

## Per-commit quality gate

Every commit **must** pass the quality gate before it lands — no exceptions,
no "will fix in next commit":

```bash
node scripts/quality-gate.mjs
# or equivalently via the package scripts:
pnpm lint && pnpm -r test && pnpm -r build && pnpm -r test:web
```

**The exact rule:** `pnpm lint && pnpm -r test && pnpm -r build && pnpm smoke`
must exit 0. If any step fails the commit does not land. CI enforces this on
every push and PR; local enforcement is the engineer's responsibility.

### What the gate checks

| Step | Command | What it validates |
|------|---------|-------------------|
| Lint | `pnpm lint` | ESLint + Prettier check across all packages |
| Test | `pnpm -r test` | Vitest unit + integration suite (packages/core, packages/cli, packages/web) |
| Build | `pnpm -r build` | TypeScript type-check + esbuild bundle (CLI) + Vite bundle (web) |
| e2e | `pnpm test:web` | Playwright e2e suite (packages/web) on local Chromium |
| Smoke | `pnpm smoke` | Headless smoke: `node packages/cli/dist/index.js --headless-smoke` |

CI additionally runs the full three-OS matrix and the pack-install smoke
(pack → `npm install -g <tarball>` → `squadquarium --headless-smoke`).

---

## Reviewer-rejection lockout policy

Ripley (Tester / Reviewer) reviews all PRs and spikes before they land.

**Strict lockout rule:** if Ripley rejects a PR or spike, the **original
author is locked out of producing the next revision**. The Coordinator routes
the fix to a different engineer or escalates to Dallas. The same rule applies
recursively if the revision is also rejected.

**Rationale:** "I'll fix the feedback myself" defeats the purpose of an
independent reviewer. The lockout is not punitive — it ensures a fresh pair
of eyes on every rework cycle.

---

## Screenshot baselines

Playwright screenshot baselines live at:
```
packages/web/test/e2e/__screenshots__/
```

### How to update baselines (clean-run procedure)

1. Ensure `main` is green on CI (all three OS runners).
2. Make your renderer change on a feature branch.
3. Run from the repo root on your local machine (Windows host):
   ```bash
   pnpm test:web -u
   ```
   This regenerates baselines for your local OS.
4. Commit the updated `.png` files alongside your code change. A PR that
   changes rendered output **without** updated baselines will be rejected.

**CI never auto-updates baselines.** The `--update-snapshots` flag is
excluded from the CI `pnpm test:web` command by design.

For full baseline policy details see:
`packages/web/test/e2e/screenshot-baselines/README.md`

---

## CI matrix overview

GitHub Actions runs three jobs on every push to `main` and on every PR:

### `lint-build-test`
- **Matrix:** `ubuntu-latest` × `windows-latest` × `macos-latest`, Node 22.5.0
- Runs lint → Vitest → build → Playwright (macOS skipped in v0 — slowest runner, added once win + linux are green)
- Uploads Playwright report + screenshot diffs as artifacts on failure

### `pack-install-smoke`
- **Depends on:** `lint-build-test`
- **Matrix:** same three OSes
- Runs `pnpm pack-all` (packs `packages/cli`) → installs globally from the tarball → runs
  `squadquarium --headless-smoke` on each OS runner
- `continue-on-error: false` — wired and required since v0 milestone

Artifacts from failing runs are available in the GitHub Actions UI for 14 days.

---

## Windows-host caveats (Brody's setup)

Brody develops exclusively on Windows. Cross-platform validation runs in CI —
do **not** assume "works on my machine" unless CI confirms all three OSes.

**`node-pty` build dependency:** `pnpm install` may fail to build the native
`node-pty` binary on Windows without the VS Build Tools. If you hit a
`node-pty` build error:

```powershell
# Install Windows build tools (run once, elevated PowerShell):
npm install -g windows-build-tools
# or, if that fails on Node 18+:
winget install Microsoft.VisualStudio.2022.BuildTools
```

`squadquarium doctor` will detect the failure and print copyable fix-up
instructions. The v0 no-PTY fallback (read-only log-tail) works without
build tools.

---

## Package layout

| Package | Path | Owner | Published |
|---------|------|-------|-----------|
| `@squadquarium/core` | `packages/core/` | Parker | No (internal) |
| `@squadquarium/web` | `packages/web/` | Lambert | No (bundled via CLI) |
| `squadquarium` (CLI) | `packages/cli/` | Parker | **Yes** — npm |
| `squadquarium-vscode` | `packages/squadquarium-vscode/` | Lambert | **Yes** — VS Marketplace |
| `squadquarium-app` | `packages/squadquarium-app/` | Lambert | **Opt-in** — Tauri native binary |

The CLI is the only **npm-published** artifact. It uses **esbuild** to bundle
`@squadquarium/core` inline at build time; `@squadquarium/web`'s Vite bundle is
copied into `web-dist/` by the `prepack` script. See `packages/cli/README.md`.

### Serve-only mode

The CLI supports a `--serve-only` flag that boots the HTTP/WS server without
running the headless smoke burst or opening a browser — used by Playwright's
`webServer` to hold the server up during e2e tests:

```bash
node packages/cli/dist/index.js --serve-only --port=6280
```

---

## prebuildify and native prebuilds

`node-pty` (and any future native addon) ships prebuilt binaries via the
`prebuildify` pipeline. When a prebuild exists for your Node + platform tuple,
`pnpm install` uses it directly and **does not invoke node-gyp**. This makes
installs fast and build-tool-free for most users.

If no prebuild exists for your platform (uncommon), node-gyp runs automatically.
The `squadquarium doctor` command reports whether `node-pty` loaded from a prebuild
or fell back to a gyp build:

```bash
node packages/cli/dist/index.js doctor
```

---

## Tauri native window wrapper (`squadquarium-app`)

`packages/squadquarium-app/` is an **opt-in** Tauri 2 wrapper that produces a
frameless, transparent native OS window instead of a browser tab.

### Build prerequisites

The Tauri wrapper requires the **Rust toolchain** — Brody's host does not have
Rust installed by policy, so the package ships as a scaffold only. Install via:

```
https://rustup.rs/
```

On **Windows** also install MSVC Build Tools:

```
winget install Microsoft.VisualStudio.2022.BuildTools
```

### Developing the Tauri wrapper

```bash
# 1. Build the CLI (produces web bundle the Tauri window loads):
pnpm --filter squadquarium build

# 2. Start the CLI server:
node packages/cli/dist/index.js --serve-only --port=6280

# 3. In a second terminal, run Tauri dev:
pnpm --filter squadquarium-app dev
```

### Building platform binaries

```bash
pnpm --filter squadquarium-app build
```

This produces `.app` / `.exe` / `.AppImage` / `.deb` installers in
`packages/squadquarium-app/src-tauri/target/release/bundle/`.

---

## VS Code webview wrapper (`squadquarium-vscode`)

```bash
pnpm --filter squadquarium-vscode build
```

This produces the VS Code extension VSIX in `packages/squadquarium-vscode/`.
Run `code --install-extension packages/squadquarium-vscode/*.vsix` to install locally.

---

## CLI subcommands (v1 + v2)

The `squadquarium` CLI now supports the following subcommands in addition to the
base `squadquarium [path]` server command:

| Subcommand | Description |
|-----------|-------------|
| `squadquarium doctor` | Node/PTY/port/Squad health checks |
| `squadquarium status` | One-screen snapshot (agents, decisions, events) |
| `squadquarium trace <agent>` | Live trace for a named agent |
| `squadquarium why <query>` | Ask Squad why it did something |
| `squadquarium inspect <agent>` | Full agent inspection (charter, history, skills) |
| `squadquarium diorama` | Launch the terminal diorama view |
| `squadquarium aspire` | Browse and trigger aspirations |
| `squadquarium --headless-smoke` | CI smoke boot (exits 0/non-zero) |

```bash
node packages/cli/dist/index.js --help
```

---

## Command palette (`:` key) — v1 + v2 verbs

Inside the diorama web UI, press `:` to open the command palette. New v1 + v2 verbs:

| Verb | Effect |
|------|--------|
| `:scrub` | Open the Time Scrubber panel (replay events) |
| `:wisdom` | Open the Wisdom Wing overlay (team patterns + skills) |
| `:settings` | Open the Settings panel |
| `:marketplace` | Open the Plugin Marketplace panel |
| `:obs <mode>` | Toggle OBS-friendly background mode (`green-screen` / `transparent` / `dark` / `off`) |
| `:skins` | Open the Skin Browser |
| `:standup` | Generate a standup summary from recent events |
| `:ralph start` | Start `squad watch` in an interactive PTY session |
| `:ralph stop` | Stop the running `squad watch` session |
| `:trace <agent>` | Open a live trace overlay for the named agent |
| `:why <query>` | Ask Squad why it did something (interactive PTY) |
| `:inspect <agent>` | Full agent inspect panel |
| `:diorama` | Launch terminal diorama |
| `:aspire` | Browse and trigger aspirations |

---

## Multi-attach mode

The CLI supports attaching to multiple squad roots simultaneously via repeated
`--attach` flags:

```bash
node packages/cli/dist/index.js --attach ~/project-a/.squad --attach ~/project-b/.squad
```

When multiple roots are attached, the web UI renders a horizontal split with one
habitat panel per root. Each panel observes its own event stream independently.

---

## Game mode (cosmetic-only, hard rule)

Game mode adds an XP / Level / Ideas overlay to the diorama. Toggle it in the
Settings panel (`⚙` button or `:settings`).

**Hard rule:** game-mode values (XP, level, ideas) are cosmetic counters derived
from event counts. They **must never** affect:

- Habitat glyph layout
- Band positions or agent role state
- The log panel output
- Any value in the reconciler state

This invariant is enforced by the Playwright `game-mode.spec.ts` test
(`window.__squadquarium__.__getReconcilerState()` must be identical with/without
game mode enabled). Violations are a blocker — do not bypass Ripley's gate.

---

## Plugin marketplace

Browse and install Squad plugins via:

- **UI:** `:marketplace` in the command palette, or `squad plugin install <name>`
  via the interactive PTY (`:marketplace browse <url>`)
- **CLI:** `squad plugin install <name>` directly from a terminal

Installed plugins are tracked in `.squad/plugins/marketplaces.json`. The
marketplace panel reads this file via the CLI's WebSocket bridge.

---

## Screenshot baseline policy (updated for v1 + v2)

Baselines now cover all skins × all states × all OS variants. The policy is
**deferred until visuals stabilize** (i.e., all v1 + v2 components are landed
and the screenshot suite passes cleanly on CI for two consecutive pushes).

Until stabilized:
- **Do not update baselines for WIP components.** Wait for Lambert's sign-off.
- **Skin browser, OBS mode, game panel, marketplace** — no baselines yet.
- **Core smoke baseline** (`smoke-root.png`) is the only active golden.

Once visuals stabilize, run the clean-baseline procedure from the repo root:

```bash
pnpm test:web -u
```

Commit the updated `.png` files. CI never auto-updates baselines.
