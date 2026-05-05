import { useState, useEffect, useRef, useCallback } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  onSkinChange: (name: string) => void;
  onInteractive: (cmd: string, args: string[], seed?: string) => void;
}

export default function CommandPalette({ open, onClose, onSkinChange, onInteractive }: Props) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setInput(":");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const execute = useCallback(
    (cmd: string) => {
      const trimmed = cmd.replace(/^:/, "").trim();
      const parts = trimmed.split(/\s+/);
      const verb = parts[0];

      switch (verb) {
        case "skin":
          if (parts[1]) onSkinChange(parts[1]);
          break;
        case "hatch":
          onInteractive("squad", [], "add a new agent");
          break;
        case "inscribe":
          onInteractive("squad", [], "add a new skill");
          break;
        case "quit":
          window.close();
          break;
        default:
          console.warn(`[commandpalette] unknown command: ${verb}`);
      }
      onClose();
    },
    [onSkinChange, onInteractive, onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") execute(input);
      if (e.key === "Escape") onClose();
    },
    [input, execute, onClose],
  );

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "20vh",
        backgroundColor: "rgba(0,0,0,0.6)",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "var(--skin-bg, #001f1c)",
          border: "1px solid var(--skin-fg, #00bfa5)",
          padding: "8px",
          minWidth: "320px",
          fontFamily: "var(--skin-font-family, monospace)",
          fontSize: "var(--skin-font-size, 14px)",
        }}
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            width: "100%",
            background: "transparent",
            color: "var(--skin-fg, #00bfa5)",
            border: "none",
            outline: "none",
            fontFamily: "inherit",
            fontSize: "inherit",
          }}
          placeholder=":skin aquarium | :hatch | :inscribe | :quit"
        />
        <div
          style={{
            marginTop: "4px",
            color: "var(--skin-dim, #004d40)",
            fontSize: "12px",
          }}
        >
          :skin &lt;name&gt; · :hatch · :inscribe · :quit
        </div>
      </div>
    </div>
  );
}
