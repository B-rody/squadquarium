import fs from "node:fs";
import path from "node:path";
import { WebSocket } from "ws";
import type { ServerFrame } from "@squadquarium/core";

export interface HeadlessSmokeResult {
  ok: true;
  durationMs: number;
}

export async function runHeadlessSmoke(opts: {
  url: string;
  squadRoot: string | null;
  timeoutMs?: number;
}): Promise<HeadlessSmokeResult> {
  const started = Date.now();
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const wsUrl = opts.url.replace(/^http:/, "ws:").replace(/^https:/, "wss:") + "/ws";
  const seen = { hello: false, snapshot: false, event: false, pong: false };
  const smokeFile = opts.squadRoot
    ? path.join(opts.squadRoot, "decisions", "inbox", `squadquarium-smoke-${Date.now()}.md`)
    : null;

  const ws = new WebSocket(wsUrl);
  ws.on("message", (data) => {
    try {
      const frame = JSON.parse(data.toString()) as ServerFrame;
      if (frame.kind === "hello") seen.hello = true;
      if (frame.kind === "snapshot") seen.snapshot = true;
      if (frame.kind === "pong") seen.pong = true;
      if (
        frame.kind === "event" &&
        smokeFile &&
        JSON.stringify(frame.event.payload).includes(path.basename(smokeFile))
      ) {
        seen.event = true;
      }
    } catch {
      // Ignore non-JSON smoke noise.
    }
  });
  await waitForOpen(ws, timeoutMs);

  try {
    await waitFor(() => seen.hello, timeoutMs, "hello frame");
    if (opts.squadRoot) {
      await waitFor(() => seen.snapshot, timeoutMs, "snapshot frame");
      fs.mkdirSync(path.dirname(smokeFile!), { recursive: true });
      fs.writeFileSync(smokeFile!, `# Squadquarium smoke\n\n${new Date().toISOString()}\n`, "utf8");
      await waitFor(() => seen.event, timeoutMs, "filesystem event");
    }

    ws.send(JSON.stringify({ kind: "ping", clientSeq: 1 }));
    await waitFor(() => seen.pong, timeoutMs, "pong frame");

    return { ok: true, durationMs: Date.now() - started };
  } finally {
    if (smokeFile) {
      try {
        fs.unlinkSync(smokeFile);
      } catch {
        // Already removed.
      }
    }
    ws.close();
  }
}

function waitForOpen(ws: WebSocket, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error(`Timed out connecting to ${ws.url}`));
    }, timeoutMs);

    ws.once("open", () => {
      clearTimeout(timeout);
      resolve();
    });
    ws.once("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function waitFor(predicate: () => boolean, timeoutMs: number, label: string): Promise<void> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      if (predicate()) {
        resolve();
        return;
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`Timed out waiting for ${label}`));
        return;
      }
      setTimeout(check, 50);
    };
    check();
  });
}
