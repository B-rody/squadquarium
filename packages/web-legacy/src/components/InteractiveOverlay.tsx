interface Props {
  ptyId: string | null;
  onExit: () => void;
}

export default function InteractiveOverlay({ ptyId, onExit }: Props) {
  if (!ptyId) return null;
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        backgroundColor: "var(--skin-bg, #001f1c)",
        color: "var(--skin-alert, #ff5252)",
        fontFamily: "var(--skin-font-family, monospace)",
        fontSize: "var(--skin-font-size, 14px)",
        padding: "4px 8px",
        borderBottom: "1px solid var(--skin-dim, #004d40)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <span>PTY active — ESC to exit</span>
      <button
        onClick={onExit}
        style={{
          background: "none",
          border: "1px solid currentColor",
          color: "inherit",
          fontFamily: "inherit",
          fontSize: "inherit",
          padding: "0 4px",
          cursor: "pointer",
        }}
      >
        [ESC]
      </button>
    </div>
  );
}
