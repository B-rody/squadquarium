import type { Rect } from "./types.js";

const MIN_AQUARIUM_HEIGHT = 5;
const MIN_COPILOT_HEIGHT = 8;
const BORDER_THICKNESS = 1;
const STATUS_BAR_HEIGHT = 1;
const SEPARATOR_HEIGHT = 1;

export interface Layout {
  width: number;
  height: number;
  aquarium: Rect;
  copilot: Rect;
  statusBar: Rect;
  /** @deprecated use copilot instead — kept for chrome/test compat */
  log: Rect;
  /** @deprecated no longer a separate region — input goes to PTY */
  input: Rect;
}

/**
 * Calculate the split layout: aquarium (~30% top) + copilot pane (~70% bottom).
 * A status bar sits at the very bottom. Regions never overlap.
 */
export function calculateLayout(width: number, height: number): Layout {
  const safeWidth = Math.max(1, Math.floor(width));
  const safeHeight = Math.max(1, Math.floor(height));
  const innerWidth = Math.max(1, safeWidth - BORDER_THICKNESS * 2);

  // Usable = total minus top border, bottom border, status bar, separator
  const usable = Math.max(
    0,
    safeHeight - BORDER_THICKNESS * 2 - STATUS_BAR_HEIGHT - SEPARATOR_HEIGHT,
  );

  // Target: aquarium ≈ 30%, copilot ≈ 70%
  let aquariumHeight = Math.round(usable * 0.3);
  let copilotHeight = usable - aquariumHeight;

  // Enforce minimums when there's enough space
  if (usable >= MIN_AQUARIUM_HEIGHT + MIN_COPILOT_HEIGHT) {
    aquariumHeight = Math.max(MIN_AQUARIUM_HEIGHT, aquariumHeight);
    copilotHeight = Math.max(MIN_COPILOT_HEIGHT, usable - aquariumHeight);
    aquariumHeight = usable - copilotHeight;
  } else if (usable > 0) {
    // Very small: give copilot priority
    copilotHeight = Math.max(1, Math.round(usable * 0.7));
    aquariumHeight = Math.max(0, usable - copilotHeight);
  } else {
    aquariumHeight = 0;
    copilotHeight = 0;
  }

  const aquarium: Rect = {
    x: BORDER_THICKNESS,
    y: BORDER_THICKNESS,
    width: innerWidth,
    height: aquariumHeight,
  };

  const copilotY = aquarium.y + aquariumHeight + SEPARATOR_HEIGHT;
  const copilot: Rect = {
    x: BORDER_THICKNESS,
    y: copilotY,
    width: innerWidth,
    height: copilotHeight,
  };

  const statusBar: Rect = {
    x: 0,
    y: safeHeight - 1,
    width: safeWidth,
    height: STATUS_BAR_HEIGHT,
  };

  return {
    width: safeWidth,
    height: safeHeight,
    aquarium,
    copilot,
    statusBar,
    // Compat aliases — copilot pane replaces both log and input
    log: copilot,
    input: { x: copilot.x, y: copilot.y + copilot.height - 1, width: innerWidth, height: 1 },
  };
}
