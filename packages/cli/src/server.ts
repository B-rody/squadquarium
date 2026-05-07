import fs from "node:fs";
import http from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PTYPool,
  PtyPoolFullError,
  listMarketplaces,
  browseMarketplace,
  installPlugin,
  type ClientFrame,
  type ServerFrame,
  type SquadStateAdapter,
  type SquadquariumEvent,
} from "@squadquarium/core";
import { WebSocket, WebSocketServer, type RawData } from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const pkg = require(path.resolve(__dirname, "..", "package.json")) as { version: string };
const DEFAULT_PORT = 6280;
const MAX_PORT = 6290;

export interface AttachedAdapterInfo {
  id: string;
  label: string;
  adapter: SquadStateAdapter;
}

export interface ServerOptions {
  adapter: SquadStateAdapter | null;
  attachedAdapters?: AttachedAdapterInfo[];
  port?: number;
  host?: string;
  squadVersion: string | null;
  squadRoot: string | null;
  mode: "connected" | "empty-state";
  skinsDir?: string;
}

export interface ServerInstance {
  port: number;
  url: string;
  close(): Promise<void>;
}

export async function startServer(opts: ServerOptions): Promise<ServerInstance> {
  const pool = new PTYPool();
  const host = opts.host ?? "127.0.0.1";
  const candidatePorts = opts.port ? [opts.port] : range(DEFAULT_PORT, MAX_PORT);
  let lastError: unknown;

  for (const port of candidatePorts) {
    const wss = new WebSocketServer({ noServer: true });
    const sockets = new Set<WebSocket>();
    const server = http.createServer((req, res) => serveStatic(req, res));

    server.on("upgrade", (req, socket, head) => {
      if (new URL(req.url ?? "/", `http://${host}`).pathname !== "/ws") {
        socket.destroy();
        return;
      }

      if (!isAllowedOrigin(req.headers.origin)) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    });

    wss.on("connection", (ws) => {
      sockets.add(ws);
      handleConnection(ws, opts, pool).finally(() => sockets.delete(ws));
    });

    try {
      await listen(server, port, host);
      return {
        port,
        url: `http://${host}:${port}`,
        async close() {
          for (const socket of sockets) socket.terminate();
          pool.disposeAll();
          await closeWss(wss);
          await closeServer(server);
        },
      };
    } catch (err) {
      lastError = err;
      await closeWss(wss).catch(() => undefined);
      await closeServer(server).catch(() => undefined);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("No available squadquarium port");
}

async function handleConnection(ws: WebSocket, opts: ServerOptions, pool: PTYPool): Promise<void> {
  let serverSeq = 0;
  const ptyCleanup = new Map<string, () => void>();
  const attachedUnsubscribers: Array<() => void> = [];

  const nextSeq = () => {
    serverSeq += 1;
    return serverSeq;
  };
  const send = (frame: ServerFrame) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(frame));
  };
  const sendError = (message: string, code = "error", replyTo?: number) => {
    send({ kind: "error", serverSeq: nextSeq(), replyTo, message, code });
  };

  send({
    kind: "hello",
    serverSeq: 0,
    squadquariumVersion: pkg.version,
    squadVersion: opts.squadVersion,
    squadRoot: opts.squadRoot,
    mode: opts.mode,
  });

  let unsubscribe: (() => void) | null = null;

  try {
    if (opts.adapter) {
      const snapshot = await opts.adapter.getSnapshot();
      const attachedSquads = opts.attachedAdapters
        ? await Promise.all(
            opts.attachedAdapters.map(async ({ id, label, adapter }) => ({
              id,
              label,
              snapshot: await adapter.getSnapshot(),
            })),
          )
        : undefined;
      send({ kind: "snapshot", serverSeq: nextSeq(), snapshot, attachedSquads });
      unsubscribe = opts.adapter.subscribe((event) =>
        send({ kind: "event", serverSeq: nextSeq(), event }),
      );

      for (const { id: attachedSquadId, adapter } of opts.attachedAdapters ?? []) {
        const unsub = adapter.subscribe((event) =>
          send({
            kind: "event",
            serverSeq: nextSeq(),
            event: { ...event, payload: { ...(event.payload as object), attachedSquadId } },
            attachedSquadId,
          }),
        );
        attachedUnsubscribers.push(unsub);
      }
    }
  } catch (err) {
    sendError(err instanceof Error ? err.message : String(err), "snapshot-failed");
  }

  ws.on("message", (data) => {
    void handleClientFrame(data, opts, pool, ptyCleanup, send, sendError, nextSeq);
  });

  await onceClose(ws);
  unsubscribe?.();
  for (const unsub of attachedUnsubscribers) unsub();
  for (const [ptyId, cleanup] of ptyCleanup) {
    cleanup();
    pool.kill(ptyId);
  }
}

async function handleClientFrame(
  data: RawData,
  opts: ServerOptions,
  pool: PTYPool,
  ptyCleanup: Map<string, () => void>,
  send: (frame: ServerFrame) => void,
  sendError: (message: string, code?: string, replyTo?: number) => void,
  nextSeq: () => number,
): Promise<void> {
  let frame: ClientFrame;

  try {
    frame = JSON.parse(data.toString()) as ClientFrame;
  } catch {
    sendError("Malformed client frame", "bad-json");
    return;
  }

  try {
    switch (frame.kind) {
      case "pty-spawn": {
        // TODO(v1 hardening): validate frame.cmd is in an allowlist (currently
        // only "squad"). The "all mutations route through the squad CLI"
        // invariant is enforced by the web UI today, not the server. Loopback
        // binding mitigates risk, but a misbehaving browser tab on 127.0.0.1
        // could spawn arbitrary processes. See Ripley audit 2026-05-06.
        const { ptyId } = await pool.spawn(frame.cmd, frame.args, {
          cwd: frame.cwd,
          cols: frame.cols,
          rows: frame.rows,
        });
        const offData = pool.onData(ptyId, (ptyData) =>
          send({ kind: "pty-out", serverSeq: nextSeq(), ptyId, data: ptyData }),
        );
        const offExit = pool.onExit(ptyId, (code, signal) => {
          ptyCleanup.get(ptyId)?.();
          ptyCleanup.delete(ptyId);
          send({ kind: "pty-exit", serverSeq: nextSeq(), ptyId, code, signal });
        });
        ptyCleanup.set(ptyId, () => {
          offData();
          offExit();
        });
        send({ kind: "pty-spawned", serverSeq: nextSeq(), ptyId, replyTo: frame.clientSeq });
        break;
      }
      case "pty-write":
        pool.write(frame.ptyId, frame.data);
        break;
      case "pty-resize":
        pool.resize(frame.ptyId, frame.cols, frame.rows);
        break;
      case "pty-kill":
        pool.kill(frame.ptyId);
        ptyCleanup.get(frame.ptyId)?.();
        ptyCleanup.delete(frame.ptyId);
        break;
      case "ping":
        send({ kind: "pong", serverSeq: nextSeq(), clientSeq: frame.clientSeq });
        break;
      case "marketplace-list-req": {
        const marketplaces = opts.squadRoot ? await listMarketplaces(opts.squadRoot) : [];
        send({ kind: "marketplace-list", serverSeq: nextSeq(), marketplaces });
        break;
      }
      case "marketplace-browse-req": {
        const plugins = opts.squadRoot
          ? await browseMarketplace(opts.squadRoot, frame.marketplace)
          : [];
        send({
          kind: "marketplace-browse",
          serverSeq: nextSeq(),
          marketplace: frame.marketplace,
          plugins,
        });
        break;
      }
      case "marketplace-install-req": {
        if (!opts.squadRoot) {
          sendError("No squad root available", "no-squad-root", frame.clientSeq);
          break;
        }
        let output = "";
        const exitCode = await installPlugin(
          opts.squadRoot,
          frame.marketplace,
          frame.plugin,
          (d) => {
            output += d;
          },
        );
        send({
          kind: "marketplace-install",
          serverSeq: nextSeq(),
          marketplace: frame.marketplace,
          plugin: frame.plugin,
          output,
          exitCode,
        });
        break;
      }
      case "replay-request": {
        const events = opts.squadRoot
          ? await readReplayEvents(opts.squadRoot, frame.from, frame.to)
          : [];
        send({ kind: "replay", serverSeq: nextSeq(), events });
        break;
      }
      default:
        sendError(
          "Unsupported client frame",
          "unsupported-frame",
          (frame as { clientSeq?: number }).clientSeq,
        );
    }
  } catch (err) {
    const code = err instanceof PtyPoolFullError ? err.code : "frame-failed";
    sendError(err instanceof Error ? err.message : String(err), code, frame.clientSeq);
  }
}

const REPLAY_EVENT_CAP = 1000;

async function readReplayEvents(
  squadRoot: string,
  from: number | undefined,
  to: number | undefined,
): Promise<SquadquariumEvent[]> {
  const logDir = path.join(squadRoot, "orchestration-log");
  const events: SquadquariumEvent[] = [];

  let files: string[];
  try {
    const dirents = await fs.promises.readdir(logDir, { withFileTypes: true });
    files = dirents.filter((d) => d.isFile()).map((d) => d.name);
  } catch {
    return events;
  }

  for (const file of files) {
    let body = "";
    try {
      body = await fs.promises.readFile(path.join(logDir, file), "utf8");
    } catch {
      continue;
    }

    const ts = parseReplayTimestamp(file);
    const observedAt = ts ? new Date(ts).getTime() : 0;
    if (from !== undefined && observedAt < from) continue;
    if (to !== undefined && observedAt > to) continue;

    const agent = /(?:^|\n)\*{0,2}Agent:\*{0,2}\s*([^\n]+)/i.exec(body)?.[1]?.trim();
    events.push({
      sessionId: "replay",
      source: "log",
      seq: events.length + 1,
      entityKey: `log:${file}`,
      observedAt,
      payload: {
        action: "log_change",
        file,
        path: path.join(logDir, file),
        source: "orchestration-log",
        agent,
        body: body.slice(0, 500),
      },
    });
  }

  events.sort((a, b) => a.observedAt - b.observedAt);
  return events.slice(0, REPLAY_EVENT_CAP);
}

function parseReplayTimestamp(file: string): string | null {
  const m = /(\d{4}-\d{2}-\d{2}(?:[T_]\d{2}[-:]\d{2}(?:[-:]\d{2})?(?:\.\d+)?Z?)?)/.exec(file);
  if (!m) return null;
  const candidate = m[1]
    .replace(/_(\d{2})[-:](\d{2})/, "T$1:$2")
    .replace(/T(\d{2})-(\d{2})-(\d{2})/, "T$1:$2:$3");
  const d = new Date(candidate);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function resolveWebDist(): string {
  // Prod: web-dist/ is staged by the prepack script alongside dist/.
  const prodDir = path.resolve(__dirname, "..", "web-dist");
  if (fs.existsSync(prodDir)) return prodDir;
  // Dev: monorepo layout — packages/cli/dist → packages/web/dist
  return path.resolve(__dirname, "..", "..", "web", "dist");
}

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse): void {
  const distDir = resolveWebDist();
  const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://127.0.0.1").pathname);
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const target = path.resolve(distDir, relativePath);

  const relativeToDist = path.relative(distDir, target);
  if (relativeToDist.startsWith("..") || path.isAbsolute(relativeToDist)) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  fs.readFile(target, (err, content) => {
    if (err) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("Not found");
      return;
    }

    res.writeHead(200, { "content-type": contentType(target) });
    res.end(content);
  });
}

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (origin.startsWith("file://")) return true;

  try {
    const url = new URL(origin);
    return url.hostname === "127.0.0.1" || url.hostname === "localhost";
  } catch {
    return false;
  }
}

function range(start: number, end: number): number[] {
  const values: number[] = [];
  for (let value = start; value <= end; value += 1) values.push(value);
  return values;
}

function contentType(filePath: string): string {
  switch (path.extname(filePath)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

function listen(server: http.Server, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (err: Error) => {
      server.off("listening", onListening);
      reject(err);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });
}

function closeServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!server.listening) {
      resolve();
      return;
    }
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

function closeWss(wss: WebSocketServer): Promise<void> {
  return new Promise((resolve) => wss.close(() => resolve()));
}

function onceClose(ws: WebSocket): Promise<void> {
  return new Promise((resolve) => ws.once("close", () => resolve()));
}
