import { useState, useEffect, useCallback } from "react";
import { useStore } from "../transport/store.js";
import {
  deriveGameState,
  startIdleAccrualTicker,
  buildStandupEntries,
  type GameState,
  type StandupEntry,
  INVENTORY_ITEMS,
} from "../game/store.js";

interface Props {
  ralphActive: boolean;
  onClose: () => void;
}

export default function GamePanel({ ralphActive, onClose }: Props) {
  const { snapshot, events, connection } = useStore();
  const hasRemote = Boolean(connection.squadRoot);

  const [gameState, setGameState] = useState<GameState>(() =>
    deriveGameState({
      events: [],
      decisions: snapshot?.decisions ?? [],
      ralphActive,
      hasRemote,
    }),
  );
  const [ideasCounter, setIdeasCounter] = useState(0);
  const [showStandup, setShowStandup] = useState(false);
  const [standupEntries, setStandupEntries] = useState<StandupEntry[]>([]);

  // Re-derive game state when events or decisions change
  useEffect(() => {
    const next = deriveGameState({
      events,
      decisions: snapshot?.decisions ?? [],
      ralphActive,
      hasRemote,
    });
    setGameState(next);
    setIdeasCounter(next.ideas);
  }, [events, snapshot, ralphActive, hasRemote]);

  // Idle accrual ticker (cosmetic only)
  useEffect(() => {
    return startIdleAccrualTicker(
      () => ralphActive,
      () => setIdeasCounter((n) => n + 1),
    );
  }, [ralphActive]);

  const openStandup = useCallback(() => {
    setStandupEntries(buildStandupEntries(events));
    setShowStandup(true);
  }, [events]);

  const skills = snapshot?.agents.map((a) => a.name) ?? [];
  const levelUnlock = (name: string, minLevel: number) =>
    gameState.level >= minLevel ? name : `${name} [lvl ${minLevel}+]`;

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <span>[ game mode — cosmetics only ]</span>
        <button onClick={onClose} style={btnStyle}>
          [×]
        </button>
      </div>

      <div
        style={{
          padding: "8px",
          display: "grid",
          gap: "10px",
          overflowY: "auto",
          maxHeight: "70vh",
        }}
      >
        {/* XP / Level */}
        <section>
          <div style={sectionLabel}>xp / level</div>
          <div>
            xp: {gameState.xp} · level: {gameState.level}
          </div>
          <div style={barTrackStyle}>
            <div style={{ ...barFillStyle, width: `${Math.min(gameState.xp % 100, 100)}%` }} />
          </div>
        </section>

        {/* Skill tree */}
        <section>
          <div style={sectionLabel}>skill tree</div>
          {skills.length === 0 ? (
            <div style={dimStyle}>no agents hatched yet</div>
          ) : (
            <div style={{ display: "grid", gap: "2px" }}>
              {skills.map((name, i) => (
                <div key={name} style={chipStyle}>
                  {levelUnlock(name, i)}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Achievements */}
        <section>
          <div style={sectionLabel}>achievements</div>
          {gameState.achievements.length === 0 ? (
            <div style={dimStyle}>no milestones logged yet</div>
          ) : (
            gameState.achievements.slice(0, 5).map((a, i) => (
              <div key={i} style={dimStyle}>
                ★ {a}
              </div>
            ))
          )}
        </section>

        {/* Currency */}
        <section>
          <div style={sectionLabel}>
            ideas{" "}
            {ralphActive && (
              <span style={{ color: "var(--skin-accent)" }}>(+1/min while ralph=watch)</span>
            )}
          </div>
          <div>◈ {ideasCounter} ideas</div>
        </section>

        {/* Inventory */}
        <section>
          <div style={sectionLabel}>inventory (cosmetic loot)</div>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {INVENTORY_ITEMS.map((item) => (
              <span
                key={item}
                style={{
                  ...chipStyle,
                  opacity: gameState.inventory.includes(item) ? 1 : 0.35,
                }}
              >
                [{item}]
              </span>
            ))}
          </div>
        </section>

        {/* Daily quest */}
        {gameState.dailyQuestCount !== null && (
          <section>
            <div style={sectionLabel}>daily quest</div>
            <div>issues triaged today: {gameState.dailyQuestCount}</div>
          </section>
        )}

        {/* Boss fight */}
        {gameState.bossActive && (
          <section style={{ border: "1px solid var(--skin-alert)", padding: "4px 6px" }}>
            <div style={{ color: "var(--skin-alert)" }}>⚔ boss fight — PR approved + CI green</div>
          </section>
        )}

        {/* Stand-up button */}
        <button onClick={openStandup} style={{ ...btnStyle, textAlign: "left" }}>
          [:standup — run summary panel]
        </button>
      </div>

      {/* Stand-up cartoon modal */}
      {showStandup && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            zIndex: 3000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setShowStandup(false)}
        >
          <div style={{ ...panelStyle, width: "400px", maxHeight: "60vh", overflow: "auto" }}>
            <div style={headerStyle}>
              <span>[ stand-up · last 24 h ]</span>
              <button onClick={() => setShowStandup(false)} style={btnStyle}>
                [×]
              </button>
            </div>
            <div style={{ padding: "8px", display: "grid", gap: "8px" }}>
              {standupEntries.length === 0 ? (
                <div style={dimStyle}>no events in last 24 h</div>
              ) : (
                standupEntries.map((entry, i) => (
                  <div
                    key={i}
                    style={{ borderLeft: "2px solid var(--skin-dim)", paddingLeft: "6px" }}
                  >
                    <div>{entry.agentName}</div>
                    <div style={dimStyle}>{entry.summary}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  position: "absolute",
  left: "50%",
  top: "8%",
  transform: "translateX(-50%)",
  width: "400px",
  background: "var(--skin-bg, #001f1c)",
  border: "1px solid var(--skin-fg, #00bfa5)",
  color: "var(--skin-fg, #00bfa5)",
  fontFamily: "var(--skin-font-family, monospace)",
  fontSize: "var(--skin-font-size, 14px)",
  zIndex: 600,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  borderBottom: "1px solid var(--skin-dim, #004d40)",
  padding: "4px 8px",
};

const btnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--skin-fg, #00bfa5)",
  fontFamily: "inherit",
  cursor: "pointer",
  padding: 0,
};

const sectionLabel: React.CSSProperties = {
  color: "var(--skin-accent, #80cbc4)",
  fontSize: "11px",
  marginBottom: "3px",
};

const dimStyle: React.CSSProperties = {
  color: "var(--skin-dim, #004d40)",
  fontSize: "12px",
};

const chipStyle: React.CSSProperties = {
  border: "1px solid var(--skin-dim, #004d40)",
  color: "var(--skin-accent, #80cbc4)",
  padding: "1px 4px",
  fontSize: "12px",
};

const barTrackStyle: React.CSSProperties = {
  height: "4px",
  background: "var(--skin-dim, #004d40)",
  marginTop: "4px",
};

const barFillStyle: React.CSSProperties = {
  height: "100%",
  background: "var(--skin-accent, #80cbc4)",
  transition: "width 0.3s ease",
};
