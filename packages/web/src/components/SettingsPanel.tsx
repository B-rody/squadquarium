import type { AppSettings } from "../settings/store.js";
import { saveSettings } from "../settings/store.js";

interface Props {
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
  onClose: () => void;
}

const labels: Array<[keyof AppSettings, string]> = [
  ["ambientSfx", "Ambient SFX"],
  ["alwaysOnTop", "Always on top"],
  ["crtBloom", "CRT Bloom"],
  ["crtScanlines", "CRT Scanlines"],
  ["voiceBubbles", "Voice Bubbles"],
  ["moodGlyphs", "Mood Glyphs"],
];

export default function SettingsPanel({ settings, onChange, onClose }: Props) {
  const update = (key: keyof AppSettings) => {
    const next = { ...settings, [key]: !settings[key] };
    saveSettings(next);
    onChange(next);
  };

  return (
    <div
      style={{
        position: "absolute",
        right: "24px",
        top: "48px",
        width: "280px",
        background: "var(--skin-bg, #001f1c)",
        border: "1px solid var(--skin-fg, #00bfa5)",
        color: "var(--skin-fg, #00bfa5)",
        fontFamily: "var(--skin-font-family, monospace)",
        fontSize: "var(--skin-font-size, 14px)",
        zIndex: 450,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "4px 8px",
          borderBottom: "1px solid var(--skin-dim, #004d40)",
        }}
      >
        <span>[ settings ]</span>
        <button onClick={onClose} style={buttonStyle}>
          [×]
        </button>
      </div>
      <div style={{ padding: "8px", display: "grid", gap: "6px" }}>
        {labels.map(([key, label]) => (
          <label
            key={key}
            style={{ display: "flex", justifyContent: "space-between", cursor: "pointer" }}
          >
            <span>{label}</span>
            <input type="checkbox" checked={settings[key]} onChange={() => update(key)} />
          </label>
        ))}
      </div>
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--skin-dim, #004d40)",
  fontFamily: "inherit",
  cursor: "pointer",
};
