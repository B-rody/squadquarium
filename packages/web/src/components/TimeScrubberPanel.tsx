import { useState } from "react";

const panelStyle: React.CSSProperties = {
  position: "absolute",
  left: "50%",
  top: "12%",
  transform: "translateX(-50%)",
  width: "360px",
  background: "var(--skin-bg, #001f1c)",
  border: "1px solid var(--skin-fg, #00bfa5)",
  color: "var(--skin-fg, #00bfa5)",
  fontFamily: "var(--skin-font-family, monospace)",
  fontSize: "var(--skin-font-size, 14px)",
  zIndex: 400,
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
  color: "var(--skin-dim, #004d40)",
  fontFamily: "inherit",
  cursor: "pointer",
};

// Stub implementation — slider UI ships, replay logic deferred (see lambert-scrubber.md)
export default function TimeScrubberPanel({ onClose }: { onClose: () => void }) {
  const [position, setPosition] = useState(0);

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <span>[ time scrubber ]</span>
        <button onClick={onClose} style={btnStyle}>
          [×]
        </button>
      </div>
      <div style={{ padding: "8px" }}>
        <input
          type="range"
          min={0}
          max={100}
          value={position}
          onChange={(e) => setPosition(Number(e.target.value))}
          style={{ width: "100%" }}
        />
        <div style={{ color: "var(--skin-dim)", fontSize: "11px", marginTop: "4px" }}>
          {position}% — TODO: hook to reconciler replay
        </div>
      </div>
    </div>
  );
}
