import type { Rect } from "./types.js";

const MIN_AQUARIUM_HEIGHT = 8;
const MIN_LOG_HEIGHT = 4;
const INPUT_HEIGHT = 2;
const BORDER_THICKNESS = 1;
const SEPARATOR_ROWS = 2;

export interface Layout {
  width: number;
  height: number;
  aquarium: Rect;
  log: Rect;
  input: Rect;
  statusBar: Rect;
}

export function calculateLayout(width: number, height: number): Layout {
  const safeWidth = Math.max(1, Math.floor(width));
  const safeHeight = Math.max(1, Math.floor(height));
  const innerWidth = Math.max(1, safeWidth - BORDER_THICKNESS * 2);
  const usableHeight = Math.max(
    0,
    safeHeight - BORDER_THICKNESS * 2 - INPUT_HEIGHT - SEPARATOR_ROWS,
  );

  let aquariumHeight = Math.round(usableHeight * 0.6);
  let logHeight = usableHeight - aquariumHeight;

  if (usableHeight >= MIN_AQUARIUM_HEIGHT + MIN_LOG_HEIGHT) {
    aquariumHeight = Math.max(MIN_AQUARIUM_HEIGHT, aquariumHeight);
    logHeight = Math.max(MIN_LOG_HEIGHT, usableHeight - aquariumHeight);
    aquariumHeight = Math.max(MIN_AQUARIUM_HEIGHT, usableHeight - logHeight);
  } else {
    aquariumHeight = usableHeight === 0 ? 0 : Math.max(1, Math.min(usableHeight, aquariumHeight));
    logHeight = Math.max(0, usableHeight - aquariumHeight);
  }

  const aquarium: Rect = {
    x: BORDER_THICKNESS,
    y: BORDER_THICKNESS,
    width: innerWidth,
    height: aquariumHeight,
  };
  const log: Rect = {
    x: BORDER_THICKNESS,
    y: aquarium.y + aquarium.height + 1,
    width: innerWidth,
    height: logHeight,
  };
  const inputY = Math.max(log.y + log.height + 1, safeHeight - BORDER_THICKNESS - INPUT_HEIGHT);
  const input: Rect = {
    x: BORDER_THICKNESS,
    y: inputY,
    width: innerWidth,
    height: Math.min(INPUT_HEIGHT, Math.max(0, safeHeight - BORDER_THICKNESS - inputY)),
  };

  return {
    width: safeWidth,
    height: safeHeight,
    aquarium,
    log,
    input,
    statusBar: { x: 0, y: 0, width: safeWidth, height: 1 },
  };
}
