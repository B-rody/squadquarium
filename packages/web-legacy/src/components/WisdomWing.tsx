export interface WisdomPattern {
  title: string;
  context: string;
}

export interface SkillChip {
  name: string;
  confidence?: string;
  triggers?: string[];
}

interface Props {
  markdown: string;
  skills?: SkillChip[];
  onClose: () => void;
}

export function parseWisdomPatterns(markdown: string): WisdomPattern[] {
  if (!markdown.trim()) return [];
  const lines = markdown.split(/\r?\n/);
  const patterns: WisdomPattern[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.trim().startsWith("<!--")) continue;
    const patternMatch = /\*\*Pattern:\*\*\s*(.*?)(?=\s*\*\*Context:\*\*|$)/.exec(line);
    if (!patternMatch) continue;
    const contextMatch =
      /\*\*Context:\*\*\s*(.*)$/.exec(line) ?? /\*\*Context:\*\*\s*(.*)$/.exec(lines[i + 1] ?? "");
    patterns.push({
      title: (patternMatch[1] ?? "").trim(),
      context: (contextMatch?.[1] ?? "").trim(),
    });
  }

  return patterns;
}

export default function WisdomWing({ markdown, skills = [], onClose }: Props) {
  const patterns = parseWisdomPatterns(markdown);

  return (
    <div
      style={{
        position: "absolute",
        inset: "24px",
        background: "rgba(0, 0, 0, 0.72)",
        zIndex: 500,
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        paddingTop: "24px",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          width: "520px",
          maxHeight: "75vh",
          overflow: "auto",
          background: "var(--skin-bg, #001f1c)",
          border: "1px solid var(--skin-fg, #00bfa5)",
          color: "var(--skin-fg, #00bfa5)",
          fontFamily: "var(--skin-font-family, monospace)",
          fontSize: "var(--skin-font-size, 14px)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "6px 8px",
            borderBottom: "1px solid var(--skin-dim, #004d40)",
          }}
        >
          <span>[ wisdom wing ]</span>
          <button onClick={onClose} style={buttonStyle}>
            [×]
          </button>
        </div>
        <div style={{ padding: "8px", display: "grid", gap: "8px" }}>
          {patterns.map((pattern, index) => (
            <div key={`${pattern.title}-${index}`} style={cardStyle}>
              <div>{truncate(pattern.title, 80)}</div>
              <div
                style={{ color: "var(--skin-dim, #004d40)", fontSize: "12px", marginTop: "4px" }}
              >
                {pattern.context || "no context recorded"}
              </div>
            </div>
          ))}
          {patterns.length === 0 && (
            <div style={{ color: "var(--skin-dim, #004d40)" }}>
              No wisdom patterns recorded yet.
            </div>
          )}
          <div style={{ borderTop: "1px solid var(--skin-dim, #004d40)", paddingTop: "8px" }}>
            <div style={{ color: "var(--skin-accent, #80cbc4)", marginBottom: "6px" }}>skills</div>
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
              {skills.map((skill) => (
                <span key={skill.name} style={chipStyle}>
                  [{skill.name}
                  {skill.confidence ? ` · ${skill.confidence}` : ""}]
                </span>
              ))}
              {skills.length === 0 && <span style={chipStyle}>[skills · pending]</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

const cardStyle: React.CSSProperties = {
  border: "1px solid var(--skin-dim, #004d40)",
  padding: "6px",
};

const chipStyle: React.CSSProperties = {
  border: "1px solid var(--skin-dim, #004d40)",
  color: "var(--skin-accent, #80cbc4)",
  padding: "1px 3px",
  fontSize: "11px",
};

const buttonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--skin-dim, #004d40)",
  fontFamily: "inherit",
  cursor: "pointer",
};
