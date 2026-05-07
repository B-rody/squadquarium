---
name: husky-pre-push-gate
domain: repo-governance
triggers:
  - husky
  - pre-push
  - local validation gate
  - prevent broken main pushes
  - pnpm workspace gate
roles:
  - lead
  - tester
---

# Skill: husky-pre-push-gate

Use this when a pnpm workspace needs a local Git hook that blocks pushes unless the same core gate as CI is green.

## Pattern

1. Install Husky at the workspace root:

   ```sh
   pnpm add -D -w husky
   pnpm exec husky init
   ```

2. Keep the root onboarding script:

   ```json
   "prepare": "husky"
   ```

3. Use Husky v9 hook format. Hook files are plain shell bodies. Do not add the v8 shebang or source line:

   ```sh
   pnpm lint && pnpm -r build && pnpm -r test
   ```

4. Delete the sample `.husky/pre-commit` unless the project explicitly wants commit-time gating. Prefer pre-push for expensive workspace builds/tests.

5. Document the emergency bypass:

   ```sh
   git push --no-verify
   ```

## Why it works

Pre-push is late enough to avoid slowing every small local commit, but early enough to stop broken code before it leaves the machine. The root `prepare` script makes hooks self-installing on `pnpm install`, which keeps contributor setup low-friction.

## Verification

Run `pnpm install`, then push with `--dry-run` to prove Git invokes the hook. A successful hook should show lint, recursive build, and recursive test before Git reports the dry-run push result.
