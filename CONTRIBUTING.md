# Contributing to Squadquarium

> Last updated: 2026-05-05 — Ripley (Tester / Reviewer)

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

## Windows-host caveats (Brady's setup)

Brady develops exclusively on Windows. Cross-platform validation runs in CI —
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

The CLI is the only published artifact. It uses **esbuild** to bundle
`@squadquarium/core` inline at build time; `@squadquarium/web`'s Vite bundle is
copied into `web-dist/` by the `prepack` script. See `packages/cli/README.md`.

### Serve-only mode

The CLI supports a `--serve-only` flag that boots the HTTP/WS server without
running the headless smoke burst or opening a browser — used by Playwright's
`webServer` to hold the server up during e2e tests:

```bash
node packages/cli/dist/index.js --serve-only --port=6280
```
