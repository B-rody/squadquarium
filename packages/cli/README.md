# `squadquarium` — CLI package

> Owner: Parker (Backend Engineer)
> Reviewer: Ripley (Tester / Reviewer)

The `squadquarium` npm package is the **primary installable artifact** in the
Squadquarium monorepo. It is a Node.js CLI that launches the fullscreen TUI by
default and exposes diagnostic subcommands that delegate to the `squad` CLI.

> **Squadquarium is not yet published to npm. `npm install -g squadquarium` will be the install path once Brody publishes it; until then, build from source.**

**Build from source and install the global bin:**

```bash
git clone https://github.com/B-rody/squadquarium
cd squadquarium
pnpm install
pnpm -r build
node packages/cli/dist/index.js [path]
# or, for a real `squadquarium` / `sqq` bin on PATH:
pnpm pack-all
npm install -g packages/cli/squadquarium-0.0.1.tgz
squadquarium [path]
```

Run from any repo where Squad is initialised and the TUI will open in your terminal.

## Aliases

Both `squadquarium` and the short alias `sqq` are wired in `package.json`'s
`bin` field. Either name works after global install.

## Publish shape

The package bundles workspace code inline using esbuild (see `scripts/bundle.mjs`).
The `prepack` lifecycle script stages root `skins/` into `packages/cli/skins/`.
Runtime dependencies such as `terminal-kit`, `node-pty`, `ws`, and `open`
remain normal npm dependencies.

## Key flags

| Flag               | Effect                                                                       |
| ------------------ | ---------------------------------------------------------------------------- |
| `--headless-smoke` | Boot the TUI once without terminal control and exit with a JSON result       |
| `doctor`           | Diagnose the local environment (node version, squad PATH, node-pty, port)    |
| `status`           | Print a one-screen squad status snapshot without entering the fullscreen TUI |
