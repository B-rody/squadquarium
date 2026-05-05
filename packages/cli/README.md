# `squadquarium` — CLI package

> Owner: Parker (Backend Engineer)
> Reviewer: Ripley (Tester / Reviewer)

The `squadquarium` npm package is the **only published artifact** in the
Squadquarium monorepo. It is a Node.js CLI that starts a local HTTP/WebSocket
server, serves the `@squadquarium/web` bundle (the terminal-styled diorama
UI), and exposes management commands that delegate to the `squad` CLI. Install
once globally (`npm install -g squadquarium`), run from any repo where Squad
is initialised, and a browser window opens to the live diorama. The package
bundles `@squadquarium/core`'s compiled output and `@squadquarium/web`'s Vite
bundle via `bundleDependencies` and the `files` manifest — no separate install
of the internal packages is required. The CLI entry point is `src/index.ts`,
compiled to `dist/index.js`; the `bin` field in `package.json` wires the
`squadquarium` command.
