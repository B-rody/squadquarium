# Dallas — Pre-push validation gate

**Date:** 2026-05-06T17:37:39-07:00  
**Author:** Dallas (Lead)  
**Status:** Adopted

## Decision

Adopt a Husky v9 local pre-push gate at the workspace root.

## Rationale

A direct push to `main` exposed the gap: CI catches broken code after the fact, but nothing stopped the broken push from leaving the local machine. The smallest useful cut is a push-time hook that runs the same core lint-build-test gate as CI before `main` receives new commits.

## Command

```sh
pnpm lint && pnpm -r build && pnpm -r test
```

## Bypass

Emergency bypass is explicit and visible:

```sh
git push --no-verify
```

Use only when the failure is known unrelated to the pushed change or when Brody deliberately accepts the risk.
