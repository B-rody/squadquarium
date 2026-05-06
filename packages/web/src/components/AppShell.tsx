import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import HabitatPanel from "./HabitatPanel.js";
import LogPanel from "./LogPanel.js";
import InteractiveOverlay from "./InteractiveOverlay.js";
import DrillIn from "./DrillIn.js";
import CommandPalette from "./CommandPalette.js";
import TimeScrubberPanel from "./TimeScrubberPanel.js";
import WisdomWing, { type SkillChip } from "./WisdomWing.js";
import SettingsPanel from "./SettingsPanel.js";
import { useStore, useIsSelfPortrait } from "../transport/store.js";
import { useWsClient } from "../transport/wsClient.js";
import { loadSettings, saveSettings, type AppSettings } from "../settings/store.js";
import type { SkinAssets } from "../skin/loader.js";
import type { AgentSummary } from "../transport/protocol.js";

type CrtMode = "off" | "scanlines" | "bloom" | "all";

interface Props {
  skinAssets: SkinAssets;
  availableSkins: string[];
  activeSkin: string;
  setActiveSkin: (name: string) => void;
  crtMode: CrtMode;
  setCrtMode: (m: CrtMode) => void;
}

const WISDOM_PLACEHOLDER = `# Team Wisdom

**Pattern:** Keep canvas animation and CSS camera motion in separate layers. **Context:** Canvas2D glyph renderers with band-local overlays and viewport panning.

**Pattern:** Parse command palette verbs as data before dispatching effects. **Context:** Vim-style UI commands that need unit tests without a full browser harness.
`;

function settingsToCrtMode(settings: AppSettings): CrtMode {
  if (settings.crtBloom && settings.crtScanlines) return "all";
  if (settings.crtBloom) return "bloom";
  if (settings.crtScanlines) return "scanlines";
  return "off";
}

function crtModeToSettings(settings: AppSettings, mode: CrtMode): AppSettings {
  return {
    ...settings,
    crtBloom: mode === "bloom" || mode === "all",
    crtScanlines: mode === "scanlines" || mode === "all",
  };
}

function nextCrtMode(mode: CrtMode): CrtMode {
  return mode === "off"
    ? "scanlines"
    : mode === "scanlines"
      ? "bloom"
      : mode === "bloom"
        ? "all"
        : "off";
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
  const pendingRalphWatchRef = useRef(false);

  // Build role→castName map for self-portrait band labels.
  const roleCastMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const agent of snapshot?.agents ?? []) {
      map[agent.role] = agent.name;
    }
    return map;
  }, [snapshot]);

  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [ptyId, setPtyId] = useState<string | null>(null);
  const [interactive, setInteractive] = useState(false);
  const [drillAgent, setDrillAgent] = useState<AgentSummary | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [scrubberOpen, setScrubberOpen] = useState(false);
  const [wisdomOpen, setWisdomOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ralphActive, setRalphActive] = useState(false);

  useEffect(() => {
    const initialMode = settingsToCrtMode(settings);
    setCrtMode(initialMode);
  }, []);

  useEffect(() => {
    return on("pty-spawned", (frame) => {
      setPtyId(frame.ptyId);
      setInteractive(true);
      if (pendingRalphWatchRef.current) {
        setRalphActive(true);
        pendingRalphWatchRef.current = false;
      }
    });
  }, [on]);

  useEffect(() => {
    document.body.dataset.crt = crtMode === "off" ? "" : crtMode;
  }, [crtMode]);

  const applySettings = useCallback(
    (next: AppSettings) => {
      setSettings(next);
      saveSettings(next);
      setCrtMode(settingsToCrtMode(next));
    },
    [setCrtMode],
  );

  const cycleCrt = useCallback(() => {
    const nextMode = nextCrtMode(crtMode);
    const nextSettings = crtModeToSettings(settings, nextMode);
    setSettings(nextSettings);
    saveSettings(nextSettings);
    setCrtMode(nextMode);
  }, [crtMode, settings, setCrtMode]);

  const openInteractive = useCallback(
    (cmd: string, args: string[], seed?: string) => {
      void seed;
      const cols = 80;
      const rows = 24;
      if (cmd === "squad" && args[0] === "watch") {
        pendingRalphWatchRef.current = true;
        setRalphActive(true);
      }
      send({ kind: "pty-spawn", clientSeq: 0, cmd, args, cols, rows });
    },
    [send],
  );

  const exitInteractive = useCallback(() => {
    if (ptyId) send({ kind: "pty-kill", clientSeq: 0, ptyId });
    setPtyId(null);
    setInteractive(false);
  }, [ptyId, send]);

  const stopRalph = useCallback(() => {
    setRalphActive(false);
    pendingRalphWatchRef.current = false;
    if (ptyId) {
      send({ kind: "pty-kill", clientSeq: 0, ptyId });
      setPtyId(null);
      setInteractive(false);
    }
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

  const skillChips: SkillChip[] = useMemo(
    () => [
      { name: "frontend-polish", confidence: "medium" },
      { name: "skin-metrics", confidence: "high" },
    ],
    [],
  );

  const agentNames = useMemo(() => (snapshot?.agents ?? []).map((agent) => agent.name), [snapshot]);
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
        <button className="shell-btn" onClick={() => setSettingsOpen(true)} style={btnStyle}>
          [⚙]
        </button>
        <button
          className="shell-btn"
          onClick={cycleCrt}
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
        {scrubberOpen && <TimeScrubberPanel onClose={() => setScrubberOpen(false)} />}
        {wisdomOpen && (
          <WisdomWing
            markdown={WISDOM_PLACEHOLDER}
            skills={skillChips}
            onClose={() => setWisdomOpen(false)}
          />
        )}
        {settingsOpen && (
          <SettingsPanel
            settings={settings}
            onChange={applySettings}
            onClose={() => setSettingsOpen(false)}
          />
        )}
        <PanelGroup direction="horizontal">
          {!leftCollapsed && (
            <>
              <Panel defaultSize={55} minSize={20}>
                <div style={{ width: "100%", height: "100%", position: "relative" }}>
                  <HabitatPanel
                    skinAssets={skinAssets}
                    onAgentClick={handleAgentClick}
                    voiceBubbles={settings.voiceBubbles}
                    moodGlyphs={settings.moodGlyphs}
                    ralphActive={ralphActive}
                  />
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
        {ralphActive && <span style={{ color: "var(--skin-accent, #80cbc4)" }}>ralph=watch</span>}
        {interactive && <span style={{ color: "var(--skin-alert, #ff5252)" }}>ESC=exit</span>}
        <span style={{ color: "var(--skin-dim, #004d40)" }}>: = cmd</span>
      </div>

      <InteractiveOverlay ptyId={ptyId} onExit={exitInteractive} />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSkinChange={setActiveSkin}
        onInteractive={openInteractive}
        onOpenScrubber={() => setScrubberOpen(true)}
        onOpenWisdom={() => setWisdomOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onRalphStop={stopRalph}
        availableSkins={availableSkins}
        agentNames={agentNames}
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
