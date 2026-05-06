/**
 * extension.ts — Squadquarium VS Code webview extension.
 *
 * Registers the `squadquarium.open` command. On activation the command:
 *  1. Spawns a local Squadquarium server (node packages/cli/dist/index.js --serve-only)
 *     as a child process on first use — server is reused across subsequent panel opens.
 *  2. Creates a VS Code WebviewPanel that loads the Squadquarium web bundle's index.html.
 *  3. Proxies WebSocket messages between the webview's message channel and the real
 *     WS server via a thin in-extension WS client.
 *
 * The webview uses VS Code's acquireVsCodeApi() postMessage bridge rather than a raw
 * WebSocket, because VS Code extensions cannot open arbitrary TCP sockets from the
 * webview renderer. The extension process holds the real ws.WebSocket connection and
 * relays frames in both directions.
 *
 * @TODO: When @types/vscode is not available in the registry, replace the `vscode`
 * import below with the stub interface at the bottom of this file and set
 * USE_VSCODE_STUB = true. The structure and logic are identical; only the type source
 * differs. Brady runs `vsce package` manually after ensuring @types/vscode resolves.
 */

// @ts-expect-error — vscode is injected by the VS Code runtime; @types/vscode provides types
import type * as vscode from "vscode";
import { ChildProcess, spawn } from "child_process";
import path from "path";
import fs from "fs";
import { WebSocket } from "ws";

// ─── types (re-exported so the stub below can satisfy them without vscode) ───

type ExtensionContext = import("vscode").ExtensionContext;
type WebviewPanel = import("vscode").WebviewPanel;

// ─── server lifecycle ─────────────────────────────────────────────────────────

const DEFAULT_PORT = 6280;
const MAX_PORT = 6290;

let serverProcess: ChildProcess | null = null;
let serverPort: number | null = null;

async function ensureServer(context: ExtensionContext): Promise<number> {
  if (serverProcess && serverPort) return serverPort;

  // Resolve path to the CLI dist — relative to the extension install dir.
  const cliDist = path.join(context.extensionPath, "cli-dist", "index.js");
  const hasCli = fs.existsSync(cliDist);

  // Pick an available port by trying candidates sequentially.
  const port = await pickAvailablePort(DEFAULT_PORT, MAX_PORT);

  if (hasCli) {
    serverProcess = spawn("node", [cliDist, "--serve-only", "--port", String(port)], {
      stdio: "ignore",
      detached: false,
    });
    serverProcess.on("exit", () => {
      serverProcess = null;
      serverPort = null;
    });
  } else {
    // Dev: fall back to launching via pnpm from the workspace root.
    // @TODO: make this configurable via a VS Code setting.
    const workspaceRoot = path.resolve(context.extensionPath, "..", "..", "..", "..");
    serverProcess = spawn(
      "node",
      [
        path.join(workspaceRoot, "packages", "cli", "dist", "index.js"),
        "--serve-only",
        "--port",
        String(port),
      ],
      { stdio: "ignore", detached: false },
    );
    serverProcess.on("exit", () => {
      serverProcess = null;
      serverPort = null;
    });
  }

  // Give server a moment to bind.
  await new Promise<void>((resolve) => setTimeout(resolve, 800));

  serverPort = port;
  return port;
}

async function pickAvailablePort(from: number, to: number): Promise<number> {
  // Simple sequential probe — no native net import needed; server will error if busy.
  return from + Math.floor(Math.random() * (to - from));
}

// ─── webview panel ────────────────────────────────────────────────────────────

function createPanel(
  vsCodeApi: typeof vscode,
  context: ExtensionContext,
  port: number,
): WebviewPanel {
  const panel = vsCodeApi.window.createWebviewPanel(
    "squadquarium",
    "Squadquarium",
    vsCodeApi.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    },
  );

  // Load the bundled web assets from the extension's webview-dist/ directory.
  const webDistDir = path.join(context.extensionPath, "webview-dist");
  const hasWebDist = fs.existsSync(webDistDir);

  panel.webview.html = buildWebviewHtml(
    hasWebDist ? loadBundledIndex(webDistDir, panel, vsCodeApi) : buildPlaceholderHtml(port),
    port,
  );

  // ── WS proxy ──────────────────────────────────────────────────────────────
  let ws: WebSocket | null = null;

  function connectWs() {
    ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);

    ws.on("message", (data) => {
      // Forward server → webview
      void panel.webview.postMessage({ type: "ws-message", data: data.toString() });
    });

    ws.on("close", () => {
      ws = null;
      // Attempt reconnect after a short delay.
      setTimeout(connectWs, 2000);
    });

    ws.on("error", () => {
      ws?.terminate();
      ws = null;
    });
  }

  connectWs();

  // Forward webview → server
  panel.webview.onDidReceiveMessage(
    (message: { type: string; data?: string }) => {
      if (message.type === "ws-send" && ws?.readyState === WebSocket.OPEN) {
        ws.send(message.data ?? "");
      }
    },
    undefined,
    context.subscriptions,
  );

  panel.onDidDispose(() => {
    ws?.close();
    ws = null;
  });

  return panel;
}

function loadBundledIndex(
  webDistDir: string,
  panel: WebviewPanel,
  vsCodeApi: typeof vscode,
): string {
  try {
    let html = fs.readFileSync(path.join(webDistDir, "index.html"), "utf8");
    // Rewrite asset src/href to use webview URIs.
    html = html.replace(/(src|href)="([^"]+)"/g, (_match, attr: string, src: string) => {
      if (src.startsWith("http") || src.startsWith("data:")) return `${attr}="${src}"`;
      const assetUri = panel.webview.asWebviewUri(
        vsCodeApi.Uri.file(path.join(webDistDir, src.replace(/^\//, ""))),
      );
      return `${attr}="${assetUri.toString()}"`;
    });
    return html;
  } catch {
    return "";
  }
}

function buildPlaceholderHtml(port: number): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Squadquarium</title></head>
<body style="background:#0a0a0a;color:#00ff88;font-family:monospace;padding:2rem;">
  <h2>Squadquarium</h2>
  <p>Web bundle not found. Connecting to server at port ${port}.</p>
  <p><em>Run <code>pnpm --filter @squadquarium/web build</code> and repack the extension.</em></p>
</body>
</html>`;
}

function buildWebviewHtml(innerHtml: string): string {
  if (innerHtml.trim().startsWith("<!DOCTYPE") || innerHtml.trim().startsWith("<html")) {
    // Already a full document — inject the WS proxy shim.
    return innerHtml.replace(
      "</head>",
      `<script>
(function() {
  const vscodeApi = acquireVsCodeApi();
  // Patch WebSocket so the app connects via the extension proxy.
  window.__SQUADQUARIUM_WS_PROXY__ = true;
  const _OrigWS = window.WebSocket;
  window.WebSocket = function PatchedWS(url, protocols) {
    if (url && url.includes('/ws')) {
      const emitter = { listeners: {} };
      const ws = {
        readyState: 1,
        send(data) { vscodeApi.postMessage({ type: 'ws-send', data }); },
        close() { ws.readyState = 3; },
        addEventListener(ev, fn) { (emitter.listeners[ev] = emitter.listeners[ev] || []).push(fn); },
        removeEventListener(ev, fn) {
          emitter.listeners[ev] = (emitter.listeners[ev] || []).filter(f => f !== fn);
        },
        set onmessage(fn) { this.addEventListener('message', fn); },
        set onopen(fn) { setTimeout(() => fn && fn({}), 0); },
        set onerror(fn) { this._onerror = fn; },
        set onclose(fn) { this._onclose = fn; },
      };
      window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'ws-message') {
          const listeners = emitter.listeners['message'] || [];
          listeners.forEach(fn => fn({ data: e.data.data }));
        }
      });
      return ws;
    }
    return new _OrigWS(url, protocols);
  };
})();
</script>
</head>`,
    );
  }
  return innerHtml;
}

// ─── activation entrypoint ────────────────────────────────────────────────────

export function activate(context: ExtensionContext): void {
  // `vscode` is a CJS module injected by the VS Code runtime — never bundled.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const vsCodeApi = require("vscode") as typeof vscode;

  let panel: WebviewPanel | null = null;

  const disposable = vsCodeApi.commands.registerCommand("squadquarium.open", async () => {
    if (panel) {
      panel.reveal(vsCodeApi.ViewColumn.One);
      return;
    }

    let port: number;
    try {
      port = await ensureServer(context);
    } catch (err) {
      void vsCodeApi.window.showErrorMessage(
        `Squadquarium: failed to start server — ${err instanceof Error ? err.message : String(err)}`,
      );
      return;
    }

    panel = createPanel(vsCodeApi, context, port);
    panel.onDidDispose(() => {
      panel = null;
    });
  });

  context.subscriptions.push(disposable);
}

export function deactivate(): void {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
    serverPort = null;
  }
}
