import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { GlyphCanvas } from "../render/canvas.js";
import { HabitatRenderer } from "../render/habitat.js";
import { useCellMetrics } from "../render/cellMetrics.js";
import { useStore } from "../transport/store.js";
import type { SkinAssets } from "../skin/loader.js";

const FONT_SIZE = 14;

interface Props {
  skinAssets: SkinAssets;
  onAgentClick?: (agentName: string) => void;
}

export default function HabitatPanel({ skinAssets, onAgentClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<HabitatRenderer | null>(null);
  const [renderTick, setRenderTick] = useState(0);
  const metrics = useCellMetrics(FONT_SIZE);
  const { snapshot, events } = useStore();

  const palette = skinAssets.manifest.palette;
  const resolveColor = useCallback((token: string) => palette[token] ?? token, [palette]);

  const agentRoles = useMemo(() => {
    const roles: Record<string, string> = {};
    for (const agent of snapshot?.agents ?? []) {
      roles[agent.name] = agent.role;
    }
    return roles;
  }, [snapshot]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const cols = 80;
    const rows = 24;

    const gc = new GlyphCanvas(canvas, metrics, FONT_SIZE, resolveColor);
    gc.resize(cols, rows);

    const renderer = new HabitatRenderer(gc, skinAssets, cols);
    rendererRef.current = renderer;

    renderer.start(() => setRenderTick((t) => t + 1));

    return () => {
      renderer.stop();
      rendererRef.current = null;
    };
  }, [skinAssets, metrics, resolveColor]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.render({ agentRoles, recentEvents: events.slice(-20) });
  }, [renderTick, agentRoles, events]);

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
    <div className="habitat-panel" style={{ position: "relative", overflow: "hidden" }}>
      <canvas
        ref={canvasRef}
        className="glyph-canvas"
        onClick={handleClick}
        style={{ display: "block", cursor: onAgentClick ? "pointer" : "default" }}
      />
    </div>
  );
}
