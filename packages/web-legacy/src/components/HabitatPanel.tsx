import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { GlyphCanvas } from "../render/canvas.js";
import { HabitatRenderer } from "../render/habitat.js";
import { useCellMetrics } from "../render/cellMetrics.js";
import { useStore, useRitualEvents } from "../transport/store.js";
import type { SkinAssets } from "../skin/loader.js";

const FONT_SIZE = 14;

type SquadquariumWindow = Window & {
  __squadquarium__?: {
    __triggerApprovalQueue?: (name: string) => void;
    setRalphActive?: (active: boolean) => void;
    [key: string]: unknown;
  };
};

interface Props {
  skinAssets: SkinAssets;
  onAgentClick?: (agentName: string) => void;
  voiceBubbles?: boolean;
  moodGlyphs?: boolean;
  ralphActive?: boolean;
}

export default function HabitatPanel({
  skinAssets,
  onAgentClick,
  voiceBubbles = true,
  moodGlyphs = true,
  ralphActive = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<HabitatRenderer | null>(null);
  const [renderTick, setRenderTick] = useState(0);
  const [cameraPanPx, setCameraPanPx] = useState(0);
  const metrics = useCellMetrics(FONT_SIZE);
  const { snapshot, events, approvalPending, addApprovalSignal } = useStore();
  const rituals = useRitualEvents();
  const processedRitualsRef = useRef(0);

  const palette = skinAssets.manifest.palette;
  const resolveColor = useCallback((token: string) => palette[token] ?? token, [palette]);

  const agentRoles = useMemo(() => {
    const roles: Record<string, string> = {};
    for (const agent of snapshot?.agents ?? []) {
      roles[agent.name] = agent.role;
    }
    return roles;
  }, [snapshot]);

  const agentVoices = useMemo(() => {
    const voices: Record<string, string> = {};
    for (const agent of snapshot?.agents ?? []) {
      if (agent.charterVoice) voices[agent.name] = agent.charterVoice;
    }
    return voices;
  }, [snapshot]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const cols = 80;
    const rows = 24;

    const gc = new GlyphCanvas(canvas, metrics, FONT_SIZE, resolveColor);
    gc.resize(cols, rows);

    const renderer = new HabitatRenderer(gc, skinAssets, cols);
    renderer.voiceBubblesEnabled = voiceBubbles;
    renderer.moodGlyphsEnabled = moodGlyphs;
    renderer.setRalphActive(ralphActive);
    rendererRef.current = renderer;

    // Camera pan: CSS translateY on the container, then return.
    renderer.onCameraPan = (bandRow, duration) => {
      const offsetPx = bandRow * metrics.cellH;
      setCameraPanPx(-offsetPx);
      setTimeout(() => setCameraPanPx(0), duration + 300);
    };

    renderer.start(() => setRenderTick((t) => t + 1));

    return () => {
      renderer.stop();
      rendererRef.current = null;
    };
  }, [skinAssets, metrics, resolveColor, voiceBubbles, moodGlyphs, ralphActive]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.voiceBubblesEnabled = voiceBubbles;
    renderer.moodGlyphsEnabled = moodGlyphs;
    renderer.setRalphActive(ralphActive);
  }, [voiceBubbles, moodGlyphs, ralphActive]);

  useEffect(() => {
    const sqWindow = window as SquadquariumWindow;
    const sq = sqWindow.__squadquarium__ ?? {};
    sq.__triggerApprovalQueue = (name: string) => {
      addApprovalSignal({
        agentName: name,
        fileName: "playwright-approval.md",
        detectedAt: Date.now(),
      });
    };
    sq.setRalphActive = (active: boolean) => rendererRef.current?.setRalphActive(active);
    sqWindow.__squadquarium__ = sq;
    return () => {
      delete sq.__triggerApprovalQueue;
      delete sq.setRalphActive;
    };
  }, [addApprovalSignal]);

  // Forward new ritual events to the renderer.
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const newRituals = rituals.slice(processedRitualsRef.current);
    if (newRituals.length === 0) return;
    processedRitualsRef.current = rituals.length;
    for (const r of newRituals) {
      renderer.playRitual(r);
    }
  }, [rituals]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.render({
      agentRoles,
      recentEvents: events.slice(-50),
      approvalPending,
      agentVoices,
    });
  }, [renderTick, agentRoles, events, approvalPending, agentVoices]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!onAgentClick) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const col = Math.floor(x / metrics.cellW);
      const habitat = skinAssets.habitat as {
        bands: Array<{ role: string; height: number }>;
      };
      let bandRow = 0;
      const clickRow = Math.floor(y / metrics.cellH);
      for (const band of habitat.bands ?? []) {
        if (clickRow >= bandRow && clickRow < bandRow + band.height && col < 8) {
          const agent = Object.entries(agentRoles).find(([, r]) => r === band.role);
          if (agent) onAgentClick(agent[0]);
          break;
        }
        bandRow += band.height;
      }
    },
    [onAgentClick, metrics, skinAssets, agentRoles],
  );

  return (
    <div
      ref={containerRef}
      className="habitat-panel"
      style={{
        position: "relative",
        overflow: "hidden",
        transform: `translateY(${cameraPanPx}px)`,
        transition: "transform 600ms ease-in-out",
      }}
    >
      <canvas
        ref={canvasRef}
        className="glyph-canvas"
        onClick={handleClick}
        style={{ display: "block", cursor: onAgentClick ? "pointer" : "default" }}
      />
    </div>
  );
}
