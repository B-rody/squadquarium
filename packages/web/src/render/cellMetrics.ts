import { useState, useEffect } from "react";

export interface CellMetrics {
  cellW: number;
  cellH: number;
  baseline: number;
}

const FALLBACK: CellMetrics = { cellW: 9, cellH: 18, baseline: 14 };

function measureFont(fontSize: number): CellMetrics {
  if (typeof document === "undefined") return FALLBACK;
  const span = document.createElement("span");
  span.style.cssText = [
    `font-family: "JetBrains Mono", monospace`,
    `font-size: ${fontSize}px`,
    `line-height: 1`,
    `font-feature-settings: "liga" 0`,
    `position: fixed`,
    `top: -9999px`,
    `left: -9999px`,
    `white-space: pre`,
    `visibility: hidden`,
  ].join(";");
  span.textContent = "M";
  document.body.appendChild(span);
  const rect = span.getBoundingClientRect();
  document.body.removeChild(span);

  const cellW = rect.width > 0 ? rect.width : FALLBACK.cellW;
  const cellH = rect.height > 0 ? rect.height : FALLBACK.cellH;
  const baseline = Math.round(cellH * 0.8);
  return { cellW, cellH, baseline };
}

const metricsCache = new Map<number, CellMetrics>();

export function getCellMetrics(fontSize: number): CellMetrics {
  if (metricsCache.has(fontSize)) return metricsCache.get(fontSize)!;
  const m = measureFont(fontSize);
  metricsCache.set(fontSize, m);
  return m;
}

export function useCellMetrics(fontSize: number): CellMetrics {
  const [metrics, setMetrics] = useState<CellMetrics>(() => getCellMetrics(fontSize));

  useEffect(() => {
    if (typeof document !== "undefined" && "fonts" in document) {
      document.fonts.ready.then(() => {
        metricsCache.delete(fontSize);
        setMetrics(getCellMetrics(fontSize));
      });
    }
  }, [fontSize]);

  return metrics;
}
