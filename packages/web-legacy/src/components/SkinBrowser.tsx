import { useState } from "react";

interface CommunityPack {
  id: string;
  label: string;
  availability: string;
}

const COMMUNITY_PACKS: CommunityPack[] = [
  { id: "deep-trench", label: "deep trench", availability: "v2.x" },
  { id: "cottage-village", label: "cottage village", availability: "v2.x" },
  { id: "space-station", label: "space station", availability: "v2.x" },
  { id: "fungus-colony", label: "fungus colony", availability: "v2.x" },
];

interface Props {
  localSkins: string[];
  activeSkin: string;
  onSkinChange: (name: string) => void;
  onClose: () => void;
}

export default function SkinBrowser({ localSkins, activeSkin, onSkinChange, onClose }: Props) {
  const [confirmPack, setConfirmPack] = useState<CommunityPack | null>(null);

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <span>[ skins ]</span>
        <button onClick={onClose} style={btnStyle}>
          [×]
        </button>
      </div>

      <div
        style={{
          padding: "8px",
          overflowY: "auto",
          maxHeight: "70vh",
          display: "grid",
          gap: "12px",
        }}
      >
        {/* Installed skins */}
        <section>
          <div style={sectionLabel}>installed</div>
          {localSkins.length === 0 && <div style={dimStyle}>no skins found</div>}
          {localSkins.map((name) => (
            <div
              key={name}
              style={{
                ...cardStyle,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ color: name === activeSkin ? "var(--skin-fg)" : "var(--skin-dim)" }}>
                {name === activeSkin ? "▶ " : "  "}
                {name}
              </span>
              {name !== activeSkin && (
                <button onClick={() => onSkinChange(name)} style={actionBtnStyle}>
                  [apply]
                </button>
              )}
              {name === activeSkin && (
                <span style={{ color: "var(--skin-accent)", fontSize: "11px" }}>active</span>
              )}
            </div>
          ))}
        </section>

        {/* Community packs */}
        <section>
          <div style={sectionLabel}>community packs</div>
          <div style={{ ...dimStyle, marginBottom: "6px", fontSize: "11px" }}>
            available in upcoming releases
          </div>
          {COMMUNITY_PACKS.map((pack) => (
            <div
              key={pack.id}
              style={{
                ...cardStyle,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ color: "var(--skin-dim)" }}>{pack.label}</span>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <span style={availBadgeStyle}>[available {pack.availability}]</span>
                <button onClick={() => setConfirmPack(pack)} style={actionBtnStyle}>
                  [install]
                </button>
              </div>
            </div>
          ))}
        </section>
      </div>

      {/* Install confirm dialog */}
      {confirmPack && (
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
          onClick={() => setConfirmPack(null)}
        >
          <div
            style={{
              ...panelStyle,
              position: "relative",
              transform: "none",
              left: "auto",
              top: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={headerStyle}>
              <span>[ install community skin ]</span>
              <button onClick={() => setConfirmPack(null)} style={btnStyle}>
                [×]
              </button>
            </div>
            <div style={{ padding: "12px", display: "grid", gap: "10px" }}>
              <div>
                Install <strong>{confirmPack.label}</strong>?
              </div>
              <div style={dimStyle}>Community skin packs are installed via the Squad CLI:</div>
              <div style={{ border: "1px solid var(--skin-dim)", padding: "6px" }}>
                <code style={{ userSelect: "all", fontSize: "11px" }}>
                  squad plugin install community/skin-{confirmPack.id}
                </code>
              </div>
              <div style={{ ...dimStyle, fontSize: "11px" }}>
                Requires Squad v{confirmPack.availability}+. Copy the command above and run it in
                your terminal.
              </div>
              <button onClick={() => setConfirmPack(null)} style={actionBtnStyle}>
                [dismiss]
              </button>
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
  zIndex: 550,
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

const actionBtnStyle: React.CSSProperties = {
  background: "none",
  border: "1px solid var(--skin-dim, #004d40)",
  color: "var(--skin-fg, #00bfa5)",
  fontFamily: "inherit",
  cursor: "pointer",
  padding: "0 4px",
  fontSize: "11px",
};

const cardStyle: React.CSSProperties = {
  border: "1px solid var(--skin-dim, #004d40)",
  padding: "4px 6px",
  marginBottom: "4px",
};

const sectionLabel: React.CSSProperties = {
  color: "var(--skin-accent, #80cbc4)",
  fontSize: "11px",
  marginBottom: "6px",
};

const dimStyle: React.CSSProperties = {
  color: "var(--skin-dim, #004d40)",
  fontSize: "12px",
};

const availBadgeStyle: React.CSSProperties = {
  color: "var(--skin-dim, #004d40)",
  fontSize: "10px",
  border: "1px solid var(--skin-dim, #004d40)",
  padding: "0 2px",
};
