# Squadquarium VS Code Extension

Ambient terminal diorama for your AI dev team — right inside VS Code.

## Features

- Open the Squadquarium diorama in a VS Code webview panel via the **"Squadquarium: Open Diorama"** command (`squadquarium.open`).
- Automatically spawns a local Squadquarium server on first activation and reuses it across panel opens.
- Proxies the WebSocket connection between the webview and the server transparently.

## Requirements

- VS Code `^1.85.0`
- Node.js `>=22.5.0` on `PATH`
- The `squadquarium` CLI installed globally — **Squadquarium is not yet published to npm**; build from source first:
  ```bash
  git clone https://github.com/B-rody/squadquarium
  cd squadquarium
  pnpm install && pnpm -r build
  pnpm pack-all
  npm install -g packages/cli/squadquarium-0.0.1.tgz
  ```
  `npm install -g squadquarium` will be the install path once Brody publishes it. Until then the tarball install above is required. Alternatively, use the monorepo dev layout with `packages/cli/dist/index.js` built.

## Usage

1. Open the command palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
2. Run **"Squadquarium: Open Diorama"**.
3. The diorama panel opens and connects to your local squad.

## Building the VSIX

The extension is built with esbuild into `dist/extension.js`:

```bash
pnpm --filter squadquarium-vscode build
```

To package as a `.vsix` for local install or marketplace upload:

```bash
# Requires @vscode/vsce installed globally or via npx
npx @vscode/vsce package --out squadquarium-vscode.vsix
```

> **Note:** Brody runs `vsce package` and `vsce publish` manually with marketplace credentials. The CI pipeline intentionally omits the publish step.

## Bundling the Web Assets

At pack time the Vite web bundle (`packages/web/dist/`) must be copied into `webview-dist/` inside the extension directory. The VSIX prepack step (to be automated) mirrors what `packages/cli/scripts/prepack.mjs` does for the CLI tarball.

For now, copy manually before packaging:

```bash
cp -r packages/web/dist packages/squadquarium-vscode/webview-dist
```

## Architecture

```
VS Code Extension Process          VS Code Renderer (webview)
─────────────────────────          ──────────────────────────
activate()                         index.html (Vite bundle)
  └── ensureServer()               └── WS proxy shim (injected)
        └── spawn squadquarium          └── postMessage ↔ ws-proxy
              --serve-only
  └── createPanel()
        └── ws.WebSocket(ws://127.0.0.1:{port}/ws)
              ↕ relay
        └── panel.webview.postMessage / onDidReceiveMessage
```

The webview cannot open raw TCP sockets, so a JS shim patches `window.WebSocket` inside the renderer to route through `acquireVsCodeApi().postMessage`. The extension process holds the real `ws` connection and relays frames in both directions.
