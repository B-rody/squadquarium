import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  sent: string[] = [];

  constructor(public url: string) {}

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  triggerOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  triggerMessage(data: string) {
    this.onmessage?.({ data });
  }
}

describe("WsClientCore reconnect logic", () => {
  let originalWebSocket: typeof WebSocket;
  let constructedSockets: MockWebSocket[];

  beforeEach(() => {
    vi.resetModules();
    originalWebSocket = global.WebSocket;
    constructedSockets = [];
    global.WebSocket = class extends MockWebSocket {
      constructor(url: string | URL) {
        super(String(url));
        constructedSockets.push(this);
      }
    } as unknown as typeof WebSocket;
    vi.useFakeTimers();
  });

  afterEach(() => {
    global.WebSocket = originalWebSocket;
    vi.useRealTimers();
  });

  it("connects immediately on construction", async () => {
    const { WsClientCore } = await import("../../src/transport/wsClient.js");
    const client = new WsClientCore("ws://localhost/ws");
    expect(constructedSockets.length).toBe(1);
    client.destroy();
  });

  it("reconnects after close with exponential backoff", async () => {
    const { WsClientCore } = await import("../../src/transport/wsClient.js");
    const client = new WsClientCore("ws://localhost/ws");

    constructedSockets[0].close();
    expect(client.status).toBe("connecting");

    vi.advanceTimersByTime(200);
    expect(constructedSockets.length).toBe(2);

    client.destroy();
  });

  it("marks status as 'lost' after max attempts", async () => {
    const { WsClientCore } = await import("../../src/transport/wsClient.js");
    const client = new WsClientCore("ws://localhost/ws");

    for (let i = 0; i < 10; i++) {
      const sock = constructedSockets[constructedSockets.length - 1];
      sock.close();
      vi.advanceTimersByTime(5001);
    }
    expect(client.status).toBe("lost");
    client.destroy();
  });

  it("calls registered frame handler on message", async () => {
    const { WsClientCore } = await import("../../src/transport/wsClient.js");
    const client = new WsClientCore("ws://localhost/ws");
    const sock = constructedSockets[0];
    sock.triggerOpen();

    const handler = vi.fn();
    client.on("hello", handler);

    const frame = {
      kind: "hello",
      serverSeq: 0,
      squadquariumVersion: "0.1.0",
      squadVersion: null,
      squadRoot: null,
      mode: "empty-state",
    };
    sock.triggerMessage(JSON.stringify(frame));

    expect(handler).toHaveBeenCalledWith(frame);
    client.destroy();
  });
});
