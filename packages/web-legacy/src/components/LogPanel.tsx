import { useEffect, useRef } from "react";
import type { Terminal } from "@xterm/xterm";
import { useStore } from "../transport/store.js";
import { useWsClient } from "../transport/wsClient.js";
import type { SkinAssets } from "../skin/loader.js";
import type { LogEntry } from "../transport/protocol.js";
import "@xterm/xterm/css/xterm.css";

interface Props {
  skinAssets: SkinAssets;
  ptyId: string | null;
  onPtyExit: () => void;
  interactive: boolean;
}

const LOG_SOURCE_COLORS: Record<LogEntry["source"], string> = {
  "orchestration-log": "\x1b[36m",
  log: "\x1b[32m",
};

function formatLogLine(entry: LogEntry): string {
  const color = LOG_SOURCE_COLORS[entry.source] ?? "\x1b[0m";
  const reset = "\x1b[0m";
  const ts = entry.timestamp ? `\x1b[2m${entry.timestamp.slice(11, 19)}\x1b[0m ` : "";
  const agent = entry.agent ? `\x1b[33m[${entry.agent}]\x1b[0m ` : "";
  return `${ts}${agent}${color}${entry.body}${reset}\r\n`;
}

export default function LogPanel({ skinAssets, ptyId, onPtyExit, interactive }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<import("@xterm/addon-fit").FitAddon | null>(null);
  const writtenLinesRef = useRef(0);
  const { logLines } = useStore();
  const { send, on } = useWsClient();
  const palette = skinAssets.manifest.palette;

  useEffect(() => {
    let term: Terminal | null = null;
    let disposed = false;

    const init = async () => {
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");

      if (disposed) return;

      term = new Terminal({
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 14,
        theme: {
          background: palette.bg ?? "#001f1c",
          foreground: palette.fg ?? "#00bfa5",
          cursor: palette.accent ?? "#80cbc4",
        },
        cursorBlink: false,
        disableStdin: true,
        allowProposedApi: false,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      if (containerRef.current) {
        term.open(containerRef.current);
        fitAddon.fit();
      }

      termRef.current = term;
      fitAddonRef.current = fitAddon;

      writtenLinesRef.current = 0;
      for (const line of logLines) {
        term.write(formatLogLine(line));
        writtenLinesRef.current++;
      }
    };

    void init();

    const ro = new ResizeObserver(() => fitAddonRef.current?.fit());
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      disposed = true;
      ro.disconnect();
      term?.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [palette.bg, palette.fg, palette.accent]);

  useEffect(() => {
    const term = termRef.current;
    if (!term || interactive) return;
    for (const line of logLines.slice(writtenLinesRef.current)) {
      term.write(formatLogLine(line));
    }
    writtenLinesRef.current = logLines.length;
  }, [logLines, interactive]);

  useEffect(() => {
    if (!interactive || !ptyId) return;
    const term = termRef.current;
    if (!term) return;

    term.options.disableStdin = false;
    term.clear();

    const offPtyOut = on("pty-out", (frame) => {
      if (frame.ptyId === ptyId) term.write(frame.data);
    });

    const offPtyExit = on("pty-exit", (frame) => {
      if (frame.ptyId === ptyId) {
        term.write(`\r\n\x1b[2m[PTY exited with code ${frame.code}]\x1b[0m\r\n`);
        onPtyExit();
      }
    });

    const onData = term.onData((data) => {
      send({ kind: "pty-write", clientSeq: 0, ptyId, data });
    });

    return () => {
      offPtyOut();
      offPtyExit();
      onData.dispose();
      term.options.disableStdin = true;
    };
  }, [interactive, ptyId, on, send, onPtyExit]);

  useEffect(() => {
    if (!interactive) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (ptyId) send({ kind: "pty-kill", clientSeq: 0, ptyId });
        onPtyExit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [interactive, ptyId, send, onPtyExit]);

  return (
    <div
      ref={containerRef}
      className="log-panel"
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        backgroundColor: "var(--skin-bg, #001f1c)",
      }}
    />
  );
}
