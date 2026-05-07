import type { AppSettings, ObsMode } from "../settings/store.js";
import { saveSettings } from "../settings/store.js";

interface Props {
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
  onClose: () => void;
}

const boolLabels: Array<[keyof AppSettings, string]> = [
  ["ambientSfx", "Ambient SFX"],
  ["alwaysOnTop", "Always on top"],
  ["crtBloom", "CRT Bloom"],
  ["crtScanlines", "CRT Scanlines"],
  ["voiceBubbles", "Voice Bubbles"],
  ["moodGlyphs", "Mood Glyphs"],
  ["gameMode", "Game Mode (cosmetic only)"],
  ["enableMultiAttach", "Multi-Attach view"],
];

const OBS_OPTIONS: Array<{ value: ObsMode; label: string }> = [
  { value: "off", label: "off" },
  { value: "transparent", label: "transparent" },
  { value: "chroma-green", label: "chroma-green (#00FF00)" },
  { value: "chroma-magenta", label: "chroma-magenta (#FF00FF)" },
];

export default function SettingsPanel({ settings, onChange, onClose }: Props) {
  const updateBool = (key: keyof AppSettings) => {
    const next = { ...settings, [key]: !settings[key] };
    saveSettings(next);
    onChange(next);
  };

  const updateObs = (value: ObsMode) => {
    const next = { ...settings, obsMode: value };
    saveSettings(next);
    onChange(next);
  };

  return (
    <div
      style={{
        position: "absolute",
        right: "24px",
        top: "48px",
        width: "300px",
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
        {boolLabels.map(([key, label]) => (
          <label
            key={key}
            style={{ display: "flex", justifyContent: "space-between", cursor: "pointer" }}
          >
            <span>{label}</span>
            <input
              type="checkbox"
              checked={settings[key] as boolean}
              onChange={() => updateBool(key)}
            />
          </label>
        ))}
        {/* OBS mode select */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>OBS Mode</span>
          <select
            value={settings.obsMode}
            onChange={(e) => updateObs(e.target.value as ObsMode)}
            style={{
              background: "var(--skin-bg, #001f1c)",
              color: "var(--skin-fg, #00bfa5)",
              border: "1px solid var(--skin-dim, #004d40)",
              fontFamily: "inherit",
              fontSize: "12px",
            }}
          >
            {OBS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
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
