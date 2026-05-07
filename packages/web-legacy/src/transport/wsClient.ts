import { useEffect, useRef, useState, useCallback } from "react";
import type { ClientFrame, ServerFrame } from "./protocol.js";

export type WsStatus = "connecting" | "connected" | "reconnecting" | "lost";

type FrameHandler<K extends ServerFrame["kind"]> = (
  frame: Extract<ServerFrame, { kind: K }>,
) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = (frame: any) => void;

interface WsClient {
  status: WsStatus;
  send: (frame: ClientFrame) => void;
  on: <K extends ServerFrame["kind"]>(kind: K, handler: FrameHandler<K>) => () => void;
}

const RECONNECT_INITIAL_MS = 200;
const RECONNECT_CAP_MS = 5000;
const RECONNECT_MAX_ATTEMPTS = 10;

class WsClientCore {
  private ws: WebSocket | null = null;
  private clientSeq = 0;
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  private statusListeners = new Set<(s: WsStatus) => void>();
  private frameHandlers = new Map<string, Set<AnyHandler>>();

  public status: WsStatus = "connecting";

  constructor(private readonly url: string) {
    this.connect();
  }

  private setStatus(s: WsStatus) {
    this.status = s;
    for (const fn of this.statusListeners) fn(s);
  }

  private connect() {
    if (this.destroyed) return;
    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.attempt = 0;
      this.setStatus("connected");
    };

    this.ws.onmessage = (ev: MessageEvent) => {
      let frame: ServerFrame;
      try {
        frame = JSON.parse(ev.data as string) as ServerFrame;
      } catch {
        return;
      }
      const handlers = this.frameHandlers.get(frame.kind);
      if (handlers) {
        for (const h of handlers) h(frame);
      }
    };

    this.ws.onclose = () => {
      if (!this.destroyed) this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private scheduleReconnect() {
    if (this.destroyed) return;
    if (this.attempt >= RECONNECT_MAX_ATTEMPTS - 1) {
      this.setStatus("lost");
      return;
    }
    this.setStatus(this.attempt === 0 ? "connecting" : "reconnecting");
    const delay = Math.min(RECONNECT_INITIAL_MS * Math.pow(2, this.attempt), RECONNECT_CAP_MS);
    this.attempt++;
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  send(frame: ClientFrame) {
    const payload: ClientFrame = { ...frame, clientSeq: ++this.clientSeq };
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  on<K extends ServerFrame["kind"]>(kind: K, handler: FrameHandler<K>): () => void {
    if (!this.frameHandlers.has(kind)) {
      this.frameHandlers.set(kind, new Set());
    }
    this.frameHandlers.get(kind)!.add(handler as AnyHandler);
    return () => {
      this.frameHandlers.get(kind)?.delete(handler as AnyHandler);
    };
  }

  onStatus(fn: (s: WsStatus) => void): () => void {
    this.statusListeners.add(fn);
    return () => {
      this.statusListeners.delete(fn);
    };
  }

  destroy() {
    this.destroyed = true;
    if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }
}

let singleton: WsClientCore | null = null;

function getWsUrl(): string {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/ws`;
}

function getSingleton(): WsClientCore {
  if (!singleton) {
    singleton = new WsClientCore(getWsUrl());
  }
  return singleton;
}

export function useWsClient(): WsClient {
  const coreRef = useRef<WsClientCore | null>(null);
  if (coreRef.current === null) coreRef.current = getSingleton();
  const core = coreRef.current;
  const [status, setStatus] = useState<WsStatus>(core.status);

  useEffect(() => {
    return core.onStatus(setStatus);
  }, [core]);

  const send = useCallback((frame: ClientFrame) => core.send(frame), [core]);

  const on = useCallback(
    <K extends ServerFrame["kind"]>(kind: K, handler: FrameHandler<K>) => core.on(kind, handler),
    [core],
  );

  return { status, send, on };
}

// Exported for tests
export { WsClientCore };
