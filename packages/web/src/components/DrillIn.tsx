import type { AgentSummary } from "../transport/protocol.js";

interface Props {
  agent: AgentSummary | null;
  onClose: () => void;
  isSelfPortrait?: boolean;
  roleCastMap?: Record<string, string>;
}

export default function DrillIn({ agent, onClose, isSelfPortrait, roleCastMap }: Props) {
  if (!agent) return null;

  // In self-portrait mode, augment the displayed role with the cast name.
  const castName = roleCastMap?.[agent.role];
  const displayRole = isSelfPortrait && castName ? `${agent.role} — ${castName}` : agent.role;

  return (
    <div
      style={{
        position: "absolute",
        right: 0,
        top: 0,
        bottom: 0,
        width: "300px",
        background: "var(--skin-bg, #001f1c)",
        borderLeft: "1px solid var(--skin-fg, #00bfa5)",
        padding: "8px",
        fontFamily: "var(--skin-font-family, monospace)",
        fontSize: "var(--skin-font-size, 14px)",
        color: "var(--skin-fg, #00bfa5)",
        zIndex: 100,
        overflowY: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "8px",
          borderBottom: "1px solid var(--skin-dim, #004d40)",
          paddingBottom: "4px",
        }}
      >
        <span style={{ color: "var(--skin-accent, #80cbc4)" }}>{agent.name}</span>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "var(--skin-dim, #004d40)",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: "inherit",
          }}
        >
          [x]
        </button>
      </div>
      <div style={{ marginBottom: "4px" }}>
        <span style={{ color: "var(--skin-dim, #004d40)" }}>role: </span>
        {displayRole}
      </div>
      <div style={{ marginBottom: "4px" }}>
        <span style={{ color: "var(--skin-dim, #004d40)" }}>status: </span>
        <span
          style={{
            color:
              agent.status === "blocked"
                ? "var(--skin-alert, #ff5252)"
                : agent.status === "working"
                  ? "var(--skin-accent, #80cbc4)"
                  : "var(--skin-fg, #00bfa5)",
          }}
        >
          {agent.status}
        </span>
      </div>
      {isSelfPortrait && agent.charterVoice && (
        <div
          style={{
            marginTop: "12px",
            borderTop: "1px solid var(--skin-dim, #004d40)",
            paddingTop: "8px",
          }}
        >
          <div style={{ color: "var(--skin-dim, #004d40)", fontSize: "11px", marginBottom: "4px" }}>
            about this agent
          </div>
          <div
            style={{
              color: "var(--skin-accent, #80cbc4)",
              fontStyle: "italic",
              fontSize: "12px",
              lineHeight: "1.4",
            }}
          >
            {agent.charterVoice}
          </div>
        </div>
      )}
      <div style={{ marginTop: "8px", color: "var(--skin-dim, #004d40)", fontSize: "12px" }}>
        charter: {agent.charterPath}
      </div>
    </div>
  );
}
