# `squadquarium` — CLI package

> Owner: Parker (Backend Engineer)
> Reviewer: Ripley (Tester / Reviewer)

The `squadquarium` npm package is the **primary installable artifact** in the
Squadquarium monorepo. It is a Node.js CLI that starts a local HTTP/WebSocket
server, serves the `@squadquarium/web` bundle (the terminal-styled diorama
UI), and exposes management commands that delegate to the `squad` CLI.

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

Run from any repo where Squad is initialised and a browser window opens to the live diorama.

## Aliases

Both `squadquarium` and the short alias `sqq` are wired in `package.json`'s
`bin` field. Either name works after global install.

## Publish shape

The package bundles `@squadquarium/core` **inline** using esbuild (see
`scripts/bundle.mjs`). The `prepack` lifecycle script copies:

- `@squadquarium/web`'s Vite output → `web-dist/`
- root `skins/` → `skins/`

so that `dist/index.js`, `web-dist/`, and `skins/` are all present in the
tarball. No separate install of internal packages is required.

## Key flags

| Flag               | Effect                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------- |
| `--headless-smoke` | Boot the server, run a WebSocket connectivity check, and exit with a JSON result                        |
| `--serve-only`     | Boot the server without running the smoke burst or opening a browser — used by Playwright's `webServer` |
| `--port <n>`       | Override the default port (6280)                                                                        |
| `doctor`           | Diagnose the local environment (node version, squad PATH, node-pty, port)                               |
