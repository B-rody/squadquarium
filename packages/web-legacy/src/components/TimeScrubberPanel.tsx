import { useState, useCallback, useEffect, useRef } from "react";
import { useStore } from "../transport/store.js";
import type { LogEntry } from "../transport/protocol.js";

// Graceful degrade: Parker's replay WS frame is not yet present in 0.9.4.
// When it arrives, wire it here. Until then, use snapshot.logTail as the
// scrub timeline. console.warn fires once so dev console shows the status.
let warnedDegrade = false;

function warnDegrade() {
  if (!warnedDegrade) {
    console.warn(
      "[TimeScrubber] Parker's `replay` WS frame is not yet available — " +
        "using snapshot.logTail as timeline substitute. " +
        "Wire to replay frame when Parker ships it.",
    );
    warnedDegrade = true;
  }
}

const panelStyle: React.CSSProperties = {
  position: "absolute",
  left: "50%",
  top: "12%",
  transform: "translateX(-50%)",
  width: "420px",
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

const liveBtnStyle: React.CSSProperties = {
  background: "none",
  border: "1px solid var(--skin-fg, #00bfa5)",
  color: "var(--skin-fg, #00bfa5)",
  fontFamily: "inherit",
  cursor: "pointer",
  padding: "0 6px",
  fontSize: "12px",
};

export default function TimeScrubberPanel({ onClose }: { onClose: () => void }) {
  const { snapshot, setScrubbing } = useStore();
  const logTail: LogEntry[] = snapshot?.logTail ?? [];
  const maxIndex = Math.max(0, logTail.length - 1);

  const [position, setPosition] = useState(maxIndex);
  const [isLive, setIsLive] = useState(true);
  const isLiveRef = useRef(isLive);

  // Keep ref in sync so callbacks don't close over stale value
  useEffect(() => {
    isLiveRef.current = isLive;
  }, [isLive]);

  // When snapshot updates and we're live, snap to end
  useEffect(() => {
    if (isLiveRef.current) {
      setPosition(maxIndex);
    }
  }, [maxIndex]);

  warnDegrade();

  const goLive = useCallback(() => {
    setIsLive(true);
    setPosition(maxIndex);
    setScrubbing(false);
  }, [maxIndex, setScrubbing]);

  const handleSlider = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = Number(e.target.value);
      setPosition(next);
      if (isLiveRef.current) {
        setIsLive(false);
        setScrubbing(true);
      }
    },
    [setScrubbing],
  );

  // Cleanup: resume live ingestion on unmount
  useEffect(() => {
    return () => {
      setScrubbing(false);
    };
  }, [setScrubbing]);

  const currentEntry = logTail[position];
  const timeLabel = currentEntry
    ? `${currentEntry.timestamp} — ${currentEntry.agent ?? "system"}`
    : logTail.length === 0
      ? "no log entries yet"
      : `${position + 1} / ${logTail.length}`;

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <span>[ time scrubber ]</span>
        <button onClick={onClose} style={btnStyle}>
          [×]
        </button>
      </div>
      <div style={{ padding: "8px" }}>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <input
            type="range"
            min={0}
            max={maxIndex}
            value={position}
            onChange={handleSlider}
            style={{ flex: 1 }}
            disabled={logTail.length === 0}
          />
          <button
            onClick={goLive}
            style={isLive ? { ...liveBtnStyle, color: "var(--skin-accent)" } : liveBtnStyle}
            title="Return to live mode"
          >
            {isLive ? "● live" : "[live]"}
          </button>
        </div>
        <div style={{ color: "var(--skin-dim)", fontSize: "11px", marginTop: "4px" }}>
          {timeLabel}
        </div>
        {!isLive && currentEntry && (
          <div
            style={{
              marginTop: "6px",
              borderTop: "1px solid var(--skin-dim, #004d40)",
              paddingTop: "6px",
              fontSize: "12px",
            }}
          >
            <div style={{ color: "var(--skin-accent)" }}>
              {currentEntry.topic ?? currentEntry.source}
            </div>
            <div style={{ color: "var(--skin-dim)", marginTop: "2px" }}>
              {currentEntry.body.slice(0, 120)}
            </div>
          </div>
        )}
        {!isLive && (
          <div style={{ color: "var(--skin-alert)", fontSize: "11px", marginTop: "4px" }}>
            ⏸ live ingestion paused — click [live] to resume
          </div>
        )}
      </div>
    </div>
  );
}
