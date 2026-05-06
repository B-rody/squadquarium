import { useEffect, useState, useRef } from "react";

export interface VisitorEvent {
  name: string;
  startedAt: number;
}

const ANIMATION_DURATION_MS = 3000;

// Aquarium: whaleshark dock glyph sequence (emerges from visitor cave band)
const AQUARIUM_FRAMES = ["<>", "<>{}", "<>{}<=", "<>{}<=~", "~<>{}<=~", "~<>{}~"] as const;

// Office: truck glyph slides in from right
const OFFICE_TRUCK_GLYPHS = ["╔═╦═╗", " ╔═╦═╗", "  ╔═╦═╗", "   ╔═╦═╗"] as const;

// Generic guest sprite
const GUEST_GLYPH = "(guest)";

interface Props {
  event: VisitorEvent | null;
  skinId?: string;
}

export default function VisitorAnimation({ event, skinId = "aquarium" }: Props) {
  const [frame, setFrame] = useState(0);
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!event) return;

    setFrame(0);
    setVisible(true);
    setFading(false);

    const glyphs = skinId === "office" ? OFFICE_TRUCK_GLYPHS : AQUARIUM_FRAMES;

    intervalRef.current = setInterval(() => {
      setFrame((f) => (f + 1) % glyphs.length);
    }, 300);

    timerRef.current = setTimeout(() => {
      setFading(true);
      clearInterval(intervalRef.current ?? undefined);
      setTimeout(() => {
        setVisible(false);
        setFading(false);
      }, 600);
    }, ANIMATION_DURATION_MS);

    return () => {
      clearInterval(intervalRef.current ?? undefined);
      clearTimeout(timerRef.current ?? undefined);
    };
  }, [event, skinId]);

  if (!visible || !event) return null;

  const isOffice = skinId === "office";
  const glyphs = isOffice ? OFFICE_TRUCK_GLYPHS : AQUARIUM_FRAMES;
  const currentGlyph = glyphs[frame % glyphs.length] ?? glyphs[0];

  return (
    <div
      style={{
        position: "absolute",
        bottom: isOffice ? "20%" : "10%",
        right: isOffice ? "0" : undefined,
        left: isOffice ? undefined : "50%",
        transform: isOffice ? "none" : "translateX(-50%)",
        zIndex: 800,
        fontFamily: "var(--skin-font-family, monospace)",
        fontSize: "var(--skin-font-size, 14px)",
        color: "var(--skin-accent, #80cbc4)",
        opacity: fading ? 0 : 1,
        transition: "opacity 0.6s ease",
        display: "grid",
        gap: "2px",
        textAlign: "center",
        pointerEvents: "none",
      }}
    >
      <div style={{ letterSpacing: "1px" }}>{currentGlyph}</div>
      <div
        style={{
          color: "var(--skin-fg, #00bfa5)",
          opacity: fading ? 0 : frame > 2 ? 1 : 0,
          transition: "opacity 0.3s ease",
        }}
      >
        {GUEST_GLYPH} {event.name}
      </div>
    </div>
  );
}

// ── Visitor detection hook (exported from store supplement) ───────────────────

export function isVisitorEvent(entityKey: string, payload: unknown): boolean {
  if (/agent:guest:/i.test(entityKey)) return true;
  if (typeof payload === "object" && payload !== null) {
    const p = payload as Record<string, unknown>;
    if (p["kind"] === "visitor-arrived") return true;
  }
  return false;
}

export function extractVisitorName(entityKey: string, payload: unknown): string {
  const guestMatch = /agent:guest:([^:/]+)/i.exec(entityKey);
  if (guestMatch?.[1]) return guestMatch[1];
  if (typeof payload === "object" && payload !== null) {
    const p = payload as Record<string, unknown>;
    if (typeof p["name"] === "string") return p["name"];
    if (typeof p["agentName"] === "string") return p["agentName"];
  }
  return "visitor";
}
