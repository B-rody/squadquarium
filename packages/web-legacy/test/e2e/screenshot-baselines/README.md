# Screenshot Baseline Policy

> Owner: Ripley (Tester / Reviewer) — 2026-05-05

This directory holds Playwright golden screenshots for the Squadquarium web
renderer. **Committed baselines are the source of truth.** CI diffs every PR
against them; a 1-cell shift is a failing diff.

---

## Naming convention

```
__screenshots__/{test-name}-{projectName}-{snapshotSuffix}.png
```

Project names correspond to the Playwright projects in `playwright.config.ts`:

- `chromium-1x` — 1× device pixel ratio (standard display)
- `chromium-2x` — 2× device pixel ratio (HiDPI / Retina)

Snapshot suffix is injected automatically by Playwright on a per-OS basis when
`PLAYWRIGHT_OS_BASELINE` env var is set (see update workflow below).

---

## Baseline storage layout (when renderer ships)

Once Lambert ships the renderer, baselines will be organised as:

```
packages/web/test/e2e/__screenshots__/
  smoke-page-shell-chromium-1x-linux.png
  smoke-page-shell-chromium-1x-win32.png
  smoke-page-shell-chromium-1x-darwin.png
  smoke-page-shell-chromium-2x-linux.png
  ...
  glyph-invariants-cell-row-chromium-1x-linux.png
  ...
```

Per-OS baselines are committed because OS font rendering, ClearType hinting,
and subpixel AA differ enough to produce false diffs cross-platform.

---

## Golden-path update workflow

1. Ensure CI is green on `main` for all three OS runners.
2. Make your renderer change on a feature branch.
3. Run locally (Windows host):
   ```
   pnpm test:web -u
   ```
   This regenerates baselines for your local OS only.
4. Push the branch; CI regenerates the Linux baseline automatically via the
   `update-baselines` reusable workflow (added in a later milestone).
5. Commit the updated `.png` files alongside the renderer change. PR must
   include both the code change and the new baselines — a PR that changes
   renderer output without updating baselines is a failing PR.

**CI never auto-updates baselines.** The `--update-snapshots` flag is
explicitly excluded from the CI `pnpm test:web` command. This ensures a
flaky screenshot drift cannot silently promote a bad render.

---

## Reviewing a diff

When Playwright reports a screenshot diff:

1. Download the `playwright-report-{os}` artifact from the failing workflow run.
2. Open `playwright-report/index.html` — each failing test shows a side-by-side
   diff with expected / actual / diff images.
3. A diff is intentional (renderer improvement) → update baselines per the
   workflow above.
4. A diff is a regression → file a bug, block the PR.

---

## Glyph-grid tolerance

Pixel-diff tolerance is set to **zero** by default. The glyph renderer targets
integer-aligned cells; any subpixel shift is a bug, not a tolerance case. If a
legitimate anti-aliasing delta appears, document it here and set the narrowest
possible threshold — do not use Playwright's default percentage threshold.
