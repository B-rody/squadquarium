import { useState, useEffect, useCallback, useMemo } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import HabitatPanel from "./HabitatPanel.js";
import LogPanel from "./LogPanel.js";
import InteractiveOverlay from "./InteractiveOverlay.js";
import DrillIn from "./DrillIn.js";
import CommandPalette from "./CommandPalette.js";
import { useStore, useIsSelfPortrait } from "../transport/store.js";
import { useWsClient } from "../transport/wsClient.js";
import type { SkinAssets } from "../skin/loader.js";
import type { AgentSummary } from "../transport/protocol.js";

interface Props {
  skinAssets: SkinAssets;
  availableSkins: string[];
  activeSkin: string;
  setActiveSkin: (name: string) => void;
  crtMode: "off" | "scanlines" | "bloom" | "all";
  setCrtMode: (m: "off" | "scanlines" | "bloom" | "all") => void;
}

export default function AppShell({
  skinAssets,
  availableSkins,
  activeSkin,
  setActiveSkin,
  crtMode,
  setCrtMode,
}: Props) {
  const { connection, snapshot } = useStore();
  const { send, on } = useWsClient();
  const isSelfPortrait = useIsSelfPortrait();

  // Build role→castName map for self-portrait band labels.
  const roleCastMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const agent of snapshot?.agents ?? []) {
      map[agent.role] = agent.name;
    }
    return map;
  }, [snapshot]);

  const [ptyId, setPtyId] = useState<string | null>(null);
  const [interactive, setInteractive] = useState(false);
  const [drillAgent, setDrillAgent] = useState<AgentSummary | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  useEffect(() => {
    return on("pty-spawned", (frame) => {
      setPtyId(frame.ptyId);
      setInteractive(true);
    });
  }, [on]);

  useEffect(() => {
    document.body.dataset.crt = crtMode === "off" ? "" : crtMode;
  }, [crtMode]);

  const openInteractive = useCallback(
    (cmd: string, args: string[], seed?: string) => {
      void seed;
      const cols = 80;
      const rows = 24;
      send({ kind: "pty-spawn", clientSeq: 0, cmd, args, cols, rows });
    },
    [send],
  );

  const exitInteractive = useCallback(() => {
    if (ptyId) send({ kind: "pty-kill", clientSeq: 0, ptyId });
    setPtyId(null);
    setInteractive(false);
  }, [ptyId, send]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (e.key === ":" && !paletteOpen) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [paletteOpen]);

  const handleAgentClick = useCallback(
    (agentName: string) => {
      const agent = snapshot?.agents.find((a) => a.name === agentName);
      if (agent) setDrillAgent(agent);
    },
    [snapshot],
  );

  const isEmptyState = connection.mode === "empty-state";

  const statusColor =
    connection.status === "connected"
      ? "var(--skin-fg, #00bfa5)"
      : connection.status === "lost"
        ? "var(--skin-alert, #ff5252)"
        : "var(--skin-accent, #80cbc4)";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--skin-font-family, monospace)",
        fontSize: "var(--skin-font-size, 14px)",
        color: "var(--skin-fg, #00bfa5)",
        background: "var(--skin-bg, #001f1c)",
        position: "relative",
      }}
    >
      <div
        style={{
          borderBottom: "1px solid var(--skin-dim, #004d40)",
          padding: "2px 8px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flexShrink: 0,
        }}
      >
        <span style={{ color: "var(--skin-accent, #80cbc4)" }}>╔══ squadquarium ══╗</span>
        {isSelfPortrait && (
          <span
            style={{
              color: "var(--skin-alert, #ff5252)",
              border: "1px solid var(--skin-alert, #ff5252)",
              padding: "0 4px",
              fontSize: "11px",
            }}
          >
            [ self-portrait ]
          </span>
        )}
        <span style={{ flex: 1 }} />
        {isEmptyState && (
          <>
            <button
              className="shell-btn"
              onClick={() => openInteractive("squad", [], "add a new agent")}
              style={btnStyle}
            >
              [Hatch]
            </button>
            <button
              className="shell-btn"
              onClick={() => openInteractive("squad", [], "add a new skill")}
              style={btnStyle}
            >
              [Inscribe]
            </button>
            <button
              className="shell-btn"
              onClick={() => openInteractive("squad", [])}
              style={btnStyle}
            >
              [Bootstrap]
            </button>
          </>
        )}
        <button
          className="shell-btn"
          onClick={() =>
            setCrtMode(
              crtMode === "off"
                ? "scanlines"
                : crtMode === "scanlines"
                  ? "bloom"
                  : crtMode === "bloom"
                    ? "all"
                    : "off",
            )
          }
          style={{ ...btnStyle, color: "var(--skin-dim, #004d40)" }}
        >
          [CRT:{crtMode}]
        </button>
      </div>

      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        {drillAgent && (
          <DrillIn
            agent={drillAgent}
            onClose={() => setDrillAgent(null)}
            isSelfPortrait={isSelfPortrait}
            roleCastMap={roleCastMap}
          />
        )}
        <PanelGroup direction="horizontal">
          {!leftCollapsed && (
            <>
              <Panel defaultSize={55} minSize={20}>
                <div style={{ width: "100%", height: "100%", position: "relative" }}>
                  <HabitatPanel skinAssets={skinAssets} onAgentClick={handleAgentClick} />
                  <button
                    onClick={() => setLeftCollapsed(true)}
                    style={{
                      ...btnStyle,
                      position: "absolute",
                      top: 2,
                      right: 2,
                      zIndex: 10,
                    }}
                    title="Collapse habitat"
                  >
                    [◀]
                  </button>
                </div>
              </Panel>
              <PanelResizeHandle
                style={{
                  width: "4px",
                  background: "var(--skin-dim, #004d40)",
                  cursor: "col-resize",
                }}
              />
            </>
          )}
          {!rightCollapsed && (
            <Panel defaultSize={45} minSize={20}>
              <div style={{ width: "100%", height: "100%", position: "relative" }}>
                <LogPanel
                  skinAssets={skinAssets}
                  ptyId={ptyId}
                  onPtyExit={exitInteractive}
                  interactive={interactive}
                />
                <button
                  onClick={() => setRightCollapsed(true)}
                  style={{
                    ...btnStyle,
                    position: "absolute",
                    top: 2,
                    left: 2,
                    zIndex: 10,
                  }}
                  title="Collapse log"
                >
                  [▶]
                </button>
              </div>
            </Panel>
          )}
        </PanelGroup>
        {(leftCollapsed || rightCollapsed) && (
          <div
            style={{
              position: "absolute",
              bottom: 4,
              right: 4,
              display: "flex",
              gap: "4px",
            }}
          >
            {leftCollapsed && (
              <button style={btnStyle} onClick={() => setLeftCollapsed(false)}>
                [habitat▶]
              </button>
            )}
            {rightCollapsed && (
              <button style={btnStyle} onClick={() => setRightCollapsed(false)}>
                [◀log]
              </button>
            )}
          </div>
        )}
      </div>

      <div
        style={{
          borderTop: "1px solid var(--skin-dim, #004d40)",
          padding: "2px 8px",
          display: "flex",
          gap: "12px",
          alignItems: "center",
          flexShrink: 0,
          fontSize: "12px",
        }}
      >
        <span style={{ color: statusColor }}>● {connection.status}</span>
        {connection.squadRoot && (
          <span style={{ color: "var(--skin-dim, #004d40)" }}>{connection.squadRoot}</span>
        )}
        <span style={{ flex: 1 }} />
        <select
          value={activeSkin}
          onChange={(e) => setActiveSkin(e.target.value)}
          style={{
            background: "var(--skin-bg, #001f1c)",
            color: "var(--skin-dim, #004d40)",
            border: "1px solid var(--skin-dim, #004d40)",
            fontFamily: "inherit",
            fontSize: "inherit",
          }}
        >
          {availableSkins.map((s) => (
            <option key={s} value={s}>
              skin:{s}
            </option>
          ))}
        </select>
        {interactive && <span style={{ color: "var(--skin-alert, #ff5252)" }}>ESC=exit</span>}
        <span style={{ color: "var(--skin-dim, #004d40)" }}>: = cmd</span>
      </div>

      <InteractiveOverlay ptyId={ptyId} onExit={exitInteractive} />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSkinChange={setActiveSkin}
        onInteractive={openInteractive}
      />
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--skin-fg, #00bfa5)",
  fontFamily: "var(--skin-font-family, monospace)",
  fontSize: "inherit",
  cursor: "pointer",
  padding: "0 2px",
};
